import { useEffect, useState } from 'react';

export default function Countdown({ expiresAt, onExpire }) {
  const [remaining, setRemaining] = useState(getRemaining(expiresAt));

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const r = getRemaining(expiresAt);
      setRemaining(r);
      if (r <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) return null;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const low = remaining <= 60;

  return (
    <span className={`font-mono text-sm ${low ? 'text-booked animate-pulse' : 'text-marquee'}`}>
      {mins}:{secs.toString().padStart(2, '0')}
    </span>
  );
}

function getRemaining(expiresAt) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}
