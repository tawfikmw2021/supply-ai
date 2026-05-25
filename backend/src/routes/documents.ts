import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getAccountDb } from '../accountDb';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import * as audit from '../audit';

const router = Router();

const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '..', '..', 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads', 'documents');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function parseDoc(doc: any) {
  if (!doc) return null;
  try { doc.properties = JSON.parse(doc.properties); } catch { doc.properties = {}; }
  return doc;
}

router.get('/', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  res.json({ documents: (db.prepare('SELECT * FROM documents ORDER BY id DESC').all() as any[]).map(parseDoc) });
});

router.get('/:id', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const doc = parseDoc(db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id));
  if (!doc) { res.status(404).json({ message: 'Document not found' }); return; }
  res.json({ document: doc });
});

router.post('/', adminMiddleware, upload.single('file'), (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const { type, properties } = req.body;
  if (!type) { res.status(400).json({ message: 'type is required' }); return; }

  let url = req.body.url ?? '';
  if (req.file) url = `/uploads/documents/${req.file.filename}`;
  if (!url) { res.status(400).json({ message: 'file or url is required' }); return; }

  let props = '{}';
  if (properties) {
    try { props = JSON.stringify(typeof properties === 'string' ? JSON.parse(properties) : properties); }
    catch { props = '{}'; }
  }

  const result = db.prepare('INSERT INTO documents (type, url, properties) VALUES (?, ?, ?)').run(type, url, props) as { lastInsertRowid: number };
  const doc = parseDoc(db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid));
  audit.log(req, 'documents', 'INSERT', result.lastInsertRowid, doc);
  res.status(201).json({ document: doc });
});

router.put('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id) as any;
  if (!existing) { res.status(404).json({ message: 'Document not found' }); return; }

  const { type, url, properties } = req.body;
  let props: string | null = null;
  if (properties !== undefined) {
    try { props = JSON.stringify(typeof properties === 'string' ? JSON.parse(properties) : properties); }
    catch { props = '{}'; }
  }

  db.prepare(`
    UPDATE documents SET
      type = COALESCE(?, type),
      url = COALESCE(?, url),
      properties = COALESCE(?, properties)
    WHERE id = ?
  `).run(type ?? null, url ?? null, props, req.params.id);

  const doc = parseDoc(db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id));
  audit.log(req, 'documents', 'UPDATE', Number(req.params.id), doc);
  res.json({ document: doc });
});

router.post('/:id/upload', adminMiddleware, upload.single('file'), (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id) as any;
  if (!existing) { res.status(404).json({ message: 'Document not found' }); return; }
  if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return; }

  if (existing.url?.startsWith('/uploads/')) {
    const old = path.join(UPLOADS_DIR, path.basename(existing.url));
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }

  const url = `/uploads/documents/${req.file.filename}`;
  db.prepare('UPDATE documents SET url = ? WHERE id = ?').run(url, req.params.id);
  const doc = parseDoc(db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id));
  audit.log(req, 'documents', 'UPDATE', Number(req.params.id), { file_replaced: url });
  res.json({ document: doc });
});

router.delete('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id) as any;
  if (!existing) { res.status(404).json({ message: 'Document not found' }); return; }

  if (existing.url?.startsWith('/uploads/')) {
    const file = path.join(UPLOADS_DIR, path.basename(existing.url));
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  audit.log(req, 'documents', 'DELETE', Number(req.params.id), { deleted: parseDoc(existing) });
  res.status(204).send();
});

export default router;
