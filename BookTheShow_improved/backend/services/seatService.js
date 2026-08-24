const { v4: uuid } = require('uuid');
const db = require('../db');
const realtime = require('./realtime');
const { generateBookingQr } = require('./qrcode');
const { sendMail, bookingConfirmedEmail, waitlistOfferEmail, bookingCancelledEmail } = require('./email');

const WAITLIST_OFFER_TTL_SECONDS = Number(process.env.WAITLIST_OFFER_TTL_SECONDS || 300);

function nowIso() {
  return new Date().toISOString();
}
function addSeconds(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function getSeatsForShow(showId) {
  return db.prepare('SELECT * FROM seats WHERE show_id = ? ORDER BY row_label, seat_number').all(showId);
}

function broadcastSeats(showId) {
  realtime.emitSeatUpdate(showId, getSeatsForShow(showId));
}

function broadcastWaitlist(showId) {
  const rows = db
    .prepare(
      `SELECT category, COUNT(*) as waiting FROM waitlist WHERE show_id = ? AND status = 'waiting' GROUP BY category`
    )
    .all(showId);
  realtime.emitWaitlistUpdate(showId, rows);
}

// ---------------------------------------------------------------------------
// HOLD: place a temporary hold on seats for `holdTtlSeconds`.
// Runs as a single synchronous better-sqlite3 transaction: because Node.js
// executes JS on one thread and better-sqlite3 calls are synchronous, no
// other request can interleave between the "is it free?" check and the
// "mark it held" write, so two simultaneous requests can never both win the
// same seat.
// ---------------------------------------------------------------------------
function holdSeats({ showId, seatIds, userId }) {
  const show = db.prepare('SELECT * FROM shows WHERE id = ?').get(showId);
  if (!show) throw httpError(404, 'Show not found');

  const expiresAt = addSeconds(show.hold_ttl_seconds);

  const tx = db.transaction(() => {
    // Release any holds that have expired, first, so a stale hold does not
    // block a legitimate new attempt.
    releaseExpiredHoldsInternal(showId);

    const placeholders = seatIds.map(() => '?').join(',');
    const seats = db
      .prepare(`SELECT * FROM seats WHERE show_id = ? AND id IN (${placeholders})`)
      .all(showId, ...seatIds);

    if (seats.length !== seatIds.length) throw httpError(400, 'One or more seats do not exist');

    const unavailable = seats.filter((s) => s.status !== 'available');
    if (unavailable.length) {
      throw httpError(
        409,
        `Seat(s) ${unavailable.map((s) => s.row_label + s.seat_number).join(', ')} are no longer available`
      );
    }

    const update = db.prepare(
      `UPDATE seats SET status = 'held', held_by = ?, hold_expires_at = ? WHERE id = ?`
    );
    seats.forEach((s) => update.run(userId, expiresAt, s.id));

    return seats;
  });

  const heldSeats = tx();
  broadcastSeats(showId);
  return { seats: heldSeats, expiresAt };
}

function releaseExpiredHoldsInternal(showId) {
  const now = nowIso();
  const info = db
    .prepare(
      `UPDATE seats SET status = 'available', held_by = NULL, hold_expires_at = NULL
       WHERE show_id = ? AND status = 'held' AND hold_expires_at IS NOT NULL AND hold_expires_at <= ?`
    )
    .run(showId, now);
  return info.changes;
}

// Called by the scheduler across ALL shows periodically, and inline before
// any hold/booking attempt for the relevant show.
function releaseAllExpiredHolds() {
  const now = nowIso();
  const affectedShows = db
    .prepare(
      `SELECT DISTINCT show_id FROM seats WHERE status = 'held' AND hold_expires_at IS NOT NULL AND hold_expires_at <= ?`
    )
    .all(now);

  affectedShows.forEach(({ show_id }) => {
    const tx = db.transaction(() => releaseExpiredHoldsInternal(show_id));
    const changed = tx();
    if (changed > 0) broadcastSeats(show_id);
  });
}

function releaseHold({ showId, seatIds, userId }) {
  const tx = db.transaction(() => {
    const placeholders = seatIds.map(() => '?').join(',');
    const info = db
      .prepare(
        `UPDATE seats SET status = 'available', held_by = NULL, hold_expires_at = NULL
         WHERE show_id = ? AND id IN (${placeholders}) AND held_by = ? AND status = 'held'`
      )
      .run(showId, ...seatIds, userId);
    return info.changes;
  });
  const changed = tx();
  if (changed > 0) broadcastSeats(showId);
  return { released: changed };
}

// ---------------------------------------------------------------------------
// BOOK: confirm a booking for seats currently held by this user (checkout).
// ---------------------------------------------------------------------------
async function confirmBooking({ showId, seatIds, userId }) {
  const show = db.prepare('SELECT * FROM shows WHERE id = ?').get(showId);
  if (!show) throw httpError(404, 'Show not found');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const pricing = JSON.parse(show.pricing_json);

  const bookingRef = 'BTS-' + uuid().split('-')[0].toUpperCase();

  const { seats, totalAmount, bookingId } = db.transaction(() => {
    releaseExpiredHoldsInternal(showId);

    const placeholders = seatIds.map(() => '?').join(',');
    const seats = db
      .prepare(`SELECT * FROM seats WHERE show_id = ? AND id IN (${placeholders})`)
      .all(showId, ...seatIds);

    if (seats.length !== seatIds.length) throw httpError(400, 'One or more seats do not exist');
    const notHeldByUser = seats.filter((s) => !(s.status === 'held' && s.held_by === userId));
    if (notHeldByUser.length) {
      throw httpError(
        409,
        `Seat(s) ${notHeldByUser.map((s) => s.row_label + s.seat_number).join(', ')} are not held by you (hold may have expired)`
      );
    }

    const totalAmount = seats.reduce((sum, s) => sum + (pricing[s.category] || 0), 0);

    const bookingInfo = db
      .prepare(
        `INSERT INTO bookings (booking_ref, show_id, customer_id, status, total_amount) VALUES (?,?,?,?,?)`
      )
      .run(bookingRef, showId, userId, 'confirmed', totalAmount);
    const bookingId = bookingInfo.lastInsertRowid;

    const markBooked = db.prepare(
      `UPDATE seats SET status = 'booked', held_by = NULL, hold_expires_at = NULL, booking_id = ? WHERE id = ?`
    );
    const linkSeat = db.prepare(`INSERT INTO booking_seats (booking_id, seat_id) VALUES (?, ?)`);
    seats.forEach((s) => {
      markBooked.run(bookingId, s.id);
      linkSeat.run(bookingId, s.id);
    });

    return { seats, totalAmount, bookingId };
  })();

  broadcastSeats(showId);

  // QR + email happen outside the sync transaction (I/O bound).
  const { dataUrl, buffer } = await generateBookingQr(bookingRef);
  db.prepare('UPDATE bookings SET qr_data_url = ? WHERE id = ?').run(dataUrl, bookingId);

  const event = db
    .prepare('SELECT e.* FROM events e JOIN shows s ON s.event_id = e.id WHERE s.id = ?')
    .get(showId);

  const emailResult = await sendMail({
    to: user.email,
    subject: `Your BookTheShow ticket for ${event.title} — ${bookingRef}`,
    html: bookingConfirmedEmail({
      name: user.name,
      eventTitle: event.title,
      showDate: show.show_date,
      showTime: show.show_time,
      seats,
      bookingRef,
      totalAmount,
    }),
    attachments: [{ filename: `${bookingRef}.png`, content: buffer, cid: 'qrticket' }],
  });

  return {
    booking: db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId),
    seats,
    emailPreviewUrl: emailResult.previewUrl || null,
  };
}

// ---------------------------------------------------------------------------
// CANCEL: cancel a confirmed booking. Frees seats and, if there is a
// waitlist for that seat's category, offers the first seat to the next
// person in line with a time-limited link.
// ---------------------------------------------------------------------------
async function cancelBooking({ bookingId, userId, isOrganiserOrAdmin }) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) throw httpError(404, 'Booking not found');
  if (booking.customer_id !== userId && !isOrganiserOrAdmin) throw httpError(403, 'Not your booking');
  if (booking.status === 'cancelled') throw httpError(400, 'Booking already cancelled');

  const seats = db
    .prepare(
      `SELECT s.* FROM seats s JOIN booking_seats bs ON bs.seat_id = s.id WHERE bs.booking_id = ?`
    )
    .all(bookingId);

  db.transaction(() => {
    db.prepare(`UPDATE bookings SET status = 'cancelled', cancelled_at = ? WHERE id = ?`).run(
      nowIso(),
      bookingId
    );
    const freeSeat = db.prepare(
      `UPDATE seats SET status = 'available', booking_id = NULL, held_by = NULL, hold_expires_at = NULL WHERE id = ?`
    );
    seats.forEach((s) => freeSeat.run(s.id));
  })();

  broadcastSeats(booking.show_id);

  // Send cancellation confirmation email to the customer.
  const cancelledUser = db.prepare('SELECT * FROM users WHERE id = ?').get(booking.customer_id);
  const cancelledEvent = db
    .prepare('SELECT e.* FROM events e JOIN shows s ON s.event_id = e.id WHERE s.id = ?')
    .get(booking.show_id);
  const cancelledShow = db.prepare('SELECT * FROM shows WHERE id = ?').get(booking.show_id);
  if (cancelledUser && cancelledEvent) {
    sendMail({
      to: cancelledUser.email,
      subject: `Booking Cancelled — ${booking.booking_ref} | ${cancelledEvent.title}`,
      html: bookingCancelledEmail({
        name: cancelledUser.name,
        eventTitle: cancelledEvent.title,
        showDate: cancelledShow ? cancelledShow.show_date : '',
        bookingRef: booking.booking_ref,
        refundNote: 'If you paid online, your refund will be processed within 5–7 business days.',
      }),
    }).catch((err) => console.error('[email] cancellation email failed:', err.message));
  }

  // Try to offer each freed seat to the next waitlisted customer in its category.
  for (const seat of seats) {
    await offerSeatToNextInWaitlist(booking.show_id, seat.id, seat.category);
  }

  return { cancelled: true, freedSeats: seats.length };
}

async function offerSeatToNextInWaitlist(showId, seatId, category) {
  const seat = db.prepare('SELECT * FROM seats WHERE id = ?').get(seatId);
  if (!seat || seat.status !== 'available') return null; // already claimed

  const next = db
    .prepare(
      `SELECT * FROM waitlist WHERE show_id = ? AND category = ? AND status = 'waiting'
       ORDER BY created_at ASC LIMIT 1`
    )
    .get(showId, category);
  if (!next) return null;

  const expiresAt = addSeconds(WAITLIST_OFFER_TTL_SECONDS);

  const claimed = db.transaction(() => {
    const seatNow = db.prepare('SELECT * FROM seats WHERE id = ?').get(seatId);
    if (seatNow.status !== 'available') return false;
    db.prepare(
      `UPDATE seats SET status = 'held', held_by = ?, hold_expires_at = ? WHERE id = ?`
    ).run(next.customer_id, expiresAt, seatId);
    db.prepare(
      `UPDATE waitlist SET status = 'offered', seat_id = ?, offer_expires_at = ? WHERE id = ?`
    ).run(seatId, expiresAt, next.id);
    return true;
  })();

  if (!claimed) return null;
  broadcastSeats(showId);
  broadcastWaitlist(showId);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(next.customer_id);
  const event = db
    .prepare('SELECT e.* FROM events e JOIN shows s ON s.event_id = e.id WHERE s.id = ?')
    .get(showId);
  const offerUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/shows/${showId}?claimWaitlist=${next.id}`;

  await sendMail({
    to: user.email,
    subject: `A ${category} seat is available for ${event.title}!`,
    html: waitlistOfferEmail({
      name: user.name,
      eventTitle: event.title,
      category,
      offerUrl,
      minutesLeft: Math.round(WAITLIST_OFFER_TTL_SECONDS / 60),
    }),
  });

  return next;
}

// Scheduler: run periodically. Expires stale waitlist offers, frees the
// seat, and cascades the offer to the next person in line.
async function expireWaitlistOffers() {
  const now = nowIso();
  const expired = db
    .prepare(
      `SELECT * FROM waitlist WHERE status = 'offered' AND offer_expires_at IS NOT NULL AND offer_expires_at <= ?`
    )
    .all(now);

  for (const w of expired) {
    const seatStillHeldByOfferee = db
      .prepare('SELECT * FROM seats WHERE id = ? AND held_by = ?')
      .get(w.seat_id, w.customer_id);

    db.transaction(() => {
      db.prepare(`UPDATE waitlist SET status = 'expired' WHERE id = ?`).run(w.id);
      if (seatStillHeldByOfferee && seatStillHeldByOfferee.status === 'held') {
        db.prepare(
          `UPDATE seats SET status = 'available', held_by = NULL, hold_expires_at = NULL WHERE id = ?`
        ).run(w.seat_id);
      }
    })();

    broadcastSeats(w.show_id);
    broadcastWaitlist(w.show_id);

    if (seatStillHeldByOfferee) {
      await offerSeatToNextInWaitlist(w.show_id, w.seat_id, w.category);
    }
  }
}

function joinWaitlist({ showId, category, userId }) {
  const existing = db
    .prepare(
      `SELECT * FROM waitlist WHERE show_id = ? AND category = ? AND customer_id = ? AND status IN ('waiting','offered')`
    )
    .get(showId, category, userId);
  if (existing) throw httpError(400, 'Already on the waitlist for this category');

  const info = db
    .prepare(`INSERT INTO waitlist (show_id, category, customer_id, status) VALUES (?,?,?,'waiting')`)
    .run(showId, category, userId);
  broadcastWaitlist(showId);
  return db.prepare('SELECT * FROM waitlist WHERE id = ?').get(info.lastInsertRowid);
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = {
  getSeatsForShow,
  holdSeats,
  releaseHold,
  releaseAllExpiredHolds,
  confirmBooking,
  cancelBooking,
  joinWaitlist,
  expireWaitlistOffers,
  offerSeatToNextInWaitlist,
  broadcastSeats,
  broadcastWaitlist,
};
