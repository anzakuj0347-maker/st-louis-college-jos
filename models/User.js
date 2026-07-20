const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  generatedPassword: String,
  firstName: String,
  middleName: String,
  lastName: String,
  classLevel: String,
  arm: String,
  feeStatus: { type: String, enum: ['paid', 'owing'], default: 'paid' },
  offeredSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  results: [{
    subject: String,
    score: Number,
    grade: String,
    term: String,
    session: String
  }]
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
