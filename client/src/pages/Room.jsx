import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CanvasBoard from '../components/CanvasBoard';
import Toolbar from '../components/Toolbar';
import CursorLayer from '../components/CursorLayer';
import AIControls from '../components/AIControls';
import socket from '../socket/socket';
import { exportAsPNG } from '../utils/export';

const EV = { JOIN_ROOM: 'join-room', CLEAR: 'clear', USER_JOINED: 'user-joined', USER_LEFT: 'user-left', ROOM_USERS: 'room-users', ERROR: 'error' };

export default function Room() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  const [tool, setTool]           = useState('pen');
  const [color, setColor]         = useState('#6366f1');
  const [brushSize, setBrushSize] = useState(4);
  const [cursors, setCursors]     = useState({});
  const [roomUsers, setRoomUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [showAI, setShowAI]       = useState(false);   // closed by default for mobile
  const [showToolbar, setShowToolbar] = useState(true);
  const [user, setUser]           = useState(null);
  const [objectCount, setObjectCount] = useState(0);
  const [selectedId, setSelectedId]   = useState(null);
  const [notification, setNotification] = useState('');
  const [copySuccess, setCopySuccess]   = useState(false);
  const [roomError, setRoomError]       = useState('');
  const [roomName, setRoomName]         = useState('');
  const [saving, setSaving]             = useState(false);
  const [canvasReady, setCanvasReady]   = useState(false);
  const pendingObjects = useRef(null);  // objects fetched before canvas mounted

  const notify = useCallback((msg, ms = 3000) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), ms);
  }, []);

  // ── Auth check ────────────────────────────────────────────────────────────
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!storedUser || !token) { navigate('/login'); return; }
    setUser(JSON.parse(storedUser));
  }, [navigate]);

  // ── Room load (fetch canvas data) ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    fetch(`/api/rooms/${roomCode}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setRoomError(data.error); return; }
        setRoomName(data.room.name);
        // Store objects — load into canvas once it reports ready
        if (Array.isArray(data.canvasData) && data.canvasData.length > 0) {
          pendingObjects.current = data.canvasData;
          // Try immediately; if canvas not ready yet, onCanvasReady will pick it up
          if (canvasReady && canvasRef.current) {
            canvasRef.current.loadObjects(data.canvasData);
            setObjectCount(data.canvasData.length);
            pendingObjects.current = null;
          }
        }
      })
      .catch(() => setRoomError('Failed to load room'));
  }, [user, roomCode]); // eslint-disable-line

  // ── Called by CanvasBoard when it first mounts and is ready ───────────────
  const onCanvasReady = useCallback(() => {
    setCanvasReady(true);
    if (pendingObjects.current) {
      canvasRef.current?.loadObjects(pendingObjects.current);
      setObjectCount(pendingObjects.current.length);
      pendingObjects.current = null;
    }
  }, []);

  // ── Socket connect + join ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user || roomError) return;
    if (!socket.connected) socket.connect();

    const onConnect = () => { setConnected(true); socket.emit(EV.JOIN_ROOM, { roomCode, username: user.username }); };
    const onDisconnect = () => setConnected(false);
    const onError = ({ message }) => setRoomError(message);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(EV.ERROR, onError);
    if (socket.connected) onConnect();

    socket.on(EV.ROOM_USERS, setRoomUsers);
    socket.on(EV.USER_JOINED, (data) => { setRoomUsers(p => p.find(u => u.socketId === data.socketId) ? p : [...p, data]); notify(`👋 ${data.username} joined`); });
    socket.on(EV.USER_LEFT, ({ socketId }) => { setRoomUsers(p => { const l = p.find(u => u.socketId === socketId); if (l) notify(`👋 ${l.username} left`); return p.filter(u => u.socketId !== socketId); }); setCursors(p => { const n = {...p}; delete n[socketId]; return n; }); });
    socket.on('cursor', (data) => setCursors(p => ({ ...p, [data.socketId]: { x: data.x, y: data.y, username: data.username, color: data.color } })));

    // Auto-save on page close
    const onUnload = () => saveCanvas(true);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      socket.off('connect', onConnect); socket.off('disconnect', onDisconnect);
      socket.off(EV.ERROR, onError); socket.off(EV.ROOM_USERS); socket.off(EV.USER_JOINED);
      socket.off(EV.USER_LEFT); socket.off('cursor');
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [user, roomCode, roomError, notify]); // eslint-disable-line

  // ── Auto-save every 60 seconds ────────────────────────────────────────────
  useEffect(() => {
    if (!user || roomError) return;
    const id = setInterval(() => saveCanvas(true), 60000);
    return () => clearInterval(id);
  }, [user, roomError]); // eslint-disable-line

  // ── Keep selectedId synced ────────────────────────────────────────────────
  const onObjectCountChange = useCallback((count) => {
    setObjectCount(count);
    setSelectedId(canvasRef.current?.getSelectedId?.() || null);
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveCanvas = useCallback(async (silent = false) => {
    if (!canvasRef.current) return;
    const objects = canvasRef.current.getObjects();
    const token = localStorage.getItem('token');
    try {
      if (!silent) setSaving(true);
      const r = await fetch(`/api/rooms/${roomCode}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ objects }),
      });
      if (!silent) { if (r.ok) notify('💾 Board saved!'); else notify('❌ Save failed'); }
    } catch { if (!silent) notify('❌ Save failed'); }
    finally { if (!silent) setSaving(false); }
  }, [roomCode, notify]);

  const handleUndo   = useCallback(() => canvasRef.current?.undo(), []);
  const handleRedo   = useCallback(() => canvasRef.current?.redo(), []);
  const handleDelete = useCallback(() => { canvasRef.current?.deleteSelected(); setSelectedId(null); }, []);
  const handleClear  = useCallback(() => {
    if (!window.confirm('Clear entire canvas? This cannot be undone.')) return;
    canvasRef.current?.clearCanvas();
    socket.emit(EV.CLEAR);
    setObjectCount(0);
    notify('🗑 Canvas cleared');
  }, [notify]);
  const handleExport = useCallback(async () => {
    try { const c = canvasRef.current?.getCanvas(); if (!c) return; await exportAsPNG(c, `syncboard-${roomCode}`); notify('✅ Exported!'); }
    catch { notify('❌ Export failed'); }
  }, [roomCode, notify]);
  const handleCopy = useCallback(() => { navigator.clipboard.writeText(roomCode).then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }); }, [roomCode]);

  if (roomError) return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="card max-w-sm text-center space-y-4">
        <div className="text-5xl">🚫</div>
        <h2 className="text-xl font-bold text-white">Room Not Found</h2>
        <p className="text-white/60 text-sm">{roomError}</p>
        <button onClick={() => navigate('/')} className="btn-primary justify-center w-full">← Back to Home</button>
      </div>
    </div>
  );

  if (!user) return <div className="min-h-screen bg-dark-900 flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-dark-900 overflow-hidden">

      {/* ── TOP NAV ───────────────────────────────────────────────────────── */}
      <header className="glass-dark border-b border-white/5 flex items-center justify-between px-3 py-2 z-20 flex-shrink-0 min-h-[48px]">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="btn-ghost text-sm w-9 h-9 flex items-center justify-center" title="Home">←</button>
          <div className="w-6 h-6 rounded-md gradient-brand flex items-center justify-center text-[10px] flex-shrink-0">✦</div>
          <span className="font-bold text-white text-sm hidden sm:block">SyncBoard</span>
          {roomName && <span className="text-white/40 text-xs hidden md:block">· {roomName}</span>}
        </div>

        <button id="btn-copy-room-code" onClick={handleCopy} className="flex items-center gap-1.5 px-2 py-1 glass rounded-lg hover:bg-white/10 transition-all" title="Copy room code">
          <span className="text-white/40 text-[10px]">Room:</span>
          <span className="text-white font-bold text-sm font-mono">{roomCode}</span>
          <span className="text-white/30 text-xs">{copySuccess ? '✓' : '⎘'}</span>
        </button>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-white/50 text-xs hidden sm:block">{connected ? 'Live' : 'Off'}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 glass rounded-lg">
            <span className="text-xs">👥</span>
            <span className="text-white text-xs font-semibold">{roomUsers.length || 1}</span>
          </div>
          {/* Undo/Redo in header for mobile */}
          <button onClick={handleUndo} className="btn-ghost w-9 h-9 flex items-center justify-center text-sm" title="Undo (Ctrl+Z)">↩</button>
          <button onClick={handleRedo} className="btn-ghost w-9 h-9 flex items-center justify-center text-sm" title="Redo (Ctrl+Y)">↪</button>
          <button id="btn-save-nav" onClick={() => saveCanvas()} disabled={saving} className="btn-secondary text-xs px-2 h-9 hidden sm:flex items-center">{saving ? '...' : '💾'}</button>
          <button id="btn-toggle-ai" onClick={() => setShowAI(v => !v)} className={`btn-secondary text-xs px-2 h-9 ${showAI ? 'bg-brand-600/30' : ''}`}>AI</button>
          <button id="btn-export-nav" onClick={handleExport} className="btn-secondary text-xs px-2 h-9 hidden sm:flex items-center">PNG</button>
          <button onClick={() => setShowToolbar(v => !v)} className="btn-ghost w-9 h-9 flex items-center justify-center text-sm sm:hidden" title="Toggle toolbar">🛠</button>
        </div>
      </header>

      {/* ── NOTIFICATION ─────────────────────────────────────────────────── */}
      {notification && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="px-4 py-2 glass-dark rounded-full text-sm text-white shadow-lg border border-white/10 whitespace-nowrap">{notification}</div>
        </div>
      )}

      {/* ── MAIN LAYOUT ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT TOOLBAR — hidden on mobile when toggled off */}
        {showToolbar && (
          <aside className="w-[116px] sm:w-[120px] glass-dark border-r border-white/5 flex-shrink-0 overflow-y-auto z-10">
            <div className="p-2 h-full">
              <Toolbar
                tool={tool} setTool={setTool}
                color={color} setColor={setColor}
                brushSize={brushSize} setBrushSize={setBrushSize}
                onClear={handleClear} onExport={handleExport}
                onUndo={handleUndo} onRedo={handleRedo}
                onDelete={handleDelete} onSave={() => saveCanvas()}
                users={roomUsers} selectedId={selectedId}
              />
            </div>
          </aside>
        )}

        {/* CANVAS */}
        <main className="flex-1 relative overflow-hidden">
          <CanvasBoard
            ref={canvasRef}
            tool={tool} color={color} brushSize={brushSize}
            onObjectCountChange={onObjectCountChange}
            onReady={onCanvasReady}
          />
          <CursorLayer cursors={cursors} />

          {/* Status bar */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none z-10">
            <div className="flex items-center gap-2 px-3 py-1 glass rounded-full text-xs text-white/50">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="capitalize">{tool}</span>
              <span>·</span><span>{brushSize}px</span>
              {objectCount > 0 && <><span>·</span><span>{objectCount} obj</span></>}
              {selectedId && <span className="text-brand-400">· selected</span>}
            </div>
          </div>
        </main>

        {/* AI PANEL */}
        {showAI && (
          <aside className="w-72 glass-dark border-l border-white/5 flex-shrink-0 overflow-y-auto z-10">
            <div className="p-4 h-full">
              <AIControls canvasRef={canvasRef} roomCode={roomCode} userCount={roomUsers.length} shapeCount={objectCount} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
