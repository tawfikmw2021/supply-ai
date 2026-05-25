import { Router, Response } from 'express';
import db from '../db';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import * as audit from '../audit';

const router = Router();

function parseAccount(row: any) {
  if (!row) return null;
  try { row.properties = JSON.parse(row.properties); } catch { row.properties = {}; }
  return row;
}

router.get('/me', authMiddleware, (req: AuthRequest, res: Response): void => {
  const accountId = req.accountId!;
  const account = db.prepare('SELECT id, name, properties, created_at FROM accounts WHERE id = ?').get(accountId);
  if (!account) { res.status(404).json({ message: 'Account not found' }); return; }
  res.json({ account: parseAccount(account) });
});

router.put('/me', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const accountId = req.accountId!;
  const { name, properties } = req.body;
  const account = db.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId);
  if (!account) { res.status(404).json({ message: 'Account not found' }); return; }

  let props: string | null = null;
  if (properties !== undefined) {
    try { props = JSON.stringify(typeof properties === 'string' ? JSON.parse(properties) : properties); }
    catch { res.status(400).json({ message: 'Invalid properties JSON' }); return; }
  }

  db.prepare(`
    UPDATE accounts SET
      name = COALESCE(?, name),
      properties = COALESCE(?, properties)
    WHERE id = ?
  `).run(name ?? null, props, accountId);

  const updated = parseAccount(db.prepare('SELECT id, name, properties, created_at FROM accounts WHERE id = ?').get(accountId));
  audit.log(req, 'accounts', 'UPDATE', accountId, updated);
  res.json({ account: updated });
});

export default router;
