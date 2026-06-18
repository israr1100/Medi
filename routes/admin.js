// routes/admin.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { sendAppointmentStatusUpdate, sendTestResultReady } = require('../services/email');

const dbPath = path.join(__dirname, '../database/medprime.db');

// Middleware to secure admin pages
function requireAdmin(req, res, next) {
  if (!req.session.staffId) {
    return res.redirect('/admin/login');
  }
  next();
}

// GET: Display Technician Login Screen
router.get('/admin/login', (req, res) => {
  if (req.session.staffId) return res.redirect('/admin/dashboard');
  res.render('admin/login', { error: null });
});

// POST: Process Technician Login Form
router.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  const db = new DatabaseSync(dbPath);

  try {
    const stmt = db.prepare('SELECT * FROM staff WHERE email = ?');
    const staff = stmt.get(email);

    if (!staff || !bcrypt.compareSync(password, staff.password_hash)) {
      return res.render('admin/login', { error: 'Invalid staff email or password.' });
    }

    // Assign session values specifically for staff
    req.session.staffId = staff.id;
    req.session.staffName = staff.full_name;
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    res.render('admin/login', { error: 'An unexpected database error occurred.' });
  } finally {
    db.close();
  }
});

// GET: Display Admin Panel Dashboard
router.get('/admin/dashboard', requireAdmin, (req, res) => {
  const db = new DatabaseSync(dbPath);

  try {
    // 1. Fetch appointments joined with patient names & department names
    const appointmentsQuery = db.prepare(`
      SELECT appointments.*, patients.full_name AS patient_name, departments.name AS department_name
      FROM appointments
      JOIN patients ON appointments.patient_id = patients.id
      JOIN departments ON appointments.department_id = departments.id
      ORDER BY appointments.preferred_date DESC
    `);
    const appointments = appointmentsQuery.all();

    // 2. Fetch test requests joined with patient names & test names
    const testsQuery = db.prepare(`
      SELECT test_requests.*, patients.full_name AS patient_name, lab_tests.name AS test_name
      FROM test_requests
      JOIN patients ON test_requests.patient_id = patients.id
      JOIN lab_tests ON test_requests.test_id = lab_tests.id
      ORDER BY test_requests.preferred_date DESC
    `);
    const testRequests = testsQuery.all();

    res.render('admin/dashboard', {
      staffName: req.session.staffName,
      appointments,
      testRequests
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error fetching admin logs');
  } finally {
    db.close();
  }
});

// POST: Update Booking Status
router.post('/admin/appointments/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  const db = new DatabaseSync(dbPath);

  try {
    db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, id);

    // Pull patient + department details so we can email the status change.
    const row = db
      .prepare(
        `SELECT a.*, p.full_name, p.email, d.name AS department_name
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         JOIN departments d ON d.id = a.department_id
         WHERE a.id = ?`
      )
      .get(id);

    if (row) {
      sendAppointmentStatusUpdate({ full_name: row.full_name, email: row.email }, row, row.department_name);
    }

    res.redirect('/admin/dashboard');
  } finally {
    db.close();
  }
});

// POST: Enter Test Results Summary & Complete Status
router.post('/admin/tests/:id/results', requireAdmin, (req, res) => {
  const { result_summary, status } = req.body;
  const { id } = req.params;
  const db = new DatabaseSync(dbPath);

  try {
    db.prepare('UPDATE test_requests SET result_summary = ?, status = ? WHERE id = ?').run(result_summary, status, id);

    // Only email "your results are ready" once the test is actually
    // marked completed — not on every intermediate status change.
    if (status === 'completed') {
      const row = db
        .prepare(
          `SELECT t.*, p.full_name, p.email, lt.name AS test_name
           FROM test_requests t
           JOIN patients p ON p.id = t.patient_id
           JOIN lab_tests lt ON lt.id = t.test_id
           WHERE t.id = ?`
        )
        .get(id);

      if (row) {
        sendTestResultReady({ full_name: row.full_name, email: row.email }, row, row.test_name);
      }
    }

    res.redirect('/admin/dashboard');
  } finally {
    db.close();
  }
});

// GET: Admin Log out
router.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

module.exports = router;
