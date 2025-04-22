module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "You must be logged in to create listing");
    return res.redirect("/login");
  }
  next();
};

module.exports.isServiceProvider = async (req, res, next) => {
  if (req.user && req.user.role === 'provider') {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: 'Only service providers can perform this action'
  });
}
module.exports.isAdmin = async (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  req.flash('error', 'Access denied. Admin privileges required.');
  return res.redirect('/login');
};
