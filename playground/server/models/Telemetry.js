const mongoose = require('mongoose');

const TelemetrySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  tasksCompleted: {
    type: Number,
    default: 0
  },
  tasksOverdue: {
    type: Number,
    default: 0
  },
  optimalFocusWindow: {
    type: String, // e.g. "09:00-11:00"
    default: null
  },
  procrastinationRisk: {
    type: String,
    enum: ['Low', 'Moderate', 'High', 'Learning'],
    default: 'Learning'
  },
  rawDesktopState: {
    type: mongoose.Schema.Types.Mixed, // Stores arbitrary JSON from desktop sync
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model('Telemetry', TelemetrySchema);
