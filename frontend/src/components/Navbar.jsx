import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Notifications from './Notifications';

function Navbar() {
  var { user, logout } = useAuth();
  var navigate = useNavigate();
  var location = useLocation();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function isActive(path) {
    return location.pathname === path ? 'nav-link active' : 'nav-link';
  }

  if (!user) {
    return (
      <nav className="navbar">
        <div className="navbar-brand">
          <Link to="/login">HR Management</Link>
        </div>
        <div className="navbar-links">
          <Link to="/login" className={isActive('/login')}>Login</Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/dashboard">HR Management</Link>
      </div>
      <div className="navbar-links">
        <Link to="/dashboard" className={isActive('/dashboard')}>Dashboard</Link>
        <Link to="/cycles" className={isActive('/cycles')}>Cycles</Link>
        <Link to="/objectives" className={isActive('/objectives')}>Objectives</Link>

        <Link to="/evaluations" className={isActive('/evaluations')}>Evaluations</Link>
        {(user.role === 'ADMIN' || user.role === 'TEAM_LEADER') && (
          <Link to="/validation" className={isActive('/validation')}>Validate</Link>
        )}
        {(user.role === 'ADMIN' || user.role === 'TEAM_LEADER') && (
          <Link to="/hr-decisions" className={isActive('/hr-decisions')}>HR Decisions</Link>
        )}
        <Link to="/teams" className={isActive('/teams')}>Teams</Link>
        <Link to="/users" className={isActive('/users')}>Users</Link>
        <Link to="/settings" className={isActive('/settings')}>Settings</Link>
        <Notifications />
        <div className="user-menu">
          <span className="user-info">{user.name} ({user.role})</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;