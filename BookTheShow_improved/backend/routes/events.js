const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const seatService = require('../services/seatService');

const router = express.Router();

function asyncRoute(fn) { return (req, res, next) => fn(req, res, next).catch(next); }

// ── List events (public) ────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { type, search } = req.query;
  let query = 'SELECT * FROM events WHERE 1=1';
  const params = [];
  
  if (type) { query += ' AND type = ?'; params.push(type); }
  if (search) { query += ' AND title LIKE ?'; params.push(`%${search}%`); }
  query += ' ORDER BY created_at DESC';
  
  const events = db.prepare(query).all(...params);

  // The Fix: Fetch and attach the scheduled shows to each event
  const enrichedEvents = events.map(e => {
    const shows = db.prepare('SELECT * FROM shows WHERE event_id = ? ORDER BY show_date, show_time').all(e.id);
    return { ...e, shows };
  });

  res.json(enrichedEvents);
});

// ── Get single event with all shows ────────────────────────────────────────
router.get('/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const shows = db.prepare('SELECT s.*, v.name as venue_name, v.address as venue_address FROM shows s JOIN venues v ON v.id = s.venue_id WHERE s.event_id = ? ORDER BY show_date, show_time').all(event.id);
  res.json({ ...event, shows: shows.map(s => ({ ...s, pricing: JSON.parse(s.pricing_json) })) });
});

// ── Create event (organiser / admin) ───────────────────────────────────────
router.post('/', authRequired, requireRole('organiser', 'admin'), (req, res) => {
  const { title, type, description, poster_url } = req.body;
  if (!title || !type) return res.status(400).json({ error: 'title and type required' });
  if (!['movie', 'concert'].includes(type)) return res.status(400).json({ error: 'type must be movie or concert' });
  const info = db.prepare('INSERT INTO events (organiser_id,title,type,description,poster_url) VALUES (?,?,?,?,?)').run(req.user.id, title, type, description || '', poster_url || '');
  res.status(201).json(db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid));
});

// ── Create show for an event ────────────────────────────────────────────────
router.post('/:id/shows', authRequired, requireRole('organiser', 'admin'), asyncRoute(async (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (event.organiser_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not your event' });
  const { venue_id, show_date, show_time, pricing, hold_ttl_seconds } = req.body;
  if (!venue_id || !show_date || !show_time || !pricing) return res.status(400).json({ error: 'venue_id, show_date, show_time and pricing required' });

  const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(venue_id);
  if (!venue) return res.status(404).json({ error: 'Venue not found' });

  const showInfo = db.prepare('INSERT INTO shows (event_id,venue_id,show_date,show_time,pricing_json,hold_ttl_seconds) VALUES (?,?,?,?,?,?)').run(event.id, venue_id, show_date, show_time, JSON.stringify(pricing), hold_ttl_seconds || 600);
  const show = db.prepare('SELECT * FROM shows WHERE id = ?').get(showInfo.lastInsertRowid);

  // Seed seats from venue layout
  const layout = JSON.parse(venue.layout_json);
  const insertSeat = db.prepare('INSERT INTO seats (show_id,row_label,seat_number,category,status) VALUES (?,?,?,?,?)');
  db.transaction(() => {
    layout.forEach(row => {
      for (let n = 1; n <= row.seatsPerRow; n++) insertSeat.run(show.id, row.rowLabel, n, row.category, 'available');
    });
  })();

  res.status(201).json({ ...show, pricing });
}));

// ── Get seat map for a show ─────────────────────────────────────────────────
router.get('/shows/:showId/seats', (req, res) => {
  const show = db.prepare('SELECT s.*, v.name as venue_name FROM shows s JOIN venues v ON v.id = s.venue_id WHERE s.id = ?').get(req.params.showId);
  if (!show) return res.status(404).json({ error: 'Show not found' });
  const seats = seatService.getSeatsForShow(req.params.showId);
  const waitlistCounts = db.prepare(`SELECT category, COUNT(*) as waiting FROM waitlist WHERE show_id = ? AND status = 'waiting' GROUP BY category`).all(req.params.showId);
  res.json({ show: { ...show, pricing: JSON.parse(show.pricing_json) }, seats, waitlist: waitlistCounts });
});

// ── Organiser: list own events with revenue summary ─────────────────────────
router.get('/organiser/mine', authRequired, requireRole('organiser', 'admin'), (req, res) => {
  const events = db.prepare('SELECT * FROM events WHERE organiser_id = ? ORDER BY created_at DESC').all(req.user.id);
  const enriched = events.map(e => {
    const shows = db.prepare('SELECT s.*, (SELECT COALESCE(SUM(b.total_amount),0) FROM bookings b WHERE b.show_id=s.id AND b.status="confirmed") as revenue, (SELECT COUNT(*) FROM bookings b WHERE b.show_id=s.id AND b.status="confirmed") as bookings_count FROM shows s WHERE s.event_id = ?').all(e.id);
    return { ...e, shows };
  });
  res.json(enriched);
});

module.exports = router;
