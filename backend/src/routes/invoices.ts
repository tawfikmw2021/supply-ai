import { Router, Response } from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { getAccountDb } from '../accountDb';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import * as audit from '../audit';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();

const LIST_SQL = `
  SELECT i.*,
    c.name AS client_name,
    s.name AS supplier_name,
    COALESCE((SELECT SUM(quantity * unit_price) FROM invoice_lines WHERE invoice_id = i.id), 0) AS total
  FROM invoices i
  LEFT JOIN clients  c ON i.client_id   = c.id
  LEFT JOIN suppliers s ON i.supplier_id = s.id
`;

function shape(row: any) {
  if (!row) return null;
  return {
    ...row,
    entity_name: row.type === 'client' ? (row.client_name ?? null) : (row.supplier_name ?? null),
  };
}

function insertLines(db: any, invoiceId: number, lines: any[]) {
  const stmt = db.prepare(
    'INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price) VALUES (?, ?, ?, ?)'
  );
  for (const l of lines ?? []) {
    stmt.run(invoiceId, l.description ?? '', Number(l.quantity) || 1, Number(l.unit_price) || 0);
  }
}

// ── Image scan → invoice lines ──────────────────────────
router.post('/scan-image', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ message: 'file is required' }); return; }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(503).json({ message: 'ANTHROPIC_API_KEY non configurée' }); return; }

  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!ALLOWED.includes(req.file.mimetype)) {
    res.status(400).json({ message: 'Type d\'image non supporté. Utilisez JPEG, PNG ou WebP.' }); return;
  }

  try {
    const client = new Anthropic({ apiKey });
    const base64 = req.file.buffer.toString('base64');

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: req.file.mimetype as any, data: base64 },
            },
            {
              type: 'text',
              text: `Analyse cette image et extrais tous les produits ou articles visibles pour créer des lignes de facture.

Réponds UNIQUEMENT avec un objet JSON valide:
{
  "lines": [
    { "description": "Nom du produit ou service", "quantity": 1, "unit_price": 0 },
    ...
  ]
}

Règles:
- description: nom du produit/article (string)
- quantity: quantité numérique (nombre, défaut 1 si non visible)
- unit_price: prix unitaire numérique (nombre, défaut 0 si non visible)
- Inclus tous les articles/produits visibles
- Réponds uniquement avec le JSON, sans markdown`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    const lines = (parsed.lines ?? []).map((l: any) => ({
      description: String(l.description ?? ''),
      quantity: Number(l.quantity) || 1,
      unit_price: Number(l.unit_price) || 0,
    }));

    res.json({ lines });
  } catch (err: any) {
    res.status(500).json({ message: `Erreur IA: ${err.message}` });
  }
});

// ── List ────────────────────────────────────────────────
router.get('/', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const { type } = req.query as { type?: string };
  let sql = LIST_SQL;
  const params: any[] = [];
  if (type === 'client' || type === 'supplier') { sql += ' WHERE i.type = ?'; params.push(type); }
  sql += ' ORDER BY i.id DESC';
  res.json({ invoices: (db.prepare(sql).all(...params) as any[]).map(shape) });
});

// ── Detail ──────────────────────────────────────────────
router.get('/:id', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const invoice = shape(db.prepare(`${LIST_SQL} WHERE i.id = ?`).get(req.params.id));
  if (!invoice) { res.status(404).json({ message: 'Invoice not found' }); return; }
  const lines = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id ASC').all(req.params.id);
  res.json({ invoice: { ...invoice, lines } });
});

// ── Create ──────────────────────────────────────────────
router.post('/', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { type, reference, client_id, supplier_id, date, due_date, status = 'draft', notes = '', lines = [] } = req.body;
  if (!type || !['client', 'supplier'].includes(type)) {
    res.status(400).json({ message: 'type must be client or supplier' }); return;
  }
  const db = getAccountDb(req.accountId!);
  const r = db.prepare(
    'INSERT INTO invoices (type, reference, client_id, supplier_id, date, due_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(type, reference ?? '', client_id ?? null, supplier_id ?? null, date ?? new Date().toISOString().slice(0, 10), due_date ?? null, status, notes) as { lastInsertRowid: number };

  if (!reference) {
    const prefix = type === 'client' ? 'CLI' : 'FOU';
    const year = new Date().getFullYear();
    const ref = `${prefix}-${year}-${String(r.lastInsertRowid).padStart(4, '0')}`;
    db.prepare('UPDATE invoices SET reference = ? WHERE id = ?').run(ref, r.lastInsertRowid);
  }

  insertLines(db, r.lastInsertRowid, lines);

  const invoice = shape(db.prepare(`${LIST_SQL} WHERE i.id = ?`).get(r.lastInsertRowid));
  const linesOut = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id ASC').all(r.lastInsertRowid);
  audit.log(req, 'invoices', 'INSERT', r.lastInsertRowid, invoice);
  res.status(201).json({ invoice: { ...invoice, lines: linesOut } });
});

// ── Update ──────────────────────────────────────────────
router.put('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  if (!db.prepare('SELECT id FROM invoices WHERE id = ?').get(req.params.id)) {
    res.status(404).json({ message: 'Invoice not found' }); return;
  }
  const { reference, client_id, supplier_id, date, due_date, status, notes, lines } = req.body;
  db.prepare(`
    UPDATE invoices SET
      reference   = COALESCE(?, reference),
      client_id   = COALESCE(?, client_id),
      supplier_id = COALESCE(?, supplier_id),
      date        = COALESCE(?, date),
      due_date    = ?,
      status      = COALESCE(?, status),
      notes       = COALESCE(?, notes)
    WHERE id = ?
  `).run(
    reference ?? null, client_id ?? null, supplier_id ?? null,
    date ?? null, due_date ?? null, status ?? null, notes ?? null,
    req.params.id
  );

  if (Array.isArray(lines)) {
    db.prepare('DELETE FROM invoice_lines WHERE invoice_id = ?').run(req.params.id);
    insertLines(db, Number(req.params.id), lines);
  }

  const invoice = shape(db.prepare(`${LIST_SQL} WHERE i.id = ?`).get(req.params.id));
  const linesOut = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id ASC').all(req.params.id);
  audit.log(req, 'invoices', 'UPDATE', Number(req.params.id), invoice);
  res.json({ invoice: { ...invoice, lines: linesOut } });
});

// ── Delete ──────────────────────────────────────────────
router.delete('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) { res.status(404).json({ message: 'Invoice not found' }); return; }
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  audit.log(req, 'invoices', 'DELETE', Number(req.params.id), { deleted: invoice });
  res.status(204).send();
});

export default router;
