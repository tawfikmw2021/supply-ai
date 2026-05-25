import { Router, Response } from 'express';
import { getAccountDb } from '../accountDb';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const DEFAULT_INVOICE_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Facture {{invoice_reference}}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: white; padding: 48px; font-size: 14px; }
  .invoice { max-width: 780px; margin: 0 auto; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; }
  .brand { font-size: 26px; font-weight: 800; color: #6c63ff; letter-spacing: -0.5px; }
  .invoice-meta { text-align: right; }
  .invoice-meta .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #aaa; margin-bottom: 4px; }
  .invoice-meta .ref { font-size: 22px; font-weight: 700; color: #1a1a2e; font-family: monospace; }
  .status-pill { display: inline-block; margin-top: 8px; padding: 3px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .status-draft     { background: #f3f4f6; color: #6b7280; }
  .status-sent      { background: #dbeafe; color: #1d4ed8; }
  .status-paid      { background: #d1fae5; color: #065f46; }
  .status-cancelled { background: #fee2e2; color: #991b1b; }

  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; padding: 28px 32px; background: #f7f8ff; border-radius: 14px; margin-bottom: 36px; }
  .party .party-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; }
  .party .party-name  { font-size: 17px; font-weight: 700; margin-bottom: 6px; }
  .party .party-detail { color: #555; line-height: 1.6; font-size: 13px; }

  .dates { display: flex; gap: 40px; margin-bottom: 32px; }
  .date-block .date-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
  .date-block .date-value { font-weight: 600; font-size: 15px; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: #1a1a2e; color: white; }
  th { padding: 12px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
  th.r { text-align: right; }
  td { padding: 12px 16px; border-bottom: 1px solid #f0f0f0; }
  td.r { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:nth-child(even) { background: #fafafa; }
  .line-total { font-weight: 600; }

  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 36px; }
  .totals-box { min-width: 260px; }
  .total-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
  .total-row.grand { border-bottom: none; border-top: 2px solid #1a1a2e; margin-top: 4px; padding-top: 14px; font-size: 18px; font-weight: 800; color: #6c63ff; }

  .notes-box { padding: 16px 20px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 0 10px 10px 0; margin-bottom: 36px; }
  .notes-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #92400e; font-weight: 700; margin-bottom: 6px; }
  .notes-text { font-size: 13px; color: #555; line-height: 1.7; }

  .footer { text-align: center; font-size: 12px; color: #ccc; border-top: 1px solid #f0f0f0; padding-top: 24px; }

  @media print {
    body { padding: 0; }
    @page { margin: 18mm 20mm; }
  }
</style>
</head>
<body>
<div class="invoice">

  <div class="header">
    <div class="brand">{{account_name}}</div>
    <div class="invoice-meta">
      <div class="label">Facture</div>
      <div class="ref">{{invoice_reference}}</div>
      <span class="status-pill status-{{invoice_status}}">{{invoice_status_label}}</span>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">Émetteur</div>
      <div class="party-name">{{account_name}}</div>
    </div>
    <div class="party">
      <div class="party-label">{{entity_type_label}}</div>
      <div class="party-name">{{entity_name}}</div>
      <div class="party-detail">{{entity_email}}</div>
      <div class="party-detail">{{entity_phone}}</div>
      <div class="party-detail">{{entity_address}}</div>
    </div>
  </div>

  <div class="dates">
    <div class="date-block">
      <div class="date-label">Date de facturation</div>
      <div class="date-value">{{invoice_date}}</div>
    </div>
    <div class="date-block">
      <div class="date-label">Date d'échéance</div>
      <div class="date-value">{{invoice_due_date}}</div>
    </div>
  </div>

  {{lines_table}}

  <div class="totals-wrap">
    <div class="totals-box">
      <div class="total-row grand">
        <span>Total</span>
        <span>{{subtotal}}</span>
      </div>
    </div>
  </div>

  {{notes_section}}

  <div class="footer">Généré par Supply AI</div>
</div>
</body>
</html>`;

// GET /templates — list all
router.get('/', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const templates = db.prepare('SELECT * FROM templates ORDER BY id').all();
  res.json({ templates });
});

// GET /templates/default/:type — get default for client or supplier (auto-seeds if missing)
// Must be registered before /:id to avoid "default" being captured as an id
router.get('/default/:type', authMiddleware, (req: AuthRequest, res: Response): void => {
  const invoiceType = req.params.type;
  if (invoiceType !== 'client' && invoiceType !== 'supplier') {
    res.status(400).json({ message: 'type must be client or supplier' });
    return;
  }
  const db = getAccountDb(req.accountId!);
  // col is safe: only ever 'is_default_client' or 'is_default_supplier'
  const col = invoiceType === 'client' ? 'is_default_client' : 'is_default_supplier';
  let tmpl = db.prepare(`SELECT * FROM templates WHERE ${col} = 1 LIMIT 1`).get() as any;
  if (!tmpl) {
    const label = invoiceType === 'client' ? 'Facture client' : 'Facture fournisseur';
    const result = db.prepare(
      `INSERT INTO templates (name, type, ${col}, html) VALUES (?, ?, 1, ?)`
    ).run(label, 'both', DEFAULT_INVOICE_HTML) as any;
    tmpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(Number(result.lastInsertRowid));
  }
  res.json({ template: tmpl });
});

// GET /templates/:id
router.get('/:id', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const tmpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(Number(req.params.id));
  if (!tmpl) { res.status(404).json({ message: 'Template not found' }); return; }
  res.json({ template: tmpl });
});

// POST /templates
router.post('/', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { name, type = 'both', html = '' } = req.body;
  if (!name) { res.status(400).json({ message: 'name is required' }); return; }
  const db = getAccountDb(req.accountId!);
  const result = db.prepare(
    'INSERT INTO templates (name, type, html) VALUES (?, ?, ?)'
  ).run(name, type, html) as any;
  const tmpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json({ template: tmpl });
});

// PUT /templates/:id/default/:invoiceType — set as default for client or supplier
// Must be registered before /:id to avoid matching /:id with path "123/default/client"
router.put('/:id/default/:invoiceType', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const invoiceType = req.params.invoiceType;
  if (invoiceType !== 'client' && invoiceType !== 'supplier') {
    res.status(400).json({ message: 'invoiceType must be client or supplier' });
    return;
  }
  const db = getAccountDb(req.accountId!);
  const existing = db.prepare('SELECT id FROM templates WHERE id = ?').get(Number(req.params.id));
  if (!existing) { res.status(404).json({ message: 'Template not found' }); return; }
  // col is safe: only ever 'is_default_client' or 'is_default_supplier'
  const col = invoiceType === 'client' ? 'is_default_client' : 'is_default_supplier';
  db.prepare(`UPDATE templates SET ${col} = 0`).run();
  db.prepare(`UPDATE templates SET ${col} = 1, updated_at = datetime('now') WHERE id = ?`).run(Number(req.params.id));
  const tmpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(Number(req.params.id));
  res.json({ template: tmpl });
});

// PUT /templates/:id
router.put('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { name, type, html } = req.body;
  const db = getAccountDb(req.accountId!);
  const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(Number(req.params.id)) as any;
  if (!existing) { res.status(404).json({ message: 'Template not found' }); return; }
  db.prepare(
    `UPDATE templates SET name = ?, type = ?, html = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    name ?? existing.name,
    type ?? existing.type,
    html ?? existing.html,
    Number(req.params.id),
  );
  const tmpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(Number(req.params.id));
  res.json({ template: tmpl });
});

// DELETE /templates/:id
router.delete('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const existing = db.prepare('SELECT id FROM templates WHERE id = ?').get(Number(req.params.id));
  if (!existing) { res.status(404).json({ message: 'Template not found' }); return; }
  db.prepare('DELETE FROM templates WHERE id = ?').run(Number(req.params.id));
  res.json({ message: 'deleted' });
});

export default router;
