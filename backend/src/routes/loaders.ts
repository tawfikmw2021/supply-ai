import { Router, Response } from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { getAccountDb } from '../accountDb';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const ALLOWED_TABLES = ['products', 'clients', 'suppliers'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface MappingEntry {
  source: string;
  target: string;
  transform: string;
}

function parseCSV(content: string, delimiter: string, hasHeader: boolean): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  function splitLine(line: string): string[] {
    const result: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (line.slice(i, i + delimiter.length) === delimiter) {
          result.push(field);
          field = '';
          i += delimiter.length - 1;
        } else {
          field += ch;
        }
      }
    }
    result.push(field);
    return result;
  }

  let headers: string[];
  let dataLines: string[];
  if (hasHeader) {
    headers = splitLine(lines[0]);
    dataLines = lines.slice(1);
  } else {
    const firstRow = splitLine(lines[0]);
    headers = firstRow.map((_, i) => `col_${i + 1}`);
    dataLines = lines;
  }

  const rows = dataLines.map(line => {
    const values = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });

  return { headers, rows };
}

function parseJSON(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const data = JSON.parse(content) as Record<string, unknown>[];
  if (!Array.isArray(data) || data.length === 0) return { headers: [], rows: [] };
  const headers = Object.keys(data[0]);
  const rows = data.map(item => {
    const row: Record<string, string> = {};
    for (const key of headers) row[key] = String(item[key] ?? '');
    return row;
  });
  return { headers, rows };
}

function parseFile(buffer: Buffer, fileFormat: string, delimiter: string, hasHeader: boolean): { headers: string[]; rows: Record<string, string>[] } {
  const content = buffer.toString('utf-8');
  if (fileFormat === 'json') return parseJSON(content);
  const effectiveDelimiter = fileFormat === 'tsv' ? '\t' : delimiter;
  return parseCSV(content, effectiveDelimiter, hasHeader);
}

async function parseImageWithAI(buffer: Buffer, mimeType: string): Promise<{ headers: string[]; rows: Record<string, string>[]; description: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY non configurée');

  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new Error(`Type d'image non supporté: ${mimeType}. Utilisez JPEG, PNG, GIF ou WebP.`);
  }

  const client = new Anthropic({ apiKey });
  const base64 = buffer.toString('base64');

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType as any, data: base64 },
          },
          {
            type: 'text',
            text: `Analyse cette image et extrais toutes les données tabulaires ou structurées visibles.

Réponds UNIQUEMENT avec un objet JSON valide ayant cette structure exacte:
{
  "description": "Description courte du type de document/données détectées (ex: liste de produits, facture, catalogue...)",
  "headers": ["colonne1", "colonne2"],
  "rows": [
    {"colonne1": "valeur", "colonne2": "valeur"},
    ...
  ]
}

Règles:
- Utilise des noms de colonnes en minuscules sans espaces (snake_case)
- Toutes les valeurs doivent être des chaînes de caractères
- Inclus toutes les lignes visibles
- Si l'image n'est pas un tableau, crée des colonnes logiques pour les données visibles
- Réponds uniquement avec le JSON, sans markdown ni explications`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    description: parsed.description ?? '',
    headers: Array.isArray(parsed.headers) ? parsed.headers : [],
    rows: Array.isArray(parsed.rows) ? parsed.rows : [],
  };
}

function applyTransform(value: string, transform: string): string | number {
  switch (transform) {
    case 'number':
      return parseFloat(value.replace(/,/g, '.')) || 0;
    case 'integer':
      return parseInt(value) || 0;
    case 'boolean':
      return ['true', '1', 'yes', 'oui', 'vrai'].includes(value.toLowerCase()) ? 1 : 0;
    case 'date': {
      const d = new Date(value);
      return isNaN(d.getTime()) ? value : d.toISOString().split('T')[0];
    }
    default:
      return String(value).trim();
  }
}

router.get('/', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const rows = db.prepare('SELECT * FROM loaders ORDER BY id').all() as any[];
  const loaders = rows.map(r => ({ ...r, mapping: JSON.parse(r.mapping ?? '[]') }));
  res.json({ loaders });
});

router.get('/tables', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const tables = ALLOWED_TABLES.map(name => {
    const cols = db.prepare(`PRAGMA table_info("${name}")`).all() as any[];
    return { name, columns: cols.map(c => ({ name: c.name, type: c.type })) };
  });
  res.json({ tables });
});

router.post('/parse', authMiddleware, upload.single('file'), (req: AuthRequest, res: Response): void => {
  if (!req.file) { res.status(400).json({ message: 'file is required' }); return; }
  const { file_format = 'csv', delimiter = ',', has_header = '1' } = req.body as Record<string, string>;
  try {
    const { headers, rows } = parseFile(req.file.buffer, file_format, delimiter, has_header !== '0');
    res.json({ headers, preview: rows.slice(0, 10) });
  } catch (err: any) {
    res.status(400).json({ message: `Parse error: ${err.message}` });
  }
});

router.post('/parse-image', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ message: 'file is required' }); return; }
  try {
    const { headers, rows, description } = await parseImageWithAI(req.file.buffer, req.file.mimetype);
    res.json({ headers, preview: rows.slice(0, 10), description });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', authMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const row = db.prepare('SELECT * FROM loaders WHERE id = ?').get(Number(req.params.id)) as any;
  if (!row) { res.status(404).json({ message: 'Loader not found' }); return; }
  res.json({ loader: { ...row, mapping: JSON.parse(row.mapping ?? '[]') } });
});

router.post('/', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const { name, file_format = 'csv', delimiter = ',', has_header = 1, target_table = 'products', upsert_key = '', on_conflict = 'skip', mapping = [] } = req.body;
  if (!name) { res.status(400).json({ message: 'name is required' }); return; }
  const db = getAccountDb(req.accountId!);
  const result = db.prepare(
    `INSERT INTO loaders (name, file_format, delimiter, has_header, target_table, upsert_key, on_conflict, mapping) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(name, file_format, delimiter, has_header ? 1 : 0, target_table, upsert_key, on_conflict, JSON.stringify(mapping)) as any;
  const loader = db.prepare('SELECT * FROM loaders WHERE id = ?').get(Number(result.lastInsertRowid)) as any;
  res.status(201).json({ loader: { ...loader, mapping: JSON.parse(loader.mapping ?? '[]') } });
});

router.put('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const existing = db.prepare('SELECT * FROM loaders WHERE id = ?').get(Number(req.params.id)) as any;
  if (!existing) { res.status(404).json({ message: 'Loader not found' }); return; }
  const { name, file_format, delimiter, has_header, target_table, upsert_key, on_conflict, mapping } = req.body;
  db.prepare(
    `UPDATE loaders SET name=?, file_format=?, delimiter=?, has_header=?, target_table=?, upsert_key=?, on_conflict=?, mapping=?, updated_at=datetime('now') WHERE id=?`
  ).run(
    name ?? existing.name,
    file_format ?? existing.file_format,
    delimiter ?? existing.delimiter,
    has_header !== undefined ? (has_header ? 1 : 0) : existing.has_header,
    target_table ?? existing.target_table,
    upsert_key !== undefined ? upsert_key : existing.upsert_key,
    on_conflict ?? existing.on_conflict,
    mapping !== undefined ? JSON.stringify(mapping) : existing.mapping,
    Number(req.params.id)
  );
  const loader = db.prepare('SELECT * FROM loaders WHERE id = ?').get(Number(req.params.id)) as any;
  res.json({ loader: { ...loader, mapping: JSON.parse(loader.mapping ?? '[]') } });
});

router.delete('/:id', adminMiddleware, (req: AuthRequest, res: Response): void => {
  const db = getAccountDb(req.accountId!);
  const existing = db.prepare('SELECT id FROM loaders WHERE id = ?').get(Number(req.params.id));
  if (!existing) { res.status(404).json({ message: 'Loader not found' }); return; }
  db.prepare('DELETE FROM loaders WHERE id = ?').run(Number(req.params.id));
  res.json({ message: 'deleted' });
});

router.post('/:id/test', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ message: 'file is required' }); return; }
  const db = getAccountDb(req.accountId!);
  const loader = db.prepare('SELECT * FROM loaders WHERE id = ?').get(Number(req.params.id)) as any;
  if (!loader) { res.status(404).json({ message: 'Loader not found' }); return; }

  const mapping: MappingEntry[] = JSON.parse(loader.mapping ?? '[]');
  const { target_table, upsert_key, on_conflict, file_format, delimiter, has_header } = loader;

  let rows: Record<string, string>[];
  try {
    if (file_format === 'image') {
      const result = await parseImageWithAI(req.file.buffer, req.file.mimetype);
      rows = result.rows;
    } else {
      rows = parseFile(req.file.buffer, file_format, delimiter, has_header === 1).rows;
    }
  } catch (err: any) {
    res.status(400).json({ message: `Parse error: ${err.message}` }); return;
  }

  const total = rows.length;
  let inserted = 0, skipped = 0, replaced = 0;
  const errors: string[] = [];
  const preview: Record<string, any>[] = [];

  for (let i = 0; i < rows.length; i++) {
    if (errors.length >= 20) break;
    const row = rows[i];
    try {
      const targetRow: Record<string, string | number> = {};
      for (const entry of mapping) {
        if (!entry.source || !entry.target) continue;
        targetRow[entry.target] = applyTransform(row[entry.source] ?? '', entry.transform);
      }
      const cols = Object.keys(targetRow);
      if (cols.length === 0) { skipped++; continue; }

      let action: 'insert' | 'skip' | 'replace' = 'insert';
      if (upsert_key && targetRow[upsert_key] !== undefined) {
        const existing = db.prepare(`SELECT id FROM "${target_table}" WHERE "${upsert_key}" = ?`).get(targetRow[upsert_key]) as any;
        if (existing) action = on_conflict === 'skip' ? 'skip' : 'replace';
      }

      if (action === 'insert') inserted++;
      else if (action === 'skip') skipped++;
      else replaced++;

      if (preview.length < 20) preview.push({ _action: action, ...targetRow });
    } catch (err: any) {
      errors.push(`Row ${i + 1}: ${err.message}`);
    }
  }

  res.json({ total, inserted, skipped, replaced, errors, preview });
});

router.post('/:id/run', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ message: 'file is required' }); return; }
  const db = getAccountDb(req.accountId!);
  const loader = db.prepare('SELECT * FROM loaders WHERE id = ?').get(Number(req.params.id)) as any;
  if (!loader) { res.status(404).json({ message: 'Loader not found' }); return; }

  const mapping: MappingEntry[] = JSON.parse(loader.mapping ?? '[]');
  const { target_table, upsert_key, on_conflict, file_format, delimiter, has_header } = loader;

  let rows: Record<string, string>[];
  try {
    if (file_format === 'image') {
      const result = await parseImageWithAI(req.file.buffer, req.file.mimetype);
      rows = result.rows;
    } else {
      rows = parseFile(req.file.buffer, file_format, delimiter, has_header === 1).rows;
    }
  } catch (err: any) {
    res.status(400).json({ message: `Parse error: ${err.message}` });
    return;
  }

  const total = rows.length;
  let inserted = 0;
  let skipped = 0;
  let replaced = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    if (errors.length >= 20) break;
    const row = rows[i];
    try {
      const targetRow: Record<string, string | number> = {};
      for (const entry of mapping) {
        if (!entry.source || !entry.target) continue;
        const rawValue = row[entry.source] ?? '';
        targetRow[entry.target] = applyTransform(rawValue, entry.transform);
      }

      const cols = Object.keys(targetRow);
      if (cols.length === 0) { skipped++; continue; }

      if (upsert_key && targetRow[upsert_key] !== undefined) {
        const existing = db.prepare(`SELECT id FROM "${target_table}" WHERE "${upsert_key}" = ?`).get(targetRow[upsert_key]) as any;
        if (existing) {
          if (on_conflict === 'skip') {
            skipped++;
          } else {
            const sets = cols.map(c => `"${c}" = ?`).join(', ');
            db.prepare(`UPDATE "${target_table}" SET ${sets} WHERE id = ?`).run(...cols.map(c => targetRow[c]), existing.id);
            replaced++;
          }
        } else {
          const placeholders = cols.map(() => '?').join(', ');
          db.prepare(`INSERT INTO "${target_table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`).run(...cols.map(c => targetRow[c]));
          inserted++;
        }
      } else {
        const placeholders = cols.map(() => '?').join(', ');
        db.prepare(`INSERT INTO "${target_table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`).run(...cols.map(c => targetRow[c]));
        inserted++;
      }
    } catch (err: any) {
      errors.push(`Row ${i + 1}: ${err.message}`);
    }
  }

  res.json({ total, inserted, skipped, replaced, errors });
});

export default router;
