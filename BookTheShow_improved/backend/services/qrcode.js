const QRCode = require('qrcode');

// Encodes the booking reference (+ show) into a scannable QR; returns both a
// data URL (for email <img>) and raw PNG buffer (for email attachment).
async function generateBookingQr(bookingRef) {
  const payload = JSON.stringify({ ref: bookingRef, app: 'BookTheShow' });
  const dataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 260 });
  const buffer = await QRCode.toBuffer(payload, { margin: 1, width: 260 });
  return { dataUrl, buffer };
}

module.exports = { generateBookingQr };
