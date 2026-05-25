import db from './db';
import { AuthRequest } from './middleware/auth';

export type Operation = 'INSERT' | 'UPDATE' | 'DELETE';

export function log(
  req: AuthRequest,
  tableName: string,
  operation: Operation,
  recordId: number | null,
  data?: any,
) {
  if (!req.userId) return;
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, account_id, table_name, operation, record_id, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      req.userName ?? 'unknown',
      req.accountId ?? null,
      tableName,
      operation,
      recordId ?? null,
      data !== undefined ? JSON.stringify(data) : null,
    );
  } catch { /* never crash a request due to audit failure */ }
}
