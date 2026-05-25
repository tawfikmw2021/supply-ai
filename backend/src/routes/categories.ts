import { Router, Response } from 'express';
import { getAccountDb } from '../accountDb';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  res.json({ categories: db.prepare('SELECT * FROM product_categories ORDER BY name ASC').all() });
});

router.post('/', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { name, color, description } = req.body;
  if (!name) { res.status(400).json({ message: 'name is required' }); return; }
  const db = getAccountDb(req.accountId!);
  try {
    const result = db.prepare(
      'INSERT INTO product_categories (name, color, description) VALUES (?, ?, ?)'
    ).run(name, color ?? '#6c63ff', description ?? '') as { lastInsertRowid: number };
    res.status(201).json({ category: db.prepare('SELECT * FROM product_categories WHERE id = ?').get(result.lastInsertRowid) });
  } catch {
    res.status(409).json({ message: 'Cette famille existe déjà' });
  }
});

router.put('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { name, color, description } = req.body;
  const db = getAccountDb(req.accountId!);
  const existing = db.prepare('SELECT * FROM product_categories WHERE id = ?').get(req.params.id);
  if (!existing) { res.status(404).json({ message: 'Not found' }); return; }
  try {
    db.prepare(
      'UPDATE product_categories SET name = COALESCE(?, name), color = COALESCE(?, color), description = COALESCE(?, description) WHERE id = ?'
    ).run(name ?? null, color ?? null, description ?? null, req.params.id);
    res.json({ category: db.prepare('SELECT * FROM product_categories WHERE id = ?').get(req.params.id) });
  } catch {
    res.status(409).json({ message: 'Cette famille existe déjà' });
  }
});

router.delete('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  if (!db.prepare('SELECT id FROM product_categories WHERE id = ?').get(req.params.id)) {
    res.status(404).json({ message: 'Not found' }); return;
  }
  db.prepare('DELETE FROM product_categories WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
