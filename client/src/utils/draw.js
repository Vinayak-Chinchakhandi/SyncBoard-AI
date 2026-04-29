/**
 * draw.js — Core canvas drawing utilities
 * All drawing is done with coordinate-based events (not full state transfer)
 */

/**
 * Draw a stroke segment on canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} data - { x0, y0, x1, y1, color, size, tool }
 */
export function drawStroke(ctx, data) {
  const { x0, y0, x1, y1, color = '#ffffff', size = 4, tool = 'pen' } = data;

  ctx.save();
  ctx.lineWidth = tool === 'eraser' ? size * 4 : size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = tool === 'eraser' ? '#1a1a2e' : color;
  ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a rectangle shape
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} data - { x, y, width, height, color, fill, lineWidth }
 */
export function drawRect(ctx, data) {
  const { x, y, width, height, color = '#ffffff', fill = false, lineWidth = 2 } = data;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color + '33';
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  if (fill) ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a circle/ellipse shape
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} data - { x, y, radiusX, radiusY, color, fill, lineWidth }
 */
export function drawCircle(ctx, data) {
  const { x, y, radiusX, radiusY, color = '#ffffff', fill = false, lineWidth = 2 } = data;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color + '33';
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  if (fill) ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a line
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} data - { x0, y0, x1, y1, color, lineWidth }
 */
export function drawLine(ctx, data) {
  const { x0, y0, x1, y1, color = '#ffffff', lineWidth = 2 } = data;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw text on canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} data - { x, y, text, color, fontSize, fontFamily }
 */
export function drawText(ctx, data) {
  const { x, y, text, color = '#ffffff', fontSize = 18, fontFamily = 'Inter' } = data;
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px ${fontFamily}, sans-serif`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Draw an arrow
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} data - { x0, y0, x1, y1, color, lineWidth }
 */
export function drawArrow(ctx, data) {
  const { x0, y0, x1, y1, color = '#ffffff', lineWidth = 2 } = data;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';

  const angle = Math.atan2(y1 - y0, x1 - x0);
  const headLen = 14;

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(
    x1 - headLen * Math.cos(angle - Math.PI / 6),
    y1 - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x1 - headLen * Math.cos(angle + Math.PI / 6),
    y1 - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a diamond shape (for flowcharts)
 */
export function drawDiamond(ctx, data) {
  const { x, y, width, height, color = '#ffffff', fill = false, lineWidth = 2 } = data;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color + '33';
  ctx.lineWidth = lineWidth;

  const hw = width / 2;
  const hh = height / 2;

  ctx.beginPath();
  ctx.moveTo(x, y - hh);        // top
  ctx.lineTo(x + hw, y);        // right
  ctx.lineTo(x, y + hh);        // bottom
  ctx.lineTo(x - hw, y);        // left
  ctx.closePath();
  if (fill) ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a rounded rectangle (terminal/process shape)
 */
export function drawRoundedRect(ctx, data) {
  const { x, y, width, height, radius = 20, color = '#ffffff', fill = false, lineWidth = 2 } = data;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color + '22';
  ctx.lineWidth = lineWidth;

  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - height / 2, width, height, radius);
  if (fill) ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Clear the entire canvas — fills with dark background
 * NOTE: the background fill is intentional so the canvas shows dark,
 * but eraser objects use destination-out against a transparent layer
 * stacked above the background. CanvasBoard.redrawAll handles this correctly.
 */
export function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Dispatch a draw event based on shape type
 */
export function renderShape(ctx, shape) {
  switch (shape.type) {
    case 'stroke': return drawStroke(ctx, shape);
    case 'rect': return drawRect(ctx, shape);
    case 'circle': return drawCircle(ctx, shape);
    case 'line': return drawLine(ctx, shape);
    case 'arrow': return drawArrow(ctx, shape);
    case 'diamond': return drawDiamond(ctx, shape);
    case 'roundedRect': return drawRoundedRect(ctx, shape);
    case 'text': return drawText(ctx, shape);
    default: break;
  }
}
