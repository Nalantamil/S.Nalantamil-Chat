import React, { useState } from 'react';
import axios from 'axios';
import Chat from './Chat';

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState('');
  const [loggedInUser, setLoggedInUser] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    const url = isLogin
      ? 'https://s-nalantamil-chat.onrender.com/login'
      : 'https://s-nalantamil-chat.onrender.com/signup';
    try {
      const response = await axios.post(url, { username, password });
      setIsError(false);
      if (isLogin) {
        localStorage.setItem('token', response.data.token);
        setLoggedInUser(username);
      } else {
        setMessage('🎉 Account created! Please login.');
        setIsLogin(true);
      }
    } catch (error) {
      setIsError(true);
      setMessage('❌ ' + (error.response?.data?.error || 'Something went wrong'));
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setLoggedInUser(null);
    setUsername('');
    setPassword('');
    setMessage('');
  };

  if (loggedInUser) {
    return <Chat username={loggedInUser} onLogout={handleLogout} />;
  }

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        body {
          min-height: 100vh;
          background: linear-gradient(-45deg, #0f0c29, #302b63, #24243e, #1a1a2e, #0f3460, #533483);
          background-size: 400% 400%;
          animation: gradientShift 8s ease infinite;
        }
        .page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Segoe UI', sans-serif;
          position: relative;
          overflow: hidden;
        }
        .blob { position: absolute; border-radius: 50%; filter: blur(80px); animation: pulse 4s ease-in-out infinite; pointer-events: none; }
        .blob1 { width: 400px; height: 400px; background: rgba(102,126,234,0.3); top: -100px; left: -100px; }
        .blob2 { width: 300px; height: 300px; background: rgba(118,75,162,0.3); bottom: -80px; right: -80px; animation-delay: 2s; }
        .blob3 { width: 200px; height: 200px; background: rgba(79,172,254,0.2); top: 50%; left: 50%; animation-delay: 1s; }
        .card { background: rgba(255,255,255,0.08); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.15); border-radius: 24px; padding: 48px 40px; width: 400px; box-shadow: 0 25px 50px rgba(0,0,0,0.5); animation: slideIn 0.6s ease; position: relative; z-index: 10; }
        .logo-area { text-align: center; margin-bottom: 32px; animation: float 6s ease-in-out infinite; }
        .logo-icon { font-size: 52px; display: block; margin-bottom: 10px; filter: drop-shadow(0 0 20px rgba(102,126,234,0.8)); }
        .logo-text { font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #667eea, #f093fb); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: 2px; }
        .logo-sub { color: rgba(255,255,255,0.5); font-size: 13px; margin-top: 4px; letter-spacing: 1px; }
        .tabs { display: flex; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 4px; margin-bottom: 28px; border: 1px solid rgba(255,255,255,0.08); }
        .tab { flex: 1; padding: 10px; text-align: center; border-radius: 9px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.3s ease; color: rgba(255,255,255,0.5); border: none; background: transparent; }
        .tab.active { background: linear-gradient(135deg, #667eea, #764ba2); color: white; box-shadow: 0 4px 15px rgba(102,126,234,0.4); }
        .input-group { margin-bottom: 18px; position: relative; }
        .input-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); font-size: 18px; z-index: 1; }
        .input-field { width: 100%; padding: 14px 14px 14px 46px; background: rgba(255,255,255,0.07); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; font-size: 14px; outline: none; transition: all 0.3s ease; }
        .input-field::placeholder { color: rgba(255,255,255,0.35); }
        .input-field.focused { border-color: #667eea; background: rgba(102,126,234,0.1); box-shadow: 0 0 0 3px rgba(102,126,234,0.15); }
        .submit-btn { width: 100%; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 8px; transition: all 0.3s ease; letter-spacing: 1px; }
        .submit-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(102,126,234,0.5); }
        .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
        .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; vertical-align: middle; margin-right: 8px; }
        .message { text-align: center; margin-top: 16px; padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 500; }
        .message.success { background: rgba(39,174,96,0.15); border: 1px solid rgba(39,174,96,0.3); color: #2ecc71; }
        .message.error { background: rgba(231,76,60,0.15); border: 1px solid rgba(231,76,60,0.3); color: #e74c3c; }
        .divider { display: flex; align-items: center; margin: 20px 0; gap: 12px; }
        .divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.1); }
        .divider-text { color: rgba(255,255,255,0.3); font-size: 12px; }
        .footer-text { text-align: center; color: rgba(255,255,255,0.4); font-size: 13px; margin-top: 4px; }
        .footer-link { color: #667eea; cursor: pointer; font-weight: 600; }
        .footer-link:hover { color: #f093fb; }
      `}</style>

      <div className="page">
        <div className="blob blob1"></div>
        <div className="blob blob2"></div>
        <div className="blob blob3"></div>
        <div className="card">
          <div className="logo-area">
            <span className="logo-icon">💬</span>
            <div className="logo-text">Nalantamil</div>
            <div className="logo-sub">Chat · Connect · Celebrate</div>
          </div>
          <div className="tabs">
            <button className={`tab ${isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(true); setMessage(''); }}>Login</button>
            <button className={`tab ${!isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(false); setMessage(''); }}>Signup</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <span className="input-icon">👤</span>
              <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} onFocus={() => setFocusedInput('username')} onBlur={() => setFocusedInput('')} className={`input-field ${focusedInput === 'username' ? 'focused' : ''}`} required />
            </div>
            <div className="input-group">
              <span className="input-icon">🔒</span>
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setFocusedInput('password')} onBlur={() => setFocusedInput('')} className={`input-field ${focusedInput === 'password' ? 'focused' : ''}`} required />
            </div>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading && <span className="spinner"></span>}
              {loading ? 'Please wait...' : (isLogin ? '🚀 Login' : '✨ Create Account')}
            </button>
          </form>
          {message && <div className={`message ${isError ? 'error' : 'success'}`}>{message}</div>}
          <div className="divider"><div className="divider-line"></div><span className="divider-text">or</span><div className="divider-line"></div></div>
          <p className="footer-text">
            {isLogin ? "New here? " : "Already have an account? "}
            <span className="footer-link" onClick={() => { setIsLogin(!isLogin); setMessage(''); }}>
              {isLogin ? 'Create an account →' : '← Back to Login'}
            </span>
          </p>
        </div>
      </div>
    </>
  );
}

export default App;