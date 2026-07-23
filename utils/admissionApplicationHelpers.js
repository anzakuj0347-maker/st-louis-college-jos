const { CLASS_LEVELS } = require('../config/schoolLevels');

const APPLICATION_STATUSES = ['pending', 'reviewed', 'accepted', 'rejected'];

function normalizeApplicationInput(body = {}) {
  return {
    firstName: body.firstName?.trim() || '',
    middleName: body.middleName?.trim() || '',
    lastName: body.lastName?.trim() || '',
    dateOfBirth: body.dateOfBirth?.trim() || '',
    gender: body.gender?.trim() || 'Female',
    nationality: body.nationality?.trim() || 'Nigerian',
    stateOfOrigin: body.stateOfOrigin?.trim() || '',
    localGovernment: body.localGovernment?.trim() || '',
    religion: body.religion?.trim() || '',
    classApplyingFor: body.classApplyingFor?.trim() || '',
    previousSchool: body.previousSchool?.trim() || '',
    lastClassCompleted: body.lastClassCompleted?.trim() || '',
    parentName: body.parentName?.trim() || '',
    parentPhone: body.parentPhone?.trim() || '',
    parentEmail: body.parentEmail?.trim() || '',
    parentAddress: body.parentAddress?.trim() || '',
    emergencyContactName: body.emergencyContactName?.trim() || '',
    emergencyContactPhone: body.emergencyContactPhone?.trim() || '',
    applicantNotes: body.applicantNotes?.trim() || ''
  };
}

function validateApplicationInput(data) {
  const errors = [];

  if (!data.firstName) errors.push('Applicant first name is required.');
  if (!data.lastName) errors.push('Applicant last name is required.');
  if (!data.dateOfBirth) errors.push('Date of birth is required.');
  if (!data.classApplyingFor) errors.push('Class applying for is required.');
  else if (!CLASS_LEVELS.includes(data.classApplyingFor)) errors.push('Choose a valid class level.');
  if (!data.parentName) errors.push('Parent or guardian name is required.');
  if (!data.parentPhone) errors.push('Parent or guardian phone number is required.');
  if (!data.parentAddress) errors.push('Parent or guardian address is required.');
  if (data.parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.parentEmail)) {
    errors.push('Enter a valid parent or guardian email address.');
  }
  if (!['Female', 'Male'].includes(data.gender)) errors.push('Choose a valid gender.');

  const dob = new Date(data.dateOfBirth);
  if (data.dateOfBirth && Number.isNaN(dob.getTime())) {
    errors.push('Enter a valid date of birth.');
  } else if (data.dateOfBirth && dob > new Date()) {
    errors.push('Date of birth cannot be in the future.');
  }

  return errors;
}

function formatApplicationStatus(status) {
  const labels = {
    pending: 'Pending',
    reviewed: 'Reviewed',
    accepted: 'Accepted',
    rejected: 'Rejected'
  };
  return labels[status] || status;
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatApplicationDate(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-NG', { dateStyle: 'long' });
}

function formatApplicationDateTime(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

function canAccessApplicationReview(req, application) {
  if (!application) return false;
  if (req.session.submittedApplicationId === application._id.toString()) return true;

  if (req.session.admissionPinId && application.admissionPin) {
    const linkedPinId = application.admissionPin._id
      ? application.admissionPin._id.toString()
      : String(application.admissionPin);
    if (req.session.admissionPinId === linkedPinId) return true;
  }

  const phone = normalizePhone(req.body.parentPhone || req.query.phone);
  const applicationPhone = normalizePhone(application.parentPhone);
  return Boolean(phone && applicationPhone && phone === applicationPhone);
}

function getApplicantFullName(application) {
  return [application.firstName, application.middleName, application.lastName].filter(Boolean).join(' ');
}

module.exports = {
  APPLICATION_STATUSES,
  normalizeApplicationInput,
  validateApplicationInput,
  formatApplicationStatus,
  normalizePhone,
  formatApplicationDate,
  formatApplicationDateTime,
  canAccessApplicationReview,
  getApplicantFullName
};
