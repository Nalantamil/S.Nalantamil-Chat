import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const socket = io('http://127.0.0.1:5000');

function Chat({ username, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];

  useEffect(() => {
      axios.get('http://127.0.0.1:5000/messages').then((res) => {
      setMessages(res.data);
    });

    socket.emit('join', { username });

    socket.on('message', (msg) => {
      setMessages((prev) => [...prev, { ...msg, reactions: {} }]);
    });

    socket.on('message_deleted', ({ message_id }) => {
      setMessages((prev) => prev.filter((m) => m._id !== message_id));
    });

    socket.on('message_edited', ({ message_id, text }) => {
      setMessages((prev) =>
        prev.map((m) => m._id === message_id ? { ...m, text, edited: true } : m)
      );
    });

    socket.on('reaction_updated', ({ message_id, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => m._id === message_id ? { ...m, reactions } : m)
      );
    });

    socket.on('user_typing', ({ username: typingUser }) => {
      setTypingUsers((prev) => {
        if (!prev.includes(typingUser)) return [...prev, typingUser];
        return prev;
      });
    });

    socket.on('user_stop_typing', ({ username: typingUser }) => {
      setTypingUsers((prev) => prev.filter((u) => u !== typingUser));
    });

    return () => {
      socket.off('message');
      socket.off('message_deleted');
      socket.off('message_edited');
      socket.off('reaction_updated');
      socket.off('user_typing');
      socket.off('user_stop_typing');
    };
  }, [username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

const handleInputChange = (e) => {
    setInput(e.target.value);
    if (e.target.value.trim()) {
      socket.emit('typing', { username });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing', { username });
      }, 1500);
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
  };

  const deleteMessage = (message_id) => {
    socket.emit('delete_message', { message_id });
  };

  const startEdit = (msg) => {
    setEditingId(msg._id);
    setEditText(msg.text);
  };

  const saveEdit = (message_id) => {
    if (!editText.trim()) return;
    socket.emit('edit_message', { message_id, text: editText });
    setEditingId(null);
    setEditText('');
  };

  const addReaction = (message_id, emoji) => {
    socket.emit('add_reaction', { message_id, emoji, username });
  };

const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp + 'Z');
    return date.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };
  const getInitial = (name) => name ? name[0].toUpperCase() : '?';

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

        body {
          background: linear-gradient(-45deg, #0f0c29, #302b63, #24243e, #1a1a2e);
          background-size: 400% 400%;
          animation: gradientShift 8s ease infinite;
        }

        .chat-layout {
          display: flex;
          height: 100vh;
          width: 100vw;
          font-family: 'Segoe UI', sans-serif;
          overflow: hidden;
        }

        .sidebar {
          width: 260px;
          min-width: 260px;
          background: rgba(0,0,0,0.35);
          border-right: 1px solid rgba(255,255,255,0.07);
          display: flex;
          flex-direction: column;
        }

        .sidebar-logo {
          padding: 28px 24px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }

        .logo-row { display: flex; align-items: center; gap: 10px; }

        .logo-emoji {
          font-size: 26px;
          filter: drop-shadow(0 0 8px rgba(102,126,234,0.9));
        }

        .logo-name {
          font-size: 20px;
          font-weight: 800;
          background: linear-gradient(135deg, #667eea, #f093fb);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: 2px;
        }

        .sidebar-section-title {
          padding: 20px 24px 10px;
          font-size: 11px;
          font-weight: 700;
          color: rgba(255,255,255,0.3);
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        .room-item {
          margin: 0 12px;
          padding: 12px 14px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(102,126,234,0.2);
          border: 1px solid rgba(102,126,234,0.3);
          cursor: pointer;
        }

        .room-icon { font-size: 18px; }
        .room-info { flex: 1; }
        .room-name { font-size: 14px; font-weight: 600; color: white; }
        .room-sub { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; }

        .online-dot {
          width: 8px; height: 8px;
          background: #2ecc71;
          border-radius: 50%;
          box-shadow: 0 0 6px #2ecc71;
        }

        .sidebar-spacer { flex: 1; }

        .sidebar-user {
          padding: 16px;
          border-top: 1px solid rgba(255,255,255,0.07);
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar {
          width: 38px; height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 700; color: white; flex-shrink: 0;
        }

        .user-info { flex: 1; overflow: hidden; }
        .user-name { font-size: 14px; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .user-status { font-size: 11px; color: #2ecc71; margin-top: 2px; }

        .logout-icon-btn {
          background: rgba(231,76,60,0.15);
          border: 1px solid rgba(231,76,60,0.3);
          color: #e74c3c;
          width: 34px; height: 34px;
          border-radius: 10px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; transition: all 0.2s; flex-shrink: 0;
        }

        .logout-icon-btn:hover { background: rgba(231,76,60,0.35); transform: scale(1.05); }

        .chat-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

        .chat-header {
          padding: 18px 28px;
          background: rgba(0,0,0,0.2);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; gap: 14px;
        }

        .chat-header-avatar {
          width: 42px; height: 42px; border-radius: 12px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          display: flex; align-items: center; justify-content: center; font-size: 20px;
        }

        .chat-header-info { flex: 1; }
        .chat-header-name { font-size: 16px; font-weight: 700; color: white; }
        .chat-header-status {
          font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 2px;
          display: flex; align-items: center; gap: 6px;
        }

        .status-dot { width: 7px; height: 7px; background: #2ecc71; border-radius: 50%; box-shadow: 0 0 5px #2ecc71; }
        .msg-count { font-size: 12px; color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.07); padding: 4px 12px; border-radius: 20px; }

        .messages-area {
          flex: 1; overflow-y: auto;
          padding: 24px 28px;
          display: flex; flex-direction: column; gap: 14px;
        }

        .messages-area::-webkit-scrollbar { width: 5px; }
        .messages-area::-webkit-scrollbar-track { background: transparent; }
        .messages-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }

        .system-msg {
          text-align: center; color: rgba(255,255,255,0.3); font-size: 12px;
          padding: 5px 14px; background: rgba(255,255,255,0.04);
          border-radius: 20px; align-self: center; animation: fadeIn 0.3s ease;
        }

        .msg-row {
          display: flex; gap: 10px;
          animation: fadeIn 0.3s ease;
          max-width: 70%; position: relative;
        }

        .msg-row.mine { align-self: flex-end; flex-direction: row-reverse; }
        .msg-row.theirs { align-self: flex-start; }

        .msg-avatar {
          width: 34px; height: 34px; border-radius: 50%;
          background: linear-gradient(135deg, #f093fb, #f5576c);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: white;
          flex-shrink: 0; align-self: flex-end;
        }

        .msg-row.mine .msg-avatar { background: linear-gradient(135deg, #667eea, #764ba2); }

        .msg-content { display: flex; flex-direction: column; gap: 4px; position: relative; }
        .msg-row.mine .msg-content { align-items: flex-end; }
        .msg-row.theirs .msg-content { align-items: flex-start; }

        .msg-sender { font-size: 11px; color: rgba(255,255,255,0.4); padding: 0 4px; }

        .msg-bubble {
          padding: 11px 16px; border-radius: 18px;
          font-size: 14px; line-height: 1.5;
          word-break: break-word; max-width: 100%; position: relative;
        }

        .msg-row.mine .msg-bubble {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white; border-bottom-right-radius: 4px;
          box-shadow: 0 4px 15px rgba(102,126,234,0.3);
        }

        .msg-row.theirs .msg-bubble {
          background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.9);
          border: 1px solid rgba(255,255,255,0.08); border-bottom-left-radius: 4px;
        }

        .msg-footer {
          display: flex; align-items: center; gap: 8px;
          padding: 0 4px;
        }

        .msg-time { font-size: 10px; color: rgba(255,255,255,0.3); }
        .edited-tag { font-size: 10px; color: rgba(255,255,255,0.3); font-style: italic; }

        .msg-actions {
          display: flex; gap: 6px; margin-top: 2px;
          opacity: 0; transition: opacity 0.2s;
        }

        .msg-row:hover .msg-actions { opacity: 1; }

        .action-btn {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.7);
          padding: 3px 10px; border-radius: 8px;
          font-size: 11px; cursor: pointer; transition: all 0.2s;
        }

        .action-btn:hover { background: rgba(255,255,255,0.2); color: white; }
        .action-btn.delete:hover { background: rgba(231,76,60,0.3); border-color: rgba(231,76,60,0.5); color: #e74c3c; }

        .reactions-bar {
          display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;
        }

        .reaction-btn {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 20px; padding: 2px 8px;
          font-size: 13px; cursor: pointer;
          transition: all 0.2s; color: white;
          display: flex; align-items: center; gap: 4px;
        }

        .reaction-btn:hover { background: rgba(255,255,255,0.18); transform: scale(1.1); }
        .reaction-btn.reacted { background: rgba(102,126,234,0.25); border-color: rgba(102,126,234,0.5); }

        .reaction-count { font-size: 11px; color: rgba(255,255,255,0.7); }

        .reaction-picker {
          display: flex; gap: 4px; margin-top: 4px;
          background: rgba(30,30,60,0.95);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px; padding: 4px 8px;
        }

        .reaction-pick-btn {
          background: none; border: none; font-size: 18px;
          cursor: pointer; transition: transform 0.2s;
          padding: 2px;
        }

        .reaction-pick-btn:hover { transform: scale(1.3); }

        .edit-input {
          background: rgba(255,255,255,0.1);
          border: 1.5px solid #667eea; border-radius: 10px;
          color: white; font-size: 14px; padding: 8px 12px;
          outline: none; width: 100%; min-width: 200px;
        }

        .edit-actions { display: flex; gap: 6px; margin-top: 4px; }

        .save-btn {
          background: linear-gradient(135deg, #667eea, #764ba2);
          border: none; color: white; padding: 4px 12px;
          border-radius: 8px; font-size: 12px; cursor: pointer; font-weight: 600;
        }

        .cancel-btn {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.7); padding: 4px 12px;
          border-radius: 8px; font-size: 12px; cursor: pointer;
        }

        .typing-indicator {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 16px; align-self: flex-start;
          animation: fadeIn 0.3s ease;
        }

        .typing-text { font-size: 12px; color: rgba(255,255,255,0.4); font-style: italic; }

        .typing-dots { display: flex; gap: 3px; align-items: center; }

        .typing-dot {
          width: 6px; height: 6px; background: rgba(255,255,255,0.4);
          border-radius: 50%;
          animation: typingBounce 1s ease infinite;
        }

        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }

        .empty-chat {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 14px; color: rgba(255,255,255,0.2);
        }

        .empty-icon { font-size: 56px; }
        .empty-title { font-size: 18px; font-weight: 600; }
        .empty-sub { font-size: 13px; }

        .input-area {
          padding: 16px 28px 20px;
          background: rgba(0,0,0,0.2);
          border-top: 1px solid rgba(255,255,255,0.07);
        }

        .input-row {
          display: flex; gap: 12px; align-items: center;
          background: rgba(255,255,255,0.06);
          border: 1.5px solid rgba(255,255,255,0.1);
          border-radius: 16px; padding: 6px 6px 6px 18px;
          transition: all 0.3s;
        }

        .input-row:focus-within {
          border-color: #667eea;
          background: rgba(102,126,234,0.08);
          box-shadow: 0 0 0 3px rgba(102,126,234,0.12);
        }

        .msg-input {
          flex: 1; background: transparent; border: none;
          color: white; font-size: 14px; outline: none; padding: 8px 0;
        }

        .msg-input::placeholder { color: rgba(255,255,255,0.3); }

        .send-btn {
          width: 42px; height: 42px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border: none; border-radius: 12px; color: white;
          font-size: 18px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; flex-shrink: 0;
        }

        .send-btn:hover { transform: scale(1.08); box-shadow: 0 4px 15px rgba(102,126,234,0.5); }
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
            <div className="online-dot"></div>
          </div>
          <div className="sidebar-spacer"></div>
          <div className="sidebar-user">
            <div className="user-avatar">{getInitial(username)}</div>
            <div className="user-info">
              <div className="user-name">{username}</div>
              <div className="user-status">● Online</div>
            </div>
            <button className="logout-icon-btn" onClick={onLogout} title="Logout">⏻</button>
          </div>
        </div>

        {/* MAIN CHAT */}
        <div className="chat-main">
          <div className="chat-header">
            <div className="chat-header-avatar">🌐</div>
            <div className="chat-header-info">
              <div className="chat-header-name"># general</div>
              <div className="chat-header-status">
                <span className="status-dot"></span>
                Group Chat — Everyone online
              </div>
            </div>
            <div className="msg-count">{messages.filter(m => m.type !== 'system').length} messages</div>
          </div>

          <div className="messages-area">
            {messages.length === 0 ? (
              <div className="empty-chat">
                <span className="empty-icon">👋</span>
                <span className="empty-title">Welcome to #general</span>
                <span className="empty-sub">Be the first one to say hello!</span>
              </div>
            ) : (
              messages.map((msg, index) => {
                if (msg.type === 'system') {
                  return <div key={index} className="system-msg">— {msg.text} —</div>;
                }
                const isMine = msg.username === username;
                const isEditing = editingId === msg._id;
                const reactions = msg.reactions || {};

                return (
                  <div key={msg._id || index} className={`msg-row ${isMine ? 'mine' : 'theirs'}`}>
                    <div className="msg-avatar">{getInitial(msg.username)}</div>
                    <div className="msg-content">
                      {!isMine && <span className="msg-sender">{msg.username}</span>}

                      {isEditing ? (
                        <>
                          <input
                            className="edit-input"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit(msg._id)}
                            autoFocus
                          />
                          <div className="edit-actions">
                            <button className="save-btn" onClick={() => saveEdit(msg._id)}>Save</button>
                            <button className="cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="msg-bubble">{msg.text}</div>

                          <div className="msg-footer">
                            <span className="msg-time">{formatTime(msg.timestamp)}</span>
                            {msg.edited && <span className="edited-tag">(edited)</span>}
                          </div>

                          {/* Reactions display */}
                          {Object.keys(reactions).length > 0 && (
                            <div className="reactions-bar">
                              {Object.entries(reactions).map(([emoji, users]) =>
                                users.length > 0 ? (
                                  <button
                                    key={emoji}
                                    className={`reaction-btn ${users.includes(username) ? 'reacted' : ''}`}
                                    onClick={() => addReaction(msg._id, emoji)}
                                  >
                                    {emoji} <span className="reaction-count">{users.length}</span>
                                  </button>
                                ) : null
                              )}
                            </div>
                          )}

                          {/* Reaction picker + edit/delete */}
                          <div className="msg-actions">
                            <div className="reaction-picker">
                              {REACTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  className="reaction-pick-btn"
                                  onClick={() => addReaction(msg._id, emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                            {isMine && (
                              <>
                                <button className="action-btn" onClick={() => startEdit(msg)}>✏️</button>
                                <button className="action-btn delete" onClick={() => deleteMessage(msg._id)}>🗑️</button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}

          {/* Typing indicator */}
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
            <form className="input-row" onSubmit={sendMessage}>
              <input
                className="msg-input"
                type="text"
                placeholder="Message #general..."
                value={input}
                onChange={handleInputChange}
              />
              <button type="submit" className="send-btn">➤</button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default Chat;