import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthContext';
import UserAvatar from '../components/UserAvatar';
import { formatRoleLabel } from '../utils/roles';

function Settings() {
  const { user, updateUser } = useAuth();
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  var API = '/api';

  async function handleTestNotification(e) {
    e.preventDefault();
    setSuccess('');
    setError('');

    try {
      await axios.post(API + '/notifications', {
        userId: user._id,
        title: notifTitle || 'Test Notification',
        message: notifMessage || 'This is a test notification',
        sendEmail: false
      });
      setSuccess('✅ Test notification sent! Check the bell icon.');
      setNotifTitle('');
      setNotifMessage('');
    } catch (err) {
      setError('Failed to send notification');
    }
  }

  async function handleBroadcast() {
    if (!window.confirm('Send notification to ALL users?')) return;

    try {
      var res = await axios.post(API + '/notifications/broadcast', {
        title: 'System Announcement',
        message: 'This is a broadcast message to all users.',
        sendEmail: false
      });
      setSuccess('✅ Broadcast sent to ' + res.data.count + ' users!');
    } catch (err) {
      setError('Failed to broadcast');
    }
  }

  async function handleAvatarChange(e) {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('avatar', file);

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const res = await axios.put(`${API}/users/${user._id}/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateUser(res.data?.user || res.data);
      setSuccess('Profile picture updated successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload profile picture');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function getRoleColor(role) {
    var r = (role || '').toUpperCase();
    if (r === 'ADMIN') return { bg: 'rgba(239,68,68,0.12)', color: '#dc2626' };
    if (r === 'HR') return { bg: 'rgba(168,85,247,0.12)', color: '#7c3aed' };
    if (r === 'TEAM_LEADER') return { bg: 'rgba(59,130,246,0.12)', color: '#2563eb' };
    return { bg: 'rgba(16,185,129,0.12)', color: '#059669' };
  }

  function formatRole(role) {
    return formatRoleLabel(role);
  }

  var roleStyle = getRoleColor(user.role);

  return (
    <div className="page" style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Toast-style messages */}
      {success && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '12px 18px', marginBottom: 20, color: '#166534', fontWeight: 600, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          ✅ {success}
        </div>
      )}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 18px', marginBottom: 20, color: '#991b1b', fontWeight: 600, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Profile Hero Card ── */}
      <div style={{
        background: 'var(--shell-bg-card, #fff)',
        border: '1px solid var(--shell-border, #e2e8f0)',
        borderRadius: 20,
        padding: '48px 40px 36px',
        marginBottom: 24,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(79,70,229,0.07)',
      }}>
        {/* Gradient banner */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 110,
          background: 'linear-gradient(135deg, #4F46E5 0%, #818CF8 50%, #6366f1 100%)',
          opacity: 0.92,
        }} />

        {/* Avatar */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
          <div style={{
            width: 110, height: 110, borderRadius: '50%',
            border: '4px solid #fff',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            background: '#e0e7ff',
            position: 'relative',
            cursor: 'pointer',
          }} onClick={function () { fileInputRef.current.click(); }}>
            <UserAvatar user={user} size={110} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            {/* Overlay hint */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.2s',
            }}
              onMouseOver={function (e) { e.currentTarget.style.opacity = '1'; }}
              onMouseOut={function (e) { e.currentTarget.style.opacity = '0'; }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </div>
        </div>

        <input type="file" accept="image/*" onChange={handleAvatarChange} ref={fileInputRef} style={{ display: 'none' }} />

        {/* Name + Role */}
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--shell-text, #0f172a)', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
          {user.name}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{
            padding: '5px 16px', borderRadius: 20, fontWeight: 700, fontSize: '0.85rem',
            background: roleStyle.bg, color: roleStyle.color,
            letterSpacing: '0.4px', textTransform: 'uppercase',
          }}>
            {formatRole(user.role)}
          </span>
        </div>
        <p style={{ color: 'var(--shell-text-secondary, #64748b)', fontSize: '0.92rem', margin: 0 }}>{user.email}</p>

        {/* Upload button */}
        <button
          onClick={function () { fileInputRef.current.click(); }}
          disabled={uploading}
          style={{
            marginTop: 20, padding: '9px 22px',
            background: uploading ? '#94a3b8' : 'linear-gradient(135deg, #4F46E5, #818CF8)',
            color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem',
            cursor: uploading ? 'not-allowed' : 'pointer',
            boxShadow: uploading ? 'none' : '0 3px 12px rgba(79,70,229,0.3)',
            transition: 'all 0.2s',
          }}
        >
          {uploading ? '⏳ Uploading...' : '📷 Change Profile Photo'}
        </button>
      </div>

      {/* ── Info + Actions Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Account Info */}
        <div style={{ background: 'var(--shell-bg-card, #fff)', border: '1px solid var(--shell-border, #e2e8f0)', borderRadius: 16, padding: '24px 28px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--shell-text, #0f172a)', margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>👤</span> Account Info
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Full Name', value: user.name },
              { label: 'Email', value: user.email },
              { label: 'Role', value: formatRole(user.role) },
              { label: 'User ID', value: user._id, mono: true },
            ].map(function (item) {
              return (
                <div key={item.label} style={{ borderBottom: '1px solid var(--shell-border, #f1f5f9)', paddingBottom: 12 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--shell-text-secondary, #64748b)', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontWeight: 500, color: 'var(--shell-text, #0f172a)', fontFamily: item.mono ? 'monospace' : 'inherit', fontSize: item.mono ? '0.78rem' : '0.95rem', wordBreak: 'break-all' }}>{item.value}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Test Notifications */}
        <div style={{ background: 'var(--shell-bg-card, #fff)', border: '1px solid var(--shell-border, #e2e8f0)', borderRadius: 16, padding: '24px 28px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--shell-text, #0f172a)', margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>🔔</span> Test Notifications
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--shell-text-secondary, #64748b)', margin: '0 0 16px' }}>Send yourself a test notification to verify the system.</p>
          <form onSubmit={handleTestNotification} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', color: 'var(--shell-text, #0f172a)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Title</label>
              <input type="text" value={notifTitle} onChange={function(e) { setNotifTitle(e.target.value); }} placeholder="Notification title" className="ent-input" />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', color: 'var(--shell-text, #0f172a)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Message</label>
              <textarea value={notifMessage} onChange={function(e) { setNotifMessage(e.target.value); }} placeholder="Notification message" rows={3} className="ent-input" style={{ resize: 'vertical' }} />
            </div>
            <button type="submit" style={{ padding: '10px 18px', background: 'linear-gradient(135deg, #4F46E5, #818CF8)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 3px 10px rgba(79,70,229,0.25)' }}>
              Send Test Notification
            </button>
          </form>
        </div>

        {/* Email Config */}
        <div style={{ background: 'var(--shell-bg-card, #fff)', border: '1px solid var(--shell-border, #e2e8f0)', borderRadius: 16, padding: '24px 28px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--shell-text, #0f172a)', margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>📧</span> Email Configuration
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ padding: '4px 12px', borderRadius: 20, background: '#fffbeb', color: '#d97706', fontWeight: 700, fontSize: '0.8rem' }}>⚠️ Configure in .env</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--shell-text-secondary, #64748b)', margin: '0 0 12px' }}>Add SMTP credentials to your backend .env file:</p>
          <pre style={{ background: 'var(--shell-bg-inset, #f8fafc)', borderRadius: 8, padding: '12px 16px', fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--shell-text, #0f172a)', border: '1px solid var(--shell-border, #e2e8f0)', overflowX: 'auto' }}>
{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-app-password`}
          </pre>
        </div>

        {/* System Info */}
        <div style={{ background: 'var(--shell-bg-card, #fff)', border: '1px solid var(--shell-border, #e2e8f0)', borderRadius: 16, padding: '24px 28px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--shell-text, #0f172a)', margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>📊</span> System Info
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Frontend', value: 'React + Vite' },
              { label: 'Backend', value: 'Node.js + Express' },
              { label: 'Database', value: 'MongoDB' },
              { label: 'API URL', value: API },
            ].map(function (item) {
              return (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--shell-border, #f1f5f9)' }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--shell-text-secondary, #64748b)', fontWeight: 500 }}>{item.label}</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--shell-text, #0f172a)' }}>{item.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Admin Actions (only for admin) */}
      {(user.role === 'admin' || user.role === 'ADMIN') && (
        <div style={{ background: 'linear-gradient(135deg, #fef2f2, #fff7ed)', border: '1px solid #fca5a5', borderRadius: 16, padding: '24px 28px', marginTop: 20, boxShadow: '0 2px 10px rgba(239,68,68,0.07)' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#991b1b', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>📢</span> Director Actions
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#b91c1c', margin: '0 0 16px' }}>Send a broadcast notification to all users in the system.</p>
          <button onClick={handleBroadcast} style={{ padding: '10px 22px', background: 'linear-gradient(135deg, #dc2626, #ef4444)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 3px 10px rgba(220,38,38,0.25)' }}>
            📢 Broadcast to All Users
          </button>
        </div>
      )}
    </div>
  );
}

export default Settings;
