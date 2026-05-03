const mongoose = require('mongoose');

const CycleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['draft', 'open', 'active', 'in_progress', 'closed'],
    default: 'draft'
  },

  // === ANNUAL CYCLE: 3-Phase Structure ===
  phase1Start: { type: Date, default: null },
  phase1End:   { type: Date, default: null },
  phase2Start: { type: Date, default: null },
  phase2End:   { type: Date, default: null },
  phase3Start: { type: Date, default: null },
  phase3End:   { type: Date, default: null },

  currentPhase: {
    type: String,
    enum: ['phase1', 'phase2', 'phase3', 'closed'],
    default: 'phase1'
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

CycleSchema.index({ year: 1 }, { unique: true });
CycleSchema.index({ status: 1 });
CycleSchema.index({ currentPhase: 1 });

CycleSchema.pre('save', function (next) {
  if (this.$ignoreSequentialValidation) {
    return next();
  }

  // Phase date sequential validation
  var phaseDates = [
    { name: 'phase1Start', val: this.phase1Start },
    { name: 'phase1End',   val: this.phase1End },
    { name: 'phase2Start', val: this.phase2Start },
    { name: 'phase2End',   val: this.phase2End },
    { name: 'phase3Start', val: this.phase3Start },
    { name: 'phase3End',   val: this.phase3End },
  ];

  // Only validate if at least some phase dates are provided and were modified
  var phaseModified = phaseDates.some(function(d) { return this.isModified && this.isModified(d.name); }.bind(this));
  
  if (phaseModified) {
    var provided = phaseDates.filter(function (d) { return d.val != null; });
    if (provided.length > 0) {
      for (var i = 1; i < provided.length; i++) {
        var prev = new Date(provided[i - 1].val);
        var curr = new Date(provided[i].val);
        if (curr < prev) {
          return next(new Error(
            'Phase dates must be sequential: ' + provided[i].name +
            ' (' + curr.toISOString().slice(0, 10) + ') cannot be before ' +
            provided[i - 1].name + ' (' + prev.toISOString().slice(0, 10) + ')'
          ));
        }
      }
    }
  }

  next();
});

module.exports = mongoose.model('Cycle', CycleSchema);
