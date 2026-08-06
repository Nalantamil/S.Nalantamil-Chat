import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import {
  User, Lock, Eye, EyeOff, ArrowRight, Check, Circle, AlertCircle, Loader2, MessageCircle,
} from 'lucide-react';
import Chat from './Chat';
import Settings from './Settings';

// ===== VALIDATION SCHEMAS =====
const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(20, 'Too long'),
  password: z.string().min(1, 'Password is required').max(72, 'Too long'),
});

const signupSchema = z.object({
  username: z.string().trim()
    .min(3, '3–20 characters · letters, numbers, underscore')
    .max(20, '3–20 characters · letters, numbers, underscore')
    .regex(/^[A-Za-z0-9_]+$/, '3–20 characters · letters, numbers, underscore'),
  password: z.string().min(8, 'At least 8 characters').max(72, 'Too long'),
});

function getPasswordChecks(pwd) {
  return {
    length: pwd.length >= 8,
    uppercase: /[A-Z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd),
  };
}

function getPasswordStrength(pwd) {
  if (!pwd) return { label: '', level: 0 };
  const checks = getPasswordChecks(pwd);
  let score = Object.values(checks).filter(Boolean).length;
  if (pwd.length >= 12) score++;
  if (score <= 1) return { label: 'Weak', level: 1 };
  if (score === 2) return { label: 'Fair', level: 2 };
  if (score <= 4) return { label: 'Good', level: 3 };
  return { label: 'Strong', level: 4 };
}

function AuthScreen({ onLoggedIn }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ username: '', password: '' });
  const [touched, setTouched] = useState({ username: false, password: false });
  const [forgotMsg, setForgotMsg] = useState('');
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [errorAction, setErrorAction] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = React.useRef(null);

  useEffect(() => {
    const remembered = localStorage.getItem('rememberedUsername');
    if (remembered) {
      setUsername(remembered);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => () => clearTimeout(toastTimeoutRef.current), []);

  const showToast = (message) => {
    setToast({ message });
    clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4500);
  };

  const passwordChecks = getPasswordChecks(password);
  const passwordStrength = getPasswordStrength(password);
  const activeSchema = isLogin ? loginSchema : signupSchema;

  const validateField = (name, value) => {
    const fieldSchema = activeSchema.shape[name];
    const result = fieldSchema.safeParse(value);
    const msg = result.success ? '' : result.error.issues[0].message;
    setFieldErrors(prev => ({ ...prev, [name]: msg }));
    return msg === '';
  };

  const handleBlur = (name, value) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  const validateAll = () => {
    setTouched({ username: true, password: true });
    const result = activeSchema.safeParse({ username: username.trim().slice(0, 20), password: password.slice(0, 72) });
    if (result.success) {
      setFieldErrors({ username: '', password: '' });
      return true;
    }
    const errors = { username: '', password: '' };
    result.error.issues.forEach(issue => {
      const key = issue.path[0];
      if (!errors[key]) errors[key] = issue.message;
    });
    setFieldErrors(errors);
    return false;
  };

  const switchTab = (toLogin) => {
    setIsLogin(toLogin);
    setForgotMsg('');
    setErrorAction(null);
    setFieldErrors({ username: '', password: '' });
    setTouched({ username: false, password: false });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setForgotMsg('');
    setErrorAction(null);

    if (!validateAll()) return;

    setLoading(true);
    const url = isLogin
      ? 'https://s-nalantamil-chat.onrender.com/login'
      : 'https://s-nalantamil-chat.onrender.com/signup';
    try {
      const response = await axios.post(url, { username: username.trim(), password });
      if (isLogin) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('authUsername', username.trim());
        if (rememberMe) {
          localStorage.setItem('rememberedUsername', username.trim());
        } else {
          localStorage.removeItem('rememberedUsername');
        }
        setLoading(false);
        setLoginSuccess(true);
        setTimeout(() => onLoggedIn(username.trim()), 900);
        return;
      } else {
        showToast('Account created — please log in.');
        switchTab(true);
      }
    } catch (error) {
      const rawMsg = error.response?.data?.error || '';
      const lower = rawMsg.toLowerCase();
      if (lower.includes('password')) {
        showToast('Incorrect password. Please try again.');
        setErrorAction({ label: 'Forgot your password?', onClick: () => setForgotMsg('Password reset is coming soon — please contact support for now.') });
      } else if (lower.includes('exist')) {
        showToast('That username is already taken.');
      } else if (lower.includes('not found') || lower.includes('user')) {
        showToast("We couldn't find that account.");
        setErrorAction({ label: 'Create an account instead?', onClick: () => switchTab(false) });
      } else {
        showToast('Something went wrong. Please try again.');
      }
    }
    setLoading(false);
  };

  const usernameHasError = touched.username && fieldErrors.username;
  const passwordHasError = touched.password && fieldErrors.password;

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
          --bg: #07070b;
          --surface: #111120;
          --surface-elevated: #15152a;
          --border: rgba(255,255,255,0.08);
          --border-strong: rgba(255,255,255,0.16);
          --fg: #f1f5f9;
          --muted-fg: #8b93a7;
          --faint-fg: #4b5468;
          --primary: #7c5cff;
          --primary-2: #5b8cff;
          --primary-fg: #ffffff;
          --success: #10b981;
          --warning: #f59e0b;
          --destructive: #ef4444;
        }

        @keyframes auroraDrift {
          0%, 100% { transform: translate(-8%, -6%) scale(1); opacity: 0.55; }
          50% { transform: translate(8%, 6%) scale(1.12); opacity: 0.8; }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes checkPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }

        body { min-height: 100vh; background: var(--bg); }

        .auth-page {
          min-height: 100vh;
          font-family: 'Segoe UI', sans-serif;
          color: var(--fg);
        }
        .auth-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .brand-panel {
          display: none;
        }
        .brand-panel-inner {
          position: relative;
          z-index: 1;
          max-width: 380px;
        }
        .aurora { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        .aurora::before, .aurora::after {
          content: '';
          position: absolute;
          width: 60%; height: 60%;
          border-radius: 50%;
          filter: blur(90px);
          animation: auroraDrift 10s ease-in-out infinite;
        }
        .aurora::before { background: var(--primary); top: -10%; left: -10%; opacity: 0.35; }
        .aurora::after { background: var(--primary-2); bottom: -10%; right: -10%; opacity: 0.28; animation-delay: 2s; }
        .noise-overlay {
          position: absolute; inset: 0;
          opacity: 0.03; pointer-events: none;
          background-image: radial-gradient(circle at 1px 1px, white 1px, transparent 0);
          background-size: 3px 3px;
        }

        .brand-mark {
          width: 48px; height: 48px; border-radius: 12px;
          background: linear-gradient(135deg, var(--primary), var(--primary-2));
          display: flex; align-items: center; justify-content: center;
          color: var(--primary-fg); flex-shrink: 0;
        }
        .brand-wordmark { font-size: 26px; font-weight: 800; letter-spacing: -0.01em; color: var(--fg); margin-top: 16px; }
        .brand-tagline { font-size: 14px; color: var(--muted-fg); margin-top: 4px; letter-spacing: 0.02em; }
        .brand-bullets { list-style: none; margin-top: 32px; display: flex; flex-direction: column; gap: 14px; }
        .brand-bullets li { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--muted-fg); }
        .brand-bullet-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--primary); flex-shrink: 0; }

        .mobile-brand { text-align: center; padding: 32px 20px 8px; }
        .mobile-brand .brand-mark { margin: 0 auto; }
        .mobile-brand .brand-wordmark { font-size: 22px; }

        .form-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .auth-card {
          width: 100%;
          max-width: 420px;
          background: var(--surface-elevated);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 32px;
          box-shadow: 0 32px 64px rgba(0,0,0,0.6);
          animation: cardIn 300ms ease-out;
        }

        .tabs-pill {
          position: relative;
          display: flex;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 24px;
        }
        .tabs-indicator {
          position: absolute;
          top: 4px; left: 4px;
          width: calc(50% - 4px);
          height: calc(100% - 8px);
          border-radius: 9px;
          background: linear-gradient(135deg, var(--primary), var(--primary-2));
          transition: transform 200ms ease-out;
        }
        .tabs-indicator.signup { transform: translateX(100%); }
        .tab-btn {
          flex: 1; position: relative; z-index: 1;
          padding: 10px; text-align: center;
          border: none; background: transparent;
          font-size: 14px; font-weight: 600;
          color: var(--muted-fg); cursor: pointer;
          border-radius: 9px;
          transition: color 200ms ease;
          min-height: 40px;
        }
        .tab-btn.active { color: var(--primary-fg); }
        .tab-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

        .field-group { margin-bottom: 16px; }
        .field-label {
          display: block; font-size: 12px; font-weight: 600;
          color: var(--muted-fg); margin-bottom: 6px;
          text-transform: uppercase; letter-spacing: 0.04em;
        }
        .field-control {
          position: relative;
          display: flex; align-items: center;
          height: 48px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }
        .field-control:focus-within {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px rgba(124,92,255,0.35);
        }
        .field-control.has-error { border-color: var(--destructive); }
        .field-icon { margin-left: 14px; color: var(--muted-fg); flex-shrink: 0; transition: color 150ms ease; }
        .field-control:focus-within .field-icon { color: var(--primary); }
        .field-control.has-error .field-icon { color: var(--destructive); }
        .field-input {
          flex: 1; min-width: 0;
          height: 100%; padding: 0 14px;
          background: transparent; border: none; outline: none;
          color: var(--fg); font-size: 14px;
        }
        .field-input::placeholder { color: var(--faint-fg); }
        .field-toggle-btn {
          width: 44px; height: 44px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: none; border: none; color: var(--muted-fg); cursor: pointer;
          transition: color 150ms ease;
        }
        .field-toggle-btn:hover { color: var(--fg); }
        .field-toggle-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; border-radius: 8px; }

        .field-error {
          display: flex; align-items: center; gap: 5px;
          color: var(--destructive); font-size: 12px; margin-top: 6px;
        }
        .field-hint { color: var(--faint-fg); font-size: 12px; margin-top: 6px; }

        .extras-zone { position: relative; min-height: 46px; margin-bottom: 4px; }
        .extras-pane {
          position: absolute; inset: 0;
          opacity: 0; pointer-events: none;
          transition: opacity 150ms ease;
        }
        .extras-pane.visible { opacity: 1; pointer-events: auto; position: static; }

        .form-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .remember-me { display: flex; align-items: center; gap: 7px; color: var(--muted-fg); font-size: 13px; cursor: pointer; user-select: none; }
        .remember-me input { accent-color: var(--primary); width: 15px; height: 15px; cursor: pointer; }
        .forgot-link { color: var(--primary); font-size: 13px; font-weight: 600; cursor: pointer; background: none; border: none; }
        .forgot-link:hover { color: var(--primary-2); }
        .forgot-link:focus-visible, .footer-link:focus-visible, .error-action-link:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: 4px; }

        .signup-extras { min-height: 132px; }
        .strength-zone { margin-bottom: 10px; }
        .strength-bar-wrap { display: flex; gap: 4px; margin-bottom: 6px; }
        .strength-bar { flex: 1; height: 4px; border-radius: 2px; background: var(--border); }
        .strength-bar.on-1 { background: rgba(124,92,255,0.35); }
        .strength-bar.on-2 { background: rgba(124,92,255,0.55); }
        .strength-bar.on-3 { background: rgba(124,92,255,0.78); }
        .strength-bar.on-4 { background: var(--primary); }
        .strength-label { font-size: 11px; font-weight: 600; color: var(--muted-fg); }

        .password-checklist { display: grid; grid-template-columns: 1fr; gap: 6px 14px; margin-top: 4px; }
        @media (min-width: 380px) {
          .password-checklist { grid-template-columns: 1fr 1fr; }
        }
        .check-item { font-size: 12px; display: flex; align-items: center; gap: 6px; color: var(--faint-fg); }
        .check-item.met { color: var(--success); }

        .btn-primary {
          width: 100%; height: 48px;
          background: linear-gradient(135deg, var(--primary), var(--primary-2));
          color: var(--primary-fg); border: none; border-radius: 12px;
          font-size: 15px; font-weight: 700; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          margin-top: 8px;
          transition: filter 150ms ease, transform 100ms ease, box-shadow 150ms ease;
        }
        .btn-primary:hover:not(:disabled) { filter: brightness(1.08); box-shadow: 0 8px 24px rgba(124,92,255,0.35); }
        .btn-primary:active:not(:disabled) { transform: scale(0.98); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-primary:focus-visible { outline: 2px solid white; outline-offset: 2px; }
        .spin-icon { animation: spin 0.9s linear infinite; }

        .forgot-msg {
          text-align: center; margin-top: 14px; padding: 8px 14px; border-radius: 10px;
          font-size: 12px; background: rgba(124,92,255,0.12); border: 1px solid rgba(124,92,255,0.25); color: var(--muted-fg);
        }
        .error-action-link {
          display: block; width: 100%; text-align: center; margin-top: 10px;
          color: var(--primary); font-size: 13px; font-weight: 600; cursor: pointer; background: none; border: none;
        }
        .error-action-link:hover { color: var(--primary-2); }

        .divider { display: flex; align-items: center; margin: 20px 0; gap: 12px; }
        .divider-line { flex: 1; height: 1px; background: var(--border); }
        .divider-text { color: var(--faint-fg); font-size: 12px; }
        .footer-text { text-align: center; color: var(--muted-fg); font-size: 13px; }
        .footer-link { color: var(--primary); cursor: pointer; font-weight: 600; background: none; border: none; font-size: 13px; }
        .footer-link:hover { color: var(--primary-2); }

        .success-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 40px 20px; }
        .success-check {
          width: 64px; height: 64px; border-radius: 50%;
          background: rgba(16,185,129,0.15); border: 2px solid var(--success);
          display: flex; align-items: center; justify-content: center; color: var(--success);
          animation: checkPop 0.4s ease;
        }
        .success-title { font-size: 18px; font-weight: 700; color: var(--fg); }
        .success-sub { font-size: 13px; color: var(--muted-fg); display: flex; align-items: center; gap: 8px; }

        .toast {
          position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
          z-index: 9999;
          background: var(--surface-elevated); border: 1px solid var(--border-strong);
          border-radius: 12px; padding: 12px 18px;
          display: flex; align-items: center; gap: 10px;
          color: var(--fg); font-size: 13px; font-weight: 500;
          box-shadow: 0 12px 32px rgba(0,0,0,0.5);
          animation: toastIn 200ms ease-out;
          max-width: calc(100vw - 32px);
        }
        .toast-icon { color: var(--destructive); flex-shrink: 0; }

        @media (min-width: 1024px) {
          .auth-shell { flex-direction: row; }
          .brand-panel {
            display: flex; align-items: center;
            width: 45%; max-width: 640px;
            position: relative; overflow: hidden;
            padding: 64px;
            background: var(--surface);
            border-right: 1px solid var(--border);
          }
          .mobile-brand { display: none; }
          .form-panel { flex: 1; padding: 40px; }
        }

        @media (max-width: 479px) {
          .auth-card { padding: 24px; border-radius: 16px; }
          .form-panel { padding: 12px 20px 32px; align-items: flex-start; }
          .form-row { flex-direction: column; align-items: flex-start; gap: 10px; }
        }
      `}</style>

      <div className="auth-page">
        {toast && (
          <div className="toast" role="alert">
            <AlertCircle size={16} className="toast-icon" />
            <span>{toast.message}</span>
          </div>
        )}

        <div className="auth-shell">
          <div className="brand-panel">
            <div className="aurora"></div>
            <div className="noise-overlay"></div>
            <div className="brand-panel-inner">
              <div className="brand-mark"><MessageCircle size={24} /></div>
              <div className="brand-wordmark">Nalantamil</div>
              <div className="brand-tagline">Chat · Connect · Celebrate</div>
              <ul className="brand-bullets">
                <li><span className="brand-bullet-dot"></span> Real-time messaging, channels &amp; DMs</li>
                <li><span className="brand-bullet-dot"></span> Password-lockable private chats</li>
                <li><span className="brand-bullet-dot"></span> Built for small teams and friends</li>
              </ul>
            </div>
          </div>

          <div className="form-panel">
            <div style={{ width: '100%', maxWidth: 420 }}>
              <div className="mobile-brand">
                <div className="brand-mark"><MessageCircle size={22} /></div>
                <div className="brand-wordmark">Nalantamil</div>
                <div className="brand-tagline">Chat · Connect · Celebrate</div>
              </div>

              <div className="auth-card">
                {loginSuccess ? (
                  <div className="success-screen">
                    <div className="success-check"><Check size={28} /></div>
                    <div className="success-title">Login Successful</div>
                    <div className="success-sub"><Loader2 size={16} className="spin-icon" /> Redirecting...</div>
                  </div>
                ) : (
                  <>
                    <div className="tabs-pill">
                      <div className={`tabs-indicator ${!isLogin ? 'signup' : ''}`}></div>
                      <button type="button" className={`tab-btn ${isLogin ? 'active' : ''}`} onClick={() => switchTab(true)}>Login</button>
                      <button type="button" className={`tab-btn ${!isLogin ? 'active' : ''}`} onClick={() => switchTab(false)}>Signup</button>
                    </div>

                    <form onSubmit={handleSubmit} noValidate>
                      <div className="field-group">
                        <label htmlFor="username" className="field-label">Username</label>
                        <div className={`field-control ${usernameHasError ? 'has-error' : ''}`}>
                          <User size={20} className="field-icon" />
                          <input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            maxLength={20}
                            placeholder="yourname"
                            value={username}
                            onChange={(e) => { setUsername(e.target.value); if (touched.username) validateField('username', e.target.value); }}
                            onBlur={(e) => handleBlur('username', e.target.value)}
                            className="field-input"
                          />
                        </div>
                        {usernameHasError ? (
                          <div className="field-error"><AlertCircle size={13} /> {fieldErrors.username}</div>
                        ) : !isLogin ? (
                          <div className="field-hint">3–20 characters · letters, numbers, underscore</div>
                        ) : null}
                      </div>

                      <div className="field-group">
                        <label htmlFor="password" className="field-label">Password</label>
                        <div className={`field-control ${passwordHasError ? 'has-error' : ''}`}>
                          <Lock size={20} className="field-icon" />
                          <input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete={isLogin ? 'current-password' : 'new-password'}
                            maxLength={72}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); if (touched.password) validateField('password', e.target.value); }}
                            onBlur={(e) => handleBlur('password', e.target.value)}
                            className="field-input"
                          />
                          <button
                            type="button"
                            className="field-toggle-btn"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {passwordHasError && <div className="field-error"><AlertCircle size={13} /> {fieldErrors.password}</div>}
                      </div>

                      <div className="extras-zone" aria-live="polite">
                        {isLogin ? (
                          <div className={`extras-pane ${isLogin ? 'visible' : ''}`}>
                            <div className="form-row">
                              <label className="remember-me">
                                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                                Remember me
                              </label>
                              <button type="button" className="forgot-link" onClick={() => setForgotMsg('Password reset is coming soon — please contact support for now.')}>Forgot password?</button>
                            </div>
                          </div>
                        ) : (
                          <div className={`extras-pane signup-extras ${!isLogin ? 'visible' : ''}`}>
                            {password && (
                              <div className="strength-zone">
                                <div className="strength-bar-wrap">
                                  {[1, 2, 3, 4].map(tier => (
                                    <div key={tier} className={`strength-bar ${passwordStrength.level >= tier ? `on-${tier}` : ''}`}></div>
                                  ))}
                                </div>
                                <div className="strength-label">Password strength: {passwordStrength.label}</div>
                              </div>
                            )}
                            <div className="password-checklist">
                              <span className={`check-item ${passwordChecks.length ? 'met' : ''}`}>
                                {passwordChecks.length ? <Check size={14} /> : <Circle size={14} />} 8+ characters
                              </span>
                              <span className={`check-item ${passwordChecks.uppercase ? 'met' : ''}`}>
                                {passwordChecks.uppercase ? <Check size={14} /> : <Circle size={14} />} Uppercase
                              </span>
                              <span className={`check-item ${passwordChecks.number ? 'met' : ''}`}>
                                {passwordChecks.number ? <Check size={14} /> : <Circle size={14} />} Number
                              </span>
                              <span className={`check-item ${passwordChecks.special ? 'met' : ''}`}>
                                {passwordChecks.special ? <Check size={14} /> : <Circle size={14} />} Special character
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? (
                          <Loader2 size={18} className="spin-icon" />
                        ) : isLogin ? (
                          <>Log in <ArrowRight size={16} /></>
                        ) : (
                          <>Create account</>
                        )}
                      </button>
                    </form>

                    {forgotMsg && <div className="forgot-msg">{forgotMsg}</div>}
                    {errorAction && <button className="error-action-link" onClick={errorAction.onClick}>{errorAction.label}</button>}

                    <div className="divider"><div className="divider-line"></div><span className="divider-text">or</span><div className="divider-line"></div></div>
                    <p className="footer-text">
                      {isLogin ? 'New here? ' : 'Already have an account? '}
                      <button type="button" className="footer-link" onClick={() => switchTab(!isLogin)}>
                        {isLogin ? 'Create an account' : 'Log in'}
                      </button>
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ChatRoute({ loggedInUser, onLogout }) {
  const navigate = useNavigate();
  if (!loggedInUser) return <Navigate to="/" replace />;
  return <Chat username={loggedInUser} onLogout={onLogout} onOpenSettings={() => navigate('/settings')} />;
}

function SettingsRoute({ loggedInUser, onLogout }) {
  if (!loggedInUser) return <Navigate to="/" replace />;
  return <Settings username={loggedInUser} onLogout={onLogout} />;
}

function AppRoutes() {
  const [loggedInUser, setLoggedInUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('authUsername');
    if (token && savedUser) setLoggedInUser(savedUser);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authUsername');
    setLoggedInUser(null);
  };

  return (
    <Routes>
      <Route path="/settings/:section" element={<SettingsRoute loggedInUser={loggedInUser} onLogout={handleLogout} />} />
      <Route path="/settings" element={<SettingsRoute loggedInUser={loggedInUser} onLogout={handleLogout} />} />
      <Route path="/" element={
        loggedInUser
          ? <ChatRoute loggedInUser={loggedInUser} onLogout={handleLogout} />
          : <AuthScreen onLoggedIn={setLoggedInUser} />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;