const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Result = require('../models/Result');
const AcademicSession = require('../models/AcademicSession');
const { buildStudentResultView } = require('../utils/resultPrintHelpers');
const {
  buildResultQrForStudent,
  buildResultQrBuffer,
  buildResultContentFingerprint,
  buildResultQrText,
  buildResultVerifyUrl,
  getBaseUrl,
  isValidResultVerifyToken
} = require('../utils/resultQrHelpers');
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

router.get('/dashboard', async (req, res, next) => {
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
      resultView.qr = await buildResultQrForStudent(req, resultView);
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
    next(err);
  }
});

router.get('/qr', async (req, res, next) => {
  try {
    const term = req.query.term?.trim() || '';
    const sessionName = req.query.session?.trim() || '';
    const token = req.query.v?.trim() || '';
    const requestedStudentId = req.query.studentId?.trim() || '';
    let user;

    if (!term || !sessionName) {
      return res.status(400).end();
    }

    if (req.session.user) {
      user = await User.findById(req.session.user.id)
        .select('studentId firstName middleName lastName classLevel arm');
      if (!user) return res.status(401).end();
      if (requestedStudentId && requestedStudentId !== user.studentId) {
        return res.status(403).end();
      }
    } else {
      if (!requestedStudentId || !isValidResultVerifyToken(requestedStudentId, sessionName, term, token)) {
        return res.status(403).end();
      }
      user = await User.findOne({ studentId: requestedStudentId })
        .select('studentId firstName middleName lastName classLevel arm');
      if (!user) return res.status(404).end();
    }

    const resultView = await buildStudentResultView(Result, User, user, {
      term,
      session: sessionName
    });

    if (!resultView.subjectResults.length) {
      return res.status(404).end();
    }

    const fingerprint = buildResultContentFingerprint(resultView);
    const requestedFingerprint = req.query.fp?.trim() || '';
    if (requestedFingerprint && requestedFingerprint !== fingerprint) {
      return res.status(409).end();
    }

    const verifyUrl = buildResultVerifyUrl(getBaseUrl(req), user.studentId, sessionName, term);
    const qrText = buildResultQrText({ ...resultView, verifyUrl });
    const buffer = await buildResultQrBuffer(qrText);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.type('png').send(buffer);
  } catch (err) {
    next(err);
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
    resultView.qr = await buildResultQrForStudent(req, resultView);

    res.render('auth/print-result', {
      title: 'Print Student Result',
      ...resultView
    });
  } catch (err) {
    next(err);
  }
});

router.get('/verify', async (req, res, next) => {
  try {
    const studentId = req.query.studentId?.trim() || '';
    const sessionName = req.query.session?.trim() || '';
    const term = req.query.term?.trim() || '';
    const token = req.query.v?.trim() || '';

    if (!isValidResultVerifyToken(studentId, sessionName, term, token)) {
      return res.status(400).render('auth/verify-result', {
        title: 'Verify Result',
        valid: false,
        error: 'This result link is invalid or has expired.'
      });
    }

    const user = await User.findOne({ studentId })
      .select('studentId firstName middleName lastName classLevel arm');
    if (!user) {
      return res.status(404).render('auth/verify-result', {
        title: 'Verify Result',
        valid: false,
        error: 'Student record not found.'
      });
    }

    const resultView = await buildStudentResultView(Result, User, user, {
      term,
      session: sessionName
    });

    if (!resultView.subjectResults.length) {
      return res.render('auth/verify-result', {
        title: 'Verify Result',
        valid: false,
        error: 'No results were found for this student, session, and term.'
      });
    }

    res.render('auth/verify-result', {
      title: 'Verify Result',
      valid: true,
      verifiedAt: new Date(),
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
