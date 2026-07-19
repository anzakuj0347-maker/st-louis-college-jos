const crypto = require('crypto');
const QRCode = require('qrcode');

function getBaseUrl(req) {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  if (req) {
    const protocol = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol;
    return `${protocol}://${req.get('host')}`;
  }
  return 'http://localhost:3000';
}

function buildResultVerifyToken(studentId, session, term) {
  const secret = process.env.SESSION_SECRET || 'stlouis-college-jos-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${studentId}|${session}|${term}`)
    .digest('hex')
    .slice(0, 20);
}

function isValidResultVerifyToken(studentId, session, term, token) {
  if (!studentId || !session || !term || !token) return false;
  const expected = buildResultVerifyToken(studentId, session, term);
  const provided = String(token);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

function buildResultVerifyUrl(baseUrl, studentId, session, term) {
  const v = buildResultVerifyToken(studentId, session, term);
  const params = new URLSearchParams({ studentId, session, term, v });
  return `${baseUrl}/results/verify?${params.toString()}`;
}

function buildResultContentFingerprint(resultView) {
  const payload = JSON.stringify({
    studentId: resultView.student.studentId,
    term: resultView.term,
    session: resultView.session,
    arm: resultView.student.arm || '',
    classLevel: resultView.classLevel,
    rows: resultView.subjectResults.map((row) => [
      row.subject,
      row.firstAssignment,
      row.secondAssignment,
      row.firstTest,
      row.secondTest,
      row.exam,
      row.total,
      row.average,
      row.position,
      row.grade,
      row.remark
    ]),
    summary: resultView.summary
  });
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

function buildResultQrImageUrl({ term, session, studentId, token, fingerprint }) {
  const params = new URLSearchParams({ term, session });
  if (studentId) params.set('studentId', studentId);
  if (token) params.set('v', token);
  if (fingerprint) params.set('fp', fingerprint);
  return `/results/qr?${params.toString()}`;
}

function formatStudentName(student) {
  return [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ');
}

function formatScore(value) {
  return value !== '' && value !== undefined && value !== null ? value : '—';
}

function buildResultQrText({ student, classLevel, term, session, subjectResults, summary, verifyUrl }) {
  const lines = [
    'ST. LOUIS COLLEGE JOS',
    'STUDENT TERMINAL REPORT',
    '',
    `Student ID: ${student.studentId}`,
    `Name: ${formatStudentName(student)}`,
    `Class: ${classLevel} Arm ${student.arm || '—'}`,
    `Session: ${session}`,
    `Term: ${term}`,
    '',
    'SUBJECT RESULTS'
  ];

  subjectResults.forEach((row, index) => {
    lines.push(
      `${index + 1}. ${row.subject}`,
      `   1st Asgn: ${formatScore(row.firstAssignment)} | 2nd Asgn: ${formatScore(row.secondAssignment)}`,
      `   1st Test: ${formatScore(row.firstTest)} | 2nd Test: ${formatScore(row.secondTest)} | Exam: ${formatScore(row.exam)}`,
      `   Total: ${formatScore(row.total)} | Avg: ${formatScore(row.average)} | Pos: ${formatScore(row.position)} | Grade: ${formatScore(row.grade)}`,
      `   Remark: ${formatScore(row.remark)}`
    );
  });

  lines.push(
    '',
    'SUMMARY',
    `Subjects Offered: ${summary.subjectsOffered}`,
    `Credits: ${summary.numberOfCredits}`,
    `Class Average: ${summary.classAverage || '—'}`,
    `Principal's Comment: ${summary.principalComment}`,
    '',
    'View full report online:',
    verifyUrl
  );

  return lines.join('\n');
}

async function buildResultQrDataUrl(text) {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: {
      dark: '#003da5',
      light: '#ffffff'
    }
  });
}

async function buildResultQrBuffer(text) {
  return QRCode.toBuffer(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: {
      dark: '#003da5',
      light: '#ffffff'
    }
  });
}

async function buildResultQrForStudent(req, resultView) {
  const { student, term, session } = resultView;
  const verifyUrl = buildResultVerifyUrl(getBaseUrl(req), student.studentId, session, term);
  const qrImageUrl = await buildResultQrDataUrl(verifyUrl);
  const fingerprint = buildResultContentFingerprint(resultView);

  return {
    verifyUrl,
    qrImageUrl,
    fingerprint
  };
}

module.exports = {
  getBaseUrl,
  buildResultVerifyToken,
  isValidResultVerifyToken,
  buildResultVerifyUrl,
  buildResultContentFingerprint,
  buildResultQrImageUrl,
  buildResultQrText,
  buildResultQrDataUrl,
  buildResultQrBuffer,
  buildResultQrForStudent
};
