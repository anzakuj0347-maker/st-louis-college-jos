function generateLoginPassword(prefix = 'SLC') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = prefix;
  for (let i = 0; i < 5; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

const { scoreToGrade } = require('./gradingHelpers');

module.exports = { generateLoginPassword, scoreToGrade };
