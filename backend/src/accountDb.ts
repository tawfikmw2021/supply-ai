import Database from 'better-sqlite3';
import path from 'path';

const cache = new Map<number, Database.Database>();

export const DB_DIR = process.env.DATA_DIR ?? path.join(__dirname, '..', 'data');

export function getAccountDb(accountId: number): Database.Database {
  if (cache.has(accountId)) return cache.get(accountId)!;

  const db = new Database(path.join(DB_DIR, `account_${accountId}.sqlite`));

  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      properties TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      manufacturer TEXT NOT NULL DEFAULT '',
      code TEXT NOT NULL DEFAULT '',
      sale_price REAL NOT NULL DEFAULT 0,
      vat REAL NOT NULL DEFAULT 20,
      barcode TEXT NOT NULL DEFAULT '',
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('client','supplier')),
      reference TEXT NOT NULL DEFAULT '',
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      date TEXT NOT NULL DEFAULT (date('now')),
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','cancelled')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL DEFAULT '',
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0
    );

  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS loaders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      file_format TEXT NOT NULL DEFAULT 'csv',
      delimiter TEXT NOT NULL DEFAULT ',',
      has_header INTEGER NOT NULL DEFAULT 1,
      target_table TEXT NOT NULL DEFAULT 'products',
      upsert_key TEXT NOT NULL DEFAULT '',
      on_conflict TEXT NOT NULL DEFAULT 'skip',
      mapping TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS dashboard_widgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'Widget',
      chart_type TEXT NOT NULL DEFAULT 'bar',
      query TEXT NOT NULL DEFAULT '',
      config TEXT NOT NULL DEFAULT '{}',
      position INTEGER NOT NULL DEFAULT 0,
      width TEXT NOT NULL DEFAULT 'half',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'inbound' CHECK(type IN ('inbound','outbound')),
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_transit','delivered','cancelled')),
      expected_date TEXT,
      delivered_at TEXT,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS help (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'task',
      message TEXT NOT NULL,
      user_id INTEGER,
      user_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Migrate: add columns to help if absent
  const helpCols = db.prepare('PRAGMA table_info(help)').all() as any[];
  if (!helpCols.some((c: any) => c.name === 'attachments')) {
    db.exec("ALTER TABLE help ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]'");
  }
  if (!helpCols.some((c: any) => c.name === 'page_url')) {
    db.exec("ALTER TABLE help ADD COLUMN page_url TEXT NOT NULL DEFAULT ''");
  }
  if (!helpCols.some((c: any) => c.name === 'remarks')) {
    db.exec("ALTER TABLE help ADD COLUMN remarks TEXT NOT NULL DEFAULT ''");
  }
  if (!helpCols.some((c: any) => c.name === 'details')) {
    db.exec("ALTER TABLE help ADD COLUMN details TEXT NOT NULL DEFAULT ''");
  }

  // Migrate: add columns to products if absent
  const productCols = db.prepare('PRAGMA table_info(products)').all() as any[];
  if (!productCols.some((c: any) => c.name === 'manufacturer')) {
    db.exec("ALTER TABLE products ADD COLUMN manufacturer TEXT NOT NULL DEFAULT ''");
  }
  if (!productCols.some((c: any) => c.name === 'code')) {
    db.exec("ALTER TABLE products ADD COLUMN code TEXT NOT NULL DEFAULT ''");
  }
  if (!productCols.some((c: any) => c.name === 'sale_price')) {
    db.exec('ALTER TABLE products ADD COLUMN sale_price REAL NOT NULL DEFAULT 0');
  }
  if (!productCols.some((c: any) => c.name === 'vat')) {
    db.exec('ALTER TABLE products ADD COLUMN vat REAL NOT NULL DEFAULT 20');
  }
  if (!productCols.some((c: any) => c.name === 'barcode')) {
    db.exec("ALTER TABLE products ADD COLUMN barcode TEXT NOT NULL DEFAULT ''");
  }
  if (!productCols.some((c: any) => c.name === 'supplier_id')) {
    db.exec('ALTER TABLE products ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'in' CHECK(type IN ('in','out','adjustment')),
      quantity REAL NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      user_name TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6c63ff',
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      query TEXT NOT NULL,
      operator TEXT NOT NULL DEFAULT '>' CHECK(operator IN ('>','<','>=','<=','=','!=')),
      threshold REAL NOT NULL DEFAULT 0,
      severity TEXT NOT NULL DEFAULT 'warning' CHECK(severity IN ('info','warning','danger')),
      message TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS column_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL UNIQUE,
      settings TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  ensureTemplatesTable(db);

  cache.set(accountId, db);
  return db;
}

function ensureTemplatesTable(db: Database.Database): void {
  const cols = db.prepare('PRAGMA table_info(templates)').all() as any[];

  if (cols.length === 0) {
    db.exec(`
      CREATE TABLE templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'both' CHECK(type IN ('client','supplier','both')),
        is_default_client INTEGER NOT NULL DEFAULT 0,
        is_default_supplier INTEGER NOT NULL DEFAULT 0,
        html TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    return;
  }

  if (!cols.some((c: any) => c.name === 'key')) return; // already new schema

  // Migrate old key-based schema
  const oldRows = db.prepare('SELECT * FROM templates').all() as any[];
  db.exec('DROP TABLE templates');
  db.exec(`
    CREATE TABLE templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'both' CHECK(type IN ('client','supplier','both')),
      is_default_client INTEGER NOT NULL DEFAULT 0,
      is_default_supplier INTEGER NOT NULL DEFAULT 0,
      html TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  const ins = db.prepare(
    'INSERT INTO templates (name, type, is_default_client, is_default_supplier, html) VALUES (?, ?, 0, 0, ?)'
  );
  for (const row of oldRows) ins.run(row.name ?? row.key, 'both', row.html);
}
