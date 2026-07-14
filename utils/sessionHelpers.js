const { TERMS } = require('../config/schoolLevels');

function sessionPeriodKey(session, term) {
  return `${session}||${term}`;
}

function parseSessionPeriod(value) {
  if (!value) return { session: '', term: '' };
  const [session, term] = String(value).split('||');
  return { session: session || '', term: term || '' };
}

function formatSessionLabel(sessionDoc) {
  return `${sessionDoc.name} — ${sessionDoc.term}`;
}

async function getActiveSessions(AcademicSession) {
  return AcademicSession.find({ isActive: true }).sort({ name: 1, term: 1 });
}

async function getStudentSessionOptions(AcademicSession, Result, studentId) {
  const activeSessions = await getActiveSessions(AcademicSession);
  const resultPairs = await Result.find({ student: studentId })
    .select('session term')
    .lean();

  const options = new Map();

  for (const doc of activeSessions) {
    options.set(sessionPeriodKey(doc.name, doc.term), {
      session: doc.name,
      term: doc.term,
      label: formatSessionLabel(doc),
      isActive: true
    });
  }

  for (const row of resultPairs) {
    if (!row.session || !row.term) continue;
    const key = sessionPeriodKey(row.session, row.term);
    if (!options.has(key)) {
      options.set(key, {
        session: row.session,
        term: row.term,
        label: `${row.session} — ${row.term}`,
        isActive: false
      });
    }
  }

  return [...options.values()].sort((a, b) => {
    if (a.session !== b.session) return a.session.localeCompare(b.session);
    return TERMS.indexOf(a.term) - TERMS.indexOf(b.term);
  });
}

function findActiveSessionMatch(activeSessions, session, term) {
  return activeSessions.find((doc) => doc.name === session && doc.term === term);
}

module.exports = {
  sessionPeriodKey,
  parseSessionPeriod,
  formatSessionLabel,
  getActiveSessions,
  getStudentSessionOptions,
  findActiveSessionMatch
};
