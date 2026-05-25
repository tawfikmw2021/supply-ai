import { Router, Response } from 'express';
import { getAccountDb } from '../accountDb';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import * as audit from '../audit';

const router = Router();

router.get('/', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  res.json({ clients: db.prepare('SELECT * FROM clients ORDER BY id DESC').all() });
});

router.post('/', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { name, email = '', phone = '', address = '', notes = '' } = req.body;
  if (!name) { res.status(400).json({ message: 'name is required' }); return; }
  const db = getAccountDb(req.accountId!);
  const r = db.prepare(
    'INSERT INTO clients (name, email, phone, address, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(name, email, phone, address, notes) as { lastInsertRowid: number };
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(r.lastInsertRowid);
  audit.log(req, 'clients', 'INSERT', r.lastInsertRowid, client);
  res.status(201).json({ client });
});

router.put('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  if (!db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id)) {
    res.status(404).json({ message: 'Client not found' }); return;
  }
  const { name, email, phone, address, notes } = req.body;
  db.prepare(`
    UPDATE clients SET
      name    = COALESCE(?, name),
      email   = COALESCE(?, email),
      phone   = COALESCE(?, phone),
      address = COALESCE(?, address),
      notes   = COALESCE(?, notes)
    WHERE id = ?
  `).run(name ?? null, email ?? null, phone ?? null, address ?? null, notes ?? null, req.params.id);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  audit.log(req, 'clients', 'UPDATE', Number(req.params.id), client);
  res.json({ client });
});

router.delete('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) { res.status(404).json({ message: 'Client not found' }); return; }
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  audit.log(req, 'clients', 'DELETE', Number(req.params.id), { deleted: client });
  res.status(204).send();
});

export default router;
