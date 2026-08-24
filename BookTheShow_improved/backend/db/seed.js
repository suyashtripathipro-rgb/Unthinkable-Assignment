// Seeds a demo admin, organiser, venue and two shows so the app is usable immediately.
const bcrypt = require('bcryptjs');
const db = require('./index');

function upsertUser(name, email, password, role) {
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing) return existing;
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)')
    .run(name, email, hash, role);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
}

const admin = upsertUser('Ava Admin', 'admin@bookyourshow.dev', 'admin123', 'admin');
const organiser = upsertUser('Oscar Organiser', 'organiser@bookyourshow.dev', 'organiser123', 'organiser');
upsertUser('Cara Customer', 'customer@bookyourshow.dev', 'customer123', 'customer');

let venue = db.prepare('SELECT * FROM venues WHERE name = ?').get('Marquee Grand Hall');
if (!venue) {
  const layout = [
    { rowLabel: 'A', seatsPerRow: 10, category: 'Premium' },
    { rowLabel: 'B', seatsPerRow: 10, category: 'Premium' },
    { rowLabel: 'C', seatsPerRow: 12, category: 'Standard' },
    { rowLabel: 'D', seatsPerRow: 12, category: 'Standard' },
    { rowLabel: 'E', seatsPerRow: 12, category: 'Economy' },
  ];
  const info = db
    .prepare('INSERT INTO venues (name, address, created_by, layout_json) VALUES (?,?,?,?)')
    .run('Marquee Grand Hall', '221 Broadway Ave', admin.id, JSON.stringify(layout));
  venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(info.lastInsertRowid);
  console.log('Seeded venue:', venue.name);
}

function seedEventWithShow(title, type, description, poster, dateOffsetDays, time, pricing) {
  let event = db.prepare('SELECT * FROM events WHERE title = ?').get(title);
  if (!event) {
    const info = db
      .prepare('INSERT INTO events (organiser_id, title, type, description, poster_url) VALUES (?,?,?,?,?)')
      .run(organiser.id, title, type, description, poster);
    event = db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid);
  }
  const existingShow = db.prepare('SELECT * FROM shows WHERE event_id = ?').get(event.id);
  if (existingShow) return existingShow;

  const date = new Date(Date.now() + dateOffsetDays * 86400000).toISOString().slice(0, 10);
  const showInfo = db
    .prepare('INSERT INTO shows (event_id, venue_id, show_date, show_time, pricing_json, hold_ttl_seconds) VALUES (?,?,?,?,?,?)')
    .run(event.id, venue.id, date, time, JSON.stringify(pricing), 600);
  const show = db.prepare('SELECT * FROM shows WHERE id = ?').get(showInfo.lastInsertRowid);

  const layout = JSON.parse(venue.layout_json);
  const insertSeat = db.prepare(
    'INSERT INTO seats (show_id, row_label, seat_number, category, status) VALUES (?,?,?,?,?)'
  );
  const tx = db.transaction(() => {
    layout.forEach((row) => {
      for (let n = 1; n <= row.seatsPerRow; n++) {
        insertSeat.run(show.id, row.rowLabel, n, row.category, 'available');
      }
    });
  });
  tx();
  console.log('Seeded show for', title, 'on', date);
  return show;
}

seedEventWithShow(
  'Nebula Drift',
  'movie',
  'A visually stunning sci-fi epic about a crew lost between galaxies.',
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600',
  2,
  '19:30',
  { Premium: 450, Standard: 300, Economy: 180 }
);

seedEventWithShow(
  'Aurora Nights Live',
  'concert',
  'An electrifying indie-pop concert under the northern lights theme.',
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600',
  5,
  '20:00',
  { Premium: 1200, Standard: 800, Economy: 500 }
);

console.log('\nSeed complete. Demo accounts:');
console.log('  admin@bookyourshow.dev / admin123');
console.log('  organiser@bookyourshow.dev / organiser123');
console.log('  customer@bookyourshow.dev / customer123');
