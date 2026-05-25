import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

const DEFAULT_DATA_DIR = '../backend/data';

function readCfg(): Record<string, string> {
  const f = process.env.CONFIG_FILE;
  if (!f) return {};
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; }
}

function writeCfg(cfg: Record<string, string>) {
  const f = process.env.CONFIG_FILE;
  if (!f) throw new Error('CONFIG_FILE not set — cannot persist config');
  fs.writeFileSync(f, JSON.stringify(cfg, null, 2));
}

/** Resolve a (possibly relative) data-dir value against the config file's directory. */
function resolveDataDir(raw: string): string {
  if (path.isAbsolute(raw)) return raw;
  const configDir = process.env.CONFIG_FILE
    ? path.dirname(process.env.CONFIG_FILE)
    : path.join(__dirname, '..', '..');  // fallback: backend root
  return path.resolve(configDir, raw);
}

// GET /config/data-dir — public, no auth required
router.get('/data-dir', (_req: Request, res: Response): void => {
  const stored   = readCfg().DATA_DIR ?? null;
  const resolved = process.env.DATA_DIR || resolveDataDir(stored ?? DEFAULT_DATA_DIR);
  res.json({
    stored,                    // raw value saved in config.json (null = not set)
    resolved,                  // absolute path after resolution
    current: resolved,         // backward-compat alias
    default: DEFAULT_DATA_DIR, // default raw value shown to the user
    configFile: process.env.CONFIG_FILE ?? null,
  });
});

// PUT /config/data-dir — public, no auth required
router.put('/data-dir', (req: Request, res: Response): void => {
  const newPath: string = (req.body.path ?? '').trim();
  if (!newPath) { res.status(400).json({ message: 'path is required' }); return; }
  try {
    const cfg = readCfg();
    cfg.DATA_DIR = newPath;
    writeCfg(cfg);
    res.json({ ok: true, path: newPath, restartRequired: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /config/data-dir — resets to default
router.delete('/data-dir', (_req: Request, res: Response): void => {
  try {
    const cfg = readCfg();
    delete cfg.DATA_DIR;
    writeCfg(cfg);
    res.json({ ok: true, restartRequired: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
