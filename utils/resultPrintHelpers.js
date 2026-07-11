const {
  scoreToGrade,
  remarkFromGrade,
  countCredits,
  computeResultAverage,
  generatePrincipalComment
} = require('./gradingHelpers');
const { computeTotal, getCrossArmSubjectStats } = require('./scoreHelpers');

function mapResultRow(result, classLevel, crossArmStats, studentId) {
  const total = computeTotal(result);
  const grade = result.grade || scoreToGrade(total, classLevel);
  return {
    subject: result.subject?.name || '—',
    code: result.subject?.code || '',
    firstAssignment: result.firstAssignment ?? '',
    secondAssignment: result.secondAssignment ?? '',
    firstTest: result.firstTest ?? '',
    secondTest: result.secondTest ?? '',
    exam: result.exam ?? '',
    total,
    average: crossArmStats?.classAverage ?? '',
    position: crossArmStats?.positions?.[studentId] || '',
    grade,
    remark: result.remark || remarkFromGrade(grade, classLevel),
    sign: result.sign || ''
  };
}

function buildResultSummary(subjectResults, classLevel) {
  const totals = subjectResults.map((row) => row.total);
  const grades = subjectResults.map((row) => row.grade).filter(Boolean);
  const classAverage = computeResultAverage(totals);
  return {
    numberOfCredits: countCredits(grades, classLevel),
    classAverage,
    subjectsOffered: subjectResults.length,
    principalComment: generatePrincipalComment(classAverage, classLevel)
  };
}

async function fetchStudentResultsForPrint(Result, student, { term, session }) {
  return Result.find({
    student: student._id,
    term,
    session,
    arm: student.arm
  })
    .populate('subject', 'name code')
    .sort('subject');
}

async function buildStudentResultView(Result, User, student, { term, session }) {
  const results = await fetchStudentResultsForPrint(Result, student, { term, session });
  const classLevel = student.classLevel;
  const studentId = student._id.toString();
  const metricsCache = new Map();

  const subjectResults = [];
  for (const result of results) {
    const subjectId = result.subject?._id?.toString();
    if (!subjectId) continue;

    if (!metricsCache.has(subjectId)) {
      const stats = await getCrossArmSubjectStats(Result, User, {
        subjectId,
        term,
        session,
        classLevel
      });
      metricsCache.set(subjectId, stats);
    }

    subjectResults.push(mapResultRow(result, classLevel, metricsCache.get(subjectId), studentId));
  }

  return {
    student,
    classLevel,
    term,
    session,
    subjectResults,
    summary: buildResultSummary(subjectResults, classLevel)
  };
}

module.exports = {
  mapResultRow,
  buildResultSummary,
  fetchStudentResultsForPrint,
  buildStudentResultView
};
