import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import client from '../api/client';
import { useAuth } from '../api/AuthContext.jsx';

export default function Home() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    client
      .get('/events', { params: { type: type || undefined, q: q || undefined } })
      .then((res) => setEvents(res.data))
      .catch(() => setError('Could not load events.'))
      .finally(() => setLoading(false));
  }, [type, q, user]);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 pt-16 pb-14 text-center">
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="uppercase tracking-[0.3em] text-marquee text-xs mb-4"
          >
            Now selling
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="font-display text-6xl sm:text-7xl leading-none tracking-wide"
          >
            PICK YOUR SEAT.
            <br />
            <span className="text-marquee">OWN THE NIGHT.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-5 text-paperDim max-w-xl mx-auto"
          >
            Live seat maps, instant holds, and a waitlist that actually works — for movies and
            concerts you don't want to miss.
          </motion.p>
          {!user && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-8 flex justify-center gap-3"
            >
              <Link
                to="/register"
                className="px-6 py-3 rounded-full bg-marquee text-stage font-semibold hover:shadow-glow transition-shadow"
              >
                Get started
              </Link>
              <Link
                to="/login"
                className="px-6 py-3 rounded-full border border-white/20 hover:border-marquee hover:text-marquee transition-colors"
              >
                I have an account
              </Link>
            </motion.div>
          )}
        </div>
        <div className="marquee-strip h-1 bulb opacity-30" />
      </section>

      {!user ? (
        <div className="max-w-2xl mx-auto px-5 py-16 text-center text-paperDim">
          Sign in to browse live showtimes, seat maps, and grab tickets.
        </div>
      ) : (
        <section className="max-w-6xl mx-auto px-5 pb-20">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-8">
            <div className="flex gap-2">
              {['', 'movie', 'concert'].map((t) => (
                <button
                  key={t || 'all'}
                  onClick={() => setType(t)}
                  className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                    type === t
                      ? 'bg-marquee text-stage border-marquee font-semibold'
                      : 'border-white/15 hover:border-marquee/70'
                  }`}
                >
                  {t === '' ? 'All' : t === 'movie' ? '🎬 Movies' : '🎵 Concerts'}
                </button>
              ))}
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title…"
              className="bg-stage2 border border-white/15 rounded-full px-4 py-1.5 text-sm focus:outline-none focus:border-marquee w-full sm:w-64"
            />
          </div>

          {error && <p className="text-booked mb-4">{error}</p>}
          {loading && <p className="text-paperDim">Loading showtimes…</p>}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {events.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -6 }}
                  className="ticket-card bg-stage2 border border-white/10 overflow-hidden group"
                >
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={event.poster_url || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600'}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-3 left-3 text-xs uppercase tracking-wider bg-stage/80 px-2 py-1 rounded-full border border-white/10">
                      {event.type === 'movie' ? '🎬 Movie' : '🎵 Concert'}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-2xl tracking-wide">{event.title}</h3>
                    <p className="text-paperDim text-sm mt-1 line-clamp-2">{event.description}</p>

                    {event.shows?.length ? (
                      <div className="mt-4 space-y-2">
                        {event.shows.map((s) => (
                          <Link
                            key={s.id}
                            to={`/shows/${s.id}`}
                            className="flex items-center justify-between text-sm bg-stage/60 hover:bg-stage rounded-lg px-3 py-2 border border-white/5 hover:border-marquee/60 transition-colors"
                          >
                            <span>
                              {s.show_date} · {s.show_time}
                            </span>
                            <span className="text-marquee font-mono">
                              from ₹{Math.min(...Object.values(s.pricing))}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-paperDim mt-4">No showtimes scheduled yet.</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {!loading && events.length === 0 && !error && (
            <p className="text-paperDim text-center py-16">No events match your search.</p>
          )}
        </section>
      )}
    </div>
  );
}
