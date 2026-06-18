// config/db.js
// Single shared connection to the SQLite database file.
// Supports dynamic database path for serverless environments (Vercel) and auto-initialization.

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

// 1. Determine database path dynamically
const isVercel = Boolean(process.env.VERCEL);
const dbPath = isVercel
  ? path.join('/tmp', 'medprime.db')
  : path.join(__dirname, '..', 'database', 'medprime.db');

const dbDir = path.dirname(dbPath);

// Ensure the parent directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbExists = fs.existsSync(dbPath);

// 2. Open/create database connection
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// 3. Automatically initialize and seed if it's a new database
if (!dbExists) {
  console.log(`[Database] Database not found at ${dbPath}. Initializing schema and seed data...`);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS lab_tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT,
        price REAL NOT NULL,
        turnaround_time TEXT
      );

      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        phone TEXT,
        date_of_birth TEXT,
        gender TEXT,
        address TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        department_id INTEGER NOT NULL,
        preferred_date TEXT NOT NULL,
        preferred_time TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reminder_sent INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (department_id) REFERENCES departments(id)
      );

      CREATE TABLE IF NOT EXISTS test_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        test_id INTEGER NOT NULL,
        preferred_date TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        result_summary TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (test_id) REFERENCES lab_tests(id)
      );

      CREATE TABLE IF NOT EXISTS staff (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'technician',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration for legacy deployments (kept for schema parity)
    try {
      db.exec('ALTER TABLE appointments ADD COLUMN reminder_sent INTEGER NOT NULL DEFAULT 0;');
    } catch (err) {
      // Column already exists
    }

    // Seed departments
    const departments = [
      ['General Medicine', 'Routine check-ups and general health concerns'],
      ['Cardiology', 'Heart health, ECG and cardiac screening'],
      ['Radiology & Imaging', 'X-Ray, ultrasound, CT and MRI scans'],
      ['Pathology', 'Blood, urine and tissue sample analysis'],
      ['Diabetes & Endocrinology', 'Blood sugar, thyroid and hormone management'],
      ['Pediatrics', 'Health care for infants, children and teens']
    ];
    const insertDept = db.prepare('INSERT OR IGNORE INTO departments (name, description) VALUES (?, ?)');
    departments.forEach(d => insertDept.run(...d));

    // Seed lab tests
    const labTests = [
      ['Complete Blood Count (CBC)', 'Blood', 350, '4-6 hours'],
      ['Lipid Profile', 'Blood', 600, '6-8 hours'],
      ['Liver Function Test (LFT)', 'Blood', 700, '6-8 hours'],
      ['Kidney Function Test (KFT)', 'Blood', 650, '6-8 hours'],
      ['Thyroid Profile (T3, T4, TSH)', 'Hormone', 800, '24 hours'],
      ['HbA1c (Diabetes Marker)', 'Blood', 500, '6-8 hours'],
      ['Urine Routine Examination', 'Urine', 200, '3-4 hours'],
      ['Chest X-Ray', 'Imaging', 450, 'Same day'],
      ['Abdominal Ultrasound', 'Imaging', 1200, 'Same day'],
      ['ECG (Electrocardiogram)', 'Cardiac', 400, 'Same day']
    ];
    const insertTest = db.prepare('INSERT OR IGNORE INTO lab_tests (name, category, price, turnaround_time) VALUES (?, ?, ?, ?)');
    labTests.forEach(t => insertTest.run(...t));

    // Seed technician
    const salt = bcrypt.genSaltSync(10);
    const hashedTechPassword = bcrypt.hashSync('tech123', salt);
    const insertStaff = db.prepare('INSERT OR IGNORE INTO staff (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)');
    insertStaff.run('Technician John', 'john@medprime.com', hashedTechPassword, 'technician');

    console.log(`[Database] Initialization complete. Database ready at ${dbPath}`);
  } catch (initErr) {
    console.error('[Database] Failed to initialize database:', initErr);
  }
} else {
  console.log(`[Database] Connected to existing database at ${dbPath}`);
}

module.exports = db;
