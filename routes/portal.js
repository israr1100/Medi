// routes/portal.js
// Everything in here is behind requireLogin (applied in server.js), and
// every query is scoped with "WHERE patient_id = ?" using the id stored
// in the patient's own session - never a value taken from the request -
// so one patient can never read or modify another patient's records.

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const {
  sendAppointmentConfirmation,
  sendAppointmentStatusUpdate,
  sendTestRequestConfirmation
} = require('../services/email');

const router = express.Router();

// ---------- Dashboard ----------
router.get('/dashboard', (req, res) => {
  const patientId = req.session.patientId;

  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);

  const appointments = db
    .prepare(
      `SELECT a.*, d.name AS department_name
       FROM appointments a
       JOIN departments d ON d.id = a.department_id
       WHERE a.patient_id = ?
       ORDER BY a.preferred_date DESC, a.id DESC`
    )
    .all(patientId);

  const testRequests = db
    .prepare(
      `SELECT t.*, lt.name AS test_name, lt.price
       FROM test_requests t
       JOIN lab_tests lt ON lt.id = t.test_id
       WHERE t.patient_id = ?
       ORDER BY t.preferred_date DESC, t.id DESC`
    )
    .all(patientId);

  res.render('dashboard', { patient, appointments, testRequests, pageTitle: 'Dashboard' });
});

// ---------- Profile ----------
router.get('/profile', (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.session.patientId);
  res.render('profile', { patient, success: req.query.success || null, pageTitle: 'My Profile' });
});

router.post(
  '/profile',
  [
    body('full_name').trim().notEmpty().withMessage('Full name is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required')
  ],
  (req, res) => {
    const { full_name, phone, address, gender } = req.body;
    db.prepare(
      'UPDATE patients SET full_name = ?, phone = ?, address = ?, gender = ? WHERE id = ?'
    ).run(full_name, phone, address || null, gender || null, req.session.patientId);

    req.session.patientName = full_name;
    res.redirect('/portal/profile?success=1');
  }
);

// ---------- Book an appointment ----------
router.get('/book-appointment', (req, res) => {
  const departments = db.prepare('SELECT * FROM departments ORDER BY name').all();
  res.render('book-appointment', { departments, error: null, formData: {}, pageTitle: 'Book Appointment' });
});

router.post(
  '/book-appointment',
  [
    body('department_id').notEmpty().withMessage('Please choose a department'),
    body('preferred_date').notEmpty().withMessage('Please choose a date'),
    body('preferred_time').notEmpty().withMessage('Please choose a time')
  ],
  (req, res) => {
    const errors = validationResult(req);
    const departments = db.prepare('SELECT * FROM departments ORDER BY name').all();

    if (!errors.isEmpty()) {
      return res.render('book-appointment', {
        departments,
        error: errors.array()[0].msg,
        formData: req.body,
        pageTitle: 'Book Appointment'
      });
    }

    const { department_id, preferred_date, preferred_time, reason } = req.body;

    const result = db
      .prepare(
        `INSERT INTO appointments (patient_id, department_id, preferred_date, preferred_time, reason)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(req.session.patientId, department_id, preferred_date, preferred_time, reason || null);

    // Fire the confirmation email. This never blocks or breaks the
    // booking flow itself — failures are caught and logged inside
    // services/email.js.
    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.session.patientId);
    const department = departments.find(d => String(d.id) === String(department_id));
    sendAppointmentConfirmation(
      patient,
      { id: result.lastInsertRowid, preferred_date, preferred_time },
      department ? department.name : 'the selected department'
    );

    res.redirect('/portal/dashboard');
  }
);

// ---------- Request a lab test ----------
router.get('/request-test', (req, res) => {
  const tests = db.prepare('SELECT * FROM lab_tests ORDER BY category, name').all();
  res.render('request-test', { tests, error: null, formData: {}, pageTitle: 'Request a Test' });
});

router.post(
  '/request-test',
  [
    body('test_id').notEmpty().withMessage('Please choose a test'),
    body('preferred_date').notEmpty().withMessage('Please choose a date')
  ],
  (req, res) => {
    const errors = validationResult(req);
    const tests = db.prepare('SELECT * FROM lab_tests ORDER BY category, name').all();

    if (!errors.isEmpty()) {
      return res.render('request-test', {
        tests,
        error: errors.array()[0].msg,
        formData: req.body,
        pageTitle: 'Request a Test'
      });
    }

    const { test_id, preferred_date, notes } = req.body;

    const result = db
      .prepare(
        `INSERT INTO test_requests (patient_id, test_id, preferred_date, notes)
         VALUES (?, ?, ?, ?)`
      )
      .run(req.session.patientId, test_id, preferred_date, notes || null);

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.session.patientId);
    const test = tests.find(t => String(t.id) === String(test_id));
    sendTestRequestConfirmation(
      patient,
      { id: result.lastInsertRowid, preferred_date },
      test ? test.name : 'the selected test'
    );

    res.redirect('/portal/dashboard');
  }
);

// ---------- Cancel an appointment (only your own) ----------
router.post('/appointments/:id/cancel', (req, res) => {
  const result = db.prepare(
    `UPDATE appointments SET status = 'cancelled'
     WHERE id = ? AND patient_id = ? AND status = 'pending'`
  ).run(req.params.id, req.session.patientId);

  if (result.changes > 0) {
    const row = db
      .prepare(
        `SELECT a.*, d.name AS department_name
         FROM appointments a
         JOIN departments d ON d.id = a.department_id
         WHERE a.id = ?`
      )
      .get(req.params.id);
    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.session.patientId);
    if (row && patient) {
      sendAppointmentStatusUpdate(patient, row, row.department_name);
    }
  }

  res.redirect('/portal/dashboard');
});

module.exports = router;
