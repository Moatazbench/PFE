const express = require('express');
const router = express.Router();
const Evaluation = require('../models/Evaluation');
const auth = require('../middleware/auth');

// Get progress data for charts
router.get('/:userId', auth, async function(req, res) {
  try {
    const evaluations = await Evaluation.find({ user: req.params.userId })
      .sort({ date: 1 });

    var labels = [];
    var values = [];

    for (var i = 0; i < evaluations.length; i++) {
      var evalItem = evaluations[i];
      var dateStr = evalItem.date ? evalItem.date.toISOString().slice(0, 10) : 'Unknown';
      labels.push(dateStr);
      values.push(evalItem.score || 0);
    }

    res.json({ labels: labels, values: values });
  } catch (err) {
    console.error('Progress error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;