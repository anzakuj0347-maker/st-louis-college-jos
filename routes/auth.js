const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Result = require('../models/Result');
const AcademicSession = require('../models/AcademicSession');
const { buildStudentResultView } = require('../utils/resultPrintHelpers');
const {
  getStudentSessionOptions,
  parseSessionPeriod,
  sessionPeriodKey
} = require('../utils/sessionHelpers');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/results/dashboard');
  res.render('auth/login', { title: 'Check Result - Login' });
});

router.post('/login', async (req, res, next) => {
  try {
    const { studentId, password } = req.body;
    const user = await User.findOne({ studentId: studentId?.trim() });
    if (!user || !(await user.comparePassword(password))) {
      return res.render('auth/login', {
        title: 'Check Result - Login',
        error: 'Invalid Student ID or password.'
      });
    }
    req.session.user = {
      id: user._id,
      studentId: user.studentId,
      firstName: user.firstName,
      lastName: user.lastName,
      classLevel: user.classLevel
    };
    res.redirect('/results/dashboard');
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', async (req, res) => {
  if (!req.session.user) return res.redirect('/results/login');
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      req.session.destroy();
      return res.redirect('/results/login');
    }

    const period = req.query.period?.trim() || '';
    let term = req.query.term?.trim() || '';
    let session = req.query.session?.trim() || '';

    if (period) {
      ({ session, term } = parseSessionPeriod(period));
    }

    const sessionOptions = await getStudentSessionOptions(AcademicSession, Result, user._id);
    const selectedPeriod = session && term ? sessionPeriodKey(session, term) : '';

    const hasSelection = Boolean(term && session);
    let resultView = null;

    if (hasSelection) {
      resultView = await buildStudentResultView(Result, User, user, { term, session });
    }

    res.render('auth/dashboard', {
      title: 'My Results',
      user,
      term,
      session,
      sessionOptions,
      selectedPeriod,
      hasSelection,
      canPrint: hasSelection,
      resultView
    });
  } catch (err) {
    res.redirect('/results/login');
  }
});

router.get('/print', async (req, res, next) => {
  if (!req.session.user) return res.redirect('/results/login');

  try {
    let term = req.query.term?.trim() || '';
    let session = req.query.session?.trim() || '';
    const period = req.query.period?.trim() || '';

    if (period) {
      ({ session, term } = parseSessionPeriod(period));
    }

    if (!term || !session) {
      return res.redirect('/results/dashboard');
    }

    const user = await User.findById(req.session.user.id)
      .select('studentId firstName middleName lastName classLevel arm');
    if (!user) {
      req.session.destroy();
      return res.redirect('/results/login');
    }

    const resultView = await buildStudentResultView(Result, User, user, { term, session });

    res.render('auth/print-result', {
      title: 'Print Student Result',
      ...resultView
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
