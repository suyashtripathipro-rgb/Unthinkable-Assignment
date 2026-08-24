const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const seatService = require('../services/seatService');

const router = express.Router();

function asyncRoute(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

// ---- Seat hold -------------------------------------------------------------
router.post('/hold', authRequired, (req, res, next) => {
  try {
    const { showId, seatIds } = req.body;
    if (!showId || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'showId and non-empty seatIds[] required' });
    }
    const result = seatService.holdSeats({ showId, seatIds, userId: req.user.id });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/release', authRequired, (req, res, next) => {
  try {
    const { showId, seatIds } = req.body;
    const result = seatService.releaseHold({ showId, seatIds, userId: req.user.id });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---- Checkout / confirm -----------------------------------------------------
router.post(
  '/checkout',
  authRequired,
  asyncRoute(async (req, res) => {
    const { showId, seatIds } = req.body;
    if (!showId || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'showId and non-empty seatIds[] required' });
    }
    const result = await seatService.confirmBooking({ showId, seatIds, userId: req.user.id });
    res.status(201).json(result);
  })
);

// ---- History -----------------------------------------------------------------
router.get('/mine', authRequired, (req, res) => {
  const bookings = db
    .prepare(
      `SELECT b.*, e.title as event_title, e.type as event_type, s.show_date, s.show_time
       FROM bookings b
       JOIN shows s ON s.id = b.show_id
       JOIN events e ON e.id = s.event_id
       WHERE b.customer_id = ?
       ORDER BY b.created_at DESC`
    )
    .all(req.user.id);

  const seatStmt = db.prepare(
    `SELECT s.* FROM seats s JOIN booking_seats bs ON bs.seat_id = s.id WHERE bs.booking_id = ?`
  );
  const withSeats = bookings.map((b) => ({ ...b, seats: seatStmt.all(b.id) }));
  res.json(withSeats);
});

// ---- Cancel --------------------------------------------------------------------
router.post(
  '/:id/cancel',
  authRequired,
  asyncRoute(async (req, res) => {
    const isOrganiserOrAdmin = ['organiser', 'admin'].includes(req.user.role);
    const result = await seatService.cancelBooking({
      bookingId: req.params.id,
      userId: req.user.id,
      isOrganiserOrAdmin,
    });
    res.json(result);
  })
);

// ---- Waitlist --------------------------------------------------------------------
router.post('/waitlist', authRequired, (req, res, next) => {
  try {
    const { showId, category } = req.body;
    if (!showId || !category) return res.status(400).json({ error: 'showId and category required' });
    const entry = seatService.joinWaitlist({ showId, category, userId: req.user.id });
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

router.get('/waitlist/mine', authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT w.*, e.title as event_title, s.show_date, s.show_time
       FROM waitlist w
       JOIN shows s ON s.id = w.show_id
       JOIN events e ON e.id = s.event_id
       WHERE w.customer_id = ?
       ORDER BY w.created_at DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

// Global error handler for this router (httpError objects have .status)
router.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

module.exports = router;
