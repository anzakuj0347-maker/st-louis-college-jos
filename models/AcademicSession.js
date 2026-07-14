const mongoose = require('mongoose');

const academicSessionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  term: { type: String, enum: ['First Term', 'Second Term', 'Third Term'], default: 'First Term' },
  isActive: { type: Boolean, default: false }
}, { timestamps: true });

academicSessionSchema.index({ name: 1, term: 1 }, { unique: true });

module.exports = mongoose.model('AcademicSession', academicSessionSchema);
