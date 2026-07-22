const mongoose = require('mongoose');

const admissionListSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'admission-list' },
  title: { type: String, default: 'Admission List' },
  originalName: String,
  mimeType: { type: String, default: 'application/pdf' },
  data: { type: Buffer, select: false },
  fileSize: Number
}, { timestamps: true });

module.exports = mongoose.model('AdmissionList', admissionListSchema);
