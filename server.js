// server.js
// Entry point for the Medprime Diagnostic Centre application.

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');

const { requireLogin } = require('./middleware/auth');
const siteRoutes = require('./routes/site');
const authRoutes = require('./routes/auth');
const portalRoutes = require('./routes/portal');
const adminRoutes = require('./routes/admin');
const { startReminderScheduler } = require('./services/reminderScheduler');

// Friendly check: remind the developer to run the DB setup script if the
// database file doesn't exist yet, instead of crashing with a cryptic
// SQLite error.
const dbPath = path.join(__dirname, 'database', 'medprime.db');
if (!fs.existsSync(dbPath)) {
  console.error('\nDatabase not found.');
  console.error('Run "npm run init-db" first, then start the server again.\n');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- View engine ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------- Core middleware ----------
app.use(express.urlencoded({ extended: true })); // parse HTML form submissions
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // JavaScript in the browser can't read the cookie
      maxAge: 1000 * 60 * 60 * 4 // 4 hour session
    }
  })
);

// Make the logged-in patient's name available to every EJS view (used
// to show/hide "Login" vs "My Account" in the navbar) without passing
// it manually in every single route.
app.use((req, res, next) => {
  res.locals.isLoggedIn = Boolean(req.session.patientId);
  res.locals.patientName = req.session.patientName || null;
  res.locals.isStaffLoggedIn = Boolean(req.session.staffId);
  next();
});

// ---------- Routes ----------
app.use('/', siteRoutes);
app.use('/', authRoutes);
app.use('/portal', requireLogin, portalRoutes);
app.use('/', adminRoutes);

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, () => {
  console.log(`Medprime Diagnostic Centre running at http://localhost:${PORT}`);
  startReminderScheduler();
});
