const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  classLevel: { type: String, enum: ['JSS', 'SSS', 'Both'], default: 'Both' },
  department: { type: String, enum: ['Science', 'Commercial', 'Arts', 'General'], default: 'General' }
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);
