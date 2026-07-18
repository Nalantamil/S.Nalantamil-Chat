import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const socket = io('https://s-nalantamil-chat.onrender.com', {
  transports: ['websocket'],
  upgrade: false
});

const BACKGROUNDS = [
  { id: 'default', label: '🌌 Default', value: 'linear-gradient(-45deg, #0f0c29, #302b63, #24243e, #1a1a2e)', type: 'gradient' },
  { id: 'ocean', label: '🌊 Ocean', value: 'linear-gradient(-45deg, #0f2027, #203a43, #2c5364)', type: 'gradient' },
  { id: 'forest', label: '🌿 Forest', value: 'linear-gradient(-45deg, #0a1628, #0d2137, #0f3460)', type: 'gradient' },
  { id: 'sunset', label: '🌅 Sunset', value: 'linear-gradient(-45deg, #1a0533, #4a0e8f, #8b1a6b)', type: 'gradient' },
  { id: 'dark', label: '⬛ Pure Dark', value: 'linear-gradient(-45deg, #0a0a0a, #111111, #0d0d0d)', type: 'gradient' },
  { id: 'midnight', label: '🌙 Midnight', value: 'linear-gradient(-45deg, #000428, #004e92)', type: 'gradient' },
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

function Chat({ username, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [selectedBg, setSelectedBg] = useState(BACKGROUNDS[0]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isTabFocused, setIsTabFocused] = useState(true);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);

  const REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];

  // ===== TAB FOCUS TRACKING =====
  useEffect(() => {
    const onFocus = () => { setIsTabFocused(true); setUnreadCount(0); };
    const onBlur = () => setIsTabFocused(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('blur', onBlur); };
  }, []);

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

  const shouldShowDateSeparator = (messages, index) => {
    if (index === 0) return true;
    const prev = messages[index - 1];
    const curr = messages[index];
    if (!prev.timestamp || !curr.timestamp) return false;
    return new Date(prev.timestamp + 'Z').toDateString() !== new Date(curr.timestamp + 'Z').toDateString();
  };

  useEffect(() => {
    axios.get('https://s-nalantamil-chat.onrender.com/messages').then((res) => {
      setMessages(res.data);
    });

    // Fetch pinned messages
    axios.get('https://s-nalantamil-chat.onrender.com/pinned').then(res => {
      setPinnedMessages(res.data);
    });

    socket.emit('join', { username });
    socket.on('message', (msg) => {
      setMessages((prev) => [...prev, { ...msg, reactions: {} }]);
      if (!isTabFocused && msg.username !== username) {
        setUnreadCount(prev => prev + 1);
      }
    });
    socket.on('message_deleted', ({ message_id }) => setMessages((prev) => prev.filter((m) => m._id !== message_id)));
    socket.on('message_edited', ({ message_id, text }) => setMessages((prev) => prev.map((m) => m._id === message_id ? { ...m, text, edited: true } : m)));
    socket.on('reaction_updated', ({ message_id, reactions }) => setMessages((prev) => prev.map((m) => m._id === message_id ? { ...m, reactions } : m)));
    socket.on('user_typing', ({ username: typingUser }) => setTypingUsers((prev) => prev.includes(typingUser) ? prev : [...prev, typingUser]));
    socket.on('user_stop_typing', ({ username: typingUser }) => setTypingUsers((prev) => prev.filter((u) => u !== typingUser)));

    // Pin socket listeners
    socket.on('message_pinned', (data) => {
      setPinnedMessages(prev => [data, ...prev]);
    });
    socket.on('message_unpinned', ({ message_id }) => {
      setPinnedMessages(prev => prev.filter(p => p.message_id !== message_id));
    });

    return () => {
      socket.off('message'); socket.off('message_deleted'); socket.off('message_edited');
      socket.off('reaction_updated'); socket.off('user_typing'); socket.off('user_stop_typing');
      socket.off('message_pinned');
      socket.off('message_unpinned');
    };
  }, [username, isTabFocused]);

  useEffect(() => {
    if (!showSearch) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers, showSearch]);

  useEffect(() => {
    if (showSearch && searchInputRef.current) searchInputRef.current.focus();
  }, [showSearch]);

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
    if (!input.trim()) return;
    socket.emit('send_message', { username, text: input });
    socket.emit('stop_typing', { username });
    clearTimeout(typingTimeoutRef.current);
    setInput('');
    setShowEmojiPicker(false);
  };

  const deleteMessage = (message_id) => socket.emit('delete_message', { message_id });
  const startEdit = (msg) => { setEditingId(msg._id); setEditText(msg.text); };
  const saveEdit = (message_id) => {
    if (!editText.trim()) return;
    socket.emit('edit_message', { message_id, text: editText });
    setEditingId(null); setEditText('');
  };
  const addReaction = (message_id, emoji) => socket.emit('add_reaction', { message_id, emoji, username });

  // ===== PIN / UNPIN =====
  const pinMessage = async (msg) => {
    const pinData = {
      message_id: msg._id,
      text: msg.text,
      username: msg.username,
      pinned_by: username
    };
    await axios.post('https://s-nalantamil-chat.onrender.com/pinned', pinData);
    socket.emit('pin_message', pinData);
  };

  const unpinMessage = async (message_id) => {
    await axios.delete(`https://s-nalantamil-chat.onrender.com/pinned/${message_id}`);
    socket.emit('unpin_message', { message_id });
  };

  const isPinned = (msg_id) => pinnedMessages.some(p => p.message_id === msg_id);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp + 'Z').toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getInitial = (name) => name ? name[0].toUpperCase() : '?';

  // ===== SEARCH FILTER =====
  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => m.type !== 'system' && m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

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

        body {
          background: ${selectedBg.value};
          background-size: 400% 400%;
          animation: gradientShift 8s ease infinite;
        }

        .chat-layout {
          display: flex; height: 100vh; width: 100vw;
          font-family: 'Segoe UI', sans-serif; overflow: hidden;
        }

        /* ===== SIDEBAR ===== */
        .sidebar {
          width: ${sidebarOpen ? '260px' : '0px'};
          min-width: ${sidebarOpen ? '260px' : '0px'};
          background: rgba(0,0,0,0.35);
          border-right: 1px solid rgba(255,255,255,0.07);
          display: flex; flex-direction: column;
          transition: width 0.3s ease, min-width 0.3s ease, opacity 0.3s ease;
          overflow: hidden;
          opacity: ${sidebarOpen ? '1' : '0'};
        }

        .sidebar-logo { padding: 28px 24px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .logo-row { display: flex; align-items: center; gap: 10px; }
        .logo-emoji { font-size: 26px; filter: drop-shadow(0 0 8px rgba(102,126,234,0.9)); transition: transform 0.3s ease; cursor: pointer; }
        .logo-emoji:hover { transform: scale(1.2) rotate(10deg); }
        .logo-name { font-size: 20px; font-weight: 800; background: linear-gradient(135deg, #667eea, #f093fb); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: 2px; }
        .sidebar-section-title { padding: 20px 24px 10px; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.3); letter-spacing: 1.5px; text-transform: uppercase; }

        .room-item { margin: 0 12px; padding: 12px 14px; border-radius: 12px; display: flex; align-items: center; gap: 12px; background: rgba(102,126,234,0.2); border: 1px solid rgba(102,126,234,0.3); cursor: pointer; transition: all 0.3s ease; position: relative; }
        .room-item:hover { background: rgba(102,126,234,0.35); transform: translateX(4px); }

        /* ===== NOTIFICATION BADGE ===== */
        .notif-badge {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white; font-size: 10px; font-weight: 800;
          min-width: 18px; height: 18px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 4px; animation: pulse 1.5s ease-in-out infinite;
          box-shadow: 0 0 8px rgba(102,126,234,0.6);
        }

        .room-icon { font-size: 18px; }
        .room-info { flex: 1; }
        .room-name { font-size: 14px; font-weight: 600; color: white; }
        .room-sub { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; }
        .online-dot { width: 8px; height: 8px; background: #2ecc71; border-radius: 50%; box-shadow: 0 0 6px #2ecc71; animation: pulse 2s ease-in-out infinite; }
        .sidebar-spacer { flex: 1; }
        .sidebar-user { padding: 16px; border-top: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; gap: 12px; transition: background 0.3s ease; }
        .sidebar-user:hover { background: rgba(255,255,255,0.03); }
        .user-avatar { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: white; flex-shrink: 0; transition: transform 0.3s ease; }
        .user-avatar:hover { transform: scale(1.1); }
        .user-info { flex: 1; overflow: hidden; }
        .user-name { font-size: 14px; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .user-status { font-size: 11px; color: #2ecc71; margin-top: 2px; }
        .logout-icon-btn { background: rgba(231,76,60,0.15); border: 1px solid rgba(231,76,60,0.3); color: #e74c3c; width: 34px; height: 34px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.2s; flex-shrink: 0; position: relative; overflow: hidden; }
        .logout-icon-btn:hover { background: rgba(231,76,60,0.35); transform: scale(1.05); }

        .ripple-btn { position: relative; overflow: hidden; }
        .ripple-btn::after { content: ''; position: absolute; width: 10px; height: 10px; background: rgba(255,255,255,0.3); border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0); opacity: 1; }
        .ripple-btn:active::after { animation: ripple 0.4s ease-out; }

        .chat-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

        /* ===== CHAT HEADER ===== */
        .chat-header { padding: 18px 28px; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; gap: 14px; position: relative; }

        .sidebar-toggle { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: white; width: 34px; height: 34px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.3s ease; flex-shrink: 0; }
        .sidebar-toggle:hover { background: rgba(255,255,255,0.15); transform: scale(1.05); }

        .chat-header-avatar { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; font-size: 20px; transition: transform 0.3s ease; }
        .chat-header-avatar:hover { transform: scale(1.1); }
        .chat-header-info { flex: 1; }
        .chat-header-name { font-size: 16px; font-weight: 700; color: white; }
        .chat-header-status { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 2px; display: flex; align-items: center; gap: 6px; }
        .status-dot { width: 7px; height: 7px; background: #2ecc71; border-radius: 50%; box-shadow: 0 0 5px #2ecc71; animation: pulse 2s ease-in-out infinite; }
        .msg-count { font-size: 12px; color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.07); padding: 4px 12px; border-radius: 20px; }

        /* ===== SEARCH ===== */
        .search-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: white; width: 34px; height: 34px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.3s ease; flex-shrink: 0; }
        .search-btn:hover { background: rgba(255,255,255,0.15); transform: scale(1.05); }
        .search-btn.active { background: rgba(102,126,234,0.3); border-color: #667eea; }

        .search-bar {
          position: absolute; top: 70px; left: 0; right: 0;
          padding: 12px 28px; background: rgba(0,0,0,0.4);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          animation: slideDown 0.2s ease; z-index: 10;
          display: flex; align-items: center; gap: 10px;
        }

        .search-input {
          flex: 1; background: rgba(255,255,255,0.08);
          border: 1.5px solid rgba(255,255,255,0.15);
          border-radius: 12px; color: white; font-size: 14px;
          padding: 10px 16px; outline: none; transition: all 0.3s;
        }
        .search-input:focus { border-color: #667eea; background: rgba(102,126,234,0.1); box-shadow: 0 0 0 3px rgba(102,126,234,0.12); }
        .search-input::placeholder { color: rgba(255,255,255,0.3); }

        .search-results-count { font-size: 12px; color: rgba(255,255,255,0.4); white-space: nowrap; }

        .search-close { background: none; border: none; color: rgba(255,255,255,0.5); font-size: 18px; cursor: pointer; transition: color 0.2s; }
        .search-close:hover { color: white; }

        .search-highlight { background: rgba(255,215,0,0.3); border-radius: 3px; padding: 0 2px; }

        .bg-picker-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: white; width: 34px; height: 34px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.3s ease; flex-shrink: 0; }
        .bg-picker-btn:hover { background: rgba(255,255,255,0.15); transform: scale(1.05); }

        .bg-picker-dropdown { position: absolute; top: 70px; right: 20px; background: rgba(15,15,35,0.97); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 16px; z-index: 999; min-width: 220px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); animation: slideIn 0.2s ease; }
        .bg-picker-title { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
        .bg-options { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .bg-option { padding: 10px 12px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 600; color: white; border: 2px solid transparent; transition: all 0.2s ease; text-align: center; }
        .bg-option:hover { border-color: rgba(255,255,255,0.3); transform: scale(1.03); }
        .bg-option.active { border-color: #667eea; box-shadow: 0 0 12px rgba(102,126,234,0.4); }

        /* ===== PINNED MESSAGES ===== */
        .pin-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: white; width: 34px; height: 34px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.3s ease; flex-shrink: 0; }
        .pin-btn:hover { background: rgba(255,255,255,0.15); transform: scale(1.05); }
        .pin-btn.active { background: rgba(255,215,0,0.2); border-color: rgba(255,215,0,0.5); }

        .pinned-panel {
          position: absolute; top: 70px; left: 0; right: 0;
          background: rgba(10,10,30,0.97);
          border-bottom: 1px solid rgba(255,215,0,0.2);
          padding: 16px 28px; z-index: 10;
          animation: slideDown 0.2s ease;
          max-height: 250px; overflow-y: auto;
        }

        .pinned-panel-title {
          font-size: 12px; font-weight: 700;
          color: rgba(255,215,0,0.7);
          text-transform: uppercase; letter-spacing: 1px;
          margin-bottom: 12px;
          display: flex; align-items: center; gap: 8px;
        }

        .pinned-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 14px; border-radius: 10px;
          background: rgba(255,215,0,0.05);
          border: 1px solid rgba(255,215,0,0.1);
          margin-bottom: 8px; transition: all 0.2s ease;
        }

        .pinned-item:hover { background: rgba(255,215,0,0.1); border-color: rgba(255,215,0,0.2); }

        .pinned-item-icon { font-size: 14px; flex-shrink: 0; }
        .pinned-item-content { flex: 1; overflow: hidden; }
        .pinned-item-text { font-size: 13px; color: rgba(255,255,255,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pinned-item-meta { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 2px; }

        .unpin-btn { background: none; border: none; color: rgba(255,255,255,0.3); font-size: 14px; cursor: pointer; transition: color 0.2s; flex-shrink: 0; }
        .unpin-btn:hover { color: #e74c3c; }

        .msg-pin-indicator { font-size: 11px; color: rgba(255,215,0,0.6); padding: 0 4px; }

        .action-btn.pin { }
        .action-btn.pin.pinned { color: rgba(255,215,0,0.8); }

        /* ===== MESSAGES ===== */
        .messages-area { flex: 1; overflow-y: auto; padding: 24px 28px; display: flex; flex-direction: column; gap: 14px; scroll-behavior: smooth; }
        .messages-area::-webkit-scrollbar { width: 5px; }
        .messages-area::-webkit-scrollbar-track { background: transparent; }
        .messages-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
        .messages-area::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }

        .date-separator { display: flex; align-items: center; gap: 12px; align-self: stretch; margin: 8px 0; animation: fadeIn 0.3s ease; }
        .date-separator-line { flex: 1; height: 1px; background: rgba(255,255,255,0.1); }
        .date-separator-label { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.35); padding: 4px 12px; background: rgba(255,255,255,0.05); border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); letter-spacing: 0.5px; white-space: nowrap; }

        .system-msg { text-align: center; color: rgba(255,255,255,0.3); font-size: 12px; padding: 5px 14px; background: rgba(255,255,255,0.04); border-radius: 20px; align-self: center; animation: fadeIn 0.3s ease; }

        .msg-row { display: flex; gap: 10px; animation: fadeIn 0.3s ease; max-width: 70%; position: relative; transition: transform 0.2s ease; }
        .msg-row:hover { transform: translateY(-1px); }
        .msg-row.mine { align-self: flex-end; flex-direction: row-reverse; }
        .msg-row.theirs { align-self: flex-start; }

        .msg-avatar { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #f093fb, #f5576c); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white; flex-shrink: 0; align-self: flex-end; transition: transform 0.2s ease; }
        .msg-avatar:hover { transform: scale(1.15); }
        .msg-row.mine .msg-avatar { background: linear-gradient(135deg, #667eea, #764ba2); }

        .msg-content { display: flex; flex-direction: column; gap: 4px; position: relative; }
        .msg-row.mine .msg-content { align-items: flex-end; }
        .msg-row.theirs .msg-content { align-items: flex-start; }
        .msg-sender { font-size: 11px; color: rgba(255,255,255,0.4); padding: 0 4px; }

        .msg-bubble { padding: 11px 16px; border-radius: 18px; font-size: 14px; line-height: 1.5; word-break: break-word; max-width: 100%; transition: box-shadow 0.2s ease; }
        .msg-row.mine .msg-bubble { background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-bottom-right-radius: 4px; box-shadow: 0 4px 15px rgba(102,126,234,0.3); }
        .msg-row.mine .msg-bubble:hover { box-shadow: 0 6px 20px rgba(102,126,234,0.5); }
        .msg-row.theirs .msg-bubble { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.9); border: 1px solid rgba(255,255,255,0.08); border-bottom-left-radius: 4px; }
        .msg-row.theirs .msg-bubble:hover { background: rgba(255,255,255,0.12); }

        .msg-footer { display: flex; align-items: center; gap: 8px; padding: 0 4px; }
        .msg-time { font-size: 10px; color: rgba(255,255,255,0.3); }
        .edited-tag { font-size: 10px; color: rgba(255,255,255,0.3); font-style: italic; }

        /* ===== SEEN STATUS ===== */
        .seen-status { font-size: 11px; color: rgba(102,126,234,0.8); font-weight: 600; }
        .seen-status.delivered { color: rgba(255,255,255,0.3); }

        .msg-actions { display: flex; gap: 6px; margin-top: 2px; opacity: 0; transition: opacity 0.2s; }
        .msg-row:hover .msg-actions { opacity: 1; }

        .action-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); padding: 3px 10px; border-radius: 8px; font-size: 11px; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; }
        .action-btn:hover { background: rgba(255,255,255,0.2); color: white; transform: scale(1.05); }
        .action-btn.delete:hover { background: rgba(231,76,60,0.3); border-color: rgba(231,76,60,0.5); color: #e74c3c; }

        .reactions-bar { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
        .reaction-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 2px 8px; font-size: 13px; cursor: pointer; transition: all 0.2s; color: white; display: flex; align-items: center; gap: 4px; }
        .reaction-btn:hover { background: rgba(255,255,255,0.18); transform: scale(1.15); }
        .reaction-btn.reacted { background: rgba(102,126,234,0.25); border-color: rgba(102,126,234,0.5); }
        .reaction-count { font-size: 11px; color: rgba(255,255,255,0.7); }

        .reaction-picker { display: flex; gap: 4px; margin-top: 4px; background: rgba(30,30,60,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 4px 8px; }
        .reaction-pick-btn { background: none; border: none; font-size: 18px; cursor: pointer; transition: transform 0.2s; padding: 2px; }
        .reaction-pick-btn:hover { transform: scale(1.3); }

        .edit-input { background: rgba(255,255,255,0.1); border: 1.5px solid #667eea; border-radius: 10px; color: white; font-size: 14px; padding: 8px 12px; outline: none; width: 100%; min-width: 200px; transition: box-shadow 0.2s ease; }
        .edit-input:focus { box-shadow: 0 0 0 3px rgba(102,126,234,0.2); }
        .edit-actions { display: flex; gap: 6px; margin-top: 4px; }
        .save-btn { background: linear-gradient(135deg, #667eea, #764ba2); border: none; color: white; padding: 4px 12px; border-radius: 8px; font-size: 12px; cursor: pointer; font-weight: 600; transition: all 0.2s; position: relative; overflow: hidden; }
        .save-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(102,126,234,0.4); }
        .cancel-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); padding: 4px 12px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all 0.2s; }
        .cancel-btn:hover { background: rgba(255,255,255,0.2); }

        .typing-indicator { display: flex; align-items: center; gap: 8px; padding: 8px 16px; align-self: flex-start; animation: fadeIn 0.3s ease; }
        .typing-text { font-size: 12px; color: rgba(255,255,255,0.4); font-style: italic; }
        .typing-dots { display: flex; gap: 3px; align-items: center; }
        .typing-dot { width: 6px; height: 6px; background: rgba(255,255,255,0.4); border-radius: 50%; animation: typingBounce 1s ease infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }

        .empty-chat { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: rgba(255,255,255,0.2); }
        .empty-icon { font-size: 72px; animation: float 3s ease-in-out infinite; filter: drop-shadow(0 0 20px rgba(102,126,234,0.4)); }
        .empty-title { font-size: 22px; font-weight: 700; color: rgba(255,255,255,0.5); }
        .empty-sub { font-size: 14px; color: rgba(255,255,255,0.25); }
        .empty-hint { font-size: 12px; color: rgba(102,126,234,0.6); background: rgba(102,126,234,0.1); border: 1px solid rgba(102,126,234,0.2); padding: 8px 16px; border-radius: 20px; }

        /* ===== INPUT AREA ===== */
        .input-area { padding: 16px 28px 20px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.07); position: relative; }

        /* ===== EMOJI PICKER ===== */
        .emoji-picker-popup {
          position: absolute; bottom: 80px; left: 28px;
          background: rgba(15,15,35,0.98);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 16px; padding: 16px;
          z-index: 999; width: 320px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
          animation: slideDown 0.2s ease;
        }

        .emoji-picker-title { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }

        .emoji-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; max-height: 200px; overflow-y: auto; }
        .emoji-grid::-webkit-scrollbar { width: 4px; }
        .emoji-grid::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }

        .emoji-item { background: none; border: none; font-size: 20px; cursor: pointer; padding: 4px; border-radius: 6px; transition: all 0.15s ease; display: flex; align-items: center; justify-content: center; }
        .emoji-item:hover { background: rgba(255,255,255,0.1); transform: scale(1.3); }

        .emoji-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: white; width: 36px; height: 36px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: all 0.2s; flex-shrink: 0; }
        .emoji-btn:hover { background: rgba(255,255,255,0.15); transform: scale(1.05); }
        .emoji-btn.active { background: rgba(102,126,234,0.3); border-color: #667eea; }

        .input-row { display: flex; gap: 12px; align-items: center; background: rgba(255,255,255,0.06); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 6px 6px 6px 12px; transition: all 0.3s; }
        .input-row:focus-within { border-color: #667eea; background: rgba(102,126,234,0.08); box-shadow: 0 0 0 3px rgba(102,126,234,0.12); }
        .msg-input { flex: 1; background: transparent; border: none; color: white; font-size: 14px; outline: none; padding: 8px 0; }
        .msg-input::placeholder { color: rgba(255,255,255,0.3); }

        .send-btn { width: 42px; height: 42px; background: linear-gradient(135deg, #667eea, #764ba2); border: none; border-radius: 12px; color: white; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; position: relative; overflow: hidden; }
        .send-btn:hover { transform: scale(1.08); box-shadow: 0 4px 15px rgba(102,126,234,0.5); }
        .send-btn:active { transform: scale(0.95); }

        /* ===== NO SEARCH RESULTS ===== */
        .no-results { text-align: center; padding: 40px; color: rgba(255,255,255,0.3); font-size: 14px; }

        @media (max-width: 768px) {
          .chat-layout { flex-direction: column; }
          .sidebar { width: 100% !important; min-width: 100% !important; height: auto; opacity: 1 !important; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.07); flex-direction: row; align-items: center; padding: 10px 16px; gap: 12px; }
          .sidebar-logo { padding: 0; border-bottom: none; }
          .sidebar-section-title { display: none; }
          .room-item { display: none; }
          .sidebar-spacer { display: none; }
          .sidebar-user { border-top: none; padding: 0; flex: 1; justify-content: flex-end; }
          .chat-main { flex: 1; height: calc(100vh - 70px); }
          .chat-header { padding: 12px 16px; }
          .messages-area { padding: 16px; }
          .msg-row { max-width: 90%; }
          .input-area { padding: 12px 16px 16px; }
          .msg-count { display: none; }
          .sidebar-toggle { display: none; }
          .bg-picker-dropdown { right: 10px; }
          .emoji-picker-popup { width: 280px; left: 10px; }
          .search-bar { padding: 10px 16px; }
        }
      `}</style>

      <div className="chat-layout">
        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-row">
              <span className="logo-emoji">💬</span>
              <span className="logo-name">Nalantamil</span>
            </div>
          </div>
          <div className="sidebar-section-title">Channels</div>
          <div className="room-item">
            <span className="room-icon">🌐</span>
            <div className="room-info">
              <div className="room-name"># general</div>
              <div className="room-sub">Everyone is here</div>
            </div>
            {unreadCount > 0 && !isTabFocused ? (
              <div className="notif-badge">{unreadCount}</div>
            ) : (
              <div className="online-dot"></div>
            )}
          </div>
          <div className="sidebar-spacer"></div>
          <div className="sidebar-user">
            <div className="user-avatar">{getInitial(username)}</div>
            <div className="user-info">
              <div className="user-name">{username}</div>
              <div className="user-status">● Online</div>
            </div>
            <button className="logout-icon-btn ripple-btn" onClick={onLogout} title="Logout">⏻</button>
          </div>
        </div>

        {/* MAIN CHAT */}
        <div className="chat-main">
          <div className="chat-header">
            <button className="sidebar-toggle ripple-btn" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle Sidebar">
              {sidebarOpen ? '◀' : '▶'}
            </button>
            <div className="chat-header-avatar">🌐</div>
            <div className="chat-header-info">
              <div className="chat-header-name"># general</div>
              <div className="chat-header-status">
                <span className="status-dot"></span>
                Group Chat — Everyone online
              </div>
            </div>
            <div className="msg-count">{messages.filter(m => m.type !== 'system').length} messages</div>

            {/* SEARCH BUTTON */}
            <button className={`search-btn ripple-btn ${showSearch ? 'active' : ''}`} onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); }} title="Search Messages">
              🔍
            </button>

            {/* PIN BUTTON */}
            <button
              className={`pin-btn ripple-btn ${showPinned ? 'active' : ''}`}
              onClick={() => setShowPinned(!showPinned)}
              title="Pinned Messages"
            >
              📌
            </button>

            {/* BG PICKER */}
            <button className="bg-picker-btn ripple-btn" onClick={() => setShowBgPicker(!showBgPicker)} title="Change Background">
              🎨
            </button>

            {showBgPicker && (
              <div className="bg-picker-dropdown">
                <div className="bg-picker-title">Chat Background</div>
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

          {/* SEARCH BAR */}
          {showSearch && (
            <div className="search-bar">
              <input
                ref={searchInputRef}
                className="search-input"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <span className="search-results-count">
                  {filteredMessages.filter(m => m.type !== 'system').length} results
                </span>
              )}
              <button className="search-close" onClick={() => { setShowSearch(false); setSearchQuery(''); }}>✕</button>
            </div>
          )}

          {/* PINNED PANEL */}
          {showPinned && (
            <div className="pinned-panel">
              <div className="pinned-panel-title">
                📌 Pinned Messages
                {pinnedMessages.length > 0 && ` (${pinnedMessages.length})`}
              </div>
              {pinnedMessages.length === 0 ? (
                <div style={{color: 'rgba(255,255,255,0.3)', fontSize: '13px'}}>
                  No pinned messages yet. Hover a message and click 📌 to pin it!
                </div>
              ) : (
                pinnedMessages.map((p, i) => (
                  <div key={i} className="pinned-item">
                    <span className="pinned-item-icon">📌</span>
                    <div className="pinned-item-content">
                      <div className="pinned-item-text">{p.text}</div>
                      <div className="pinned-item-meta">by {p.username} • pinned by {p.pinned_by}</div>
                    </div>
                    <button className="unpin-btn" onClick={() => unpinMessage(p.message_id)}>✕</button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* MESSAGES */}
          <div className="messages-area">
            {filteredMessages.length === 0 && searchQuery ? (
              <div className="no-results">
                🔍 No messages found for "<strong>{searchQuery}</strong>"
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="empty-chat">
                <span className="empty-icon">💬</span>
                <div className="empty-title">No messages yet</div>
                <div className="empty-sub">Be the first one to say hello!</div>
                <div className="empty-hint">✨ Send a message below to start the conversation</div>
              </div>
            ) : (
              filteredMessages.map((msg, index) => {
                if (msg.type === 'system') {
                  return <div key={index} className="system-msg">— {msg.text} —</div>;
                }
                const isMine = msg.username === username;
                const isEditing = editingId === msg._id;
                const reactions = msg.reactions || {};
                const showDate = shouldShowDateSeparator(filteredMessages, index);
                const userMsgs = messages.filter(m => m.type !== 'system');
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
                      <div className="msg-avatar">{getInitial(msg.username)}</div>
                      <div className="msg-content">
                        {!isMine && <span className="msg-sender">{msg.username}</span>}
                        {isEditing ? (
                          <>
                            <input className="edit-input" value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEdit(msg._id)} autoFocus />
                            <div className="edit-actions">
                              <button className="save-btn ripple-btn" onClick={() => saveEdit(msg._id)}>Save</button>
                              <button className="cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="msg-bubble">
                              {searchQuery ? (
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
                              {/* SEEN STATUS */}
                              {isMine && (
                                <span className={`seen-status ${isLastMine ? '' : 'delivered'}`}>
                                  {isLastMine ? '✓✓' : '✓'}
                                </span>
                              )}
                              {isPinned(msg._id) && <span className="msg-pin-indicator">📌</span>}
                            </div>
                            {Object.keys(reactions).length > 0 && (
                              <div className="reactions-bar">
                                {Object.entries(reactions).map(([emoji, users]) =>
                                  users.length > 0 ? (
                                    <button key={emoji} className={`reaction-btn ${users.includes(username) ? 'reacted' : ''}`} onClick={() => addReaction(msg._id, emoji)}>
                                      {emoji} <span className="reaction-count">{users.length}</span>
                                    </button>
                                  ) : null
                                )}
                              </div>
                            )}
                            <div className="msg-actions">
                              <div className="reaction-picker">
                                {REACTIONS.map((emoji) => (
                                  <button key={emoji} className="reaction-pick-btn" onClick={() => addReaction(msg._id, emoji)}>{emoji}</button>
                                ))}
                              </div>
                              <button
                                className={`action-btn pin ripple-btn ${isPinned(msg._id) ? 'pinned' : ''}`}
                                onClick={() => isPinned(msg._id) ? unpinMessage(msg._id) : pinMessage(msg)}
                                title={isPinned(msg._id) ? 'Unpin' : 'Pin'}
                              >
                                {isPinned(msg._id) ? '📌' : '📍'}
                              </button>
                              {isMine && (
                                <>
                                  <button className="action-btn ripple-btn" onClick={() => startEdit(msg)}>✏️</button>
                                  <button className="action-btn delete ripple-btn" onClick={() => deleteMessage(msg._id)}>🗑️</button>
                                </>
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

          {/* INPUT AREA */}
          <div className="input-area">
            {/* EMOJI PICKER POPUP */}
            {showEmojiPicker && (
              <div className="emoji-picker-popup">
                <div className="emoji-picker-title">Pick an Emoji</div>
                <div className="emoji-grid">
                  {EMOJI_LIST.map((emoji, i) => (
                    <button key={i} className="emoji-item" onClick={() => { setInput(prev => prev + emoji); setShowEmojiPicker(false); }}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <form className="input-row" onSubmit={sendMessage}>
              <button type="button" className={`emoji-btn ${showEmojiPicker ? 'active' : ''}`} onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Emoji">
                😊
              </button>
              <input className="msg-input" type="text" placeholder="Message #general..." value={input} onChange={handleInputChange} />
              <button type="submit" className="send-btn ripple-btn">➤</button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default Chat;