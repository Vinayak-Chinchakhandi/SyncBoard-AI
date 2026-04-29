const EVENTS = require('./events');

// In-memory room → users map: { roomCode: { socketId: { username, color } } }
const roomUsers = new Map();

function getOrCreateRoom(roomCode) {
  if (!roomUsers.has(roomCode)) {
    roomUsers.set(roomCode, new Map());
  }
  return roomUsers.get(roomCode);
}

function getUsersInRoom(roomCode) {
  const room = roomUsers.get(roomCode);
  if (!room) return [];
  return Array.from(room.entries()).map(([socketId, data]) => ({ socketId, ...data }));
}

// Random color palette for cursors
const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#82E0AA', '#F8C471',
];
function randomColor(index) {
  return CURSOR_COLORS[index % CURSOR_COLORS.length];
}

function registerHandlers(io, socket) {
  // ─────────────────────────────────────────
  // JOIN ROOM
  // ─────────────────────────────────────────
  socket.on(EVENTS.JOIN_ROOM, ({ roomCode, username }) => {
    if (!roomCode || !username) {
      return socket.emit(EVENTS.ERROR, { message: 'Room code and username required' });
    }

    // Leave previous rooms
    socket.rooms.forEach((room) => {
      if (room !== socket.id) socket.leave(room);
    });

    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.username = username;

    const room = getOrCreateRoom(roomCode);
    const colorIndex = room.size;
    const userColor = randomColor(colorIndex);
    room.set(socket.id, { username, color: userColor });

    // Notify others
    socket.to(roomCode).emit(EVENTS.USER_JOINED, {
      socketId: socket.id,
      username,
      color: userColor,
    });

    // Send current users list to the joiner
    socket.emit(EVENTS.ROOM_USERS, getUsersInRoom(roomCode));

    console.log(`[ROOM] ${username} joined room ${roomCode} (${room.size} users)`);
  });

  // ─────────────────────────────────────────
  // DRAW EVENT — event-based, coords only
  // ─────────────────────────────────────────
  socket.on(EVENTS.DRAW, (data) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    // Broadcast to everyone else in room
    socket.to(roomCode).emit(EVENTS.DRAW, {
      ...data,
      socketId: socket.id,
    });
  });

  // ─────────────────────────────────────────
  // CURSOR TRACKING
  // ─────────────────────────────────────────
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

  // ─────────────────────────────────────────
  // CLEAR CANVAS
  // ─────────────────────────────────────────
  socket.on(EVENTS.CLEAR, () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    io.to(roomCode).emit(EVENTS.CLEAR);
    console.log(`[ROOM] Canvas cleared in room ${roomCode}`);
  });

  // ─────────────────────────────────────────
  // SHAPE — broadcast shape data
  // ─────────────────────────────────────────
  socket.on(EVENTS.SHAPE, (data) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    socket.to(roomCode).emit(EVENTS.SHAPE, {
      ...data,
      socketId: socket.id,
    });
  });

  // ─────────────────────────────────────────
  // AI DIAGRAM — broadcast generated diagram
  // ─────────────────────────────────────────
  socket.on(EVENTS.AI_DIAGRAM, (data) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    io.to(roomCode).emit(EVENTS.AI_DIAGRAM, data);
  });

  // ─────────────────────────────────────────
  // FLOWCHART — broadcast generated flowchart
  // ─────────────────────────────────────────
  socket.on(EVENTS.FLOWCHART, (data) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    io.to(roomCode).emit(EVENTS.FLOWCHART, data);
  });

  // ─────────────────────────────────────────
  // SUMMARY — broadcast board summary
  // ─────────────────────────────────────────
  socket.on(EVENTS.SUMMARY, (data) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    io.to(roomCode).emit(EVENTS.SUMMARY, data);
  });

  // ─────────────────────────────────────────
  // DISCONNECT
  // ─────────────────────────────────────────
  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const room = roomUsers.get(roomCode);
    if (room) {
      room.delete(socket.id);
      if (room.size === 0) {
        roomUsers.delete(roomCode);
      }
    }
    socket.to(roomCode).emit(EVENTS.USER_LEFT, { socketId: socket.id });
    console.log(`[SOCKET] ${socket.data.username || 'User'} disconnected from ${roomCode}`);
  });
}

module.exports = { registerHandlers };
