import { motion } from 'framer-motion';

const CATEGORY_COLOR = {
  Premium: 'ring-marquee',
  Standard: 'ring-violet',
  Economy: 'ring-available',
};

function seatClasses(seat, isSelected, isMine) {
  if (seat.status === 'booked') return 'bg-booked/30 border-booked/50 text-booked cursor-not-allowed';
  if (seat.status === 'held' && !isMine) return 'bg-violet/25 border-violet/60 text-violet cursor-not-allowed animate-pulse';
  if (isSelected) return 'bg-marquee border-marquee text-stage font-bold scale-110 shadow-glow';
  return 'bg-available/10 border-available/50 text-available hover:bg-available/25 cursor-pointer';
}

export default function SeatMap({ seats, selected, onToggle, userId, categoryColors }) {
  const rows = [...new Set(seats.map((s) => s.row_label))].sort();

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[520px]">
        {/* Stage curve */}
        <div className="flex justify-center mb-8">
          <div className="w-3/4 h-3 rounded-t-full bg-gradient-to-r from-transparent via-marquee/70 to-transparent" />
        </div>
        <p className="text-center text-xs uppercase tracking-[0.4em] text-paperDim mb-8">Screen / Stage this way</p>

        <div className="flex flex-col items-center gap-2">
          {rows.map((row) => {
            const rowSeats = seats.filter((s) => s.row_label === row).sort((a, b) => a.seat_number - b.seat_number);
            return (
              <div key={row} className="flex items-center gap-2">
                <span className="w-5 text-xs text-paperDim font-mono">{row}</span>
                <div className="flex gap-1.5">
                  {rowSeats.map((seat) => {
                    const isSelected = selected.includes(seat.id);
                    const isMine = seat.status === 'held' && seat.held_by === userId;
                    const clickable = seat.status === 'available' || isSelected || isMine;
                    return (
                      <motion.button
                        key={seat.id}
                        whileTap={clickable ? { scale: 0.85 } : {}}
                        disabled={!clickable && !isSelected}
                        onClick={() => clickable && onToggle(seat)}
                        title={`${row}${seat.seat_number} · ${seat.category}`}
                        className={`w-7 h-7 rounded-t-md border text-[10px] flex items-center justify-center transition-all focus-ring ${seatClasses(
                          seat,
                          isSelected,
                          isMine
                        )}`}
                      >
                        {seat.seat_number}
                      </motion.button>
                    );
                  })}
                </div>
                <span className="w-5 text-xs text-paperDim font-mono">{row}</span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 mt-8 text-xs text-paperDim">
          <LegendDot className="bg-available/20 border-available/60" label="Available" />
          <LegendDot className="bg-marquee border-marquee" label="Selected" />
          <LegendDot className="bg-violet/25 border-violet/60" label="Held by someone" />
          <LegendDot className="bg-booked/30 border-booked/50" label="Booked" />
        </div>
      </div>
    </div>
  );
}

function LegendDot({ className, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-sm border ${className}`} />
      {label}
    </span>
  );
}
