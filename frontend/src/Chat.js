import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const socket = io('https://s-nalantamil-chat.onrender.com', {
  transports: ['websocket'],
  upgrade: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
});

const BACKGROUNDS = [
  { id: 'default', label: '🌌 Default', value: 'linear-gradient(-45deg, #0f0c29, #302b63, #24243e, #1a1a2e)' },
  { id: 'ocean', label: '🌊 Ocean', value: 'linear-gradient(-45deg, #0f2027, #203a43, #2c5364)' },
  { id: 'forest', label: '🌿 Forest', value: 'linear-gradient(-45deg, #0a1628, #0d2137, #0f3460)' },
  { id: 'sunset', label: '🌅 Sunset', value: 'linear-gradient(-45deg, #1a0533, #4a0e8f, #8b1a6b)' },
  { id: 'dark', label: '⬛ Pure Dark', value: 'linear-gradient(-45deg, #0a0a0a, #111111, #0d0d0d)' },
  { id: 'midnight', label: '🌙 Midnight', value: 'linear-gradient(-45deg, #000428, #004e92)' },
];

const EMOJI_LIST = [
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊',
  '😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋',
  '😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐',
  '😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔',
  '😪','🤤','😴','😷','🤒','🤕','🤢','🤧','🥵','🥶',
  '😱','😨','😰','😥','😓','🤯','😤','😡','🤬','😈',
  '💀','💩','🤡','👻','👽','🤖','😺','😸','😹','😻',
  '👍','👎','👏','🙌','🤝','🤜','👊','✊','🤛','💪',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
  '🔥','⭐','✨','💫','🎉','🎊','🎈','🎁','🏆','🎯',
];

const AVATAR_COLORS = ['#667eea','#e74c3c','#2ecc71','#f39c12','#e91e63','#00bcd4','#9c27b0','#ff5722'];

const getDMRoomId = (user1, user2) => [user1, user2].sort().join('__dm__');

// ===== ICONS — inline SVGs matching Lucide's paths/stroke-width (no new npm
// dependency required). Consistent 1.8 stroke-width, size via prop. =====
const Icon = ({ path, size = 18, className = '', style = {}, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    className={className} style={{ flexShrink: 0, ...style }}>
    {children}
  </svg>
);
const SearchIcon = (p) => <Icon {...p}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Icon>;
const PaletteIcon = (p) => <Icon {...p}><circle cx="13.5" cy="6.5" r=".5" /><circle cx="17.5" cy="10.5" r=".5" /><circle cx="8.5" cy="7.5" r=".5" /><circle cx="6.5" cy="12.5" r=".5" /><path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A4.2 4.2 0 0 0 22 11c0-5-4.5-9-10-9Z" /></Icon>;
const PinIcon = (p) => <Icon {...p}><path d="M12 17v5" /><path d="M9 10.8V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6.8a2 2 0 0 0 .4 1.2l1.2 1.6a1 1 0 0 1-.8 1.6H6.2a1 1 0 0 1-.8-1.6l1.2-1.6a2 2 0 0 0 .4-1.2Z" /></Icon>;
const SmileIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></Icon>;
const CameraIcon = (p) => <Icon {...p}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" /><circle cx="12" cy="13" r="3" /></Icon>;
const SaveIcon = (p) => <Icon {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" /></Icon>;
const SendIcon = (p) => <Icon {...p}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></Icon>;
const SettingsIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Icon>;
const LogOutIcon = (p) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></Icon>;
const LockIcon = (p) => <Icon {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Icon>;
const LockOpenIcon = (p) => <Icon {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></Icon>;
const GlobeIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" /></Icon>;
const HashIcon = (p) => <Icon {...p}><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></Icon>;
const BellIcon = (p) => <Icon {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></Icon>;
const BellOffIcon = (p) => <Icon {...p}><path d="M8.7 3a6 6 0 0 1 9.3 5c0 3.8.9 6.1 1.7 7.4" /><path d="M17.6 17H3s3-2 3-9c0-.5 0-1 .1-1.5" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /><line x1="1" y1="1" x2="23" y2="23" /></Icon>;
const XIcon = (p) => <Icon {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Icon>;
const ChevronLeftIcon = (p) => <Icon {...p}><path d="m15 18-6-6 6-6" /></Icon>;
const Volume2Icon = (p) => <Icon {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></Icon>;
const VolumeXIcon = (p) => <Icon {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></Icon>;
const MoreVerticalIcon = (p) => <Icon {...p}><circle cx="12" cy="5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="19" r="1.2" /></Icon>;
const ChevronDownIcon = (p) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>;
const MessageCircleIcon = (p) => <Icon {...p}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></Icon>;
const Loader2Icon = (p) => <Icon {...p}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></Icon>;
const UserPlusIcon = (p) => <Icon {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></Icon>;
const AtSignIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-5.5 8.3" /></Icon>;

function Chat({ username, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);

  // ===== APP LOADING SCREEN — covers the whole app until the essential startup
  // data (messages, users, profile) actually arrives. On a Render free-tier
  // backend the first request after a while can take a long time to wake the
  // server up; this keeps the user informed instead of showing a blank/broken
  // screen they might click around on. It waits exactly as long as it needs to,
  // no fixed timer — fast connections clear it almost instantly. =====
  const [appLoading, setAppLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Connecting to Nalantamil...');

  // ===== DRAWER STATE — only meaningful on narrow/mobile screens (see isMobile below).
  // On wide screens the list is just always visible, this is ignored. =====
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [showBgPicker, setShowBgPicker] = useState(false);
  const [selectedBg, setSelectedBg] = useState(BACKGROUNDS[0]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isTabFocused, setIsTabFocused] = useState(true);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState({ bio: '', avatar_color: '#667eea', avatar_url: '' });
  const [profileEdit, setProfileEdit] = useState({ bio: '', avatar_color: '#667eea', avatar_url: '', current_password: '', new_password: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showConnected, setShowConnected] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

  // ===== LIGHTBOX — full-screen image viewer state (UI-only, presentational) =====
  const [lightboxImage, setLightboxImage] = useState(null);

  // ===== SEND BUTTON PULSE — brief icon flash on send (UI-only, presentational) =====
  const [sendPulse, setSendPulse] = useState(false);

  // ===== NARROW/MOBILE DETECTION — the single switch between "list always visible"
  // (wide browser) and "list is a drawer you open by click/drag" (narrow browser or
  // phone). Stays in sync as the window is resized/minimized. =====
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));

  // ===== NAVIGATION STATE =====
  const [activeRoom, setActiveRoom] = useState(null); // null | 'general' | 'dm'
  const [activeDMUser, setActiveDMUser] = useState(null);

  const [dmMessages, setDmMessages] = useState({});
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockPassword, setLockPassword] = useState('');
  const [lockVerifyPassword, setLockVerifyPassword] = useState('');
  const [chatLocks, setChatLocks] = useState({});
  const [lockedRooms, setLockedRooms] = useState({});
  const [unreadDMs, setUnreadDMs] = useState({});

  // ===== DM SORT TRACKING =====
  const [dmLastMessage, setDmLastMessage] = useState({});

  // ===== SIDEBAR SEARCH (filters the Direct Messages list only — visual/UI addition,
  // does not touch channel logic, sockets, or data fetching) =====
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');

  // ===== AVATAR CROP MODAL STATE — intercepts the avatar file input before any
  // upload happens. The user crops/repositions/zooms, then "Apply Photo" renders
  // a circular base64 JPEG preview only; the actual Cloudinary upload is deferred
  // until "Save Changes" is clicked (see saveProfile). =====
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [cropNaturalSize, setCropNaturalSize] = useState({ width: 0, height: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [cropDragging, setCropDragging] = useState(false);
  const [pendingAvatarBase64, setPendingAvatarBase64] = useState(null);

  const CROP_VIEWPORT = 200;
  const CROP_OUTPUT = 320;
  const CROP_ZOOM_MIN = 1;
  const CROP_ZOOM_MAX = 4;

  const cropPointersRef = useRef(new Map());
  const cropPinchStartRef = useRef({ distance: 0, zoom: 1 });
  const cropDragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // ===== TABLET ICON-RAIL BREAKPOINT (768–1023px) — sits between the always-
  // visible desktop sidebar and the mobile off-canvas drawer. =====
  const [isTablet, setIsTablet] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 768 && window.innerWidth < 1024 : false));

  // ===== NOTIFICATION PREFERENCES — persisted to localStorage per user since
  // the backend has no settings endpoint. =====
  const [notifSettings, setNotifSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(`notif_settings_${username}`);
      if (raw) return JSON.parse(raw);
    } catch (err) {}
    return { desktop: true, sound: true, notifyFor: 'all', dndEnabled: false, dndStart: '22:00', dndEnd: '07:00' };
  });
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // ===== PER-CONVERSATION MUTE =====
  const [mutedRooms, setMutedRooms] = useState(() => {
    try {
      const raw = localStorage.getItem(`muted_rooms_${username}`);
      if (raw) return JSON.parse(raw);
    } catch (err) {}
    return {};
  });
  const [showConvoMenu, setShowConvoMenu] = useState(false);

  // ===== READ-STATE TRACKING (for the "N new messages" divider + jump pill) =====
  const [scrolledUp, setScrolledUp] = useState(false);
  const [newSinceScroll, setNewSinceScroll] = useState(0);
  const [unreadBoundaryCount, setUnreadBoundaryCount] = useState({});

  // ===== TOASTS (inactive-conversation message previews) =====
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  // ===== NOTIFICATION CENTER (replies to you + mentions, derived client-side) =====
  const [notifCenterItems, setNotifCenterItems] = useState([]);
  const [showNotifCenter, setShowNotifCenter] = useState(false);
  const notifPanelRef = useRef(null);
  const notifBellBtnRef = useRef(null);

  // ===== BROWSER NOTIFICATION PERMISSION BANNER =====
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const permissionAskedRef = useRef(false);
  const notifTagCountRef = useRef({});

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const sidebarRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const dragState = useRef({ startX: 0, startY: 0, currentX: 0, dragging: false, horizontal: false });

  const REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];

  const currentRoomId = activeRoom === 'general'
    ? 'general'
    : (activeRoom === 'dm' && activeDMUser ? getDMRoomId(username, activeDMUser) : null);

  const currentMessages = useMemo(() => {
    if (activeRoom === 'general') return messages;
    if (activeRoom === 'dm') return dmMessages[currentRoomId] || [];
    return [];
  }, [activeRoom, messages, dmMessages, currentRoomId]);

  // ===== SORTED DM USERS (WhatsApp-style, most recent first) =====
  const sortedUsers = [...allUsers].sort((a, b) => {
    const roomA = getDMRoomId(username, a.username);
    const roomB = getDMRoomId(username, b.username);
    const timeA = dmLastMessage[roomA] || 0;
    const timeB = dmLastMessage[roomB] || 0;
    return timeB - timeA;
  });

  // ===== SIDEBAR SEARCH FILTER — purely a display filter over sortedUsers, doesn't
  // touch allUsers/openDM/sockets. Empty query shows everyone (existing behavior). =====
  const displayedSidebarUsers = sidebarSearchQuery.trim()
    ? sortedUsers.filter(u => u.username.toLowerCase().includes(sidebarSearchQuery.trim().toLowerCase()))
    : sortedUsers;

  useEffect(() => {
    const onFocus = () => { setIsTabFocused(true); };
    const onBlur = () => setIsTabFocused(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('blur', onBlur); };
  }, []);

  // ===== KEEP isMobile / isTablet IN SYNC WITH ACTUAL VIEWPORT (resize / rotate / browser minimize) =====
  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const wakeUp = async () => {
      try { await axios.get('https://s-nalantamil-chat.onrender.com/'); } catch (err) {}
    };
    wakeUp();
    const interval = setInterval(wakeUp, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ===== LOADING SCREEN MESSAGE — changes over time so a slow (cold-start) backend
  // doesn't just look frozen. Only runs while appLoading is true. =====
  useEffect(() => {
    if (!appLoading) return;
    const t1 = setTimeout(() => setLoadingMessage('Waking up the server — this can take a moment on the first visit...'), 4000);
    const t2 = setTimeout(() => setLoadingMessage('Still connecting... almost there, thanks for your patience!'), 15000);
    const t3 = setTimeout(() => setLoadingMessage("This is taking longer than usual, but we're still trying..."), 40000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [appLoading]);

  // ===== RESTORE LAST OPEN CHAT AFTER A REFRESH =====
  useEffect(() => {
    const savedRoom = localStorage.getItem(`chat_activeRoom_${username}`);
    const savedDMUser = localStorage.getItem(`chat_activeDMUser_${username}`);
    if (savedRoom === 'general') {
      setActiveRoom('general');
    } else if (savedRoom === 'dm' && savedDMUser) {
      openDM(savedDMUser);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== PERSIST WHICHEVER CHAT IS OPEN, SO A REFRESH RESTORES IT =====
  useEffect(() => {
    if (activeRoom) {
      localStorage.setItem(`chat_activeRoom_${username}`, activeRoom);
      if (activeRoom === 'dm' && activeDMUser) {
        localStorage.setItem(`chat_activeDMUser_${username}`, activeDMUser);
      } else {
        localStorage.removeItem(`chat_activeDMUser_${username}`);
      }
    } else {
      localStorage.removeItem(`chat_activeRoom_${username}`);
      localStorage.removeItem(`chat_activeDMUser_${username}`);
    }
  }, [activeRoom, activeDMUser, username]);

  // ===== ON NARROW/MOBILE SCREENS, CLOSE THE DRAWER WHENEVER YOU LAND ON/SWITCH A CHAT
  // (irrelevant on wide screens, where the list is always visible regardless) =====
  useEffect(() => {
    if (activeRoom && isMobile) {
      setSidebarOpen(false);
    }
  }, [activeRoom, activeDMUser, isMobile]);

  const getDateLabel = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp + 'Z');
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const shouldShowDateSeparator = (msgs, index) => {
    if (index === 0) return true;
    const prev = msgs[index - 1];
    const curr = msgs[index];
    if (!prev.timestamp || !curr.timestamp) return false;
    return new Date(prev.timestamp + 'Z').toDateString() !== new Date(curr.timestamp + 'Z').toDateString();
  };

  // ===== MESSAGE GROUPING (Discord/Slack-style) — purely presentational: decides
  // whether consecutive messages from the same sender within 3 minutes should be
  // visually grouped (name shown once, avatar shown once at the bottom of the run).
  // Does not touch message data, socket events, or state management. =====
  const GROUP_WINDOW_MS = 5 * 60 * 1000;
  const isGroupedWithPrev = (msgs, index) => {
    if (index <= 0) return false;
    const prev = msgs[index - 1];
    const curr = msgs[index];
    if (!prev || prev.type === 'system' || curr.type === 'system') return false;
    if (prev.username !== curr.username) return false;
    if (!prev.timestamp || !curr.timestamp) return false;
    if (shouldShowDateSeparator(msgs, index)) return false;
    const diff = new Date(curr.timestamp + 'Z').getTime() - new Date(prev.timestamp + 'Z').getTime();
    return diff >= 0 && diff <= GROUP_WINDOW_MS;
  };
  const isGroupedWithNext = (msgs, index) => {
    if (index >= msgs.length - 1) return false;
    return isGroupedWithPrev(msgs, index + 1);
  };

  const fetchDMMessages = async (roomId) => {
    try {
      const res = await axios.get(`https://s-nalantamil-chat.onrender.com/dm/${roomId}`);
      setDmMessages(prev => ({ ...prev, [roomId]: res.data }));
      if (res.data.length > 0) {
        const lastMsg = res.data[res.data.length - 1];
        const ts = lastMsg.timestamp ? new Date(lastMsg.timestamp + 'Z').getTime() : 0;
        setDmLastMessage(prev => ({ ...prev, [roomId]: ts }));
      }
    } catch (err) {}
  };

  const checkChatLock = async (roomId) => {
    try {
      const res = await axios.get(`https://s-nalantamil-chat.onrender.com/chatlock/${roomId}`);
      setChatLocks(prev => ({ ...prev, [roomId]: res.data }));
      return res.data;
    } catch (err) { return { locked: false }; }
  };

  const openDM = async (targetUser) => {
    const roomId = getDMRoomId(username, targetUser);
    const lock = await checkChatLock(roomId);
    if (lock.locked && !lockedRooms[roomId]) {
      setActiveDMUser(targetUser);
      setActiveRoom('dm');
      setShowLockModal('verify');
      return;
    }
    setActiveDMUser(targetUser);
    setActiveRoom('dm');
    await fetchDMMessages(roomId);
    setUnreadBoundaryCount(prev => ({ ...prev, [roomId]: unreadDMs[roomId] || 0 }));
    setUnreadDMs(prev => ({ ...prev, [roomId]: 0 }));
  };

  // ===== BACK TO LIST =====
  const backToList = () => {
    setActiveRoom(null);
    setActiveDMUser(null);
  };

  // ===== PREFETCH EVERY DM'S HISTORY RIGHT AFTER LOGIN =====
  // Stores both the timestamp (for sorting) and the actual messages (for the
  // "last message" preview under each name), so previews are correct immediately.
  useEffect(() => {
    if (allUsers.length === 0) return;
    allUsers.forEach(async (user) => {
      const roomId = getDMRoomId(username, user.username);
      try {
        const res = await axios.get(`https://s-nalantamil-chat.onrender.com/dm/${roomId}`);
        if (res.data.length > 0) {
          const lastMsg = res.data[res.data.length - 1];
          const ts = lastMsg.timestamp ? new Date(lastMsg.timestamp + 'Z').getTime() : 0;
          setDmLastMessage(prev => ({ ...prev, [roomId]: ts }));
          setDmMessages(prev => ({ ...prev, [roomId]: res.data }));
        }
      } catch (err) {}
    });
  }, [allUsers, username]);

  // ===== MAIN STARTUP LOAD + SOCKET WIRING =====
  useEffect(() => {
    let cancelled = false;

    // Wait for the essential startup data together, however long it takes
    // (fast on a warm server, slow on a cold Render free-tier one), then
    // clear the loading screen. This never times out on its own — it only
    // ever finishes when the requests actually settle, success or failure.
    const loadInitialData = async () => {
      const results = await Promise.allSettled([
        axios.get('https://s-nalantamil-chat.onrender.com/messages'),
        axios.get('https://s-nalantamil-chat.onrender.com/users'),
        axios.get(`https://s-nalantamil-chat.onrender.com/profile/${username}`),
      ]);
      if (cancelled) return;

      const [messagesResult, usersResult, profileResult] = results;
      if (messagesResult.status === 'fulfilled') setMessages(messagesResult.value.data);
      if (usersResult.status === 'fulfilled') setAllUsers(usersResult.value.data.filter(u => u.username !== username));
      if (profileResult.status === 'fulfilled') {
        const data = profileResult.value.data;
        setProfile(data);
        setProfileEdit({ bio: data.bio || '', avatar_color: data.avatar_color || '#667eea', avatar_url: data.avatar_url || '', current_password: '', new_password: '' });
      }
      setAppLoading(false);
    };
    loadInitialData();

    axios.get('https://s-nalantamil-chat.onrender.com/pinned').then(res => setPinnedMessages(res.data)).catch(() => {});

    socket.emit('join', { username });

    socket.on('connect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      setShowConnected(true);
      setTimeout(() => setShowConnected(false), 3000);
      socket.emit('join', { username });
    });

    socket.on('disconnect', () => { setIsConnected(false); setIsReconnecting(true); });
    socket.on('reconnect_attempt', () => setIsReconnecting(true));
    socket.on('reconnect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      setShowConnected(true);
      setTimeout(() => setShowConnected(false), 3000);
      socket.emit('join', { username });
    });

    socket.on('message', (msg) => {
      setMessages(prev => [...prev, { ...msg, reactions: {} }]);

      // System messages (joins/leaves) surface only in the notification center,
      // deduped so a reconnect storm doesn't spam 4 identical entries.
      if (msg.type === 'system') {
        const actorMatch = msg.text?.match(/^(.+?) (joined|left)/i);
        const actor = actorMatch ? actorMatch[1] : (msg.username || 'Someone');
        const verb = actorMatch ? actorMatch[2].toLowerCase() : 'joined';
        pushNotifCenterItem({ type: 'join', sender: actor, action: `${verb} the chat`, roomKey: 'general', target: () => { setActiveRoom('general'); setActiveDMUser(null); } });
        return;
      }

      if (msg.username !== username) {
        const isActive = activeRoom === 'general' && isTabFocused && document.visibilityState === 'visible';
        if (!isActive) setUnreadCount(prev => prev + 1);
        if (!isActive && shouldNotifyFor('general', msg)) {
          const preview = msg.text?.startsWith('__IMAGE__') ? '🖼️ Photo' : msg.text?.startsWith('__FILE__') ? '📎 File' : msg.text;
          const isMention = msg.text?.includes('@' + username) || msg.reply_to?.username === username;
          const target = () => { setActiveRoom('general'); setActiveDMUser(null); };
          pushToast({ sender: msg.username, preview, roomKey: 'general', target });
          pushNotifCenterItem({ type: isMention ? 'mention' : 'message', sender: msg.username, action: isMention ? 'mentioned you' : 'sent a message', preview, roomKey: 'general', target });
          if (notifSettingsRef.current.sound) playNotifSound();
          fireBrowserNotification('general', msg.username, preview, target);
        }
      }
    });

    socket.on('dm_message', (msg) => {
      const roomId = msg.room_id;
      setDmMessages(prev => ({
        ...prev,
        [roomId]: [...(prev[roomId] || []), { ...msg, reactions: {} }]
      }));
      const ts = msg.timestamp ? new Date(msg.timestamp + 'Z').getTime() : Date.now();
      setDmLastMessage(prev => ({ ...prev, [roomId]: ts }));
      if (roomId !== currentRoomId || activeRoom !== 'dm') {
        if (msg.username !== username) {
          setUnreadDMs(prev => ({ ...prev, [roomId]: (prev[roomId] || 0) + 1 }));
          if (shouldNotifyFor(roomId, msg)) {
            const preview = msg.text?.startsWith('__IMAGE__') ? '🖼️ Photo' : msg.text?.startsWith('__FILE__') ? '📎 File' : msg.text;
            const target = () => openDM(msg.username);
            pushToast({ sender: msg.username, preview, roomKey: roomId, target });
            pushNotifCenterItem({ type: 'message', sender: msg.username, action: 'sent you a message', preview, roomKey: roomId, target });
            if (notifSettingsRef.current.sound) playNotifSound();
            fireBrowserNotification(roomId, msg.username, preview, target);
          }
        }
      }
    });

    socket.on('message_deleted', ({ message_id }) => {
      setMessages(prev => prev.filter(m => m._id !== message_id));
      setDmMessages(prev => {
        const updated = {};
        Object.keys(prev).forEach(r => { updated[r] = prev[r].filter(m => m._id !== message_id); });
        return updated;
      });
    });

    socket.on('message_edited', ({ message_id, text }) => {
      setMessages(prev => prev.map(m => m._id === message_id ? { ...m, text, edited: true } : m));
      setDmMessages(prev => {
        const updated = {};
        Object.keys(prev).forEach(r => { updated[r] = prev[r].map(m => m._id === message_id ? { ...m, text, edited: true } : m); });
        return updated;
      });
    });

    socket.on('reaction_updated', ({ message_id, reactions }) => {
      setMessages(prev => prev.map(m => m._id === message_id ? { ...m, reactions } : m));
      setDmMessages(prev => {
        const updated = {};
        Object.keys(prev).forEach(r => { updated[r] = prev[r].map(m => m._id === message_id ? { ...m, reactions } : m); });
        return updated;
      });
    });

    socket.on('user_typing', ({ username: u }) => setTypingUsers(prev => prev.includes(u) ? prev : [...prev, u]));
    socket.on('user_stop_typing', ({ username: u }) => setTypingUsers(prev => prev.filter(x => x !== u)));
    socket.on('message_pinned', data => setPinnedMessages(prev => [data, ...prev]));
    socket.on('message_unpinned', ({ message_id }) => setPinnedMessages(prev => prev.filter(p => p.message_id !== message_id)));

    return () => {
      cancelled = true;
      socket.off('connect'); socket.off('disconnect'); socket.off('reconnect_attempt');
      socket.off('reconnect'); socket.off('message'); socket.off('dm_message');
      socket.off('message_deleted'); socket.off('message_edited'); socket.off('reaction_updated');
      socket.off('user_typing'); socket.off('user_stop_typing');
      socket.off('message_pinned'); socket.off('message_unpinned');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, isTabFocused, activeDMUser, activeRoom, currentRoomId]);

  // ===== SCROLL TRACKING — only auto-scroll to bottom if the user hasn't
  // deliberately scrolled up; otherwise surface the "↓ N new messages" jump pill. =====
  const prevMsgCountRef = useRef(0);
  const prevRoomIdRef = useRef(null);

  useEffect(() => {
    if (currentRoomId !== prevRoomIdRef.current) {
      prevRoomIdRef.current = currentRoomId;
      prevMsgCountRef.current = currentMessages.length;
      setScrolledUp(false);
      setNewSinceScroll(0);
      return;
    }
    const len = currentMessages.length;
    if (len > prevMsgCountRef.current) {
      if (scrolledUp) {
        setNewSinceScroll(n => n + (len - prevMsgCountRef.current));
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevMsgCountRef.current = len;
  }, [currentMessages, currentRoomId, scrolledUp]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [typingUsers]);

  const handleMessagesScroll = () => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nowScrolledUp = distanceFromBottom > 150;
    setScrolledUp(nowScrolledUp);
    if (!nowScrolledUp) {
      setNewSinceScroll(0);
      if (currentRoomId) {
        setUnreadBoundaryCount(prev => (prev[currentRoomId] ? { ...prev, [currentRoomId]: 0 } : prev));
      }
    }
  };

  const jumpToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewSinceScroll(0);
    setScrolledUp(false);
  };

  useEffect(() => {
    if (showSearch && searchInputRef.current) searchInputRef.current.focus();
  }, [showSearch]);

  useEffect(() => {
    if (showProfile) {
      setProfileEdit({
        bio: profile.bio || '',
        avatar_color: profile.avatar_color || '#667eea',
        avatar_url: profile.avatar_url || '',
        current_password: '',
        new_password: ''
      });
    }
  }, [showProfile, profile.bio, profile.avatar_color, profile.avatar_url]);

  // ===== CLOSE LIGHTBOX WITH ESCAPE =====
  useEffect(() => {
    if (!lightboxImage) return;
    const onKey = (e) => { if (e.key === 'Escape') setLightboxImage(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxImage]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (e.target.value.trim()) {
      socket.emit('typing', { username });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => socket.emit('stop_typing', { username }), 1500);
    } else {
      socket.emit('stop_typing', { username });
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    maybeShowPermissionBanner();
    setSendPulse(true);
    setTimeout(() => setSendPulse(false), 300);
    if (imageFile) { sendImageMessage(); return; }
    if (!input.trim()) return;
    if (activeRoom === 'general') {
      socket.emit('send_message', {
        username, text: input,
        reply_to: replyingTo ? { _id: replyingTo._id, username: replyingTo.username, text: replyingTo.text } : null
      });
    } else if (activeRoom === 'dm') {
      socket.emit('send_dm', {
        username, text: input, room_id: currentRoomId,
        reply_to: replyingTo ? { _id: replyingTo._id, username: replyingTo.username, text: replyingTo.text } : null
      });
    }
    socket.emit('stop_typing', { username });
    clearTimeout(typingTimeoutRef.current);
    setInput('');
    setShowEmojiPicker(false);
    setReplyingTo(null);
  };

  const deleteMessage = (message_id) => socket.emit('delete_message', { message_id });
  const startEdit = (msg) => { setEditingId(msg._id); setEditText(msg.text); };
  const saveEdit = (message_id) => {
    if (!editText.trim()) return;
    socket.emit('edit_message', { message_id, text: editText });
    setEditingId(null); setEditText('');
  };
  const addReaction = (message_id, emoji) => socket.emit('add_reaction', { message_id, emoji, username });

  const pinMessage = async (msg) => {
    const pinData = { message_id: msg._id, text: msg.text, username: msg.username, pinned_by: username };
    await axios.post('https://s-nalantamil-chat.onrender.com/pinned', pinData);
    socket.emit('pin_message', pinData);
  };
  const unpinMessage = async (message_id) => {
    await axios.delete(`https://s-nalantamil-chat.onrender.com/pinned/${message_id}`);
    socket.emit('unpin_message', { message_id });
  };
  const isPinned = (msg_id) => pinnedMessages.some(p => p.message_id === msg_id);

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'chat_app_uploads');
    formData.append('cloud_name', 'r2mj3pjl');
    const isImage = file.type.startsWith('image/');
    const uploadUrl = isImage
      ? 'https://api.cloudinary.com/v1_1/r2mj3pjl/image/upload'
      : 'https://api.cloudinary.com/v1_1/r2mj3pjl/raw/upload';
    const res = await fetch(uploadUrl, { method: 'POST', body: formData });
    const data = await res.json();
    return data.secure_url;
  };

  const getFileIcon = (file) => {
    if (!file) return '📎';
    if (file.type?.startsWith('image/')) return '🖼️';
    if (file.type === 'application/pdf') return '📄';
    if (file.type?.includes('word') || file.name?.endsWith('.docx')) return '📝';
    if (file.type?.includes('zip') || file.name?.endsWith('.zip')) return '🗜️';
    if (file.type?.includes('excel') || file.name?.endsWith('.xlsx')) return '📊';
    return '📎';
  };

  const handleImageSelect = (file) => {
    if (!file) return;
    setImageFile(file);
    if (file.type?.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const handleFileInput = (e) => handleImageSelect(e.target.files[0]);
  const cancelImage = () => {
    setImagePreview(null); setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendImageMessage = async () => {
    if (!imageFile) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(imageFile);
      const caption = input.trim();
      const isImage = imageFile.type?.startsWith('image/');
      const text = isImage
        ? `__IMAGE__${url}${caption ? `__CAPTION__${caption}` : ''}`
        : `__FILE__${url}__FILENAME__${imageFile.name}__FILEICON__${getFileIcon(imageFile)}${caption ? `__CAPTION__${caption}` : ''}`;
      const replyData = replyingTo ? { _id: replyingTo._id, username: replyingTo.username, text: replyingTo.text } : null;
      if (activeRoom === 'general') {
        socket.emit('send_message', { username, text, reply_to: replyData });
      } else if (activeRoom === 'dm') {
        socket.emit('send_dm', { username, text, room_id: currentRoomId, reply_to: replyData });
      }
      setReplyingTo(null); cancelImage(); setInput('');
    } catch (err) { console.error('Upload failed:', err); }
    setUploading(false);
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); handleImageSelect(e.dataTransfer.files[0]); };
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) { handleImageSelect(items[i].getAsFile()); break; }
    }
  };

  // ===== AVATAR CROP MODAL LOGIC =====

  // Clamp the drag offset so the image always fully covers the circular viewport
  // at the current zoom level (prevents dragging in empty/transparent space).
  const clampCropPosition = (pos, zoom, natural) => {
    if (!natural.width || !natural.height) return pos;
    const baseScale = Math.max(CROP_VIEWPORT / natural.width, CROP_VIEWPORT / natural.height);
    const scale = baseScale * zoom;
    const dispW = natural.width * scale;
    const dispH = natural.height * scale;
    const maxX = Math.max(0, (dispW - CROP_VIEWPORT) / 2);
    const maxY = Math.max(0, (dispH - CROP_VIEWPORT) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, pos.x)),
      y: Math.min(maxY, Math.max(-maxY, pos.y)),
    };
  };

  // Intercepts the avatar file input: instead of uploading immediately, read the
  // file and open the crop modal on top of Profile Settings.
  const handleAvatarFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCropImageSrc(ev.target.result);
      setCropNaturalSize({ width: 0, height: 0 });
      setCropZoom(1);
      setCropPosition({ x: 0, y: 0 });
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropImageLoad = (e) => {
    setCropNaturalSize({ width: e.target.naturalWidth, height: e.target.naturalHeight });
  };

  // Unified pointer handling: works for mouse drag (desktop) and touch drag/pinch
  // (mobile) through the same Pointer Events code path.
  const handleCropPointerDown = (e) => {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    cropPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (cropPointersRef.current.size === 1) {
      setCropDragging(true);
      cropDragStartRef.current = { x: e.clientX, y: e.clientY, posX: cropPosition.x, posY: cropPosition.y };
    } else if (cropPointersRef.current.size === 2) {
      const pts = Array.from(cropPointersRef.current.values());
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      cropPinchStartRef.current = { distance: Math.hypot(dx, dy) || 1, zoom: cropZoom };
    }
  };

  const handleCropPointerMove = (e) => {
    if (!cropPointersRef.current.has(e.pointerId)) return;
    cropPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (cropPointersRef.current.size === 2) {
      const pts = Array.from(cropPointersRef.current.values());
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      const distance = Math.hypot(dx, dy);
      const ratio = distance / cropPinchStartRef.current.distance;
      const newZoom = Math.min(CROP_ZOOM_MAX, Math.max(CROP_ZOOM_MIN, cropPinchStartRef.current.zoom * ratio));
      setCropZoom(newZoom);
      setCropPosition(prev => clampCropPosition(prev, newZoom, cropNaturalSize));
    } else if (cropPointersRef.current.size === 1 && cropDragging) {
      const dx = e.clientX - cropDragStartRef.current.x;
      const dy = e.clientY - cropDragStartRef.current.y;
      const newPos = { x: cropDragStartRef.current.posX + dx, y: cropDragStartRef.current.posY + dy };
      setCropPosition(clampCropPosition(newPos, cropZoom, cropNaturalSize));
    }
  };

  const handleCropPointerUp = (e) => {
    cropPointersRef.current.delete(e.pointerId);
    if (cropPointersRef.current.size === 0) setCropDragging(false);
  };

  const handleCropWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.min(CROP_ZOOM_MAX, Math.max(CROP_ZOOM_MIN, cropZoom + delta));
    setCropZoom(newZoom);
    setCropPosition(prev => clampCropPosition(prev, newZoom, cropNaturalSize));
  };

  const handleCropZoomSlider = (e) => {
    const newZoom = parseFloat(e.target.value);
    setCropZoom(newZoom);
    setCropPosition(prev => clampCropPosition(prev, newZoom, cropNaturalSize));
  };

  const cancelCrop = () => {
    setCropModalOpen(false);
    setCropImageSrc(null);
    setCropNaturalSize({ width: 0, height: 0 });
    setCropZoom(1);
    setCropPosition({ x: 0, y: 0 });
    cropPointersRef.current.clear();
  };

  // Crops the image into a circle using Canvas, matching exactly what the crop
  // viewport shows (same base-scale/zoom/offset math), then stores the base64
  // JPEG as a PREVIEW only. It is not uploaded until Save Changes is clicked.
  const applyCropPhoto = () => {
    if (!cropImageSrc || !cropNaturalSize.width || !cropNaturalSize.height) return;
    const img = new Image();
    img.onload = () => {
      const baseScale = Math.max(CROP_VIEWPORT / cropNaturalSize.width, CROP_VIEWPORT / cropNaturalSize.height);
      const scale = baseScale * cropZoom;
      const dispW = cropNaturalSize.width * scale;
      const dispH = cropNaturalSize.height * scale;
      const topLeftX = (CROP_VIEWPORT - dispW) / 2 + cropPosition.x;
      const topLeftY = (CROP_VIEWPORT - dispH) / 2 + cropPosition.y;
      const ratio = CROP_OUTPUT / CROP_VIEWPORT;

      const canvas = document.createElement('canvas');
      canvas.width = CROP_OUTPUT;
      canvas.height = CROP_OUTPUT;
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.beginPath();
      ctx.arc(CROP_OUTPUT / 2, CROP_OUTPUT / 2, CROP_OUTPUT / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, topLeftX * ratio, topLeftY * ratio, dispW * ratio, dispH * ratio);
      ctx.restore();

      const base64 = canvas.toDataURL('image/jpeg', 0.92);
      setPendingAvatarBase64(base64);
      setProfileEdit(prev => ({ ...prev, avatar_url: base64 }));
      cancelCrop();
    };
    img.src = cropImageSrc;
  };

  // Converts the cropped base64 JPEG into a File so it can be sent through the
  // existing uploadToCloudinary() function unchanged.
  const base64ToFile = (base64, filename) => {
    const arr = base64.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  };

  const saveProfile = async () => {
    setProfileSaving(true); setProfileMsg('');
    try {
      let updatedProfileEdit = profileEdit;
      // Real upload only happens now, on Save Changes — not when the crop was applied.
      if (pendingAvatarBase64) {
        const avatarFile = base64ToFile(pendingAvatarBase64, `avatar_${username}_${Date.now()}.jpg`);
        const uploadedUrl = await uploadToCloudinary(avatarFile);
        updatedProfileEdit = { ...profileEdit, avatar_url: uploadedUrl };
        setProfileEdit(updatedProfileEdit);
      }
      await axios.put(`https://s-nalantamil-chat.onrender.com/profile/${username}`, updatedProfileEdit);
      const res = await axios.get(`https://s-nalantamil-chat.onrender.com/profile/${username}`);
      setProfile(res.data);
      setProfileEdit(prev => ({ ...prev, ...res.data, current_password: '', new_password: '' }));
      setPendingAvatarBase64(null);
      setProfileMsg('✅ Profile updated successfully!');
      setTimeout(() => setProfileMsg(''), 3000);
    } catch (err) {
      setProfileMsg('❌ ' + (err.response?.data?.error || 'Failed to update'));
    }
    setProfileSaving(false);
  };

  const setLock = async () => {
    if (!lockPassword.trim()) return;
    try {
      await axios.post(`https://s-nalantamil-chat.onrender.com/chatlock/${currentRoomId}`, { password: lockPassword, set_by: username });
      setChatLocks(prev => ({ ...prev, [currentRoomId]: { locked: true, set_by: username } }));
      setLockedRooms(prev => ({ ...prev, [currentRoomId]: true }));
      setLockPassword('');
      setShowLockModal(false);
      alert('🔒 Chat locked successfully!');
    } catch (err) { alert('Failed to set lock'); }
  };

  const verifyLock = async () => {
    try {
      const res = await axios.post(`https://s-nalantamil-chat.onrender.com/chatlock/${currentRoomId}/verify`, { password: lockVerifyPassword });
      if (res.data.valid) {
        setLockedRooms(prev => ({ ...prev, [currentRoomId]: true }));
        setLockVerifyPassword('');
        setShowLockModal(false);
        await fetchDMMessages(currentRoomId);
      } else { alert('❌ Wrong password!'); }
    } catch (err) { alert('Failed to verify'); }
  };

  const removeLock = async () => {
    try {
      await axios.delete(`https://s-nalantamil-chat.onrender.com/chatlock/${currentRoomId}`);
      setChatLocks(prev => ({ ...prev, [currentRoomId]: { locked: false } }));
      alert('🔓 Lock removed!');
    } catch (err) { alert('Failed to remove lock'); }
  };

  // ===== LOGOUT: clear saved navigation state too =====
  const handleLogoutClick = () => {
    localStorage.removeItem(`chat_activeRoom_${username}`);
    localStorage.removeItem(`chat_activeDMUser_${username}`);
    onLogout();
  };

  // ===== NOTIFICATION SYSTEM =====

  // Refs mirroring the latest settings/mutes so the long-lived socket handlers
  // (wired once per connection) always read current values, not stale closures.
  const notifSettingsRef = useRef(notifSettings);
  const mutedRoomsRef = useRef(mutedRooms);
  useEffect(() => { notifSettingsRef.current = notifSettings; }, [notifSettings]);
  useEffect(() => { mutedRoomsRef.current = mutedRooms; }, [mutedRooms]);

  // Persist preferences/mutes whenever they change.
  useEffect(() => {
    try { localStorage.setItem(`notif_settings_${username}`, JSON.stringify(notifSettings)); } catch (err) {}
  }, [notifSettings, username]);
  useEffect(() => {
    try { localStorage.setItem(`muted_rooms_${username}`, JSON.stringify(mutedRooms)); } catch (err) {}
  }, [mutedRooms, username]);

  // Live document.title prefix — "(3) Nalantamil" while unread, cleared on focus.
  useEffect(() => {
    const dmTotal = Object.values(unreadDMs).reduce((a, b) => a + b, 0);
    const total = unreadCount + dmTotal;
    document.title = total > 0 ? `(${total}) Nalantamil` : 'Nalantamil';
  }, [unreadCount, unreadDMs]);
  useEffect(() => {
    const onFocusClearTitle = () => { document.title = 'Nalantamil'; };
    window.addEventListener('focus', onFocusClearTitle);
    return () => window.removeEventListener('focus', onFocusClearTitle);
  }, []);

  const isWithinDnd = () => {
    const s = notifSettingsRef.current;
    if (!s.dndEnabled) return false;
    const now = new Date();
    const [sh, sm] = s.dndStart.split(':').map(Number);
    const [eh, em] = s.dndEnd.split(':').map(Number);
    const cur = now.getHours() * 60 + now.getMinutes();
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (start === end) return false;
    if (start < end) return cur >= start && cur < end;
    return cur >= start || cur < end; // wraps past midnight
  };

  // Quiet, short notification beep via Web Audio — no external asset needed.
  const playNotifSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 720;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.2);
      setTimeout(() => ctx.close(), 400);
    } catch (err) {}
  };

  // Whether a message in roomKey should generate a notification (toast/sound/browser),
  // given mute state, DND, and the "Notify for" preference.
  const shouldNotifyFor = (roomKey, msg) => {
    if (mutedRoomsRef.current[roomKey]) return false;
    if (isWithinDnd()) return false;
    const notifyFor = notifSettingsRef.current.notifyFor;
    if (notifyFor === 'none') return false;
    if (notifyFor === 'mentions') {
      const mentioned = msg.text?.includes('@' + username);
      const repliedToMe = msg.reply_to?.username === username;
      return mentioned || repliedToMe;
    }
    return true;
  };

  const pushToast = ({ avatar, avatarColor, sender, preview, roomKey, target }) => {
    const id = ++toastIdRef.current;
    setToasts(prev => {
      const next = [...prev, { id, avatar, avatarColor, sender, preview, roomKey, target }];
      return next.length > 3 ? next.slice(next.length - 3) : next;
    });
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  const pushNotifCenterItem = (item) => {
    setNotifCenterItems(prev => {
      const [first, ...rest] = prev;
      // Collapse repeated join/leave events for the same actor (e.g. reconnect
      // storms) into one entry with a count badge instead of spamming the list.
      if (item.type === 'join' && first && first.type === 'join' && first.sender === item.sender && first.action === item.action) {
        return [{ ...first, count: (first.count || 1) + 1, read: false, createdAt: Date.now() }, ...rest];
      }
      return [{ id: Date.now() + Math.random(), read: false, count: 1, createdAt: Date.now(), ...item }, ...prev].slice(0, 30);
    });
  };

  const formatRelativeTime = (ts) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return 'now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
    return `${Math.floor(diffSec / 86400)}d`;
  };

  // ===== NOTIFICATION POPOVER — outside click, Escape, and a lightweight focus
  // trap while open; focus returns to the bell button when it closes. =====
  useEffect(() => {
    if (!showNotifCenter) return;
    const handleClickOutside = (e) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target) &&
          notifBellBtnRef.current && !notifBellBtnRef.current.contains(e.target)) {
        setShowNotifCenter(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { setShowNotifCenter(false); return; }
      if (e.key === 'Tab' && notifPanelRef.current) {
        const focusables = notifPanelRef.current.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
        if (focusables.length === 0) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    const focusTimer = setTimeout(() => {
      notifPanelRef.current?.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])')?.focus();
    }, 0);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(focusTimer);
    };
  }, [showNotifCenter]);

  const prevShowNotifCenterRef = useRef(false);
  useEffect(() => {
    if (prevShowNotifCenterRef.current && !showNotifCenter) {
      notifBellBtnRef.current?.focus();
    }
    prevShowNotifCenterRef.current = showNotifCenter;
  }, [showNotifCenter]);

  // Close the popover on route change (switching channel/DM).
  useEffect(() => {
    setShowNotifCenter(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom, activeDMUser]);

  // Requests Notification permission — called lazily on first message SEND
  // (never on page load). Shows a dismissible inline banner first instead of
  // triggering the bare browser popup immediately.
  const maybeShowPermissionBanner = () => {
    if (permissionAskedRef.current) return;
    if (!('Notification' in window)) return;
    if (!notifSettings.desktop) return;
    if (Notification.permission !== 'default') return;
    permissionAskedRef.current = true;
    setShowPermissionBanner(true);
  };

  const enableDesktopNotifs = async () => {
    setShowPermissionBanner(false);
    try {
      if ('Notification' in window) await Notification.requestPermission();
    } catch (err) {}
  };

  // Fires a real Web Notification only when the tab is hidden/unfocused, and
  // coalesces rapid messages from the same sender into one (via `tag`).
  const fireBrowserNotification = (roomKey, senderUsername, body, onClickNavigate) => {
    if (!notifSettingsRef.current.desktop) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const isHiddenOrUnfocused = document.visibilityState === 'hidden' || !document.hasFocus();
    if (!isHiddenOrUnfocused) return;
    const tag = `msg-${roomKey}-${senderUsername}`;
    notifTagCountRef.current[tag] = (notifTagCountRef.current[tag] || 0) + 1;
    const count = notifTagCountRef.current[tag];
    const n = new Notification(count > 1 ? `${senderUsername} (${count} new messages)` : senderUsername, {
      body, tag, renotify: true,
    });
    n.onclick = () => {
      window.focus();
      onClickNavigate();
      n.close();
      notifTagCountRef.current[tag] = 0;
    };
  };

  // ===== DRAWER DRAG GESTURES (Pointer Events — mouse on desktop, finger on mobile).
  // Only does anything when isMobile is true — on wide screens the list is always
  // visible so dragging it is a no-op. =====
  const handleDragStart = (e) => {
    if (!isMobile) return;
    const x = e.clientX, y = e.clientY;
    dragState.current = { startX: x, startY: y, currentX: x, dragging: true, horizontal: false };
    if (sidebarRef.current) sidebarRef.current.style.transition = 'none';
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  };

  const handleDragMove = (e) => {
    if (!isMobile) return;
    const ds = dragState.current;
    if (!ds.dragging || !sidebarRef.current) return;
    const x = e.clientX, y = e.clientY;
    ds.currentX = x;
    const deltaX = x - ds.startX;
    const deltaY = y - ds.startY;

    if (!ds.horizontal) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      ds.horizontal = Math.abs(deltaX) > Math.abs(deltaY);
      if (!ds.horizontal) { ds.dragging = false; return; }
      document.body.style.userSelect = 'none';
    }

    const width = sidebarRef.current.offsetWidth || 300;
    if (sidebarOpen) {
      const tx = Math.min(0, deltaX);
      sidebarRef.current.style.transform = `translateX(${tx}px)`;
    } else {
      const tx = Math.min(0, -width + Math.max(0, deltaX));
      sidebarRef.current.style.transform = `translateX(${tx}px)`;
    }
  };

  const handleDragEnd = () => {
    if (!isMobile) return;
    const ds = dragState.current;
    if (!ds.dragging) return;
    ds.dragging = false;
    document.body.style.userSelect = '';
    if (sidebarRef.current) {
      sidebarRef.current.style.transition = '';
      sidebarRef.current.style.transform = '';
    }
    if (!ds.horizontal) return;
    const width = sidebarRef.current?.offsetWidth || 300;
    const deltaX = ds.currentX - ds.startX;
    if (sidebarOpen) {
      if (deltaX < -width * 0.25) setSidebarOpen(false);
    } else {
      if (deltaX > width * 0.25) setSidebarOpen(true);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp + 'Z').toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatLastMsgTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const getInitial = (name) => name ? name[0].toUpperCase() : '?';
  const filteredMessages = searchQuery.trim()
    ? currentMessages.filter(m => m.type !== 'system' && m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : currentMessages;
  const totalUnreadDMs = Object.values(unreadDMs).reduce((a, b) => a + b, 0);

  const getLastMsgPreview = (roomId) => {
    const msgs = dmMessages[roomId];
    if (!msgs || msgs.length === 0) return '';
    const last = msgs[msgs.length - 1];
    if (last.text?.startsWith('__IMAGE__')) return '🖼️ Image';
    if (last.text?.startsWith('__FILE__')) return '📎 File';
    const words = last.text?.split(' ') || [];
    if (words.length > 7) return words.slice(0, 7).join(' ') + '...';
    return last.text || '';
  };

  // ===== SIDEBAR STYLE — normal always-visible panel on wide screens; a 72px
  // icon rail on tablet (768–1023px); a slide-out overlay drawer on narrow/mobile
  // screens. Computed in JS and applied inline so nothing in the stylesheet can
  // silently override it. =====
  const sidebarDynamicStyle = isMobile
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: 'min(82vw, 320px)',
        height: '100vh',
        zIndex: 70,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1), box-shadow 0.35s ease',
        boxShadow: sidebarOpen ? '12px 0 50px rgba(0,0,0,0.45)' : 'none',
        background: 'rgba(10,8,25,0.98)',
        backdropFilter: 'blur(12px)',
        opacity: 1,
      }
    : isTablet
    ? {
        position: 'relative',
        width: '72px',
        minWidth: '72px',
        height: '100vh',
        transform: 'none',
        opacity: 1,
      }
    : {
        position: 'relative',
        width: '300px',
        minWidth: '300px',
        height: '100vh',
        transform: 'none',
        opacity: 1,
      };

  // ===== LOADING SCREEN — self-contained, renders instead of everything else
  // until the essential startup data has arrived. =====
  if (appLoading) {
    return (
      <div className="app-loading-screen">
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes pulse {
            0%, 100% { opacity: 0.35; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.3); }
          }
          @keyframes shimmerSweep {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          }
          .app-loading-screen {
            position: fixed; inset: 0;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 20px;
            background: linear-gradient(-45deg, #07070f, #0d0d1a, #111120, #0d0d1a);
            background-size: 400% 400%;
            animation: gradientShift 8s ease infinite;
            font-family: 'Segoe UI', sans-serif;
            z-index: 999999;
            padding: 24px;
            text-align: center;
          }
          .app-loading-logo {
            font-size: 56px;
            animation: float 3s ease-in-out infinite;
            filter: drop-shadow(0 0 25px rgba(99,102,241,0.6));
          }
          .app-loading-title {
            font-size: 26px; font-weight: 800;
            background: linear-gradient(110deg, #6366f1 20%, #a78bfa 40%, #ffffff 50%, #a78bfa 60%, #6366f1 80%);
            background-size: 250% 100%;
            -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
            letter-spacing: 2px;
            animation: shimmerSweep 2.6s linear infinite;
          }
          .app-loading-spinner {
            width: 40px; height: 40px;
            border: 3px solid rgba(255,255,255,0.15);
            border-top-color: #6366f1;
            border-radius: 50%;
            animation: spin 0.9s linear infinite;
          }
          .app-loading-message {
            font-size: 13px; color: rgba(255,255,255,0.5);
            max-width: 320px; line-height: 1.6;
            min-height: 40px;
            animation: fadeIn 0.4s ease;
          }
          .app-loading-dots { display: flex; gap: 6px; }
          .app-loading-dots span {
            width: 6px; height: 6px; border-radius: 50%;
            background: rgba(99,102,241,0.7);
            animation: pulse 1.4s ease-in-out infinite;
          }
          .app-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
          .app-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        `}</style>
        <div className="app-loading-logo">💬</div>
        <div className="app-loading-title">Nalantamil</div>
        <div className="app-loading-spinner"></div>
        <div className="app-loading-message">{loadingMessage}</div>
        <div className="app-loading-dots"><span></span><span></span><span></span></div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
          --surface-1: #0d0d1a;
          --surface-2: #111120;
          --surface-3: #1c1c32;
          --surface-4: #2a2a45;
          --border: rgba(255,255,255,0.08);
          --border-strong: rgba(255,255,255,0.16);
          --foreground: #f1f5f9;
          --muted-foreground: #94a3b8;
          --faint-foreground: #475569;
          --accent: #6366f1;
          --accent-2: #8b5cf6;
          --accent-foreground: #ffffff;
          --accent-subtle: rgba(99,102,241,0.14);
          --success: #10b981;
          --destructive: #ef4444;
        }

        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes typingBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes ripple {
          to { transform: scale(4); opacity: 0; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes glowDrift {
          0%, 100% { transform: translate(-10%, -10%) scale(1); opacity: 0.55; }
          50% { transform: translate(10%, 8%) scale(1.15); opacity: 0.85; }
        }
        @keyframes badgePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes onlinePing {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes shimmerSweep {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes modalSpringIn {
          0% { transform: scale(0.92); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes bottomSheetIn {
          0% { transform: translateY(100%); opacity: 0.6; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }
        @keyframes iconBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes shakeX {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
        @keyframes badgePop {
          0% { transform: scale(0); }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes lightboxFadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes lightboxZoomIn {
          from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); }
        }
        @keyframes sendFlash {
          0% { transform: rotate(0deg); }
          40% { transform: rotate(15deg) scale(1.15); }
          100% { transform: rotate(0deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        body {
          background: ${selectedBg.value};
          background-size: 400% 400%;
          animation: gradientShift 8s ease infinite;
        }

        .chat-layout { display: flex; height: 100vh; width: 100vw; font-family: 'Segoe UI', sans-serif; overflow: hidden; position: relative; }

        .connection-banner { position: fixed; top: 0; left: 0; right: 0; z-index: 99999; padding: 10px 20px; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 13px; font-weight: 600; animation: slideDown 0.3s ease; }
        .connection-banner.reconnecting { background: linear-gradient(135deg, #e67e22, #b45309); color: white; }
        .connection-banner.connected { background: linear-gradient(135deg, #10b981, #10b981); color: white; }
        .reconnect-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
        .reconnect-dot { width: 8px; height: 8px; background: white; border-radius: 50%; flex-shrink: 0; }

        .sidebar {
          background: #0d0d1a;
          border-right: 1px solid rgba(255,255,255,0.05);
          display: flex; flex-direction: column;
          overflow-y: auto;
          touch-action: pan-y;
          scrollbar-width: thin;
          scrollbar-color: rgba(99,102,241,0.25) transparent;
        }
        .sidebar::before {
          content: '';
          position: absolute; inset: 0;
          pointer-events: none;
          background: radial-gradient(ellipse 80% 40% at 50% 0%, rgba(99,102,241,0.07) 0%, transparent 60%);
        }
        .sidebar::-webkit-scrollbar { width: 3px; }
        .sidebar::-webkit-scrollbar-thumb { background: transparent; border-radius: 2px; transition: background 0.2s; }
        .sidebar:hover::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.25); }
        .sidebar:hover::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.45); }

        .sidebar-logo { padding: 16px 16px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); position: relative; z-index: 1; }
        .logo-row { display: flex; align-items: center; gap: 10px; }
        .brand-mark { width: 28px; height: 28px; border-radius: 8px; background: #6366f1; color: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .logo-name { font-size: 16px; font-weight: 700; letter-spacing: -0.02em; color: #f1f5f9; }

        .sidebar-search-wrap { margin: 12px 12px 8px; position: relative; z-index: 1; }
        .sidebar-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted-foreground); pointer-events: none; display: flex; }
        .sidebar-search-input {
          width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 8px 12px 8px 36px; color: #94a3b8; font-size: 13px;
          outline: none; transition: all 200ms;
        }
        .sidebar-search-input::placeholder { color: #334155; }
        .sidebar-search-input:focus { background: rgba(255,255,255,0.06); border-color: rgba(99,102,241,0.4); color: #f1f5f9; }

        .sidebar-section-title { padding: 16px 16px 6px; font-size: 10px; font-weight: 600; color: #334155; letter-spacing: 1.4px; text-transform: uppercase; display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 1; }
        .sidebar-section-add-btn {
          width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          color: #475569; font-size: 16px; cursor: pointer; transition: all 150ms; background: none; border: none;
        }
        .sidebar-section-add-btn:hover { color: #818cf8; background: rgba(99,102,241,0.1); }

        .channel-item { margin: 1px 8px; padding: 8px 10px; border-radius: 10px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: all 180ms; border-left: 2px solid transparent; position: relative; z-index: 1; }
        .channel-item:hover { background: rgba(99,102,241,0.07); border-left-color: rgba(99,102,241,0.3); transform: translateX(2px); }
        .channel-item.active { background: rgba(99,102,241,0.14); border-left: 2px solid #6366f1; box-shadow: inset 0 0 0 1px rgba(99,102,241,0.15); }
        .channel-icon { font-size: 16px; color: #6366f1; width: 20px; text-align: center; }
        .channel-info { flex: 1; overflow: hidden; }
        .channel-name { font-size: 14px; color: #94a3b8; }
        .channel-item.active .channel-name { color: #f1f5f9; font-weight: 500; }
        .channel-sub { font-size: 10px; color: rgba(255,255,255,0.28); margin-top: 1px; }
        .channel-badge { background: #6366f1; color: white; font-size: 11px; font-weight: 700; min-width: 20px; height: 20px; border-radius: 10px; display: flex; align-items: center; justify-content: center; padding: 0 5px; animation: badgePop 300ms ease; }

        .dm-item { margin: 1px 8px; padding: 8px 10px; border-radius: 10px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: all 180ms; border-left: 2px solid transparent; position: relative; z-index: 1; }
        .dm-item:hover { background: rgba(99,102,241,0.07); border-left-color: rgba(99,102,241,0.3); transform: translateX(2px); }
        .dm-item.active { background: rgba(99,102,241,0.14); border-left: 2px solid #6366f1; box-shadow: inset 0 0 0 1px rgba(99,102,241,0.15); }

        .dm-avatar { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #a78bfa, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: white; flex-shrink: 0; overflow: hidden; position: relative; }

        .dm-info { flex: 1; overflow: hidden; min-width: 0; }
        .dm-name-row { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
        .dm-name { font-size: 14px; font-weight: 500; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dm-item.active .dm-name { color: white; font-weight: 600; }
        .dm-time { font-size: 11px; color: #334155; flex-shrink: 0; align-self: flex-start; margin-top: 2px; }
        .dm-time.unread { color: #6366f1; font-weight: 600; }
        .dm-preview-row { display: flex; align-items: center; justify-content: space-between; margin-top: 1px; }
        .dm-preview { font-size: 12px; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
        .dm-lock-icon { font-size: 11px; color: rgba(255,215,0,0.5); flex-shrink: 0; margin-left: 4px; }

        .online-dot-wrap { position: absolute; bottom: 1px; right: 1px; }
        .online-dot { position: relative; width: 10px; height: 10px; border-radius: 50%; background: #10b981; border: 2px solid #0d0d1a; box-shadow: 0 0 6px rgba(16,185,129,0.6); }
        .online-dot::after {
          content: '';
          position: absolute; inset: 0;
          border-radius: 50%;
          background: #10b981;
          animation: onlinePing 2s infinite;
        }

        .sidebar-spacer { flex: 1; min-height: 12px; }

        .sidebar-user { padding: 10px 12px; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.3); backdrop-filter: blur(10px); display: flex; align-items: center; gap: 10px; position: relative; z-index: 1; }
        .user-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: white; flex-shrink: 0; overflow: hidden; padding: 0; border: 1.5px solid rgba(99,102,241,0.4); cursor: pointer; transition: all 200ms; }
        .user-avatar:hover { border-color: #6366f1; box-shadow: 0 0 12px rgba(99,102,241,0.3); }
        .user-info { flex: 1; overflow: hidden; }
        .user-name { font-size: 13px; font-weight: 600; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .user-status { font-size: 11px; color: #10b981; margin-top: 1px; }

        .icon-btn { width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.2s; flex-shrink: 0; border: none; background: transparent; }
        .logout-icon-btn { color: #475569; }
        .logout-icon-btn:hover { background: rgba(239,68,68,0.1); color: #ef4444; }
        .logout-icon-btn:active { animation: shakeX 0.35s ease; }
        .profile-icon-btn { color: #475569; }
        .profile-icon-btn:hover { background: rgba(255,255,255,0.08); color: #818cf8; transform: rotate(90deg); transition: transform 400ms ease, background 0.2s, color 0.2s; }

        /* ===== TABLET ICON RAIL (768–1023px) — collapsed sidebar: avatars/glyphs
           only, name shown as a native title tooltip on hover. ===== */
        .sidebar-rail .sidebar-search-wrap,
        .sidebar-rail .sidebar-section-title span:first-child,
        .sidebar-rail .channel-info,
        .sidebar-rail .dm-info,
        .sidebar-rail .user-info,
        .sidebar-rail .logo-name,
        .sidebar-rail .pm-footer-note {
          display: none;
        }
        .sidebar-rail .channel-item,
        .sidebar-rail .dm-item {
          justify-content: center;
          padding: 10px 0;
        }
        .sidebar-rail .sidebar-user {
          justify-content: center;
          flex-wrap: wrap;
          gap: 6px;
        }
        .sidebar-rail .logo-row { justify-content: center; }

        .ripple-btn { position: relative; overflow: hidden; }
        .ripple-btn::after { content: ''; position: absolute; width: 10px; height: 10px; background: rgba(255,255,255,0.3); border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%,-50%) scale(0); opacity: 1; }
        .ripple-btn:active::after { animation: ripple 0.4s ease-out; }

        .mobile-back-btn {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          width: 32px; height: 32px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          font-size: 17px; cursor: pointer; flex-shrink: 0;
        }
        .mobile-back-btn:hover { background: rgba(255,255,255,0.15); }

        .mobile-menu-btn {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          width: 32px; height: 32px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0;
        }
        .mobile-menu-btn:hover { background: rgba(255,255,255,0.15); }
        .mobile-menu-bars { position: relative; width: 15px; height: 11px; display: block; }
        .mobile-menu-bars span {
          position: absolute; left: 0; width: 100%; height: 2px;
          background: white; border-radius: 2px;
          transition: transform 0.3s ease, opacity 0.15s ease, top 0.3s ease;
        }
        .mobile-menu-bars span:nth-child(1) { top: 0; }
        .mobile-menu-bars span:nth-child(2) { top: 4.5px; }
        .mobile-menu-bars span:nth-child(3) { top: 9px; }
        .mobile-menu-btn.open .mobile-menu-bars span:nth-child(1) { top: 4.5px; transform: rotate(45deg); }
        .mobile-menu-btn.open .mobile-menu-bars span:nth-child(2) { opacity: 0; }
        .mobile-menu-btn.open .mobile-menu-bars span:nth-child(3) { top: 4.5px; transform: rotate(-45deg); }

        .mobile-drawer-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(3px);
          z-index: 65;
          animation: fadeIn 0.25s ease;
        }

        .mobile-edge-grab {
          position: fixed; top: 0; left: 0;
          height: 100%; width: 14px;
          z-index: 68;
          touch-action: none;
        }

        .welcome-screen {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 18px;
          text-align: center;
          padding: 40px;
          background: rgba(0,0,0,0.1);
        }
        .welcome-icon-circle {
          width: 130px; height: 130px;
          border-radius: 50%;
          background: rgba(99,102,241,0.1);
          border: 2px solid rgba(99,102,241,0.22);
          display: flex; align-items: center; justify-content: center;
          font-size: 60px;
          animation: float 4s ease-in-out infinite;
          filter: drop-shadow(0 0 30px rgba(99,102,241,0.3));
        }
        .welcome-title {
          font-size: 26px; font-weight: 800;
          background: linear-gradient(135deg, #6366f1, #a78bfa);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          letter-spacing: 1px;
        }
        .welcome-sub { font-size: 14px; color: rgba(255,255,255,0.4); max-width: 360px; line-height: 1.7; }
        .welcome-note {
          font-size: 12px; color: rgba(255,255,255,0.32);
          display: flex; align-items: center; gap: 6px; margin-top: 6px;
          padding: 9px 18px; background: rgba(255,255,255,0.04);
          border-radius: 20px; border: 1px solid rgba(255,255,255,0.07);
        }

        .chat-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; width: 100%; background: #07070f; }
        .chat-main::before {
          content: '';
          position: absolute; inset: 0;
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(ellipse 60% 40% at 75% 20%, rgba(99,102,241,0.06) 0%, transparent 60%),
            radial-gradient(ellipse 50% 60% at 20% 80%, rgba(139,92,246,0.04) 0%, transparent 60%);
        }
        .chat-header, .messages-area, .input-area, .welcome-screen { position: relative; z-index: 1; }

        .chat-header { padding: 14px 22px; background: rgba(13,13,26,0.9); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 12px; }

        .chat-header-avatar { width: 40px; height: 40px; border-radius: 9px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border: 1.5px solid rgba(99,102,241,0.4); display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; }
        .chat-header-avatar:hover { transform: scale(1.05); box-shadow: 0 0 0 3px rgba(99,102,241,0.35); }
        .chat-header-info { flex: 1; }
        .chat-header-name { font-size: 15px; font-weight: 600; color: #f1f5f9; }
        .chat-header-status { font-size: 12px; color: #6366f1; margin-top: 2px; display: flex; align-items: center; gap: 5px; }
        .status-dot { position: relative; width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 2px #07070f; }
        .status-dot::after {
          content: '';
          position: absolute; inset: 0;
          border-radius: 50%;
          background: inherit;
          animation: onlinePing 1.5s ease-out infinite;
        }
        .msg-count { font-size: 11px; color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.07); padding: 3px 9px; border-radius: 20px; }

        .header-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: white; width: 30px; height: 30px; border-radius: 9px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.2s; flex-shrink: 0; }
        .header-btn:hover { background: rgba(255,255,255,0.15); }
        .header-btn.active { background: rgba(99,102,241,0.3); border-color: #6366f1; }

        .search-bar { position: absolute; top: 64px; left: 0; right: 0; padding: 10px 22px; background: rgba(0,0,0,0.4); border-bottom: 1px solid rgba(255,255,255,0.07); z-index: 10; display: flex; align-items: center; gap: 10px; animation: slideDown 0.2s ease; }
        .search-input { flex: 1; background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.15); border-radius: 9px; color: white; font-size: 13px; padding: 7px 12px; outline: none; }
        .search-input:focus { border-color: #6366f1; }
        .search-input::placeholder { color: rgba(255,255,255,0.3); }
        .search-results-count { font-size: 11px; color: rgba(255,255,255,0.4); white-space: nowrap; }
        .search-close { background: none; border: none; color: rgba(255,255,255,0.5); font-size: 17px; cursor: pointer; }
        .search-highlight { background: rgba(255,215,0,0.3); border-radius: 3px; padding: 0 2px; }

        .bg-picker-dropdown { position: absolute; top: 64px; right: 14px; background: rgba(15,15,35,0.97); border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 14px; z-index: 999; min-width: 190px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); animation: slideIn 0.2s ease; }
        .bg-picker-title { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .bg-options { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .bg-option { padding: 7px 9px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 600; color: white; border: 2px solid transparent; transition: all 0.2s; text-align: center; }
        .bg-option:hover { border-color: rgba(255,255,255,0.3); }
        .bg-option.active { border-color: #6366f1; }

        .pinned-panel { position: absolute; top: 64px; left: 0; right: 0; background: rgba(10,10,30,0.97); border-bottom: 1px solid rgba(255,215,0,0.2); padding: 12px 22px; z-index: 10; animation: slideDown 0.2s ease; max-height: 200px; overflow-y: auto; }
        .pinned-panel-title { font-size: 10px; font-weight: 700; color: rgba(255,215,0,0.7); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .pinned-item { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 8px; background: rgba(255,215,0,0.04); border: 1px solid rgba(255,215,0,0.1); margin-bottom: 5px; }
        .pinned-item-content { flex: 1; overflow: hidden; }
        .pinned-item-text { font-size: 12px; color: rgba(255,255,255,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pinned-item-meta { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 1px; }
        .unpin-btn { background: none; border: none; color: rgba(255,255,255,0.3); font-size: 13px; cursor: pointer; }
        .unpin-btn:hover { color: #ef4444; }

        .messages-area { flex: 1; overflow-y: auto; padding: 18px 0; display: flex; flex-direction: column; scroll-behavior: smooth; }
        .thread-container { max-width: 820px; margin-inline: auto; width: 100%; padding-inline: 24px; display: flex; flex-direction: column; gap: 3px; }
        .messages-area::-webkit-scrollbar { width: 4px; }
        .messages-area::-webkit-scrollbar-thumb { background: transparent; border-radius: 3px; transition: background 0.2s; }
        .messages-area:hover::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.4); }

        .date-separator { display: flex; align-items: center; gap: 12px; align-self: stretch; margin: 14px 0 10px; }
        .date-separator-line { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent); }
        .date-separator-label { font-size: 11px; font-weight: 600; color: #475569; padding: 3px 14px; background: #111120; border-radius: 20px; border: 1px solid rgba(255,255,255,0.07); white-space: nowrap; letter-spacing: 0.06em; }

        .system-msg { text-align: center; color: rgba(255,255,255,0.28); font-size: 11px; padding: 3px 10px; background: rgba(255,255,255,0.03); border-radius: 20px; align-self: center; margin: 4px 0; }

        .msg-row { display: flex; align-items: flex-start; gap: 8px; max-width: 68%; position: relative; margin-top: 10px; }
        .msg-row.grouped { margin-top: 2px; }
        .msg-row.mine { align-self: flex-end; flex-direction: row-reverse; max-width: 68%; animation: slideInRight 220ms cubic-bezier(0.34, 1.56, 0.64, 1); }
        .msg-row.theirs { align-self: flex-start; max-width: 68%; animation: slideInLeft 220ms cubic-bezier(0.34, 1.56, 0.64, 1); }

        .msg-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #a78bfa, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white; flex-shrink: 0; align-self: flex-start; overflow: hidden; padding: 0; }
        .msg-row.mine .msg-avatar { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
        .msg-avatar-spacer { width: 32px; flex-shrink: 0; align-self: flex-start; }

        .msg-content { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .msg-row.mine .msg-content { align-items: flex-end; }
        .msg-row.theirs .msg-content { align-items: flex-start; }
        .msg-sender { font-size: 11px; color: #818cf8; font-weight: 600; letter-spacing: 0.04em; margin-bottom: 4px; padding: 0 3px; }

        .msg-bubble-wrap { position: relative; max-width: 100%; }
        .msg-bubble { padding: 10px 14px; font-size: 14px; line-height: 1.5; word-break: break-word; max-width: 100%; transition: transform 0.15s ease; }
        .msg-row.mine .msg-bubble { background: linear-gradient(135deg, #5b5fc7 0%, #7c3aed 100%); color: #ffffff; border-radius: 18px 4px 18px 18px; box-shadow: 0 4px 16px rgba(99,102,241,0.35); }
        .msg-row.theirs .msg-bubble { background: rgba(255,255,255,0.07); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.09); border-radius: 4px 18px 18px 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
        .msg-row:hover .msg-bubble { transform: scale(1.008); }

        .msg-footer { display: flex; align-items: center; gap: 5px; padding: 0 3px; margin-top: 3px; }
        .msg-row.theirs .msg-footer { color: #475569; }
        .msg-row.mine .msg-footer { color: rgba(99,102,241,0.7); }
        .msg-time { font-size: 11px; color: inherit; }
        .edited-tag { font-size: 9px; color: rgba(255,255,255,0.28); font-style: italic; }
        .seen-status { font-size: 10px; color: #818cf8; font-weight: 600; }
        .seen-status.delivered { color: rgba(255,255,255,0.28); }
        .msg-pin-indicator { font-size: 10px; color: rgba(255,215,0,0.5); }

        .msg-actions { display: flex; gap: 2px; align-items: center; position: absolute; top: 0; transform: translateY(-50%) scale(0.85); opacity: 0; pointer-events: none; transition: opacity 150ms ease, transform 150ms ease; background: #1c1c32; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 4px 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.5); z-index: 5; }
        .msg-row.theirs .msg-actions { right: -6px; }
        .msg-row.mine .msg-actions { left: -6px; }
        .msg-row:hover .msg-actions { opacity: 1; pointer-events: auto; transform: translateY(-50%) scale(1); }
        .action-btn { background: none; border: none; color: #64748b; width: 28px; height: 28px; border-radius: 50%; font-size: 13px; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
        .action-btn:hover { background: rgba(255,255,255,0.08); color: #f1f5f9; }
        .action-btn.delete:hover { background: rgba(239,68,68,0.2); color: #ef4444; }
        .action-btn.pinned { color: rgba(255,215,0,0.7); }

        .reactions-bar { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px; }
        .reaction-btn { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.11); border-radius: 20px; padding: 1px 6px; font-size: 11px; cursor: pointer; transition: all 0.15s; color: white; display: flex; align-items: center; gap: 3px; }
        .reaction-btn:hover { background: rgba(255,255,255,0.16); transform: scale(1.08); }
        .reaction-btn.reacted { background: rgba(99,102,241,0.22); border-color: rgba(99,102,241,0.45); }
        .reaction-count { font-size: 10px; color: rgba(255,255,255,0.65); }

        .reaction-picker { display: none; }
        .msg-row:hover .reaction-picker { display: flex; }
        .reaction-picker { gap: 3px; margin-top: 4px; background: #1c1c32; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 3px 7px; width: fit-content; }
        .reaction-pick-btn { background: none; border: none; font-size: 15px; cursor: pointer; transition: transform 0.15s; padding: 1px; }
        .reaction-pick-btn:hover { transform: scale(1.3); }

        .edit-input { background: rgba(255,255,255,0.09); border: 1.5px solid #6366f1; border-radius: 9px; color: white; font-size: 13px; padding: 6px 10px; outline: none; width: 100%; min-width: 160px; }
        .edit-actions { display: flex; gap: 4px; margin-top: 3px; }
        .save-btn { background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; color: white; padding: 3px 9px; border-radius: 7px; font-size: 11px; cursor: pointer; font-weight: 600; }
        .cancel-btn { background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.18); color: rgba(255,255,255,0.65); padding: 3px 9px; border-radius: 7px; font-size: 11px; cursor: pointer; }

        .reply-bar { padding: 6px 10px; background: rgba(99,102,241,0.09); border-left: 3px solid #6366f1; border-radius: 7px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; animation: slideDown 0.18s ease; }
        .reply-bar-content { flex: 1; overflow: hidden; }
        .reply-bar-name { font-size: 10px; font-weight: 700; color: #6366f1; margin-bottom: 1px; }
        .reply-bar-text { font-size: 10px; color: rgba(255,255,255,0.45); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .reply-bar-cancel { background: none; border: none; color: rgba(255,255,255,0.35); font-size: 15px; cursor: pointer; }

        .msg-reply-preview { background: rgba(255,255,255,0.06); border-left: 3px solid rgba(99,102,241,0.55); border-radius: 5px; padding: 4px 7px; margin-bottom: 4px; cursor: pointer; }
        .msg-reply-name { font-size: 10px; font-weight: 700; color: #6366f1; margin-bottom: 1px; }
        .msg-reply-text { font-size: 10px; color: rgba(255,255,255,0.45); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .typing-indicator { display: flex; align-items: center; gap: 7px; padding: 5px 12px; align-self: flex-start; }
        .typing-text { font-size: 11px; color: rgba(255,255,255,0.38); font-style: italic; }
        .typing-dots { display: flex; gap: 3px; align-items: center; }
        .typing-dot { width: 5px; height: 5px; background: rgba(255,255,255,0.38); border-radius: 50%; animation: typingBounce 1s ease infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }

        .empty-chat { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
        .empty-icon { display: flex; align-items: center; justify-content: center; color: rgba(99,102,241,0.5); animation: float 3s ease-in-out infinite; }
        .empty-title { font-size: 19px; font-weight: 700; color: rgba(255,255,255,0.45); }
        .empty-sub { font-size: 12px; color: rgba(255,255,255,0.22); }

        .input-area { padding: 12px 16px; background: rgba(13,13,26,0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-top: 1px solid rgba(255,255,255,0.06); position: relative; }
        .composer-inner { max-width: 820px; margin-inline: auto; width: 100%; }

        .image-preview-bar { padding: 7px 9px; background: rgba(99,102,241,0.09); border: 1px solid rgba(99,102,241,0.18); border-radius: 9px; margin-bottom: 7px; display: flex; align-items: center; gap: 9px; }
        .preview-img { width: 48px; height: 48px; object-fit: cover; border-radius: 7px; }
        .preview-info { flex: 1; }
        .preview-name { font-size: 11px; color: rgba(255,255,255,0.65); font-weight: 600; }
        .preview-size { font-size: 10px; color: rgba(255,255,255,0.28); margin-top: 1px; }
        .upload-progress { font-size: 10px; color: rgba(99,102,241,0.75); animation: pulse 1s ease-in-out infinite; }
        .preview-cancel { background: none; border: none; color: rgba(255,255,255,0.35); font-size: 15px; cursor: pointer; }

        .emoji-picker-popup { position: absolute; bottom: 68px; left: 16px; background: rgba(12,12,32,0.98); border: 1px solid rgba(255,255,255,0.11); border-radius: 13px; padding: 12px; z-index: 999; width: 290px; box-shadow: 0 18px 55px rgba(0,0,0,0.65); animation: slideDown 0.18s ease; }
        .emoji-picker-title { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 7px; }
        .emoji-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; max-height: 165px; overflow-y: auto; }
        .emoji-grid::-webkit-scrollbar { width: 3px; }
        .emoji-grid::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 2px; }
        .emoji-item { background: none; border: none; font-size: 17px; cursor: pointer; padding: 3px; border-radius: 5px; transition: all 0.12s; display: flex; align-items: center; justify-content: center; }
        .emoji-item:hover { background: rgba(255,255,255,0.09); transform: scale(1.25); }

        .input-row { display: flex; gap: 8px; align-items: center; background: #111120; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 8px 8px 8px 14px; transition: border-color 200ms, box-shadow 200ms; }
        .input-row:focus-within { border-color: rgba(99,102,241,0.5); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }

        .emoji-btn { background: none; border: none; color: #475569; width: 32px; height: 32px; border-radius: 9px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.2s; flex-shrink: 0; }
        .emoji-btn:hover { color: #818cf8; background: rgba(255,255,255,0.06); animation: wobble 0.4s ease; }
        .emoji-btn.active { background: rgba(99,102,241,0.28); color: #818cf8; }

        .img-upload-btn { background: none; border: none; color: #475569; width: 32px; height: 32px; border-radius: 9px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.2s; flex-shrink: 0; }
        .img-upload-btn:hover { color: #818cf8; background: rgba(255,255,255,0.06); animation: iconBounce 0.4s ease; }

        .msg-input { flex: 1; background: transparent; border: none; color: #f1f5f9; font-size: 14px; outline: none; padding: 6px 0; resize: none; }
        .msg-input::placeholder { color: #334155; }
        .msg-input:disabled { opacity: 0.45; cursor: not-allowed; }

        .send-btn { width: 38px; height: 38px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; border-radius: 10px; color: white; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 200ms cubic-bezier(0.34, 1.56, 0.64, 1); flex-shrink: 0; }
        .send-btn:hover { transform: scale(1.08); box-shadow: 0 4px 16px rgba(99,102,241,0.5); }
        .send-btn:active { transform: scale(0.94); }
        .send-btn.pulsing { animation: sendFlash 300ms ease; }
        .send-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
        .spin-icon { animation: spin 0.9s linear infinite; }

        .msg-image-wrap { position: relative; max-width: 260px; max-height: 320px; overflow: hidden; cursor: pointer; display: block; line-height: 0; }
        .msg-image { width: 100%; max-width: 260px; max-height: 320px; object-fit: cover; display: block; border-radius: inherit; }
        .msg-image-wrap::after {
          content: '🔍';
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; color: white;
          background: rgba(0,0,0,0.35);
          opacity: 0; transition: opacity 200ms ease;
        }
        .msg-image-wrap:hover::after { opacity: 1; }
        .msg-row.mine .msg-bubble:has(.msg-image-wrap) { padding: 0; overflow: hidden; }
        .msg-row.theirs .msg-bubble:has(.msg-image-wrap) { padding: 0; overflow: hidden; }

        .lightbox-overlay {
          position: fixed; inset: 0; z-index: 999999;
          background: rgba(0,0,0,0.88);
          display: flex; align-items: center; justify-content: center;
          animation: lightboxFadeIn 200ms ease;
          cursor: zoom-out;
          padding: 24px;
        }
        .lightbox-img { max-width: 92vw; max-height: 92vh; border-radius: 8px; animation: lightboxZoomIn 200ms ease; box-shadow: 0 20px 60px rgba(0,0,0,0.6); cursor: default; }
        .lightbox-close { position: absolute; top: 20px; right: 24px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; width: 38px; height: 38px; border-radius: 50%; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .lightbox-close:hover { background: rgba(255,255,255,0.2); }

        .file-msg { display: flex; align-items: center; gap: 9px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.13); border-radius: 9px; padding: 9px 13px; cursor: pointer; transition: all 0.18s; min-width: 170px; }
        .file-msg:hover { background: rgba(255,255,255,0.13); }
        .file-msg-icon { font-size: 26px; flex-shrink: 0; }
        .file-msg-info { flex: 1; overflow: hidden; }
        .file-msg-name { font-size: 12px; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .file-msg-action { font-size: 10px; color: rgba(255,255,255,0.38); margin-top: 1px; }

        .no-results { text-align: center; padding: 38px; color: rgba(255,255,255,0.28); font-size: 13px; }

        .drag-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(99,102,241,0.18); border: 3px dashed #6366f1; z-index: 9999; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 14px; backdrop-filter: blur(4px); }
        .drag-overlay-icon { font-size: 56px; }
        .drag-overlay-text { font-size: 20px; font-weight: 700; color: white; }
        .drag-overlay-sub { font-size: 12px; color: rgba(255,255,255,0.55); }

        /* ===== PROFILE SETTINGS MODAL — two-panel redesign ===== */
        .profile-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.72); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
        .profile-modal {
          background: #111120;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          box-shadow: 0 32px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(99,102,241,0.08);
          width: 680px; max-width: 90vw;
          max-height: 90vh; overflow-y: auto;
          animation: modalSpringIn 280ms cubic-bezier(0.34,1.56,0.64,1);
        }
        .pm-header {
          height: 56px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 24px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .pm-header-left { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; color: #f1f5f9; }
        .pm-header-icon { color: #6366f1; }
        .pm-close-btn {
          width: 32px; height: 32px; border-radius: 50%;
          background: none; border: none; color: #475569; font-size: 18px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .pm-close-btn:hover { background: rgba(255,255,255,0.08); color: #f1f5f9; }

        .pm-body { padding: 24px; display: grid; grid-template-columns: 200px 1fr; gap: 24px; }

        .pm-left-panel {
          background: rgba(99,102,241,0.04);
          border: 1px solid rgba(99,102,241,0.1);
          border-radius: 14px;
          padding: 24px 16px;
          display: flex; flex-direction: column; align-items: center; gap: 16px;
        }
        .pm-avatar-wrap {
          width: 88px; height: 88px; border-radius: 50%;
          border: 2.5px solid rgba(99,102,241,0.5);
          box-shadow: 0 0 20px rgba(99,102,241,0.2);
          cursor: pointer; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          font-size: 30px; font-weight: 700; color: white;
          transition: all 200ms;
          position: relative;
        }
        .pm-avatar-wrap:hover { border-color: #6366f1; transform: scale(1.03); }
        .pm-avatar-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .pm-edit-label {
          font-size: 11px; color: #6366f1; text-transform: uppercase; letter-spacing: 0.08em;
          cursor: pointer; transition: color 0.15s;
        }
        .pm-edit-label:hover { color: #818cf8; }
        .pm-divider { height: 1px; width: 100%; background: rgba(255,255,255,0.06); }
        .pm-color-label { font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; align-self: flex-start; }
        .pm-color-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .pm-color-btn {
          width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
          border: none; transition: all 0.2s;
        }
        .pm-color-btn:hover { transform: scale(1.3); box-shadow: 0 0 10px 3px currentColor; }
        .pm-color-btn.selected { outline: 2px solid white; outline-offset: 2px; }

        .pm-right-panel { display: flex; flex-direction: column; gap: 0; min-width: 0; }
        .pm-section-label { font-size: 10px; color: #334155; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 8px; }
        .pm-spacer { height: 20px; }
        .pm-field-label { font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; display: block; }
        .pm-input {
          width: 100%; background: #0d0d1a; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; color: #f1f5f9; padding: 10px 14px; font-size: 14px;
          outline: none; margin-bottom: 12px; transition: all 200ms;
          font-family: 'Segoe UI', sans-serif;
        }
        .pm-input:focus { border-color: rgba(99,102,241,0.6); box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
        .pm-input::placeholder { color: rgba(255,255,255,0.2); }
        .pm-input:disabled { opacity: 0.45; cursor: not-allowed; }

        .pm-footer {
          height: 64px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 24px;
          border-top: 1px solid rgba(255,255,255,0.06);
          background: rgba(0,0,0,0.2);
        }
        .pm-footer-note { font-size: 12px; color: #334155; }
        .pm-save-btn {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          padding: 10px 28px; border-radius: 10px; border: none;
          color: white; font-weight: 600; font-size: 14px; cursor: pointer;
          transition: all 200ms;
          display: inline-flex; align-items: center; gap: 6px;
        }
        .pm-save-btn:hover { filter: brightness(1.1); box-shadow: 0 6px 20px rgba(99,102,241,0.4); transform: scale(1.02); }
        .pm-save-btn:active { transform: scale(0.98); }
        .pm-save-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
        .pm-msg { text-align: center; font-size: 12px; padding: 0 24px 16px; color: rgba(255,255,255,0.65); }

        /* ===== AVATAR CROP MODAL ===== */
        .crop-overlay {
          position: fixed; inset: 0; z-index: 10050;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          animation: fadeIn 200ms ease;
        }
        .crop-card {
          background: #111120;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 24px;
          max-width: 340px; width: 90vw;
          display: flex; flex-direction: column; align-items: center; gap: 14px;
          animation: modalSpringIn 280ms cubic-bezier(0.34,1.56,0.64,1);
        }
        .crop-title { font-size: 16px; font-weight: 700; color: #f1f5f9; }
        .crop-subtitle { font-size: 12px; color: #94a3b8; margin-top: -8px; text-align: center; }
        .crop-viewport {
          width: 200px; height: 200px; border-radius: 50%;
          background: #1c1c32;
          border: 2px dashed rgba(99,102,241,0.8);
          overflow: hidden; position: relative;
          cursor: grab; touch-action: none;
        }
        .crop-viewport.dragging { cursor: grabbing; }
        .crop-viewport img { position: absolute; top: 50%; left: 50%; max-width: none; user-select: none; -webkit-user-drag: none; pointer-events: none; }
        .crop-zoom-row { width: 100%; display: flex; align-items: center; gap: 10px; }
        .crop-zoom-slider { flex: 1; accent-color: #6366f1; }
        .crop-zoom-value { font-size: 12px; color: #94a3b8; min-width: 32px; text-align: right; }
        .crop-actions { width: 100%; display: flex; gap: 10px; margin-top: 4px; }
        .crop-cancel-btn {
          flex: 1; background: transparent; border: 1px solid rgba(255,255,255,0.15);
          color: #94a3b8; padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
        }
        .crop-cancel-btn:hover { border-color: rgba(255,255,255,0.35); color: #f1f5f9; }
        .crop-apply-btn {
          flex: 1; background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none;
          color: white; padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 700;
          cursor: pointer; transition: all 0.2s;
        }
        .crop-apply-btn:hover { box-shadow: 0 0 16px rgba(99,102,241,0.5); }

        /* ===== HEADER BELL UNREAD DOT ===== */
        .header-btn-dot {
          position: absolute; top: 4px; right: 4px;
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--destructive);
          box-shadow: 0 0 0 2px #0d0d1a;
        }
        .header-btn { position: relative; }

        /* ===== CONVERSATION OVERFLOW MENU (mute toggle) ===== */
        .convo-menu-dropdown {
          position: absolute; top: calc(100% + 8px); right: 0;
          width: 200px; z-index: 60;
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: 12px; box-shadow: 0 16px 40px rgba(0,0,0,0.5);
          overflow: hidden; padding: 4px;
        }
        .convo-menu-item {
          width: 100%; display: flex; align-items: center; gap: 9px;
          background: none; border: none; color: var(--foreground);
          font-size: 13px; padding: 9px 10px; border-radius: 8px;
          cursor: pointer; text-align: left; transition: background 120ms;
        }
        .convo-menu-item:hover { background: var(--surface-3); }

        /* ===== NOTIFICATION POPOVER ===== */
        .notif-panel {
          position: absolute; top: calc(100% + 8px); right: 0;
          width: 360px; max-width: calc(100vw - 32px);
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: 0 16px 48px rgba(0,0,0,0.5);
          z-index: 60;
          overflow: hidden;
          animation: modalSpringIn 180ms cubic-bezier(0.34,1.56,0.64,1);
        }
        .notif-panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
        }
        .notif-panel-title { font-size: 15px; font-weight: 600; color: var(--foreground); }
        .notif-panel-header-actions { display: flex; align-items: center; gap: 10px; }
        .notif-panel-gear-btn {
          width: 28px; height: 28px; border-radius: 8px;
          background: none; border: none; color: var(--muted-foreground);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 150ms;
        }
        .notif-panel-gear-btn:hover { background: var(--surface-3); color: var(--foreground); }
        .notif-panel-markread-btn {
          background: none; border: none; color: var(--accent);
          font-size: 13px; font-weight: 500; cursor: pointer; padding: 4px 0;
        }
        .notif-panel-markread-btn:hover { text-decoration: underline; }

        .notif-panel-list { max-height: 420px; overflow-y: auto; }
        .notif-panel-list::-webkit-scrollbar { width: 4px; }
        .notif-panel-list::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 3px; }

        .notif-panel-item {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 12px 16px; min-height: 44px;
          border-bottom: 1px solid var(--border);
          cursor: pointer; position: relative;
          transition: background 120ms;
        }
        .notif-panel-item:last-child { border-bottom: none; }
        .notif-panel-item:hover { background: var(--surface-3); }
        .notif-panel-item.unread { background: var(--accent-subtle); }
        .notif-panel-item.unread::before {
          content: ''; position: absolute; left: 6px; top: 20px;
          width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
        }
        .notif-panel-icon {
          width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .notif-panel-icon.type-join { background: rgba(148,163,184,0.18); color: #94a3b8; }
        .notif-panel-icon.type-message { background: rgba(99,102,241,0.18); color: #818cf8; }
        .notif-panel-icon.type-mention { background: rgba(236,72,153,0.18); color: #f472b6; }
        .notif-panel-body { flex: 1; min-width: 0; }
        .notif-panel-text { font-size: 13px; color: var(--muted-foreground); line-height: 1.4; }
        .notif-panel-text strong { color: var(--foreground); font-weight: 600; }
        .notif-panel-count { color: var(--muted-foreground); font-size: 12px; margin-left: 4px; }
        .notif-panel-preview {
          font-size: 12px; color: var(--faint-foreground); margin-top: 2px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .notif-panel-time { font-size: 11px; color: var(--faint-foreground); flex-shrink: 0; margin-top: 2px; }
        .notif-panel-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 10px; padding: 48px 20px; color: var(--muted-foreground); font-size: 13px;
        }

        @media (max-width: 767px) {
          .notif-panel {
            position: fixed; inset: auto 0 0 0; width: 100%; max-width: 100%;
            border-radius: 16px 16px 0 0;
            max-height: 70vh;
            animation: bottomSheetIn 0.3s cubic-bezier(0.16,1,0.3,1);
          }
          .notif-panel-list { max-height: calc(70vh - 56px); }
        }

        /* ===== NOTIFICATION SETTINGS DIALOG ===== */
        .settings-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          animation: fadeIn 150ms ease;
        }
        .settings-dialog {
          width: min(440px, calc(100vw - 32px));
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 32px 64px rgba(0,0,0,0.6);
          animation: modalSpringIn 180ms cubic-bezier(0.34,1.56,0.64,1);
        }
        .settings-dialog-header {
          display: flex; align-items: center; justify-content: space-between;
          padding-bottom: 16px; margin-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }
        .settings-dialog-title { display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 600; color: var(--foreground); }
        .settings-dialog-close-btn {
          width: 36px; height: 36px; border-radius: 50%;
          background: none; border: none; color: var(--muted-foreground);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 150ms;
        }
        .settings-dialog-close-btn:hover { background: var(--surface-3); color: var(--foreground); }
        .settings-dialog-body { display: flex; flex-direction: column; gap: 16px; }
        .settings-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .settings-row-label { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--foreground); }
        .settings-dialog-footer {
          display: flex; justify-content: flex-end;
          margin-top: 20px; padding-top: 16px;
          border-top: 1px solid var(--border);
        }
        .settings-done-btn {
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white; border: none; padding: 9px 22px;
          border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer;
          transition: all 150ms;
        }
        .settings-done-btn:hover { filter: brightness(1.08); }

        /* ===== TOGGLE SWITCH ===== */
        .toggle-switch {
          width: 44px; height: 24px; border-radius: 12px;
          background: var(--surface-4); border: none; cursor: pointer;
          position: relative; flex-shrink: 0;
          transition: background 180ms ease;
        }
        .toggle-switch.on { background: linear-gradient(135deg, var(--accent), var(--accent-2)); }
        .toggle-switch-thumb {
          position: absolute; top: 2px; left: 2px;
          width: 20px; height: 20px; border-radius: 50%;
          background: white;
          transition: transform 180ms ease;
        }
        .toggle-switch.on .toggle-switch-thumb { transform: translateX(20px); }
        .toggle-switch:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

        /* ===== SEGMENTED CONTROL (Notify me about) ===== */
        .segmented-control {
          position: relative;
          display: flex;
          background: var(--surface-3);
          border-radius: 10px;
          padding: 3px;
        }
        .segmented-indicator {
          position: absolute; top: 3px; left: 3px;
          width: calc(33.333% - 2px); height: calc(100% - 6px);
          border-radius: 8px;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          transition: transform 150ms ease-out;
        }
        .segmented-option {
          flex: 1; position: relative; z-index: 1;
          text-align: center; padding: 8px 4px;
          font-size: 12.5px; font-weight: 600;
          color: var(--muted-foreground); cursor: pointer;
          border-radius: 8px; transition: color 150ms ease;
        }
        .segmented-option.active { color: white; }
        .segmented-option input {
          position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none;
        }
        .segmented-option input:focus-visible ~ * ,
        .segmented-option:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }

        .lock-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.82); z-index: 99999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(7px); }
        .lock-modal { background: rgba(12,12,32,0.99); border: 1px solid rgba(255,215,0,0.18); border-radius: 18px; padding: 26px; width: 340px; max-width: 92vw; text-align: center; }
        .lock-icon { font-size: 48px; margin-bottom: 10px; }
        .lock-title { font-size: 17px; font-weight: 700; color: white; margin-bottom: 5px; }
        .lock-sub { font-size: 12px; color: rgba(255,255,255,0.38); margin-bottom: 18px; }
        .lock-input { width: 100%; background: rgba(255,255,255,0.07); border: 1.5px solid rgba(255,215,0,0.28); border-radius: 9px; color: white; font-size: 14px; padding: 10px 13px; outline: none; text-align: center; letter-spacing: 4px; font-family: monospace; margin-bottom: 12px; }
        .lock-input:focus { border-color: rgba(255,215,0,0.55); }
        .lock-btn { width: 100%; padding: 11px; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; margin-bottom: 7px; transition: all 0.18s; }
        .lock-btn-primary { background: linear-gradient(135deg, #f59e0b, #b45309); color: white; }
        .lock-btn-cancel { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.55); border: 1px solid rgba(255,255,255,0.11) !important; }

        @media (max-width: 768px) {
          .chat-layout { flex-direction: row; }

          .sidebar-logo { padding: 18px 18px 14px !important; }
          .logo-emoji { font-size: 21px !important; }
          .logo-name { font-size: 16px !important; }
          .sidebar-section-title { padding: 14px 18px 6px !important; }
          .channel-item { margin: 2px 10px !important; padding: 11px 12px !important; }
          .dm-item { margin: 2px 10px !important; padding: 11px 12px !important; }
          .dm-avatar { width: 44px !important; height: 44px !important; font-size: 16px !important; }

          .sidebar-user { padding: 12px 16px !important; }
          .user-avatar { width: 34px !important; height: 34px !important; font-size: 14px !important; }
          .user-name { font-size: 13px !important; }
          .user-status { display: block !important; }
          .icon-btn { width: 30px !important; height: 30px !important; font-size: 14px !important; }

          .chat-header { padding: 12px 14px !important; gap: 10px !important; }
          .chat-header-avatar { width: 34px !important; height: 34px !important; font-size: 14px !important; border-radius: 8px !important; }
          .chat-header-name { font-size: 14px !important; }
          .chat-header-status { font-size: 10px !important; }
          .msg-count { display: none !important; }
          .header-btn { width: 28px !important; height: 28px !important; font-size: 13px !important; }

          .messages-area { padding: 10px 0 !important; }
          .thread-container { padding-inline: 10px !important; }
          .msg-row, .msg-row.mine, .msg-row.theirs { max-width: 85% !important; }
          .msg-bubble { font-size: 13px !important; padding: 8px 12px !important; }
          .msg-image, .msg-image-wrap { max-width: 200px !important; }
          .msg-avatar, .msg-avatar-spacer { width: 26px !important; height: 26px !important; font-size: 10px !important; }

          .input-area { padding: 8px 10px 10px !important; }
          .input-row { padding: 3px 3px 3px 10px !important; gap: 6px !important; }
          .emoji-btn { width: 28px !important; height: 28px !important; font-size: 15px !important; }
          .img-upload-btn { width: 28px !important; height: 28px !important; font-size: 15px !important; }
          .send-btn { width: 34px !important; height: 34px !important; font-size: 15px !important; }

          .emoji-picker-popup { width: calc(100vw - 20px) !important; left: 10px !important; bottom: 65px !important; }
          .connection-banner { font-size: 11px !important; padding: 7px 10px !important; }
          .lock-modal { width: 90vw !important; padding: 20px !important; }

          .profile-overlay { align-items: flex-end !important; }
          .profile-modal {
            width: 100vw !important; max-width: 100vw !important;
            max-height: 92vh !important;
            border-radius: 20px 20px 0 0 !important;
            animation: bottomSheetIn 0.3s cubic-bezier(0.16,1,0.3,1) !important;
            position: relative;
          }
          .profile-modal::before {
            content: '';
            display: block;
            width: 32px; height: 4px;
            background: rgba(255,255,255,0.2);
            border-radius: 2px;
            margin: 8px auto;
          }
          .pm-body { grid-template-columns: 1fr !important; padding: 16px !important; }
          .pm-left-panel { flex-direction: row !important; align-items: center !important; padding: 14px !important; }
          .pm-color-grid { margin-left: auto; }
          .pm-edit-label { display: none; }
          .online-dot { width: 9px !important; height: 9px !important; }

          .send-btn { min-width: 44px !important; min-height: 44px !important; }
          .dm-item, .channel-item { min-height: 44px; }
        }
      `}</style>

      {isReconnecting && (
        <div className="connection-banner reconnecting">
          <div className="reconnect-spinner"></div>
          <span>Reconnecting to server... Please wait</span>
        </div>
      )}
      {showConnected && !isReconnecting && (
        <div className="connection-banner connected">
          <div className="reconnect-dot"></div>
          <span>✅ Connected successfully!</span>
        </div>
      )}

      {isDragging && (
        <div className="drag-overlay">
          <span className="drag-overlay-icon">📸</span>
          <div className="drag-overlay-text">Drop to send</div>
          <div className="drag-overlay-sub">Images, PDFs, Docs, ZIP</div>
        </div>
      )}

      {/* ===== TOASTS — inactive-conversation message previews, max 3 stacked, auto-dismiss 5s ===== */}
      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.map(t => (
            <div key={t.id} className="toast-item" onClick={() => { t.target(); setToasts(prev => prev.filter(x => x.id !== t.id)); }}>
              <div className="toast-avatar">{getInitial(t.sender)}</div>
              <div className="toast-body">
                <div className="toast-sender">{t.sender}</div>
                <div className="toast-preview">{t.preview}</div>
              </div>
              <button className="toast-close" onClick={(e) => { e.stopPropagation(); setToasts(prev => prev.filter(x => x.id !== t.id)); }}><XIcon size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {/* ===== BROWSER NOTIFICATION PERMISSION BANNER — shown once, on first send ===== */}
      {showPermissionBanner && (
        <div className="permission-banner">
          <BellIcon size={16} />
          <span>Enable desktop notifications for new messages?</span>
          <button className="permission-btn-enable" onClick={enableDesktopNotifs}>Enable</button>
          <button className="permission-btn-dismiss" onClick={() => setShowPermissionBanner(false)}><XIcon size={14} /></button>
        </div>
      )}

      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <button className="lightbox-close" onClick={() => setLightboxImage(null)}>✕</button>
          <img src={lightboxImage} alt="" className="lightbox-img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {showLockModal === 'verify' && (
        <div className="lock-overlay">
          <div className="lock-modal">
            <div className="lock-icon"><LockIcon size={40} /></div>
            <div className="lock-title">This chat is locked</div>
            <div className="lock-sub">Enter password to open chat with {activeDMUser}</div>
            <input className="lock-input" type="password" placeholder="••••••••"
              value={lockVerifyPassword} onChange={(e) => setLockVerifyPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && verifyLock()} />
            <button className="lock-btn lock-btn-primary" onClick={verifyLock}><LockOpenIcon size={15} /> Unlock</button>
            <button className="lock-btn lock-btn-cancel" onClick={() => { setShowLockModal(false); setActiveDMUser(null); setActiveRoom(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {showLockModal === 'set' && (
        <div className="lock-overlay">
          <div className="lock-modal">
            <div className="lock-icon"><LockIcon size={40} /></div>
            <div className="lock-title">Lock this chat</div>
            <div className="lock-sub">Set a password for your chat with {activeDMUser}</div>
            <input className="lock-input" type="password" placeholder="Enter password"
              value={lockPassword} onChange={(e) => setLockPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setLock()} />
            <button className="lock-btn lock-btn-primary" onClick={setLock}><LockIcon size={15} /> Set Lock</button>
            <button className="lock-btn lock-btn-cancel" onClick={() => setShowLockModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {showProfile && (
        <div className="profile-overlay" onClick={(e) => e.target === e.currentTarget && setShowProfile(false)}>
          <div className="profile-modal">
            <div className="pm-header">
              <div className="pm-header-left">
                <span className="pm-header-icon"><SettingsIcon size={16} /></span>
                <span>Profile Settings</span>
              </div>
              <button className="pm-close-btn" onClick={() => setShowProfile(false)}><XIcon size={16} /></button>
            </div>

            <div className="pm-body">
              <div className="pm-left-panel">
                <div className="pm-avatar-wrap"
                  style={{ background: profileEdit.avatar_color }}
                  onClick={() => document.getElementById('avatar-upload').click()}>
                  {profileEdit.avatar_url
                    ? <img src={profileEdit.avatar_url} alt="" />
                    : getInitial(username)}
                </div>
                <div className="pm-edit-label" onClick={() => document.getElementById('avatar-upload').click()}>Edit Photo</div>
                <input id="avatar-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFileSelect} />

                <div className="pm-divider" />
                <div className="pm-color-label">AVATAR COLOR</div>
                <div className="pm-color-grid">
                  {AVATAR_COLORS.map(color => (
                    <button key={color} type="button" className={`pm-color-btn ${profileEdit.avatar_color === color ? 'selected' : ''}`}
                      style={{ background: color, color }} onClick={() => setProfileEdit(prev => ({ ...prev, avatar_color: color }))} />
                  ))}
                </div>
              </div>

              <div className="pm-right-panel">
                <div className="pm-section-label">IDENTITY</div>
                <label className="pm-field-label">Username</label>
                <input className="pm-input" value={username} disabled />
                <label className="pm-field-label">Bio / Status</label>
                <input className="pm-input" placeholder="Tell something about yourself..."
                  value={profileEdit.bio} onChange={(e) => setProfileEdit(prev => ({ ...prev, bio: e.target.value }))} maxLength={100} />

                <div className="pm-spacer" />

                <div className="pm-section-label">SECURITY</div>
                <label className="pm-field-label">Current Password</label>
                <input className="pm-input" type="password" placeholder="Enter current password"
                  value={profileEdit.current_password} onChange={(e) => setProfileEdit(prev => ({ ...prev, current_password: e.target.value }))} />
                <label className="pm-field-label">New Password</label>
                <input className="pm-input" type="password" placeholder="Enter new password"
                  value={profileEdit.new_password} onChange={(e) => setProfileEdit(prev => ({ ...prev, new_password: e.target.value }))} />
              </div>
            </div>

            <div className="pm-footer">
              <span className="pm-footer-note">Changes save to your account</span>
              <button className="pm-save-btn" onClick={saveProfile} disabled={profileSaving}>
                {profileSaving ? 'Saving...' : (<><SaveIcon size={15} /> Save Changes</>)}
              </button>
            </div>
            {profileMsg && <div className="pm-msg">{profileMsg}</div>}
          </div>
        </div>
      )}

      {cropModalOpen && (
        <div className="crop-overlay">
          <div className="crop-card">
            <div className="crop-title">Set Profile Photo</div>
            <div className="crop-subtitle">Drag to reposition · Scroll to zoom</div>

            <div
              className={`crop-viewport ${cropDragging ? 'dragging' : ''}`}
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              onPointerCancel={handleCropPointerUp}
              onWheel={handleCropWheel}
            >
              {cropImageSrc && (
                <img
                  src={cropImageSrc}
                  alt=""
                  onLoad={handleCropImageLoad}
                  draggable={false}
                  style={(() => {
                    if (!cropNaturalSize.width || !cropNaturalSize.height) {
                      return { transform: 'translate(-50%, -50%)', opacity: 0 };
                    }
                    const baseScale = Math.max(CROP_VIEWPORT / cropNaturalSize.width, CROP_VIEWPORT / cropNaturalSize.height);
                    const scale = baseScale * cropZoom;
                    return {
                      width: `${cropNaturalSize.width * scale}px`,
                      height: `${cropNaturalSize.height * scale}px`,
                      transform: `translate(calc(-50% + ${cropPosition.x}px), calc(-50% + ${cropPosition.y}px))`,
                    };
                  })()}
                />
              )}
            </div>

            <div className="crop-zoom-row">
              <input
                type="range" className="crop-zoom-slider"
                min={CROP_ZOOM_MIN} max={CROP_ZOOM_MAX} step={0.1}
                value={cropZoom} onChange={handleCropZoomSlider}
              />
              <span className="crop-zoom-value">{cropZoom.toFixed(1)}x</span>
            </div>

            <div className="crop-actions">
              <button className="crop-cancel-btn" onClick={cancelCrop}>Cancel</button>
              <button className="crop-apply-btn" onClick={applyCropPhoto} disabled={!cropNaturalSize.width}>Apply Photo</button>
            </div>
          </div>
        </div>
      )}

      {showSettingsPanel && (
        <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && setShowSettingsPanel(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowSettingsPanel(false); }}>
          <div className="settings-dialog" role="dialog" aria-label="Notification Settings">
            <div className="settings-dialog-header">
              <div className="settings-dialog-title"><SettingsIcon size={17} /><span>Notification Settings</span></div>
              <button className="settings-dialog-close-btn" onClick={() => setShowSettingsPanel(false)} aria-label="Close"><XIcon size={18} /></button>
            </div>

            <div className="settings-dialog-body">
              <div className="settings-row">
                <div className="settings-row-label"><BellIcon size={16} /> Desktop notifications</div>
                <button className={`toggle-switch ${notifSettings.desktop ? 'on' : ''}`} role="switch" aria-checked={notifSettings.desktop}
                  onClick={() => setNotifSettings(prev => ({ ...prev, desktop: !prev.desktop }))}><span className="toggle-switch-thumb" /></button>
              </div>

              <div className="settings-row">
                <div className="settings-row-label"><Volume2Icon size={16} /> Sound</div>
                <button className={`toggle-switch ${notifSettings.sound ? 'on' : ''}`} role="switch" aria-checked={notifSettings.sound}
                  onClick={() => setNotifSettings(prev => ({ ...prev, sound: !prev.sound }))}><span className="toggle-switch-thumb" /></button>
              </div>

              <div className="settings-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '8px' }}>
                <div className="settings-row-label">Notify me about</div>
                <div className="segmented-control" style={{ width: '100%' }}>
                  <div className="segmented-indicator" style={{ transform: `translateX(${['all', 'mentions', 'none'].indexOf(notifSettings.notifyFor) * 100}%)` }}></div>
                  {[['all', 'All messages'], ['mentions', 'Mentions only'], ['none', 'Nothing']].map(([val, label]) => (
                    <label key={val} className={`segmented-option ${notifSettings.notifyFor === val ? 'active' : ''}`}>
                      <input type="radio" name="notifyFor" value={val} checked={notifSettings.notifyFor === val}
                        onChange={() => setNotifSettings(prev => ({ ...prev, notifyFor: val }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {currentRoomId && (
                <div className="settings-row">
                  <div className="settings-row-label">
                    {mutedRooms[currentRoomId] ? <VolumeXIcon size={16} /> : <Volume2Icon size={16} />} Mute this conversation
                  </div>
                  <button className={`toggle-switch ${mutedRooms[currentRoomId] ? 'on' : ''}`} role="switch" aria-checked={!!mutedRooms[currentRoomId]}
                    onClick={() => setMutedRooms(prev => ({ ...prev, [currentRoomId]: !prev[currentRoomId] }))}><span className="toggle-switch-thumb" /></button>
                </div>
              )}
            </div>

            <div className="settings-dialog-footer">
              <button className="settings-done-btn" onClick={() => setShowSettingsPanel(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      <div className="chat-layout">
        {isMobile && sidebarOpen && (
          <div className="mobile-drawer-overlay" onClick={() => setSidebarOpen(false)}></div>
        )}

        {isMobile && !sidebarOpen && (
          <div
            className="mobile-edge-grab"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          ></div>
        )}

        <div
          className={`sidebar ${isTablet ? 'sidebar-rail' : ''}`}
          ref={sidebarRef}
          style={sidebarDynamicStyle}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="sidebar-logo">
            <div className="logo-row">
              <span className="brand-mark"><HashIcon size={16} /></span>
              <span className="logo-name">Nalantamil</span>
            </div>
          </div>

          <div className="sidebar-search-wrap">
            <span className="sidebar-search-icon"><SearchIcon size={16} /></span>
            <input
              className="sidebar-search-input"
              placeholder="Search"
              value={sidebarSearchQuery}
              onChange={(e) => setSidebarSearchQuery(e.target.value)}
            />
          </div>

          <div className="sidebar-section-title">
            <span>Channels</span>
          </div>
          <div className={`channel-item ${activeRoom === 'general' ? 'active' : ''}`}
            title="general"
            onClick={() => { setActiveRoom('general'); setActiveDMUser(null); setUnreadBoundaryCount(prev => ({ ...prev, general: unreadCount })); setUnreadCount(0); }}>
            <span className="channel-icon"><HashIcon size={16} /></span>
            <div className="channel-info">
              <div className="channel-name"># general</div>
              <div className="channel-sub">Everyone is here</div>
            </div>
            {unreadCount > 0 && (activeRoom !== 'general' || !isTabFocused)
              ? <div className="channel-badge">{unreadCount}</div>
              : <div className="online-dot"></div>}
          </div>

          <div className="sidebar-section-title">
            <span>
              Direct Messages
              {totalUnreadDMs > 0 && (
                <span style={{ marginLeft: '6px', background: '#ef4444', color: 'white', fontSize: '9px', padding: '1px 5px', borderRadius: '9px' }}>{totalUnreadDMs}</span>
              )}
            </span>
          </div>

          {displayedSidebarUsers.map(user => {
            const roomId = getDMRoomId(username, user.username);
            const unread = unreadDMs[roomId] || 0;
            const isLocked = chatLocks[roomId]?.locked;
            const lastTs = dmLastMessage[roomId] || 0;
            const lastPreview = getLastMsgPreview(roomId);
            return (
              <div key={user.username}
                className={`dm-item ${activeDMUser === user.username && activeRoom === 'dm' ? 'active' : ''}`}
                title={user.username}
                onClick={() => openDM(user.username)}>
                <div className="dm-avatar" style={{ background: user.avatar_color || '#667eea' }}>
                  {user.avatar_url
                    ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : getInitial(user.username)}
                  <div className="online-dot-wrap"><span className="online-dot"></span></div>
                </div>
                <div className="dm-info">
                  <div className="dm-name-row">
                    <div className="dm-name">{user.username}</div>
                    {lastTs > 0 && <div className={`dm-time ${unread > 0 ? 'unread' : ''}`}>{formatLastMsgTime(lastTs)}</div>}
                  </div>
                  <div className="dm-preview-row">
                    <div className="dm-preview">
                      {lastPreview || 'Click to chat'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      {isLocked && <span className="dm-lock-icon"><LockIcon size={11} /></span>}
                      {unread > 0 && (
                        <div style={{ background: '#10b981', color: 'white', fontSize: '10px', fontWeight: '800', minWidth: '18px', height: '18px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxShadow: '0 0 6px rgba(16,185,129,0.6)' }}>
                          {unread}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="sidebar-spacer"></div>
          <div className="sidebar-user">
            <div className="user-avatar" style={{ background: profile.avatar_color, overflow: 'hidden', padding: 0 }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : getInitial(username)}
            </div>
            <div className="user-info">
              <div className="user-name">{username}</div>
              <div className="user-status">{profile.bio || '● Online'}</div>
            </div>
            <button className="icon-btn profile-icon-btn ripple-btn" title="Profile settings" onClick={() => setShowProfile(true)}><SettingsIcon size={16} /></button>
            <button className="icon-btn logout-icon-btn ripple-btn" title="Log out" onClick={handleLogoutClick}><LogOutIcon size={16} /></button>
          </div>
        </div>

        <div className="chat-main" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onPaste={handlePaste}>
          {activeRoom === null ? (
            <>
              {isMobile && (
                <div className="chat-header">
                  <button
                    className={`mobile-menu-btn ripple-btn ${sidebarOpen ? 'open' : ''}`}
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
                  >
                    <span className="mobile-menu-bars"><span></span><span></span><span></span></span>
                  </button>
                  <div className="chat-header-info">
                    <div className="chat-header-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="brand-mark"><HashIcon size={14} /></span> Nalantamil
                    </div>
                  </div>
                </div>
              )}
              <div className="welcome-screen">
                <div className="welcome-icon-circle"><MessageCircleIcon size={44} /></div>
                <div className="welcome-title">Nalantamil Web</div>
                <div className="welcome-sub">Select a channel or a person from the list to start chatting. Your messages sync in real time.</div>
                <div className="welcome-note"><LockIcon size={13} /> Private chats can be locked with a password.</div>
              </div>
            </>
          ) : (
            <>
              <div className="chat-header">
                <button className="mobile-back-btn ripple-btn" onClick={backToList} aria-label="Back to chat list">
                  <ChevronLeftIcon size={18} />
                </button>
                {isMobile && (
                  <button
                    className={`mobile-menu-btn ripple-btn ${sidebarOpen ? 'open' : ''}`}
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
                  >
                    <span className="mobile-menu-bars"><span></span><span></span><span></span></span>
                  </button>
                )}
                <div className="chat-header-avatar">
                  {activeRoom === 'general' ? <HashIcon size={18} /> : (() => {
                    const dmUser = allUsers.find(u => u.username === activeDMUser);
                    return dmUser?.avatar_url
                      ? <img src={dmUser.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '9px' }} />
                      : getInitial(activeDMUser || '');
                  })()}
                </div>
                <div className="chat-header-info">
                  <div className="chat-header-name">
                    {activeRoom === 'general' ? 'general' : activeDMUser}
                  </div>
                  <div className="chat-header-status">
                    <span className="status-dot" style={{ background: isConnected ? '#10b981' : '#ef4444' }}></span>
                    {isConnected ? (activeRoom === 'general' ? <><GlobeIcon size={12} /> Group Chat — Everyone online</> : `Private chat`) : 'Connecting...'}
                  </div>
                </div>
                <div className="msg-count">{currentMessages.filter(m => m.type !== 'system').length} msgs</div>

                {activeRoom === 'dm' && (
                  <button className="header-btn ripple-btn"
                    onClick={() => {
                      const lock = chatLocks[currentRoomId];
                      if (lock?.locked && lock.set_by === username) {
                        if (window.confirm('Remove lock from this chat?')) removeLock();
                      } else if (!lock?.locked) {
                        setShowLockModal('set');
                      }
                    }}
                    title={chatLocks[currentRoomId]?.locked ? 'Locked' : 'Lock Chat'}>
                    {chatLocks[currentRoomId]?.locked ? <LockIcon size={16} /> : <LockOpenIcon size={16} />}
                  </button>
                )}

                <button className={`header-btn ripple-btn ${showSearch ? 'active' : ''}`} title="Search messages"
                  onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); }}><SearchIcon size={16} /></button>
                {activeRoom === 'general' && (
                  <button className={`header-btn ripple-btn ${showPinned ? 'active' : ''}`} title="Pinned messages"
                    onClick={() => setShowPinned(!showPinned)}><PinIcon size={16} /></button>
                )}
                <button className="header-btn ripple-btn" title="Background" onClick={() => setShowBgPicker(!showBgPicker)}><PaletteIcon size={16} /></button>

                <div style={{ position: 'relative' }}>
                  <button ref={notifBellBtnRef} className={`header-btn ripple-btn ${showNotifCenter ? 'active' : ''}`} title="Notifications"
                    aria-haspopup="true" aria-expanded={showNotifCenter}
                    onClick={() => setShowNotifCenter(!showNotifCenter)}>
                    <BellIcon size={16} />
                    {notifCenterItems.some(n => !n.read) && <span className="header-btn-dot"></span>}
                  </button>

                  {showNotifCenter && (
                    <div className="notif-panel" ref={notifPanelRef} role="dialog" aria-label="Notifications">
                      <div className="notif-panel-header">
                        <span className="notif-panel-title">Notifications</span>
                        <div className="notif-panel-header-actions">
                          <button className="notif-panel-gear-btn" title="Notification settings"
                            onClick={() => { setShowSettingsPanel(true); setShowNotifCenter(false); }}><SettingsIcon size={14} /></button>
                          <button className="notif-panel-markread-btn"
                            onClick={() => setNotifCenterItems(prev => prev.map(n => ({ ...n, read: true })))}>Mark all read</button>
                        </div>
                      </div>
                      <div className="notif-panel-list">
                        {notifCenterItems.length === 0 ? (
                          <div className="notif-panel-empty">
                            <BellOffIcon size={26} />
                            <span>You're all caught up</span>
                          </div>
                        ) : notifCenterItems.map(n => (
                          <div key={n.id} className={`notif-panel-item ${n.read ? '' : 'unread'}`}
                            onClick={() => { n.target(); setNotifCenterItems(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x)); setShowNotifCenter(false); }}>
                            <div className={`notif-panel-icon type-${n.type}`}>
                              {n.type === 'join' ? <UserPlusIcon size={15} /> : n.type === 'mention' ? <AtSignIcon size={15} /> : <MessageCircleIcon size={15} />}
                            </div>
                            <div className="notif-panel-body">
                              <div className="notif-panel-text">
                                <strong>{n.sender}</strong> <span className="notif-panel-action">{n.action}</span>
                                {n.count > 1 && <span className="notif-panel-count">×{n.count}</span>}
                              </div>
                              {n.type !== 'join' && n.preview && <div className="notif-panel-preview">{n.preview}</div>}
                            </div>
                            <div className="notif-panel-time">{formatRelativeTime(n.createdAt)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ position: 'relative' }}>
                  <button className="header-btn ripple-btn" title="More options" onClick={() => setShowConvoMenu(!showConvoMenu)}>
                    <MoreVerticalIcon size={16} />
                  </button>
                  {showConvoMenu && currentRoomId && (
                    <div className="convo-menu-dropdown">
                      <button className="convo-menu-item" onClick={() => {
                        setMutedRooms(prev => ({ ...prev, [currentRoomId]: !prev[currentRoomId] }));
                        setShowConvoMenu(false);
                      }}>
                        {mutedRooms[currentRoomId] ? <Volume2Icon size={15} /> : <VolumeXIcon size={15} />}
                        {mutedRooms[currentRoomId] ? 'Unmute conversation' : 'Mute conversation'}
                      </button>
                    </div>
                  )}
                </div>

                {showBgPicker && (
                  <div className="bg-picker-dropdown">
                    <div className="bg-picker-title">Background</div>
                    <div className="bg-options">
                      {BACKGROUNDS.map(bg => (
                        <div key={bg.id} className={`bg-option ${selectedBg.id === bg.id ? 'active' : ''}`}
                          style={{ background: bg.value }}
                          onClick={() => { setSelectedBg(bg); setShowBgPicker(false); }}>
                          {bg.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {showSearch && (
                <div className="search-bar">
                  <input ref={searchInputRef} className="search-input" placeholder="Search messages..."
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  {searchQuery && <span className="search-results-count">{filteredMessages.filter(m => m.type !== 'system').length} results</span>}
                  <button className="search-close" onClick={() => { setShowSearch(false); setSearchQuery(''); }}>✕</button>
                </div>
              )}

              {showPinned && activeRoom === 'general' && (
                <div className="pinned-panel">
                  <div className="pinned-panel-title">📌 Pinned {pinnedMessages.length > 0 && `(${pinnedMessages.length})`}</div>
                  {pinnedMessages.length === 0
                    ? <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '11px' }}>No pinned messages!</div>
                    : pinnedMessages.map((p, i) => (
                      <div key={i} className="pinned-item">
                        <span>📌</span>
                        <div className="pinned-item-content">
                          <div className="pinned-item-text">{p.text?.startsWith('__IMAGE__') ? '🖼️ Image' : p.text?.startsWith('__FILE__') ? '📎 File' : p.text}</div>
                          <div className="pinned-item-meta">by {p.username} • pinned by {p.pinned_by}</div>
                        </div>
                        <button className="unpin-btn" onClick={() => unpinMessage(p.message_id)}>✕</button>
                      </div>
                    ))
                  }
                </div>
              )}

              <div className="messages-area" ref={messagesAreaRef} onScroll={handleMessagesScroll}>
                <div className="thread-container">
                {filteredMessages.length === 0 && searchQuery ? (
                  <div className="no-results">🔍 No messages found for "<strong>{searchQuery}</strong>"</div>
                ) : filteredMessages.length === 0 ? (
                  <div className="empty-chat">
                    <span className="empty-icon">{activeRoom === 'general' ? <MessageCircleIcon size={48} /> : <LockIcon size={48} />}</span>
                    <div className="empty-title">{activeRoom === 'general' ? 'No messages yet' : `Chat with ${activeDMUser}`}</div>
                    <div className="empty-sub">{activeRoom === 'general' ? 'Be the first to say hello!' : 'Your messages are private'}</div>
                  </div>
                ) : (
                  filteredMessages.map((msg, index) => {
                    if (msg.type === 'system') return <div key={index} className="system-msg">— {msg.text} —</div>;
                    const isMine = msg.username === username;
                    const isEditing = editingId === msg._id;
                    const reactions = msg.reactions || {};
                    const showDate = shouldShowDateSeparator(filteredMessages, index);
                    const userMsgs = currentMessages.filter(m => m.type !== 'system');
                    const msgIndexInAll = userMsgs.findIndex(m => m._id === msg._id);
                    const isLastMine = isMine && msgIndexInAll === userMsgs.length - 1;

                    // ===== Grouping (presentational only) =====
                    const groupedWithPrev = isGroupedWithPrev(filteredMessages, index);
                    const groupedWithNext = isGroupedWithNext(filteredMessages, index);
                    const isFirstInGroup = !groupedWithPrev;
                    const isLastInGroup = !groupedWithNext;

                    const boundary = !searchQuery && unreadBoundaryCount[currentRoomId] > 0
                      ? filteredMessages.length - unreadBoundaryCount[currentRoomId]
                      : -1;
                    const showUnreadDivider = index === boundary && boundary > 0;

                    return (
                      <React.Fragment key={msg._id || index}>
                        {showUnreadDivider && (
                          <div className="unread-divider">
                            <span className="unread-divider-line"></span>
                            <span className="unread-divider-label">{unreadBoundaryCount[currentRoomId]} new message{unreadBoundaryCount[currentRoomId] > 1 ? 's' : ''}</span>
                            <span className="unread-divider-line"></span>
                          </div>
                        )}
                        {showDate && msg.timestamp && (
                          <div className="date-separator">
                            <div className="date-separator-line"></div>
                            <span className="date-separator-label">{getDateLabel(msg.timestamp)}</span>
                            <div className="date-separator-line"></div>
                          </div>
                        )}
                        <div className={`msg-row ${isMine ? 'mine' : 'theirs'} ${groupedWithPrev ? 'grouped' : ''}`}>
                          {isFirstInGroup ? (
                            <div className="msg-avatar" style={{ padding: 0, overflow: 'hidden' }}>
                              {isMine && profile.avatar_url
                                ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                : getInitial(msg.username)}
                            </div>
                          ) : (
                            <div className="msg-avatar-spacer"></div>
                          )}
                          <div className="msg-content">
                            {!isMine && isFirstInGroup && <span className="msg-sender">{msg.username}</span>}
                            {isEditing ? (
                              <>
                                <input className="edit-input" value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && saveEdit(msg._id)} autoFocus />
                                <div className="edit-actions">
                                  <button className="save-btn" onClick={() => saveEdit(msg._id)}>Save</button>
                                  <button className="cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="msg-bubble-wrap">
                                  <div className="msg-bubble">
                                    {msg.reply_to && (
                                      <div className="msg-reply-preview">
                                        <div className="msg-reply-name">↩️ {msg.reply_to.username}</div>
                                        <div className="msg-reply-text">
                                          {msg.reply_to.text?.startsWith('__IMAGE__') ? '🖼️ Image' : msg.reply_to.text?.startsWith('__FILE__') ? '📎 File' : msg.reply_to.text}
                                        </div>
                                      </div>
                                    )}
                                    {msg.text?.startsWith('__IMAGE__') ? (() => {
                                      const parts = msg.text.replace('__IMAGE__', '').split('__CAPTION__');
                                      return (
                                        <div>
                                          <div className="msg-image-wrap" onClick={() => setLightboxImage(parts[0])}>
                                            <img src={parts[0]} alt="" className="msg-image" />
                                          </div>
                                          {parts[1] && <p style={{ margin: '6px 10px', fontSize: '12px', color: 'inherit' }}>{parts[1]}</p>}
                                        </div>
                                      );
                                    })() : msg.text?.startsWith('__FILE__') ? (() => {
                                      const withoutPrefix = msg.text.replace('__FILE__', '');
                                      const urlPart = withoutPrefix.split('__FILENAME__')[0];
                                      const rest = withoutPrefix.split('__FILENAME__')[1] || '';
                                      const filenamePart = rest.split('__FILEICON__')[0];
                                      const iconAndCaption = rest.split('__FILEICON__')[1] || '';
                                      const icon = iconAndCaption.split('__CAPTION__')[0];
                                      const caption = iconAndCaption.split('__CAPTION__')[1];
                                      return (
                                        <div>
                                          <div className="file-msg" onClick={() => window.open(urlPart, '_blank')}>
                                            <span className="file-msg-icon">{icon || '📎'}</span>
                                            <div className="file-msg-info">
                                              <div className="file-msg-name">{filenamePart}</div>
                                              <div className="file-msg-action">Tap to open ↗️</div>
                                            </div>
                                          </div>
                                          {caption && <p style={{ marginTop: '6px', fontSize: '12px', color: 'inherit' }}>{caption}</p>}
                                        </div>
                                      );
                                    })() : searchQuery ? (
                                      msg.text?.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                                        part.toLowerCase() === searchQuery.toLowerCase()
                                          ? <span key={i} className="search-highlight">{part}</span>
                                          : part
                                      )
                                    ) : msg.text}
                                  </div>

                                  <div className="msg-actions">
                                    <button className="action-btn" title="React"
                                      onClick={() => addReaction(msg._id, REACTIONS[0])}>😄</button>
                                    <button className="action-btn"
                                      onClick={() => { setReplyingTo(msg); document.querySelector('.msg-input')?.focus(); }} title="Reply">↩</button>
                                    {isMine && (
                                      <>
                                        <button className="action-btn" onClick={() => startEdit(msg)} title="Edit">✏️</button>
                                        <button className="action-btn delete" onClick={() => deleteMessage(msg._id)} title="Delete">🗑️</button>
                                      </>
                                    )}
                                    {activeRoom === 'general' && (
                                      <button className={`action-btn ${isPinned(msg._id) ? 'pinned' : ''}`}
                                        onClick={() => isPinned(msg._id) ? unpinMessage(msg._id) : pinMessage(msg)} title="Pin">
                                        {isPinned(msg._id) ? '📌' : '📍'}
                                      </button>
                                    )}
                                    <button className="action-btn" title="More">⋯</button>
                                  </div>

                                  <div className="reaction-picker">
                                    {REACTIONS.map(emoji => (
                                      <button key={emoji} className="reaction-pick-btn"
                                        onClick={() => addReaction(msg._id, emoji)}>{emoji}</button>
                                    ))}
                                  </div>
                                </div>

                                {Object.keys(reactions).length > 0 && (
                                  <div className="reactions-bar">
                                    {Object.entries(reactions).map(([emoji, users]) =>
                                      users.length > 0 ? (
                                        <button key={emoji} className={`reaction-btn ${users.includes(username) ? 'reacted' : ''}`}
                                          onClick={() => addReaction(msg._id, emoji)}>
                                          {emoji} <span className="reaction-count">{users.length}</span>
                                        </button>
                                      ) : null
                                    )}
                                  </div>
                                )}

                                {isLastInGroup && (
                                  <div className="msg-footer">
                                    <span className="msg-time">{formatTime(msg.timestamp)}</span>
                                    {msg.edited && <span className="edited-tag">(edited)</span>}
                                    {isMine && <span className={`seen-status ${isLastMine ? '' : 'delivered'}`}>{isLastMine ? '✓✓' : '✓'}</span>}
                                    {isPinned(msg._id) && <span className="msg-pin-indicator">📌</span>}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                {typingUsers.filter(u => u !== username).length > 0 && (
                  <div className="typing-indicator">
                    <div className="typing-dots">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                    <span className="typing-text">
                      {typingUsers.filter(u => u !== username).join(', ')} {typingUsers.filter(u => u !== username).length === 1 ? 'is' : 'are'} typing...
                    </span>
                  </div>
                )}
                </div>
                <div ref={messagesEndRef} />
              </div>

              {scrolledUp && newSinceScroll > 0 && (
                <button className="jump-pill" onClick={jumpToBottom}>
                  <ChevronDownIcon size={14} /> {newSinceScroll} new message{newSinceScroll > 1 ? 's' : ''}
                </button>
              )}

              <div className="input-area">
                <div className="composer-inner">
                {replyingTo && (
                  <div className="reply-bar">
                    <div className="reply-bar-content">
                      <div className="reply-bar-name">↩️ Replying to {replyingTo.username}</div>
                      <div className="reply-bar-text">
                        {replyingTo.text?.startsWith('__IMAGE__') ? '🖼️ Image' : replyingTo.text?.startsWith('__FILE__') ? '📎 File' : replyingTo.text}
                      </div>
                    </div>
                    <button className="reply-bar-cancel" onClick={() => setReplyingTo(null)}>✕</button>
                  </div>
                )}
                {imageFile && (
                  <div className="image-preview-bar">
                    {imagePreview
                      ? <img src={imagePreview} alt="" className="preview-img" />
                      : <div style={{ width: '48px', height: '48px', background: 'rgba(99,102,241,0.18)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>{getFileIcon(imageFile)}</div>
                    }
                    <div className="preview-info">
                      <div className="preview-name">{imageFile?.name}</div>
                      <div className="preview-size">{(imageFile?.size / 1024).toFixed(1)} KB</div>
                      {uploading && <div className="upload-progress">⏳ Uploading...</div>}
                    </div>
                    <button className="preview-cancel" onClick={cancelImage}>✕</button>
                  </div>
                )}
                {showEmojiPicker && (
                  <div className="emoji-picker-popup">
                    <div className="emoji-picker-title">Pick an Emoji</div>
                    <div className="emoji-grid">
                      {EMOJI_LIST.map((emoji, i) => (
                        <button key={i} className="emoji-item"
                          onClick={() => { setInput(prev => prev + emoji); setShowEmojiPicker(false); }}>{emoji}</button>
                      ))}
                    </div>
                  </div>
                )}
                <form className="input-row" onSubmit={sendMessage}>
                  <button type="button" className={`emoji-btn ${showEmojiPicker ? 'active' : ''}`} title="Emoji" aria-label="Emoji"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}><SmileIcon size={18} /></button>
                  <button type="button" className="img-upload-btn" title="Attach image or file" aria-label="Attach image or file" onClick={() => fileInputRef.current?.click()}><CameraIcon size={18} /></button>
                  <input ref={fileInputRef} type="file"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt"
                    style={{ display: 'none' }} onChange={handleFileInput} />
                  <input
                    className="msg-input" type="text"
                    placeholder={!isConnected ? '⚠️ Reconnecting...' : imageFile ? 'Add a caption...' : activeRoom === 'general' ? 'Message #general...' : `Message ${activeDMUser}...`}
                    value={input} onChange={handleInputChange} disabled={!isConnected} />
                  <button type="submit" className={`send-btn ripple-btn ${sendPulse ? 'pulsing' : ''}`} disabled={uploading || !isConnected} aria-label="Send message">
                    {uploading ? <Loader2Icon size={18} className="spin-icon" /> : <SendIcon size={18} />}
                  </button>
                </form>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default Chat;