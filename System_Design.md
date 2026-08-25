# 🏛️ System Design Document: BookTheShow

## 1. Executive Summary
**BookTheShow** is a full-stack, real-time ticket booking and inventory management platform designed to handle high-demand event drops (movies and concerts)[cite: 3]. The core architectural challenge of any ticketing system is preventing **race conditions** (double-booking the same seat) while maintaining responsive real-time UI updates, automated cart abandonment releases, and waitlist reallocations[cite: 3]. 

This document outlines the system architecture, concurrency controls, TTL expiration loops, and event-driven workflows powering the platform.

---

## 2. Architecture & Tech Stack
* **Frontend**: React (Vite) + Tailwind CSS + Framer Motion for animations. Real-time updates are synchronized using `socket.io-client`.
* **Backend**: Node.js with Express, separating business logic into modular service layers (`seatService.js`, `scheduler.js`).
* **Database Layer**: SQLite powered by `better-sqlite3`. SQLite provides synchronous, high-performance local operations while supporting native, atomic database write-locks via explicit transactions.
* **Real-Time Communication**: Socket.io server broadcasting room-specific inventory state changes instantly to connected clients.
* **Transactional Email Service**: Integrated via the **Resend REST API** (HTTPS port 443), decoupling email dispatch from the main request thread and utilizing **CID (Content-ID) attachments** for reliable QR code rendering.

---

## 3. Core Technical Modules & Design Patterns

### 3.1 Concurrency Protection & Race Condition Prevention
During high-traffic events, thousands of users may attempt to click and hold the exact same seat simultaneously. Without protection, a race condition occurs where multiple users successfully reserve the same inventory.

* **The Mechanism**: The backend handles all seat operations inside synchronous database transactions (`db.transaction()`)[cite: 3].
* **Execution Flow**:
  1. When a user requests to hold seats, a transaction opens.
  2. The database performs an explicit check: `SELECT status FROM seats WHERE id = ? AND status = 'available'`.
  3. If the seat is available, it atomically updates the row to `status = 'held'`, records the `held_by` customer ID, and sets a `hold_expires_at` timestamp.
  4. **The Lock**: Because SQLite operates synchronously on write transactions, if User A and User B submit requests at the exact same millisecond, the database serializes them. User A's transaction completes and locks the row. When User B's transaction executes a millisecond later, the status check fails (it is no longer `available`), causing the transaction to abort and throw a clean rejection error to the client.

### 3.2 Seat Hold TTL & Auto-Release Mechanism
To prevent users from holding seats indefinitely and locking up inventory during cart abandonment, a time-to-live (TTL) mechanism is enforced[cite: 3].

* **The Mechanism**: Hybrid database timestamp tracking paired with a background worker (`scheduler.js`)[cite: 3].
* **Execution Flow**:
  1. Every hold is assigned an expiration window (e.g., default 600 seconds / 10 minutes, configurable per show)[cite: 3].
  2. A background interval script (`scheduler.js`) runs continuously (polling every 5 seconds).
  3. The worker executes an atomic query: `UPDATE seats SET status = 'available', hold_expires_at = NULL, held_by = NULL WHERE status = 'held' AND hold_expires_at <= datetime('now')`.
  4. Any released seats trigger an immediate Socket.io broadcast (`seat:update`), causing the seat map to update to green across all connected client browsers in real time[cite: 3].

### 3.3 Waitlist Auto-Assignment & Time-Limited Offer Flow
When an event category (e.g., *Premium*) sells out, customer demand is captured via a category-specific waitlist queue[cite: 3].

* **The Mechanism**: FIFO (First-In, First-Out) queue stored in the `waitlist` table, coupled with automated background evaluation[cite: 3].
* **Execution Flow**:
  1. **Joining**: When a category has zero available seats, users can join the waitlist[cite: 3].
  2. **Cancellation Trigger**: When a confirmed booking is cancelled, or an uncompleted hold expires, the seat returns to the pool[cite: 3].
  3. **Auto-Assignment**: The background scheduler checks if there are active waitlist entries for that show and category. If yes, it pops the highest-priority user, assigns a temporary "offer hold" on the freed seat, and sets an offer expiration TTL[cite: 3].
  4. **Time-Limited Claim**: The system dispatches an email notification containing a secure, time-sensitive claim link (`?claimWaitlist=XYZ`)[cite: 3].
  5. **Expiration Roll-Over**: If the user fails to complete checkout within the allocated window, the offer expires, the seat is reclaimed, and the system automatically rolls the offer over to the next customer in line[cite: 3].

### 3.4 Seat Map Data Model & Real-Time Status Updates
Inventory is normalized down to the individual seat level rather than tracked as a monolithic integer pool[cite: 3].

* **Data Model**: The `seats` table tracks every physical seat per show with columns: `id`, `show_id`, `row_label`, `seat_number`, `category`, `status` (`available`, `held`, `booked`), `hold_expires_at`, and `held_by`.
* **Real-Time Sync**: 
  * Clients connect to a Socket.io room dedicated to the specific show (`show:join`).
  * Whenever a hold, release, or checkout occurs, the backend fetches the fresh seat array and emits a `seat:update` event[cite: 3].
  * The frontend `SeatMap.jsx` component re-renders the visual grid instantly, providing a fluid collaborative experience.

### 3.5 QR Code Generation & Async Email Delivery
* **QR Generation**: Upon successful checkout, a unique booking reference string (`BTS-XXXXXXXX`) is generated and encoded into a Base64 PNG QR code via `qrcode.js`.
* **Async Non-Blocking Dispatch**: To prevent third-party network latency from blocking the user's checkout response, email delivery is wrapped in an asynchronous "Fire and Forget" execution block (`setTimeout` event loop offloading).
* **Deliverability**: Emails are routed through the **Resend REST API** (HTTPS port 443), bypassing strict cloud host SMTP blocks. QR codes are embedded using **CID attachments** (`cid:ticket-qr`) to ensure image rendering across clients and prevent spam filtering.

---

## 4. Summary Matrix of Evaluation Focus

| Evaluation Area | Implemented Solution | Technical Benefit |
| :--- | :--- | :--- |
| **Seat Hold TTL** | Background worker polling every 5s with database timestamp checks[cite: 3]. | Deterministic cleanup; survives server restarts without memory leaks. |
| **Concurrency** | Synchronous database transactions (`better-sqlite3`)[cite: 3]. | Zero double-bookings; database-level write-locks serialize simultaneous requests. |
| **Waitlist Flow** | FIFO queue with automated cancellation triggers and time-limited claim links[cite: 3]. | Zero wasted inventory; fair, automated reallocation of dropped tickets. |
| **Real-Time UI** | Normalized seat schema coupled with Socket.io room broadcasts[cite: 3]. | Instant visual feedback; eliminates stale data across concurrent users. |
| **Email / QR** | Base64 QR generation + Resend HTTP API + CID email attachments[cite: 3]. | Instant checkout response times and high inbox deliverability. |
