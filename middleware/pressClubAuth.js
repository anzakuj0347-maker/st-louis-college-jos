function requirePressClub(req, res, next) {
  if (!req.session.pressClub) return res.redirect('/press-club/login');
  next();
}

module.exports = { requirePressClub };
