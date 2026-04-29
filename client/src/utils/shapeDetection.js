/**
 * shapeDetection.js — Rule-based shape recognition from freehand strokes
 * Uses bounding box, aspect ratio, and geometric analysis
 */

/**
 * Get bounding box of a set of points
 */
function getBoundingBox(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

/**
 * Calculate total path length
 */
function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

/**
 * Check if path is roughly closed (start ≈ end)
 */
function isClosed(points, threshold = 30) {
  if (points.length < 4) return false;
  const first = points[0];
  const last = points[points.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  return Math.sqrt(dx * dx + dy * dy) < threshold;
}

/**
 * Count direction changes (corners)
 */
function countCorners(points, angleThreshold = 45) {
  let corners = 0;
  for (let i = 2; i < points.length - 2; i++) {
    const dx1 = points[i].x - points[i - 2].x;
    const dy1 = points[i].y - points[i - 2].y;
    const dx2 = points[i + 2].x - points[i].x;
    const dy2 = points[i + 2].y - points[i].y;

    const a1 = Math.atan2(dy1, dx1);
    const a2 = Math.atan2(dy2, dx2);
    let diff = Math.abs((a2 - a1) * (180 / Math.PI));
    if (diff > 180) diff = 360 - diff;
    if (diff > angleThreshold) corners++;
  }
  return corners;
}

/**
 * Main shape detection function
 * Returns: { type: 'circle' | 'rect' | 'line' | 'triangle' | 'freehand', confidence, properties }
 */
export function detectShape(points) {
  if (!points || points.length < 5) return { type: 'freehand', confidence: 1 };

  const bb = getBoundingBox(points);
  const closed = isClosed(points);
  const len = pathLength(points);
  const corners = countCorners(points);
  const aspectRatio = bb.width / (bb.height || 1);
  const diagonalLen = Math.sqrt(bb.width * bb.width + bb.height * bb.height);
  const circularity = (2 * Math.PI * (diagonalLen / 2)) / len;

  // Line detection: very elongated, not closed, few corners
  if (!closed && corners < 3 && (aspectRatio > 5 || aspectRatio < 0.2)) {
    const first = points[0];
    const last = points[points.length - 1];
    return {
      type: 'line',
      confidence: 0.85,
      properties: {
        x0: first.x, y0: first.y,
        x1: last.x, y1: last.y,
      },
    };
  }

  // Straight line detection (low variation from straight path)
  if (!closed && corners < 4 && bb.width > 50 && bb.height > 50) {
    const first = points[0];
    const last = points[points.length - 1];
    // Check straightness: compare path length to straight distance
    const straightDist = Math.sqrt(
      Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2)
    );
    if (len / straightDist < 1.2) {
      return {
        type: 'line',
        confidence: 0.9,
        properties: { x0: first.x, y0: first.y, x1: last.x, y1: last.y },
      };
    }
  }

  // Circle detection: closed path, roughly circular
  if (closed && circularity > 0.7 && circularity < 1.35) {
    const cx = (bb.minX + bb.maxX) / 2;
    const cy = (bb.minY + bb.maxY) / 2;
    const radiusX = bb.width / 2;
    const radiusY = bb.height / 2;
    return {
      type: 'circle',
      confidence: 0.88,
      properties: { x: cx, y: cy, radiusX, radiusY },
    };
  }

  // Rectangle detection: closed, ~4 corners
  if (closed && corners >= 3 && corners <= 6) {
    return {
      type: 'rect',
      confidence: 0.85,
      properties: {
        x: bb.minX, y: bb.minY,
        width: bb.width, height: bb.height,
      },
    };
  }

  // Triangle detection
  if (closed && corners >= 2 && corners <= 4 && len < diagonalLen * 2.2) {
    return {
      type: 'triangle',
      confidence: 0.75,
      properties: bb,
    };
  }

  return { type: 'freehand', confidence: 1 };
}

/**
 * Snap coordinates to a grid
 */
export function snapToGrid(x, y, gridSize = 20) {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}

/**
 * Smart alignment: align shapes to nearest guide
 */
export function smartAlign(shapes, targetShape, threshold = 15) {
  const hints = [];
  const tx = targetShape.x;
  const ty = targetShape.y;

  shapes.forEach((s) => {
    if (s.id === targetShape.id) return;
    if (Math.abs(s.x - tx) < threshold) hints.push({ axis: 'x', value: s.x });
    if (Math.abs(s.y - ty) < threshold) hints.push({ axis: 'y', value: s.y });
  });

  return hints;
}
