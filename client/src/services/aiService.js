/**
 * aiService.js — AI feature service layer
 * Priority: Rule-based first → LLM fallback
 */

import { generateFlowchart } from '../utils/flowchartGenerator';

const API_BASE = '/api';

// ─────────────────────────────────────────────────────────────────────────────
// FLOWCHART GENERATION — Rule-based
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate flowchart from text (rule-based)
 * @param {string} text
 * @param {object} options - { color, startX, startY }
 * @returns {{ nodes, arrows }}
 */
export function generateFlowchartFromText(text, options = {}) {
  return generateFlowchart(text, options);
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGRAM TEMPLATES — Predefined templates
// ─────────────────────────────────────────────────────────────────────────────

const DIAGRAM_TEMPLATES = {
  login: {
    name: 'Login Flow',
    nodes: [
      { label: 'Start', shape: 'roundedRect', type: 'terminal', x: 200, y: 60, width: 120, height: 44, color: '#06b6d4' },
      { label: 'Show Login Form', shape: 'rect', type: 'process', x: 200, y: 160, width: 160, height: 44, color: '#6366f1' },
      { label: 'Valid Credentials?', shape: 'diamond', type: 'decision', x: 200, y: 270, width: 180, height: 60, color: '#f59e0b' },
      { label: 'Grant Access', shape: 'rect', type: 'process', x: 340, y: 380, width: 140, height: 44, color: '#10b981' },
      { label: 'Show Error', shape: 'rect', type: 'process', x: 60, y: 380, width: 120, height: 44, color: '#ef4444' },
      { label: 'End', shape: 'roundedRect', type: 'terminal', x: 200, y: 480, width: 120, height: 44, color: '#06b6d4' },
    ],
    arrows: [
      { x0: 200, y0: 82, x1: 200, y1: 138, color: '#94a3b8' },
      { x0: 200, y0: 182, x1: 200, y1: 240, color: '#94a3b8' },
      { x0: 290, y0: 270, x1: 340, y1: 358, color: '#10b981' },
      { x0: 110, y0: 270, x1: 60, y1: 358, color: '#ef4444' },
      { x0: 340, y0: 402, x1: 200, y1: 458, color: '#94a3b8' },
    ],
  },
  api: {
    name: 'REST API Flow',
    nodes: [
      { label: 'Client Request', shape: 'roundedRect', type: 'terminal', x: 200, y: 60, width: 140, height: 44, color: '#06b6d4' },
      { label: 'Auth Middleware', shape: 'rect', type: 'process', x: 200, y: 155, width: 150, height: 44, color: '#8b5cf6' },
      { label: 'Authorized?', shape: 'diamond', type: 'decision', x: 200, y: 255, width: 160, height: 55, color: '#f59e0b' },
      { label: 'Route Handler', shape: 'rect', type: 'process', x: 310, y: 355, width: 140, height: 44, color: '#6366f1' },
      { label: '401 Unauthorized', shape: 'rect', type: 'process', x: 60, y: 355, width: 140, height: 44, color: '#ef4444' },
      { label: 'Database Query', shape: 'rect', type: 'process', x: 310, y: 450, width: 140, height: 44, color: '#6366f1' },
      { label: 'Send Response', shape: 'roundedRect', type: 'terminal', x: 200, y: 545, width: 140, height: 44, color: '#06b6d4' },
    ],
    arrows: [
      { x0: 200, y0: 82, x1: 200, y1: 133, color: '#94a3b8' },
      { x0: 200, y0: 177, x1: 200, y1: 227, color: '#94a3b8' },
      { x0: 280, y0: 255, x1: 310, y1: 333, color: '#10b981' },
      { x0: 120, y0: 255, x1: 60, y1: 333, color: '#ef4444' },
      { x0: 310, y0: 377, x1: 310, y1: 428, color: '#94a3b8' },
      { x0: 310, y0: 472, x1: 200, y1: 523, color: '#94a3b8' },
    ],
  },
  user_journey: {
    name: 'User Journey',
    nodes: [
      { label: 'Discover', shape: 'roundedRect', type: 'terminal', x: 80, y: 200, width: 110, height: 44, color: '#6366f1' },
      { label: 'Sign Up', shape: 'rect', type: 'process', x: 230, y: 200, width: 110, height: 44, color: '#8b5cf6' },
      { label: 'Onboarding', shape: 'rect', type: 'process', x: 380, y: 200, width: 120, height: 44, color: '#06b6d4' },
      { label: 'Core Feature', shape: 'rect', type: 'process', x: 530, y: 200, width: 130, height: 44, color: '#10b981' },
      { label: 'Retention', shape: 'roundedRect', type: 'terminal', x: 680, y: 200, width: 120, height: 44, color: '#f59e0b' },
    ],
    arrows: [
      { x0: 135, y0: 222, x1: 175, y1: 222, color: '#94a3b8' },
      { x0: 285, y0: 222, x1: 325, y1: 222, color: '#94a3b8' },
      { x0: 440, y0: 222, x1: 475, y1: 222, color: '#94a3b8' },
      { x0: 595, y0: 222, x1: 635, y1: 222, color: '#94a3b8' },
    ],
  },
};

/**
 * Get predefined diagram template
 * @param {string} type - 'login' | 'api' | 'user_journey'
 * @returns {{ nodes, arrows, name }}
 */
export function getDiagramTemplate(type) {
  return DIAGRAM_TEMPLATES[type] || null;
}

export function listDiagramTemplates() {
  return Object.entries(DIAGRAM_TEMPLATES).map(([key, val]) => ({
    key,
    name: val.name,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART ALIGNMENT — Grid snapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Align all nodes in a diagram to a grid
 * @param {Array} nodes
 * @param {number} gridSize
 * @returns {Array} snapped nodes
 */
export function smartAlignNodes(nodes, gridSize = 20) {
  return nodes.map((node) => ({
    ...node,
    x: Math.round(node.x / gridSize) * gridSize,
    y: Math.round(node.y / gridSize) * gridSize,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// BOARD SUMMARY — LLM-based (Gemini API via backend)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate board summary using Gemini API (via backend proxy)
 * Falls back to a local rule-based summary if API fails
 * @param {string} canvasDataURL - base64 PNG of canvas
 * @param {Object} meta - { roomCode, userCount, shapeCount }
 * @returns {Promise<string>} summary text
 */
export async function generateBoardSummary(canvasDataURL, meta = {}) {
  try {
    const response = await fetch(`${API_BASE}/ai/summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ image: canvasDataURL, meta }),
    });

    if (!response.ok) throw new Error('API failed');
    const data = await response.json();
    return data.summary;
  } catch (err) {
    console.warn('[AI] Summary API failed, using fallback:', err.message);
    // Rule-based fallback
    return generateLocalSummary(meta);
  }
}

function generateLocalSummary(meta) {
  const { userCount = 1, shapeCount = 0, roomCode } = meta;
  return (
    `📋 Board Summary\n\n` +
    `Room: ${roomCode || 'Unknown'}\n` +
    `Active Users: ${userCount}\n` +
    `Elements on Board: ${shapeCount}\n\n` +
    `This board contains collaborative drawings with ${shapeCount} elements created by ${userCount} user(s). ` +
    `Connect a Gemini API key for AI-powered visual analysis.`
  );
}
