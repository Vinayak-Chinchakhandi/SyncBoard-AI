const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
    runMigrations();
  }
  return db;
}

function initSchema() {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
  console.log('[DB] Schema initialized');
}

// Safe migrations — add new columns if they don't exist
function runMigrations() {
  try {
    const cols = db.pragma('table_info(boards)').map((c) => c.name);
    if (!cols.includes('canvas_data')) {
      db.exec("ALTER TABLE boards ADD COLUMN canvas_data TEXT DEFAULT '[]'");
      console.log('[DB] Migration: added canvas_data column');
    }
  } catch (err) {
    console.error('[DB] Migration error:', err.message);
  }
}

module.exports = { getDb };

