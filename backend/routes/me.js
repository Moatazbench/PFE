// Backend route to get current user info from JWT
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

router.get('/me', auth, (req, res) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
  res.json({ success: true, user: {
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    team: req.user.team
  }});
});

module.exports = router;
