/**
 * Standalone entry point — used by pkg to create backend.exe.
 * Sets env vars from adjacent .env / config.json before loading the app.
 */
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import Module from 'module';

const isPkg = !!(process as any).pkg;

// Redirect .node native module lookups to files placed next to the exe.
// pkg's virtual FS intercepts require() before the OS loader, so bindings'
// path-traversal fails inside the snapshot. We short-circuit it here.
if (isPkg) {
  const exeDir = path.dirname(process.execPath);
  const nativeMap: Record<string, string> = {
    'better_sqlite3.node': path.join(exeDir, 'better_sqlite3.node'),
    'sharp-win32-x64.node': path.join(exeDir, '@img', 'sharp-win32-x64', 'lib', 'sharp-win32-x64.node'),
  };
  const orig = (Module as any)._resolveFilename.bind(Module);
  (Module as any)._resolveFilename = function (request: string, ...args: any[]) {
    for (const [name, abs] of Object.entries(nativeMap)) {
      if (request.endsWith(name)) return abs;
    }
    return orig(request, ...args);
  };
}
const baseDir = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '..', '..');

// Load .env if present next to the exe (does not overwrite already-set vars)
const envFile = path.join(baseDir, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// Persistent config stored next to the exe
const cfgFile = path.join(baseDir, 'config.json');
let cfg: Record<string, string> = {};
try { cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch {}
if (!cfg.JWT_SECRET) {
  cfg.JWT_SECRET = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
}

process.env.JWT_SECRET  ??= cfg.JWT_SECRET;
process.env.PORT        ??= '3100';
process.env.HTTPS_PORT  ??= '3543';
const rawDataDir = cfg.DATA_DIR ?? '../backend/data';
process.env.DATA_DIR ??= path.isAbsolute(rawDataDir)
  ? rawDataDir
  : path.resolve(baseDir, rawDataDir);
process.env.CONFIG_FILE  = cfgFile;

// Start the Express app
require('./index');
