/**
 * flowchartGenerator.js — Rule-based text → flowchart generation
 * Parses text like "Start → Process → Decision → End" into canvas nodes
 */

const NODE_WIDTH = 160;
const NODE_HEIGHT = 50;
const H_GAP = 80;    // horizontal gap between nodes
const V_GAP = 60;    // vertical gap between rows
const START_X = 100;
const START_Y = 80;

/**
 * Keyword → node type mapping
 */
const NODE_TYPE_RULES = [
  { pattern: /^(start|begin|init|boot)/i, type: 'terminal', shape: 'roundedRect' },
  { pattern: /^(end|stop|finish|done|exit)/i, type: 'terminal', shape: 'roundedRect' },
  { pattern: /^(if|check|is|whether|decide|decision|condition)/i, type: 'decision', shape: 'diamond' },
  { pattern: /^(yes|no|true|false|pass|fail)/i, type: 'branch', shape: 'rect' },
  { pattern: /.*/, type: 'process', shape: 'rect' },
];

/**
 * Detect node type from label
 */
function detectNodeType(label) {
  const word = label.trim().split(/\s+/)[0];
  for (const rule of NODE_TYPE_RULES) {
    if (rule.pattern.test(word)) {
      return { type: rule.type, shape: rule.shape };
    }
  }
  return { type: 'process', shape: 'rect' };
}

/**
 * Color palette
 */
const SHAPE_COLORS = {
  terminal: '#06b6d4',    // cyan
  decision: '#f59e0b',    // amber
  branch: '#10b981',      // green
  process: '#6366f1',     // indigo
};

/**
 * Parse flowchart text into tokens
 * Supported separators: →, ->, |, \n, ;
 */
export function parseFlowchartText(text) {
  if (!text || !text.trim()) return [];

  // Normalize separators
  const normalized = text
    .replace(/→/g, '|')
    .replace(/->/g, '|')
    .replace(/\n/g, '|')
    .replace(/;/g, '|');

  const parts = normalized.split('|').map((p) => p.trim()).filter(Boolean);
  return parts;
}

/**
 * Generate flowchart nodes and arrows from text
 * Returns: { nodes: [], arrows: [] }
 */
export function generateFlowchart(text, options = {}) {
  const { color = '#6366f1', startX = START_X, startY = START_Y } = options;
  const labels = parseFlowchartText(text);

  if (labels.length === 0) {
    return { nodes: [], arrows: [] };
  }

  const nodes = [];
  const arrows = [];

  // Layout: simple vertical flow with branching for decisions
  let x = startX;
  let y = startY;

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const { type, shape } = detectNodeType(label);
    const nodeColor = SHAPE_COLORS[type] || color;

    const node = {
      id: `node_${i}`,
      label,
      type,
      shape,
      x: x + NODE_WIDTH / 2,
      y: y + NODE_HEIGHT / 2,
      width: shape === 'diamond' ? NODE_WIDTH + 20 : NODE_WIDTH,
      height: shape === 'diamond' ? NODE_HEIGHT + 20 : NODE_HEIGHT,
      color: nodeColor,
    };

    nodes.push(node);

    if (i > 0) {
      const prev = nodes[i - 1];
      arrows.push({
        id: `arrow_${i - 1}_${i}`,
        x0: prev.x,
        y0: prev.y + prev.height / 2,
        x1: node.x,
        y1: node.y - node.height / 2,
        color: '#94a3b8',
      });
    }

    y += NODE_HEIGHT + V_GAP;

    // After 4 nodes, start a new column
    if ((i + 1) % 6 === 0) {
      x += NODE_WIDTH + H_GAP * 2;
      y = startY;
    }
  }

  return { nodes, arrows };
}

/**
 * Draw flowchart onto canvas context
 */
export function drawFlowchart(ctx, { nodes, arrows }, canvasHelpers) {
  const { drawArrow, drawRect, drawDiamond, drawRoundedRect, drawText } = canvasHelpers;

  // Draw arrows first (behind nodes)
  arrows.forEach((arrow) => {
    drawArrow(ctx, arrow);
  });

  // Draw nodes
  nodes.forEach((node) => {
    const hw = node.width / 2;
    const hh = node.height / 2;

    if (node.shape === 'diamond') {
      drawDiamond(ctx, {
        x: node.x, y: node.y,
        width: node.width, height: node.height,
        color: node.color, fill: true, lineWidth: 2,
      });
    } else if (node.shape === 'roundedRect') {
      drawRoundedRect(ctx, {
        x: node.x, y: node.y,
        width: node.width, height: node.height,
        color: node.color, fill: true, lineWidth: 2, radius: 25,
      });
    } else {
      drawRect(ctx, {
        x: node.x - hw, y: node.y - hh,
        width: node.width, height: node.height,
        color: node.color, fill: true, lineWidth: 2,
      });
    }

    // Draw label
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Wrap long text
    const maxWidth = node.width - 12;
    const words = node.label.split(' ');
    let line = '';
    let lineY = node.y - (words.length > 2 ? 8 : 0);

    words.forEach((word, wi) => {
      const testLine = line + (line ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && wi > 0) {
        ctx.fillText(line, node.x, lineY);
        line = word;
        lineY += 16;
      } else {
        line = testLine;
      }
    });
    ctx.fillText(line, node.x, lineY);
    ctx.restore();
  });
}
