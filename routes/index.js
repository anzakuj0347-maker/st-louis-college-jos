const express = require('express');
const router = express.Router();
const Page = require('../models/Page');
const Event = require('../models/Event');
const News = require('../models/News');
const HeroSlide = require('../models/HeroSlide');
const AdmissionList = require('../models/AdmissionList');
const AdmissionApplication = require('../models/AdmissionApplication');
const AdmissionPin = require('../models/AdmissionPin');
const { CLASS_LEVELS } = require('../config/schoolLevels');
const {
  normalizeApplicationInput,
  validateApplicationInput,
  canAccessApplicationReview,
  formatApplicationDate,
  formatApplicationDateTime,
  getApplicantFullName,
  normalizePhone
} = require('../utils/admissionApplicationHelpers');
const {
  normalizeAdmissionPin,
  isValidAdmissionPinFormat
} = require('../utils/admissionPinHelpers');
const { loadSessionAdmissionPin, requireAdmissionPin } = require('../middleware/admissionPinAuth');
const { resolveHeroSlides } = require('../utils/heroImageHelpers');

router.get('/', async (req, res, next) => {
  try {
    const [heroSlideDocs, events, news] = await Promise.all([
      HeroSlide.find({ active: true }).sort('order'),
      Event.find().sort('-eventDate').limit(8),
      News.find().sort('-publishedAt').limit(3)
    ]);
    const heroSlides = resolveHeroSlides(heroSlideDocs);
    res.render('pages/home', {
      title: 'Home',
      heroSlides,
      events,
      news
    });
  } catch (err) {
    next(err);
  }
});

router.get('/contact', (req, res) => {
  res.render('pages/contact', { title: 'Contact Us' });
});

router.post('/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.render('pages/contact', {
      title: 'Contact Us',
      error: 'Please fill in all required fields.',
      form: req.body
    });
  }
  res.render('pages/contact', {
    title: 'Contact Us',
    success: 'Thank you for contacting St. Louis College Jos. We will respond shortly.'
  });
});

router.get('/admission/admission-list', async (req, res, next) => {
  try {
    const admissionList = await AdmissionList.findOne({ key: 'admission-list' }).select('-data');
    res.render('pages/admission-list', {
      title: 'Admission List',
      admissionList
    });
  } catch (err) {
    next(err);
  }
});

router.get('/admission/admission-list/pdf', async (req, res, next) => {
  try {
    const admissionList = await AdmissionList.findOne({ key: 'admission-list' }).select('+data');
    if (!admissionList || !admissionList.data?.length) {
      return res.status(404).render('pages/404', { title: 'Document Not Found' });
    }

    const fileName = admissionList.originalName || 'admission-list.pdf';
    res.setHeader('Content-Type', admissionList.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Content-Length', admissionList.data.length);
    res.send(admissionList.data);
  } catch (err) {
    next(err);
  }
});

function renderApplyNowPage(res, data = {}) {
  res.render('pages/apply-now', {
    title: 'Apply Now',
    classLevels: CLASS_LEVELS,
    error: null,
    success: null,
    submittedApplication: null,
    admissionPin: null,
    form: {},
    ...data
  });
}

function renderApplyNowAccessPage(res, data = {}) {
  res.render('pages/apply-now-access', {
    title: 'Application Access',
    error: null,
    pin: '',
    ...data
  });
}

router.get('/admission/apply-now/access', (req, res) => {
  renderApplyNowAccessPage(res);
});

router.post('/admission/apply-now/access', async (req, res, next) => {
  try {
    const pin = normalizeAdmissionPin(req.body.pin);

    if (!isValidAdmissionPinFormat(pin)) {
      return renderApplyNowAccessPage(res, {
        error: 'Enter a valid 6-digit admission PIN.',
        pin
      });
    }

    const pinDoc = await AdmissionPin.findOne({ pin });
    if (!pinDoc || pinDoc.status === 'revoked') {
      return renderApplyNowAccessPage(res, {
        error: 'This PIN is invalid or has been revoked.',
        pin
      });
    }

    if (pinDoc.status === 'used') {
      return redirectUsedPinToApplication(req, res, pinDoc, renderApplyNowAccessPage);
    }

    req.session.admissionPinId = pinDoc._id.toString();
    res.redirect('/admission/apply-now');
  } catch (err) {
    next(err);
  }
});

router.post('/admission/apply-now/logout', (req, res) => {
  delete req.session.admissionPinId;
  delete req.session.submittedApplicationId;
  res.redirect('/admission/apply-now/access');
});

router.get('/admission/apply-now', async (req, res, next) => {
  try {
    const pinDoc = await AdmissionPin.findById(req.session.admissionPinId);
    if (!pinDoc || pinDoc.status === 'revoked') {
      delete req.session.admissionPinId;
      return res.redirect('/admission/apply-now/access');
    }

    if (pinDoc.status === 'used') {
      return redirectUsedPinToApplication(req, res, pinDoc, renderApplyNowAccessPage);
    }

    if (pinDoc.status !== 'active') {
      delete req.session.admissionPinId;
      return res.redirect('/admission/apply-now/access');
    }

    renderApplyNowPage(res, { admissionPin: pinDoc });
  } catch (err) {
    next(err);
  }
});

router.post('/admission/apply-now', requireAdmissionPin, async (req, res, next) => {
  try {
    const form = normalizeApplicationInput(req.body);
    const errors = validateApplicationInput(form);

    if (errors.length) {
      return renderApplyNowPage(res, {
        error: errors.join(' '),
        form,
        admissionPin: req.admissionPin
      });
    }

    const pinDoc = await AdmissionPin.findOne({
      _id: req.admissionPin._id,
      status: 'active'
    });

    if (!pinDoc) {
      delete req.session.admissionPinId;
      return res.redirect('/admission/apply-now/access');
    }

    const application = await AdmissionApplication.create({
      ...form,
      dateOfBirth: new Date(form.dateOfBirth),
      admissionPin: pinDoc._id
    });

    pinDoc.status = 'used';
    pinDoc.usedAt = new Date();
    pinDoc.application = application._id;
    await pinDoc.save();

    delete req.session.admissionPinId;

    req.session.submittedApplicationId = application._id.toString();
    res.redirect(`/admission/applications/${application.applicationId}/review?submitted=1`);
  } catch (err) {
    next(err);
  }
});

function renderApplicationReviewPage(res, data = {}) {
  res.render('pages/application-review', {
    title: 'Application Preview',
    authorized: false,
    application: null,
    error: null,
    lookup: {},
    reprintOnly: false,
    formatApplicationDate,
    formatApplicationDateTime,
    getApplicantFullName,
    ...data
  });
}

async function redirectUsedPinToApplication(req, res, pinDoc, renderAccessPage) {
  const application = await AdmissionApplication.findById(pinDoc.application);
  if (!application) {
    return renderAccessPage(res, {
      error: 'This PIN was used but the linked application could not be found. Contact the admissions office.',
      pin: pinDoc.pin
    });
  }

  req.session.admissionPinId = pinDoc._id.toString();
  req.session.submittedApplicationId = application._id.toString();
  return res.redirect(`/admission/applications/${application.applicationId}/review?reprint=1`);
}

router.get('/admission/applications/review', (req, res) => {
  renderApplicationReviewPage(res);
});

router.post('/admission/applications/review', async (req, res, next) => {
  try {
    const applicationId = req.body.applicationId?.trim();
    const parentPhone = req.body.parentPhone?.trim();
    const lookup = { applicationId: applicationId || '', parentPhone: parentPhone || '' };

    if (!applicationId || !parentPhone) {
      return renderApplicationReviewPage(res, {
        error: 'Enter your application reference and parent or guardian phone number.',
        lookup
      });
    }

    const application = await AdmissionApplication.findOne({ applicationId });
    if (!application) {
      return renderApplicationReviewPage(res, {
        error: 'Application not found or phone number does not match our records.',
        lookup
      });
    }

    if (normalizePhone(application.parentPhone) !== normalizePhone(parentPhone)) {
      return renderApplicationReviewPage(res, {
        error: 'Application not found or phone number does not match our records.',
        lookup
      });
    }

    req.session.submittedApplicationId = application._id.toString();
    res.redirect(`/admission/applications/${application.applicationId}/review`);
  } catch (err) {
    next(err);
  }
});

router.get('/admission/applications/:applicationId/review', async (req, res, next) => {
  try {
    const application = await AdmissionApplication.findOne({ applicationId: req.params.applicationId })
      .populate('admissionPin', 'pin');

    if (!application) {
      return renderApplicationReviewPage(res, {
        error: 'Application not found.',
        lookup: { applicationId: req.params.applicationId }
      });
    }

    if (!canAccessApplicationReview(req, application)) {
      return renderApplicationReviewPage(res, {
        lookup: { applicationId: req.params.applicationId }
      });
    }

    renderApplicationReviewPage(res, {
      authorized: true,
      application,
      reprintOnly: req.query.reprint === '1',
      success: req.query.submitted === '1'
        ? 'Application submitted successfully. Preview your form below and print a copy for your records.'
        : req.query.reprint === '1'
          ? 'This PIN was already used to submit an application. You can preview and print your submitted form below.'
          : null
    });
  } catch (err) {
    next(err);
  }
});

const sectionRoutes = ['about', 'academics', 'admission', 'student-life', 'downloads'];

sectionRoutes.forEach((section) => {
  router.get(`/${section}/:slug`, async (req, res, next) => {
    try {
      const page = await Page.findOne({ slug: req.params.slug, section });
      if (!page) return res.status(404).render('pages/404', { title: 'Page Not Found' });
      res.render('pages/content', { title: page.title, page });
    } catch (err) {
      next(err);
    }
  });
});

module.exports = router;
