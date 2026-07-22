import React, { useState, useEffect } from 'react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ username: '', password: '' });
  const [forgotMsg, setForgotMsg] = useState('');
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [errorAction, setErrorAction] = useState(null); // { label, onClick }

  // Load remembered username on mount
  useEffect(() => {
    const remembered = localStorage.getItem('rememberedUsername');
    if (remembered) {
      setUsername(remembered);
      setRememberMe(true);
    }
  }, []);

  // Restore session on page load/refresh if a valid token + username exist
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('authUsername');
    if (token && savedUser) {
      setLoggedInUser(savedUser);
    }
  }, []);

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
    if (score === 2) return { label: 'Medium', level: 2 };
    if (score <= 4) return { label: 'Strong', level: 3 };
    return { label: 'Very Strong', level: 4 };
  };

  const passwordChecks = getPasswordChecks(password);

  const passwordStrength = getPasswordStrength(password);

  const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

  const validateFields = () => {
    const errors = { username: '', password: '' };
    let valid = true;

    if (!username.trim()) {
      errors.username = 'Username required';
      valid = false;
    } else if (!isLogin && !USERNAME_PATTERN.test(username.trim())) {
      errors.username = '3-20 characters · letters, numbers, underscore only';
      valid = false;
    }

    if (!password) {
      errors.password = 'Password required';
      valid = false;
    } else if (!isLogin && password.length < 8) {
      errors.password = 'Password must contain at least 8 characters';
      valid = false;
    }

    setFieldErrors(errors);
    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setForgotMsg('');
    setErrorAction(null);

    if (!validateFields()) return;

    setLoading(true);
    const url = isLogin
      ? 'https://s-nalantamil-chat.onrender.com/login'
      : 'https://s-nalantamil-chat.onrender.com/signup';
    try {
      const response = await axios.post(url, { username, password });
      setIsError(false);
      if (isLogin) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('authUsername', username);
        if (rememberMe) {
          localStorage.setItem('rememberedUsername', username);
        } else {
          localStorage.removeItem('rememberedUsername');
        }
        setLoading(false);
        setLoginSuccess(true);
        setTimeout(() => setLoggedInUser(username), 900);
        return;
      } else {
        setMessage('🎉 Account created! Please login.');
        setIsLogin(true);
      }
    } catch (error) {
      setIsError(true);
      const rawMsg = error.response?.data?.error || 'Something went wrong';
      const lower = rawMsg.toLowerCase();
      if (lower.includes('password')) {
        setMessage('❌ Incorrect password.');
        setErrorAction({ label: 'Forgot your password?', onClick: handleForgotPassword });
      } else if (lower.includes('user') || lower.includes('exist') || lower.includes('not found')) {
        setMessage(`❌ ${rawMsg}`);
        setErrorAction({ label: 'Create an account?', onClick: () => { setIsLogin(false); setMessage(''); setErrorAction(null); } });
      } else {
        setMessage('❌ ' + rawMsg);
      }
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authUsername');
    setLoggedInUser(null);
    setLoginSuccess(false);
    setUsername('');
    setPassword('');
    setMessage('');
  };

  const handleForgotPassword = () => {
    setForgotMsg('🔧 Password reset is coming soon — please contact support for now.');
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
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
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
        .logo-icon { font-size: 62px; display: block; margin-bottom: 10px; filter: drop-shadow(0 0 20px rgba(102,126,234,0.8)); }
        .logo-text { font-size: 33px; font-weight: 800; background: linear-gradient(135deg, #667eea, #f093fb); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: 2px; }
        .logo-sub { color: rgba(255,255,255,0.5); font-size: 13px; margin-top: 4px; letter-spacing: 1px; }
        .tabs { display: flex; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 4px; margin-bottom: 28px; border: 1px solid rgba(255,255,255,0.08); }
        .tab { flex: 1; padding: 10px; text-align: center; border-radius: 9px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.3s ease; color: rgba(255,255,255,0.5); border: none; background: transparent; }
        .tab.active { background: linear-gradient(135deg, #667eea, #764ba2); color: white; box-shadow: 0 4px 15px rgba(102,126,234,0.4); }
        .input-group { margin-bottom: 6px; position: relative; }
        .input-icon { position: absolute; left: 16px; top: 26px; transform: translateY(-50%); font-size: 18px; z-index: 1; }
        .input-field { width: 100%; padding: 14px 44px 14px 46px; background: rgba(255,255,255,0.07); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; font-size: 14px; outline: none; transition: all 0.3s ease; }
        .input-field::placeholder { color: rgba(255,255,255,0.35); }
        .input-field.focused { border-color: #667eea; background: rgba(102,126,234,0.1); box-shadow: 0 0 0 3px rgba(102,126,234,0.15); }
        .input-field.field-error { border-color: #e74c3c; }
        .field-error-text { color: #e74c3c; font-size: 12px; margin: 4px 2px 12px; display: flex; align-items: center; gap: 4px; animation: shake 0.3s ease; }
        .password-toggle-btn { position: absolute; right: 14px; top: 26px; transform: translateY(-50%); background: none; border: none; color: rgba(255,255,255,0.5); font-size: 13px; cursor: pointer; font-weight: 600; letter-spacing: 0.5px; padding: 4px; transition: color 0.2s ease; }
        .password-toggle-btn:hover { color: #667eea; }
        .strength-bar-wrap { display: flex; gap: 4px; margin: 6px 2px 12px; }
        .strength-bar { flex: 1; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.1); transition: background 0.3s ease; }
        .strength-bar.filled-weak { background: #e74c3c; }
        .strength-bar.filled-medium { background: #f39c12; }
        .strength-bar.filled-strong { background: #2ecc71; }
        .strength-bar.filled-verystrong { background: #00d4aa; }
        .strength-label { font-size: 11px; margin: -8px 2px 4px; font-weight: 600; }
        .strength-label.weak { color: #e74c3c; }
        .strength-label.medium { color: #f39c12; }
        .strength-label.strong { color: #2ecc71; }
        .strength-label.verystrong { color: #00d4aa; }
        .form-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .remember-me { display: flex; align-items: center; gap: 7px; color: rgba(255,255,255,0.5); font-size: 13px; cursor: pointer; user-select: none; }
        .remember-me input { accent-color: #667eea; width: 15px; height: 15px; cursor: pointer; }
        .forgot-link { color: #667eea; font-size: 13px; font-weight: 600; cursor: pointer; background: none; border: none; }
        .forgot-link:hover { color: #f093fb; }
        .forgot-msg { text-align: center; margin: -10px 0 16px; padding: 8px 14px; border-radius: 10px; font-size: 12px; background: rgba(102,126,234,0.12); border: 1px solid rgba(102,126,234,0.25); color: #a5b4f5; }
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

        /* ===== USERNAME HINT ===== */
        .field-hint { color: rgba(255,255,255,0.35); font-size: 11px; margin: 4px 2px 12px; }

        /* ===== PASSWORD CHECKLIST ===== */
        .password-checklist { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 8px 2px 12px; }
        .check-item { font-size: 11px; display: flex; align-items: center; gap: 4px; color: rgba(255,255,255,0.3); transition: color 0.2s ease; }
        .check-item.met { color: #2ecc71; }

        /* ===== ERROR ACTION LINK ===== */
        .error-action-link { display: block; text-align: center; margin-top: -8px; margin-bottom: 8px; color: #667eea; font-size: 13px; font-weight: 600; cursor: pointer; background: none; border: none; }
        .error-action-link:hover { color: #f093fb; }

        /* ===== SUCCESS OVERLAY ===== */
        @keyframes checkPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .success-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 40px 20px; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .success-check { width: 64px; height: 64px; border-radius: 50%; background: rgba(46,204,113,0.15); border: 2px solid #2ecc71; display: flex; align-items: center; justify-content: center; font-size: 32px; color: #2ecc71; animation: checkPop 0.5s ease; }
        .success-title { font-size: 18px; font-weight: 700; color: white; }
        .success-sub { font-size: 13px; color: rgba(255,255,255,0.5); display: flex; align-items: center; gap: 8px; }

        @media (max-width: 480px) {
          .page { padding: 16px; }
          .card { width: 100%; max-width: 380px; padding: 32px 24px; border-radius: 20px; }
          .logo-icon { font-size: 48px; }
          .logo-text { font-size: 26px; letter-spacing: 1px; }
          .logo-sub { font-size: 12px; }
          .tabs { margin-bottom: 22px; }
          .tab { padding: 9px; font-size: 13px; }
          .input-field { padding: 12px 40px 12px 42px; font-size: 13px; }
          .input-icon { left: 14px; top: 23px; font-size: 16px; }
          .password-toggle-btn { right: 12px; top: 23px; font-size: 12px; }
          .form-row { flex-direction: column; align-items: flex-start; gap: 10px; }
          .submit-btn { padding: 13px; font-size: 15px; }
          .strength-bar-wrap { margin: 6px 2px 10px; }
          .strength-label { font-size: 10px; }
          .field-error-text { font-size: 11px; }
          .message { font-size: 12px; padding: 9px 14px; }
          .forgot-msg { font-size: 11px; padding: 8px 12px; }
          .footer-text { font-size: 12px; }
          .blob1 { width: 250px; height: 250px; }
          .blob2 { width: 200px; height: 200px; }
          .blob3 { width: 140px; height: 140px; }
        }

        @media (max-width: 340px) {
          .card { padding: 24px 18px; }
          .logo-icon { font-size: 40px; }
          .logo-text { font-size: 22px; }
        }
      `}</style>

      <div className="page">
        <div className="blob blob1"></div>
        <div className="blob blob2"></div>
        <div className="blob blob3"></div>
        <div className="card">
          {loginSuccess ? (
            <div className="success-screen">
              <div className="success-check">✓</div>
              <div className="success-title">Login Successful</div>
              <div className="success-sub"><span className="spinner"></span> Redirecting...</div>
            </div>
          ) : (
          <>
          <div className="logo-area">
            <span className="logo-icon">💬</span>
            <div className="logo-text">Nalantamil</div>
            <div className="logo-sub">Chat · Connect · Celebrate</div>
          </div>
          <div className="tabs">
            <button className={`tab ${isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(true); setMessage(''); setForgotMsg(''); setFieldErrors({ username: '', password: '' }); }}>Login</button>
            <button className={`tab ${!isLogin ? 'active' : ''}`} onClick={() => { setIsLogin(false); setMessage(''); setForgotMsg(''); setFieldErrors({ username: '', password: '' }); }}>Signup</button>
          </div>
          <form onSubmit={handleSubmit} noValidate>
            <div className="input-group">
              <span className="input-icon">👤</span>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setFieldErrors(prev => ({ ...prev, username: '' })); }}
                onFocus={() => setFocusedInput('username')}
                onBlur={() => setFocusedInput('')}
                className={`input-field ${focusedInput === 'username' ? 'focused' : ''} ${fieldErrors.username ? 'field-error' : ''}`}
              />
            </div>
            {fieldErrors.username && <div className="field-error-text">❌ {fieldErrors.username}</div>}
            {!isLogin && !fieldErrors.username && (
              <div className="field-hint">3-20 characters · Letters, numbers, underscore</div>
            )}

            <div className="input-group">
              <span className="input-icon">🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: '' })); }}
                onFocus={() => setFocusedInput('password')}
                onBlur={() => setFocusedInput('')}
                className={`input-field ${focusedInput === 'password' ? 'focused' : ''} ${fieldErrors.password ? 'field-error' : ''}`}
              />
              <button type="button" className="password-toggle-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? '🙈 Hide' : '👁 Show'}
              </button>
            </div>
            {fieldErrors.password && <div className="field-error-text">❌ {fieldErrors.password}</div>}

            {!isLogin && password && (
              <>
                <div className="strength-bar-wrap">
                  {[1, 2, 3, 4].map(tier => (
                    <div key={tier} className={`strength-bar ${passwordStrength.level >= tier ? `filled-${passwordStrength.label.toLowerCase().replace(' ', '')}` : ''}`}></div>
                  ))}
                </div>
                <div className={`strength-label ${passwordStrength.label.toLowerCase().replace(' ', '')}`}>
                  Password Strength: {passwordStrength.label}
                </div>
                <div className="password-checklist">
                  <span className={`check-item ${passwordChecks.length ? 'met' : ''}`}>{passwordChecks.length ? '✓' : '○'} 8+ characters</span>
                  <span className={`check-item ${passwordChecks.uppercase ? 'met' : ''}`}>{passwordChecks.uppercase ? '✓' : '○'} Uppercase</span>
                  <span className={`check-item ${passwordChecks.number ? 'met' : ''}`}>{passwordChecks.number ? '✓' : '○'} Number</span>
                  <span className={`check-item ${passwordChecks.special ? 'met' : ''}`}>{passwordChecks.special ? '✓' : '○'} Special character</span>
                </div>
              </>
            )}

            {isLogin && (
              <div className="form-row">
                <label className="remember-me">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  Remember Me
                </label>
                <button type="button" className="forgot-link" onClick={handleForgotPassword}>Forgot Password?</button>
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading && <span className="spinner"></span>}
              {loading ? 'Please wait...' : (isLogin ? '🚀 Login' : '✨ Create Account')}
            </button>
          </form>
          {forgotMsg && <div className="forgot-msg">{forgotMsg}</div>}
          {message && <div className={`message ${isError ? 'error' : 'success'}`}>{message}</div>}
          {errorAction && <button className="error-action-link" onClick={errorAction.onClick}>{errorAction.label}</button>}
          <div className="divider"><div className="divider-line"></div><span className="divider-text">or</span><div className="divider-line"></div></div>
          <p className="footer-text">
            {isLogin ? "New here? " : "Already have an account? "}
            <span className="footer-link" onClick={() => { setIsLogin(!isLogin); setMessage(''); setForgotMsg(''); setFieldErrors({ username: '', password: '' }); }}>
              {isLogin ? 'Create an account →' : '← Back to Login'}
            </span>
          </p>
          </>
          )}
        </div>
      </div>
    </>
  );
}

export default App;