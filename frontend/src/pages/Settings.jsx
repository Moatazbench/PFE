import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../components/AuthContext';
import UserAvatar from '../components/UserAvatar';

function Settings() {
  const { user, updateUser } = useAuth();
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  var API = 'http://localhost:5000';

  async function handleTestNotification(e) {
    e.preventDefault();
    setSuccess('');
    setError('');

    try {
      await axios.post(API + '/api/notifications', {
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
      var res = await axios.post(API + '/api/notifications/broadcast', {
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
      const res = await axios.put(`${API}/api/users/${user._id}/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateUser(res.data);
      setSuccess('Profile picture updated successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload profile picture');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function getRoleBadgeColor(role) {
    if (role === 'admin') return '#e74c3c';
    if (role === 'manager') return '#3498db';
    return '#27ae60';
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>⚙️ Settings</h1>
      </div>

      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}

      <div className="settings-grid">
        <div className="settings-section">
          <h2>👤 Profile Information</h2>
          <div className="profile-info">
            <div className="profile-item" style={{ alignItems: 'flex-start' }}>
              <span className="profile-label">Avatar:</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <UserAvatar user={user} size={80} style={{ border: '2px solid #e2e8f0' }} />
                <input type="file" accept="image/*" onChange={handleAvatarChange} ref={fileInputRef} style={{ display: 'none' }} />
                <button onClick={function() { fileInputRef.current.click(); }} disabled={uploading} style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', width: 'fit-content' }}>
                  {uploading ? 'Uploading...' : 'Change Picture'}
                </button>
              </div>
            </div>
            <div className="profile-item">
              <span className="profile-label">Name:</span>
              <span className="profile-value">{user.name}</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Email:</span>
              <span className="profile-value">{user.email}</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Role:</span>
              <span className="role-badge" style={{ backgroundColor: getRoleBadgeColor(user.role) }}>
                {user.role}
              </span>
            </div>
            <div className="profile-item">
              <span className="profile-label">User ID:</span>
              <span className="profile-value" style={{ fontSize: '0.85rem', color: '#666' }}>{user._id}</span>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2>🔔 Test Notifications</h2>
          <p className="section-desc">Send yourself a test notification to verify the system is working.</p>
          <form onSubmit={handleTestNotification}>
            <div className="form-group">
              <label>Title:</label>
              <input
                type="text"
                value={notifTitle}
                onChange={function(e) { setNotifTitle(e.target.value); }}
                placeholder="Notification title"
              />
            </div>
            <div className="form-group">
              <label>Message:</label>
              <textarea
                value={notifMessage}
                onChange={function(e) { setNotifMessage(e.target.value); }}
                placeholder="Notification message"
                rows={3}
              />
            </div>
            <button type="submit" className="submit-btn">Send Test Notification</button>
          </form>
        </div>

        {(user.role === 'admin') && (
          <div className="settings-section">
            <h2>📢 Admin Actions</h2>
            <p className="section-desc">Send a broadcast notification to all users in the system.</p>
            <button onClick={handleBroadcast} className="broadcast-btn">
              📢 Broadcast to All Users
            </button>
          </div>
        )}

        <div className="settings-section">
          <h2>📧 Email Configuration</h2>
          <div className="config-status">
            <p>Email notifications status:</p>
            <span className="status-indicator warning">⚠️ Configure in backend .env</span>
          </div>
          <p className="settings-note">
            To enable email notifications, add SMTP credentials to your backend .env file:
          </p>
          <pre className="code-block">
{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password`}
          </pre>
        </div>

        <div className="settings-section">
          <h2>📊 System Information</h2>
          <div className="system-info">
            <div className="info-item">
              <span>Frontend:</span>
              <span>React + Vite</span>
            </div>
            <div className="info-item">
              <span>Backend:</span>
              <span>Node.js + Express</span>
            </div>
            <div className="info-item">
              <span>Database:</span>
              <span>MongoDB</span>
            </div>
            <div className="info-item">
              <span>API URL:</span>
              <span>{API}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;