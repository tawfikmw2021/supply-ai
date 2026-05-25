/**
 * Runs the backend dev server under Electron's bundled Node runtime
 * (ELECTRON_RUN_AS_NODE=1) so that better_sqlite3.node's ABI always
 * matches what electron-rebuild produces — no rebuild needed when
 * switching between `npm run dev` and electron:start.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import path from 'path';

const backendDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root       = path.dirname(backendDir);
const isWin      = process.platform === 'win32';

// Electron binary: prefer legacy/node_modules, fall back to root node_modules
let electronExe;
try {
  electronExe = createRequire(path.join(root, 'legacy', 'package.json'))('electron');
} catch {
  electronExe = createRequire(import.meta.url)('electron');
}

const nodemonBin = path.join(backendDir, 'node_modules', '.bin', isWin ? 'nodemon.cmd' : 'nodemon');

process.env.ELECTRON_RUN_AS_NODE = '1';

const child = spawn(
  nodemonBin,
  [
    '--watch', 'src', '--ext', 'ts',
    '--exec', `"${electronExe}" --require ts-node/register src/index.ts`,
  ],
  {
    cwd: backendDir,
    stdio: 'inherit',
    shell: true,
  }
);

child.on('exit', code => process.exit(code ?? 0));
