// middleware/auth.js
// Protects patient-only pages. If there is no logged-in patient in the
// session, the visitor is redirected to the login page instead of being
// allowed to view (or worse, edit) someone else's data.

function requireLogin(req, res, next) {
  if (req.session && req.session.patientId) {
    return next();
  }
  return res.redirect('/login');
}

// Used on the login/register pages themselves: if you're already logged
// in, sending you back to the dashboard is friendlier than showing the
// login form again.
function redirectIfLoggedIn(req, res, next) {
  if (req.session && req.session.patientId) {
    return res.redirect('/portal/dashboard');
  }
  return next();
}

module.exports = { requireLogin, redirectIfLoggedIn };
