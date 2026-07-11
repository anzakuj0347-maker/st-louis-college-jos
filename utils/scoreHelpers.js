const { scoreToGrade, remarkFromGrade } = require('./gradingHelpers');

function toNumber(value) {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function computeTotal(record) {
  if (!record) return 0;
  return (
    toNumber(record.firstAssignment) +
    toNumber(record.secondAssignment) +
    toNumber(record.firstTest) +
    toNumber(record.secondTest) +
    toNumber(record.exam)
  );
}

function hasScoreData(record) {
  if (!record) return false;
  return ['firstAssignment', 'secondAssignment', 'firstTest', 'secondTest', 'exam'].some(
    (field) => record[field] !== null && record[field] !== undefined && record[field] !== ''
  );
}

function computeAverage(totals) {
  const valid = totals.filter((t) => t > 0);
  if (!valid.length) return 0;
  const sum = valid.reduce((acc, t) => acc + t, 0);
  return Math.round((sum / valid.length) * 100) / 100;
}

function computeSubjectClassAverage(totals, offeringCount) {
  if (!offeringCount) return 0;
  const sum = totals.reduce((acc, total) => acc + toNumber(total), 0);
  return Math.round((sum / offeringCount) * 100) / 100;
}

function buildCrossArmStatsFromTotals(totalByStudent) {
  const offeringCount = Object.keys(totalByStudent).length;
  const totals = Object.values(totalByStudent);
  return {
    offeringCount,
    classAverage: computeSubjectClassAverage(totals, offeringCount),
    positions: computePositions(
      Object.entries(totalByStudent).map(([id, total]) => ({ id, total }))
    ),
    totalByStudent
  };
}

async function getCrossArmSubjectStats(Result, User, { subjectId, term, session, classLevel }) {
  const students = await User.find({ offeredSubjects: subjectId, classLevel }).select('_id');
  const studentIds = students.map((s) => s._id);

  const results = await Result.find({
    subject: subjectId,
    term,
    session,
    student: { $in: studentIds }
  });

  const totalByStudent = {};
  students.forEach((student) => {
    totalByStudent[student._id.toString()] = 0;
  });
  results.forEach((result) => {
    totalByStudent[result.student.toString()] = computeTotal(result);
  });

  return buildCrossArmStatsFromTotals(totalByStudent);
}

function computePositions(items) {
  const ranked = items
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  const positions = {};
  let rank = 0;
  let prevTotal = null;

  ranked.forEach((item, index) => {
    if (item.total !== prevTotal) {
      rank = index + 1;
      prevTotal = item.total;
    }
    positions[item.id] = rank;
  });

  return positions;
}

function getTeacherInitials(firstName, lastName) {
  const first = (firstName || '').trim().charAt(0);
  const last = (lastName || '').trim().charAt(0);
  return `${first}${last}`.toUpperCase();
}

function buildScoreSheetRows(students, resultMap, staff, classLevel, crossArmStats) {
  const defaultSign = getTeacherInitials(staff.firstName, staff.lastName);
  const rows = students.map((student) => {
    const existing = resultMap[student._id.toString()] || {};
    const total = computeTotal(existing);
    const grade = scoreToGrade(total, classLevel);
    return {
      student,
      existing,
      firstAssignment: existing.firstAssignment ?? '',
      secondAssignment: existing.secondAssignment ?? '',
      firstTest: existing.firstTest ?? '',
      secondTest: existing.secondTest ?? '',
      exam: existing.exam ?? '',
      total,
      remark: existing.remark || remarkFromGrade(grade, classLevel),
      sign: existing.sign || defaultSign
    };
  });

  const classAverage = crossArmStats?.classAverage ?? 0;
  const positions = crossArmStats?.positions ?? {};

  return rows.map((row) => ({
    ...row,
    classAverage,
    position: positions[row.student._id.toString()] || '',
    grade: scoreToGrade(row.total, classLevel)
  }));
}

async function recalculateSubjectResults(Result, User, { subjectId, term, session, classLevel }) {
  const crossArmStats = await getCrossArmSubjectStats(Result, User, {
    subjectId,
    term,
    session,
    classLevel
  });
  const studentIds = Object.keys(crossArmStats.totalByStudent);

  if (!studentIds.length) return;

  const results = await Result.find({
    subject: subjectId,
    term,
    session,
    student: { $in: studentIds }
  });

  for (const result of results) {
    const total = computeTotal(result);
    const grade = scoreToGrade(total, classLevel);
    result.total = total;
    result.score = total;
    result.grade = grade;
    result.remark = remarkFromGrade(grade, classLevel);
    result.position = crossArmStats.positions[result.student.toString()] || null;
    await result.save();
  }
}

module.exports = {
  computeTotal,
  hasScoreData,
  computeAverage,
  computeSubjectClassAverage,
  computePositions,
  buildCrossArmStatsFromTotals,
  getCrossArmSubjectStats,
  remarkFromGrade,
  getTeacherInitials,
  buildScoreSheetRows,
  recalculateSubjectResults
};
