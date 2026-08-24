import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import io from 'socket.io-client';
import client, { API_BASE } from '../api/client';
import { useAuth } from '../api/AuthContext.jsx';
import SeatMap from '../components/SeatMap.jsx';
import Countdown from '../components/Countdown.jsx';

const SOCKET_URL = API_BASE.replace(/\/api\/?$/, '');

export default function ShowDetail() {
  const { showId } = useParams();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const claimingWaitlistId = searchParams.get('claimWaitlist');

  const [show, setShow] = useState(null);
  const [event, setEvent] = useState(null);
  const [seats, setSeats] = useState([]);
  const [waitlistCounts, setWaitlistCounts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [holdExpiresAt, setHoldExpiresAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState(null);

  const loadSeats = useCallback(() => {
    return client.get(`/events/shows/${showId}/seats`).then((res) => {
      setShow(res.data.show);
      setSeats(res.data.seats);
      setWaitlistCounts(res.data.waitlistCounts || []);
    });
  }, [showId]);

  useEffect(() => {
    loadSeats().catch(() => setError('Could not load this showtime.'));
  }, [loadSeats]);

  useEffect(() => {
    if (!show) return;
    client.get(`/events/${show.event_id}`).then((res) => setEvent(res.data)).catch(() => {});
  }, [show]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socket.emit('show:join', showId);
    socket.on('seat:update', (payload) => {
      if (String(payload.showId) === String(showId)) setSeats(payload.seats);
    });
    socket.on('waitlist:update', (payload) => {
      if (String(payload.showId) === String(showId)) setWaitlistCounts(payload.waitlistSummary);
    });
    return () => socket.disconnect();
  }, [showId]);

  const pricing = show?.pricing || {};

  const categoriesFull = useMemo(() => {
    const byCat = {};
    seats.forEach((s) => {
      byCat[s.category] = byCat[s.category] || { total: 0, available: 0 };
      byCat[s.category].total += 1;
      if (s.status === 'available') byCat[s.category].available += 1;
    });
    return byCat;
  }, [seats]);

  function toggleSeat(seat) {
    setError('');
    setSelected((prev) =>
      prev.includes(seat.id) ? prev.filter((id) => id !== seat.id) : [...prev, seat.id]
    );
  }

  async function handleHold() {
    if (!user) return setError('Please log in to select seats.');
    if (selected.length === 0) return setError('Select at least one seat first.');
    setBusy(true);
    setError('');
    try {
      const { data } = await client.post('/bookings/hold', { showId: Number(showId), seatIds: selected });
      setHoldExpiresAt(data.expiresAt);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not hold those seats.');
      await loadSeats();
    } finally {
      setBusy(false);
    }
  }

  async function handleRelease() {
    setBusy(true);
    try {
      await client.post('/bookings/release', { showId: Number(showId), seatIds: selected });
    } catch (_) {}
    setHoldExpiresAt(null);
    setSelected([]);
    setBusy(false);
  }

  async function handleCheckout() {
    setBusy(true);
    setError('');
    try {
      const { data } = await client.post('/bookings/checkout', { showId: Number(showId), seatIds: selected });
      setTicket(data);
      setSelected([]);
      setHoldExpiresAt(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Checkout failed.');
      await loadSeats();
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinWaitlist(category) {
    if (!user) return setError('Please log in to join the waitlist.');
    setBusy(true);
    setError('');
    try {
      await client.post('/bookings/waitlist', { showId: Number(showId), category });
      await loadSeats();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not join waitlist.');
    } finally {
      setBusy(false);
    }
  }

  const total = selected.reduce((sum, id) => {
    const seat = seats.find((s) => s.id === id);
    return sum + (seat ? pricing[seat.category] || 0 : 0);
  }, 0);

  if (!show) {
    return <div className="max-w-4xl mx-auto px-5 py-16 text-paperDim">{error || 'Loading showtime…'}</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-10">
      <Link to="/" className="text-sm text-paperDim hover:text-marquee">
        ← Back to browse
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl tracking-wide">{event?.title || 'Show'}</h1>
          <p className="text-paperDim mt-1">
            {show.show_date} · {show.show_time}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(pricing).map(([cat, price]) => (
            <span key={cat} className="text-xs bg-stage2 border border-white/10 rounded-full px-3 py-1">
              {cat} · <span className="text-marquee font-mono">₹{price}</span>
              {categoriesFull[cat] && categoriesFull[cat].available === 0 && (
                <span className="text-booked ml-2">Sold out</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Sold-out categories -> waitlist prompts */}
      <div className="flex flex-wrap gap-2 mt-4">
        {Object.entries(categoriesFull)
          .filter(([, v]) => v.available === 0)
          .map(([cat]) => {
            const waiting = waitlistCounts.find((w) => w.category === cat)?.waiting || 0;
            return (
              <button
                key={cat}
                onClick={() => handleJoinWaitlist(cat)}
                disabled={busy}
                className="text-xs px-3 py-1.5 rounded-full border border-violet/60 text-violet hover:bg-violet/15 transition-colors disabled:opacity-50"
              >
                Join waitlist for {cat} {waiting > 0 && `(${waiting} waiting)`}
              </button>
            );
          })}
      </div>

      <div className="ticket-card bg-stage2 border border-white/10 mt-6 p-6">
        <SeatMap seats={seats} selected={selected} onToggle={toggleSeat} userId={user?.id} />
      </div>

      {error && <p className="text-booked text-sm mt-4">{error}</p>}

      {/* Sticky checkout bar */}
      <AnimatePresence>
        {(selected.length > 0 || holdExpiresAt) && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="sticky bottom-4 mt-6 bg-stage border border-marquee/40 rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3 shadow-glow"
          >
            <div>
              <p className="text-sm text-paperDim">
                {selected.length} seat{selected.length !== 1 && 's'} selected · Total{' '}
                <span className="text-marquee font-mono">₹{total}</span>
              </p>
              {holdExpiresAt && (
                <p className="text-xs text-paperDim mt-0.5">
                  Held — complete checkout within <Countdown expiresAt={holdExpiresAt} onExpire={() => { setHoldExpiresAt(null); setSelected([]); loadSeats(); }} />
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {!holdExpiresAt ? (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  disabled={busy}
                  onClick={handleHold}
                  className="px-5 py-2.5 rounded-full bg-violet text-white font-semibold hover:shadow-violetGlow transition-shadow disabled:opacity-60"
                >
                  Hold seats
                </motion.button>
              ) : (
                <>
                  <button
                    onClick={handleRelease}
                    disabled={busy}
                    className="px-4 py-2.5 rounded-full border border-white/20 hover:border-booked hover:text-booked transition-colors disabled:opacity-60"
                  >
                    Release
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    disabled={busy}
                    onClick={handleCheckout}
                    className="px-5 py-2.5 rounded-full bg-marquee text-stage font-semibold hover:shadow-glow transition-shadow disabled:opacity-60"
                  >
                    Confirm &amp; get ticket
                  </motion.button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ticket reveal */}
      <AnimatePresence>
        {ticket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-5"
            onClick={() => setTicket(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, rotate: -2 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="ticket-card bg-paper text-stage max-w-sm w-full p-6 relative"
            >
              <p className="text-xs uppercase tracking-widest text-marqueeDim">Booking confirmed</p>
              <h2 className="font-display text-3xl mt-1">{event?.title}</h2>
              <p className="text-sm text-stage/70 mt-1">
                {show.show_date} · {show.show_time}
              </p>
              <div className="perforation h-px my-4" />
              <div className="flex items-center gap-4">
                {ticket.booking.qr_data_url && (
                  <img src={ticket.booking.qr_data_url} alt="QR ticket" className="w-28 h-28" />
                )}
                <div className="text-sm">
                  <p className="font-mono font-semibold">{ticket.booking.booking_ref}</p>
                  <p className="text-stage/70 mt-1">
                    Seats: {ticket.seats.map((s) => `${s.row_label}${s.seat_number}`).join(', ')}
                  </p>
                  <p className="text-stage/70">Total: ₹{ticket.booking.total_amount}</p>
                </div>
              </div>
              {ticket.emailPreviewUrl && (
                <a
                  href={ticket.emailPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs text-violetDim underline mt-4"
                >
                  View confirmation email (demo inbox)
                </a>
              )}
              <button
                onClick={() => setTicket(null)}
                className="mt-5 w-full py-2 rounded-full bg-stage text-paper hover:bg-marquee hover:text-stage transition-colors"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
