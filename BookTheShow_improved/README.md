# 🎬 BookTheShow — Ticket Booking System

A full-stack ticket booking platform for movies and concerts with real-time seat maps, seat hold TTL, waitlist auto-assignment, and QR code tickets via email.

---

## 📁 Project Structure

```
BookTheShow/
├── backend/          # Node.js + Express + SQLite API
│   ├── db/           # Schema (index.js) + seed data (seed.js)
│   ├── middleware/   # JWT auth (auth.js)
│   ├── routes/       # auth, events, venues, bookings
│   ├── services/     # email, qrcode, seatService, realtime, scheduler
│   ├── server.js
│   ├── .env.example
│   └── vercel.json
└── frontend/         # React + Vite + Tailwind CSS
    ├── src/
    │   ├── api/      # axios client + AuthContext
    │   ├── components/  # Navbar, SeatMap, Countdown
    │   └── pages/    # Home, ShowDetail, Login, Register, BookingHistory, ...
    ├── .env.example
    └── vercel.json
```

---

## ⚡ Local Setup

### Prerequisites
- Node.js 18+
- npm

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — set JWT_SECRET and Gmail credentials (see Email Setup below)
node db/seed.js      # seeds demo data
npm run dev          # starts on http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:4000/api  (default, no change needed for local)
npm run dev          # starts on http://localhost:5173
```

### Demo accounts (after seeding)

| Role       | Email                          | Password       |
|------------|--------------------------------|----------------|
| Admin      | admin@bookyourshow.dev         | admin123       |
| Organiser  | organiser@bookyourshow.dev     | organiser123   |
| Customer   | customer@bookyourshow.dev      | customer123    |

---

## 📧 Gmail Email Setup (Required for real emails)

> Without this, emails go to a free Ethereal test inbox — a preview URL is printed in the server console.

### Steps to enable Gmail:

1. Go to your Google Account → **Security** → enable **2-Step Verification**
2. Go to: https://myaccount.google.com/apppasswords
3. Select **"Mail"** → **"Other"** → type `BookTheShow` → click **Generate**
4. Copy the **16-character App Password**
5. Set in your `.env`:

```env
GMAIL_USER=your_real_gmail@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
```

That's it — no OAuth, no extra packages. Nodemailer handles the rest.

---

## 🗄️ Database Schema

**SQLite** (file-based, zero-install) via `better-sqlite3`.

| Table           | Purpose                                                  |
|-----------------|----------------------------------------------------------|
| `users`         | customer / organiser / admin with bcrypt password hash   |
| `venues`        | Venue with `layout_json` (row × seats × category)       |
| `events`        | Movie or concert listing                                 |
| `shows`         | A specific date/time showing of an event at a venue      |
| `seats`         | Per-show seat with `status`, `held_by`, `hold_expires_at`|
| `bookings`      | Confirmed or cancelled bookings with QR data URL         |
| `booking_seats` | Junction: booking ↔ seats                               |
| `waitlist`      | Queue per show + category with offer TTL                 |

---

## 🔒 Seat Hold & TTL Mechanism

1. Customer selects seats → `POST /api/bookings/hold`
2. Inside a **single synchronous SQLite transaction**:
   - Expired holds are released first
   - All selected seats checked for `status = 'available'`
   - Seats updated to `status = 'held'`, `held_by = userId`, `hold_expires_at = now + TTL`
3. The **scheduler** runs every 5 seconds (configurable via `SCHEDULER_TICK_MS`) and releases any held seats whose `hold_expires_at <= now()`
4. If the customer abandons checkout, their hold expires automatically and the seat map updates in real-time via Socket.IO

**Why no race conditions?** `better-sqlite3` transactions are synchronous and Node.js is single-threaded. The check-then-write inside one transaction is atomic — two simultaneous requests cannot both claim the same seat.

---

## 🧾 Waitlist Auto-Assignment Flow

```
Customer joins waitlist → status: 'waiting'
       ↓
Another customer cancels booking → seat freed
       ↓
offerSeatToNextInWaitlist() runs:
  - Finds first 'waiting' entry (FIFO) for that category
  - In a transaction: marks seat 'held' for that customer, sets offer_expires_at
  - Waitlist entry → status: 'offered'
       ↓
Email sent with time-limited link (WAITLIST_OFFER_TTL_SECONDS, default 5 min)
       ↓
If customer completes checkout → booking confirmed, waitlist → 'booked'
If timer expires → scheduler runs expireWaitlistOffers():
  - Waitlist entry → 'expired', seat freed back to 'available'
  - Offer cascades to next person in line
```

---

## 🔌 API Reference

### Auth
| Method | Path              | Body / Notes              |
|--------|-------------------|---------------------------|
| POST   | /api/auth/register | `{ name, email, password, role }` |
| POST   | /api/auth/login    | `{ email, password }`     |
| GET    | /api/auth/me       | Bearer token required     |

### Events & Shows
| Method | Path                          | Notes                        |
|--------|-------------------------------|------------------------------|
| GET    | /api/events                   | `?type=movie&search=keyword` |
| GET    | /api/events/:id               | Event + all shows            |
| POST   | /api/events                   | Organiser/Admin only         |
| POST   | /api/events/:id/shows         | Creates show + seeds seats   |
| GET    | /api/events/shows/:showId/seats | Seat map + waitlist counts |
| GET    | /api/events/organiser/mine    | Revenue summary              |

### Bookings
| Method | Path                   | Notes                          |
|--------|------------------------|--------------------------------|
| POST   | /api/bookings/hold     | `{ showId, seatIds[] }`        |
| POST   | /api/bookings/release  | `{ showId, seatIds[] }`        |
| POST   | /api/bookings/checkout | Confirms booking, sends email  |
| GET    | /api/bookings/mine     | Customer booking history       |
| POST   | /api/bookings/:id/cancel | Cancels + triggers waitlist  |
| POST   | /api/bookings/waitlist | `{ showId, category }`         |
| GET    | /api/bookings/waitlist/mine | Customer waitlist entries |

### Venues (Admin only)
| Method | Path         | Notes                             |
|--------|--------------|-----------------------------------|
| GET    | /api/venues  | List all venues                   |
| POST   | /api/venues  | `{ name, address, layout[] }`     |

---

## 🚀 Deployment Guide

### Overview

| Part     | Host          | Why                                      |
|----------|---------------|------------------------------------------|
| Backend  | **Render**    | Free tier, supports Node + persistent disk for SQLite |
| Frontend | **Vercel**    | Free, instant deploys from GitHub for React/Vite |

> **Note:** Vercel does NOT support persistent file storage, so SQLite on Vercel's filesystem resets on every deploy. Use Render (or Railway) for the backend.

---

### Step 1 — Deploy Backend to Render

1. Push your project to a **GitHub repository** (public or private)

2. Go to https://render.com → **Sign up / Log in**

3. Click **"New +"** → **"Web Service"**

4. Connect your GitHub repo → select the repo

5. Set these settings:
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`

6. Under **Environment Variables**, add:
   ```
   NODE_ENV          = production
   JWT_SECRET        = <generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
   GMAIL_USER        = your_gmail@gmail.com
   GMAIL_APP_PASSWORD= abcd efgh ijkl mnop
   FRONTEND_URL      = https://your-app.vercel.app   ← fill after Step 2
   WAITLIST_OFFER_TTL_SECONDS = 300
   SCHEDULER_TICK_MS = 10000
   ```

7. Click **"Create Web Service"** — Render builds and starts your API

8. **Copy your Render URL** — looks like `https://bookyourshow-api.onrender.com`

9. After first deploy, open Render's **Shell** tab and run:
   ```bash
   node db/seed.js
   ```
   This seeds demo venues and events.

---

### Step 2 — Deploy Frontend to Vercel

1. Go to https://vercel.com → **Sign up / Log in** (use GitHub)

2. Click **"Add New Project"** → import your GitHub repo

3. Set **Root Directory** to `frontend`

4. Under **Environment Variables**, add:
   ```
   VITE_API_URL    = https://bookyourshow-api.onrender.com/api
   VITE_SOCKET_URL = https://bookyourshow-api.onrender.com
   ```

5. Click **"Deploy"** — Vercel builds and gives you a URL like `https://booktheshow.vercel.app`

6. **Go back to Render** → update `FRONTEND_URL` env var to your Vercel URL → Render auto-redeploys

---

### Step 3 — Test it live

1. Open your Vercel URL
2. Register as a customer, browse events, select seats
3. Complete checkout → check your email for the QR ticket
4. Test waitlist: fill all seats, join waitlist, cancel a booking → you'll receive the offer email

---

## ✅ Evaluation Checklist

| Criteria | Implementation |
|---|---|
| Seat hold TTL & auto-release | `hold_expires_at` column + SQLite transaction + scheduler every 5s |
| Concurrency protection | Synchronous `better-sqlite3` transaction — atomic check + write |
| Waitlist auto-assignment | FIFO queue, cascading offer on cancel/expiry |
| Time-limited waitlist offer | `offer_expires_at` enforced by scheduler, cascades to next |
| Real-time seat map updates | Socket.IO rooms per show, broadcast on every status change |
| QR code generation | `qrcode` npm package → PNG buffer attached to email |
| Email delivery (Gmail) | Nodemailer + Gmail App Password — beautiful HTML templates |
| Cancellation email | Sent to customer on every cancellation |
| Role-based auth | JWT with `customer` / `organiser` / `admin` roles |
| API design & docs | RESTful routes, error codes, this README |
