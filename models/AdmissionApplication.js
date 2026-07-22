const mongoose = require('mongoose');

const admissionApplicationSchema = new mongoose.Schema({
  applicationId: { type: String, unique: true },
  firstName: { type: String, required: true, trim: true },
  middleName: { type: String, trim: true },
  lastName: { type: String, required: true, trim: true },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ['Female', 'Male'], default: 'Female' },
  nationality: { type: String, trim: true, default: 'Nigerian' },
  stateOfOrigin: { type: String, trim: true },
  localGovernment: { type: String, trim: true },
  religion: { type: String, trim: true },
  classApplyingFor: { type: String, required: true, trim: true },
  previousSchool: { type: String, trim: true },
  lastClassCompleted: { type: String, trim: true },
  parentName: { type: String, required: true, trim: true },
  parentPhone: { type: String, required: true, trim: true },
  parentEmail: { type: String, trim: true },
  parentAddress: { type: String, required: true, trim: true },
  emergencyContactName: { type: String, trim: true },
  emergencyContactPhone: { type: String, trim: true },
  applicantNotes: { type: String, trim: true },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'accepted', 'rejected'],
    default: 'pending'
  },
  adminNotes: { type: String, trim: true },
  admissionPin: { type: mongoose.Schema.Types.ObjectId, ref: 'AdmissionPin' }
}, { timestamps: true });

admissionApplicationSchema.pre('save', async function preSaveApplicationId(next) {
  if (this.applicationId) return next();

  try {
    const year = new Date().getFullYear();
    const prefix = `APP-${year}-`;
    const latest = await this.constructor
      .findOne({ applicationId: new RegExp(`^${prefix}`) })
      .sort({ applicationId: -1 })
      .select('applicationId');

    let sequence = 1;
    if (latest?.applicationId) {
      const part = latest.applicationId.slice(prefix.length);
      const parsed = parseInt(part, 10);
      if (!Number.isNaN(parsed)) sequence = parsed + 1;
    }

    this.applicationId = `${prefix}${String(sequence).padStart(4, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});

admissionApplicationSchema.virtual('fullName').get(function getFullName() {
  return [this.firstName, this.middleName, this.lastName].filter(Boolean).join(' ');
});

admissionApplicationSchema.set('toJSON', { virtuals: true });
admissionApplicationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('AdmissionApplication', admissionApplicationSchema);
