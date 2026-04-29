import React from 'react';

/**
 * CursorLayer — Renders remote users' cursors as HTML overlays
 * Positioned absolutely over the canvas
 */
export default function CursorLayer({ cursors }) {
  // cursors: Record<socketId, { x, y, username, color }>
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {Object.entries(cursors).map(([id, cursor]) => (
        <div
          key={id}
          className="absolute transition-transform duration-75"
          style={{
            transform: `translate(${cursor.x}px, ${cursor.y}px)`,
            zIndex: 50,
          }}
        >
          {/* Cursor icon */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M5 2L15 9.5L9.5 10.5L7 17L5 2Z"
              fill={cursor.color}
              stroke="rgba(0,0,0,0.5)"
              strokeWidth="1"
            />
          </svg>
          {/* Username label */}
          <div
            className="cursor-label absolute top-4 left-2 px-1.5 py-0.5 rounded text-white"
            style={{
              backgroundColor: cursor.color,
              fontSize: '10px',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            {cursor.username}
          </div>
        </div>
      ))}
    </div>
  );
}
