require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes    = require('./routes/auth');
const venueRoutes   = require('./routes/venues');
const eventRoutes   = require('./routes/events');
const bookingRoutes = require('./routes/bookings');
const realtime      = require('./services/realtime');
const { startScheduler } = require('./services/scheduler');

const app = express();

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'BookTheShow API', ts: new Date().toISOString() }));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/venues',   venueRoutes);
app.use('/api/events',   eventRoutes);
app.use('/api/bookings', bookingRoutes);

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[server error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins.includes('*') ? '*' : allowedOrigins, credentials: true },
});
realtime.setIO(io);

io.on('connection', (socket) => {
  socket.on('show:join',  showId => socket.join(`show:${showId}`));
  socket.on('show:leave', showId => socket.leave(`show:${showId}`));
});

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🎬 BookTheShow API → http://localhost:${PORT}`);
  startScheduler();
});
