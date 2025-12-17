import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../db/donations.db');

let db: Database;

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create donations table
  db.run(`
    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      reference TEXT,
      premium_word_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Migration: Add premium_word_id column if it doesn't exist
  try {
    db.run(`ALTER TABLE donations ADD COLUMN premium_word_id TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add email column if it doesn't exist
  try {
    db.run(`ALTER TABLE donations ADD COLUMN email TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Create index for chronological ordering
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at)
  `);

  // Create config table (singleton)
  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      goal_amount INTEGER NOT NULL DEFAULT 10000000,
      preset_amounts TEXT NOT NULL DEFAULT '[1800,3600,18000,36000,100000]',
      menorah_segments TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Insert default config if not exists
  db.run(`INSERT OR IGNORE INTO config (id) VALUES (1)`);

  // Save to file
  saveDatabase();

  console.log('Database initialized successfully');
}

export function getDb(): Database {
  return db;
}

export function saveDatabase(): void {
  const data = db.export();
  const buffer = Buffer.from(data);

  // Ensure directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(DB_PATH, buffer);
}
