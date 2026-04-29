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

    // Create a board for this room
    db.prepare('INSERT INTO boards (room_id, title) VALUES (?, ?)').run(result.lastInsertRowid, name);

    // Add creator to room_users
    db.prepare('INSERT INTO room_users (room_id, user_id) VALUES (?, ?)').run(result.lastInsertRowid, req.user.id);

    res.json({ room: { id: result.lastInsertRowid, roomCode, name } });
  } catch (err) {
    console.error('[ROOM] Create error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/rooms/:code — get room info
router.get('/:code', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const room = db.prepare('SELECT * FROM rooms WHERE room_code = ?').get(req.params.code);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Track user in room
    const existing = db.prepare(
      'SELECT id FROM room_users WHERE room_id = ? AND user_id = ?'
    ).get(room.id, req.user.id);
    if (!existing) {
      db.prepare('INSERT INTO room_users (room_id, user_id) VALUES (?, ?)').run(room.id, req.user.id);
    }

    const members = db.prepare(`
      SELECT u.username FROM room_users ru
      JOIN users u ON u.id = ru.user_id
      WHERE ru.room_id = ?
    `).all(room.id);

    res.json({ room, members });
  } catch (err) {
    console.error('[ROOM] Get error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/rooms — list all rooms (for demo)
router.get('/', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY created_at DESC LIMIT 20').all();
    res.json({ rooms });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
