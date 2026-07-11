function requireStaff(req, res, next) {
  if (!req.session.staff) return res.redirect('/staff/login');
  next();
}

module.exports = { requireStaff };
