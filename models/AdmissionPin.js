const mongoose = require('mongoose');

const admissionPinSchema = new mongoose.Schema({
  pin: { type: String, required: true, unique: true, trim: true },
  status: {
    type: String,
    enum: ['active', 'used', 'revoked'],
    default: 'active'
  },
  label: { type: String, trim: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'AdmissionApplication' },
  usedAt: Date,
  createdBy: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('AdmissionPin', admissionPinSchema);
