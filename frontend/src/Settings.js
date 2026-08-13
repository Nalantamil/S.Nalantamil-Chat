import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, User, Shield, SlidersHorizontal, Bell, MessageSquare, Database,
  Camera, Check, Circle, AlertCircle, Loader2, Eye, EyeOff, LogOut, Trash2,
  Download, Volume2, VolumeX, X,
} from 'lucide-react';
import { getStoredTheme, changeTheme, initTheme } from './theme';
import Avatar from './Avatar';

const API = 'https://s-nalantamil-chat.onrender.com';
const AVATAR_COLORS = ['#667eea', '#e74c3c', '#2ecc71', '#f39c12', '#e91e63', '#00bcd4', '#9c27b0', '#ff5722'];

// ===== PROFILE AVATAR CACHE — the profile fetch hits a cold-start server, so
// the avatar used to sit blank (loading skeleton) until it answered. We cache
// the last known photo/colour per user and paint it immediately. =====
const profileCacheKey = (username) => `profile_cache_${username}`;
const readProfileCache = (username) => {
  try {
    const raw = localStorage.getItem(profileCacheKey(username));
    return raw ? JSON.parse(raw) : null;
  } catch (err) { return null; }
};
const writeProfileCache = (username, data) => {
  try {
    localStorage.setItem(profileCacheKey(username), JSON.stringify({
      avatar_url: data.avatar_url || '',
      avatar_color: data.avatar_color || AVATAR_COLORS[0],
    }));
  } catch (err) {}
};

// Profile-card avatar: same look as the shared <Avatar>, plus an onError
// fallback so a broken/expired photo URL degrades to the colour + initial
// instead of rendering nothing at all.
function ProfileAvatar({ user, size = 72 }) {
  const [broken, setBroken] = useState(false);
  const url = user?.avatar_url;
  useEffect(() => { setBroken(false); }, [url]);
  const common = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  };
  if (url && !broken) {
    return (
      <div style={common}>
        <img src={url} alt={user?.username || 'Profile photo'} onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  return (
    <div style={{
      ...common,
      background: user?.avatar_color || AVATAR_COLORS[0],
      color: '#fff', fontWeight: 700, fontSize: Math.round(size * 0.4),
    }}>
      {user?.username ? user.username[0].toUpperCase() : '?'}
    </div>
  );
}
const ACCENTS = {
  violet: { label: 'Violet', c1: '#6366f1', c2: '#8b5cf6' },
  blue: { label: 'Blue', c1: '#3b82f6', c2: '#06b6d4' },
  emerald: { label: 'Emerald', c1: '#10b981', c2: '#22c55e' },
  amber: { label: 'Amber', c1: '#f59e0b', c2: '#f97316' },
};

const NAV_ITEMS = [
  { key: 'profile', label: 'Profile', Icon: User },
  { key: 'account', label: 'Account', Icon: Shield },
  { key: 'preferences', label: 'Preferences', Icon: SlidersHorizontal },
  { key: 'notifications', label: 'Notifications', Icon: Bell },
  { key: 'chats', label: 'Chats', Icon: MessageSquare },
  { key: 'data', label: 'Data', Icon: Database },
];

// ===== PREFERENCES — persisted per user, applied live (no Save button). =====
const DEFAULT_PREFS = {
  accent: 'violet', fontSize: 'default', density: 'comfortable',
  sendOnEnter: true, autoScroll: true, defaultView: 'last',
  linkPreviews: true, readReceipts: true, typingIndicator: true, imageAutoDownload: true,
  emojiSkinTone: 'default',
};

function usePreferences(username) {
  const [prefs, setPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem(`preferences_${username}`);
      if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch (err) {}
    return DEFAULT_PREFS;
  });

  useEffect(() => {
    try { localStorage.setItem(`preferences_${username}`, JSON.stringify(prefs)); } catch (err) {}
  }, [prefs, username]);

  // Apply theme + accent live via CSS custom properties on <html>. These affect
  // this Settings page fully, and — since Chat.js's own stylesheet already
  // references var(--accent)/var(--accent-2) for its notification system,
  // toggles, segmented controls, and badges — those pick up the change too.
  // The older hardcoded chat-bubble/sidebar colors in Chat.js are untouched;
  // retokenizing those is a separate, much larger pass.
useEffect(() => {
    const root = document.documentElement;
    const accent = ACCENTS[prefs.accent] || ACCENTS.violet;
    root.style.setProperty('--accent', accent.c1);
    root.style.setProperty('--accent-2', accent.c2);
    root.setAttribute('data-font-size', prefs.fontSize);
  }, [prefs.accent, prefs.fontSize]);

  useEffect(() => {
    const cleanup = initTheme();
    return cleanup;
  }, []);

  const updatePref = (key, value) => setPrefs(prev => ({ ...prev, [key]: value }));
  return [prefs, updatePref];
}

const uploadToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'chat_app_uploads');
  formData.append('cloud_name', 'r2mj3pjl');
  const res = await fetch('https://api.cloudinary.com/v1_1/r2mj3pjl/image/upload', { method: 'POST', body: formData });
  const data = await res.json();
  return data.secure_url;
};

const getPasswordChecks = (pwd) => ({
  length: pwd.length >= 8,
  uppercase: /[A-Z]/.test(pwd),
  number: /[0-9]/.test(pwd),
  special: /[^A-Za-z0-9]/.test(pwd),
});
const getPasswordStrength = (pwd) => {
  if (!pwd) return { label: '', level: 0 };
  const checks = getPasswordChecks(pwd);
  let score = Object.values(checks).filter(Boolean).length;
  if (pwd.length >= 12) score++;
  if (score <= 1) return { label: 'Weak', level: 1 };
  if (score === 2) return { label: 'Fair', level: 2 };
  if (score <= 4) return { label: 'Good', level: 3 };
  return { label: 'Strong', level: 4 };
};

// ===== Small shared control building blocks (mirroring Chat.js's toggle-switch
// and segmented-control visually, since they can't be imported cross-file
// without changing Chat.js's exports). =====
const ToggleSwitch = ({ on, onClick, ariaLabel }) => (
  <button className={`stg-toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={ariaLabel} onClick={onClick}>
    <span className="stg-toggle-thumb" />
  </button>
);

const SegmentedControl = ({ options, value, onChange, ariaLabel }) => (
  <div className="stg-segmented" role="radiogroup" aria-label={ariaLabel}>
    <div className="stg-segmented-indicator" style={{ transform: `translateX(${options.findIndex(o => o.value === value) * 100}%)`, width: `${100 / options.length}%` }} />
    {options.map(o => (
      <label key={o.value} className={`stg-segmented-option ${value === o.value ? 'active' : ''}`}>
        <input type="radio" checked={value === o.value} onChange={() => onChange(o.value)} />
        {o.label}
      </label>
    ))}
  </div>
);

export default function Settings({ username, onLogout }) {
  const navigate = useNavigate();
  const { section = 'profile' } = useParams();
  const [prefs, updatePref] = usePreferences(username);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(() => window.innerWidth >= 768 && window.innerWidth < 1024);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const goToSection = (key) => navigate(`/settings/${key}`);
  const activeItem = NAV_ITEMS.find(i => i.key === section) || NAV_ITEMS[0];

  // On mobile, a section is only shown once explicitly navigated to; the nav
  // list itself is the "page" until then.
  const showMobileSectionPage = isMobile && window.location.pathname !== '/settings';

  return (
    <div className="stg-page">
    <style>{`
        /* Settings owns its own light/dark tokens, scoped to .stg-page so the
           chat's own variables are never overridden. Falls back to the global
           token if the app already defines one. */
        .stg-page {
          --stg-bg: var(--bg, #ffffff);
          --stg-surface-2: var(--surface-2, #f6f7fa);
          --stg-surface-3: var(--surface-3, #eceef4);
          --stg-surface-4: var(--surface-4, #dfe3ec);
          --stg-border: var(--border, #e1e5ee);
          --stg-fg: var(--foreground, #10131f);
          --stg-muted: var(--muted-foreground, #565c6e);
          --stg-faint: var(--faint-foreground, #858b9c);
          --stg-destructive: var(--destructive, #ef4444);
          --stg-success: var(--success, #10b981);

          min-height: 100vh; background: var(--stg-bg); color: var(--stg-fg);
          font-family: 'Segoe UI', sans-serif; display: flex;
        }
        html.dark .stg-page {
          --stg-bg: var(--bg, #0f1117);
          --stg-surface-2: var(--surface-2, #161a25);
          --stg-surface-3: var(--surface-3, #1f2431);
          --stg-surface-4: var(--surface-4, #2b3140);
          --stg-border: var(--border, rgba(255,255,255,0.10));
          --stg-fg: var(--foreground, #f2f3f7);
          --stg-muted: var(--muted-foreground, #a4a9ba);
          --stg-faint: var(--faint-foreground, #767c8e);
        }
        html.dark .stg-page input,
        html.dark .stg-page textarea,
        html.dark .stg-page select { color-scheme: dark; }
        .stg-page[data-font-size="small"] { font-size: 13px; }
        .stg-page[data-font-size="large"] { font-size: 16px; }

        .stg-nav {
          width: 280px; min-width: 280px; background: var(--stg-surface-2);
          border-right: 1px solid var(--stg-border); padding: 20px 12px; height: 100vh;
          overflow-y: auto; position: sticky; top: 0;
        }
        .stg-back-link {
          display: flex; align-items: center; gap: 8px; color: var(--stg-muted);
          font-size: 13px; font-weight: 600; padding: 8px 10px; border-radius: 8px;
          cursor: pointer; text-decoration: none; background: none; border: none; width: 100%; text-align: left;
        }
        .stg-back-link:hover { background: var(--stg-surface-3); color: var(--stg-fg); }
        .stg-nav-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--stg-faint); padding: 18px 10px 8px; }
        .stg-nav-item {
          display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
          padding: 10px 12px; border-radius: 10px; background: none; border: none;
          color: var(--stg-muted); font-size: 14px; cursor: pointer; position: relative;
          transition: background 120ms, color 120ms; min-height: 44px;
        }
        .stg-nav-item:hover { background: rgba(99,102,241,0.06); }
        .stg-nav-item.active { background: var(--stg-surface-3); color: var(--accent); font-weight: 600; }
        .stg-nav-item.active::before { content: ''; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; border-radius: 2px; background: var(--accent); }

        .stg-content { flex: 1; overflow-y: auto; height: 100vh; padding: 40px 24px; }
        .stg-content-inner { max-width: 720px; }
        .stg-h1 { font-size: 24px; font-weight: 700; margin-bottom: 24px; }
        .stg-card { background: var(--stg-surface-2); border: 1px solid var(--stg-border); border-radius: 16px; padding: 24px; margin-bottom: 16px; }
        .stg-card-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
        .stg-card-sub { font-size: 12px; color: var(--stg-muted); margin-bottom: 16px; }
        .stg-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; }
        .stg-row + .stg-row { border-top: 1px solid var(--stg-border); }
        .stg-row-label { font-size: 14px; font-weight: 500; }
        .stg-row-sub { font-size: 12px; color: var(--stg-muted); margin-top: 2px; }

        .stg-field-label { font-size: 13px; font-weight: 500; color: var(--stg-muted); margin-bottom: 8px; display: block; }
        .stg-input {
          width: 100%; box-sizing: border-box; height: 48px; min-height: 48px;
          background: var(--stg-surface-3); border: 1px solid var(--stg-border);
          border-radius: 10px; color: var(--stg-fg); padding: 0 14px; font-size: 14px; outline: none;
          transition: border-color 150ms, box-shadow 150ms; font-family: inherit;
        }
        .stg-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        .stg-input:disabled { opacity: 0.55; cursor: not-allowed; }
        .stg-textarea { height: auto; min-height: 120px; max-height: 120px; padding: 12px 14px; resize: vertical; line-height: 1.5; }
        .stg-field-group { margin-bottom: 20px; }
        .stg-field-group:last-child { margin-bottom: 0; }
        .stg-char-count { font-size: 11px; color: var(--stg-faint); text-align: right; margin-top: 6px; width: 100%; box-sizing: border-box; }
        .stg-field-helper { font-size: 12px; color: var(--stg-muted); margin-top: 6px; }
        .stg-input-wrap { position: relative; width: 100%; box-sizing: border-box; }
        .stg-input-wrap .stg-input { padding-right: 48px; }
        .stg-input-icon-btn {
          position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
          width: 44px; height: 44px; min-width: 44px; border-radius: 8px; background: none; border: none;
          color: var(--stg-muted); display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .stg-input-icon-btn:hover { background: var(--stg-surface-4); }
        .stg-at-prefix {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--stg-muted); font-size: 14px; pointer-events: none; z-index: 1;
        }
        .stg-input-with-prefix { padding-left: 28px; }
        select.stg-input { width: 100%; -webkit-appearance: none; appearance: none; }

        .stg-avatar-block { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
        .stg-avatar-wrap { position: relative; width: 72px; height: 72px; flex-shrink: 0; }
        .stg-avatar-img { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; }
        .stg-avatar-fallback { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 26px; font-weight: 700; }
        .stg-avatar-upload-badge {
          position: absolute; bottom: -2px; right: -2px; width: 26px; height: 26px; border-radius: 50%;
          background: var(--accent); border: 2px solid var(--stg-surface-2); color: white;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .stg-avatar-help { font-size: 12px; color: var(--stg-muted); align-self: center; }
        .stg-swatch-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .stg-swatch { width: 26px; height: 26px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; }
        .stg-swatch.selected { border-color: var(--stg-fg); box-shadow: 0 0 0 2px var(--accent); }

        .stg-sticky-footer {
          position: sticky; bottom: 0; display: flex; justify-content: flex-end; gap: 10px;
          padding: 14px 24px; margin: 0 -24px -24px; background: var(--stg-surface-2);
          border-top: 1px solid var(--stg-border); border-radius: 0 0 16px 16px;
        }
        .stg-btn-primary {
          background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: white; border: none;
          padding: 10px 22px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer;
          display: inline-flex; align-items: center; gap: 8px; min-height: 44px; transition: filter 150ms;
        }
        .stg-btn-primary:hover:not(:disabled) { filter: brightness(1.08); }
        .stg-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .stg-btn-ghost {
          background: none; border: 1px solid var(--stg-border); color: var(--stg-muted);
          padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; min-height: 44px;
        }
        .stg-btn-ghost:hover { border-color: var(--stg-faint); color: var(--stg-fg); }
        .stg-btn-destructive {
          background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: var(--stg-destructive);
          padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer;
          display: inline-flex; align-items: center; gap: 8px; min-height: 44px;
        }
        .stg-btn-destructive:hover { background: rgba(239,68,68,0.2); }

        .stg-pill { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; }
        .stg-pill.verified { background: rgba(16,185,129,0.15); color: var(--stg-success); }
        .stg-pill.unverified { background: rgba(245,158,11,0.15); color: #f59e0b; }

        .stg-error-text { display: flex; align-items: center; gap: 5px; color: var(--stg-destructive); font-size: 12px; margin: 6px 0 0; }
        .stg-success-text { display: flex; align-items: center; gap: 5px; color: var(--stg-success); font-size: 12px; margin: 6px 0 0; }

        .stg-strength-bar-wrap { display: flex; gap: 4px; margin: 8px 0 6px; }
        .stg-strength-bar { flex: 1; height: 4px; border-radius: 2px; background: var(--stg-surface-4); }
        .stg-strength-bar.on-1 { background: rgba(99,102,241,0.35); }
        .stg-strength-bar.on-2 { background: rgba(99,102,241,0.55); }
        .stg-strength-bar.on-3 { background: rgba(99,102,241,0.78); }
        .stg-strength-bar.on-4 { background: var(--accent); }
        .stg-strength-label { font-size: 11px; color: var(--stg-muted); margin-bottom: 10px; }
        .stg-checklist { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; margin-bottom: 14px; }
        .stg-check-item { font-size: 12px; display: flex; align-items: center; gap: 6px; color: var(--stg-faint); }
        .stg-check-item.met { color: var(--stg-success); }

        .stg-segmented { position: relative; display: flex; background: var(--stg-surface-3); border-radius: 10px; padding: 3px; }
        .stg-segmented-indicator { position: absolute; top: 3px; left: 3px; height: calc(100% - 6px); border-radius: 8px; background: linear-gradient(135deg, var(--accent), var(--accent-2)); transition: transform 150ms ease-out; }
        .stg-segmented-option { flex: 1; position: relative; z-index: 1; text-align: center; padding: 8px 4px; font-size: 12.5px; font-weight: 600; color: var(--stg-muted); cursor: pointer; border-radius: 8px; }
        .stg-segmented-option.active { color: white; }
        .stg-segmented-option input { position: absolute; opacity: 0; width: 1px; height: 1px; }

        .stg-toggle { width: 44px; height: 24px; border-radius: 12px; background: var(--stg-surface-4); border: none; cursor: pointer; position: relative; flex-shrink: 0; transition: background 180ms ease; }
        .stg-toggle.on { background: linear-gradient(135deg, var(--accent), var(--accent-2)); }
        .stg-toggle-thumb { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: white; transition: transform 180ms ease; }
        .stg-toggle.on .stg-toggle-thumb { transform: translateX(20px); }

        .stg-preview-line { font-size: 1em; color: var(--stg-muted); margin-top: 10px; padding: 10px 14px; background: var(--stg-surface-3); border-radius: 10px; }

        .stg-mute-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; }
        .stg-mute-row + .stg-mute-row { border-top: 1px solid var(--stg-border); }
        .stg-mute-name { flex: 1; font-size: 13px; }
        .stg-unmute-btn { background: none; border: 1px solid var(--stg-border); color: var(--stg-muted); font-size: 12px; padding: 5px 12px; border-radius: 8px; cursor: pointer; }
        .stg-unmute-btn:hover { color: var(--stg-fg); border-color: var(--stg-faint); }

        .stg-storage-bar { height: 8px; border-radius: 4px; background: var(--stg-surface-4); overflow: hidden; margin: 10px 0; }
        .stg-storage-fill { height: 100%; background: linear-gradient(135deg, var(--accent), var(--accent-2)); }

        .stg-confirm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; }
        .stg-confirm-dialog { width: min(400px, calc(100vw - 32px)); background: var(--stg-surface-2); border: 1px solid var(--stg-border); border-radius: 16px; padding: 24px; }
        .stg-confirm-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; color: var(--stg-destructive); }
        .stg-confirm-body { font-size: 13px; color: var(--stg-muted); margin-bottom: 16px; line-height: 1.5; }
        .stg-confirm-footer { display: flex; justify-content: flex-end; gap: 10px; }

        .stg-toast {
          position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 10000;
          background: var(--stg-surface-3); border: 1px solid var(--stg-border); border-radius: 12px;
          padding: 12px 18px; display: flex; align-items: center; gap: 10px; font-size: 13px; box-shadow: 0 12px 32px rgba(0,0,0,0.4);
        }

        @media (max-width: 1023px) {
          .stg-nav { width: 72px; min-width: 72px; padding: 16px 8px; }
          .stg-nav-label, .stg-nav-item span, .stg-back-link span { display: none; }
          .stg-nav-item { justify-content: center; }
          .stg-back-link { justify-content: center; }
        }
        @media (max-width: 767px) {
          .stg-page { flex-direction: column; }
          .stg-nav { width: 100%; min-width: 0; height: auto; position: relative; padding: 12px; }
          .stg-nav-label, .stg-nav-item span, .stg-back-link span { display: inline; }
          .stg-nav-item { justify-content: flex-start; }
          .stg-back-link { justify-content: flex-start; }
          .stg-content { padding: 16px; height: auto; }
          .stg-card { padding: 18px; }
        }
      `}</style>

      {(!isMobile || !showMobileSectionPage) && (
        <nav className="stg-nav" aria-label="Settings navigation">
          <button className="stg-back-link" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /><span>Back to chat</span>
          </button>
          <div className="stg-nav-label">Settings</div>
          {NAV_ITEMS.map(item => (
            <button key={item.key} className={`stg-nav-item ${section === item.key ? 'active' : ''}`}
              aria-current={section === item.key ? 'page' : undefined}
              title={isTablet ? item.label : undefined}
              onClick={() => goToSection(item.key)}>
              <item.Icon size={17} /><span>{item.label}</span>
            </button>
          ))}
        </nav>
      )}

      {(!isMobile || showMobileSectionPage) && (
        <main className="stg-content">
          <div className="stg-content-inner">
            {isMobile && (
              <button className="stg-back-link" style={{ marginBottom: '16px' }} onClick={() => navigate('/settings')}>
                <ArrowLeft size={16} /><span>All settings</span>
              </button>
            )}
            <h1 className="stg-h1">{activeItem.label}</h1>
            {section === 'profile' && <ProfileSection username={username} />}
            {section === 'account' && <AccountSection username={username} onLogout={onLogout} />}
            {section === 'preferences' && <PreferencesSection prefs={prefs} updatePref={updatePref} />}
            {section === 'notifications' && <NotificationsSection username={username} />}
            {section === 'chats' && <ChatsSection prefs={prefs} updatePref={updatePref} />}
            {section === 'data' && <DataSection username={username} />}
          </div>
        </main>
      )}
    </div>
  );
}

// ===================== PROFILE =====================
function ProfileSection({ username }) {
  const [original, setOriginal] = useState(null);
  const [form, setForm] = useState(null); // null while loading — never a premature fallback
  const [cached] = useState(() => readProfileCache(username)); // last known photo/colour, painted instantly
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/profile/${username}`).then(res => {
      const data = {
        display_name: res.data.display_name || '',
        bio: res.data.bio || '',
        status: res.data.status || '',
        avatar_color: res.data.avatar_color || AVATAR_COLORS[0],
        avatar_url: res.data.avatar_url || '',
      };
      setForm(data);
      setOriginal(data);
      writeProfileCache(username, data);
    }).catch(() => setForm({ display_name: '', bio: '', status: '', avatar_color: AVATAR_COLORS[0], avatar_url: '' }));
  }, [username]);

  const dirty = original && form && JSON.stringify(form) !== JSON.stringify(original);

  const handleAvatarFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setForm(prev => ({ ...prev, avatar_url: url }));
      writeProfileCache(username, { ...(form || {}), avatar_url: url });
    } catch (err) {}
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/profile/${username}`, form);
      setOriginal(form);
      writeProfileCache(username, form);
      setToast('Profile saved');
      setTimeout(() => setToast(''), 2500);
    } catch (err) {
      setToast('Failed to save — try again');
      setTimeout(() => setToast(''), 3000);
    }
    setSaving(false);
  };

  return (
    <>
      {toast && <div className="stg-toast"><Check size={15} color="var(--stg-success)" />{toast}</div>}
      <div className="stg-card">
        <div className="stg-avatar-block">
          <div className="stg-avatar-wrap">
            <ProfileAvatar user={{ ...(cached || {}), ...(form || {}), username }} size={72} />
            <button className="stg-avatar-upload-badge" aria-label="Upload photo" onClick={() => fileRef.current?.click()} disabled={!form}>
              {uploading ? <Loader2 size={13} className="stg-spin" /> : <Camera size={13} />}
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files[0]; if (f) handleAvatarFile(f); e.target.value = ''; }} />
          </div>
          <div className="stg-avatar-help">Square images work best.</div>
        </div>
        <label className="stg-field-label">Avatar colour (fallback when no photo)</label>
        <div className="stg-swatch-row">
          {AVATAR_COLORS.map(c => (
            <button key={c} type="button" className={`stg-swatch ${form?.avatar_color === c ? 'selected' : ''}`}
              style={{ background: c }} onClick={() => setForm(prev => ({ ...prev, avatar_color: c }))} disabled={!form}>
              {form?.avatar_color === c && <Check size={12} />}
            </button>
          ))}
        </div>
      </div>

      <div className="stg-card">
        <div className="stg-field-group">
          <label className="stg-field-label">Display name</label>
          <input className="stg-input" value={form?.display_name || ''} maxLength={40} disabled={!form}
            placeholder={username} onChange={(e) => setForm(prev => ({ ...prev, display_name: e.target.value }))} />
        </div>
        <div className="stg-field-group">
          <label className="stg-field-label">Username</label>
          <div className="stg-input-wrap">
            <span className="stg-at-prefix">@</span>
            <input className="stg-input stg-input-with-prefix" value={username} disabled />
          </div>
          <div className="stg-row-sub" style={{ marginTop: '6px' }}>Username can't be changed — it's used across your messages and conversations.</div>
        </div>
        <div className="stg-field-group">
          <label className="stg-field-label">Bio</label>
          <textarea className="stg-input stg-textarea" value={form?.bio || ''} maxLength={160} disabled={!form}
            onChange={(e) => setForm(prev => ({ ...prev, bio: e.target.value }))} />
          <div className="stg-char-count">{(form?.bio || '').length}/160</div>
        </div>
        <div className="stg-field-group">
          <label className="stg-field-label">Status</label>
          <input className="stg-input" value={form?.status || ''} maxLength={60} placeholder="What's happening?" disabled={!form}
            onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value }))} />
        </div>

        <div className="stg-sticky-footer">
          <button className="stg-btn-primary" disabled={!dirty || saving} onClick={save}>
            {saving ? <Loader2 size={15} className="stg-spin" /> : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
}

// ===================== ACCOUNT =====================
function AccountSection({ username, onLogout }) {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [updatingPw, setUpdatingPw] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const checks = getPasswordChecks(newPw);
  const strength = getPasswordStrength(newPw);

  const updatePassword = async () => {
    setPwError(''); setPwSuccess('');
    if (!currentPw) { setPwError('Enter your current password'); return; }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    setUpdatingPw(true);
    try {
      await axios.put(`${API}/profile/${username}`, { current_password: currentPw, new_password: newPw });
      setPwSuccess('Password updated');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setPwError(err.response?.data?.error || 'Failed to update password');
    }
    setUpdatingPw(false);
  };

  return (
    <>
      <div className="stg-card">
        <div className="stg-card-title">Email</div>
        <div className="stg-card-sub">Not collected during signup — no verification is wired up yet.</div>
        <div className="stg-row">
          <div className="stg-row-label">{username}@ (no email on file)</div>
          <span className="stg-pill unverified">Unverified</span>
        </div>
      </div>

      <div className="stg-card">
        <div className="stg-card-title">Change password</div>
        <div className="stg-field-group">
          <label className="stg-field-label">Current password</label>
          <input className="stg-input" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
        </div>
        <div className="stg-field-group">
          <label className="stg-field-label">New password</label>
          <div className="stg-input-wrap">
            <input className="stg-input" type={showNewPw ? 'text' : 'password'} value={newPw}
              onChange={(e) => setNewPw(e.target.value)} />
            <button type="button" className="stg-input-icon-btn" aria-label={showNewPw ? 'Hide password' : 'Show password'}
              onClick={() => setShowNewPw(!showNewPw)}>
              {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {newPw && (
            <>
              <div className="stg-strength-bar-wrap">
                {[1, 2, 3, 4].map(t => <div key={t} className={`stg-strength-bar ${strength.level >= t ? `on-${t}` : ''}`} />)}
              </div>
              <div className="stg-strength-label">Password strength: {strength.label}</div>
              <div className="stg-checklist">
                <span className={`stg-check-item ${checks.length ? 'met' : ''}`}>{checks.length ? <Check size={13} /> : <Circle size={13} />} 8+ characters</span>
                <span className={`stg-check-item ${checks.uppercase ? 'met' : ''}`}>{checks.uppercase ? <Check size={13} /> : <Circle size={13} />} Uppercase</span>
                <span className={`stg-check-item ${checks.number ? 'met' : ''}`}>{checks.number ? <Check size={13} /> : <Circle size={13} />} Number</span>
                <span className={`stg-check-item ${checks.special ? 'met' : ''}`}>{checks.special ? <Check size={13} /> : <Circle size={13} />} Special character</span>
              </div>
            </>
          )}
        </div>
        <div className="stg-field-group">
          <label className="stg-field-label">Confirm new password</label>
          <input className="stg-input" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        </div>
        {pwError && <div className="stg-error-text"><AlertCircle size={13} />{pwError}</div>}
        {pwSuccess && <div className="stg-success-text"><Check size={13} />{pwSuccess}</div>}
        <div className="stg-sticky-footer">
          <button className="stg-btn-primary" disabled={updatingPw} onClick={updatePassword}>
            {updatingPw ? <Loader2 size={15} className="stg-spin" /> : 'Update password'}
          </button>
        </div>
      </div>

      <div className="stg-card">
        <div className="stg-card-title">Sessions</div>
        <div className="stg-card-sub">This device stays signed in; every other device gets signed out.</div>
        <button className="stg-btn-ghost" onClick={() => alert('Not connected — the backend has no session-tracking endpoint yet.')}>
          <LogOut size={14} style={{ marginRight: '6px' }} />Log out of all other devices
        </button>
      </div>

      <div className="stg-card" style={{ borderColor: 'rgba(239,68,68,0.35)' }}>
        <div className="stg-card-title" style={{ color: 'var(--stg-destructive)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} /> Delete account
        </div>
        <div className="stg-card-sub">This permanently deletes your account and can't be undone.</div>
        <button className="stg-btn-destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={14} /> Delete account
        </button>
      </div>

      {confirmDelete && (
        <div className="stg-confirm-overlay" onClick={(e) => e.target === e.currentTarget && setConfirmDelete(false)}>
          <div className="stg-confirm-dialog" role="alertdialog" aria-modal="true" aria-label="Delete account">
            <div className="stg-confirm-title"><AlertCircle size={18} /> Delete account</div>
            <div className="stg-confirm-body">
              Type <strong>{username}</strong> to confirm. This backend doesn't yet expose an account-deletion
              endpoint, so this dialog is wired up but won't complete the deletion until one exists.
            </div>
            <input className="stg-input" style={{ marginBottom: '16px' }} value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder={username} />
            <div className="stg-confirm-footer">
              <button className="stg-btn-ghost" onClick={() => { setConfirmDelete(false); setDeleteConfirmText(''); }}>Cancel</button>
              <button className="stg-btn-destructive" disabled={deleteConfirmText !== username}
                onClick={() => alert('No delete-account endpoint exists yet — nothing was deleted.')}>
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ===================== PREFERENCES =====================
function PreferencesSection({ prefs, updatePref }) {
  // Theme must live in React state — reading getStoredTheme() straight into the
  // control meant nothing re-rendered on click, so the sliding pill never moved
  // even though the theme itself had changed.
  const [theme, setTheme] = useState(() => getStoredTheme());

  const pickTheme = (v) => {
    setTheme(v);
    changeTheme(v);
  };

  return (
    <>
      <div className="stg-card">
        <div className="stg-card-title">Theme</div>
        <SegmentedControl ariaLabel="Theme"
          options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]}
          value={theme} onChange={pickTheme} />
      </div>

      <div className="stg-card">
        <div className="stg-card-title">Accent colour</div>
        <div className="stg-swatch-row">
          {Object.entries(ACCENTS).map(([key, a]) => (
            <button key={key} type="button" className={`stg-swatch ${prefs.accent === key ? 'selected' : ''}`}
              style={{ background: a.c1, width: '32px', height: '32px' }} title={a.label}
              onClick={() => updatePref('accent', key)}>
              {prefs.accent === key && <Check size={14} />}
            </button>
          ))}
        </div>
      </div>

      <div className="stg-card">
        <div className="stg-card-title">Font size</div>
        <SegmentedControl ariaLabel="Font size"
          options={[{ value: 'small', label: 'Small' }, { value: 'default', label: 'Default' }, { value: 'large', label: 'Large' }]}
          value={prefs.fontSize} onChange={(v) => updatePref('fontSize', v)} />
        <div className="stg-preview-line">The quick brown fox jumps over the lazy dog.</div>
      </div>

      <div className="stg-card">
        <div className="stg-card-title">Message density</div>
        <SegmentedControl ariaLabel="Message density"
          options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]}
          value={prefs.density} onChange={(v) => updatePref('density', v)} />
      </div>

      <div className="stg-card">
        <div className="stg-row">
          <div>
            <div className="stg-row-label">Send on Enter</div>
            <div className="stg-row-sub">{prefs.sendOnEnter ? 'Enter sends · Shift+Enter for a new line' : 'Enter for a new line · Ctrl/⌘+Enter sends'}</div>
          </div>
          <ToggleSwitch on={prefs.sendOnEnter} ariaLabel="Send on Enter" onClick={() => updatePref('sendOnEnter', !prefs.sendOnEnter)} />
        </div>
        <div className="stg-row">
          <div className="stg-row-label">Auto-scroll to newest</div>
          <ToggleSwitch on={prefs.autoScroll} ariaLabel="Auto-scroll to newest" onClick={() => updatePref('autoScroll', !prefs.autoScroll)} />
        </div>
      </div>

      <div className="stg-card">
        <div className="stg-card-title">Default view on open</div>
        <SegmentedControl ariaLabel="Default view on open"
          options={[{ value: 'last', label: 'Last conversation' }, { value: 'general', label: 'General channel' }]}
          value={prefs.defaultView} onChange={(v) => updatePref('defaultView', v)} />
      </div>
    </>
  );
}

// ===================== NOTIFICATIONS =====================
// Reads/writes the exact same localStorage keys Chat.js already persists to
// (notif_settings_${username}, muted_rooms_${username}) so both surfaces stay
// in sync without any prop-drilling or new state.
function NotificationsSection({ username }) {
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(`notif_settings_${username}`);
      if (raw) return JSON.parse(raw);
    } catch (err) {}
    return { desktop: true, sound: true, notifyFor: 'all', dndEnabled: false, dndStart: '22:00', dndEnd: '07:00' };
  });
  const [mutedRooms, setMutedRooms] = useState(() => {
    try {
      const raw = localStorage.getItem(`muted_rooms_${username}`);
      if (raw) return JSON.parse(raw);
    } catch (err) {}
    return {};
  });

  useEffect(() => {
    try { localStorage.setItem(`notif_settings_${username}`, JSON.stringify(settings)); } catch (err) {}
  }, [settings, username]);
  useEffect(() => {
    try { localStorage.setItem(`muted_rooms_${username}`, JSON.stringify(mutedRooms)); } catch (err) {}
  }, [mutedRooms, username]);

  const mutedKeys = Object.keys(mutedRooms).filter(k => mutedRooms[k]);
  const labelForRoomKey = (key) => {
    if (key === 'general') return '# general';
    if (key.startsWith('group:')) return `Group (${key.slice(6)})`;
    return key.split('__dm__').find(u => u !== username) || key;
  };

  return (
    <>
      <div className="stg-card">
        <div className="stg-row">
          <div className="stg-row-label">Desktop notifications</div>
          <ToggleSwitch on={settings.desktop} ariaLabel="Desktop notifications" onClick={() => setSettings(prev => ({ ...prev, desktop: !prev.desktop }))} />
        </div>
        <div className="stg-row">
          <div className="stg-row-label">Sound</div>
          <ToggleSwitch on={settings.sound} ariaLabel="Sound" onClick={() => setSettings(prev => ({ ...prev, sound: !prev.sound }))} />
        </div>
      </div>

      <div className="stg-card">
        <div className="stg-card-title">Notify me about</div>
        <SegmentedControl ariaLabel="Notify me about"
          options={[{ value: 'all', label: 'All messages' }, { value: 'mentions', label: 'Mentions only' }, { value: 'none', label: 'Nothing' }]}
          value={settings.notifyFor} onChange={(v) => setSettings(prev => ({ ...prev, notifyFor: v }))} />
      </div>

      <div className="stg-card">
        <div className="stg-row">
          <div className="stg-row-label">Do Not Disturb</div>
          <ToggleSwitch on={settings.dndEnabled} ariaLabel="Do Not Disturb" onClick={() => setSettings(prev => ({ ...prev, dndEnabled: !prev.dndEnabled }))} />
        </div>
        {settings.dndEnabled && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <div style={{ flex: 1 }}>
              <label className="stg-field-label">From</label>
              <input className="stg-input" type="time" value={settings.dndStart} onChange={(e) => setSettings(prev => ({ ...prev, dndStart: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="stg-field-label">To</label>
              <input className="stg-input" type="time" value={settings.dndEnd} onChange={(e) => setSettings(prev => ({ ...prev, dndEnd: e.target.value }))} />
            </div>
          </div>
        )}
      </div>

      <div className="stg-card">
        <div className="stg-card-title">Muted conversations</div>
        {mutedKeys.length === 0 ? (
          <div className="stg-card-sub">Nothing muted right now.</div>
        ) : (
          mutedKeys.map(key => (
            <div key={key} className="stg-mute-row">
              <VolumeX size={15} color="var(--stg-muted)" />
              <span className="stg-mute-name">{labelForRoomKey(key)}</span>
              <button className="stg-unmute-btn" onClick={() => setMutedRooms(prev => ({ ...prev, [key]: false }))}>
                <Volume2 size={12} style={{ marginRight: '4px' }} />Unmute
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}

// ===================== CHATS =====================
function ChatsSection({ prefs, updatePref }) {
  return (
    <div className="stg-card">
      <div className="stg-row">
        <div>
          <div className="stg-row-label">Enter to send</div>
          <div className="stg-row-sub">Same as the toggle in Preferences.</div>
        </div>
        <ToggleSwitch on={prefs.sendOnEnter} ariaLabel="Enter to send" onClick={() => updatePref('sendOnEnter', !prefs.sendOnEnter)} />
      </div>
      <div className="stg-row">
        <div className="stg-row-label">Link previews</div>
        <ToggleSwitch on={prefs.linkPreviews} ariaLabel="Link previews" onClick={() => updatePref('linkPreviews', !prefs.linkPreviews)} />
      </div>
      <div className="stg-row">
        <div className="stg-row-label">Read receipts</div>
        <ToggleSwitch on={prefs.readReceipts} ariaLabel="Read receipts" onClick={() => updatePref('readReceipts', !prefs.readReceipts)} />
      </div>
      <div className="stg-row">
        <div className="stg-row-label">Typing indicator</div>
        <ToggleSwitch on={prefs.typingIndicator} ariaLabel="Typing indicator" onClick={() => updatePref('typingIndicator', !prefs.typingIndicator)} />
      </div>
      <div className="stg-row">
        <div className="stg-row-label">Auto-download images</div>
        <ToggleSwitch on={prefs.imageAutoDownload} ariaLabel="Auto-download images" onClick={() => updatePref('imageAutoDownload', !prefs.imageAutoDownload)} />
      </div>
      <div className="stg-row">
        <div>
          <div className="stg-row-label">Emoji skin tone</div>
        </div>
        <select className="stg-input" style={{ width: 'auto', minWidth: '160px', flexShrink: 0 }} value={prefs.emojiSkinTone}
          onChange={(e) => updatePref('emojiSkinTone', e.target.value)}>
          <option value="default">Default 👋</option>
          <option value="light">Light 👋🏻</option>
          <option value="medium-light">Medium-light 👋🏼</option>
          <option value="medium">Medium 👋🏽</option>
          <option value="medium-dark">Medium-dark 👋🏾</option>
          <option value="dark">Dark 👋🏿</option>
        </select>
      </div>
    </div>
  );
}

// ===================== DATA =====================
function DataSection({ username }) {
  const [exporting, setExporting] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ used: 0, cap: 5 });

  useEffect(() => {
    try {
      let bytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        bytes += (key.length + (localStorage.getItem(key) || '').length) * 2;
      }
      setStorageInfo({ used: bytes / (1024 * 1024), cap: 5 });
    } catch (err) {}
  }, []);

  const exportData = async () => {
    setExporting(true);
    try {
      const [messagesRes, usersRes, groupsRes] = await Promise.allSettled([
        axios.get(`${API}/messages`),
        axios.get(`${API}/users`),
        axios.get(`${API}/groups/${username}`),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        username,
        general_messages: messagesRes.status === 'fulfilled' ? messagesRes.value.data : [],
        users: usersRes.status === 'fulfilled' ? usersRes.value.data : [],
        groups: groupsRes.status === 'fulfilled' ? groupsRes.value.data : [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nalantamil-export-${username}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {}
    setExporting(false);
  };

  const clearCache = () => {
    if (!window.confirm('Clear local cache? You will need to reload conversations from the server.')) return;
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.includes(username)) localStorage.removeItem(key);
      });
      window.location.reload();
    } catch (err) {}
  };

  return (
    <>
      <div className="stg-card">
        <div className="stg-card-title">Export my data</div>
        <div className="stg-card-sub">Downloads a JSON snapshot of the general channel, your groups, and the user directory.</div>
        <button className="stg-btn-primary" disabled={exporting} onClick={exportData}>
          {exporting ? <Loader2 size={15} className="stg-spin" /> : <Download size={14} />}
          Export my data
        </button>
      </div>

      <div className="stg-card">
        <div className="stg-card-title">Storage used</div>
        <div className="stg-storage-bar"><div className="stg-storage-fill" style={{ width: `${Math.min(100, (storageInfo.used / storageInfo.cap) * 100)}%` }} /></div>
        <div className="stg-card-sub">{storageInfo.used.toFixed(2)} MB of locally cached preferences and read-state.</div>
        <button className="stg-btn-ghost" onClick={clearCache}><X size={13} style={{ marginRight: '6px' }} />Clear local cache</button>
      </div>
    </>
  );
}