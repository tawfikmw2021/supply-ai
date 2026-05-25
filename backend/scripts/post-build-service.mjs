/**
 * Builds a self-contained dist-service/ folder at the repo root:
 *   node.exe                   Node.js binary copied from current PATH
 *   app/dist/                  compiled backend TypeScript
 *   app/public/                built frontend (served at http://host:3100)
 *   app/node_modules/          production dependencies
 *   .env.example
 *   start.bat                  run as foreground process
 *   install-service.bat        install as Windows Service
 *   uninstall-service.bat
 *
 * Run from backend/: npm run service:build
 */
import fs   from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const backendDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root       = path.dirname(backendDir);
const out        = path.join(root, 'dist-service');
const appDir     = path.join(out, 'app');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(appDir, { recursive: true });

// ── 1. Copy compiled backend ─────────────────────────────────────────────────
fs.cpSync(path.join(backendDir, 'dist'), path.join(appDir, 'dist'), { recursive: true });
console.log('✓ copied backend/dist');

// ── 1b. Copy SSL certs if present ────────────────────────────────────────────
const certsSrc = path.join(backendDir, 'certs');
if (fs.existsSync(certsSrc)) {
  fs.cpSync(certsSrc, path.join(appDir, 'certs'), { recursive: true });
  console.log('✓ copied certs');
} else {
  console.warn('⚠ certs not found — HTTPS will be disabled. Run: npm run gen-certs');
}

// ── 1c. Copy built frontend (served as static files at /) ────────────────────
const publicSrc = path.join(backendDir, 'public');
if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, path.join(appDir, 'public'), { recursive: true });
  console.log('✓ copied public (frontend)');
} else {
  console.warn('⚠ public/ not found — run: npm run build:frontend first');
}

// ── 2. Install production node_modules ───────────────────────────────────────
fs.copyFileSync(path.join(backendDir, 'package.json'), path.join(appDir, 'package.json'));
execSync('npm install --omit=dev', { cwd: appDir, stdio: 'inherit' });
console.log('✓ npm install (prod)');

// ── 3. Copy node.exe from PATH ────────────────────────────────────────────────
const nodeDest = path.join(out, 'node.exe');
fs.copyFileSync(process.execPath, nodeDest);
console.log(`✓ copied node.exe from ${process.execPath}`);

// ── 4. Launcher scripts ───────────────────────────────────────────────────────
const nodeExe = '%~dp0node.exe';
const entryJs = '%~dp0app\\dist\\service.js';
const svcName = 'SupplyAIBackend';

fs.writeFileSync(path.join(out, '.env.example'), [
  '# Rename to .env to customise settings',
  'PORT=3100',
  'HTTPS_PORT=3543',
  '# DATA_DIR=C:\\ProgramData\\SupplyAI\\data',
  '# ANTHROPIC_API_KEY=',
].join('\r\n'));

fs.writeFileSync(path.join(out, 'start.bat'), [
  '@echo off',
  ':: Check for VC++ runtime (needed by native Node modules)',
  'if not exist "%SystemRoot%\\System32\\vcruntime140.dll" (',
  '  echo WARNING: Visual C++ 2022 Runtime may be missing.',
  '  echo Download: https://aka.ms/vs/17/release/vc_redist.x64.exe',
  '  echo.',
  ')',
  `"${nodeExe}" "${entryJs}"`,
  'pause',
].join('\r\n'));

fs.writeFileSync(path.join(out, 'install-service.bat'), [
  '@echo off',
  'net session >nul 2>&1 || (echo Run as Administrator && pause && exit /b 1)',
  `set NODE="${nodeExe}"`,
  `set ENTRY="${entryJs}"`,
  `set SVC=${svcName}`,
  '',
  'where nssm >nul 2>&1',
  'if %errorlevel%==0 (',
  '  nssm install %SVC% %NODE% %ENTRY%',
  '  nssm set %SVC% AppDirectory "%~dp0"',
  '  nssm set %SVC% Start SERVICE_AUTO_START',
  '  nssm start %SVC%',
  ') else (',
  `  sc create %SVC% binPath= "%NODE% %ENTRY%" start= auto`,
  '  sc start %SVC%',
  ')',
  'echo Done. && pause',
].join('\r\n'));

fs.writeFileSync(path.join(out, 'uninstall-service.bat'), [
  '@echo off',
  'net session >nul 2>&1 || (echo Run as Administrator && pause && exit /b 1)',
  `sc stop  ${svcName}`,
  `sc delete ${svcName}`,
  'echo Done. && pause',
].join('\r\n'));

console.log('\n✓ dist-service/ ready');
console.log('  Run:     dist-service\\start.bat');
console.log('  Service: dist-service\\install-service.bat  (as Administrator)');
console.log(`\n  Node version bundled: ${process.version}`);
