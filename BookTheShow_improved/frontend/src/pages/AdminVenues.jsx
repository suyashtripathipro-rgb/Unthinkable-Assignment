import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import client from '../api/client';

const emptyRow = () => ({ rowLabel: '', seatsPerRow: 10, category: 'Standard' });

export default function AdminVenues() {
  const [venues, setVenues] = useState([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [layout, setLayout] = useState([emptyRow()]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    client.get('/venues').then((res) => setVenues(res.data));
  }
  useEffect(load, []);

  function updateRow(i, field, value) {
    setLayout((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await client.post('/venues', {
        name,
        address,
        layout: layout.map((r) => ({ ...r, seatsPerRow: Number(r.seatsPerRow) })),
      });
      setNotice('Venue created with its seat layout.');
      setName('');
      setAddress('');
      setLayout([emptyRow()]);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create venue.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-12">
      <h1 className="font-display text-5xl tracking-wide mb-1">VENUES</h1>
      <p className="text-paperDim mb-8">Define a venue's seat layout once — every showtime there reuses it.</p>

      {error && <p className="text-booked text-sm mb-4">{error}</p>}
      {notice && <p className="text-available text-sm mb-4">{notice}</p>}

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={submit}
        className="ticket-card bg-stage2 border border-white/10 p-6 mb-10"
      >
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-paperDim mb-1">Venue name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-paperDim mb-1">Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
          </div>
        </div>

        <p className="text-xs uppercase tracking-wider text-paperDim mb-2">Seat rows</p>
        <div className="space-y-2">
          {layout.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                required
                placeholder="Row (e.g. A)"
                value={row.rowLabel}
                onChange={(e) => updateRow(i, 'rowLabel', e.target.value.toUpperCase())}
                className="input w-24"
              />
              <input
                required
                type="number"
                min="1"
                placeholder="Seats"
                value={row.seatsPerRow}
                onChange={(e) => updateRow(i, 'seatsPerRow', e.target.value)}
                className="input w-24"
              />
              <select
                value={row.category}
                onChange={(e) => updateRow(i, 'category', e.target.value)}
                className="input flex-1"
              >
                <option>Premium</option>
                <option>Standard</option>
                <option>Economy</option>
              </select>
              {layout.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLayout((rows) => rows.filter((_, idx) => idx !== i))}
                  className="text-booked text-sm px-2"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setLayout((rows) => [...rows, emptyRow()])}
          className="text-xs text-marquee mt-3 hover:underline"
        >
          + Add row
        </button>

        <button disabled={busy} className="w-full py-2.5 rounded-full bg-marquee text-stage font-semibold mt-6">
          Create venue
        </button>
      </motion.form>

      <h2 className="font-display text-3xl tracking-wide mb-4">EXISTING VENUES</h2>
      <div className="space-y-3">
        {venues.map((v) => (
          <div key={v.id} className="bg-stage2 border border-white/10 rounded-xl p-4">
            <p className="font-semibold">{v.name}</p>
            <p className="text-xs text-paperDim mb-2">{v.address}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {v.layout.map((r, i) => (
                <span key={i} className="px-2 py-1 rounded-full bg-stage border border-white/10">
                  Row {r.rowLabel} · {r.seatsPerRow} seats · {r.category}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style>{`.input { width: 100%; background: #0B0B12; border: 1px solid rgba(255,255,255,0.15); border-radius: 0.5rem; padding: 0.5rem 0.75rem; }`}</style>
    </div>
  );
}
