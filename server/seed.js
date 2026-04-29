/**
 * seed.js — Seed demo users into the SQLite database
 * Run once: node seed.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getDb } = require('./db/db');

const DEMO_USERS = [
  { username: 'demouser',  password: 'password' },
  { username: 'testuser',  password: 'password' },
  { username: 'newuser',   password: 'password' },
];

async function seed() {
  const db = getDb();
  console.log('[SEED] Starting...');

  for (const { username, password } of DEMO_USERS) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      // Update password hash in case it changed
      const hash = await bcrypt.hash(password, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, username);
      console.log(`[SEED] Updated: ${username}`);
    } else {
      const hash = await bcrypt.hash(password, 10);
      db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
      console.log(`[SEED] Created: ${username}`);
    }
  }

  console.log('[SEED] Done. Demo users: demouser/password, testuser/password, newuser/password');
  process.exit(0);
}

seed().catch((err) => { console.error('[SEED] Error:', err); process.exit(1); });
