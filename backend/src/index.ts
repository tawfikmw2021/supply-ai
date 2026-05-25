import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger';
import db from './db';
import { getAccountDb } from './accountDb';
import { pgPool } from './clientDb';
import authRouter from './routes/auth';
import productsRouter from './routes/products';
import documentsRouter, { UPLOADS_DIR } from './routes/documents';
import accountsRouter from './routes/accounts';
import auditRouter from './routes/audit';
import suppliersRouter from './routes/suppliers';
import clientsRouter from './routes/clients';
import usersRouter from './routes/users';
import invoicesRouter from './routes/invoices';
import templatesRouter from './routes/templates';
import dashboardRouter from './routes/dashboard';
import loadersRouter from './routes/loaders';
import helpRouter from './routes/help';
import deliveriesRouter from './routes/deliveries';
import categoriesRouter from './routes/categories';
import alertsRouter from './routes/alerts';
import configRouter from './routes/config';
import scanRouter from './routes/scan';
import detectRouter from './routes/detect';
import pgRouter from './routes/pg';
import columnSettingsRouter from './routes/columnSettings';

// ── Migrate products/documents from main DB → account DBs (one-time) ────────
const mainTables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[];
if (mainTables.some(t => t.name === 'products')) {
  const accounts = db.prepare('SELECT id FROM accounts').all() as { id: number }[];
  for (const { id } of accounts) {
    const adb = getAccountDb(id);
    const products = db.prepare('SELECT * FROM products').all() as any[];
    for (const p of products) {
      try {
        adb.prepare('INSERT OR IGNORE INTO products (id,name,category,price,stock,description,document_id,created_at) VALUES (?,?,?,?,?,?,?,?)').run(p.id, p.name, p.category, p.price, p.stock, p.description, p.document_id ?? null, p.created_at);
      } catch {}
    }
    const documents = db.prepare('SELECT * FROM documents').all() as any[];
    for (const d of documents) {
      try {
        adb.prepare('INSERT OR IGNORE INTO documents (id,type,url,properties,created_at) VALUES (?,?,?,?,?)').run(d.id, d.type, d.url, d.properties, d.created_at);
      } catch {}
    }
  }
  db.exec('DROP TABLE IF EXISTS products; DROP TABLE IF EXISTS documents;');
  console.log('✓ Migrated products/documents to per-account databases');
}

// ── Express app ──────────────────────────────────────────────────────────────
const app = express();
const HTTP_PORT  = Number(process.env.PORT       ?? 3100);
const HTTPS_PORT = Number(process.env.HTTPS_PORT ?? 3543);

// Build the allowed-origins list: include HTTP + HTTPS for every known host
function bothProtocols(origin: string) {
  const bare = origin.replace(/^https?:\/\//, '');
  return [`http://${bare}`, `https://${bare}`];
}

const ALLOWED_ORIGINS = [
  ...bothProtocols('62.34.58.30:3315'),
  ...bothProtocols(`62.34.58.30:${HTTP_PORT}`),
  ...bothProtocols(`62.34.58.30:${HTTPS_PORT}`),
  ...bothProtocols('62.34.58.30'),
  ...bothProtocols('localhost:5173'),
  ...bothProtocols('localhost:5174'),
  ...bothProtocols('127.0.0.1:5173'),
  ...bothProtocols('172.20.10.3:5173'),
  ...bothProtocols('172.20.10.3:5174'),
  ...bothProtocols(`172.20.10.3:${HTTP_PORT}`),
  ...bothProtocols(`172.20.10.3:${HTTPS_PORT}`),
  ...bothProtocols('192.168.137.1:5173'),
  ...bothProtocols('192.168.137.1:5174'),
  ...bothProtocols(`192.168.137.1:${HTTP_PORT}`),
  ...bothProtocols(`192.168.137.1:${HTTPS_PORT}`),
  // Any extra origins from env (comma-separated)
  ...(process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) ?? []),
];

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin)),
  credentials: true,
}));
app.use(express.json());
app.use('/uploads/documents', (_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}, express.static(UPLOADS_DIR));

const HELP_UPLOADS_DIR = path.join(process.env.DATA_DIR ?? path.join(__dirname, '..', 'data'), 'uploads', 'help');
app.use('/uploads/help', (_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}, express.static(HELP_UPLOADS_DIR));

// ── API routes ───────────────────────────────────────────────────────────────
app.use('/auth', authRouter);
app.use('/accounts', accountsRouter);
app.use('/products', productsRouter);
app.use('/documents', documentsRouter);
app.use('/audit', auditRouter);
app.use('/suppliers', suppliersRouter);
app.use('/clients', clientsRouter);
app.use('/users', usersRouter);
app.use('/invoices', invoicesRouter);
app.use('/templates', templatesRouter);
app.use('/dashboard', dashboardRouter);
app.use('/loaders', loadersRouter);
app.use('/help', helpRouter);
app.use('/deliveries', deliveriesRouter);
app.use('/categories', categoriesRouter);
app.use('/alerts', alertsRouter);
app.use('/config', configRouter);
app.use('/scan', scanRouter);
app.use('/detect', detectRouter);
app.use('/pg', pgRouter);
app.use('/column-settings', columnSettingsRouter);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs-json', (_req, res) => res.json(swaggerSpec));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Serve built frontend (SPA) ───────────────────────────────────────────────
// Vite outputs to backend/public — works both in dev (ts-node, __dirname = src/)
// and in production (compiled, __dirname = dist/).
const publicPath = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  app.get('*', (_req, res) => res.sendFile(path.join(publicPath, 'index.html')));
  console.log(`✓ Serving frontend from ${publicPath}`);
}

// ── PostgreSQL health check ───────────────────────────────────────────────────
pgPool.query('SELECT 1').then(() => {
  console.log('✓ PostgreSQL connecté');
}).catch((err: Error) => {
  console.warn('⚠ PostgreSQL non disponible:', err.message);
});
process.on('SIGTERM', () => pgPool.end());
process.on('SIGINT',  () => pgPool.end());

// ── HTTP server ──────────────────────────────────────────────────────────────
http.createServer(app).listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`HTTP  → http://0.0.0.0:${HTTP_PORT}`);
});

// ── HTTPS server (if certs exist) ────────────────────────────────────────────
const certsDir = path.join(__dirname, '..', 'certs');
const keyPath   = path.join(certsDir, 'server.key');
const certPath  = path.join(certsDir, 'server.crt');

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  const credentials = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  https.createServer(credentials, app).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`HTTPS → https://0.0.0.0:${HTTPS_PORT}`);
  });
} else {
  console.warn('SSL certs not found — HTTPS disabled. Run: npm run gen-certs');
}
