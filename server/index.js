require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { router: authRouter } = require('./routes/auth');
const roomRouter = require('./routes/room');
const aiRouter = require('./routes/ai');
const { registerHandlers } = require('./socket/handlers');
const { getDb } = require('./db/db');

const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();
const httpServer = http.createServer(app);

// ─────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

// ─────────────────────────────────────────
// Socket.IO
// ─────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log(`[SOCKET] Connected: ${socket.id}`);
  registerHandlers(io, socket);
});

// ─────────────────────────────────────────
// REST Routes
// ─────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/rooms', roomRouter);
app.use('/api/ai', aiRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────
// Start
// ─────────────────────────────────────────
// Initialize DB on startup
getDb();

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on network at http://0.0.0.0:${PORT}`);
});
