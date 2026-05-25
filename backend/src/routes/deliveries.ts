import { Router, Response } from 'express';
import { getAccountDb } from '../accountDb';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const VALID_STATUSES = ['pending', 'in_transit', 'delivered', 'cancelled'];
const VALID_TYPES    = ['inbound', 'outbound'];

function enrich(db: any, row: any) {
  if (!row) return null;
  if (row.supplier_id) {
    const s = db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(row.supplier_id);
    row.supplier_name = s?.name ?? null;
  }
  if (row.client_id) {
    const c = db.prepare('SELECT id, name FROM clients WHERE id = ?').get(row.client_id);
    row.client_name = c?.name ?? null;
  }
  return row;
}

// GET /deliveries
router.get('/', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const rows = (db.prepare('SELECT * FROM deliveries ORDER BY created_at DESC').all() as any[])
    .map(r => enrich(db, r));
  res.json({ deliveries: rows });
});

// GET /deliveries/:id
router.get('/:id', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const row = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(Number(req.params.id)) as any;
  if (!row) { res.status(404).json({ message: 'Not found' }); return; }
  res.json({ delivery: enrich(db, row) });
});

// POST /deliveries
router.post('/', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { reference = '', type = 'inbound', supplier_id = null, client_id = null,
          status = 'pending', expected_date = null, delivered_at = null, notes = '' } = req.body;
  if (!VALID_TYPES.includes(type))    { res.status(400).json({ message: 'type invalide' }); return; }
  if (!VALID_STATUSES.includes(status)) { res.status(400).json({ message: 'status invalide' }); return; }
  const db = getAccountDb(req.accountId!);
  const result = db.prepare(
    `INSERT INTO deliveries (reference, type, supplier_id, client_id, status, expected_date, delivered_at, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(reference, type, supplier_id, client_id, status, expected_date, delivered_at, notes) as any;
  const row = enrich(db, db.prepare('SELECT * FROM deliveries WHERE id = ?').get(Number(result.lastInsertRowid)));
  res.status(201).json({ delivery: row });
});

// PUT /deliveries/:id
router.put('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const existing = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(Number(req.params.id)) as any;
  if (!existing) { res.status(404).json({ message: 'Not found' }); return; }
  const { reference, type, supplier_id, client_id, status, expected_date, delivered_at, notes } = req.body;
  if (type   && !VALID_TYPES.includes(type))      { res.status(400).json({ message: 'type invalide' }); return; }
  if (status && !VALID_STATUSES.includes(status)) { res.status(400).json({ message: 'status invalide' }); return; }
  db.prepare(
    `UPDATE deliveries SET reference=?, type=?, supplier_id=?, client_id=?, status=?,
     expected_date=?, delivered_at=?, notes=? WHERE id=?`
  ).run(
    reference    ?? existing.reference,
    type         ?? existing.type,
    supplier_id  !== undefined ? supplier_id  : existing.supplier_id,
    client_id    !== undefined ? client_id    : existing.client_id,
    status       ?? existing.status,
    expected_date !== undefined ? expected_date : existing.expected_date,
    delivered_at  !== undefined ? delivered_at  : existing.delivered_at,
    notes        ?? existing.notes,
    Number(req.params.id),
  );
  const row = enrich(db, db.prepare('SELECT * FROM deliveries WHERE id = ?').get(Number(req.params.id)));
  res.json({ delivery: row });
});

// DELETE /deliveries/:id
router.delete('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  if (!db.prepare('SELECT id FROM deliveries WHERE id = ?').get(Number(req.params.id))) {
    res.status(404).json({ message: 'Not found' }); return;
  }
  db.prepare('DELETE FROM deliveries WHERE id = ?').run(Number(req.params.id));
  res.json({ message: 'deleted' });
});

export default router;
