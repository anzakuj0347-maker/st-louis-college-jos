const AdmissionPin = require('../models/AdmissionPin');

async function loadSessionAdmissionPin(req, { allowUsed = false } = {}) {
  const pinId = req.session.admissionPinId;
  if (!pinId) return null;

  const pinDoc = await AdmissionPin.findById(pinId);
  if (!pinDoc || pinDoc.status === 'revoked') {
    delete req.session.admissionPinId;
    return null;
  }

  if (pinDoc.status === 'used') {
    if (!allowUsed || !pinDoc.application) {
      delete req.session.admissionPinId;
      return null;
    }
    return pinDoc;
  }

  return pinDoc.status === 'active' ? pinDoc : null;
}

async function requireActiveAdmissionPin(req, res, next) {
  try {
    const pinDoc = await loadSessionAdmissionPin(req, { allowUsed: false });
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
  requireActiveAdmissionPin,
  requireAdmissionPin: requireActiveAdmissionPin
};
