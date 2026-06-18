// services/reminderScheduler.js
// Runs once a day and emails patients about appointments happening
// tomorrow. Each appointment is marked reminder_sent = 1 right after
// the email goes out, so a server restart can never cause a duplicate
// reminder.

const cron = require('node-cron');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { sendAppointmentReminder } = require('./email');

const dbPath = path.join(__dirname, '../database/medprime.db');

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD, matches <input type="date">
}

async function runReminderSweep() {
  const db = new DatabaseSync(dbPath);
  try {
    const tomorrow = tomorrowISO();

    const due = db
      .prepare(
        `SELECT a.*, p.full_name, p.email, d.name AS department_name
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         JOIN departments d ON d.id = a.department_id
         WHERE a.preferred_date = ?
           AND a.status != 'cancelled'
           AND a.reminder_sent = 0`
      )
      .all(tomorrow);

    for (const row of due) {
      await sendAppointmentReminder(
        { full_name: row.full_name, email: row.email },
        row,
        row.department_name
      );
      db.prepare('UPDATE appointments SET reminder_sent = 1 WHERE id = ?').run(row.id);
    }

    if (due.length) {
      console.log(`Reminder sweep: sent ${due.length} appointment reminder(s) for ${tomorrow}.`);
    }
  } catch (err) {
    console.error('Reminder sweep failed:', err.message);
  } finally {
    db.close();
  }
}

// Runs every day at 8:00 AM server time. Change the cron expression if
// you want a different time (e.g. '0 18 * * *' for 6:00 PM the day before).
function startReminderScheduler() {
  cron.schedule('0 8 * * *', runReminderSweep);
  console.log('Appointment reminder scheduler started (daily at 08:00).');
}

module.exports = { startReminderScheduler, runReminderSweep };
