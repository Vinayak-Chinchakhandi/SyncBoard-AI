import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!storedUser || !token) {
      navigate('/login');
      return;
    }
    setUser(JSON.parse(storedUser));
    fetchRooms(token);
  }, [navigate]);

  async function fetchRooms(token) {
    try {
      const res = await fetch('/api/rooms', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setRooms(data.rooms || []);
    } catch { /* ignore */ }
  }

  async function handleCreateRoom(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newRoomName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      navigate(`/room/${data.room.roomCode}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinRoom(e) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    navigate(`/room/${code}`);
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-dark-900 text-white relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 glass-dark border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center text-sm">✦</div>
            <span className="font-bold text-lg text-gradient">SyncBoard AI</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-white/70 text-sm">{user.username}</span>
            </div>
            <button
              id="btn-logout"
              onClick={handleLogout}
              className="btn-ghost text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-8">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-5xl font-bold mb-4">
            Welcome back, <span className="text-gradient">{user.username}</span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Create a room or join an existing one to start collaborating in real-time with AI-powered tools.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 max-w-2xl mx-auto">
          {/* Create Room Card */}
          <div className="card hover:glow-brand transition-all duration-300 cursor-pointer group" onClick={() => { setShowCreate(true); setShowJoin(false); }}>
            <div className="text-3xl mb-3">🎨</div>
            <h3 className="text-lg font-bold text-white mb-1">Create Room</h3>
            <p className="text-white/50 text-sm">Start a new collaborative whiteboard session</p>
            <div className="mt-4 flex items-center gap-2 text-brand-400 text-sm group-hover:gap-3 transition-all">
              <span>Create now</span>
              <span>→</span>
            </div>
          </div>

          {/* Join Room Card */}
          <div className="card hover:glow-brand transition-all duration-300 cursor-pointer group" onClick={() => { setShowJoin(true); setShowCreate(false); }}>
            <div className="text-3xl mb-3">🚀</div>
            <h3 className="text-lg font-bold text-white mb-1">Join Room</h3>
            <p className="text-white/50 text-sm">Enter a room code to join an existing session</p>
            <div className="mt-4 flex items-center gap-2 text-brand-400 text-sm group-hover:gap-3 transition-all">
              <span>Join now</span>
              <span>→</span>
            </div>
          </div>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="max-w-md mx-auto mb-8 animate-slide-up">
            <form onSubmit={handleCreateRoom} className="card space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span>🎨</span> Create New Room
              </h3>
              <input
                id="input-room-name"
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name (e.g. Design Sprint)"
                required
                className="input-field"
              />
              {error && <p className="text-red-400 text-sm">⚠️ {error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button id="btn-create-room" type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create →'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Join Form */}
        {showJoin && (
          <div className="max-w-md mx-auto mb-8 animate-slide-up">
            <form onSubmit={handleJoinRoom} className="card space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span>🚀</span> Join a Room
              </h3>
              <input
                id="input-join-code"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter room code (e.g. A1B2C3D4)"
                maxLength={8}
                required
                className="input-field font-mono tracking-widest uppercase text-center text-lg"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowJoin(false)} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button id="btn-join-room" type="submit" className="btn-primary flex-1 justify-center">
                  Join →
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Recent Rooms */}
        {rooms.length > 0 && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-white/40 text-xs uppercase tracking-widest mb-3">Recent Rooms</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {rooms.slice(0, 8).map((room) => (
                <button
                  key={room.id}
                  id={`room-card-${room.room_code}`}
                  onClick={() => navigate(`/room/${room.room_code}`)}
                  className="card text-left hover:glow-brand transition-all duration-200 group p-4"
                >
                  <div className="text-xl mb-2">📋</div>
                  <p className="text-white font-semibold text-sm truncate">{room.name}</p>
                  <p className="text-white/40 text-xs font-mono mt-1">{room.room_code}</p>
                  <p className="text-white/20 text-[10px] mt-1">
                    {new Date(room.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Features Strip */}
      <div className="relative z-10 border-t border-white/5 mt-8">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { icon: '⚡', label: 'Real-time Sync', desc: 'Event-based drawing' },
            { icon: '🤖', label: 'AI Powered', desc: 'Flowcharts & summaries' },
            { icon: '👥', label: 'Multi-user', desc: 'Live cursor tracking' },
            { icon: '📤', label: 'Export PNG', desc: 'One-click download' },
          ].map((f) => (
            <div key={f.label} className="text-center">
              <div className="text-2xl mb-1">{f.icon}</div>
              <p className="text-white/70 text-sm font-semibold">{f.label}</p>
              <p className="text-white/30 text-xs">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
