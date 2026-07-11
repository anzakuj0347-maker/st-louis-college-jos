const express = require('express');
const router = express.Router();
const Staff = require('../models/Staff');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Result = require('../models/Result');
const AcademicSession = require('../models/AcademicSession');
const { requireStaff } = require('../middleware/staffAuth');
const { scoreToGrade } = require('../utils/gradingHelpers');
const {
  buildScoreSheetRows,
  computeTotal,
  hasScoreData,
  remarkFromGrade,
  recalculateSubjectResults,
  getCrossArmSubjectStats
} = require('../utils/scoreHelpers');
const { ARMS } = require('../config/schoolLevels');

function staffHasAssignment(staff, subjectId, classLevel) {
  return (staff.classAssignments || []).some(
    (a) => a.subject.toString() === subjectId && a.classLevel === classLevel
  );
}

const SCORE_COMPONENT_MAX = {
  firstAssignment: 10,
  secondAssignment: 10,
  firstTest: 20,
  secondTest: 20,
  exam: 60
};

function parseScoreValue(rawValue) {
  if (rawValue === '' || rawValue === undefined || rawValue === null) return null;
  const score = Number(rawValue);
  if (Number.isNaN(score) || score < 0) return null;
  return score;
}

function parseScoreComponent(field, rawValue) {
  const score = parseScoreValue(rawValue);
  if (score === null) return null;
  const max = SCORE_COMPONENT_MAX[field];
  if (max !== undefined && score > max) return max;
  return score;
}

async function getActiveSessions() {
  return AcademicSession.find({ isActive: true }).sort('name');
}

async function getAvailableArms(subjectId, classLevel) {
  const arms = await User.distinct('arm', {
    offeredSubjects: subjectId,
    classLevel,
    arm: { $nin: [null, ''] }
  });
  return arms.length ? arms.sort() : ARMS;
}

router.get('/login', (req, res) => {
  if (req.session.staff) return res.redirect('/staff/dashboard');
  res.render('staff/login', { title: 'Staff Login', error: null });
});

router.post('/login', async (req, res, next) => {
  try {
    const { staffId, password } = req.body;
    const staff = await Staff.findOne({ staffId: staffId?.trim() });
    if (!staff || !(await staff.comparePassword(password))) {
      return res.render('staff/login', {
        title: 'Staff Login',
        error: 'Invalid Staff ID or password.'
      });
    }
    req.session.staff = {
      id: staff._id,
      staffId: staff.staffId,
      firstName: staff.firstName,
      lastName: staff.lastName
    };
    res.redirect('/staff/dashboard');
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', requireStaff, async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.session.staff.id)
      .populate('classAssignments.subject', 'code name classLevel');
    if (!staff) {
      delete req.session.staff;
      return res.redirect('/staff/login');
    }
    res.render('staff/dashboard', {
      title: 'Staff Dashboard',
      staff,
      success: req.query.success ? decodeURIComponent(req.query.success) : null,
      error: req.query.error ? decodeURIComponent(req.query.error) : null
    });
  } catch (err) {
    next(err);
  }
});

router.get('/scores/:subjectId', requireStaff, async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.session.staff.id);
    if (!staff) {
      delete req.session.staff;
      return res.redirect('/staff/login');
    }

    const subjectId = req.params.subjectId;
    const classLevel = req.query.classLevel?.trim();
    if (!classLevel || !staffHasAssignment(staff, subjectId, classLevel)) {
      return res.redirect(`/staff/dashboard?error=${encodeURIComponent('Invalid class assignment.')}`);
    }

    const subject = await Subject.findById(subjectId);
    if (!subject) return res.redirect('/staff/dashboard');

    const activeSessions = await getActiveSessions();
    if (!activeSessions.length) {
      return res.redirect(`/staff/dashboard?error=${encodeURIComponent('No active session. Contact the administrator.')}`);
    }

    const term = req.query.term || 'First Term';
    const session = req.query.session || activeSessions[0].name;
    const activeSession = activeSessions.find((s) => s.name === session);
    if (!activeSession) {
      return res.redirect(`/staff/dashboard?error=${encodeURIComponent('Selected session is not active.')}`);
    }

    const availableArms = await getAvailableArms(subjectId, classLevel);
    const arm = req.query.arm || availableArms[0] || 'A';

    const students = await User.find({
      offeredSubjects: subjectId,
      classLevel,
      arm
    })
      .select('studentId firstName middleName lastName classLevel arm')
      .sort('studentId');

    const existingResults = await Result.find({
      subject: subjectId,
      term,
      session,
      arm,
      student: { $in: students.map((s) => s._id) }
    });
    const resultMap = existingResults.reduce((map, r) => {
      map[r.student.toString()] = r;
      return map;
    }, {});

    const crossArmStats = await getCrossArmSubjectStats(Result, User, {
      subjectId,
      term,
      session,
      classLevel
    });

    const scoreRows = buildScoreSheetRows(students, resultMap, staff, classLevel, crossArmStats);

    res.render('staff/scores', {
      title: 'Continuous Assessment Sheet',
      staff,
      subject,
      classLevel,
      students,
      scoreRows,
      term,
      session,
      arm,
      availableArms,
      activeSessions,
      crossArmTotals: crossArmStats.totalByStudent,
      crossArmOfferingCount: crossArmStats.offeringCount,
      scoreToGrade,
      success: req.query.success ? decodeURIComponent(req.query.success) : null,
      error: req.query.error ? decodeURIComponent(req.query.error) : null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/scores/:subjectId', requireStaff, async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.session.staff.id);
    if (!staff) {
      delete req.session.staff;
      return res.redirect('/staff/login');
    }

    const subjectId = req.params.subjectId;
    const { term, session, classLevel, arm, sign, scores } = req.body;
    if (!classLevel || !arm || !staffHasAssignment(staff, subjectId, classLevel)) {
      return res.redirect(`/staff/dashboard?error=${encodeURIComponent('Invalid class assignment.')}`);
    }

    const activeSession = await AcademicSession.findOne({ name: session?.trim(), isActive: true });
    if (!activeSession) {
      return res.redirect(`/staff/dashboard?error=${encodeURIComponent('Only active sessions can be used for score entry.')}`);
    }

    const scoreEntries = scores && typeof scores === 'object' ? scores : {};
    const students = await User.find({ offeredSubjects: subjectId, classLevel, arm }).select('_id');
    const allowedIds = new Set(students.map((s) => s._id.toString()));
    const teacherSign = (sign || '').trim().toUpperCase();

    for (const [studentId, components] of Object.entries(scoreEntries)) {
      if (!allowedIds.has(studentId)) continue;
      if (!components || typeof components !== 'object') continue;

      const payload = {
        firstAssignment: parseScoreComponent('firstAssignment', components.firstAssignment),
        secondAssignment: parseScoreComponent('secondAssignment', components.secondAssignment),
        firstTest: parseScoreComponent('firstTest', components.firstTest),
        secondTest: parseScoreComponent('secondTest', components.secondTest),
        exam: parseScoreComponent('exam', components.exam)
      };

      if (!hasScoreData(payload)) continue;

      const total = computeTotal(payload);
      const grade = scoreToGrade(total, classLevel);

      await Result.findOneAndUpdate(
        { student: studentId, subject: subjectId, term, session, arm },
        {
          student: studentId,
          subject: subjectId,
          term,
          session,
          arm,
          ...payload,
          total,
          score: total,
          grade,
          remark: remarkFromGrade(grade, classLevel),
          sign: teacherSign
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    await recalculateSubjectResults(Result, User, {
      subjectId,
      term,
      session,
      classLevel
    });

    const qs = [
      `classLevel=${encodeURIComponent(classLevel)}`,
      `term=${encodeURIComponent(term)}`,
      `session=${encodeURIComponent(session)}`,
      `arm=${encodeURIComponent(arm)}`,
      `success=${encodeURIComponent('Scores saved successfully.')}`
    ].join('&');
    res.redirect(`/staff/scores/${subjectId}?${qs}`);
  } catch (err) {
    next(err);
  }
});

router.get('/scores/:subjectId/print-ca', requireStaff, async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.session.staff.id);
    if (!staff) {
      delete req.session.staff;
      return res.redirect('/staff/login');
    }

    const subjectId = req.params.subjectId;
    const classLevel = req.query.classLevel?.trim();
    if (!classLevel || !staffHasAssignment(staff, subjectId, classLevel)) {
      return res.redirect(`/staff/dashboard?error=${encodeURIComponent('Invalid class assignment.')}`);
    }

    const subject = await Subject.findById(subjectId);
    if (!subject) return res.redirect('/staff/dashboard');

    const activeSessions = await getActiveSessions();
    const term = req.query.term || 'First Term';
    const session = req.query.session || activeSessions[0]?.name;
    const arm = req.query.arm || 'A';

    const students = await User.find({
      offeredSubjects: subjectId,
      classLevel,
      arm
    })
      .select('studentId firstName middleName lastName classLevel arm')
      .sort('studentId');

    const existingResults = await Result.find({
      subject: subjectId,
      term,
      session,
      arm,
      student: { $in: students.map((s) => s._id) }
    });
    const resultMap = existingResults.reduce((map, r) => {
      map[r.student.toString()] = r;
      return map;
    }, {});

    const crossArmStats = await getCrossArmSubjectStats(Result, User, {
      subjectId,
      term,
      session,
      classLevel
    });

    const scoreRows = buildScoreSheetRows(students, resultMap, staff, classLevel, crossArmStats);

    res.render('staff/print-ca-sheet', {
      title: 'Print Continuous Assessment Sheet',
      staff,
      subject,
      classLevel,
      scoreRows,
      term,
      session,
      arm
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireStaff, (req, res) => {
  delete req.session.staff;
  res.redirect('/staff/login');
});

module.exports = router;
