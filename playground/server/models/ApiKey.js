const mongoose = require('mongoose');

const ApiKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: String,
    enum: ['google', 'groq', 'openai'],
    required: true
  },
  encryptedKey: {
    type: String,
    required: true
  },
  lastTestedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['verified', 'invalid', 'untested'],
    default: 'untested'
  }
}, { timestamps: true });

module.exports = mongoose.model('ApiKey', ApiKeySchema);
