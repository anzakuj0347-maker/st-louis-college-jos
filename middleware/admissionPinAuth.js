const AdmissionPin = require('../models/AdmissionPin');

async function loadSessionAdmissionPin(req) {
  const pinId = req.session.admissionPinId;
  if (!pinId) return null;

  const pinDoc = await AdmissionPin.findById(pinId);
  if (!pinDoc || pinDoc.status !== 'active') {
    delete req.session.admissionPinId;
    return null;
  }

  return pinDoc;
}

async function requireAdmissionPin(req, res, next) {
  try {
    const pinDoc = await loadSessionAdmissionPin(req);
    if (!pinDoc) {
      return res.redirect('/admission/apply-now/access');
    }

    req.admissionPin = pinDoc;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  loadSessionAdmissionPin,
  requireAdmissionPin
};
