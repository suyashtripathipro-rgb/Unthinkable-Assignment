## <span style="background-color: #FFD700"> NOTE- WEBSITE'S BACKEND SERVER GOES INTO SLEEP AFTER 15 MINUTES OF INACTIVITY, SO YOU MAY FEEL THE HIGH LATENCY IN LOGIN IN ON THE WEBSITE </span>

# 🎬 BookTheShow: High-Concurrency Ticket Booking System

BookTheShow is a full-stack, real-time ticket booking platform designed to handle high-demand event drops. It features visual seat maps, real-time inventory locking, automated waitlist reallocation, and QR code ticket generation. This project fulfills all core specifications of a high-concurrency ticketing system, ensuring no double-bookings and zero wasted inventory.

### LIVE DEPLOYMENT URL- https://unthinkable-assignment-omega.vercel.app/

---

## ⚠️ Known Deployment Limitations (Email Issue)*

While the email service (`nodemailer`) works perfectly in a local environment, live deployment platforms (like Vercel/Render) often block outbound SMTP connections on ports 465/587.

When attempting to send a ticket via direct SSL Gmail in production, the background email worker may throw a `Delivery failed: Connection timeout` error. 

* **Impact:** The booking still completes successfully in the database, but the automated email fails to fire due to the hosting provider's firewall. 
* **Resolution:** A production-grade fix would involve migrating from raw SMTP to an HTTP-based email API provider (like Resend or SendGrid).
  
**Note- This timeout is there due to that i am using the free version of RENDER.**
  <img width="1362" height="85" alt="image" src="https://github.com/user-attachments/assets/839e8044-952c-4d27-8525-6d2abf9d0850" />


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

## 💻 Tech Stack & Tools

### Frontend
* **React.js (Vite):** Fast, modern frontend framework for building the user interface.
* **Tailwind CSS:** Utility-first CSS framework for responsive and rapid styling.
* **Context API:** For managing global authentication state (`AuthContext.jsx`).
* **In Frontend Deployment, I have Used Free-Version of Vercel for the deployment of the Website.**

<img width="1917" height="868" alt="image" src="https://github.com/user-attachments/assets/cbfdaa8f-8502-4cb3-95c9-282ac4b87f6e" />


### Backend
* **Node.js & Express.js:** RESTful API creation and server routing (`routes/auth.js`, `routes/bookings.js`, etc.).
* **SQLite:** Lightweight, transactional database used for rapid deployment and synchronous transaction locking.
* **WebSockets (Socket.io):** Real-time, bidirectional communication for instant seat map updates across all clients (`services/realtime.js`).
* **Nodemailer:** Handles async email dispatch for tickets and waitlist offers (`services/email.js`).
* **QR Code (qrcode):** Generates scannable ticket references attached to confirmation emails (`services/qrcode.js`).
* **Custom Background Scheduler:** A timed worker checking database records for TTL expiration (`services/scheduler.js`).
* **In Backend Deployment, I have Used Free-Version Of Render for database and server deployment**

  <img width="1887" height="978" alt="image" src="https://github.com/user-attachments/assets/82852221-e49c-4bcf-846a-a92aa39babe3" />
  <img width="1917" height="972" alt="image" src="https://github.com/user-attachments/assets/05523b24-031f-492a-b978-c47afcf4fe48" />



---

## 🏗 System Design & Core Logic

### 1. Concurrency Protection & Race Conditions
To prevent two customers from booking the same seat simultaneously, the backend utilizes **Synchronous Database Transactions**. 
* When a user attempts to hold a seat, the system opens a `db.transaction()`.
* It explicitly checks the seat's current status. If it is available, it updates to `held`.
* If two users click the exact same seat at the exact same millisecond, the database write-lock ensures the first request completes the state change, forcing the second request to read the new `held` state and cleanly fail.

### 2. Seat Hold TTL & Auto-Release Mechanism
Instead of relying on fragile in-memory `setTimeout` functions, seat holds are governed by strict database timestamps and a background scheduler. 
* When a seat is held, `hold_expires_at` is set in the database (e.g., current time + 10 minutes). 
* A Node.js background worker (`services/scheduler.js`) sweeps the database every 5 seconds. 
* If it detects a held seat where `hold_expires_at < NOW()`, it automatically reverts the seat to `available` and broadcasts the update via WebSockets.

### 3. Seat Map Data Model & Real-Time Status
The visual seat map relies on a highly normalized data model: 
* Seats are stored individually with columns for `show_id`, `row_label`, `seat_number`, `category`, and `status` (`available`, `held`, `booked`). 
* WebSockets (`services/realtime.js`) are used to push state mutations to all connected clients instantly. If User A holds a seat, it instantly turns grey on User B's screen without a page refresh.

### 4. Waitlist Auto-Assignment & Time-Limited Offers
When an event category sells out, users can join a waitlist queue. 
* On cancellation, the scheduler detects the newly available seat and the pending waitlist. 
* It places an "offer hold" on the seat and dispatches a time-limited claim link via email. 
* If the user ignores the link and the TTL expires, the scheduler revokes the offer and emails the next person in line, ensuring zero inventory goes to waste.

### 5. QR Code Generation & Async Email Delivery
Tickets generate a unique booking reference encoded into a QR code (`services/qrcode.js`). 
* To prevent email server latency from slowing down the user's checkout experience, emails are dispatched using an asynchronous "Fire and Forget" wrapper. 
* QR codes are embedded as CID attachments to bypass strict email spam filters.

---

## 🚀 Setup Guide

### Prerequisites
* Node.js (v18+)
* Git

### Installation

1. **Clone the repo:**
   ```bash
   git clone <your-repo-url>
   cd BookTheShow
   ```

2. **Install Dependencies:**
   Run the following commands in your terminal to install the required packages for both the backend and frontend:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. **Environment Variables:**
   Create a `.env` file in the `backend` directory. Use the following template:
   ```env
   # Server
   PORT=3000
   NODE_ENV=development
   JWT_SECRET=your_super_secret_jwt_key_here

   # Email Configuration (Direct SSL Gmail)
   GMAIL_USER=your.email@gmail.com
   GMAIL_APP_PASSWORD=your_16_character_app_password

   # Frontend URL for CORS and Waitlist Links
   CLIENT_URL=http://localhost:5173
   ```

4. **Running the App Locally:**
   
   **Start the Backend:**
   ```bash
   cd backend
   npm run seed # Initializes the SQLite DB and creates demo users
   npm run dev  # Starts the Express server and WebSocket instance
   ```
   
   **Start the Frontend:**
   ```bash
   cd ../frontend
   npm run dev  # Starts the Vite React app
   ```
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

The system uses SQLite for rapid deployment and transactional safety.

| Table | Columns |
| :--- | :--- |
| **users** | `id`, `name`, `email`, `password_hash`, `role (customer/organiser/admin)` |
| **venues** | `id`, `name`, `address`, `layout_json` (defines row structures and categories) |
| **events** | `id`, `organiser_id`, `title`, `type (movie/concert)`, `description`, `poster_url` |
| **shows** | `id`, `event_id`, `venue_id`, `show_date`, `show_time`, `pricing_json` |
| **seats** | `id`, `show_id`, `row_label`, `seat_number`, `category`, `status`, `hold_expires_at`, `held_by` |
| **bookings** | `id`, `customer_id`, `show_id`, `total_amount`, `status (confirmed/cancelled)`, `qr_data_url` |
| **waitlist** | `id`, `customer_id`, `show_id`, `category`, `status (waiting/offered/expired)` |

---

## 🔌 API Documentation

### Public Routes
* `GET /api/events` - Fetch all active events with attached showtimes.
* `GET /api/events/shows/:showId/seats` - Fetch seat map and category pricing for a specific show.

### Customer Routes (Requires Auth)
* `POST /api/bookings/hold` - Lock an array of seat IDs (Concurrency protected).
  * **Payload:** `{ showId, seatIds: [...] }`
* `POST /api/bookings/checkout` - Convert held seats to a confirmed booking, triggers background email.
* `POST /api/bookings/:id/cancel` - Cancel a booking, freeing seats for waitlist processing.
* `POST /api/bookings/waitlist` - Join queue for a sold-out category.
  * **Payload:** `{ showId, category }`

### Organiser Routes (Requires Auth + Role)
* `POST /api/events` - Create a new movie/concert listing.
* `POST /api/events/:id/shows` - Schedule a show and dynamically generate seat rows based on venue layout.
* `POST /api/events/:id/summary` - Fetch revenue and ticket sale analytics.

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
| **Email delivery (Gmail)*** | Nodemailer + Gmail App Password — beautiful HTML templates (**Deployment Limitation Is Also Provided Above**) |
| Cancellation email | Sent to customer on every cancellation |
| Role-based auth | JWT with `customer` / `organiser` / `admin` roles |
| API design & docs | RESTful routes, error codes, this README |
