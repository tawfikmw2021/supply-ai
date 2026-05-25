import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getAccountDb } from '../accountDb';

const router = Router();
router.use(authMiddleware);

function db(req: AuthRequest) { return getAccountDb(req.accountId!); }

const OPERATORS: Record<string, (a: number, b: number) => boolean> = {
  '>':  (a, b) => a > b,
  '<':  (a, b) => a < b,
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
  '=':  (a, b) => a === b,
  '!=': (a, b) => a !== b,
};

// GET /alerts
router.get('/', (req: AuthRequest, res: Response) => {
  res.json(db(req).prepare('SELECT * FROM alerts ORDER BY id DESC').all());
});

// POST /alerts
router.post('/', (req: AuthRequest, res: Response): void => {
  const { name, query, operator, threshold, severity, message, active } = req.body;
  if (!name || !query) { res.status(400).json({ message: 'name and query are required' }); return; }

  // Validate query
  try { db(req).prepare(query).get(); } catch (e: any) {
    res.status(400).json({ message: `Invalid query: ${e.message}` }); return;
  }

  const r = db(req).prepare(
    `INSERT INTO alerts (name, query, operator, threshold, severity, message, active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(name, query, operator ?? '>', threshold ?? 0, severity ?? 'warning', message ?? '', active ?? 1) as any;

  res.status(201).json(db(req).prepare('SELECT * FROM alerts WHERE id = ?').get(r.lastInsertRowid));
});

// PUT /alerts/:id
router.put('/:id', (req: AuthRequest, res: Response): void => {
  const { name, query, operator, threshold, severity, message, active } = req.body;
  const existing = db(req).prepare('SELECT id FROM alerts WHERE id = ?').get(Number(req.params.id));
  if (!existing) { res.status(404).json({ message: 'Not found' }); return; }

  if (query) {
    try { db(req).prepare(query).get(); } catch (e: any) {
      res.status(400).json({ message: `Invalid query: ${e.message}` }); return;
    }
  }

  db(req).prepare(
    `UPDATE alerts SET name=COALESCE(?,name), query=COALESCE(?,query), operator=COALESCE(?,operator),
     threshold=COALESCE(?,threshold), severity=COALESCE(?,severity), message=COALESCE(?,message),
     active=COALESCE(?,active) WHERE id=?`
  ).run(name ?? null, query ?? null, operator ?? null, threshold ?? null, severity ?? null,
        message ?? null, active ?? null, Number(req.params.id));

  res.json(db(req).prepare('SELECT * FROM alerts WHERE id = ?').get(Number(req.params.id)));
});

// DELETE /alerts/:id
router.delete('/:id', (req: AuthRequest, res: Response): void => {
  db(req).prepare('DELETE FROM alerts WHERE id = ?').run(Number(req.params.id));
  res.status(204).end();
});

// GET /alerts/evaluate — run all active alerts and return triggered ones
router.get('/evaluate', (req: AuthRequest, res: Response) => {
  const rules = db(req).prepare('SELECT * FROM alerts WHERE active = 1').all() as any[];
  const triggered = [];

  for (const rule of rules) {
    try {
      const row = db(req).prepare(rule.query).get() as any;
      const value = row ? Number(Object.values(row)[0]) : 0;
      const fn = OPERATORS[rule.operator] ?? OPERATORS['>'];
      if (fn(value, rule.threshold)) {
        triggered.push({ ...rule, value });
      }
    } catch {
      // skip broken queries silently
    }
  }

  res.json(triggered);
});

export default router;
