const express = require('express');
const router = express.Router();
const { getDb } = require('../db/db');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'syncboard_secret';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// POST /api/rooms/create
router.post('/create', authMiddleware, (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Room name required' });

    const db = getDb();
    const roomCode = uuidv4().slice(0, 8).toUpperCase();

    const result = db.prepare(
      'INSERT INTO rooms (room_code, name, created_by) VALUES (?, ?, ?)'
    ).run(roomCode, name, req.user.id);

    // Create a board for this room (with empty canvas_data)
    db.prepare(
      'INSERT OR IGNORE INTO boards (room_id, title, canvas_data) VALUES (?, ?, ?)'
    ).run(result.lastInsertRowid, name, '[]');

    // Add creator to room_users
    db.prepare(
      'INSERT OR IGNORE INTO room_users (room_id, user_id) VALUES (?, ?)'
    ).run(result.lastInsertRowid, req.user.id);

    res.json({ room: { id: result.lastInsertRowid, roomCode, name } });
  } catch (err) {
    console.error('[ROOM] Create error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/rooms/my — rooms the current user participated in
router.get('/my', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const rooms = db.prepare(`
      SELECT DISTINCT r.* FROM rooms r
      JOIN room_users ru ON ru.room_id = r.id
      WHERE ru.user_id = ?
      ORDER BY r.created_at DESC
      LIMIT 20
    `).all(req.user.id);
    res.json({ rooms });
  } catch (err) {
    console.error('[ROOM] My rooms error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/rooms/validate/:code — validate room exists (used before joining)
router.get('/validate/:code', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const room = db.prepare('SELECT id, room_code, name FROM rooms WHERE room_code = ?').get(req.params.code);
    if (!room) return res.status(404).json({ error: 'Room does not exist' });
    res.json({ room });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/rooms/:code — get room info + canvas state
router.get('/:code', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE room_code = ?').get(req.params.code);
    if (!room) return res.status(404).json({ error: 'Room does not exist' });

    // Track user in room (insert if not exists)
    db.prepare(
      'INSERT OR IGNORE INTO room_users (room_id, user_id) VALUES (?, ?)'
    ).run(room.id, req.user.id);

    // Get board canvas state
    const board = db.prepare('SELECT canvas_data FROM boards WHERE room_id = ?').get(room.id);
    const canvasData = board ? JSON.parse(board.canvas_data || '[]') : [];

    const members = db.prepare(`
      SELECT u.username FROM room_users ru
      JOIN users u ON u.id = ru.user_id
      WHERE ru.room_id = ?
    `).all(room.id);

    res.json({ room, members, canvasData });
  } catch (err) {
    console.error('[ROOM] Get error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/rooms/:code/save — save canvas state to DB
router.post('/:code/save', authMiddleware, (req, res) => {
  try {
    const { objects } = req.body;
    if (!Array.isArray(objects)) return res.status(400).json({ error: 'objects array required' });

    const db = getDb();
    const room = db.prepare('SELECT id FROM rooms WHERE room_code = ?').get(req.params.code);
    if (!room) return res.status(404).json({ error: 'Room does not exist' });

    const json = JSON.stringify(objects);

    // Try UPDATE first
    const updated = db.prepare(
      'UPDATE boards SET canvas_data = ?, updated_at = CURRENT_TIMESTAMP WHERE room_id = ?'
    ).run(json, room.id);

    // If no row existed, INSERT
    if (updated.changes === 0) {
      db.prepare(
        'INSERT INTO boards (room_id, title, canvas_data) VALUES (?, ?, ?)'
      ).run(room.id, req.params.code, json);
    }

    res.json({ saved: true, count: objects.length });
  } catch (err) {
    console.error('[ROOM] Save error:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;
