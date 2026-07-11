const { getClassTier } = require('./studentHelpers');

const SSS_CREDIT_GRADES = ['C6', 'C5', 'C4', 'B3', 'B2', 'A1'];
const JSS_CREDIT_GRADES = ['C', 'A'];

function scoreToGrade(score, classLevel) {
  const n = Number(score);
  if (Number.isNaN(n)) return '';

  const tier = getClassTier(classLevel);

  if (tier === 'JSS') {
    if (n >= 75) return 'A';
    if (n >= 65) return 'C';
    if (n >= 50) return 'P';
    return 'F9';
  }

  if (n >= 85) return 'A1';
  if (n >= 75) return 'B2';
  if (n >= 65) return 'B3';
  if (n >= 60) return 'C4';
  if (n >= 55) return 'C5';
  if (n >= 50) return 'C6';
  if (n >= 45) return 'D7';
  if (n >= 40) return 'E8';
  return 'F9';
}

function remarkFromGrade(grade, classLevel) {
  const tier = getClassTier(classLevel);

  if (tier === 'JSS') {
    const remarks = {
      A: 'excellent',
      C: 'credit',
      P: 'pass',
      F9: 'fail'
    };
    return remarks[grade] || '';
  }

  const remarks = {
    A1: 'excellent',
    B2: 'very good',
    B3: 'good',
    C4: 'credit',
    C5: 'credit',
    C6: 'credit',
    D7: 'pass',
    E8: 'pass',
    F9: 'fail'
  };
  return remarks[grade] || '';
}

function isCreditGrade(grade, classLevel) {
  const tier = getClassTier(classLevel);
  if (tier === 'JSS') return JSS_CREDIT_GRADES.includes(grade);
  return SSS_CREDIT_GRADES.includes(grade);
}

function countCredits(grades, classLevel) {
  return grades.filter((grade) => isCreditGrade(grade, classLevel)).length;
}

function computeResultAverage(totals) {
  const valid = totals.filter((total) => total > 0);
  if (!valid.length) return 0;
  const sum = valid.reduce((acc, total) => acc + total, 0);
  return Math.round((sum / valid.length) * 100) / 100;
}

function generatePrincipalComment(averageScore, classLevel) {
  const tier = getClassTier(classLevel);
  const avg = Number(averageScore);

  if (!avg || Number.isNaN(avg)) {
    return 'Result pending. Keep working hard in all your subjects.';
  }

  if (tier === 'JSS') {
    if (avg >= 75) {
      return 'An excellent performance. You are commended for your dedication and hard work. Keep it up.';
    }
    if (avg >= 65) {
      return 'A commendable performance. Continue to apply yourself diligently in all subjects.';
    }
    if (avg >= 50) {
      return 'A fair performance. With greater effort and consistency, you can achieve much more.';
    }
    return 'This result requires improvement. Work closely with your teachers and parents to do better.';
  }

  if (avg >= 75) {
    return 'An outstanding performance. You are highly commended for your excellent academic achievement.';
  }
  if (avg >= 65) {
    return 'A good performance. Continue to strive for excellence in all your subjects.';
  }
  if (avg >= 50) {
    return 'A fair performance. Greater commitment and focus will help you achieve better results.';
  }
  return 'This result needs significant improvement. Seek help from your teachers and redouble your efforts.';
}

module.exports = {
  scoreToGrade,
  remarkFromGrade,
  isCreditGrade,
  countCredits,
  computeResultAverage,
  generatePrincipalComment,
  SSS_CREDIT_GRADES,
  JSS_CREDIT_GRADES
};
