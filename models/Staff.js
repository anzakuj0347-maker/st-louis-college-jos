const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const staffSchema = new mongoose.Schema({
  staffId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  generatedPassword: String,
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: String,
  assignedSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  classAssignments: [{
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    classLevel: { type: String, required: true }
  }]
}, { timestamps: true });

staffSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

staffSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('Staff', staffSchema);
