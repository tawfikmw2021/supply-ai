import { Router, Response } from 'express';
import { getAccountDb } from '../accountDb';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import { getAccountPool, pgQuery } from '../clientDb';

const router = Router();

const QUERY_LIMIT = 2000;

function parseWidget(row: any) {
  if (!row) return null;
  try { row.config = JSON.parse(row.config); } catch { row.config = {}; }
  return row;
}

function validateQuery(query: string): string | null {
  const norm = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!norm.startsWith('select') && !norm.startsWith('with')) {
    return 'Only SELECT queries are allowed';
  }
  const forbidden = [/\bdrop\b/, /\bdelete\b/, /\binsert\b/, /\bupdate\b/, /\balter\b/, /\btruncate\b/];
  for (const re of forbidden) {
    if (re.test(norm)) return 'Query contains forbidden operations';
  }
  return null;
}

// GET /dashboard/schema — available tables and columns (admin only)
router.get('/schema', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all() as { name: string }[];

  const schema = tables.map(({ name }) => ({
    name,
    columns: (db.prepare(`PRAGMA table_info("${name}")`).all() as any[]).map(c => ({
      name: c.name,
      type: c.type || 'TEXT',
    })),
  }));
  res.json({ schema });
});

// GET /dashboard/widgets — list all widgets (no query data, just metadata + config)
router.get('/widgets', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const rows = db.prepare(
    'SELECT id, title, chart_type, query, config, position, width, created_at, updated_at FROM dashboard_widgets ORDER BY position, id'
  ).all() as any[];
  res.json({ widgets: rows.map(parseWidget) });
});

// GET /dashboard/widgets/:id/data — run query and return rows
router.get('/widgets/:id/data', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const db = getAccountDb(req.accountId!);
  const pool = getAccountPool(req.accountId!);
  const widget = db.prepare('SELECT * FROM dashboard_widgets WHERE id = ?').get(Number(req.params.id)) as any;
  if (!widget) { res.status(404).json({ message: 'Widget not found' }); return; }

  const err = validateQuery(widget.query);
  if (err || !widget.query.trim()) { res.json({ rows: [] }); return; }

  try {
    const q = widget.query.trim();
    const withLimit = /\blimit\b/i.test(q) ? q : `${q} LIMIT ${QUERY_LIMIT}`;
    const pool = getAccountPool(req.accountId!);

    const rows = await pgQuery(withLimit, [], pool);
    res.json({ rows });
  } catch (e: any) {
    res.status(400).json({ message: e.message ?? 'Query error' });
  }
});

// POST /dashboard/preview — run an ad-hoc query (admin only)
router.post('/preview', adminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { query } = req.body;
  if (!query?.trim()) { res.status(400).json({ message: 'query is required' }); return; }

  const err = validateQuery(query);
  if (err) { res.status(400).json({ message: err }); return; }

  const pool = getAccountPool(req.accountId!);
  
  const db = getAccountDb(req.accountId!);
  try {
      const rows = await pgQuery(query, [], pool);

    //const rows = db.prepare(`${query.trim()} LIMIT ${QUERY_LIMIT}`).all();
    res.json({ rows });
  } catch (e: any) {
    res.status(400).json({ message: e.message ?? 'Query error' });
  }
});

// POST /dashboard/widgets — create widget
router.post('/widgets', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { title = 'Widget', chart_type = 'bar', query = '', config = {}, width = 'half' } = req.body;
  const db = getAccountDb(req.accountId!);
  const maxPos = (db.prepare('SELECT MAX(position) as m FROM dashboard_widgets').get() as any)?.m ?? -1;
  const result = db.prepare(
    `INSERT INTO dashboard_widgets (title, chart_type, query, config, position, width) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(title, chart_type, query, JSON.stringify(config), maxPos + 1, width) as any;
  const widget = parseWidget(db.prepare('SELECT * FROM dashboard_widgets WHERE id = ?').get(Number(result.lastInsertRowid)));
  res.status(201).json({ widget });
});

// PUT /dashboard/widgets/positions — bulk reorder
router.put('/widgets/positions', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { positions } = req.body as { positions: { id: number; position: number }[] };
  if (!Array.isArray(positions)) { res.status(400).json({ message: 'positions must be an array' }); return; }
  const db = getAccountDb(req.accountId!);
  const stmt = db.prepare("UPDATE dashboard_widgets SET position = ? WHERE id = ?");
  for (const { id, position } of positions) stmt.run(position, id);
  res.json({ ok: true });
});

// PUT /dashboard/widgets/:id — update widget
router.put('/widgets/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { title, chart_type, query, config, width } = req.body;
  const db = getAccountDb(req.accountId!);
  const existing = db.prepare('SELECT * FROM dashboard_widgets WHERE id = ?').get(Number(req.params.id)) as any;
  if (!existing) { res.status(404).json({ message: 'Widget not found' }); return; }

  db.prepare(
    `UPDATE dashboard_widgets SET title=?, chart_type=?, query=?, config=?, width=?, updated_at=datetime('now') WHERE id=?`
  ).run(
    title ?? existing.title,
    chart_type ?? existing.chart_type,
    query ?? existing.query,
    config !== undefined ? JSON.stringify(config) : existing.config,
    width ?? existing.width,
    Number(req.params.id),
  );
  const widget = parseWidget(db.prepare('SELECT * FROM dashboard_widgets WHERE id = ?').get(Number(req.params.id)));
  res.json({ widget });
});

// DELETE /dashboard/widgets/:id
router.delete('/widgets/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const existing = db.prepare('SELECT id FROM dashboard_widgets WHERE id = ?').get(Number(req.params.id));
  if (!existing) { res.status(404).json({ message: 'Widget not found' }); return; }
  db.prepare('DELETE FROM dashboard_widgets WHERE id = ?').run(Number(req.params.id));
  res.json({ message: 'deleted' });
});

export default router;
