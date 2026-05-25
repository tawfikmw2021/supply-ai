import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

function parseAccount(row: any) {
  if (!row) return null;
  try { row.properties = JSON.parse(row.properties); } catch { row.properties = {}; }
  return row;
}

function buildAuthResponse(userId: number) {
  const user = db.prepare('SELECT id, email, name, role, account_id FROM users WHERE id = ?').get(userId) as any;
  const account = parseAccount(db.prepare('SELECT id, name, properties FROM accounts WHERE id = ?').get(user.account_id));
  const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  return { token, user, account };
}

router.post('/register', (req: Request, res: Response): void => {
  const { email, password, name, accountName } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ message: 'email, password and name are required' });
    return;
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    res.status(409).json({ message: 'Email already in use' });
    return;
  }

  const hash = bcrypt.hashSync(password, 10);

  // Every registration creates a new account; user becomes its admin
  const accountResult = db.prepare(
    `INSERT INTO accounts (name, properties) VALUES (?, '{"currency":"EUR"}')`
  ).run(accountName ?? `${name}'s account`) as { lastInsertRowid: number };

  const userResult = db.prepare(
    'INSERT INTO users (email, password, name, role, account_id) VALUES (?, ?, ?, ?, ?)'
  ).run(email, hash, name, 'admin', accountResult.lastInsertRowid) as { lastInsertRowid: number };

  res.status(201).json(buildAuthResponse(userResult.lastInsertRowid));
});

router.post('/login', (req: Request, res: Response): void => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ message: 'email and password are required' });
    return;
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!user || !bcrypt.compareSync(password, user.password)) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }
  res.json(buildAuthResponse(user.id));
});

router.get('/me', authMiddleware, (req: AuthRequest, res: Response): void => {
  if (!req.userId) { res.status(401).json({ message: 'Unauthorized' }); return; }
  const user = db.prepare('SELECT id, email, name, role, account_id FROM users WHERE id = ?').get(req.userId) as any;
  if (!user) { res.status(404).json({ message: 'User not found' }); return; }
  const account = parseAccount(db.prepare('SELECT id, name, properties FROM accounts WHERE id = ?').get(user.account_id));
  res.json({ user, account });
});

export default router;
