import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import client from '../api/client';

export default function BookingHistory() {
  const [bookings, setBookings] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([client.get('/bookings/mine'), client.get('/bookings/waitlist/mine')])
      .then(([b, w]) => {
        setBookings(b.data);
        setWaitlist(w.data);
      })
      .catch(() => setError('Could not load your bookings.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function cancel(id) {
    setBusyId(id);
    setError('');
    try {
      await client.post(`/bookings/${id}/cancel`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not cancel booking.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-12">
      <h1 className="font-display text-5xl tracking-wide mb-1">MY TICKETS</h1>
      <p className="text-paperDim mb-8">Your bookings and waitlist spots, in one place.</p>

      {error && <p className="text-booked text-sm mb-4">{error}</p>}
      {loading && <p className="text-paperDim">Loading…</p>}

      <div className="space-y-4">
        <AnimatePresence>
          {bookings.map((b) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="ticket-card bg-stage2 border border-white/10 p-5 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                {b.qr_data_url && (
                  <img src={b.qr_data_url} alt="QR" className="w-16 h-16 opacity-90" />
                )}
                <div>
                  <p className="font-display text-2xl tracking-wide">{b.event_title}</p>
                  <p className="text-sm text-paperDim">
                    {b.show_date} · {b.show_time} · Seats:{' '}
                    {b.seats.map((s) => `${s.row_label}${s.seat_number}`).join(', ')}
                  </p>
                  <p className="text-xs font-mono text-paperDim mt-0.5">{b.booking_ref}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    b.status === 'confirmed'
                      ? 'border-available/50 text-available'
                      : 'border-booked/50 text-booked'
                  }`}
                >
                  {b.status}
                </span>
                <span className="text-marquee font-mono text-sm">₹{b.total_amount}</span>
                {b.status === 'confirmed' && (
                  <button
                    disabled={busyId === b.id}
                    onClick={() => cancel(b.id)}
                    className="text-xs px-3 py-1.5 rounded-full border border-white/20 hover:border-booked hover:text-booked transition-colors disabled:opacity-50"
                  >
                    {busyId === b.id ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {!loading && bookings.length === 0 && (
        <p className="text-paperDim text-sm py-10 text-center">No bookings yet — go grab some seats.</p>
      )}

      {waitlist.length > 0 && (
        <div className="mt-12">
          <h2 className="font-display text-3xl tracking-wide mb-4">WAITLIST</h2>
          <div className="space-y-3">
            {waitlist.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between bg-stage2 border border-white/10 rounded-xl px-4 py-3 text-sm"
              >
                <span>
                  {w.event_title} · {w.category} · {w.show_date} {w.show_time}
                </span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    w.status === 'offered'
                      ? 'border-marquee/60 text-marquee'
                      : w.status === 'waiting'
                      ? 'border-violet/60 text-violet'
                      : 'border-white/20 text-paperDim'
                  }`}
                >
                  {w.status === 'offered' ? 'Seat offered — check your email!' : w.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
