const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password required' });
  const allowed = ['customer', 'organiser'];
  const userRole = allowed.includes(role) ? role : 'customer';
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)').run(name, email, hash, userRole);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT id,name,email,role,created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router;
