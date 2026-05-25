import { Router, Response } from 'express';
import db from '../db';
import { adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const table = req.query.table as string | undefined;
  const operation = req.query.operation as string | undefined;

  let where = 'WHERE account_id = ?';
  const params: any[] = [req.accountId];
  if (table) { where += ' AND table_name = ?'; params.push(table); }
  if (operation) { where += ' AND operation = ?'; params.push(operation.toUpperCase()); }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM audit_logs ${where}`).get(...params) as { c: number }).c;
  const logs = (db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as any[])
    .map(row => ({ ...row, data: row.data ? (() => { try { return JSON.parse(row.data); } catch { return row.data; } })() : null }));

  res.json({ total, limit, offset, logs });
});

export default router;
