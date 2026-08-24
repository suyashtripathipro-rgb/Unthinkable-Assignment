import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../api/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
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
        <h1 className="font-display text-4xl tracking-wide mb-1">JOIN THE SHOW</h1>
        <p className="text-paperDim text-sm mb-6">Create your account in seconds.</p>

        <label className="block text-xs uppercase tracking-wider text-paperDim mb-1">Full name</label>
        <input
          required
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          className="w-full bg-stage border border-white/15 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-marquee"
        />

        <label className="block text-xs uppercase tracking-wider text-paperDim mb-1">Email</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          className="w-full bg-stage border border-white/15 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-marquee"
        />

        <label className="block text-xs uppercase tracking-wider text-paperDim mb-1">Password</label>
        <input
          type="password"
          required
          minLength={6}
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          className="w-full bg-stage border border-white/15 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-marquee"
        />

        <label className="block text-xs uppercase tracking-wider text-paperDim mb-1">I am a…</label>
        <div className="flex gap-2 mb-6">
          {['customer', 'organiser'].map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => update('role', r)}
              className={`flex-1 py-2 rounded-lg border text-sm capitalize transition-colors ${
                form.role === r ? 'bg-marquee text-stage border-marquee font-semibold' : 'border-white/15'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {error && <p className="text-booked text-sm mb-4">{error}</p>}

        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={busy}
          className="w-full py-2.5 rounded-full bg-marquee text-stage font-semibold hover:shadow-glow transition-shadow disabled:opacity-60"
        >
          {busy ? 'Creating account…' : 'Create account'}
        </motion.button>

        <p className="text-sm text-paperDim mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-marquee hover:underline">
            Log in
          </Link>
        </p>
      </motion.form>
    </div>
  );
}
