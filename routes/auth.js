const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Result = require('../models/Result');
const { buildStudentResultView } = require('../utils/resultPrintHelpers');

const TERM_ORDER = ['First Term', 'Second Term', 'Third Term'];

function orderTerms(terms) {
  return TERM_ORDER.filter((term) => terms.includes(term));
}

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

    const term = req.query.term?.trim() || '';
    const session = req.query.session?.trim() || '';

    const allResults = await Result.find({ student: user._id })
      .populate('subject', 'name code')
      .sort('subject');

    const availableSessions = [...new Set(allResults.map((r) => r.session).filter(Boolean))].sort();
    const availableTerms = orderTerms([...new Set(allResults.map((r) => r.term).filter(Boolean))]);

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
      availableTerms,
      availableSessions,
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
    const term = req.query.term?.trim();
    const session = req.query.session?.trim();
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
