const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'bookyourshow.sqlite');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('customer','organiser','admin')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  created_by INTEGER REFERENCES users(id),
  layout_json TEXT NOT NULL, -- [{rowLabel, seatsPerRow, category}]
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organiser_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('movie','concert')),
  description TEXT,
  poster_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id),
  venue_id INTEGER NOT NULL REFERENCES venues(id),
  show_date TEXT NOT NULL,
  show_time TEXT NOT NULL,
  pricing_json TEXT NOT NULL, -- {"Premium": 500, "Standard": 250}
  hold_ttl_seconds INTEGER NOT NULL DEFAULT 600,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL REFERENCES shows(id),
  row_label TEXT NOT NULL,
  seat_number INTEGER NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','held','booked')),
  held_by INTEGER REFERENCES users(id),
  hold_expires_at TEXT,
  booking_id INTEGER,
  UNIQUE(show_id, row_label, seat_number)
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_ref TEXT UNIQUE NOT NULL,
  show_id INTEGER NOT NULL REFERENCES shows(id),
  customer_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled')),
  total_amount REAL NOT NULL,
  qr_data_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  cancelled_at TEXT
);

CREATE TABLE IF NOT EXISTS booking_seats (
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  seat_id INTEGER NOT NULL REFERENCES seats(id),
  PRIMARY KEY (booking_id, seat_id)
);

CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL REFERENCES shows(id),
  category TEXT NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','offered','expired','booked','cancelled')),
  seat_id INTEGER REFERENCES seats(id),
  offer_expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_seats_show ON seats(show_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_show_cat ON waitlist(show_id, category, status);
`);

module.exports = db;
