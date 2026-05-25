import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db';
import { adminMiddleware, AuthRequest } from '../middleware/auth';
import * as audit from '../audit';

const router = Router();

// List all users of the same account
router.get('/', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const users = db
    .prepare('SELECT id, email, name, role, account_id, created_at FROM users WHERE account_id = ? ORDER BY id ASC')
    .all(req.accountId!) as any[];
  res.json({ users });
});

// Create a user in the same account
router.post('/', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { name, email, password, role = 'user' } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ message: 'name, email and password are required' }); return;
  }
  if (!['user', 'admin'].includes(role)) {
    res.status(400).json({ message: 'role must be user or admin' }); return;
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    res.status(409).json({ message: 'Email already in use' }); return;
  }
  const hash = bcrypt.hashSync(password, 10);
  const r = db
    .prepare('INSERT INTO users (email, password, name, role, account_id) VALUES (?, ?, ?, ?, ?)')
    .run(email, hash, name, role, req.accountId!) as { lastInsertRowid: number };
  const user = db.prepare('SELECT id, email, name, role, account_id, created_at FROM users WHERE id = ?').get(r.lastInsertRowid) as any;
  audit.log(req, 'users', 'INSERT', r.lastInsertRowid, { name, email, role });
  res.status(201).json({ user });
});

// Update name or role (cannot change own role)
router.put('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const targetId = Number(req.params.id);
  const { name, role } = req.body;

  const target = db.prepare('SELECT id, account_id, role FROM users WHERE id = ?').get(targetId) as any;
  if (!target) { res.status(404).json({ message: 'User not found' }); return; }
  if (target.account_id !== req.accountId) { res.status(403).json({ message: 'Forbidden' }); return; }
  if (role && targetId === req.userId) { res.status(400).json({ message: 'Cannot change your own role' }); return; }
  if (role && !['user', 'admin'].includes(role)) { res.status(400).json({ message: 'role must be user or admin' }); return; }

  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      role = COALESCE(?, role)
    WHERE id = ?
  `).run(name ?? null, role ?? null, targetId);

  const user = db.prepare('SELECT id, email, name, role, account_id, created_at FROM users WHERE id = ?').get(targetId) as any;
  audit.log(req, 'users', 'UPDATE', targetId, { name: user.name, role: user.role });
  res.json({ user });
});

// Reset password
router.put('/:id/password', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const targetId = Number(req.params.id);
  const { password } = req.body;
  if (!password || password.length < 6) { res.status(400).json({ message: 'password must be at least 6 characters' }); return; }

  const target = db.prepare('SELECT id, account_id FROM users WHERE id = ?').get(targetId) as any;
  if (!target) { res.status(404).json({ message: 'User not found' }); return; }
  if (target.account_id !== req.accountId) { res.status(403).json({ message: 'Forbidden' }); return; }

  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), targetId);
  audit.log(req, 'users', 'UPDATE', targetId, { password_reset: true });
  res.json({ message: 'Password updated' });
});

// Delete a user (cannot delete self)
router.delete('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const targetId = Number(req.params.id);
  if (targetId === req.userId) { res.status(400).json({ message: 'Cannot delete your own account' }); return; }

  const target = db.prepare('SELECT id, account_id, name FROM users WHERE id = ?').get(targetId) as any;
  if (!target) { res.status(404).json({ message: 'User not found' }); return; }
  if (target.account_id !== req.accountId) { res.status(403).json({ message: 'Forbidden' }); return; }

  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  audit.log(req, 'users', 'DELETE', targetId, { deleted_name: target.name });
  res.status(204).send();
});

export default router;
