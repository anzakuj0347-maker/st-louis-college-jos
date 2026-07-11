function buildCredentials(students, staffList) {
  return [
    ...students.map((s) => ({
      id: s._id,
      type: 'student',
      loginId: s.studentId,
      name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' '),
      classLevel: s.classLevel || '',
      arm: s.arm || '',
      detail: [s.classLevel, s.arm].filter(Boolean).join(' • '),
      password: s.generatedPassword || null
    })),
    ...staffList.map((s) => ({
      id: s._id,
      type: 'staff',
      loginId: s.staffId,
      name: `${s.firstName} ${s.lastName}`,
      classLevel: '',
      arm: '',
      detail: s.phone || 'Score entry portal',
      password: s.generatedPassword || null
    }))
  ];
}

function filterCredentials(credentials, { type, classLevel, arm }) {
  let filtered = credentials;
  if (type === 'student' || type === 'staff') {
    filtered = filtered.filter((c) => c.type === type);
  }
  if (type === 'student' && classLevel) {
    filtered = filtered.filter((c) => c.classLevel === classLevel);
  }
  if (type === 'student' && arm) {
    filtered = filtered.filter((c) => c.arm === arm);
  }
  return filtered;
}

module.exports = { buildCredentials, filterCredentials };
