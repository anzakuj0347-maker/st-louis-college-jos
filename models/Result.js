const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  term: { type: String, required: true },
  session: { type: String, required: true },
  arm: { type: String, required: true },
  firstAssignment: { type: Number, min: 0, default: null },
  secondAssignment: { type: Number, min: 0, default: null },
  firstTest: { type: Number, min: 0, max: 20, default: null },
  secondTest: { type: Number, min: 0, max: 20, default: null },
  exam: { type: Number, min: 0, default: null },
  total: { type: Number, min: 0, max: 120, default: 0 },
  position: { type: Number, default: null },
  grade: { type: String, default: '' },
  remark: { type: String, default: '' },
  sign: { type: String, default: '' },
  score: { type: Number, min: 0, max: 120 }
}, { timestamps: true });

resultSchema.index({ student: 1, subject: 1, term: 1, session: 1, arm: 1 }, { unique: true });

module.exports = mongoose.model('Result', resultSchema);
