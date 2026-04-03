import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { useTheme } from '../components/ThemeContext';

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
      // Use AuthContext login — it handles the API call, token storage, and user state
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
    <div className="auth-page">
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
        {darkMode ? '☀️ Normal Mode' : '🌙 Retro Dark Mode'}
      </button>
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">🏢</div>
          <h1>HR Management System</h1>
          <p>Sign in to your account</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label>📧 Email Address</label>
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
              <label>🔒 Password</label>
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

        <div className="demo-accounts">
          <p className="demo-title">Demo Accounts:</p>
          <div className="demo-list">
            <span>👑 admin@biat.com / Admin123!</span>
            <span>🟣 hr@biat.com / HR123!</span>
            <span>🔵 leader@biat.com / Leader123!</span>
            <span>🟢 collaborator@biat.com / Collab123!</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;