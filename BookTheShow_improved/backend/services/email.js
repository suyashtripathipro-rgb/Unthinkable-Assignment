const nodemailer = require('nodemailer');

// ---------------------------------------------------------------------------
// Transporter factory — supports Gmail OAuth2 (preferred), Gmail App Password,
// generic SMTP, or falls back to an Ethereal test inbox so the app works
// out of the box with zero config.
//
// Priority:
//   1. Gmail with App Password  (GMAIL_USER + GMAIL_APP_PASSWORD in .env)
//   2. Generic SMTP             (SMTP_HOST in .env)
//   3. Ethereal test inbox      (no credentials set — prints preview link)
// ---------------------------------------------------------------------------

let _transporter = null;

async function getTransporter() {
  if (_transporter) return _transporter;

  // ── Option 1: Gmail via App Password (simplest real-world option) ──────────
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    console.log('[email] Using Gmail (App Password) for', process.env.GMAIL_USER);
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,   // 16-char App Password, NOT account password
      },
    });
    return _transporter;
  }

  // ── Option 2: Generic SMTP (SendGrid, Brevo, Mailgun, etc.) ────────────────
  if (process.env.SMTP_HOST) {
    console.log('[email] Using SMTP host:', process.env.SMTP_HOST);
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    return _transporter;
  }

  // ── Option 3: Ethereal fallback (dev / zero-config) ───────────────────────
  const testAccount = await nodemailer.createTestAccount();
  console.log('[email] ⚠️  No email credentials set — using Ethereal test inbox:', testAccount.user);
  console.log('[email] ℹ️  Set GMAIL_USER + GMAIL_APP_PASSWORD in .env to send real emails.');
  _transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  return _transporter;
}

// ---------------------------------------------------------------------------
// Core send wrapper — retries once on transient failures.
// ---------------------------------------------------------------------------
async function sendMail({ to, subject, html, attachments = [] }) {
  try {
    const transporter = await getTransporter();
    const from =
      process.env.GMAIL_USER
        ? `"BookTheShow" <${process.env.GMAIL_USER}>`
        : process.env.MAIL_FROM || '"BookTheShow" <tickets@bookyourshow.dev>';

    const info = await transporter.sendMail({ from, to, subject, html, attachments });

    // Ethereal preview link (only available in test mode)
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log(`[email] 📬 Preview: ${preview}`);

    console.log(`[email] ✅ Sent "${subject}" → ${to}  (id: ${info.messageId})`);
    return { messageId: info.messageId, previewUrl: preview || null };
  } catch (err) {
    console.error('[email] ❌ send failed:', err.message);
    // Invalidate transporter so next call tries to create a fresh one
    _transporter = null;
    return { error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

/** Booking confirmation with attached QR ticket */
function bookingConfirmedEmail({ name, eventTitle, showDate, showTime, seats, bookingRef, totalAmount }) {
  const seatList = seats
    .map((s) => `<span style="display:inline-block;background:#f3f0ff;border:1px solid #c4b5fd;border-radius:6px;padding:2px 8px;margin:2px;font-size:13px">${s.row_label}${s.seat_number} <em style="color:#7c3aed">${s.category}</em></span>`)
    .join(' ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Your BookTheShow Ticket</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="520" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0B0B12 0%,#1a1a2e 100%);padding:28px 32px;text-align:center">
            <div style="color:#E8B84B;font-size:26px;font-weight:800;letter-spacing:4px">🎬 BOOKTHESHOW</div>
            <div style="color:#a0a0b0;font-size:13px;margin-top:6px;letter-spacing:1px">YOUR TICKET IS CONFIRMED</div>
          </td>
        </tr>

        <!-- Green checkmark banner -->
        <tr>
          <td style="background:#16a34a;color:#fff;text-align:center;padding:10px 20px;font-size:14px;font-weight:600">
            ✅ Booking Confirmed — You're all set, ${name.split(' ')[0]}!
          </td>
        </tr>

        <!-- Event details -->
        <tr>
          <td style="padding:28px 32px">
            <h2 style="margin:0 0 20px;color:#0B0B12;font-size:20px">${eventTitle}</h2>

            <table role="presentation" width="100%" style="border-collapse:collapse">
              <tr style="border-bottom:1px solid #f0f0f0">
                <td style="padding:10px 0;color:#6b7280;font-size:14px;width:45%">📅 Date &amp; Time</td>
                <td style="padding:10px 0;font-weight:600;text-align:right;font-size:14px">${showDate} · ${showTime}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f0f0">
                <td style="padding:10px 0;color:#6b7280;font-size:14px">🎟️ Seats</td>
                <td style="padding:10px 0;text-align:right">${seatList}</td>
              </tr>
              <tr style="border-bottom:1px solid #f0f0f0">
                <td style="padding:10px 0;color:#6b7280;font-size:14px">🔖 Booking Ref</td>
                <td style="padding:10px 0;text-align:right;font-family:monospace;font-size:15px;font-weight:700;color:#7c3aed">${bookingRef}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#6b7280;font-size:14px">💳 Total Paid</td>
                <td style="padding:12px 0;text-align:right;font-size:20px;font-weight:800;color:#16a34a">₹${totalAmount}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- QR instruction -->
        <tr>
          <td style="padding:0 32px 24px;text-align:center">
            <div style="background:#faf5ff;border:2px dashed #c4b5fd;border-radius:12px;padding:20px">
              <!-- CID embedded image ensures it bypasses spam filters and renders instantly -->
              <img src="cid:ticket-qr" alt="Your QR Ticket" style="width:150px; height:150px; margin-bottom:12px; border-radius:8px;" />
              <div style="font-weight:700;color:#6d28d9;margin-bottom:4px">Show QR at the Venue Entrance</div>
              <div style="color:#9ca3af;font-size:13px">Keep this QR code handy for scanning at the door.</div>
            </div>
          </td>
        </tr>

        <!-- Tips -->
        <tr>
          <td style="padding:0 32px 28px">
            <div style="background:#fffbeb;border-left:4px solid #E8B84B;border-radius:0 8px 8px 0;padding:14px 16px">
              <div style="font-weight:700;color:#92400e;margin-bottom:6px">📌 Important Tips</div>
              <ul style="margin:0;padding-left:16px;color:#78350f;font-size:13px;line-height:1.8">
                <li>Arrive 15 minutes before show time</li>
                <li>Carry a valid government-issued ID</li>
                <li>This booking is non-transferable</li>
                <li>Cancellation available from My Bookings page</li>
              </ul>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0B0B12;padding:20px 32px;text-align:center">
            <div style="color:#4b5563;font-size:12px">
              Questions? Reply to this email.<br/>
              <span style="color:#374151">BookTheShow · Entertainment at your fingertips</span>
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Waitlist seat offer notification */
function waitlistOfferEmail({ name, eventTitle, category, offerUrl, minutesLeft }) {
  const urgencyColor = minutesLeft <= 10 ? '#dc2626' : minutesLeft <= 20 ? '#d97706' : '#16a34a';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Your Waitlist Seat is Available!</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="520" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);padding:28px 32px;text-align:center">
            <div style="color:#818cf8;font-size:26px;font-weight:800;letter-spacing:4px">🎬 BOOKTHESHOW</div>
            <div style="color:#a5b4fc;font-size:13px;margin-top:6px;letter-spacing:1px">WAITLIST ALERT</div>
          </td>
        </tr>

        <!-- Urgency banner -->
        <tr>
          <td style="background:${urgencyColor};color:#fff;text-align:center;padding:12px 20px;font-size:15px;font-weight:700">
            ⏰ Act fast — your seat offer expires in <strong>${minutesLeft} minutes</strong>
          </td>
        </tr>

        <!-- Main content -->
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 8px;color:#374151;font-size:16px">Hi <strong>${name}</strong>,</p>
            <p style="margin:0 0 24px;color:#374151;font-size:16px">
              Great news! A <strong style="color:#4f46e5">${category}</strong> seat just became available for
              <strong>${eventTitle}</strong> — and you're next on the waitlist! 🎉
            </p>

            <!-- CTA button -->
            <div style="text-align:center;margin:28px 0">
              <a href="${offerUrl}"
                 style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(79,70,229,0.4)">
                🎟️ Claim Your Seat Now
              </a>
            </div>

            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;margin-top:8px">
              <div style="font-weight:700;color:#991b1b;margin-bottom:6px">⚠️ Don't miss out!</div>
              <div style="color:#7f1d1d;font-size:13px;line-height:1.7">
                If you don't complete the booking within <strong>${minutesLeft} minutes</strong>, 
                the seat will automatically be offered to the next person on the waitlist.
                No further offers will be made to you for this event.
              </div>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0B0B12;padding:20px 32px;text-align:center">
            <div style="color:#4b5563;font-size:12px">
              If you no longer want this seat, simply ignore this email.<br/>
              <span style="color:#374151">BookTheShow · Entertainment at your fingertips</span>
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Booking cancellation acknowledgement */
function bookingCancelledEmail({ name, eventTitle, showDate, bookingRef, refundNote }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Booking Cancelled</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="520" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:linear-gradient(135deg,#0B0B12,#1a1a2e);padding:28px 32px;text-align:center">
            <div style="color:#E8B84B;font-size:26px;font-weight:800;letter-spacing:4px">🎬 BOOKTHESHOW</div>
          </td>
        </tr>
        <tr>
          <td style="background:#dc2626;color:#fff;text-align:center;padding:10px 20px;font-size:14px;font-weight:600">
            ❌ Booking Cancelled
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px">
            <p style="margin:0 0 16px;color:#374151">Hi <strong>${name}</strong>,</p>
            <p style="margin:0 0 20px;color:#374151">
              Your booking for <strong>${eventTitle}</strong> on <strong>${showDate}</strong> 
              has been successfully cancelled.
            </p>
            <table role="presentation" width="100%" style="border-collapse:collapse">
              <tr style="border-bottom:1px solid #f0f0f0">
                <td style="padding:10px 0;color:#6b7280;font-size:14px">Booking Ref</td>
                <td style="padding:10px 0;font-family:monospace;font-weight:700;text-align:right;color:#dc2626">${bookingRef}</td>
              </tr>
            </table>
            ${refundNote ? `<div style="margin-top:20px;padding:14px;background:#f0fdf4;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;color:#166534;font-size:14px">${refundNote}</div>` : ''}
            <p style="margin-top:24px;color:#6b7280;font-size:14px">
              Any available seats will be automatically offered to the next person on the waitlist.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#0B0B12;padding:20px 32px;text-align:center">
            <div style="color:#4b5563;font-size:12px">BookTheShow · Entertainment at your fingertips</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}


/** Packages the HTML and the CID QR Code into a single deliverable payload */
async function sendTicketEmail(toEmail, ticketData, qrDataUrl) {
  const html = bookingConfirmedEmail(ticketData);
  const rawBase64 = qrDataUrl.split(';base64,').pop();

  return sendMail({
    to: toEmail,
    subject: `Your Tickets for ${ticketData.eventTitle}`,
    html: html,
    attachments: [
      {
        filename: 'ticket-qr.png',
        content: rawBase64,
        encoding: 'base64',
        cid: 'ticket-qr' // This perfectly matches the <img src="cid:ticket-qr"> in the template
      }
    ]
  });
}
module.exports = { sendMail, sendTicketEmail, bookingConfirmedEmail, waitlistOfferEmail, bookingCancelledEmail };
