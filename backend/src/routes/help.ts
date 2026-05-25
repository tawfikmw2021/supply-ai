import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getAccountDb } from '../accountDb';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const VALID_TYPES = ['task', 'bug', 'question', 'suggestion'];
const VALID_STATUSES = ['open', 'in_progress', 'done', 'closed', 'rejected'];

const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '..', '..', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads', 'help');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('image/')
      || file.mimetype.startsWith('audio/')
      || file.mimetype.startsWith('video/');
    cb(null, ok);
  },
});

function parseItem(row: any) {
  if (!row) return null;
  try { row.attachments = JSON.parse(row.attachments); } catch { row.attachments = []; }
  return row;
}

const uploadFields = upload.fields([
  { name: 'photos', maxCount: 5 },
  { name: 'audios', maxCount: 3 },
  { name: 'videos', maxCount: 2 },
]);

// POST /help — any authenticated user submits a help item (multipart with optional media)
router.post('/', authMiddleware, uploadFields, (req: AuthRequest, res: Response): void => {
  const { type = 'task', message, page_url = '' } = req.body;
  if (!message?.trim()) { res.status(400).json({ message: 'message is required' }); return; }
  if (!VALID_TYPES.includes(type)) { res.status(400).json({ message: 'invalid type' }); return; }

  const fieldFiles = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
  const attachments = [
    ...(fieldFiles['photos'] ?? []),
    ...(fieldFiles['audios'] ?? []),
    ...(fieldFiles['videos'] ?? []),
  ].map(f => `/uploads/help/${f.filename}`);

  const db = getAccountDb(req.accountId!);
  const result = db.prepare(
    'INSERT INTO help (type, message, user_id, user_name, attachments, page_url) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(type, message.trim(), req.userId ?? null, req.userName ?? '', JSON.stringify(attachments), page_url) as any;

  const row = parseItem(db.prepare('SELECT * FROM help WHERE id = ?').get(Number(result.lastInsertRowid)));
  res.status(201).json({ item: row });
});

// GET /help — admin only
router.get('/', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const { status, type } = req.query as Record<string, string>;
  let q = 'SELECT * FROM help';
  const conditions: string[] = [];
  const params: any[] = [];
  if (status && VALID_STATUSES.includes(status)) { conditions.push('status = ?'); params.push(status); }
  if (type && VALID_TYPES.includes(type)) { conditions.push('type = ?'); params.push(type); }
  if (conditions.length) q += ' WHERE ' + conditions.join(' AND ');
  q += ' ORDER BY created_at DESC';
  const items = (db.prepare(q).all(...params) as any[]).map(parseItem);
  res.json({ items });
});

// PUT /help/:id — admin: update status, remarks, details
router.put('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { status, remarks, details } = req.body;
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ message: 'invalid status' }); return;
  }
  const db = getAccountDb(req.accountId!);
  const existing = db.prepare('SELECT * FROM help WHERE id = ?').get(Number(req.params.id)) as any;
  if (!existing) { res.status(404).json({ message: 'Not found' }); return; }
  db.prepare(
    'UPDATE help SET status = ?, remarks = ?, details = ? WHERE id = ?'
  ).run(
    status !== undefined ? status : existing.status,
    remarks !== undefined ? remarks : existing.remarks,
    details !== undefined ? details : existing.details,
    Number(req.params.id),
  );
  res.json(parseItem(db.prepare('SELECT * FROM help WHERE id = ?').get(Number(req.params.id))));
});

// DELETE /help/:id — admin only
router.delete('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const existing = db.prepare('SELECT * FROM help WHERE id = ?').get(Number(req.params.id)) as any;
  if (!existing) { res.status(404).json({ message: 'Not found' }); return; }
  // Delete uploaded files
  try {
    const attachments: string[] = JSON.parse(existing.attachments ?? '[]');
    for (const url of attachments) {
      const filePath = path.join(__dirname, '..', '..', url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  } catch { }
  db.prepare('DELETE FROM help WHERE id = ?').run(Number(req.params.id));
  res.json({ message: 'deleted' });
});

export default router;
