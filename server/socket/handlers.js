const EVENTS = require('./events');
const { getDb } = require('../db/db');

// In-memory room state:
// roomUsers: Map<roomCode, Map<socketId, { username, color }>>
const roomUsers = new Map();

function getOrCreateRoom(roomCode) {
  if (!roomUsers.has(roomCode)) roomUsers.set(roomCode, new Map());
  return roomUsers.get(roomCode);
}

function getUsersInRoom(roomCode) {
  const room = roomUsers.get(roomCode);
  if (!room) return [];
  return Array.from(room.entries()).map(([socketId, data]) => ({ socketId, ...data }));
}

const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#82E0AA', '#F8C471',
];
function randomColor(index) {
  return CURSOR_COLORS[index % CURSOR_COLORS.length];
}

function loadCanvasData(roomCode) {
  try {
    const db = getDb();
    const room = db.prepare('SELECT id FROM rooms WHERE room_code = ?').get(roomCode);
    if (!room) return [];
    const board = db.prepare('SELECT canvas_data FROM boards WHERE room_id = ?').get(room.id);
    return board ? JSON.parse(board.canvas_data || '[]') : [];
  } catch { return []; }
}

function registerHandlers(io, socket) {

  // ─── JOIN ROOM ────────────────────────────────────────────────────────────
  socket.on(EVENTS.JOIN_ROOM, ({ roomCode, username }) => {
    if (!roomCode || !username) {
      return socket.emit(EVENTS.ERROR, { message: 'Room code and username required' });
    }

    // Validate room in DB
    try {
      const db = getDb();
      const room = db.prepare('SELECT id FROM rooms WHERE room_code = ?').get(roomCode);
      if (!room) return socket.emit(EVENTS.ERROR, { message: 'Room does not exist' });
    } catch (err) {
      console.error('[SOCKET] DB error on join:', err.message);
      return socket.emit(EVENTS.ERROR, { message: 'Server error' });
    }

    // Leave previous rooms
    socket.rooms.forEach((room) => { if (room !== socket.id) socket.leave(room); });

    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.username = username;

    const room = getOrCreateRoom(roomCode);
    const colorIndex = room.size;
    const userColor = randomColor(colorIndex);
    room.set(socket.id, { username, color: userColor });

    // Tell others this user joined
    socket.to(roomCode).emit(EVENTS.USER_JOINED, { socketId: socket.id, username, color: userColor });

    // Send current users list to joiner
    socket.emit(EVENTS.ROOM_USERS, getUsersInRoom(roomCode));

    // ── CRITICAL: Send current canvas state to new joiner via socket ────────
    // This ensures late-joiners see the full board immediately
    const canvasObjects = loadCanvasData(roomCode);
    socket.emit(EVENTS.CANVAS_STATE, { objects: canvasObjects });

    console.log(`[ROOM] ${username} joined ${roomCode} (${room.size} users)`);
  });

  // ─── DRAW (live segment preview) ─────────────────────────────────────────
  socket.on(EVENTS.DRAW, (data) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    socket.to(roomCode).emit(EVENTS.DRAW, { ...data, socketId: socket.id });
  });

  // ─── OBJECT ADD ───────────────────────────────────────────────────────────
  socket.on(EVENTS.OBJECT_ADD, (data) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    socket.to(roomCode).emit(EVENTS.OBJECT_ADD, data);
  });

  // ─── OBJECT DELETE ────────────────────────────────────────────────────────
  socket.on(EVENTS.OBJECT_DELETE, (data) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    socket.to(roomCode).emit(EVENTS.OBJECT_DELETE, data);
  });

  // ─── OBJECT UPDATE (text edit, move, etc.) ────────────────────────────────
  socket.on(EVENTS.OBJECT_UPDATE, (data) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    socket.to(roomCode).emit(EVENTS.OBJECT_UPDATE, data);
  });

  // ─── UNDO — broadcast to OTHER clients only (emitter already handled it locally) ──
  socket.on(EVENTS.UNDO, () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    socket.to(roomCode).emit(EVENTS.UNDO);
  });

  // ─── REDO — broadcast to OTHER clients only ───────────────────────────────
  socket.on(EVENTS.REDO, () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    socket.to(roomCode).emit(EVENTS.REDO);
  });

  // ─── CURSOR ───────────────────────────────────────────────────────────────
  socket.on(EVENTS.CURSOR, (data) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = roomUsers.get(roomCode);
    const user = room ? room.get(socket.id) : null;
    socket.to(roomCode).emit(EVENTS.CURSOR, {
      socketId: socket.id,
      username: user?.username || 'Unknown',
      color: user?.color || '#FF6B6B',
      x: data.x,
      y: data.y,
    });
  });

  // ─── CLEAR ────────────────────────────────────────────────────────────────
  socket.on(EVENTS.CLEAR, () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    io.to(roomCode).emit(EVENTS.CLEAR);
    console.log(`[ROOM] Canvas cleared in ${roomCode}`);
  });

  // ─── FLOWCHART / AI DIAGRAM ───────────────────────────────────────────────
  socket.on(EVENTS.AI_DIAGRAM, (data) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    io.to(roomCode).emit(EVENTS.AI_DIAGRAM, data);
  });

  socket.on(EVENTS.FLOWCHART, (data) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    io.to(roomCode).emit(EVENTS.FLOWCHART, data);
  });

  socket.on(EVENTS.SUMMARY, (data) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    io.to(roomCode).emit(EVENTS.SUMMARY, data);
  });

  // ─── DISCONNECT ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = roomUsers.get(roomCode);
    if (room) {
      room.delete(socket.id);
      if (room.size === 0) roomUsers.delete(roomCode);
    }
    socket.to(roomCode).emit(EVENTS.USER_LEFT, { socketId: socket.id });
    console.log(`[SOCKET] ${socket.data.username || 'User'} disconnected from ${roomCode}`);
  });
}

module.exports = { registerHandlers };
