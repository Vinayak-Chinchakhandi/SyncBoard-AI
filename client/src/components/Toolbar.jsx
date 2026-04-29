import React from 'react';

const TOOLS = [
  { id: 'pen',    icon: '✏️',  label: 'Pen'    },
  { id: 'eraser', icon: '◻',   label: 'Eraser' },
  { id: 'select', icon: '▲',   label: 'Select' },
  { id: 'line',   icon: '╱',   label: 'Line'   },
  { id: 'rect',   icon: '▭',   label: 'Rect'   },
  { id: 'circle', icon: '◯',   label: 'Circle' },
  { id: 'arrow',  icon: '→',   label: 'Arrow'  },
  { id: 'text',   icon: 'T',   label: 'Text'   },
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
  onClear, onExport, onUndo, onRedo, onDelete, onSave,
  users = [],
  selectedId = null,
}) {
  return (
    <div className="flex flex-col h-full gap-2 py-1 overflow-y-auto overflow-x-hidden">

      {/* Tools */}
      <div className="bg-white/5 rounded-xl p-1.5 flex flex-col gap-0.5">
        <p className="text-[9px] uppercase tracking-widest text-white/30 px-1 mb-1">Tools</p>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            id={`tool-${t.id}`}
            title={t.label}
            onClick={() => setTool(t.id)}
            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg transition-all duration-150 text-sm
              ${tool === t.id
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50'
                : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
          >
            <span className="w-4 text-center leading-none">{t.icon}</span>
            <span className="text-[11px] font-medium">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Brush Size */}
      <div className="bg-white/5 rounded-xl p-1.5">
        <p className="text-[9px] uppercase tracking-widest text-white/30 px-1 mb-1.5">Size</p>
        <div className="flex flex-col gap-1.5 items-center">
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              title={`${size}px`}
              onClick={() => setBrushSize(size)}
              className={`rounded-full transition-all duration-150 flex-shrink-0
                ${brushSize === size
                  ? 'bg-brand-500 ring-2 ring-brand-400'
                  : 'bg-white/20 hover:bg-white/35'
                }`}
              style={{ width: Math.min(size + 10, 28), height: Math.min(size + 10, 28) }}
            />
          ))}
        </div>
      </div>

      {/* Color Palette */}
      <div className="bg-white/5 rounded-xl p-1.5">
        <p className="text-[9px] uppercase tracking-widest text-white/30 px-1 mb-1.5">Color</p>
        <div className="grid grid-cols-3 gap-1 mb-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              title={c}
              onClick={() => setColor(c)}
              className={`h-6 rounded-md transition-all duration-150 hover:scale-110
                ${color === c ? 'ring-2 ring-white scale-110' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5 mt-1 px-1">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent flex-shrink-0"
            title="Custom color"
          />
          <span className="text-[9px] text-white/40">Custom</span>
          <div className="flex-1 h-4 rounded" style={{ backgroundColor: color }} />
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white/5 rounded-xl p-1.5 flex flex-col gap-0.5">
        <p className="text-[9px] uppercase tracking-widest text-white/30 px-1 mb-1">Actions</p>
        <button id="btn-undo" onClick={onUndo} title="Undo (Ctrl+Z)" className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all min-h-[40px]">
          <span className="w-4 text-center">↩</span>
          <span className="text-[11px]">Undo</span>
        </button>
        <button id="btn-redo" onClick={onRedo} title="Redo (Ctrl+Y)" className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all min-h-[40px]">
          <span className="w-4 text-center">↪</span>
          <span className="text-[11px]">Redo</span>
        </button>
        {selectedId && (
          <button
            id="btn-delete"
            onClick={onDelete}
            title="Delete selected (Del)"
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
          >
            <span className="w-4 text-center">✕</span>
            <span className="text-[11px]">Delete</span>
          </button>
        )}
        <button
          id="btn-save"
          onClick={onSave}
          title="Save board"
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-white/60 hover:text-green-400 hover:bg-green-500/10 transition-all"
        >
          <span className="w-4 text-center">💾</span>
          <span className="text-[11px]">Save</span>
        </button>
        <button
          id="btn-clear"
          onClick={onClear}
          title="Clear all"
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <span className="w-4 text-center">🗑</span>
          <span className="text-[11px]">Clear</span>
        </button>
        <button
          id="btn-export"
          onClick={onExport}
          title="Export PNG"
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-white/60 hover:text-brand-400 hover:bg-brand-500/10 transition-all"
        >
          <span className="w-4 text-center">⬇</span>
          <span className="text-[11px]">Export</span>
        </button>
      </div>

      {/* Online Users */}
      {users.length > 0 && (
        <div className="bg-white/5 rounded-xl p-1.5 flex flex-col gap-1">
          <p className="text-[9px] uppercase tracking-widest text-white/30 px-1">Online ({users.length})</p>
          <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
            {users.map((u) => (
              <div key={u.socketId} className="flex items-center gap-1.5 px-1">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: u.color }}
                />
                <span className="text-[11px] text-white/70 truncate">{u.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
