import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import client from '../api/client';

export default function OrganiserDashboard() {
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const [eventForm, setEventForm] = useState({ title: '', type: 'movie', description: '', posterUrl: '' });
  const [showForm, setShowForm] = useState({ eventId: '', venueId: '', showDate: '', showTime: '', holdTtlSeconds: 600 });
  const [pricing, setPricing] = useState({});
  const [summaries, setSummaries] = useState({});

  function loadEvents() {
    client.get('/events').then((res) => setEvents(res.data));
  }
  useEffect(() => {
    loadEvents();
    client.get('/venues').then((res) => setVenues(res.data));
  }, []);

  const selectedVenue = venues.find((v) => String(v.id) === String(showForm.venueId));
  const categoriesForVenue = selectedVenue ? [...new Set(selectedVenue.layout.map((r) => r.category))] : [];

  async function createEvent(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await client.post('/events', eventForm);
      setEventForm({ title: '', type: 'movie', description: '', posterUrl: '' });
      setNotice('Event created. Now schedule a showtime for it below.');
      loadEvents();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create event.');
    } finally {
      setBusy(false);
    }
  }

  async function createShow(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const missing = categoriesForVenue.filter((c) => !pricing[c]);
      if (missing.length) throw { response: { data: { error: `Set a price for: ${missing.join(', ')}` } } };
      await client.post(`/events/${showForm.eventId}/shows`, {
        venueId: Number(showForm.venueId),
        showDate: showForm.showDate,
        showTime: showForm.showTime,
        holdTtlSeconds: Number(showForm.holdTtlSeconds),
        pricing: Object.fromEntries(Object.entries(pricing).map(([k, v]) => [k, Number(v)])),
      });
      setNotice('Showtime scheduled with seat map generated.');
      setShowForm({ eventId: '', venueId: '', showDate: '', showTime: '', holdTtlSeconds: 600 });
      setPricing({});
      loadEvents();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create showtime.');
    } finally {
      setBusy(false);
    }
  }

  async function loadSummary(eventId) {
    const { data } = await client.get(`/events/${eventId}/summary`);
    setSummaries((s) => ({ ...s, [eventId]: data }));
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-12">
      <h1 className="font-display text-5xl tracking-wide mb-1">ORGANISER DESK</h1>
      <p className="text-paperDim mb-8">Create listings, schedule showtimes, track revenue.</p>

      {error && <p className="text-booked text-sm mb-4">{error}</p>}
      {notice && <p className="text-available text-sm mb-4">{notice}</p>}

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        {/* Create event */}
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={createEvent}
          className="ticket-card bg-stage2 border border-white/10 p-6"
        >
          <h2 className="font-display text-2xl tracking-wide mb-4">New listing</h2>
          <Field label="Title">
            <input
              required
              value={eventForm.title}
              onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Type">
            <div className="flex gap-2">
              {['movie', 'concert'].map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setEventForm({ ...eventForm, type: t })}
                  className={`flex-1 py-2 rounded-lg border text-sm capitalize ${
                    eventForm.type === t ? 'bg-marquee text-stage border-marquee font-semibold' : 'border-white/15'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Description">
            <textarea
              value={eventForm.description}
              onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
              className="input h-20 resize-none"
            />
          </Field>
          <Field label="Poster URL (optional)">
            <input
              value={eventForm.posterUrl}
              onChange={(e) => setEventForm({ ...eventForm, posterUrl: e.target.value })}
              className="input"
              placeholder="https://…"
            />
          </Field>
          <button disabled={busy} className="w-full py-2.5 rounded-full bg-marquee text-stage font-semibold mt-2">
            Create listing
          </button>
        </motion.form>

        {/* Schedule show */}
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          onSubmit={createShow}
          className="ticket-card bg-stage2 border border-white/10 p-6"
        >
          <h2 className="font-display text-2xl tracking-wide mb-4">Schedule a showtime</h2>
          <Field label="Event">
            <select
              required
              value={showForm.eventId}
              onChange={(e) => setShowForm({ ...showForm, eventId: e.target.value })}
              className="input"
            >
              <option value="">Select…</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Venue">
            <select
              required
              value={showForm.venueId}
              onChange={(e) => {
                setShowForm({ ...showForm, venueId: e.target.value });
                setPricing({});
              }}
              className="input"
            >
              <option value="">Select…</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                required
                value={showForm.showDate}
                onChange={(e) => setShowForm({ ...showForm, showDate: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                required
                value={showForm.showTime}
                onChange={(e) => setShowForm({ ...showForm, showTime: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <Field label="Seat hold TTL (seconds)">
            <input
              type="number"
              min="60"
              value={showForm.holdTtlSeconds}
              onChange={(e) => setShowForm({ ...showForm, holdTtlSeconds: e.target.value })}
              className="input"
            />
          </Field>
          {categoriesForVenue.length > 0 && (
            <Field label="Pricing per category">
              <div className="space-y-2">
                {categoriesForVenue.map((cat) => (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="w-24 text-sm text-paperDim">{cat}</span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={pricing[cat] || ''}
                      onChange={(e) => setPricing({ ...pricing, [cat]: e.target.value })}
                      className="input"
                      placeholder="₹"
                    />
                  </div>
                ))}
              </div>
            </Field>
          )}
          <button disabled={busy} className="w-full py-2.5 rounded-full bg-violet text-white font-semibold mt-2">
            Schedule showtime
          </button>
        </motion.form>
      </div>

      {/* Revenue summaries */}
      <h2 className="font-display text-3xl tracking-wide mb-4">YOUR LISTINGS</h2>
      <div className="space-y-4">
        {events.map((ev) => (
          <div key={ev.id} className="bg-stage2 border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-2xl tracking-wide">{ev.title}</p>
                <p className="text-xs text-paperDim uppercase tracking-wide">{ev.type}</p>
              </div>
              <button
                onClick={() => loadSummary(ev.id)}
                className="text-xs px-3 py-1.5 rounded-full border border-white/20 hover:border-marquee hover:text-marquee"
              >
                {summaries[ev.id] ? 'Refresh summary' : 'Load revenue summary'}
              </button>
            </div>
            {summaries[ev.id] && (
              <div className="mt-4 space-y-2 text-sm">
                {summaries[ev.id].summary.map((s) => (
                  <div key={s.showId} className="flex justify-between border-t border-white/5 pt-2">
                    <span className="text-paperDim">
                      {s.showDate} {s.showTime} — {s.seatsSold} seats · {s.bookingsCount} bookings
                    </span>
                    <span className="text-marquee font-mono">₹{s.revenue}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-white/10 font-semibold">
                  <span>Total revenue</span>
                  <span className="text-marquee font-mono">₹{summaries[ev.id].totalRevenue}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`.input { width: 100%; background: #0B0B12; border: 1px solid rgba(255,255,255,0.15); border-radius: 0.5rem; padding: 0.5rem 0.75rem; margin-bottom: 0.75rem; }`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-1">
      <label className="block text-xs uppercase tracking-wider text-paperDim mb-1">{label}</label>
      {children}
    </div>
  );
}
