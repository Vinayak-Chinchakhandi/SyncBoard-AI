import React from 'react';

const TOOLS = [
  { id: 'pen', icon: '✏️', label: 'Pen' },
  { id: 'eraser', icon: '⬜', label: 'Eraser' },
  { id: 'line', icon: '╱', label: 'Line' },
  { id: 'rect', icon: '□', label: 'Rectangle' },
  { id: 'circle', icon: '○', label: 'Circle' },
  { id: 'arrow', icon: '→', label: 'Arrow' },
  { id: 'text', icon: 'T', label: 'Text' },
];

const COLORS = [
  '#ffffff', '#6366f1', '#8b5cf6', '#06b6d4',
  '#10b981', '#f59e0b', '#ef4444', '#f97316',
  '#ec4899', '#84cc16', '#0ea5e9', '#a78bfa',
];

const BRUSH_SIZES = [2, 4, 8, 14, 22];

export default function Toolbar({
  tool, setTool,
  color, setColor,
  brushSize, setBrushSize,
  onClear, onExport, onUndo,
  users = [],
  roomCode,
}) {
  return (
    <div className="flex flex-col h-full gap-3 py-2">
      {/* Room Info */}
      {roomCode && (
        <div className="px-3 py-2 glass rounded-xl text-center">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Room</p>
          <p className="text-white font-bold text-sm font-mono tracking-widest">{roomCode}</p>
          <p className="text-white/50 text-xs mt-1">{users.length} user{users.length !== 1 ? 's' : ''} online</p>
        </div>
      )}

      {/* Tools */}
      <div className="glass rounded-xl p-2 flex flex-col gap-1">
        <p className="text-[9px] uppercase tracking-widest text-white/30 px-1 mb-1">Tools</p>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            id={`tool-${t.id}`}
            title={t.label}
            onClick={() => setTool(t.id)}
            className={`tool-btn w-full text-lg font-mono ${tool === t.id ? 'tool-btn-active' : ''}`}
          >
            <span>{t.icon}</span>
          </button>
        ))}
      </div>

      {/* Brush Size */}
      <div className="glass rounded-xl p-2 flex flex-col gap-2">
        <p className="text-[9px] uppercase tracking-widest text-white/30 px-1">Size</p>
        <div className="flex flex-col gap-1.5 items-center">
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              title={`${size}px`}
              onClick={() => setBrushSize(size)}
              className={`rounded-full transition-all duration-150 ${brushSize === size ? 'bg-brand-500 ring-2 ring-brand-400' : 'bg-white/20 hover:bg-white/30'}`}
              style={{ width: size + 8, height: size + 8 }}
            />
          ))}
        </div>
      </div>

      {/* Color Palette */}
      <div className="glass rounded-xl p-2 flex flex-col gap-2">
        <p className="text-[9px] uppercase tracking-widest text-white/30 px-1">Color</p>
        <div className="grid grid-cols-2 gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              title={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-md transition-all duration-150 hover:scale-110 ${color === c ? 'ring-2 ring-white scale-110' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        {/* Custom color */}
        <div className="flex items-center gap-1 mt-1">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
            title="Custom color"
          />
          <span className="text-[9px] text-white/40">Custom</span>
        </div>
      </div>

      {/* Actions */}
      <div className="glass rounded-xl p-2 flex flex-col gap-1">
        <p className="text-[9px] uppercase tracking-widest text-white/30 px-1 mb-1">Actions</p>
        <button
          id="btn-undo"
          onClick={onUndo}
          title="Undo"
          className="tool-btn w-full text-sm"
        >
          ↩
        </button>
        <button
          id="btn-clear"
          onClick={onClear}
          title="Clear Board"
          className="tool-btn w-full text-sm hover:text-red-400"
        >
          🗑
        </button>
        <button
          id="btn-export"
          onClick={onExport}
          title="Export PNG"
          className="tool-btn w-full text-sm hover:text-green-400"
        >
          ⬇
        </button>
      </div>

      {/* Online Users */}
      {users.length > 0 && (
        <div className="glass rounded-xl p-2 flex flex-col gap-1 flex-1 overflow-hidden">
          <p className="text-[9px] uppercase tracking-widest text-white/30 px-1">Online</p>
          <div className="flex flex-col gap-1 overflow-y-auto">
            {users.map((u) => (
              <div key={u.socketId} className="flex items-center gap-1.5 px-1">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: u.color }} />
                <span className="text-[11px] text-white/70 truncate">{u.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
