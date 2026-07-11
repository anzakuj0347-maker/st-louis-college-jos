function generateStudentPassword() {
  const { generateLoginPassword } = require('./passwordHelpers');
  return generateLoginPassword('SLC');
}

function getClassTier(classLevel) {
  if (!classLevel) return null;
  const level = classLevel.toString().toUpperCase();
  if (level.includes('SSS')) return 'SSS';
  if (level.includes('JSS')) return 'JSS';
  return null;
}

function getSubjectFilterForTier(tier) {
  if (tier === 'SSS') return { classLevel: { $in: ['SSS', 'Both'] } };
  if (tier === 'JSS') return { classLevel: { $in: ['JSS', 'Both'] } };
  return null;
}

module.exports = { generateStudentPassword, getClassTier, getSubjectFilterForTier };
