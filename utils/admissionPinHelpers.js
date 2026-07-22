const crypto = require('crypto');
const AdmissionPin = require('../models/AdmissionPin');

const PIN_LENGTH = 6;

function normalizeAdmissionPin(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function isValidAdmissionPinFormat(pin) {
  return /^\d{6}$/.test(pin);
}

async function generateUniqueAdmissionPin(maxAttempts = 25) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const pin = String(crypto.randomInt(10 ** (PIN_LENGTH - 1), 10 ** PIN_LENGTH));
    const exists = await AdmissionPin.exists({ pin });
    if (!exists) return pin;
  }

  throw new Error('Could not generate a unique admission PIN. Try again.');
}

async function generateAdmissionPins(count, options = {}) {
  const total = Math.min(Math.max(Number(count) || 1, 1), 50);
  const pins = [];
  const label = options.label?.trim() || '';
  const createdBy = options.createdBy?.trim() || '';

  for (let i = 0; i < total; i += 1) {
    const pin = await generateUniqueAdmissionPin();
    const doc = await AdmissionPin.create({
      pin,
      label: label || undefined,
      createdBy: createdBy || undefined
    });
    pins.push(doc);
  }

  return pins;
}

function formatPinStatus(status) {
  const labels = {
    active: 'Active',
    used: 'Used',
    revoked: 'Revoked'
  };
  return labels[status] || status;
}

module.exports = {
  PIN_LENGTH,
  normalizeAdmissionPin,
  isValidAdmissionPinFormat,
  generateUniqueAdmissionPin,
  generateAdmissionPins,
  formatPinStatus
};
