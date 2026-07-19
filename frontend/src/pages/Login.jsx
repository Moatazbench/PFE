import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { useTheme } from '../components/ThemeContext';
import { preloadRoute } from '../routes/routeConfig';

function Login() {
  const { darkMode, toggleDarkMode } = useTheme();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanEmail = formData.email.trim().toLowerCase();

    if (!/^([\w.-]+)@biat\.com$/.test(cleanEmail)) {
      setError('Email must end with @biat.com');
      setLoading(false);
      return;
    }

    try {
      preloadRoute('/dashboard');

      // Use AuthContext login - it handles the API call, token storage, and user state
      var result = await login(cleanEmail, formData.password);

      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  }

  return (
    <div className="auth-page page-enter">
      <button
        onClick={toggleDarkMode}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          padding: '8px 16px',
          borderRadius: '20px',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
          color: 'var(--text-dark)',
          cursor: 'pointer',
          zIndex: 10,
          boxShadow: 'var(--shadow-sm)',
          fontFamily: 'var(--font-retro)',
          fontSize: '0.9rem'
        }}
      >
        {darkMode ? 'Normal Mode' : 'Retro Dark Mode'}
      </button>
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo auth-logo--brand" aria-hidden="true">
            <svg className="auth-logo__svg" viewBox="0 0 240 240" role="img">
              <defs>
                <linearGradient id="loginLogoBg" x1="18" y1="222" x2="222" y2="18" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#051344" />
                  <stop offset="0.52" stopColor="#17208a" />
                  <stop offset="1" stopColor="#6d28d9" />
                </linearGradient>
                <linearGradient id="loginLogoAccent" x1="52" y1="168" x2="196" y2="70" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#5b21ff" />
                  <stop offset="0.45" stopColor="#0284ff" />
                  <stop offset="1" stopColor="#22e6ff" />
                </linearGradient>
                <linearGradient id="loginLogoText" x1="78" y1="205" x2="178" y2="205" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset="0.52" stopColor="#039bff" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <rect x="8" y="8" width="224" height="224" rx="44" fill="url(#loginLogoBg)" />
              <path
                d="M48 170V66c0-9 7-16 16-16h55c37 0 63 23 63 56 0 25-13 43-36 51v-21c12-6 19-17 19-30 0-20-17-35-43-35H76v99c0 14-10 24-28 24z"
                fill="#fff"
              />
              <rect x="83" y="116" width="13" height="35" rx="3" fill="#05aaff" />
              <rect x="105" y="103" width="13" height="44" rx="3" fill="#3468ff" />
              <rect x="127" y="87" width="13" height="55" rx="3" fill="#7c3cff" />
              <path
                d="M49 171c46-9 90-30 125-62l-17-7 40-20-6 43-13-13c-33 40-75 63-129 78z"
                fill="url(#loginLogoAccent)"
              />
              <path
                d="M171 147l24-34 16 15v21c0 5-4 9-9 9h-22v38c0 5-4 9-9 9h-16c-5 0-9-4-9-9v-38z"
                fill="#049bff"
              />
              <text x="46" y="215" fill="#fff" fontFamily="Arial, Helvetica, sans-serif" fontSize="19" fontWeight="800" letterSpacing="8">PERF</text>
              <text x="123" y="215" fill="url(#loginLogoText)" fontFamily="Arial, Helvetica, sans-serif" fontSize="19" fontWeight="900" letterSpacing="3">TRACK</text>
            </svg>
          </div>
          <div className="auth-brand-eyebrow">BIAT Performance Suite</div>
          <h1>Perf Track</h1>
          <p>Sign in to your account</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@biat.com"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>


      </div>
    </div>
  );
}

export default Login;
