# 📖 BookTheShow: Comprehensive User Manual & Operational Guide

Welcome to **BookTheShow**—a production-grade, full-stack, real-time ticket booking platform engineered to handle high-demand event drops without race conditions, double-bookings, or wasted inventory.

Whether you are an **Evaluator**, **Administrator**, **Organiser**, or **Customer**, this manual provides minute-by-minute instructions on how to operate every feature of the system, alongside a deep dive into the technical architecture powering it under the hood.


### **Deployment Link- https://unthinkable-assignment-omega.vercel.app**
---

## 🏛️ 1. Architecture & Technology Stack Overview

To understand *how* to use the platform, it helps to understand *what* is running beneath the user interface:

* **Frontend**: Built with **React (Vite)**, styled using **Tailwind CSS**, animated with **Framer Motion**, and kept in sync via **Socket.io-client** for real-time seat status updates.
* **Backend**: Powered by **Node.js** and **Express**, structuring business logic cleanly across dedicated route handlers and service modules (`seatService.js`, `scheduler.js`).
* **Database**: Utilizes **SQLite** via `better-sqlite3`. SQLite operates synchronously, providing native, atomic database write-locks (`db.transaction()`) that completely eliminate concurrency race conditions when two users try to grab the exact same seat at the exact same millisecond.
* **Real-Time Engine**: **Socket.io** broadcasts inventory changes instantly. When one user holds a seat, it turns grey on all other users' screens in milliseconds without requiring a page refresh.
* **Automated Background Scheduler**: A persistent worker sweeps the database every 5 seconds to enforce **Seat Hold TTLs** (automatically releasing abandoned carts) and **Waitlist Offer Expirations** (reallocating dropped tickets to the next person in line).
* **Transactional Email Service**: Integrated with the **Resend API** (utilizing HTTPS port 443 to bypass cloud host SMTP blocks), delivering instant HTML confirmation emails with unique QR code attachments embedded via **CID (Content-ID)** to prevent spam filtering.

---

## 🔑 2. Getting Started & Demo Accounts

If you have seeded your database using `npm run seed`, the system comes pre-configured with sandbox accounts across all three platform roles. You can log in immediately using these credentials or sign up for a brand-new account on the live interface:

| Role | Email Address | Password | Permissions & Access |
| --- | --- | --- | --- |
| **Admin** | `admin@bookyourshow.dev` | `admin123` | Create and configure physical venues, seat categories, and layouts. |
| **Organiser** | `organiser@bookyourshow.dev` | `org123` | Create movie/concert listings, schedule showtimes, set pricing, and track revenue. |
| **Customer** | `customer@bookyourshow.dev` | `customer123` | Browse events, view live seat maps, hold/buy tickets, join waitlists, and cancel bookings. |


<img width="1917" height="862" alt="image" src="https://github.com/user-attachments/assets/06876b2f-d9df-4f17-bc08-9274ddfd9bde" />

---

## 👨‍💼 3. Role-by-Role Operational Guide

---

### Part A: The Administrator Manual (Venue Infrastructure)

Admins control the physical layout of performance halls, cinemas, and auditoriums.

1. **Logging In**: Go to the login page and sign in using the Admin credentials (`admin@bookyourshow.dev`).
2. **Accessing Venues**: Click on the **Venues** tab in the top navigation bar.
3. **Creating a Venue**:
* Click **Add Venue**.
* Enter the venue name (e.g., *Marquee Grand Hall*) and its physical address.
* Define the seating structure (Rows, Seats Per Row, and Categories like *Premium*, *Standard*, or *Economy*). This layout is serialized into JSON and stored in the database, serving as the blueprint for seat map generation.



---

### Part B: The Organiser Manual (Listing & Show Management)

Organisers manage the entertainment catalog, schedule showtimes, and monitor financial performance.

1. **Logging In**: Sign in using the Organiser credentials (`organiser@bookyourshow.dev`).
2. **The Organiser Desk**: Upon logging in, you will be directed to your central dashboard (**Organiser Desk**).
3. **Creating an Event Listing**:
* On the left panel (**New Listing**), enter the event title, select the type (`Movie` or `Concert`), write a description, and optionally paste a poster image URL.
* Click **Create listing**. The event is instantly saved to the database.


4. **Scheduling a Showtime**:
* On the right panel (**Schedule a show time**), select your newly created event from the dropdown.
* Choose an Admin-created venue from the dropdown.
* Pick the date and time of the show using the native pickers.
* Configure the **Seat Hold TTL (Seconds)**—this determines how long a customer has to checkout before their reserved seats are forcefully released (default is 600 seconds / 10 minutes).
* **Dynamic Pricing**: Once a venue is selected, the system reads its layout categories and displays dynamic price input fields (e.g., *Premium*, *Standard*). Enter the price in Indian Rupees (₹) for each category.
* Click **Schedule show time**. The backend automatically seeds every individual seat for that show into the database with a status of `available`.


5. **Tracking Revenue & Analytics**:
* Scroll down to the **Your Listings** section at the bottom of the dashboard.
* Click **Load revenue summary** next to any event to view real-time calculations of total revenue, tickets sold, and individual show breakdowns.



---

### Part C: The Customer Manual (Browsing, Booking & Waitlists)

Customers are the end-users purchasing tickets, managing holds, and interacting with the real-time seat map.

#### Step 1: Browsing Shows

1. Log in with Customer credentials (or register a fresh account by clicking **Sign up**).
2. Click **Browse** in the top navigation to view all active movies and concerts.
3. Click on any event card to open its dedicated **Show Detail** page, which displays the interactive visual seat map and real-time category pricing.

#### Step 2: Selecting & Holding Seats

1. On the seat map, you will see individual seats color-coded by status:
* 🟢 **Green**: Available to select.
* 🟡 **Yellow**: Selected by you.
* 🟣 **Purple**: Held by another user in real time.
* 🔴 **Red / Dark**: Booked and occupied.


2. Click on one or more available seats. A sticky **Checkout Bar** will appear at the bottom of your screen, summarizing your selected seat count and total cost.
3. Click **Hold seats**.
* *What happens behind the scenes*: The backend executes an atomic database transaction locking those seats as `held` exclusively for you, and a countdown timer starts ticking. Simultaneously, **WebSockets** push an instant update so those seats turn grey on every other user's browser.



#### Step 3: Completing Checkout & Receiving Your QR Ticket

1. While your hold is active, click **Confirm & get ticket**.
2. *What happens behind the scenes*: Your payment is simulated, the seats transition from `held` to `booked`, a unique booking reference (`BTS-XXXXX`) is generated, and a secure QR code is rendered.
3. A modal will pop up on your screen displaying your ticket summary, QR code, and a link to view the demo email.
4. **Instant Email Delivery**: Through the asynchronous Resend API integration, a confirmation email containing your ticket details and an embedded CID-attached QR code is instantly dispatched to your inbox.

#### Step 4: The Waitlist & Auto-Assignment Flow

If a popular show sells out completely:

1. When all seats in a specific category (e.g., *Premium*) are taken, the category will display a **Sold out** tag, and a button reading **Join waitlist for Premium** will dynamically appear.
2. Click the button to enter the queue.
3. **The Cancellation & Reallocation Loop**: If another customer holding or booked in that category cancels their ticket via their **My Tickets** page, the background scheduler detects the freed inventory.
4. The system automatically assigns the seat to the next person on the waitlist, sending them an email notification containing a time-limited claim link. If they complete checkout within the window, the seat is secured; if they ignore it, the offer expires and rolls over to the next candidate.

#### Step 5: Managing Booking History & Cancellations

1. Click **My Tickets** in the top navigation bar.
2. Review all your active bookings, seat numbers, show times, and waitlist statuses in one clean view.
3. Click **Cancel** on any active booking if you need to release your seats back into the inventory pool.

---

## ⚙️ 4. Configuration & Troubleshooting Notes

* **Environment Variables (`.env`)**: Ensure your backend environment file properly sets `PORT=3000`, `CLIENT_URL=http://localhost:5173`, and your `RESEND_API_KEY` for email functionality.
* **Email Deliverability**: Because the system uses the **Resend API** over standard HTTPS (port 443), it completely bypasses cloud host (Render/Vercel) SMTP port blocks, ensuring lightning-fast ticket delivery to any valid email address worldwide.
