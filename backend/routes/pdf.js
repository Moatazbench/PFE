const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const auth = require('../middleware/auth');
const Team = require('../models/Team');
const User = require('../models/User');

// Export team report as PDF
router.get('/team/:id', auth, async function(req, res) {
  try {
    const team = await Team.findById(req.params.id).populate('members', 'name email role');
    
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    const doc = new PDFDocument();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=team-report.pdf');
    
    doc.pipe(res);

    doc.fontSize(24).text('Team Report: ' + team.name, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text('Generated: ' + new Date().toLocaleDateString(), { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(16).text('Team Members:', { underline: true });
    doc.moveDown();

    if (team.members && team.members.length > 0) {
      for (var i = 0; i < team.members.length; i++) {
        var member = team.members[i];
        doc.fontSize(12).text((i + 1) + '. ' + member.name + ' - ' + member.email + ' (' + member.role + ')');
      }
    } else {
      doc.fontSize(12).text('No members in this team.');
    }

    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ message: 'Error generating PDF' });
  }
});

// Export user report as PDF
router.get('/user/:id', auth, async function(req, res) {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const doc = new PDFDocument();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=user-report.pdf');
    
    doc.pipe(res);

    doc.fontSize(24).text('User Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text('Name: ' + user.name);
    doc.fontSize(12).text('Email: ' + user.email);
    doc.fontSize(12).text('Role: ' + user.role);
    doc.moveDown();
    doc.fontSize(12).text('Generated: ' + new Date().toLocaleDateString());

    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ message: 'Error generating PDF' });
  }
});

module.exports = router;