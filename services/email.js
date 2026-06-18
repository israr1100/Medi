// services/email.js
// Centralized email sending for Medprime: appointment confirmations,
// status updates, reminders, and test-result notifications.
//
// Uses Resend (https://resend.com). If RESEND_API_KEY is not set, emails
// are skipped and logged to the console instead — so local development
// never breaks just because email isn't configured yet.

const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

// Resend's shared sandbox sender works immediately with no domain setup,
// but only delivers to the email address you signed up to Resend with.
// Once you verify your own domain in the Resend dashboard, set EMAIL_FROM
// in .env to something like "Medprime Diagnostic Centre <no-reply@yourdomain.com>".
const FROM = process.env.EMAIL_FROM || 'Medprime Diagnostic Centre <onboarding@resend.dev>';
const SITE_NAME = 'Medprime Diagnostic Centre';

const BRAND_ORANGE = '#f2690f';
const BRAND_PEACH = '#fff1e6';
const BRAND_INK = '#20232b';

// Wraps any email body in a consistent, on-brand HTML shell.
function wrapEmail(heading, bodyHtml) {
  return `
  <div style="font-family: 'Inter', Arial, sans-serif; background:${BRAND_PEACH}; padding:32px 0;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #f1e3d6;">
      <div style="background:${BRAND_ORANGE}; padding:20px 28px;">
        <span style="color:#ffffff; font-size:18px; font-weight:700; font-family:'Plus Jakarta Sans', Arial, sans-serif;">
          ${SITE_NAME}
        </span>
      </div>
      <div style="padding:28px;">
        <h2 style="color:${BRAND_INK}; font-family:'Plus Jakarta Sans', Arial, sans-serif; margin:0 0 16px; font-size:20px;">
          ${heading}
        </h2>
        <div style="color:${BRAND_INK}; font-size:15px; line-height:1.6;">
          ${bodyHtml}
        </div>
      </div>
      <div style="padding:16px 28px; background:${BRAND_PEACH}; color:#7a6a5c; font-size:12px;">
        This is an automated message from ${SITE_NAME}. Please don't reply directly to this email.
      </div>
    </div>
  </div>`;
}

async function send(to, subject, html) {
  if (!resend) {
    console.log(`[email skipped — RESEND_API_KEY not set] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    // An email failure should never break a booking, cancellation, or
    // admin action — log it and move on.
    console.error('Email send failed:', err.message);
  }
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ---------- Appointments ----------

function sendAppointmentConfirmation(patient, appointment, departmentName) {
  const html = wrapEmail('Appointment Request Received', `
    <p>Hi ${patient.full_name},</p>
    <p>We've received your appointment request for <strong>${departmentName}</strong>.</p>
    <p><strong>Date:</strong> ${formatDate(appointment.preferred_date)}<br/>
       <strong>Time:</strong> ${appointment.preferred_time}</p>
    <p>Status: <strong style="color:${BRAND_ORANGE};">Pending confirmation</strong></p>
    <p>We'll email you again once the centre confirms your slot. You can also check the status anytime from your dashboard.</p>
  `);
  return send(patient.email, 'Your appointment request has been received', html);
}

function sendAppointmentStatusUpdate(patient, appointment, departmentName) {
  const statusLabel = appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1);
  const html = wrapEmail('Appointment Status Updated', `
    <p>Hi ${patient.full_name},</p>
    <p>Your appointment for <strong>${departmentName}</strong> on ${formatDate(appointment.preferred_date)} at ${appointment.preferred_time} is now:</p>
    <p style="font-size:18px;"><strong style="color:${BRAND_ORANGE};">${statusLabel}</strong></p>
    <p>Log in to your dashboard for full details.</p>
  `);
  return send(patient.email, `Your appointment is now ${appointment.status}`, html);
}

function sendAppointmentReminder(patient, appointment, departmentName) {
  const html = wrapEmail('You Have an Appointment Tomorrow', `
    <p>Hi ${patient.full_name},</p>
    <p>This is a reminder that you have an appointment for <strong>${departmentName}</strong> tomorrow.</p>
    <p><strong>Date:</strong> ${formatDate(appointment.preferred_date)}<br/>
       <strong>Time:</strong> ${appointment.preferred_time}</p>
    <p>Please arrive 10 minutes early. If you need to cancel, you can do so from your dashboard.</p>
  `);
  return send(patient.email, 'Reminder: appointment tomorrow', html);
}

// ---------- Test requests ----------

function sendTestRequestConfirmation(patient, testRequest, testName) {
  const html = wrapEmail('Test Request Received', `
    <p>Hi ${patient.full_name},</p>
    <p>We've received your request for <strong>${testName}</strong>.</p>
    <p><strong>Preferred date:</strong> ${formatDate(testRequest.preferred_date)}</p>
    <p>Status: <strong style="color:${BRAND_ORANGE};">Pending</strong></p>
    <p>We'll let you know as soon as your results are ready.</p>
  `);
  return send(patient.email, 'Your lab test request has been received', html);
}

function sendTestResultReady(patient, testRequest, testName) {
  const html = wrapEmail('Your Test Results Are Ready', `
    <p>Hi ${patient.full_name},</p>
    <p>Your results for <strong>${testName}</strong> are now available.</p>
    <p>Log in to your dashboard to view the full summary.</p>
  `);
  return send(patient.email, 'Your test results are ready', html);
}

module.exports = {
  sendAppointmentConfirmation,
  sendAppointmentStatusUpdate,
  sendAppointmentReminder,
  sendTestRequestConfirmation,
  sendTestResultReady
};
