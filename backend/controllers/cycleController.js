const EvaluationCycle = require('../models/EvaluationCycle');

exports.createCycle = async (req, res) => {
  try {
    const { name, type, year, submissionStart, submissionEnd, reviewDeadline, description } = req.body;

    if (!name || !type || !year || !submissionStart || !submissionEnd) {
      return res.status(400).json({
        success: false,
        message: 'Name, type, year, submissionStart, and submissionEnd are required',
      });
    }

    const existing = await EvaluationCycle.findOne({ type, year: Number(year) });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A cycle for this type and year already exists',
      });
    }

    const cycle = await EvaluationCycle.create({
      name,
      type,
      year: Number(year),
      submissionStart: new Date(submissionStart),
      submissionEnd: new Date(submissionEnd),
      reviewDeadline: reviewDeadline ? new Date(reviewDeadline) : null,
      description: description || '',
      createdBy: req.user.id || req.user._id,
    });

    const populated = await EvaluationCycle.findById(cycle._id).populate('createdBy', 'name email');

    res.status(201).json({ success: true, cycle: populated });
  } catch (err) {
    console.error('Create cycle error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCycles = async (req, res) => {
  try {
    const { year, type, status } = req.query;
    const filter = {};
    if (year) filter.year = Number(year);
    if (type) filter.type = type;
    if (status) filter.status = status;

    const cycles = await EvaluationCycle.find(filter)
      .populate('createdBy', 'name email')
      .sort({ year: -1, type: 1 });

    res.json({ success: true, count: cycles.length, cycles });
  } catch (err) {
    console.error('Get cycles error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCycleById = async (req, res) => {
  try {
    const cycle = await EvaluationCycle.findById(req.params.id).populate('createdBy', 'name email');

    if (!cycle) {
      return res.status(404).json({ success: false, message: 'Cycle not found' });
    }

    res.json({ success: true, cycle });
  } catch (err) {
    console.error('Get cycle error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCurrentCycles = async (req, res) => {
  try {
    const now = new Date();
    const cycles = await EvaluationCycle.find({
      status: 'open',
      submissionStart: { $lte: now },
      submissionEnd: { $gte: now },
    }).populate('createdBy', 'name email');

    res.json({ success: true, count: cycles.length, cycles });
  } catch (err) {
    console.error('Get current cycles error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCyclesByYear = async (req, res) => {
  try {
    const year = Number(req.params.year);

    if (isNaN(year)) {
      return res.status(400).json({ success: false, message: 'Invalid year' });
    }

    const cycles = await EvaluationCycle.find({ year }).populate('createdBy', 'name email');

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const calendar = [];
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

      const activeCycles = cycles.filter((c) => {
        const start = new Date(c.submissionStart);
        const end = new Date(c.submissionEnd);
        return start <= monthEnd && end >= monthStart;
      });

      calendar.push({
        month: month + 1,
        monthName: monthNames[month],
        cycles: activeCycles,
        hasOpenCycle: activeCycles.some((c) => c.status === 'open'),
      });
    }

    res.json({ success: true, year, calendar, cycles });
  } catch (err) {
    console.error('Get cycles by year error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCycle = async (req, res) => {
  try {
    const cycle = await EvaluationCycle.findById(req.params.id);

    if (!cycle) {
      return res.status(404).json({ success: false, message: 'Cycle not found' });
    }

    const { name, type, year, submissionStart, submissionEnd, reviewDeadline, description, status } = req.body;

    if (name !== undefined) cycle.name = name;
    if (type !== undefined) cycle.type = type;
    if (year !== undefined) cycle.year = Number(year);
    if (submissionStart !== undefined) cycle.submissionStart = new Date(submissionStart);
    if (submissionEnd !== undefined) cycle.submissionEnd = new Date(submissionEnd);
    if (reviewDeadline !== undefined) cycle.reviewDeadline = reviewDeadline ? new Date(reviewDeadline) : null;
    if (description !== undefined) cycle.description = description;
    if (status !== undefined) cycle.status = status;

    await cycle.save();

    const populated = await EvaluationCycle.findById(cycle._id).populate('createdBy', 'name email');

    res.json({ success: true, cycle: populated });
  } catch (err) {
    console.error('Update cycle error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCycle = async (req, res) => {
  try {
    const cycle = await EvaluationCycle.findById(req.params.id);

    if (!cycle) {
      return res.status(404).json({ success: false, message: 'Cycle not found' });
    }

    await EvaluationCycle.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Cycle deleted' });
  } catch (err) {
    console.error('Delete cycle error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.openCycle = async (req, res) => {
  try {
    const cycle = await EvaluationCycle.findById(req.params.id);

    if (!cycle) {
      return res.status(404).json({ success: false, message: 'Cycle not found' });
    }

    cycle.status = 'open';
    await cycle.save();

    res.json({ success: true, message: 'Cycle opened', cycle });
  } catch (err) {
    console.error('Open cycle error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.closeCycle = async (req, res) => {
  try {
    const cycle = await EvaluationCycle.findById(req.params.id);

    if (!cycle) {
      return res.status(404).json({ success: false, message: 'Cycle not found' });
    }

    cycle.status = 'closed';
    await cycle.save();

    res.json({ success: true, message: 'Cycle closed', cycle });
  } catch (err) {
    console.error('Close cycle error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};