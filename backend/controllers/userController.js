const User = require('../models/User');
const bcrypt = require('bcryptjs');

// ========== GET ALL (Admin Only) ==========
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ isDeleted: false })
      .select('-password')
      .populate('team', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error fetching users' }); }
};

// ========== GET SINGLE ==========
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, isDeleted: false })
      .select('-password')
      .populate('team', 'name');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
};

// ========== FILTERED LIST (Dropdowns) ==========
exports.getUsers = async (req, res) => {
  try {
    const { role, excludeAssigned } = req.query;
    let filter = { isDeleted: false };
    
    if (role) {
      // Logic fix: Ensure role matching handles the UPPERCASE enums used in DB
      const roles = role.split(',').map(r => r.trim().toUpperCase());
      filter.role = { $in: roles };
    }
    
    if (excludeAssigned === 'true') {
      filter.team = { $in: [null, undefined] };
    }
    
    const users = await User.find(filter)
      .select('_id name email role')
      .sort({ name: 1 });
    
    res.json({ success: true, users });
  } catch (err) { res.status(500).json({ success: false, message: 'Error fetching filtered users' }); }
};

// ========== UPDATE USER ==========
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.isDeleted) return res.status(404).json({ success: false, message: 'User not found' });

    // Personal update (limited)
    if (String(req.user.id) === String(req.params.id)) {
      const { name, email, password } = req.body;
      if (name) user.name = name;
      if (email) user.email = email;
      if (password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
      }
    } else if (req.user.role === 'ADMIN') {
      // Admin update (full)
      const { name, email, role: userRole, team } = req.body;
      if (name) user.name = name;
      if (email) user.email = email.toLowerCase();
      if (userRole) user.role = userRole;
      if (team !== undefined) user.team = team || null;
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await user.save();
    const updated = await User.findById(user._id).select('-password').populate('team', 'name');
    res.json({ success: true, user: updated });
  } catch (err) { res.status(500).json({ success: false, message: 'Update failed' }); }
};

// ========== SOFT DELETE ==========
exports.deleteUser = async (req, res) => {
  try {
    if (String(req.user.id) === String(req.params.id)) return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    user.isDeleted = true;
    user.isActive = false;
    await user.save();
    
    res.json({ success: true, message: 'User soft-deleted successfully' });
  } catch (err) { res.status(500).json({ success: false, message: 'Deletion failed' }); }
};

// ========== AVATAR ==========
exports.updateAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image provided' });
    const imageUrl = `/uploads/avatars/${req.file.filename}`;
    
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { profileImage: imageUrl }, 
      { new: true }
    ).select('-password').populate('team', 'name');
    
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ success: false, message: 'Avatar update failed' }); }
};

// ========== LEGACY HELPERS (Role Case Correction) ==========
exports.getManagers = async (req, res) => {
    req.query.role = 'TEAM_LEADER,HR,ADMIN'; // Standardizing role search
    return exports.getUsers(req, res);
};

exports.getCollaborators = async (req, res) => {
    req.query.role = 'COLLABORATOR';
    return exports.getUsers(req, res);
};