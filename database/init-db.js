// database/init-db.js
// Run this once with: npm run init-db
// It creates database/medprime.db and sets up all tables, then seeds
// reference data (departments and lab tests) so the booking forms have
// real options to choose from. Safe to re-run any time — it only uses
// CREATE TABLE IF NOT EXISTS and INSERT OR IGNORE, so existing data
// (including your patients, appointments, and test requests) is never
// wiped or duplicated.

const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs'); // Needed to secure staff passwords

const dbPath = path.join(__dirname, 'medprime.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

console.log('Creating tables...');

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

// ---------- Migration for databases created before reminder_sent existed ----------
// CREATE TABLE IF NOT EXISTS won't add a new column to an appointments
// table that already exists, so we add it explicitly here. If it's
// already there (fresh install), SQLite throws "duplicate column name"
// and we just ignore that.
try {
  db.exec('ALTER TABLE appointments ADD COLUMN reminder_sent INTEGER NOT NULL DEFAULT 0;');
  console.log('Migrated: added reminder_sent column to appointments.');
} catch (err) {
  // Column already exists - nothing to do.
}

console.log('Seeding departments...');
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

console.log('Seeding lab tests...');
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

console.log('Seeding initial technician user...');
const salt = bcrypt.genSaltSync(10);
const hashedTechPassword = bcrypt.hashSync('tech123', salt);

const insertStaff = db.prepare('INSERT OR IGNORE INTO staff (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)');
insertStaff.run('Technician John', 'john@medprime.com', hashedTechPassword, 'technician');

console.log('Database ready at', dbPath);
db.close();
