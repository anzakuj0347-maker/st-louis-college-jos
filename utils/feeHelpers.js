const FEE_STATUSES = ['paid', 'owing'];

function normalizeFeeStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return FEE_STATUSES.includes(status) ? status : 'paid';
}

function getFeeAccess(user) {
  const feeStatus = normalizeFeeStatus(user?.feeStatus);
  return {
    feeStatus,
    loginAllowed: true,
    resultAccessible: feeStatus === 'paid'
  };
}

function isResultAccessible(user) {
  return getFeeAccess(user).resultAccessible;
}

function formatFeeStatusLabel(status) {
  return normalizeFeeStatus(status) === 'paid' ? 'Paid' : 'Owing';
}

module.exports = {
  FEE_STATUSES,
  normalizeFeeStatus,
  getFeeAccess,
  isResultAccessible,
  formatFeeStatusLabel
};
