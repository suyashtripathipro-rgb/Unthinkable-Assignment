const seatService = require('./seatService');

const TICK_MS = Number(process.env.SCHEDULER_TICK_MS || 5000);

function startScheduler() {
  setInterval(() => {
    try {
      seatService.releaseAllExpiredHolds();
    } catch (err) {
      console.error('[scheduler] releaseAllExpiredHolds failed:', err.message);
    }
    seatService.expireWaitlistOffers().catch((err) =>
      console.error('[scheduler] expireWaitlistOffers failed:', err.message)
    );
  }, TICK_MS);

  console.log(`[scheduler] running every ${TICK_MS}ms (seat hold TTL + waitlist offer TTL enforcement)`);
}

module.exports = { startScheduler };
