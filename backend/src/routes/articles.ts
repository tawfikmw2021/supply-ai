import { Router, Response, Request } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import db from '../db';
import { getAccountDb } from '../accountDb';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import { getAccountPool } from '../clientDb';

const router = Router();

// ── Image storage directory (per-account sub-folder) ──────────────────────────
const DATA_DIR      = process.env.DATA_DIR ?? path.join(__dirname, '..', '..', 'data');
const ARTICLES_DIR  = path.join(DATA_DIR, 'uploads', 'articles');
fs.mkdirSync(ARTICLES_DIR, { recursive: true });

const uploadMem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// ── Ensure per-account SQLite table exists ────────────────────────────────────
function ensureImagesTable(accountId: number) {
  const adb = getAccountDb(accountId);
  adb.prepare(`
    CREATE TABLE IF NOT EXISTS article_images (
      article_id INTEGER PRIMARY KEY,
      filename   TEXT    NOT NULL,
      created_at TEXT    DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  return adb;
}

// ── MIME detection from magic bytes ──────────────────────────────────────────
function detectMime(buf: Buffer): { mime: string; ext: string } {
  if (buf[0] === 0xFF && buf[1] === 0xD8) return { mime: 'image/jpeg', ext: '.jpg' };
  if (buf[0] === 0x89 && buf[1] === 0x50) return { mime: 'image/png',  ext: '.png' };
  if (buf[0] === 0x47 && buf[1] === 0x49) return { mime: 'image/gif',  ext: '.gif' };
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp', ext: '.webp' };
  return { mime: 'image/jpeg', ext: '.jpg' };
}

// ── Token helper for <img src="...?token=JWT"> ────────────────────────────────
function resolveAccountFromToken(req: Request): number | null {
  const token = (req.query.token as string) || req.headers.authorization?.slice(7);
  if (!token) return null;
  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const user = db.prepare('SELECT account_id FROM users WHERE id = ?').get(userId) as { account_id: number } | undefined;
    return user?.account_id ?? null;
  } catch { return null; }
}

// ── Shared query ──────────────────────────────────────────────────────────────
const BASE_SELECT = `
  SELECT
    a."idarticle"                                      AS id,
    a."code"                                           AS code,
    a."nom"                                            AS nom,
    a."designationcourte"                              AS designation_courte,
    a."description"                                    AS description,
    a."codebarre"                                      AS code_barre,
    COALESCE(a."prixachatht",  0)                      AS prix_achat_ht,
    COALESCE(a."prixventeht",  0)                      AS prix_vente_ht,
    COALESCE(a."prixachatttc", 0)                      AS prix_achat_ttc,
    COALESCE(a."prixventettc", 0)                      AS prix_vente_ttc,
    COALESCE(a."marge",        0)                      AS marge,
    f."libelle"                                        AS famille,
    f."idfamillearticle"                               AS id_famille,
    m."libelle"                                        AS marque,
    a."idmarque"                                       AS id_marque,
    t."montanttva"                                     AS taux_tva,
    a."idtva"                                          AS id_tva,
    COALESCE(SUM(q."qtereelle"), 0)                    AS stock_total,
    a."horsstock"::int                                 AS hors_stock,
    a."sommeil"::int                                   AS sommeil,
    a."alertestock"                                    AS alerte_stock,
    a."datecreation"                                   AS date_creation
  FROM article a
  LEFT JOIN famillearticle f ON a."idfamillearticle" = f."idfamillearticle"
  LEFT JOIN marque          m ON a."idmarque"         = m."idmarque"
  LEFT JOIN tva             t ON a."idtva"            = t."idtva"
  LEFT JOIN qteparlocal     q ON a."idarticle"        = q."idarticle"
`;

const GROUP_BY = `
  GROUP BY
    a."idarticle", a."code", a."nom", a."designationcourte", a."description",
    a."codebarre", a."prixachatht", a."prixventeht", a."prixachatttc", a."prixventettc",
    a."marge", f."libelle", f."idfamillearticle", m."libelle", a."idmarque",
    t."montanttva", a."idtva", a."horsstock"::int, a."sommeil"::int,
    a."alertestock", a."datecreation"
`;

// ── Merge has_image from SQLite into rows ─────────────────────────────────────
function mergeHasImage(rows: any[], accountId: number): any[] {
  if (!rows.length) return rows;
  try {
    const adb = ensureImagesTable(accountId);
    const ids  = rows.map(r => r.id);
    const ph   = ids.map(() => '?').join(',');
    const imgs = adb.prepare(`SELECT article_id FROM article_images WHERE article_id IN (${ph})`).all(...ids) as { article_id: number }[];
    const set  = new Set(imgs.map(r => r.article_id));
    return rows.map(r => ({ ...r, has_image: set.has(r.id) }));
  } catch {
    return rows.map(r => ({ ...r, has_image: false }));
  }
}

// ── GET /articles ─────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const pool      = getAccountPool(req.accountId!);
  const page      = Math.max(1, Number(req.query.page  ?? 1));
  const limit     = Math.min(200, Number(req.query.limit ?? 50));
  const offset    = (page - 1) * limit;
  const search    = (req.query.search as string ?? '').trim();
  const famille   = req.query.famille as string | undefined;
  const sommeil   = req.query.sommeil === '1';

  const conditions: string[] = [];
  const params: unknown[]    = [];
  let   p = 1;

  if (!sommeil) {
    conditions.push(`(a."sommeil" IS NULL OR a."sommeil"::int = 0)`);
  }
  if (search) {
    conditions.push(`(
      a."nom"               ILIKE $${p}   OR
      a."code"              ILIKE $${p}   OR
      a."codebarre"         ILIKE $${p}   OR
      a."designationcourte" ILIKE $${p}   OR
      m."libelle"           ILIKE $${p}
    )`);
    params.push(`%${search}%`);
    p++;
  }
  if (famille) {
    conditions.push(`f."idfamillearticle" = $${p}`);
    params.push(Number(famille));
    p++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countSql = `
      SELECT COUNT(DISTINCT a."idarticle") AS total
      FROM article a
      LEFT JOIN famillearticle f ON a."idfamillearticle" = f."idfamillearticle"
      LEFT JOIN marque          m ON a."idmarque"         = m."idmarque"
      ${where}
    `;
    const countRes = await pool.query(countSql, params);
    const total    = Number(countRes.rows[0]?.total ?? 0);

    const dataSql  = `${BASE_SELECT} ${where} ${GROUP_BY}
      ORDER BY a."nom" ASC NULLS LAST LIMIT $${p} OFFSET $${p + 1}`;
    const dataRes  = await pool.query(dataSql, [...params, limit, offset]);

    const articles = mergeHasImage(dataRes.rows, req.accountId!);
    res.json({ articles, total, page, limit });
  } catch (err: any) {
    console.error('[articles]', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /articles/familles ────────────────────────────────────────────────────
router.get('/familles', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const pool = getAccountPool(req.accountId!);
  try {
    const r = await pool.query(`
      SELECT f."idfamillearticle" AS id, f."libelle" AS libelle
      FROM famillearticle f WHERE f."libelle" IS NOT NULL ORDER BY f."libelle"
    `);
    res.json({ familles: r.rows });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /articles/marques ─────────────────────────────────────────────────────
router.get('/marques', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const pool = getAccountPool(req.accountId!);
  try {
    const r = await pool.query(`
      SELECT m."idmarque" AS id, m."libelle" AS libelle
      FROM marque m WHERE m."libelle" IS NOT NULL ORDER BY m."libelle"
    `);
    res.json({ marques: r.rows });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /articles/tvas ────────────────────────────────────────────────────────
router.get('/tvas', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const pool = getAccountPool(req.accountId!);
  try {
    const r = await pool.query(`
      SELECT t."idtva" AS id, t."montanttva" AS taux
      FROM tva t WHERE t."montanttva" IS NOT NULL ORDER BY t."montanttva"
    `);
    res.json({ tvas: r.rows });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /articles/:id ─────────────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const pool = getAccountPool(req.accountId!);
  try {
    const r = await pool.query(
      `${BASE_SELECT} WHERE a."idarticle" = $1 ${GROUP_BY}`,
      [req.params.id]
    );
    if (!r.rows.length) { res.status(404).json({ message: 'Article introuvable' }); return; }
    const [article] = mergeHasImage(r.rows, req.accountId!);
    res.json({ article });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /articles/:id ─────────────────────────────────────────────────────────
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const pool = getAccountPool(req.accountId!);
  const {
    code, nom, designation_courte, description, code_barre,
    prix_achat_ht, prix_vente_ht, prix_achat_ttc, prix_vente_ttc,
    id_famille, id_marque, id_tva,
    hors_stock, sommeil, alerte_stock,
  } = req.body as Record<string, any>;

  if (!nom?.trim()) { res.status(400).json({ message: 'Le nom est obligatoire' }); return; }

  const marge = (Number(prix_vente_ht) || 0) - (Number(prix_achat_ht) || 0);

  try {
    await pool.query(
      `UPDATE article SET
        "code"              = $1,  "nom"               = $2,
        "designationcourte" = $3,  "description"       = $4,
        "codebarre"         = $5,  "prixachatht"       = $6,
        "prixventeht"       = $7,  "prixachatttc"      = $8,
        "prixventettc"      = $9,  "marge"             = $10,
        "idfamillearticle"  = $11, "idmarque"          = $12,
        "idtva"             = $13,
        "horsstock"         = ($14::int)::bit,
        "sommeil"           = ($15::int)::bit,
        "alertestock"       = $16
      WHERE "idarticle" = $17`,
      [
        code || null, nom.trim(),
        designation_courte || null, description || null, code_barre || null,
        prix_achat_ht  != null ? Number(prix_achat_ht)  : null,
        prix_vente_ht  != null ? Number(prix_vente_ht)  : null,
        prix_achat_ttc != null ? Number(prix_achat_ttc) : null,
        prix_vente_ttc != null ? Number(prix_vente_ttc) : null,
        marge,
        id_famille != null ? Number(id_famille) : null,
        id_marque  != null ? Number(id_marque)  : null,
        id_tva     != null ? Number(id_tva)     : null,
        hors_stock ? 1 : 0,
        sommeil    ? 1 : 0,
        alerte_stock != null ? Number(alerte_stock) : null,
        req.params.id,
      ]
    );
    const r = await pool.query(`${BASE_SELECT} WHERE a."idarticle" = $1 ${GROUP_BY}`, [req.params.id]);
    const [article] = mergeHasImage(r.rows, req.accountId!);
    res.json({ article });
  } catch (err: any) {
    console.error('[articles PUT]', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /articles/:id/image ───────────────────────────────────────────────────
// Accepts ?token= so it works as <img :src="url?token=JWT">
router.get('/:id/image', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountFromToken(req);
  if (accountId === null) { res.status(401).end(); return; }

  try {
    const adb  = ensureImagesTable(accountId);
    const row  = adb.prepare('SELECT filename FROM article_images WHERE article_id = ?')
                    .get(Number(req.params.id)) as { filename: string } | undefined;
    if (!row) { res.status(404).end(); return; }

    const dir      = path.join(ARTICLES_DIR, String(accountId));
    const filePath = path.join(dir, row.filename);
    if (!fs.existsSync(filePath)) { res.status(404).end(); return; }

    const ext  = path.extname(row.filename).toLowerCase();
    const mime = ext === '.png' ? 'image/png'
               : ext === '.gif' ? 'image/gif'
               : ext === '.webp' ? 'image/webp'
               : 'image/jpeg';

    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    fs.createReadStream(filePath).pipe(res);
  } catch (err: any) {
    res.status(500).end();
  }
});

// ── POST /articles/:id/image ──────────────────────────────────────────────────
router.post('/:id/image', adminMiddleware, uploadMem.single('image'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) { res.status(400).json({ message: 'Aucune image reçue' }); return; }

    const accountId  = req.accountId!;
    const articleId  = Number(req.params.id);
    const { mime, ext } = detectMime(req.file.buffer);
    const filename   = `${articleId}${ext}`;
    const dir        = path.join(ARTICLES_DIR, String(accountId));
    fs.mkdirSync(dir, { recursive: true });

    // Remove any old image for this article (different extension)
    for (const f of fs.readdirSync(dir)) {
      if (path.parse(f).name === String(articleId) && f !== filename) {
        fs.unlinkSync(path.join(dir, f));
      }
    }

    fs.writeFileSync(path.join(dir, filename), req.file.buffer);

    const adb = ensureImagesTable(accountId);
    adb.prepare(`
      INSERT INTO article_images (article_id, filename)
      VALUES (?, ?)
      ON CONFLICT(article_id) DO UPDATE SET filename = excluded.filename, created_at = CURRENT_TIMESTAMP
    `).run(articleId, filename);

    res.json({ ok: true, mime });
  }
);

// ── DELETE /articles/:id/image ────────────────────────────────────────────────
router.delete('/:id/image', adminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const accountId = req.accountId!;
  const articleId = Number(req.params.id);
  try {
    const adb = ensureImagesTable(accountId);
    const row = adb.prepare('SELECT filename FROM article_images WHERE article_id = ?')
                   .get(articleId) as { filename: string } | undefined;
    if (row) {
      const filePath = path.join(ARTICLES_DIR, String(accountId), row.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      adb.prepare('DELETE FROM article_images WHERE article_id = ?').run(articleId);
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
