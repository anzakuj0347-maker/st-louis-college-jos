function requireAdmin(req, res, next) {
  if (!req.session.admin) {
    return res.redirect('/slc-admin/login');
  }
  next();
}

module.exports = { requireAdmin };
