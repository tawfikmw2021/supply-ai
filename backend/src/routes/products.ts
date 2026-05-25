import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getAccountDb } from '../accountDb';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import { UPLOADS_DIR } from './documents';
import * as audit from '../audit';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const WITH_DOC = `
  SELECT p.*,
    d.id   AS doc_id,
    d.type AS doc_type,
    d.url  AS doc_url,
    d.properties AS doc_properties,
    s.name AS supplier_name
  FROM products p
  LEFT JOIN documents d ON p.document_id = d.id
  LEFT JOIN suppliers s ON p.supplier_id = s.id
`;

function shape(row: any) {
  if (!row) return null;
  const { doc_id, doc_type, doc_url, doc_properties, supplier_name, ...product } = row;
  product.document = doc_id
    ? { id: doc_id, type: doc_type, url: doc_url, properties: (() => { try { return JSON.parse(doc_properties); } catch { return {}; } })() }
    : null;
  product.supplier = product.supplier_id ? { id: product.supplier_id, name: supplier_name } : null;
  return product;
}

router.get('/', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  res.json({ products: (db.prepare(`${WITH_DOC} ORDER BY p.id DESC`).all() as any[]).map(shape) });
});

router.get('/:id', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const row = db.prepare(`${WITH_DOC} WHERE p.id = ?`).get(req.params.id);
  if (!row) { res.status(404).json({ message: 'Product not found' }); return; }
  res.json({ product: shape(row) });
});

router.post('/', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { name, category, price, sale_price, vat, stock, description, manufacturer, code, barcode, supplier_id } = req.body;
  if (!name || !category || price == null) {
    res.status(400).json({ message: 'name, category and price are required' }); return;
  }
  const db = getAccountDb(req.accountId!);
  const result = db.prepare(
    `INSERT INTO products
      (name, category, price, sale_price, vat, stock, description, manufacturer, code, barcode, supplier_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    name, category, Number(price), Number(sale_price ?? 0), Number(vat ?? 20),
    Number(stock ?? 0), description ?? '', manufacturer ?? '', code ?? '', barcode ?? '',
    supplier_id ? Number(supplier_id) : null,
  ) as { lastInsertRowid: number };

  const product = shape(db.prepare(`${WITH_DOC} WHERE p.id = ?`).get(result.lastInsertRowid));
  audit.log(req, 'products', 'INSERT', result.lastInsertRowid, product);
  res.status(201).json({ product });
});

router.put('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const { name, category, price, sale_price, vat, stock, description, manufacturer, code, barcode, supplier_id } = req.body;
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as any;
  if (!existing) { res.status(404).json({ message: 'Product not found' }); return; }

  const newSupplierId = supplier_id !== undefined
    ? (supplier_id ? Number(supplier_id) : null)
    : existing.supplier_id;

  db.prepare(`
    UPDATE products SET
      name         = COALESCE(?, name),
      category     = COALESCE(?, category),
      price        = COALESCE(?, price),
      sale_price   = COALESCE(?, sale_price),
      vat          = COALESCE(?, vat),
      stock        = COALESCE(?, stock),
      description  = COALESCE(?, description),
      manufacturer = COALESCE(?, manufacturer),
      code         = COALESCE(?, code),
      barcode      = COALESCE(?, barcode),
      supplier_id  = ?
    WHERE id = ?
  `).run(
    name ?? null, category ?? null,
    price != null ? Number(price) : null,
    sale_price != null ? Number(sale_price) : null,
    vat != null ? Number(vat) : null,
    stock != null ? Number(stock) : null,
    description ?? null, manufacturer ?? null,
    code ?? null, barcode ?? null,
    newSupplierId,
    req.params.id,
  );

  const product = shape(db.prepare(`${WITH_DOC} WHERE p.id = ?`).get(req.params.id));
  audit.log(req, 'products', 'UPDATE', Number(req.params.id), product);
  res.json({ product });
});

// ── Stock image ────────────────────────────────────────────────────────────────

router.post('/:id/image', adminMiddleware, upload.single('image'), (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as any;
  if (!product) { res.status(404).json({ message: 'Product not found' }); return; }
  if (!req.file) { res.status(400).json({ message: 'No image uploaded' }); return; }

  const url = `/uploads/documents/${req.file.filename}`;

  if (product.document_id) {
    const old = db.prepare('SELECT url FROM documents WHERE id = ?').get(product.document_id) as any;
    if (old?.url?.startsWith('/uploads/')) {
      const oldFile = path.join(UPLOADS_DIR, path.basename(old.url));
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }
    db.prepare(`UPDATE documents SET url = ?, type = 'image' WHERE id = ?`).run(url, product.document_id);
  } else {
    const doc = db.prepare(`INSERT INTO documents (type, url, properties) VALUES ('image', ?, '{}')`).run(url) as { lastInsertRowid: number };
    db.prepare('UPDATE products SET document_id = ? WHERE id = ?').run(doc.lastInsertRowid, req.params.id);
  }

  const updated = shape(db.prepare(`${WITH_DOC} WHERE p.id = ?`).get(req.params.id));
  audit.log(req, 'products', 'UPDATE', Number(req.params.id), { image_uploaded: url });
  res.json({ product: updated });
});

// ── Stock movements ────────────────────────────────────────────────────────────

router.get('/:id/movements', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const movements = db.prepare(
    'SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC LIMIT 200'
  ).all(Number(req.params.id));
  res.json({ movements });
});

router.post('/:id/movements', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { type, quantity, reason } = req.body;
  if (!['in', 'out', 'adjustment'].includes(type)) {
    res.status(400).json({ message: 'type must be in | out | adjustment' }); return;
  }
  const qty = Number(quantity);
  if (!quantity || isNaN(qty)) {
    res.status(400).json({ message: 'quantity is required' }); return;
  }

  const db = getAccountDb(req.accountId!);
  if (!db.prepare('SELECT id FROM products WHERE id = ?').get(Number(req.params.id))) {
    res.status(404).json({ message: 'Product not found' }); return;
  }

  const delta = type === 'in' ? Math.abs(qty) : type === 'out' ? -Math.abs(qty) : qty;

  const result = db.prepare(
    'INSERT INTO stock_movements (product_id, type, quantity, reason, user_name) VALUES (?, ?, ?, ?, ?)'
  ).run(Number(req.params.id), type, qty, reason ?? '', req.userName ?? '') as { lastInsertRowid: number };

  db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(delta, Number(req.params.id));

  const movement = db.prepare('SELECT * FROM stock_movements WHERE id = ?').get(Number(result.lastInsertRowid));
  const product = shape(db.prepare(`${WITH_DOC} WHERE p.id = ?`).get(Number(req.params.id)));
  res.status(201).json({ movement, product });
});

// ── Delete ─────────────────────────────────────────────────────────────────────

router.delete('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as any;
  if (!product) { res.status(404).json({ message: 'Product not found' }); return; }

  if (product.document_id) {
    const doc = db.prepare('SELECT url FROM documents WHERE id = ?').get(product.document_id) as any;
    if (doc?.url?.startsWith('/uploads/')) {
      const file = path.join(UPLOADS_DIR, path.basename(doc.url));
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    db.prepare('DELETE FROM documents WHERE id = ?').run(product.document_id);
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  audit.log(req, 'products', 'DELETE', Number(req.params.id), { deleted: product });
  res.status(204).send();
});

export default router;
