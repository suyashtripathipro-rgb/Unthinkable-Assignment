const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', authRequired, (req, res) => {
  const venues = db.prepare('SELECT * FROM venues ORDER BY created_at DESC').all();
  res.json(venues.map((v) => ({ ...v, layout: JSON.parse(v.layout_json) })));
});

router.post('/', authRequired, requireRole('admin'), (req, res) => {
  const { name, address, layout } = req.body;
  if (!name || !Array.isArray(layout) || layout.length === 0) {
    return res.status(400).json({ error: 'name and non-empty layout[] are required' });
  }
  for (const row of layout) {
    if (!row.rowLabel || !row.seatsPerRow || !row.category) {
      return res.status(400).json({ error: 'each layout row needs rowLabel, seatsPerRow, category' });
    }
  }
  const info = db
    .prepare('INSERT INTO venues (name, address, created_by, layout_json) VALUES (?,?,?,?)')
    .run(name, address || '', req.user.id, JSON.stringify(layout));
  const venue = db.prepare('SELECT * FROM venues WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ...venue, layout: JSON.parse(venue.layout_json) });
});

module.exports = router;
