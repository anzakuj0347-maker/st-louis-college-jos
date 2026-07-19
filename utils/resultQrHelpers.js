const crypto = require('crypto');
const QRCode = require('qrcode');

function getBaseUrl(req) {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  if (req) {
    return `${req.protocol}://${req.get('host')}`;
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

function buildResultQrImageUrl({ term, session, studentId, token }) {
  const params = new URLSearchParams({ term, session });
  if (studentId && token) {
    params.set('studentId', studentId);
    params.set('v', token);
  }
  return `/results/qr?${params.toString()}`;
}

function formatStudentName(student) {
  return [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ');
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
      `   Total: ${row.total || '—'} | Grade: ${row.grade || '—'} | Remark: ${row.remark || '—'}`
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

async function buildResultQrBuffer(text) {
  return QRCode.toBuffer(text, {
    errorCorrectionLevel: 'L',
    margin: 1,
    width: 280,
    color: {
      dark: '#003da5',
      light: '#ffffff'
    }
  });
}

function buildResultQrForStudent(req, studentId, session, term) {
  const verifyUrl = buildResultVerifyUrl(getBaseUrl(req), studentId, session, term);
  const qrImageUrl = buildResultQrImageUrl({ term, session });
  return { verifyUrl, qrImageUrl };
}

module.exports = {
  getBaseUrl,
  buildResultVerifyToken,
  isValidResultVerifyToken,
  buildResultVerifyUrl,
  buildResultQrImageUrl,
  buildResultQrText,
  buildResultQrBuffer,
  buildResultQrForStudent
};
