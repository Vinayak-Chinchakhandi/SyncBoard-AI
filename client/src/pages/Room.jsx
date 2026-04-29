import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CanvasBoard from '../components/CanvasBoard';
import Toolbar from '../components/Toolbar';
import CursorLayer from '../components/CursorLayer';
import AIControls from '../components/AIControls';
import socket from '../socket/socket';
import { exportAsPNG } from '../utils/export';

const SOCKET_EVENTS = {
  JOIN_ROOM: 'join-room',
  CURSOR: 'cursor',
  CLEAR: 'clear',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  ROOM_USERS: 'room-users',
};

export default function Room() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  // State
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#6366f1');
  const [brushSize, setBrushSize] = useState(4);
  const [cursors, setCursors] = useState({});         // { socketId: { x, y, username, color } }
  const [roomUsers, setRoomUsers] = useState([]);      // [{ socketId, username, color }]
  const [connected, setConnected] = useState(false);
  const [showAI, setShowAI] = useState(true);
  const [user, setUser] = useState(null);
  const [shapeCount, setShapeCount] = useState(0);
  const [notification, setNotification] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const showNotification = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  }, []);

  // ─── Auth check ───────────────────────────────────────────────────────────
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!storedUser || !token) {
      navigate('/login');
      return;
    }
    setUser(JSON.parse(storedUser));
  }, [navigate]);

  // ─── Socket connect & join ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => {
      setConnected(true);
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomCode, username: user.username });
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) {
      onConnect();
    }

    // Room users list
    socket.on(SOCKET_EVENTS.ROOM_USERS, (users) => {
      setRoomUsers(users);
    });

    // User joined notification
    socket.on(SOCKET_EVENTS.USER_JOINED, (data) => {
      setRoomUsers((prev) => {
        const exists = prev.find((u) => u.socketId === data.socketId);
        if (exists) return prev;
        return [...prev, data];
      });
      showNotification(`👋 ${data.username} joined the room`);
    });

    // User left
    socket.on(SOCKET_EVENTS.USER_LEFT, ({ socketId }) => {
      setRoomUsers((prev) => {
        const leaving = prev.find((u) => u.socketId === socketId);
        if (leaving) showNotification(`👋 ${leaving.username} left the room`);
        return prev.filter((u) => u.socketId !== socketId);
      });
      setCursors((prev) => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });
    });

    // Cursor tracking
    socket.on(SOCKET_EVENTS.CURSOR, (data) => {
      setCursors((prev) => ({
        ...prev,
        [data.socketId]: { x: data.x, y: data.y, username: data.username, color: data.color },
      }));
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(SOCKET_EVENTS.ROOM_USERS);
      socket.off(SOCKET_EVENTS.USER_JOINED);
      socket.off(SOCKET_EVENTS.USER_LEFT);
      socket.off(SOCKET_EVENTS.CURSOR);
    };
  }, [user, roomCode, showNotification]);

  // ─── Clear canvas ─────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    if (canvasRef.current) canvasRef.current.clearCanvas();
    socket.emit(SOCKET_EVENTS.CLEAR);
    setShapeCount(0);
    showNotification('🗑 Canvas cleared');
  }, [showNotification]);

  // ─── Export ───────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!canvasRef.current) return;
    try {
      const canvas = canvasRef.current.getCanvas();
      await exportAsPNG(canvas, `syncboard-${roomCode}`);
      showNotification('✅ Canvas exported as PNG!');
    } catch {
      showNotification('❌ Export failed');
    }
  }, [roomCode, showNotification]);

  // ─── Copy room code ───────────────────────────────────────────────────────
  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }, [roomCode]);

  // ─── Undo (basic — clear is available) ───────────────────────────────────
  const handleUndo = useCallback(() => {
    showNotification('ℹ️ Undo: Redraw or clear canvas');
  }, [showNotification]);

  const handleStrokeComplete = useCallback(() => {
    setShapeCount((c) => c + 1);
  }, []);

  if (!user) return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-dark-900 overflow-hidden">
      {/* ── TOP NAV ─────────────────────────────────────────────────────────── */}
      <header className="glass-dark border-b border-white/5 flex items-center justify-between px-4 py-2 z-20 flex-shrink-0">
        {/* Left: Brand + back */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="btn-ghost text-sm px-2"
            title="Back to Home"
          >
            ←
          </button>
          <div className="w-7 h-7 rounded-lg gradient-brand flex items-center justify-center text-xs">✦</div>
          <span className="font-bold text-white hidden sm:block">SyncBoard AI</span>
        </div>

        {/* Center: Room code */}
        <button
          id="btn-copy-room-code"
          onClick={handleCopyCode}
          className="flex items-center gap-2 px-3 py-1.5 glass rounded-lg hover:bg-white/10 transition-all group"
          title="Copy room code"
        >
          <span className="text-white/40 text-xs">Room:</span>
          <span className="text-white font-bold text-sm font-mono tracking-widest">{roomCode}</span>
          <span className="text-white/30 text-xs ml-1 group-hover:text-brand-400 transition-colors">
            {copySuccess ? '✓' : '⎘'}
          </span>
        </button>

        {/* Right: Status + AI toggle */}
        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-white/50 text-xs hidden sm:block">
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>

          {/* Users count */}
          <div className="flex items-center gap-1.5 px-2 py-1 glass rounded-lg">
            <span className="text-white/50 text-xs">👥</span>
            <span className="text-white text-xs font-semibold">{roomUsers.length}</span>
          </div>

          {/* AI panel toggle */}
          <button
            id="btn-toggle-ai"
            onClick={() => setShowAI((v) => !v)}
            className={`btn-secondary text-xs px-3 ${showAI ? 'bg-brand-600/30 border-brand-500/50' : ''}`}
          >
            ✦ AI {showAI ? 'Hide' : 'Show'}
          </button>

          {/* Export */}
          <button
            id="btn-export-nav"
            onClick={handleExport}
            className="btn-secondary text-xs px-3 hidden sm:flex"
          >
            ⬇ Export
          </button>
        </div>
      </header>

      {/* ── NOTIFICATION ────────────────────────────────────────────────────── */}
      {notification && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
          <div className="px-4 py-2 glass-dark rounded-full text-sm text-white shadow-lg border border-white/10">
            {notification}
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT: TOOLBAR ───────────────────────────────────────────────── */}
        <aside className="w-[72px] glass-dark border-r border-white/5 flex-shrink-0 overflow-y-auto z-10">
          <div className="p-2 h-full">
            <Toolbar
              tool={tool} setTool={setTool}
              color={color} setColor={setColor}
              brushSize={brushSize} setBrushSize={setBrushSize}
              onClear={handleClear}
              onExport={handleExport}
              onUndo={handleUndo}
              users={roomUsers}
              roomCode={roomCode}
            />
          </div>
        </aside>

        {/* ── CENTER: CANVAS ───────────────────────────────────────────────── */}
        <main className="flex-1 relative overflow-hidden">
          <CanvasBoard
            ref={canvasRef}
            tool={tool}
            color={color}
            brushSize={brushSize}
            onStrokeComplete={handleStrokeComplete}
          />
          <CursorLayer cursors={cursors} />

          {/* Canvas Tool Indicator */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 glass rounded-full text-xs text-white/50">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="capitalize">{tool}</span>
              <span>·</span>
              <span>{brushSize}px</span>
              {shapeCount > 0 && (
                <>
                  <span>·</span>
                  <span>{shapeCount} elements</span>
                </>
              )}
            </div>
          </div>
        </main>

        {/* ── RIGHT: AI PANEL ─────────────────────────────────────────────── */}
        {showAI && (
          <aside className="w-72 glass-dark border-l border-white/5 flex-shrink-0 overflow-y-auto z-10">
            <div className="p-4 h-full">
              <AIControls
                canvasRef={canvasRef}
                roomCode={roomCode}
                userCount={roomUsers.length}
                shapeCount={shapeCount}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
