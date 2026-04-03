// middleware/role.js - Strict RBAC Enforcement
module.exports = function (...roles) {
  // Handle both role(['ADMIN']) and role('ADMIN', 'HR')
  const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;

  return function (req, res, next) {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No role specified' });
    }

    const currentRole = req.user.role; // e.g., 'ADMIN', 'HR', 'TEAM_LEADER', 'COLLABORATOR'

    // Admin passes all role checks
    if (currentRole === 'ADMIN') {
      return next();
    }

    // Check if the user's role is strictly in the allowed array
    if (!allowedRoles.includes(currentRole)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};