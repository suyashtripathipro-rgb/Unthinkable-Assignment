let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

// Broadcasts seat status changes to everyone viewing a given show's seat map.
function emitSeatUpdate(showId, seats) {
  if (!ioInstance) return;
  ioInstance.to(`show:${showId}`).emit('seat:update', { showId, seats });
}

function emitWaitlistUpdate(showId, waitlistSummary) {
  if (!ioInstance) return;
  ioInstance.to(`show:${showId}`).emit('waitlist:update', { showId, waitlistSummary });
}

module.exports = { setIO, emitSeatUpdate, emitWaitlistUpdate };
