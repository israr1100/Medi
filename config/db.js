// config/db.js
// Single shared connection to the SQLite database file.
// We use Node's built-in "node:sqlite" module (available from Node 22.5+)
// instead of a third-party package. It needs no native compilation step,
// which means no Python/Visual Studio Build Tools headaches for beginners
// installing this on Windows, Mac, or Linux - it just works out of the box.
// Its API (prepare/run/get/all) is intentionally very close to the popular
// better-sqlite3 package, so the rest of the code reads the same way.

const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, '..', 'database', 'medprime.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

module.exports = db;
