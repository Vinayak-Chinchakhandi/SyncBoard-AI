import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import socket from '../socket/socket';
import { drawStroke, drawRect, drawCircle, drawLine, drawArrow, drawDiamond, drawRoundedRect, drawText, clearCanvas, renderShape } from '../utils/draw';
import { detectShape } from '../utils/shapeDetection';
import { drawFlowchart } from '../utils/flowchartGenerator';

const SOCKET_EVENTS = {
  DRAW: 'draw',
  CLEAR: 'clear',
  SHAPE: 'shape',
  AI_DIAGRAM: 'ai-diagram',
  FLOWCHART: 'flowchart',
};

const canvasHelpers = { drawArrow, drawRect, drawDiamond, drawRoundedRect, drawText };

const CanvasBoard = forwardRef(function CanvasBoard(
  { tool, color, brushSize, onStrokeComplete },
  ref
) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null); // for shape preview
  const isDrawing = useRef(false);
  const lastPos = useRef(null);
  const strokePoints = useRef([]);
  const [shapes, setShapes] = useState([]); // rendered shapes history (local replay)

  // Expose canvas ref to parent
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    clearCanvas: () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      clearCanvas(ctx, canvas);
      setShapes([]);
    },
    drawDiagram: (diagramData) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      drawFlowchart(ctx, diagramData, canvasHelpers);
    },
  }));

  // ─── Canvas setup & resize ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      const { width, height } = canvas.parentElement.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
      // Re-fill background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Replay shapes
      shapes.forEach((s) => renderShape(ctx, s));
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ─── Socket listeners ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const onDraw = (data) => {
      drawStroke(ctx, data);
    };

    const onClear = () => {
      clearCanvas(ctx, canvas);
      setShapes([]);
    };

    const onShape = (data) => {
      renderShape(ctx, data);
      setShapes((prev) => [...prev, data]);
    };

    const onDiagram = (data) => {
      if (data.nodes || data.arrows) {
        drawFlowchart(ctx, data, canvasHelpers);
      }
    };

    const onFlowchart = (data) => {
      drawFlowchart(ctx, data, canvasHelpers);
    };

    socket.on(SOCKET_EVENTS.DRAW, onDraw);
    socket.on(SOCKET_EVENTS.CLEAR, onClear);
    socket.on(SOCKET_EVENTS.SHAPE, onShape);
    socket.on(SOCKET_EVENTS.AI_DIAGRAM, onDiagram);
    socket.on(SOCKET_EVENTS.FLOWCHART, onFlowchart);

    return () => {
      socket.off(SOCKET_EVENTS.DRAW, onDraw);
      socket.off(SOCKET_EVENTS.CLEAR, onClear);
      socket.off(SOCKET_EVENTS.SHAPE, onShape);
      socket.off(SOCKET_EVENTS.AI_DIAGRAM, onDiagram);
      socket.off(SOCKET_EVENTS.FLOWCHART, onFlowchart);
    };
  }, []);

  // ─── Get canvas coordinates ──────────────────────────────────────────────
  const getPos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  // ─── Drawing handlers ────────────────────────────────────────────────────
  const startDrawing = useCallback((e) => {
    e.preventDefault();
    isDrawing.current = true;
    const pos = getPos(e);
    lastPos.current = pos;
    strokePoints.current = [pos];
  }, [getPos]);

  const draw = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);

    if (tool === 'pen' || tool === 'eraser') {
      const data = {
        x0: lastPos.current.x,
        y0: lastPos.current.y,
        x1: pos.x,
        y1: pos.y,
        color,
        size: brushSize,
        tool,
        type: 'stroke',
      };
      drawStroke(ctx, data);
      socket.emit(SOCKET_EVENTS.DRAW, data);
      strokePoints.current.push(pos);
    }

    lastPos.current = pos;

    // Emit cursor position
    socket.emit('cursor', { x: pos.x, y: pos.y });
  }, [tool, color, brushSize, getPos]);

  const stopDrawing = useCallback((e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (tool === 'pen' && strokePoints.current.length > 5) {
      // Shape recognition
      const detected = detectShape(strokePoints.current);
      if (detected.type !== 'freehand' && detected.confidence > 0.8) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const shapeData = buildShapeFromDetection(detected, color, brushSize);
        if (shapeData) {
          renderShape(ctx, shapeData);
          socket.emit(SOCKET_EVENTS.SHAPE, shapeData);
          setShapes((prev) => [...prev, shapeData]);
          if (onStrokeComplete) onStrokeComplete(shapeData);
        }
      }
    }

    strokePoints.current = [];
    lastPos.current = null;
  }, [tool, color, brushSize, onStrokeComplete]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full ${getCursorClass(tool)}`}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        aria-label="Collaborative whiteboard canvas"
      />
    </div>
  );
});

function getCursorClass(tool) {
  switch (tool) {
    case 'eraser': return 'canvas-eraser';
    case 'pen': return 'canvas-pencil';
    default: return 'canvas-pencil';
  }
}

function buildShapeFromDetection(detected, color, lineWidth) {
  const { type, properties } = detected;
  if (!properties) return null;

  switch (type) {
    case 'rect':
      return { type: 'rect', ...properties, color, lineWidth };
    case 'circle':
      return { type: 'circle', ...properties, color, lineWidth };
    case 'line':
      return { type: 'line', ...properties, color, lineWidth };
    default:
      return null;
  }
}

export default CanvasBoard;
