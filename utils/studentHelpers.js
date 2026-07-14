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

async function createStudentRecord(User, Subject, data) {
  const plainPassword = generateStudentPassword();
  const student = await User.create({
    studentId: data.studentId?.trim(),
    firstName: data.firstName,
    middleName: data.middleName?.trim() || undefined,
    lastName: data.lastName,
    classLevel: data.classLevel,
    arm: data.arm?.trim() || undefined,
    password: plainPassword,
    generatedPassword: plainPassword,
    offeredSubjects: []
  });

  const tier = getClassTier(data.classLevel);
  if (tier) {
    const filter = getSubjectFilterForTier(tier);
    const generalSubjects = await Subject.find({ ...filter, department: 'General' }).select('_id');
    if (generalSubjects.length) {
      student.offeredSubjects = generalSubjects.map((s) => s._id);
      await student.save();
    }
  }

  return { student, plainPassword };
}

module.exports = {
  generateStudentPassword,
  getClassTier,
  getSubjectFilterForTier,
  createStudentRecord
};
