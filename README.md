# 🎬 BookTheShow: High-Concurrency Ticket Booking System

BookTheShow is a full-stack, real-time ticket booking platform designed to handle high-demand event drops. It features visual seat maps, real-time inventory locking, automated waitlist reallocation, and QR code ticket generation. This project fulfills all core specifications of a high-concurrency ticketing system, ensuring no double-bookings and zero wasted inventory.

### LIVE DEPLOYMENT URL- https://unthinkable-assignment-omega.vercel.app/

## 💻 Tech Stack & Tools

### Frontend
* **React.js (Vite):** Fast, modern frontend framework for building the user interface.
* **Tailwind CSS:** Utility-first CSS framework for responsive and rapid styling.
* **Context API:** For managing global authentication state (`AuthContext.jsx`).
* **In Frontend Deployment, I have Used Free-Version of Vercel for the deployment of the Website.**

### Backend
* **Node.js & Express.js:** RESTful API creation and server routing (`routes/auth.js`, `routes/bookings.js`, etc.).
* **SQLite:** Lightweight, transactional database used for rapid deployment and synchronous transaction locking.
* **WebSockets (Socket.io):** Real-time, bidirectional communication for instant seat map updates across all clients (`services/realtime.js`).
* **Nodemailer:** Handles async email dispatch for tickets and waitlist offers (`services/email.js`).
* **QR Code (qrcode):** Generates scannable ticket references attached to confirmation emails (`services/qrcode.js`).
* **Custom Background Scheduler:** A timed worker checking database records for TTL expiration (`services/scheduler.js`).
* **In Backend Deployment, I have Used Free-Version Of Render for database and server deployment**

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

## ⚠️ Known Deployment Limitations (Email Issue)

While the email service (`nodemailer`) works perfectly in a local environment, live deployment platforms (like Vercel/Render) often block outbound SMTP connections on ports 465/587.

When attempting to send a ticket via direct SSL Gmail in production, the background email worker may throw a `Delivery failed: Connection timeout` error. 

* **Impact:** The booking still completes successfully in the database, but the automated email fails to fire due to the hosting provider's firewall. 
* **Resolution:** A production-grade fix would involve migrating from raw SMTP to an HTTP-based email API provider (like Resend or SendGrid).
  
**Note- This timeout is there due to that i am using the free version of RENDER.**
  <img width="1362" height="85" alt="image" src="https://github.com/user-attachments/assets/839e8044-952c-4d27-8525-6d2abf9d0850" />


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
