# Medprime Diagnostic Centre

A full working website for a diagnostic centre: a public marketing site (home, services, about, contact) plus a secure patient portal where patients register, book appointments, request lab tests, and track status — all backed by a real database.

Theme: orange (#f2690f) and white, used consistently across the public site and the patient portal.

## 1. What's included

**Public site** — Home, Services (departments + lab test price list), About, Contact. No login required.

**Patient accounts** — Register and log in with email + password. Passwords are hashed with bcrypt, never stored in plain text.

**Patient portal** (login required) — Dashboard with appointments and test requests, a booking form, a test-request form, and an editable profile page.

**Backend** — Node.js + Express, server-rendered with EJS templates, session-based authentication, and input validation on every form.

**Database** — SQLite, using Node's built-in `node:sqlite` module (no extra database server, no native compilation step — it just works after `npm install`).

## 2. How the system is designed

### Architecture at a glance

```
Browser  ─────►  Express routes  ─────►  SQLite database (medprime.db)
 (EJS-rendered    - site.js (public pages)
  HTML + forms)   - auth.js  (register/login/logout)
                  - portal.js (dashboard, booking, test requests, profile)
                        │
                  middleware/auth.js
                  (blocks /portal/* unless logged in)
```

Every page is rendered on the server (EJS templates in `views/`) and sent to the browser as plain HTML — there's no separate frontend build step, which keeps the project approachable for a beginner.

### Database schema

| Table | Purpose | Key columns |
|---|---|---|
| `patients` | One row per registered patient | `id`, `full_name`, `email` (unique), `password_hash`, `phone`, `date_of_birth`, `gender`, `address` |
| `departments` | Reference list used by the booking form | `id`, `name`, `description` |
| `lab_tests` | Reference list used by the test-request form | `id`, `name`, `category`, `price`, `turnaround_time` |
| `appointments` | One row per booking | `id`, `patient_id` (FK), `department_id` (FK), `preferred_date`, `preferred_time`, `reason`, `status` |
| `test_requests` | One row per test request | `id`, `patient_id` (FK), `test_id` (FK), `preferred_date`, `notes`, `status`, `result_summary` |

`appointments` and `test_requests` both store a `patient_id` foreign key, which is how the portal knows which records belong to which patient.

### How patient data stays secure

- **Password hashing** — `bcryptjs` one-way hashes every password before it's stored. The plain password is never written to the database or logged.
- **Session-based access, not a guessable ID** — after login, the server stores the patient's id in an encrypted session cookie (`httpOnly`, so page JavaScript can't read it). Every portal route reads `req.session.patientId` from that cookie — it's never taken from a URL or form field — so one patient cannot view or edit another patient's appointments or tests by changing a number in the address bar.
- **Parameterized queries everywhere** — every database query uses `?` placeholders (e.g. `db.prepare('SELECT * FROM patients WHERE email = ?').get(email)`), which prevents SQL injection. User input is never concatenated directly into SQL text.
- **Server-side validation** — `express-validator` checks every form submission (valid email, minimum password length, required fields) before anything touches the database.
- **Generic login errors** — a wrong email and a wrong password both show the same "Incorrect email or password" message, so the login form can't be used to discover which emails are registered.

### How the patient portal displays data

When a logged-in patient opens `/portal/dashboard`, the route looks up their `patient_id` from the session, then runs two queries — one joining `appointments` to `departments` (to show a readable department name instead of just an id), and one joining `test_requests` to `lab_tests` (to show the test name and price). Both queries filter with `WHERE patient_id = ?`, so the dashboard only ever shows that one patient's records.

## 3. Design plan (orange & white theme)

- **Colors**: primary orange `#f2690f`, darker orange for hover states `#c9540a`, a soft peach tint `#fff1e6` for section backgrounds, near-black ink `#20232b` for text, white for cards and base background.
- **Type**: "Plus Jakarta Sans" for headings (bold, confident), "Inter" for body text (easy to read at small sizes).
- **Signature visual motif**: a thin pulse/EKG line — tying back to "diagnostics" — used as a section divider and behind the homepage hero illustration, instead of a plain straight line.
- **Layout**: a single accent color (orange) is reserved for actions and status — buttons, links, and "pending" badges — so it always means "this needs your attention or action."
- **Patient portal**: a left sidebar for navigation, a calm off-white content area, and color-coded status badges (orange = pending, green = confirmed/completed, gray = cancelled) so patients can scan their records at a glance.

## 4. Project structure

```
medprime/
├── server.js                 Entry point — starts Express
├── package.json
├── .env.example               Copy to .env before running
├── config/db.js                Shared database connection
├── database/init-db.js         Creates tables + seed data (run once)
├── middleware/auth.js           Protects /portal/* routes
├── routes/
│   ├── site.js                  Public pages
│   ├── auth.js                  Register / login / logout
│   └── portal.js                 Dashboard, booking, test requests, profile
├── views/                        EJS templates (one per page)
│   └── partials/                  Shared head, navbar, footer, sidebar
└── public/
    ├── css/style.css              All styling (orange/white theme)
    └── js/, images/
```

## 5. Step-by-step setup in VS Code

### Step 1 — Install prerequisites

You need **Node.js version 22.5 or newer** (this project uses Node's built-in SQLite support, which requires that version).

1. Check your version: open a terminal and run `node -v`.
2. If it's lower than 22.5, or Node isn't installed, download the latest LTS installer from [nodejs.org](https://nodejs.org) and install it, then restart your terminal.

### Step 2 — Open the project in VS Code

1. Unzip the project folder you downloaded.
2. Open VS Code → **File → Open Folder...** → select the unzipped `medprime` folder.
3. Open the integrated terminal: **Terminal → New Terminal** (or `` Ctrl+` ``).

### Step 3 — Install dependencies

In the terminal, run:

```bash
npm install
```

This downloads Express, EJS, bcrypt, and the other small libraries listed in `package.json` into a `node_modules` folder. No database software needs to be installed separately — SQLite support is built into Node itself.

### Step 4 — Create your environment file

```bash
cp .env.example .env
```

(On Windows Command Prompt, use `copy .env.example .env` instead.)

Open the new `.env` file and replace `SESSION_SECRET` with any long random string — this is used to sign session cookies. You don't need to change `PORT` unless `3000` is already in use on your machine.

### Step 5 — Create the database

```bash
npm run init-db
```

This creates `database/medprime.db` and fills it with the department and lab test lists you'll see in the booking forms. Run this command again any time you want to wipe the database and start fresh.

### Step 6 — Start the server

```bash
npm start
```

You should see:

```
Medprime Diagnostic Centre running at http://localhost:3000
```

Open that address in your browser. While building, you can use `npm run dev` instead, which restarts the server automatically whenever you save a file.

### Step 7 — Try the app

1. Click **Register** and create a patient account.
2. You'll land on the **Dashboard** — click **Book an Appointment** or **Request a Test** and submit a form.
3. Return to the dashboard to see the new record with a "pending" status badge.
4. Click **Log Out**, then **Log In** again with the same email and password to confirm your data was saved.

## 6. Where to go next

This project is intentionally scoped to the core patient-facing flow. Natural next additions, if you want to keep building:

- An **admin view** for staff to update an appointment's status to "confirmed" or attach a result to a completed test request (right now, status changes would be made directly through a database tool while learning).
- **Email or SMS reminders** for upcoming appointments.
- **File uploads** for lab reports (PDFs) attached to a `test_requests` row.
- Moving from session cookies to a "remember me" option, or adding password-reset-by-email.

## 7. Troubleshooting

- **"Database not found" error on startup** — you skipped Step 5; run `npm run init-db`.
- **`node:sqlite` errors or the app won't start** — run `node -v` and confirm it's 22.5 or newer; upgrade Node if not.
- **Port 3000 already in use** — change `PORT` in `.env` to something else, like `3001`.
- **Styles look unstyled/broken** — make sure the server is actually running and you're loading `http://localhost:3000`, not opening an HTML file directly from disk.
