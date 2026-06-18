// routes/site.js
// Public marketing pages - no login required.

const express = require('express');
const db = require('../config/db');

const router = express.Router();

router.get('/', (req, res) => {
  const departments = db.prepare('SELECT * FROM departments ORDER BY id').all();
  res.render('index', { departments, pageTitle: 'Home' });
});

router.get('/about', (req, res) => {
  res.render('about', { pageTitle: 'About Us' });
});

router.get('/services', (req, res) => {
  const departments = db.prepare('SELECT * FROM departments ORDER BY id').all();
  const tests = db.prepare('SELECT * FROM lab_tests ORDER BY category, name').all();
  res.render('services', { departments, tests, pageTitle: 'Services' });
});

router.get('/contact', (req, res) => {
  res.render('contact', { pageTitle: 'Contact' });
});

module.exports = router;
