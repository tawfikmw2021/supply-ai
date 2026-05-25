import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'data.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    account_id INTEGER,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    record_id INTEGER,
    data TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    properties TEXT NOT NULL DEFAULT '{"currency":"EUR"}',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    account_id INTEGER REFERENCES accounts(id),
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── column migrations ────────────────────────────────────────────────────────
try { db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`); } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN account_id INTEGER REFERENCES accounts(id)`); } catch {}

// ── seed a default account for existing users with no account ────────────────
const unassigned = db.prepare('SELECT COUNT(*) as c FROM users WHERE account_id IS NULL').get() as { c: number };
if (unassigned.c > 0) {
  let defaultAccount = db.prepare('SELECT id FROM accounts LIMIT 1').get() as { id: number } | undefined;
  if (!defaultAccount) {
    const r = db.prepare(`INSERT INTO accounts (name, properties) VALUES ('Default', '{"currency":"EUR"}')`).run() as { lastInsertRowid: number };
    defaultAccount = { id: r.lastInsertRowid };
  }
  db.prepare('UPDATE users SET account_id = ? WHERE account_id IS NULL').run(defaultAccount.id);
}

export default db;
