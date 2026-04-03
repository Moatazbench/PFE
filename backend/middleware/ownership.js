// Strict ownership middleware for RBAC
module.exports = function(model, idField = 'id') {
  return async function(req, res, next) {
    try {
      if (req.user.role === 'ADMIN' || req.user.role === 'HR') return next();
      const id = req.params[idField] || req.body[idField];
      if (!id) return res.status(400).json({ success: false, message: 'Missing resource id.' });
      const doc = await model.findById(id);
      if (!doc) return res.status(404).json({ success: false, message: 'Resource not found.' });
      if (doc.owner && doc.owner.toString() === req.user.id) return next();
      if (doc.user && doc.user.toString() === req.user.id) return next();
      if (doc.manager && doc.manager.toString() === req.user.id) return next();
      return res.status(403).json({ success: false, message: 'Forbidden: not owner.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };
};
