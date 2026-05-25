import { Router, Response } from 'express';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import { getAccountDb } from '../accountDb';

const router = Router();

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  order: number;
  width?: string;
}

interface StoredSettings {
  columns: ColumnConfig[];
  hidden?: boolean;
}

function parseStored(raw: string): StoredSettings {
  const parsed = JSON.parse(raw);
  // Legacy format: plain array — was saved before hidden flag existed, treat as visible
  if (Array.isArray(parsed)) return { columns: parsed, hidden: false };
  return { columns: parsed.columns ?? [], hidden: parsed.hidden ?? true };
}

// GET /column-settings — all tables (hidden flags only, for sidebar filtering)
router.get('/', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db   = getAccountDb(req.accountId!);
  const rows = db.prepare('SELECT table_name, settings FROM column_settings').all() as { table_name: string; settings: string }[];
  const result: Record<string, boolean> = {};
  for (const row of rows) {
    const { hidden } = parseStored(row.settings);
    result[row.table_name] = hidden ?? true;
  }
  res.json({ tables: result });
});

// GET /column-settings/:table
router.get('/:table', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db  = getAccountDb(req.accountId!);
  const row = db.prepare('SELECT settings FROM column_settings WHERE table_name = ?')
    .get(req.params.table) as { settings: string } | undefined;
  const { columns, hidden } = row ? parseStored(row.settings) : { columns: [], hidden: false };
  res.json({ columns, hidden });
});

// PUT /column-settings/:table
router.put('/:table', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { table } = req.params;
  const { columns, hidden = false } = req.body as { columns: ColumnConfig[]; hidden?: boolean };
  if (!Array.isArray(columns)) { res.status(400).json({ message: 'columns must be an array' }); return; }
  const db = getAccountDb(req.accountId!);
  const payload: StoredSettings = { columns, hidden };
  db.prepare(`
    INSERT INTO column_settings (table_name, settings, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(table_name) DO UPDATE SET settings = excluded.settings, updated_at = excluded.updated_at
  `).run(table, JSON.stringify(payload));
  res.json({ ok: true });
});

export default router;
