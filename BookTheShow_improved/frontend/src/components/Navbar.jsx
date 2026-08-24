import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../api/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-stage/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-2xl">🎟️</span>
          <span className="font-display text-3xl tracking-wide">
            BOOK<span className="text-marquee">THE</span>SHOW
          </span>
        </Link>

        <nav className="flex items-center gap-5 text-sm font-medium">
          <Link to="/" className="hover:text-marquee transition-colors focus-ring rounded px-1">
            Browse
          </Link>
          {user?.role === 'customer' && (
            <Link to="/my-bookings" className="hover:text-marquee transition-colors focus-ring rounded px-1">
              My Tickets
            </Link>
          )}
          {(user?.role === 'organiser' || user?.role === 'admin') && (
            <Link to="/organiser" className="hover:text-marquee transition-colors focus-ring rounded px-1">
              Organiser
            </Link>
          )}
          {user?.role === 'admin' && (
            <Link to="/admin/venues" className="hover:text-marquee transition-colors focus-ring rounded px-1">
              Venues
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-3 pl-3 border-l border-white/10">
              <span className="text-paperDim hidden sm:inline">Hi, {user.name.split(' ')[0]}</span>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="px-3 py-1.5 rounded-full border border-white/15 hover:border-marquee hover:text-marquee transition-colors focus-ring"
              >
                Log out
              </motion.button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pl-3 border-l border-white/10">
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-full border border-white/15 hover:border-marquee hover:text-marquee transition-colors focus-ring"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="px-3 py-1.5 rounded-full bg-marquee text-stage font-semibold hover:shadow-glow transition-shadow focus-ring"
              >
                Sign up
              </Link>
            </div>
          )}
        </nav>
      </div>
      <div className="marquee-strip h-1 bulb" />
    </header>
  );
}
