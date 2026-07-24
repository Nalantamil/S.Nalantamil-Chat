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

function Chat({ username, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);

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

  // ===== NARROW/MOBILE DETECTION — the single switch between "list always visible"
  // (wide browser) and "list is a drawer you open by click/drag" (narrow browser or
  // phone). Stays in sync as the window is resized/minimized. =====
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));

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

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const sidebarRef = useRef(null);
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

  useEffect(() => {
    const onFocus = () => { setIsTabFocused(true); };
    const onBlur = () => setIsTabFocused(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('blur', onBlur); };
  }, []);

  // ===== KEEP isMobile IN SYNC WITH ACTUAL VIEWPORT (resize / rotate / browser minimize) =====
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
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
    setUnreadDMs(prev => ({ ...prev, [roomId]: 0 }));
  };

  // ===== BACK TO LIST =====
  const backToList = () => {
    setActiveRoom(null);
    setActiveDMUser(null);
  };

  // ===== PREFETCH EVERY DM'S HISTORY RIGHT AFTER LOGIN =====
  // This used to only record the timestamp (for sorting) but never actually stored the
  // messages, so the "last message" preview under each name stayed on "Click to chat"
  // until you opened that DM once. Now it stores the messages too, so previews (and
  // the correct sort order) are correct immediately after login.
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

  useEffect(() => {
    axios.get('https://s-nalantamil-chat.onrender.com/messages').then(res => setMessages(res.data));
    axios.get('https://s-nalantamil-chat.onrender.com/pinned').then(res => setPinnedMessages(res.data)).catch(() => {});
    axios.get('https://s-nalantamil-chat.onrender.com/users').then(res => {
      setAllUsers(res.data.filter(u => u.username !== username));
    }).catch(() => {});
    axios.get(`https://s-nalantamil-chat.onrender.com/profile/${username}`).then(res => {
      setProfile(res.data);
      setProfileEdit({ bio: res.data.bio || '', avatar_color: res.data.avatar_color || '#667eea', avatar_url: res.data.avatar_url || '', current_password: '', new_password: '' });
    }).catch(() => {});

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
      if ((!isTabFocused || activeRoom !== 'general') && msg.username !== username) {
        setUnreadCount(prev => prev + 1);
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
      socket.off('connect'); socket.off('disconnect'); socket.off('reconnect_attempt');
      socket.off('reconnect'); socket.off('message'); socket.off('dm_message');
      socket.off('message_deleted'); socket.off('message_edited'); socket.off('reaction_updated');
      socket.off('user_typing'); socket.off('user_stop_typing');
      socket.off('message_pinned'); socket.off('message_unpinned');
    };
  }, [username, isTabFocused, activeDMUser, activeRoom, currentRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, typingUsers]);

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

  const saveProfile = async () => {
    setProfileSaving(true); setProfileMsg('');
    try {
      await axios.put(`https://s-nalantamil-chat.onrender.com/profile/${username}`, profileEdit);
      const res = await axios.get(`https://s-nalantamil-chat.onrender.com/profile/${username}`);
      setProfile(res.data);
      setProfileEdit(prev => ({ ...prev, ...res.data, current_password: '', new_password: '' }));
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

  // ===== SIDEBAR STYLE — normal always-visible panel on wide screens; a slide-out
  // overlay drawer on narrow/mobile screens. Computed in JS and applied inline so
  // nothing in the stylesheet can silently override it. =====
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
    : {
        position: 'relative',
        width: '300px',
        minWidth: '300px',
        height: '100vh',
        transform: 'none',
        opacity: 1,
      };

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }

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

        body {
          background: ${selectedBg.value};
          background-size: 400% 400%;
          animation: gradientShift 8s ease infinite;
        }

        .chat-layout { display: flex; height: 100vh; width: 100vw; font-family: 'Segoe UI', sans-serif; overflow: hidden; }

        .connection-banner { position: fixed; top: 0; left: 0; right: 0; z-index: 99999; padding: 10px 20px; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 13px; font-weight: 600; animation: slideDown 0.3s ease; }
        .connection-banner.reconnecting { background: linear-gradient(135deg, #e67e22, #d35400); color: white; }
        .connection-banner.connected { background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; }
        .reconnect-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
        .reconnect-dot { width: 8px; height: 8px; background: white; border-radius: 50%; flex-shrink: 0; }

        .sidebar {
          background: rgba(0,0,0,0.35);
          border-right: 1px solid rgba(255,255,255,0.07);
          display: flex; flex-direction: column;
          overflow-y: auto;
          touch-action: pan-y;
        }

        .sidebar-logo { padding: 20px 20px 14px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .logo-row { display: flex; align-items: center; gap: 10px; }
        .logo-emoji { font-size: 24px; filter: drop-shadow(0 0 8px rgba(102,126,234,0.9)); cursor: pointer; transition: transform 0.3s; }
        .logo-emoji:hover { transform: scale(1.2) rotate(10deg); }
        .logo-name { font-size: 19px; font-weight: 800; background: linear-gradient(135deg, #667eea, #f093fb); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: 2px; }

        .sidebar-section-title { padding: 14px 20px 6px; font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.3); letter-spacing: 1.5px; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }

        .channel-item { margin: 2px 10px; padding: 10px 12px; border-radius: 10px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s ease; }
        .channel-item:hover { background: rgba(255,255,255,0.07); }
        .channel-item.active { background: rgba(102,126,234,0.2); border: 1px solid rgba(102,126,234,0.25); }
        .channel-icon { font-size: 16px; }
        .channel-info { flex: 1; overflow: hidden; }
        .channel-name { font-size: 13px; font-weight: 600; color: white; }
        .channel-sub { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 1px; }
        .channel-badge { background: linear-gradient(135deg, #667eea, #764ba2); color: white; font-size: 10px; font-weight: 800; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0 4px; }

        .dm-item { margin: 2px 10px; padding: 10px 12px; border-radius: 10px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s ease; }
        .dm-item:hover { background: rgba(255,255,255,0.07); }
        .dm-item.active { background: rgba(102,126,234,0.2); border: 1px solid rgba(102,126,234,0.25); }

        .dm-avatar { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #f093fb, #f5576c); display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; color: white; flex-shrink: 0; overflow: hidden; }

        .dm-info { flex: 1; overflow: hidden; min-width: 0; }
        .dm-name-row { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
        .dm-name { font-size: 13px; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dm-time { font-size: 10px; color: rgba(255,255,255,0.3); flex-shrink: 0; }
        .dm-preview-row { display: flex; align-items: center; justify-content: space-between; margin-top: 2px; }
        .dm-preview { font-size: 11px; color: rgba(255,255,255,0.35); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
        .dm-lock-icon { font-size: 11px; color: rgba(255,215,0,0.5); flex-shrink: 0; margin-left: 4px; }

        .online-dot { width: 7px; height: 7px; background: #2ecc71; border-radius: 50%; box-shadow: 0 0 6px #2ecc71; animation: pulse 2s ease-in-out infinite; }

        .sidebar-spacer { flex: 1; min-height: 12px; }

        .sidebar-user { padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; gap: 8px; }
        .user-avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: white; flex-shrink: 0; overflow: hidden; padding: 0; transition: transform 0.2s; }
        .user-avatar:hover { transform: scale(1.08); }
        .user-info { flex: 1; overflow: hidden; }
        .user-name { font-size: 13px; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .user-status { font-size: 10px; color: #2ecc71; margin-top: 1px; }

        .icon-btn { width: 30px; height: 30px; border-radius: 9px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.2s; flex-shrink: 0; border: 1px solid transparent; }
        .logout-icon-btn { background: rgba(231,76,60,0.15); border-color: rgba(231,76,60,0.3); color: #e74c3c; }
        .logout-icon-btn:hover { background: rgba(231,76,60,0.3); }
        .profile-icon-btn { background: rgba(102,126,234,0.15); border-color: rgba(102,126,234,0.3); color: #667eea; }
        .profile-icon-btn:hover { background: rgba(102,126,234,0.3); }

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
          background: rgba(102,126,234,0.1);
          border: 2px solid rgba(102,126,234,0.22);
          display: flex; align-items: center; justify-content: center;
          font-size: 60px;
          animation: float 4s ease-in-out infinite;
          filter: drop-shadow(0 0 30px rgba(102,126,234,0.3));
        }
        .welcome-title {
          font-size: 26px; font-weight: 800;
          background: linear-gradient(135deg, #667eea, #f093fb);
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

        .chat-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; width: 100%; }

        .chat-header { padding: 14px 22px; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; gap: 12px; position: relative; }

        .chat-header-avatar { width: 36px; height: 36px; border-radius: 9px; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; overflow: hidden; }
        .chat-header-info { flex: 1; }
        .chat-header-name { font-size: 14px; font-weight: 700; color: white; }
        .chat-header-status { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; display: flex; align-items: center; gap: 5px; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; animation: pulse 2s ease-in-out infinite; }
        .msg-count { font-size: 11px; color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.07); padding: 3px 9px; border-radius: 20px; }

        .header-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: white; width: 30px; height: 30px; border-radius: 9px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.2s; flex-shrink: 0; }
        .header-btn:hover { background: rgba(255,255,255,0.15); }
        .header-btn.active { background: rgba(102,126,234,0.3); border-color: #667eea; }

        .search-bar { position: absolute; top: 64px; left: 0; right: 0; padding: 10px 22px; background: rgba(0,0,0,0.4); border-bottom: 1px solid rgba(255,255,255,0.07); z-index: 10; display: flex; align-items: center; gap: 10px; animation: slideDown 0.2s ease; }
        .search-input { flex: 1; background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.15); border-radius: 9px; color: white; font-size: 13px; padding: 7px 12px; outline: none; }
        .search-input:focus { border-color: #667eea; }
        .search-input::placeholder { color: rgba(255,255,255,0.3); }
        .search-results-count { font-size: 11px; color: rgba(255,255,255,0.4); white-space: nowrap; }
        .search-close { background: none; border: none; color: rgba(255,255,255,0.5); font-size: 17px; cursor: pointer; }
        .search-highlight { background: rgba(255,215,0,0.3); border-radius: 3px; padding: 0 2px; }

        .bg-picker-dropdown { position: absolute; top: 64px; right: 14px; background: rgba(15,15,35,0.97); border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 14px; z-index: 999; min-width: 190px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); animation: slideIn 0.2s ease; }
        .bg-picker-title { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .bg-options { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .bg-option { padding: 7px 9px; border-radius: 8px; cursor: pointer; font-size: 11px; font-weight: 600; color: white; border: 2px solid transparent; transition: all 0.2s; text-align: center; }
        .bg-option:hover { border-color: rgba(255,255,255,0.3); }
        .bg-option.active { border-color: #667eea; }

        .pinned-panel { position: absolute; top: 64px; left: 0; right: 0; background: rgba(10,10,30,0.97); border-bottom: 1px solid rgba(255,215,0,0.2); padding: 12px 22px; z-index: 10; animation: slideDown 0.2s ease; max-height: 200px; overflow-y: auto; }
        .pinned-panel-title { font-size: 10px; font-weight: 700; color: rgba(255,215,0,0.7); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .pinned-item { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 8px; background: rgba(255,215,0,0.04); border: 1px solid rgba(255,215,0,0.1); margin-bottom: 5px; }
        .pinned-item-content { flex: 1; overflow: hidden; }
        .pinned-item-text { font-size: 12px; color: rgba(255,255,255,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pinned-item-meta { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 1px; }
        .unpin-btn { background: none; border: none; color: rgba(255,255,255,0.3); font-size: 13px; cursor: pointer; }
        .unpin-btn:hover { color: #e74c3c; }

        .messages-area { flex: 1; overflow-y: auto; padding: 18px 22px; display: flex; flex-direction: column; gap: 10px; scroll-behavior: smooth; }
        .messages-area::-webkit-scrollbar { width: 4px; }
        .messages-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }

        .date-separator { display: flex; align-items: center; gap: 10px; align-self: stretch; margin: 4px 0; }
        .date-separator-line { flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
        .date-separator-label { font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.28); padding: 2px 9px; background: rgba(255,255,255,0.04); border-radius: 20px; border: 1px solid rgba(255,255,255,0.06); white-space: nowrap; }

        .system-msg { text-align: center; color: rgba(255,255,255,0.28); font-size: 11px; padding: 3px 10px; background: rgba(255,255,255,0.03); border-radius: 20px; align-self: center; }

        .msg-row { display: flex; gap: 8px; animation: fadeIn 0.25s ease; max-width: 68%; position: relative; }
        .msg-row.mine { align-self: flex-end; flex-direction: row-reverse; }
        .msg-row.theirs { align-self: flex-start; }

        .msg-avatar { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, #f093fb, #f5576c); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white; flex-shrink: 0; align-self: flex-end; overflow: hidden; padding: 0; }
        .msg-row.mine .msg-avatar { background: linear-gradient(135deg, #667eea, #764ba2); }

        .msg-content { display: flex; flex-direction: column; gap: 2px; }
        .msg-row.mine .msg-content { align-items: flex-end; }
        .msg-row.theirs .msg-content { align-items: flex-start; }
        .msg-sender { font-size: 10px; color: rgba(255,255,255,0.4); padding: 0 3px; }

        .msg-bubble { padding: 9px 13px; border-radius: 15px; font-size: 13px; line-height: 1.5; word-break: break-word; max-width: 100%; }
        .msg-row.mine .msg-bubble { background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-bottom-right-radius: 3px; box-shadow: 0 3px 12px rgba(102,126,234,0.28); }
        .msg-row.theirs .msg-bubble { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.9); border: 1px solid rgba(255,255,255,0.07); border-bottom-left-radius: 3px; }

        .msg-footer { display: flex; align-items: center; gap: 5px; padding: 0 3px; }
        .msg-time { font-size: 9px; color: rgba(255,255,255,0.28); }
        .edited-tag { font-size: 9px; color: rgba(255,255,255,0.28); font-style: italic; }
        .seen-status { font-size: 10px; color: rgba(102,126,234,0.8); font-weight: 600; }
        .seen-status.delivered { color: rgba(255,255,255,0.28); }
        .msg-pin-indicator { font-size: 10px; color: rgba(255,215,0,0.5); }

        .msg-actions { display: flex; gap: 4px; margin-top: 2px; opacity: 0; transition: opacity 0.15s; }
        .msg-row:hover .msg-actions { opacity: 1; }
        .action-btn { background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.13); color: rgba(255,255,255,0.65); padding: 2px 7px; border-radius: 6px; font-size: 10px; cursor: pointer; transition: all 0.15s; }
        .action-btn:hover { background: rgba(255,255,255,0.18); color: white; }
        .action-btn.delete:hover { background: rgba(231,76,60,0.25); color: #e74c3c; }
        .action-btn.pinned { color: rgba(255,215,0,0.7); }

        .reactions-bar { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px; }
        .reaction-btn { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.11); border-radius: 20px; padding: 1px 6px; font-size: 11px; cursor: pointer; transition: all 0.15s; color: white; display: flex; align-items: center; gap: 3px; }
        .reaction-btn:hover { background: rgba(255,255,255,0.16); transform: scale(1.08); }
        .reaction-btn.reacted { background: rgba(102,126,234,0.22); border-color: rgba(102,126,234,0.45); }
        .reaction-count { font-size: 10px; color: rgba(255,255,255,0.65); }

        .reaction-picker { display: flex; gap: 3px; margin-top: 3px; background: rgba(25,25,55,0.96); border: 1px solid rgba(255,255,255,0.09); border-radius: 20px; padding: 3px 7px; }
        .reaction-pick-btn { background: none; border: none; font-size: 15px; cursor: pointer; transition: transform 0.15s; padding: 1px; }
        .reaction-pick-btn:hover { transform: scale(1.3); }

        .edit-input { background: rgba(255,255,255,0.09); border: 1.5px solid #667eea; border-radius: 9px; color: white; font-size: 13px; padding: 6px 10px; outline: none; width: 100%; min-width: 160px; }
        .edit-actions { display: flex; gap: 4px; margin-top: 3px; }
        .save-btn { background: linear-gradient(135deg, #667eea, #764ba2); border: none; color: white; padding: 3px 9px; border-radius: 7px; font-size: 11px; cursor: pointer; font-weight: 600; }
        .cancel-btn { background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.18); color: rgba(255,255,255,0.65); padding: 3px 9px; border-radius: 7px; font-size: 11px; cursor: pointer; }

        .reply-bar { padding: 6px 10px; background: rgba(102,126,234,0.09); border-left: 3px solid #667eea; border-radius: 7px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; animation: slideDown 0.18s ease; }
        .reply-bar-content { flex: 1; overflow: hidden; }
        .reply-bar-name { font-size: 10px; font-weight: 700; color: #667eea; margin-bottom: 1px; }
        .reply-bar-text { font-size: 10px; color: rgba(255,255,255,0.45); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .reply-bar-cancel { background: none; border: none; color: rgba(255,255,255,0.35); font-size: 15px; cursor: pointer; }

        .msg-reply-preview { background: rgba(255,255,255,0.06); border-left: 3px solid rgba(102,126,234,0.55); border-radius: 5px; padding: 4px 7px; margin-bottom: 4px; cursor: pointer; }
        .msg-reply-name { font-size: 10px; font-weight: 700; color: #667eea; margin-bottom: 1px; }
        .msg-reply-text { font-size: 10px; color: rgba(255,255,255,0.45); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .typing-indicator { display: flex; align-items: center; gap: 7px; padding: 5px 12px; align-self: flex-start; }
        .typing-text { font-size: 11px; color: rgba(255,255,255,0.38); font-style: italic; }
        .typing-dots { display: flex; gap: 3px; align-items: center; }
        .typing-dot { width: 5px; height: 5px; background: rgba(255,255,255,0.38); border-radius: 50%; animation: typingBounce 1s ease infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }

        .empty-chat { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
        .empty-icon { font-size: 58px; animation: float 3s ease-in-out infinite; filter: drop-shadow(0 0 18px rgba(102,126,234,0.4)); }
        .empty-title { font-size: 19px; font-weight: 700; color: rgba(255,255,255,0.45); }
        .empty-sub { font-size: 12px; color: rgba(255,255,255,0.22); }
        .empty-hint { font-size: 11px; color: rgba(102,126,234,0.55); background: rgba(102,126,234,0.09); border: 1px solid rgba(102,126,234,0.18); padding: 6px 13px; border-radius: 20px; animation: pulse 3s ease-in-out infinite; }

        .input-area { padding: 12px 22px 14px; background: rgba(0,0,0,0.18); border-top: 1px solid rgba(255,255,255,0.07); position: relative; }

        .image-preview-bar { padding: 7px 9px; background: rgba(102,126,234,0.09); border: 1px solid rgba(102,126,234,0.18); border-radius: 9px; margin-bottom: 7px; display: flex; align-items: center; gap: 9px; }
        .preview-img { width: 48px; height: 48px; object-fit: cover; border-radius: 7px; }
        .preview-info { flex: 1; }
        .preview-name { font-size: 11px; color: rgba(255,255,255,0.65); font-weight: 600; }
        .preview-size { font-size: 10px; color: rgba(255,255,255,0.28); margin-top: 1px; }
        .upload-progress { font-size: 10px; color: rgba(102,126,234,0.75); animation: pulse 1s ease-in-out infinite; }
        .preview-cancel { background: none; border: none; color: rgba(255,255,255,0.35); font-size: 15px; cursor: pointer; }

        .emoji-picker-popup { position: absolute; bottom: 68px; left: 22px; background: rgba(12,12,32,0.98); border: 1px solid rgba(255,255,255,0.11); border-radius: 13px; padding: 12px; z-index: 999; width: 290px; box-shadow: 0 18px 55px rgba(0,0,0,0.65); animation: slideDown 0.18s ease; }
        .emoji-picker-title { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 7px; }
        .emoji-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; max-height: 165px; overflow-y: auto; }
        .emoji-grid::-webkit-scrollbar { width: 3px; }
        .emoji-grid::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 2px; }
        .emoji-item { background: none; border: none; font-size: 17px; cursor: pointer; padding: 3px; border-radius: 5px; transition: all 0.12s; display: flex; align-items: center; justify-content: center; }
        .emoji-item:hover { background: rgba(255,255,255,0.09); transform: scale(1.25); }

        .input-row { display: flex; gap: 8px; align-items: center; background: rgba(255,255,255,0.055); border: 1.5px solid rgba(255,255,255,0.09); border-radius: 13px; padding: 4px 4px 4px 12px; transition: all 0.28s; }
        .input-row:focus-within { border-color: #667eea; background: rgba(102,126,234,0.07); box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }

        .emoji-btn { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.11); color: white; width: 32px; height: 32px; border-radius: 9px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.2s; flex-shrink: 0; }
        .emoji-btn:hover { background: rgba(255,255,255,0.13); }
        .emoji-btn.active { background: rgba(102,126,234,0.28); border-color: #667eea; }

        .img-upload-btn { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.11); color: white; width: 32px; height: 32px; border-radius: 9px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.2s; flex-shrink: 0; }
        .img-upload-btn:hover { background: rgba(255,255,255,0.13); }

        .msg-input { flex: 1; background: transparent; border: none; color: white; font-size: 13px; outline: none; padding: 6px 0; }
        .msg-input::placeholder { color: rgba(255,255,255,0.28); }
        .msg-input:disabled { opacity: 0.45; cursor: not-allowed; }

        .send-btn { width: 36px; height: 36px; background: linear-gradient(135deg, #667eea, #764ba2); border: none; border-radius: 10px; color: white; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
        .send-btn:hover { transform: scale(1.07); box-shadow: 0 4px 14px rgba(102,126,234,0.5); }
        .send-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

        .msg-image { max-width: 240px; max-height: 170px; border-radius: 9px; cursor: pointer; display: block; }
        .msg-image:hover { opacity: 0.88; }

        .file-msg { display: flex; align-items: center; gap: 9px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.13); border-radius: 9px; padding: 9px 13px; cursor: pointer; transition: all 0.18s; min-width: 170px; }
        .file-msg:hover { background: rgba(255,255,255,0.13); }
        .file-msg-icon { font-size: 26px; flex-shrink: 0; }
        .file-msg-info { flex: 1; overflow: hidden; }
        .file-msg-name { font-size: 12px; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .file-msg-action { font-size: 10px; color: rgba(255,255,255,0.38); margin-top: 1px; }

        .no-results { text-align: center; padding: 38px; color: rgba(255,255,255,0.28); font-size: 13px; }

        .drag-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(102,126,234,0.18); border: 3px dashed #667eea; z-index: 9999; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 14px; backdrop-filter: blur(4px); }
        .drag-overlay-icon { font-size: 56px; }
        .drag-overlay-text { font-size: 20px; font-weight: 700; color: white; }
        .drag-overlay-sub { font-size: 12px; color: rgba(255,255,255,0.55); }

        .profile-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.72); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
        .profile-modal { background: rgba(12,12,32,0.99); border: 1px solid rgba(255,255,255,0.11); border-radius: 18px; padding: 24px; width: 390px; max-width: 92vw; box-shadow: 0 28px 75px rgba(0,0,0,0.65); max-height: 90vh; overflow-y: auto; }
        .profile-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .profile-modal-title { font-size: 16px; font-weight: 700; color: white; }
        .profile-close-btn { background: none; border: none; color: rgba(255,255,255,0.38); font-size: 19px; cursor: pointer; }
        .profile-avatar-section { display: flex; flex-direction: column; align-items: center; gap: 12px; margin-bottom: 18px; }
        .profile-avatar-preview { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: white; border: 3px solid rgba(255,255,255,0.18); }
        .avatar-colors { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
        .avatar-color-btn { width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; transition: all 0.18s; }
        .avatar-color-btn:hover { transform: scale(1.18); }
        .avatar-color-btn.selected { border-color: white; }
        .profile-field { margin-bottom: 12px; }
        .profile-label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.38); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; display: block; }
        .profile-input { width: 100%; background: rgba(255,255,255,0.07); border: 1.5px solid rgba(255,255,255,0.11); border-radius: 9px; color: white; font-size: 13px; padding: 8px 11px; outline: none; font-family: 'Segoe UI', sans-serif; }
        .profile-input:focus { border-color: #667eea; }
        .profile-input::placeholder { color: rgba(255,255,255,0.22); }
        .profile-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 14px 0; }
        .profile-save-btn { width: 100%; background: linear-gradient(135deg, #667eea, #764ba2); border: none; color: white; padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .profile-save-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .profile-msg { text-align: center; font-size: 12px; margin-top: 9px; color: rgba(255,255,255,0.65); }

        .lock-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.82); z-index: 99999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(7px); }
        .lock-modal { background: rgba(12,12,32,0.99); border: 1px solid rgba(255,215,0,0.18); border-radius: 18px; padding: 26px; width: 340px; max-width: 92vw; text-align: center; }
        .lock-icon { font-size: 48px; margin-bottom: 10px; }
        .lock-title { font-size: 17px; font-weight: 700; color: white; margin-bottom: 5px; }
        .lock-sub { font-size: 12px; color: rgba(255,255,255,0.38); margin-bottom: 18px; }
        .lock-input { width: 100%; background: rgba(255,255,255,0.07); border: 1.5px solid rgba(255,215,0,0.28); border-radius: 9px; color: white; font-size: 14px; padding: 10px 13px; outline: none; text-align: center; letter-spacing: 4px; font-family: monospace; margin-bottom: 12px; }
        .lock-input:focus { border-color: rgba(255,215,0,0.55); }
        .lock-btn { width: 100%; padding: 11px; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; margin-bottom: 7px; transition: all 0.18s; }
        .lock-btn-primary { background: linear-gradient(135deg, #f39c12, #d35400); color: white; }
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
          .chat-header-avatar { width: 30px !important; height: 30px !important; font-size: 14px !important; border-radius: 8px !important; }
          .chat-header-name { font-size: 14px !important; }
          .chat-header-status { font-size: 10px !important; }
          .msg-count { display: none !important; }
          .header-btn { width: 28px !important; height: 28px !important; font-size: 13px !important; }

          .messages-area { padding: 10px !important; gap: 8px !important; }
          .msg-row { max-width: 85% !important; }
          .msg-bubble { font-size: 13px !important; padding: 8px 12px !important; }
          .msg-image { max-width: 200px !important; }
          .msg-avatar { width: 26px !important; height: 26px !important; font-size: 10px !important; }

          .input-area { padding: 8px 10px 10px !important; }
          .input-row { padding: 3px 3px 3px 10px !important; gap: 6px !important; }
          .emoji-btn { width: 28px !important; height: 28px !important; font-size: 15px !important; }
          .img-upload-btn { width: 28px !important; height: 28px !important; font-size: 15px !important; }
          .send-btn { width: 34px !important; height: 34px !important; font-size: 15px !important; }

          .emoji-picker-popup { width: calc(100vw - 20px) !important; left: 10px !important; bottom: 65px !important; }
          .connection-banner { font-size: 11px !important; padding: 7px 10px !important; }
          .lock-modal { width: 90vw !important; padding: 20px !important; }
          .profile-modal { width: 95vw !important; padding: 16px !important; }
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

      {showLockModal === 'verify' && (
        <div className="lock-overlay">
          <div className="lock-modal">
            <div className="lock-icon">🔒</div>
            <div className="lock-title">This chat is locked</div>
            <div className="lock-sub">Enter password to open chat with {activeDMUser}</div>
            <input className="lock-input" type="password" placeholder="••••••••"
              value={lockVerifyPassword} onChange={(e) => setLockVerifyPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && verifyLock()} />
            <button className="lock-btn lock-btn-primary" onClick={verifyLock}>🔓 Unlock</button>
            <button className="lock-btn lock-btn-cancel" onClick={() => { setShowLockModal(false); setActiveDMUser(null); setActiveRoom(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {showLockModal === 'set' && (
        <div className="lock-overlay">
          <div className="lock-modal">
            <div className="lock-icon">🔐</div>
            <div className="lock-title">Lock this chat</div>
            <div className="lock-sub">Set a password for your chat with {activeDMUser}</div>
            <input className="lock-input" type="password" placeholder="Enter password"
              value={lockPassword} onChange={(e) => setLockPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setLock()} />
            <button className="lock-btn lock-btn-primary" onClick={setLock}>🔒 Set Lock</button>
            <button className="lock-btn lock-btn-cancel" onClick={() => setShowLockModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {showProfile && (
        <div className="profile-overlay" onClick={(e) => e.target === e.currentTarget && setShowProfile(false)}>
          <div className="profile-modal">
            <div className="profile-modal-header">
              <div className="profile-modal-title">⚙️ Profile Settings</div>
              <button className="profile-close-btn" onClick={() => setShowProfile(false)}>✕</button>
            </div>
            <div className="profile-avatar-section">
              <div className="profile-avatar-preview"
                style={{ background: profileEdit.avatar_color, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                onClick={() => document.getElementById('avatar-upload').click()}>
                {profileEdit.avatar_url
                  ? <img src={profileEdit.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : getInitial(username)}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', fontSize: '9px', color: 'white', textAlign: 'center', padding: '3px' }}>📷 Edit</div>
              </div>
              <input id="avatar-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try { const url = await uploadToCloudinary(file); setProfileEdit(prev => ({ ...prev, avatar_url: url })); } catch (err) {}
              }} />
              <div className="avatar-colors">
                {AVATAR_COLORS.map(color => (
                  <div key={color} className={`avatar-color-btn ${profileEdit.avatar_color === color ? 'selected' : ''}`}
                    style={{ background: color }} onClick={() => setProfileEdit(prev => ({ ...prev, avatar_color: color }))} />
                ))}
              </div>
            </div>
            <div className="profile-field">
              <label className="profile-label">Username</label>
              <input className="profile-input" value={username} disabled style={{ opacity: 0.45 }} />
            </div>
            <div className="profile-field">
              <label className="profile-label">Bio / Status</label>
              <input className="profile-input" placeholder="Tell something about yourself..."
                value={profileEdit.bio} onChange={(e) => setProfileEdit(prev => ({ ...prev, bio: e.target.value }))} maxLength={100} />
            </div>
            <div className="profile-divider" />
            <div className="profile-field">
              <label className="profile-label">Current Password</label>
              <input className="profile-input" type="password" placeholder="Enter current password"
                value={profileEdit.current_password} onChange={(e) => setProfileEdit(prev => ({ ...prev, current_password: e.target.value }))} />
            </div>
            <div className="profile-field">
              <label className="profile-label">New Password</label>
              <input className="profile-input" type="password" placeholder="Enter new password"
                value={profileEdit.new_password} onChange={(e) => setProfileEdit(prev => ({ ...prev, new_password: e.target.value }))} />
            </div>
            <button className="profile-save-btn" onClick={saveProfile} disabled={profileSaving}>
              {profileSaving ? '⏳ Saving...' : '💾 Save Changes'}
            </button>
            {profileMsg && <div className="profile-msg">{profileMsg}</div>}
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
          className="sidebar"
          ref={sidebarRef}
          style={sidebarDynamicStyle}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="sidebar-logo">
            <div className="logo-row">
              <span className="logo-emoji">💬</span>
              <span className="logo-name">Nalantamil</span>
            </div>
          </div>

          <div className="sidebar-section-title">Channels</div>
          <div className={`channel-item ${activeRoom === 'general' ? 'active' : ''}`}
            onClick={() => { setActiveRoom('general'); setActiveDMUser(null); setUnreadCount(0); }}>
            <span className="channel-icon">🌐</span>
            <div className="channel-info">
              <div className="channel-name"># general</div>
              <div className="channel-sub">Everyone is here</div>
            </div>
            {unreadCount > 0 && (activeRoom !== 'general' || !isTabFocused)
              ? <div className="channel-badge">{unreadCount}</div>
              : <div className="online-dot"></div>}
          </div>

          <div className="sidebar-section-title">
            Direct Messages
            {totalUnreadDMs > 0 && (
              <span style={{ background: '#e74c3c', color: 'white', fontSize: '9px', padding: '1px 5px', borderRadius: '9px' }}>{totalUnreadDMs}</span>
            )}
          </div>

          {sortedUsers.map(user => {
            const roomId = getDMRoomId(username, user.username);
            const unread = unreadDMs[roomId] || 0;
            const isLocked = chatLocks[roomId]?.locked;
            const lastTs = dmLastMessage[roomId] || 0;
            const lastPreview = getLastMsgPreview(roomId);
            return (
              <div key={user.username}
                className={`dm-item ${activeDMUser === user.username && activeRoom === 'dm' ? 'active' : ''}`}
                onClick={() => openDM(user.username)}>
                <div className="dm-avatar" style={{ background: user.avatar_color || '#667eea' }}>
                  {user.avatar_url
                    ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : getInitial(user.username)}
                </div>
                <div className="dm-info">
                  <div className="dm-name-row">
                    <div className="dm-name">{user.username}</div>
                    {lastTs > 0 && <div className="dm-time">{formatLastMsgTime(lastTs)}</div>}
                  </div>
                  <div className="dm-preview-row">
                    <div className="dm-preview" style={{ color: unread > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)', fontWeight: unread > 0 ? '600' : '400' }}>
                      {lastPreview || 'Click to chat'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      {isLocked && <span className="dm-lock-icon">🔒</span>}
                      {unread > 0 && (
                        <div style={{ background: '#2ecc71', color: 'white', fontSize: '10px', fontWeight: '800', minWidth: '18px', height: '18px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxShadow: '0 0 6px rgba(46,204,113,0.6)' }}>
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
            <button className="icon-btn profile-icon-btn ripple-btn" onClick={() => setShowProfile(true)}>⚙️</button>
            <button className="icon-btn logout-icon-btn ripple-btn" onClick={handleLogoutClick}>⏻</button>
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
                    <div className="chat-header-name">💬 Nalantamil</div>
                  </div>
                </div>
              )}
              <div className="welcome-screen">
                <div className="welcome-icon-circle">💬</div>
                <div className="welcome-title">Nalantamil Web</div>
                <div className="welcome-sub">Select a channel or a person from the list to start chatting. Your messages sync in real time.</div>
                <div className="welcome-note">🔒 Private chats can be locked with a password.</div>
              </div>
            </>
          ) : (
            <>
              <div className="chat-header">
                <button className="mobile-back-btn ripple-btn" onClick={backToList} aria-label="Back to chat list">
                  ←
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
                  {activeRoom === 'general' ? '🌐' : (() => {
                    const dmUser = allUsers.find(u => u.username === activeDMUser);
                    return dmUser?.avatar_url
                      ? <img src={dmUser.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '9px' }} />
                      : getInitial(activeDMUser || '');
                  })()}
                </div>
                <div className="chat-header-info">
                  <div className="chat-header-name">
                    {activeRoom === 'general' ? '# general' : `💬 ${activeDMUser}`}
                  </div>
                  <div className="chat-header-status">
                    <span className="status-dot" style={{ background: isConnected ? '#2ecc71' : '#e74c3c', boxShadow: isConnected ? '0 0 5px #2ecc71' : '0 0 5px #e74c3c' }}></span>
                    {isConnected ? (activeRoom === 'general' ? 'Group Chat — Everyone online' : `Private chat`) : 'Connecting...'}
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
                    {chatLocks[currentRoomId]?.locked ? '🔒' : '🔓'}
                  </button>
                )}

                <button className={`header-btn ripple-btn ${showSearch ? 'active' : ''}`}
                  onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); }}>🔍</button>
                {activeRoom === 'general' && (
                  <button className={`header-btn ripple-btn ${showPinned ? 'active' : ''}`}
                    onClick={() => setShowPinned(!showPinned)}>📌</button>
                )}
                <button className="header-btn ripple-btn" onClick={() => setShowBgPicker(!showBgPicker)}>🎨</button>

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

              <div className="messages-area">
                {filteredMessages.length === 0 && searchQuery ? (
                  <div className="no-results">🔍 No messages found for "<strong>{searchQuery}</strong>"</div>
                ) : filteredMessages.length === 0 ? (
                  <div className="empty-chat">
                    <span className="empty-icon">{activeRoom === 'general' ? '💬' : '🔐'}</span>
                    <div className="empty-title">{activeRoom === 'general' ? 'No messages yet' : `Chat with ${activeDMUser}`}</div>
                    <div className="empty-sub">{activeRoom === 'general' ? 'Be the first to say hello!' : 'Your messages are private'}</div>
                    <div className="empty-hint">{activeRoom === 'general' ? '✨ Send a message below' : '🔒 You can lock this chat for privacy'}</div>
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

                    return (
                      <React.Fragment key={msg._id || index}>
                        {showDate && msg.timestamp && (
                          <div className="date-separator">
                            <div className="date-separator-line"></div>
                            <span className="date-separator-label">{getDateLabel(msg.timestamp)}</span>
                            <div className="date-separator-line"></div>
                          </div>
                        )}
                        <div className={`msg-row ${isMine ? 'mine' : 'theirs'}`}>
                          <div className="msg-avatar" style={{ padding: 0, overflow: 'hidden' }}>
                            {isMine && profile.avatar_url
                              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                              : getInitial(msg.username)}
                          </div>
                          <div className="msg-content">
                            {!isMine && <span className="msg-sender">{msg.username}</span>}
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
                                        <img src={parts[0]} alt="" className="msg-image" onClick={() => window.open(parts[0], '_blank')} />
                                        {parts[1] && <p style={{ marginTop: '6px', fontSize: '12px', color: 'inherit' }}>{parts[1]}</p>}
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
                                <div className="msg-footer">
                                  <span className="msg-time">{formatTime(msg.timestamp)}</span>
                                  {msg.edited && <span className="edited-tag">(edited)</span>}
                                  {isMine && <span className={`seen-status ${isLastMine ? '' : 'delivered'}`}>{isLastMine ? '✓✓' : '✓'}</span>}
                                  {isPinned(msg._id) && <span className="msg-pin-indicator">📌</span>}
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
                                <div className="msg-actions">
                                  <div className="reaction-picker">
                                    {REACTIONS.map(emoji => (
                                      <button key={emoji} className="reaction-pick-btn"
                                        onClick={() => addReaction(msg._id, emoji)}>{emoji}</button>
                                    ))}
                                  </div>
                                  <button className="action-btn"
                                    onClick={() => { setReplyingTo(msg); document.querySelector('.msg-input')?.focus(); }}>↩️</button>
                                  {isMine && (
                                    <>
                                      <button className="action-btn" onClick={() => startEdit(msg)}>✏️</button>
                                      <button className="action-btn delete" onClick={() => deleteMessage(msg._id)}>🗑️</button>
                                    </>
                                  )}
                                  {activeRoom === 'general' && (
                                    <button className={`action-btn ${isPinned(msg._id) ? 'pinned' : ''}`}
                                      onClick={() => isPinned(msg._id) ? unpinMessage(msg._id) : pinMessage(msg)}>
                                      {isPinned(msg._id) ? '📌' : '📍'}
                                    </button>
                                  )}
                                </div>
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
                <div ref={messagesEndRef} />
              </div>

              <div className="input-area">
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
                      : <div style={{ width: '48px', height: '48px', background: 'rgba(102,126,234,0.18)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>{getFileIcon(imageFile)}</div>
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
                  <button type="button" className={`emoji-btn ${showEmojiPicker ? 'active' : ''}`}
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}>😊</button>
                  <button type="button" className="img-upload-btn" onClick={() => fileInputRef.current?.click()}>📷</button>
                  <input ref={fileInputRef} type="file"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt"
                    style={{ display: 'none' }} onChange={handleFileInput} />
                  <input
                    className="msg-input" type="text"
                    placeholder={!isConnected ? '⚠️ Reconnecting...' : imageFile ? 'Add a caption...' : activeRoom === 'general' ? 'Message #general...' : `Message ${activeDMUser}...`}
                    value={input} onChange={handleInputChange} disabled={!isConnected} />
                  <button type="submit" className="send-btn ripple-btn" disabled={uploading || !isConnected}>
                    {uploading ? '⏳' : !isConnected ? '⚡' : '➤'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default Chat;