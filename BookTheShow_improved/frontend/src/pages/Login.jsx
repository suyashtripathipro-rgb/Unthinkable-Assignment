import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../api/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('customer@bookyourshow.dev');
  const [password, setPassword] = useState('customer123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={onSubmit}
        className="ticket-card bg-stage2 border border-white/10 p-8"
      >
        <h1 className="font-display text-4xl tracking-wide mb-1">WELCOME BACK</h1>
        <p className="text-paperDim text-sm mb-6">Log in to grab your seats.</p>

        <label className="block text-xs uppercase tracking-wider text-paperDim mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-stage border border-white/15 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-marquee"
        />

        <label className="block text-xs uppercase tracking-wider text-paperDim mb-1">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-stage border border-white/15 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-marquee"
        />

        {error && <p className="text-booked text-sm mb-4">{error}</p>}

        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={busy}
          className="w-full py-2.5 rounded-full bg-marquee text-stage font-semibold hover:shadow-glow transition-shadow disabled:opacity-60"
        >
          {busy ? 'Logging in…' : 'Log in'}
        </motion.button>

        <p className="text-xs text-paperDim mt-5 leading-relaxed">
          Demo accounts — customer: <span className="font-mono">customer@bookyourshow.dev / customer123</span>,
          organiser: <span className="font-mono">organiser@bookyourshow.dev / organiser123</span>, admin:{' '}
          <span className="font-mono">admin@bookyourshow.dev / admin123</span>.
        </p>

        <p className="text-sm text-paperDim mt-4">
          No account?{' '}
          <Link to="/register" className="text-marquee hover:underline">
            Sign up
          </Link>
        </p>
      </motion.form>
    </div>
  );
}
