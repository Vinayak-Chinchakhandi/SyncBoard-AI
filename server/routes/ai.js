const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'syncboard_secret';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * POST /api/ai/summary
 * Accepts { image: base64DataURL, meta: { roomCode, userCount, shapeCount } }
 * Uses Gemini Vision API if key is available, fallback to local summary
 */
router.post('/summary', authMiddleware, async (req, res) => {
  const { image, meta = {} } = req.body;

  if (!GEMINI_API_KEY) {
    // Fallback — local rule-based summary
    return res.json({
      summary: buildLocalSummary(meta),
    });
  }

  try {
    // Gemini 1.5 Flash Vision API
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are analyzing a collaborative whiteboard. Provide a concise summary (3-5 sentences) of what is drawn on this board. Include: main topics/diagrams visible, types of shapes/content, and potential use case. Room: ${meta.roomCode}, Users: ${meta.userCount}, Elements: ${meta.shapeCount}.`,
                },
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 300,
            temperature: 0.4,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      console.error('[AI] Gemini API error:', err);
      return res.json({ summary: buildLocalSummary(meta) });
    }

    const result = await response.json();
    const summary =
      result.candidates?.[0]?.content?.parts?.[0]?.text ||
      buildLocalSummary(meta);

    res.json({ summary });
  } catch (err) {
    console.error('[AI] Summary error:', err);
    res.json({ summary: buildLocalSummary(meta) });
  }
});

function buildLocalSummary(meta) {
  const { userCount = 1, shapeCount = 0, roomCode = 'N/A' } = meta;
  return (
    `📋 Board Summary\n\n` +
    `Room: ${roomCode}\n` +
    `Active Users: ${userCount}\n` +
    `Elements on Board: ${shapeCount}\n\n` +
    `This collaborative board has ${shapeCount} element(s) drawn by ${userCount} active user(s). ` +
    `To enable AI-powered visual analysis, add your GEMINI_API_KEY to the server .env file.`
  );
}

module.exports = router;
