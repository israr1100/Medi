// routes/auth.js
// Handles account creation and login for patients.
// Passwords are never stored in plain text - bcrypt one-way hashes them.

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { redirectIfLoggedIn } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 10;

// ---------- Register ----------
router.get('/register', redirectIfLoggedIn, (req, res) => {
  res.render('register', { error: null, formData: {}, pageTitle: 'Create Account' });
});

router.post(
  '/register',
  redirectIfLoggedIn,
  [
    body('full_name').trim().notEmpty().withMessage('Full name is required'),
    body('email').trim().isEmail().withMessage('Enter a valid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('date_of_birth').notEmpty().withMessage('Date of birth is required')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('register', { error: errors.array()[0].msg, formData: req.body, pageTitle: 'Create Account' });
    }

    const { full_name, email, password, phone, date_of_birth, gender, address } = req.body;

    const existing = db.prepare('SELECT id FROM patients WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.render('register', { error: 'An account with this email already exists.', formData: req.body, pageTitle: 'Create Account' });
    }

    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);

    const result = db
      .prepare(
        `INSERT INTO patients (full_name, email, password_hash, phone, date_of_birth, gender, address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(full_name, email.toLowerCase(), passwordHash, phone, date_of_birth, gender || null, address || null);

    req.session.patientId = result.lastInsertRowid;
    req.session.patientName = full_name;
    res.redirect('/portal/dashboard');
  }
);

// ---------- Login ----------
router.get('/login', redirectIfLoggedIn, (req, res) => {
  res.render('login', { error: null, email: '', pageTitle: 'Patient Login' });
});

router.post(
  '/login',
  redirectIfLoggedIn,
  [
    body('email').trim().isEmail().withMessage('Enter a valid email address'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('login', { error: errors.array()[0].msg, email: req.body.email || '', pageTitle: 'Patient Login' });
    }

    const { email, password } = req.body;
    const patient = db.prepare('SELECT * FROM patients WHERE email = ?').get(email.toLowerCase());

    // Same generic error whether the email doesn't exist or the password
    // is wrong - this avoids confirming to an attacker which emails are
    // registered.
    if (!patient || !bcrypt.compareSync(password, patient.password_hash)) {
      return res.render('login', { error: 'Incorrect email or password.', email, pageTitle: 'Patient Login' });
    }

    req.session.patientId = patient.id;
    req.session.patientName = patient.full_name;
    res.redirect('/portal/dashboard');
  }
);

// ---------- Logout ----------
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
