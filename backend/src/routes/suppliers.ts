import { Router, Response } from 'express';
import { getAccountDb } from '../accountDb';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import * as audit from '../audit';

const router = Router();

router.get('/', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  res.json({ suppliers: db.prepare('SELECT * FROM suppliers ORDER BY id DESC').all() });
});

router.post('/', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { name, email = '', phone = '', address = '', category = '', notes = '' } = req.body;
  if (!name) { res.status(400).json({ message: 'name is required' }); return; }
  const db = getAccountDb(req.accountId!);
  const r = db.prepare(
    'INSERT INTO suppliers (name, email, phone, address, category, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, email, phone, address, category, notes) as { lastInsertRowid: number };
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(r.lastInsertRowid);
  audit.log(req, 'suppliers', 'INSERT', r.lastInsertRowid, supplier);
  res.status(201).json({ supplier });
});

router.put('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  if (!db.prepare('SELECT id FROM suppliers WHERE id = ?').get(req.params.id)) {
    res.status(404).json({ message: 'Supplier not found' }); return;
  }
  const { name, email, phone, address, category, notes } = req.body;
  db.prepare(`
    UPDATE suppliers SET
      name     = COALESCE(?, name),
      email    = COALESCE(?, email),
      phone    = COALESCE(?, phone),
      address  = COALESCE(?, address),
      category = COALESCE(?, category),
      notes    = COALESCE(?, notes)
    WHERE id = ?
  `).run(name ?? null, email ?? null, phone ?? null, address ?? null, category ?? null, notes ?? null, req.params.id);
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  audit.log(req, 'suppliers', 'UPDATE', Number(req.params.id), supplier);
  res.json({ supplier });
});

router.delete('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) { res.status(404).json({ message: 'Supplier not found' }); return; }
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  audit.log(req, 'suppliers', 'DELETE', Number(req.params.id), { deleted: supplier });
  res.status(204).send();
});

export default router;
