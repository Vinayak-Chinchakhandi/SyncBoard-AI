import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import socket from '../socket/socket';
import { drawRect, drawCircle, drawLine, drawArrow, drawDiamond, drawRoundedRect, drawText, renderShape } from '../utils/draw';
import { drawFlowchart } from '../utils/flowchartGenerator';

const EV = {
  DRAW: 'draw', CLEAR: 'clear', OBJECT_ADD: 'object-add',
  OBJECT_DELETE: 'object-delete', OBJECT_UPDATE: 'object-update',
  UNDO: 'undo', REDO: 'redo', CANVAS_STATE: 'canvas-state',
  AI_DIAGRAM: 'ai-diagram', FLOWCHART: 'flowchart',
};
const canvasHelpers = { drawArrow, drawRect, drawDiamond, drawRoundedRect, drawText };

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function pointInRect(px, py, x, y, w, h) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}
function distToSegment(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x0, py - y0);
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2));
  return Math.hypot(px - x0 - t * dx, py - y0 - t * dy);
}
function hitTest(obj, px, py, HIT = 12) {
  switch (obj.type) {
    case 'stroke': {
      const pts = obj.points;
      if (!pts || pts.length < 2) return false;
      for (let i = 0; i < pts.length - 1; i++)
        if (distToSegment(px, py, pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y) < HIT) return true;
      return false;
    }
    case 'eraser': return false;
    case 'rect': return pointInRect(px, py, obj.x - HIT, obj.y - HIT, obj.width + HIT*2, obj.height + HIT*2);
    case 'circle': { const d = Math.hypot(px - obj.x, py - obj.y); return d < Math.max(obj.radiusX, obj.radiusY) + HIT; }
    case 'line': case 'arrow': return distToSegment(px, py, obj.x0, obj.y0, obj.x1, obj.y1) < HIT;
    case 'text': return pointInRect(px, py, obj.x - HIT, obj.y - 24, (obj.text?.length || 4) * 10 + HIT*2, 28);
    default: return false;
  }
}

const CanvasBoard = forwardRef(function CanvasBoard({ tool, color, brushSize, onObjectCountChange, onReady }, ref) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const objectsRef = useRef([]);      // SINGLE SOURCE OF TRUTH
  const undoStack = useRef([]);       // stack of removed objects for undo
  const redoStack = useRef([]);       // stack for redo
  const isDrawing = useRef(false);
  const startPos = useRef(null);
  const lastPos = useRef(null);
  const currentStroke = useRef([]);
  const [selectedId, setSelectedId] = useState(null);
  const [textInput, setTextInput] = useState(null);   // { x, y, id? } — null=hidden
  const [textValue, setTextValue] = useState('');
  const selectedIdRef = useRef(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // ── Full redraw (only way canvas ever gets drawn) ────────────────────────
  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    objectsRef.current.forEach((obj) => {
      if (obj.type === 'stroke') {
        const pts = obj.points; if (!pts || pts.length < 2) return;
        ctx.save(); ctx.lineWidth = obj.size || 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = obj.color || '#fff'; ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke(); ctx.restore();
      } else if (obj.type === 'eraser') {
        const pts = obj.points; if (!pts || pts.length < 2) return;
        ctx.save(); ctx.lineWidth = obj.size || 20; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke(); ctx.restore();
      } else if (obj._isFlowchart) {
        drawFlowchart(ctx, obj, canvasHelpers);
      } else {
        renderShape(ctx, obj);
      }
    });

    // Selection highlight
    const selId = selectedIdRef.current;
    if (selId) {
      const sel = objectsRef.current.find(o => o.id === selId);
      if (sel) {
        ctx.save(); ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
        const p = 8;
        if (sel.type === 'rect') ctx.strokeRect(sel.x - p, sel.y - p, sel.width + p*2, sel.height + p*2);
        else if (sel.type === 'circle') { ctx.beginPath(); ctx.ellipse(sel.x, sel.y, sel.radiusX + p, sel.radiusY + p, 0, 0, Math.PI*2); ctx.stroke(); }
        else if (sel.type === 'stroke' && sel.points?.length) {
          const xs = sel.points.map(q => q.x), ys = sel.points.map(q => q.y);
          ctx.strokeRect(Math.min(...xs)-p, Math.min(...ys)-p, Math.max(...xs)-Math.min(...xs)+p*2, Math.max(...ys)-Math.min(...ys)+p*2);
        } else if (sel.type === 'text') {
          ctx.strokeRect(sel.x - p, sel.y - 22, (sel.text?.length || 4)*10 + p*2, 28);
        } else if (sel.type === 'line' || sel.type === 'arrow') {
          const mx = (sel.x0+sel.x1)/2, my = (sel.y0+sel.y1)/2;
          ctx.strokeRect(mx-12, my-12, 24, 24);
        }
        ctx.restore();
      }
    }
  }, []); // stable — reads refs directly

  useEffect(() => { redrawAll(); }, [selectedId, redrawAll]);

  // ── Imperative API ────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,

    loadObjects: (objects) => {
      objectsRef.current = Array.isArray(objects) ? objects : [];
      undoStack.current = []; redoStack.current = [];
      setSelectedId(null);
      redrawAll();
      onObjectCountChange?.(objectsRef.current.length);
    },

    clearCanvas: () => {
      undoStack.current.push([...objectsRef.current]);
      redoStack.current = [];
      objectsRef.current = [];
      setSelectedId(null); redrawAll();
      onObjectCountChange?.(0);
    },

    drawDiagram: (diagramData) => {
      const obj = { ...diagramData, id: genId(), _isFlowchart: true, type: 'flowchart' };
      _commitObject(obj);
    },

    undo: () => _undo(),
    redo: () => _redo(),

    deleteSelected: () => {
      const id = selectedIdRef.current; if (!id) return;
      _deleteById(id);
      socket.emit(EV.OBJECT_DELETE, { id });
    },

    // For text editing from outside
    editTextById: (id) => {
      const obj = objectsRef.current.find(o => o.id === id);
      if (obj && obj.type === 'text') { setTextInput({ x: obj.x, y: obj.y, id }); setTextValue(obj.text); }
    },

    getObjects: () => objectsRef.current,
    getSelectedId: () => selectedIdRef.current,
  }));

  // ── Internal helpers ──────────────────────────────────────────────────────
  function _commitObject(obj) {
    redoStack.current = []; // any new action clears redo
    objectsRef.current.push(obj);
    redrawAll();
    onObjectCountChange?.(objectsRef.current.length);
  }

  function _deleteById(id) {
    const idx = objectsRef.current.findIndex(o => o.id === id);
    if (idx === -1) return;
    redoStack.current = [];
    const [removed] = objectsRef.current.splice(idx, 1);
    undoStack.current.push({ action: 'delete', obj: removed });
    setSelectedId(prev => prev === id ? null : prev);
    redrawAll();
    onObjectCountChange?.(objectsRef.current.length);
  }

  function _undo() {
    if (objectsRef.current.length === 0) return;
    const removed = objectsRef.current.pop();
    redoStack.current.push(removed);
    setSelectedId(null); redrawAll();
    onObjectCountChange?.(objectsRef.current.length);
    socket.emit(EV.UNDO);
  }

  function _redo() {
    if (redoStack.current.length === 0) return;
    const obj = redoStack.current.pop();
    objectsRef.current.push(obj);
    redrawAll();
    onObjectCountChange?.(objectsRef.current.length);
    socket.emit(EV.REDO);
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  const hasCalledReady = useRef(false);
  useEffect(() => {
    const canvas = canvasRef.current, overlay = overlayRef.current;
    const resize = () => {
      const { width, height } = canvas.parentElement.getBoundingClientRect();
      canvas.width = width; canvas.height = height;
      overlay.width = width; overlay.height = height;
      redrawAll();
      if (!hasCalledReady.current) { hasCalledReady.current = true; onReady?.(); }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []); // eslint-disable-line

  // ── Socket listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;

    const onCanvasState = ({ objects }) => {
      if (!Array.isArray(objects)) return;
      objectsRef.current = objects;
      undoStack.current = []; redoStack.current = [];
      setSelectedId(null); redrawAll();
      onObjectCountChange?.(objects.length);
    };

    const onDraw = (data) => {
      const ctx = canvas.getContext('2d');
      ctx.save(); ctx.lineWidth = data.size || 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = data.color || '#fff';
      ctx.globalCompositeOperation = data.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.beginPath(); ctx.moveTo(data.x0, data.y0); ctx.lineTo(data.x1, data.y1);
      ctx.stroke(); ctx.restore();
    };

    const onObjectAdd = (obj) => { objectsRef.current.push(obj); redoStack.current = []; redrawAll(); onObjectCountChange?.(objectsRef.current.length); };
    const onObjectDelete = ({ id }) => { objectsRef.current = objectsRef.current.filter(o => o.id !== id); setSelectedId(p => p === id ? null : p); redrawAll(); onObjectCountChange?.(objectsRef.current.length); };
    const onObjectUpdate = ({ id, changes }) => {
      const obj = objectsRef.current.find(o => o.id === id);
      if (obj) { Object.assign(obj, changes); redrawAll(); }
    };
    const onUndo = () => { if (!objectsRef.current.length) return; redoStack.current.push(objectsRef.current.pop()); setSelectedId(null); redrawAll(); onObjectCountChange?.(objectsRef.current.length); };
    const onRedo = () => { if (!redoStack.current.length) return; objectsRef.current.push(redoStack.current.pop()); redrawAll(); onObjectCountChange?.(objectsRef.current.length); };
    const onClear = () => { objectsRef.current = []; setSelectedId(null); redrawAll(); onObjectCountChange?.(0); };
    const onDiagram = (data) => { const ctx = canvas.getContext('2d'); drawFlowchart(ctx, data, canvasHelpers); };
    const onFlowchart = (data) => { const ctx = canvas.getContext('2d'); drawFlowchart(ctx, data, canvasHelpers); };

    socket.on(EV.CANVAS_STATE,  onCanvasState);
    socket.on(EV.DRAW,          onDraw);
    socket.on(EV.OBJECT_ADD,    onObjectAdd);
    socket.on(EV.OBJECT_DELETE, onObjectDelete);
    socket.on(EV.OBJECT_UPDATE, onObjectUpdate);
    socket.on(EV.UNDO,          onUndo);
    socket.on(EV.REDO,          onRedo);
    socket.on(EV.CLEAR,         onClear);
    socket.on(EV.AI_DIAGRAM,    onDiagram);
    socket.on(EV.FLOWCHART,     onFlowchart);

    return () => {
      socket.off(EV.CANVAS_STATE,  onCanvasState);
      socket.off(EV.DRAW,          onDraw);
      socket.off(EV.OBJECT_ADD,    onObjectAdd);
      socket.off(EV.OBJECT_DELETE, onObjectDelete);
      socket.off(EV.OBJECT_UPDATE, onObjectUpdate);
      socket.off(EV.UNDO,          onUndo);
      socket.off(EV.REDO,          onRedo);
      socket.off(EV.CLEAR,         onClear);
      socket.off(EV.AI_DIAGRAM,    onDiagram);
      socket.off(EV.FLOWCHART,     onFlowchart);
    };
  }, [redrawAll, onObjectCountChange]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); _undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); _redo(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdRef.current) {
        e.preventDefault();
        const id = selectedIdRef.current;
        _deleteById(id);
        socket.emit(EV.OBJECT_DELETE, { id });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line

  // ── Pointer helpers ───────────────────────────────────────────────────────
  const getPos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }, []);

  const clearOverlay = useCallback(() => {
    const ov = overlayRef.current;
    ov.getContext('2d').clearRect(0, 0, ov.width, ov.height);
  }, []);

  const drawPreview = useCallback((pos) => {
    const ov = overlayRef.current, ctx = ov.getContext('2d');
    clearOverlay();
    const sx = startPos.current.x, sy = startPos.current.y, ex = pos.x, ey = pos.y;
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color + '22'; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
    switch (tool) {
      case 'rect': ctx.strokeRect(sx, sy, ex-sx, ey-sy); ctx.fillRect(sx, sy, ex-sx, ey-sy); break;
      case 'circle': { const rx=Math.abs(ex-sx)/2, ry=Math.abs(ey-sy)/2; ctx.beginPath(); ctx.ellipse(sx+(ex-sx)/2, sy+(ey-sy)/2, rx, ry, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke(); break; }
      case 'line': ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke(); break;
      case 'arrow': {
        ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
        const a = Math.atan2(ey-sy,ex-sx), hl=14;
        ctx.fillStyle=color; ctx.beginPath(); ctx.moveTo(ex,ey);
        ctx.lineTo(ex-hl*Math.cos(a-Math.PI/6), ey-hl*Math.sin(a-Math.PI/6));
        ctx.lineTo(ex-hl*Math.cos(a+Math.PI/6), ey-hl*Math.sin(a+Math.PI/6));
        ctx.closePath(); ctx.fill(); break;
      }
      default: break;
    }
    ctx.restore();
  }, [tool, color, clearOverlay]);

  // ── Text commit / edit ────────────────────────────────────────────────────
  const commitText = useCallback((x, y, text, editingId) => {
    if (!text.trim()) return;
    if (editingId) {
      // Edit existing text object
      const obj = objectsRef.current.find(o => o.id === editingId);
      if (obj) {
        obj.text = text;
        redrawAll();
        socket.emit(EV.OBJECT_UPDATE, { id: editingId, changes: { text } });
      }
    } else {
      const obj = { id: genId(), type: 'text', x, y, text, color, fontSize: 18 };
      _commitObject(obj);
      socket.emit(EV.OBJECT_ADD, obj);
    }
  }, [color, redrawAll]); // eslint-disable-line

  // ── Pointer down ──────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    const pos = getPos(e);

    if (tool === 'text') {
      // Check if tapping existing text (double-click / second tap)
      const hit = [...objectsRef.current].reverse().find(o => o.type === 'text' && hitTest(o, pos.x, pos.y));
      if (hit) { setTextInput({ x: hit.x, y: hit.y, id: hit.id }); setTextValue(hit.text); }
      else { setTextInput({ x: pos.x, y: pos.y, id: null }); setTextValue(''); }
      return;
    }

    if (tool === 'select') {
      const hit = [...objectsRef.current].reverse().find(o => o.type !== 'eraser' && hitTest(o, pos.x, pos.y));
      setSelectedId(hit ? hit.id : null);
      return;
    }

    isDrawing.current = true;
    startPos.current = pos;
    lastPos.current = pos;
    currentStroke.current = [pos];
  }, [tool, getPos]);

  // ── Pointer move ──────────────────────────────────────────────────────────
  const onPointerMove = useCallback((e) => {
    e.preventDefault();
    const pos = getPos(e);
    socket.emit('cursor', { x: pos.x, y: pos.y });
    if (!isDrawing.current) return;

    if (tool === 'eraser') {
      // OBJECT-BASED ERASER: delete any object under cursor
      const eraserRadius = brushSize * 3;
      const toDelete = objectsRef.current.filter(o => hitTest(o, pos.x, pos.y, eraserRadius));
      if (toDelete.length > 0) {
        toDelete.forEach(o => {
          objectsRef.current = objectsRef.current.filter(x => x.id !== o.id);
          socket.emit(EV.OBJECT_DELETE, { id: o.id });
        });
        redoStack.current = [];
        redrawAll();
        onObjectCountChange?.(objectsRef.current.length);
      }
      lastPos.current = pos;
    } else if (tool === 'pen') {
      const ctx = canvasRef.current.getContext('2d');
      const lp = lastPos.current;
      ctx.save(); ctx.lineWidth = brushSize; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = color; ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath(); ctx.moveTo(lp.x, lp.y); ctx.lineTo(pos.x, pos.y); ctx.stroke(); ctx.restore();
      socket.emit(EV.DRAW, { x0: lp.x, y0: lp.y, x1: pos.x, y1: pos.y, color, size: brushSize, tool: 'pen' });
      currentStroke.current.push(pos);
      lastPos.current = pos;
    } else {
      drawPreview(pos);
    }
  }, [tool, color, brushSize, getPos, drawPreview, redrawAll, onObjectCountChange]);

  // ── Pointer up ────────────────────────────────────────────────────────────
  const onPointerUp = useCallback((e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const pos = e.touches?.length === 0
      ? (lastPos.current || { x: 0, y: 0 })
      : getPos(e);

    if (tool === 'eraser') {
      // Eraser already deleted objects on move — nothing to commit
      currentStroke.current = []; lastPos.current = null; startPos.current = null;
      return;
    }

    if (tool === 'pen') {
      const pts = currentStroke.current;
      if (pts.length < 2) { currentStroke.current = []; return; }
      const obj = { id: genId(), type: 'stroke', points: [...pts], color, size: brushSize };
      _commitObject(obj);
      socket.emit(EV.OBJECT_ADD, obj);
    } else {
      const sx = startPos.current?.x ?? 0, sy = startPos.current?.y ?? 0;
      const ex = pos.x, ey = pos.y;
      if (Math.abs(ex - sx) < 3 && Math.abs(ey - sy) < 3) { clearOverlay(); currentStroke.current = []; return; }

      let obj = null;
      if (tool === 'line')   obj = { id: genId(), type: 'line',   x0: sx, y0: sy, x1: ex, y1: ey, color, lineWidth: brushSize };
      if (tool === 'arrow')  obj = { id: genId(), type: 'arrow',  x0: sx, y0: sy, x1: ex, y1: ey, color, lineWidth: brushSize };
      if (tool === 'rect')   { const x=Math.min(sx,ex), y=Math.min(sy,ey); obj = { id: genId(), type: 'rect', x, y, width: Math.abs(ex-sx), height: Math.abs(ey-sy), color, lineWidth: brushSize }; }
      if (tool === 'circle') { const rx=Math.abs(ex-sx)/2, ry=Math.abs(ey-sy)/2; obj = { id: genId(), type: 'circle', x: sx+(ex-sx)/2, y: sy+(ey-sy)/2, radiusX: rx, radiusY: ry, color, lineWidth: brushSize }; }

      if (obj) { _commitObject(obj); socket.emit(EV.OBJECT_ADD, obj); }
      clearOverlay();
    }
    currentStroke.current = []; lastPos.current = null; startPos.current = null;
  }, [tool, color, brushSize, getPos, clearOverlay]); // eslint-disable-line

  const cursorClass = { pen: 'cursor-crosshair', eraser: 'cursor-cell', select: 'cursor-pointer', text: 'cursor-text' }[tool] || 'cursor-crosshair';

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full ${cursorClass}`}
        onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp}
        onMouseLeave={() => { if (isDrawing.current) onPointerUp({ touches: [] }); }}
        onTouchStart={(e) => { e.preventDefault(); onPointerDown(e); }}
        onTouchMove={(e) => { e.preventDefault(); onPointerMove(e); }}
        onTouchEnd={(e) => { e.preventDefault(); onPointerUp(e); }}
        aria-label="Collaborative whiteboard canvas"
      />
      <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }} />

      {textInput && (
        <input
          autoFocus
          type="text"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { commitText(textInput.x, textInput.y, textValue, textInput.id); setTextInput(null); }
            if (e.key === 'Escape') setTextInput(null);
          }}
          onBlur={() => { if (textValue.trim()) commitText(textInput.x, textInput.y, textValue, textInput.id); setTextInput(null); }}
          className="absolute bg-transparent border-b border-white/40 outline-none text-white"
          style={{ left: textInput.x, top: textInput.y - 20, fontSize: 18, fontFamily: 'Inter,sans-serif', color, minWidth: 120, caretColor: color, zIndex: 10 }}
          placeholder="Type, Enter to confirm"
        />
      )}
    </div>
  );
});

export default CanvasBoard;
