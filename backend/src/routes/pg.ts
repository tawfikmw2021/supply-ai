import { Router, Response } from 'express';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import { getAccountPool, pgQuery, ALLOWED_TABLES, getTablePk, getTextColumns } from '../clientDb';

const router = Router();

// ── GET /pg/tables — list all allowed table names ─────────────────────────────
router.get('/tables', authMiddleware, (_req, res: Response): void => {
  res.json({ tables: [...ALLOWED_TABLES].sort() });
});

// ── GET /pg/meta/:table — columns metadata ────────────────────────────────────
router.get('/meta/:table', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) { res.status(404).json({ message: 'Table inconnue' }); return; }
  const accountId = req.accountId!;
  const pool = getAccountPool(accountId);
  try {
    const columns = await pgQuery<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table], pool);
    const pk = await getTablePk(table, pool, accountId);
    res.json({ columns, pk });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /pg/:table — list records (paginated + search) ────────────────────────
router.get('/:table', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) { res.status(404).json({ message: 'Table inconnue' }); return; }
  const accountId = req.accountId!;
  const pool = getAccountPool(accountId);

  try {
    const page   = Math.max(1, Number(req.query.page   ?? 1));
    const limit  = Math.min(500, Number(req.query.limit ?? 50));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string ?? '').trim();

    let whereSql = '';
    let countParams: unknown[] = [];
    let rowParams:   unknown[] = [limit, offset];

    if (search) {
      const textCols = await getTextColumns(table, pool, accountId);
      if (textCols.length > 0) {
        const conds = textCols.map((c, i) => `"${c}" ILIKE $${i + 1}`).join(' OR ');
        whereSql = `WHERE (${conds})`;
        countParams = textCols.map(() => `%${search}%`);
        rowParams   = [...countParams, limit, offset];
      }
    }

    const pk = await getTablePk(table, pool, accountId);
    const orderBy = pk ? `ORDER BY "${pk}" DESC` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM "${table}" ${whereSql}`,
      countParams
    );

    const searchParamCount = countParams.length;
    const rows = await pgQuery(
      `SELECT * FROM "${table}" ${whereSql} ${orderBy} LIMIT $${searchParamCount + 1} OFFSET $${searchParamCount + 2}`,
      rowParams,
      pool
    );

    res.json({ rows, total: Number(countResult.rows[0].total), page, limit });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /pg/:table/:id — single record ────────────────────────────────────────
router.get('/:table/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.has(table)) { res.status(404).json({ message: 'Table inconnue' }); return; }
  const accountId = req.accountId!;
  const pool = getAccountPool(accountId);
  try {
    const pk = await getTablePk(table, pool, accountId);
    if (!pk) { res.status(400).json({ message: `La table "${table}" n'a pas de clé primaire` }); return; }
    const rows = await pgQuery(`SELECT * FROM "${table}" WHERE "${pk}" = $1`, [id], pool);
    if (!rows.length) { res.status(404).json({ message: 'Enregistrement introuvable' }); return; }
    res.json({ row: rows[0] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /pg/:table — create ──────────────────────────────────────────────────
router.post('/:table', adminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) { res.status(404).json({ message: 'Table inconnue' }); return; }
  const pool = getAccountPool(req.accountId!);
  try {
    const body = req.body as Record<string, unknown>;
    const keys = Object.keys(body);
    if (!keys.length) { res.status(400).json({ message: 'Aucune donnée fournie' }); return; }

    const cols   = keys.map(k => `"${k}"`).join(', ');
    const ph     = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = keys.map(k => body[k]);

    const rows = await pgQuery(`INSERT INTO "${table}" (${cols}) VALUES (${ph}) RETURNING *`, values, pool);
    res.status(201).json({ row: rows[0] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /pg/:table/:id — update ───────────────────────────────────────────────
router.put('/:table/:id', adminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.has(table)) { res.status(404).json({ message: 'Table inconnue' }); return; }
  const accountId = req.accountId!;
  const pool = getAccountPool(accountId);
  try {
    const pk   = await getTablePk(table, pool, accountId);
    if (!pk) { res.status(400).json({ message: `La table "${table}" n'a pas de clé primaire` }); return; }
    const body = req.body as Record<string, unknown>;
    const keys = Object.keys(body).filter(k => k !== pk);
    if (!keys.length) { res.status(400).json({ message: 'Aucune donnée fournie' }); return; }

    const sets   = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = [...keys.map(k => body[k]), id];

    const rows = await pgQuery(
      `UPDATE "${table}" SET ${sets} WHERE "${pk}" = $${keys.length + 1} RETURNING *`,
      values,
      pool
    );
    if (!rows.length) { res.status(404).json({ message: 'Enregistrement introuvable' }); return; }
    res.json({ row: rows[0] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /pg/:table/:id — delete ───────────────────────────────────────────
router.delete('/:table/:id', adminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.has(table)) { res.status(404).json({ message: 'Table inconnue' }); return; }
  const accountId = req.accountId!;
  const pool = getAccountPool(accountId);
  try {
    const pk = await getTablePk(table, pool, accountId);
    if (!pk) { res.status(400).json({ message: `La table "${table}" n'a pas de clé primaire` }); return; }
    const rows = await pgQuery(`DELETE FROM "${table}" WHERE "${pk}" = $1 RETURNING *`, [id], pool);
    if (!rows.length) { res.status(404).json({ message: 'Enregistrement introuvable' }); return; }
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
