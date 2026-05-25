import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import os from 'os';
import { spawn } from 'child_process';

// Write all stdout/stderr to a log file next to the AppImage
function setupFileLogging() {
  const logDir = app.isPackaged
    ? path.join(process.env.APPIMAGE ? path.dirname(process.env.APPIMAGE) : path.dirname(app.getPath('exe')), 'data')
    : path.join(__dirname, '..', '..', '..', 'data');
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, 'app.log');
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  const tag = () => `[${new Date().toISOString()}] `;
  const origLog = console.log.bind(console);
  const origErr = console.error.bind(console);
  console.log = (...args) => { const line = tag() + args.join(' '); origLog(line); logStream.write(line + '\n'); };
  console.error = (...args) => { const line = tag() + '[ERR] ' + args.join(' '); origErr(line); logStream.write(line + '\n'); };
  process.on('uncaughtException', (err) => { console.error('uncaughtException', err.stack ?? err); });
  process.on('unhandledRejection', (reason) => { console.error('unhandledRejection', reason); });
}

setupFileLogging();

let mainWindow: BrowserWindow | null = null;

const BACKEND_PORT = Number(process.env.PORT ?? 3100);

// ── Preferences (stored in %APPDATA%/Supply AI/ — survives data-dir changes) ─
function prefsPath() { return path.join(app.getPath('userData'), 'prefs.json'); }
function readPrefs(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(prefsPath(), 'utf8')); } catch { return {}; }
}
function writePrefs(prefs: Record<string, string>) {
  fs.mkdirSync(path.dirname(prefsPath()), { recursive: true });
  fs.writeFileSync(prefsPath(), JSON.stringify(prefs, null, 2));
}

// Resolve the data directory: custom pref → next to exe (packaged) → ./data (dev)
function resolveDataDir(): string {
  const custom = readPrefs().dataDir;
  if (custom) return custom;
  if (app.isPackaged) {
    const base = process.env.APPIMAGE
      ? path.dirname(process.env.APPIMAGE)
      : path.dirname(app.getPath('exe'));
    return path.join(base, 'data');
  }
  return path.join(__dirname, '..', '..', '..', 'data');
}

function waitForBackend(retries = 30): Promise<void> {
  return new Promise((resolve, reject) => {
    const attempt = (n: number) => {
      http
        .get(`http://localhost:${BACKEND_PORT}/health`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else if (n > 0) {
            setTimeout(() => attempt(n - 1), 500);
          } else {
            reject(new Error('Backend failed to start'));
          }
        })
        .on('error', () => {
          if (n > 0) setTimeout(() => attempt(n - 1), 500);
          else reject(new Error('Backend failed to start'));
        });
    };
    attempt(retries);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
  mainWindow.webContents.openDevTools();
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Set DATA_DIR before requiring the backend so all path constants pick it up
  const dataDir = resolveDataDir();
  fs.mkdirSync(path.join(dataDir, 'uploads', 'documents'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'uploads', 'help'), { recursive: true });
  process.env.DATA_DIR = dataDir;

  // Persist a JWT secret so it survives restarts
  const configPath = path.join(dataDir, 'config.json');
  let config: Record<string, string> = {};
  try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
  if (!config.JWT_SECRET) {
    config.JWT_SECRET = require('crypto').randomBytes(48).toString('hex');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
  process.env.JWT_SECRET  = config.JWT_SECRET;
  process.env.PORT        ??= '3100';
  process.env.HTTPS_PORT  ??= '3543';
  process.env.CONFIG_FILE  = configPath;

  // Start the Express backend in-process
  require(path.join(__dirname, '..', '..', '..', 'backend', 'dist', 'index.js'));

  try {
    await waitForBackend();
  } catch (err) {
    console.error('Backend did not become ready:', err);
  }

  createWindow();

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Data directory settings ──────────────────────────────────────────────────
ipcMain.handle('app:get-data-dir', () => process.env.DATA_DIR ?? '');

ipcMain.handle('app:pick-data-dir', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choisir le dossier de données',
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('app:set-data-dir', (_event, newDir: string) => {
  const prefs = readPrefs();
  prefs.dataDir = newDir;
  writePrefs(prefs);
  app.relaunch();
  app.quit();
});

// ── Update from URL ──────────────────────────────────────────────────────────
ipcMain.handle('app:update-from-url', async (event, url: string) => {
  const tmpExe = path.join(os.tmpdir(), `supply-ai-update-${Date.now()}.exe`);

  await new Promise<void>((resolve, reject) => {
    function download(u: string, redirects = 8) {
      const mod = u.startsWith('https') ? https : http;
      mod.get(u, (res) => {
        if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode)) {
          if (redirects <= 0) return reject(new Error('Too many redirects'));
          return download(res.headers.location as string, redirects - 1);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

        const total = parseInt(res.headers['content-length'] ?? '0', 10);
        let received = 0;
        const file = fs.createWriteStream(tmpExe);

        res.on('data', (chunk: Buffer) => {
          received += chunk.length;
          const pct = total > 0 ? Math.round(received / total * 100) : -1;
          event.sender.send('app:update-progress', pct);
        });

        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        res.on('error', (e) => { file.destroy(); reject(e); });
        file.on('error', reject);
      }).on('error', reject);
    }
    download(url);
  });

  // Batch script: wait for app to exit, replace exe, relaunch
  const currentExe = app.getPath('exe');
  const batch = path.join(os.tmpdir(), 'supply-ai-updater.bat');
  fs.writeFileSync(batch, [
    '@echo off',
    'timeout /t 2 /nobreak > nul',
    `copy /y "${tmpExe}" "${currentExe}"`,
    `start "" "${currentExe}"`,
    `del "${tmpExe}"`,
    'del "%~f0"',
  ].join('\r\n'));

  spawn('cmd.exe', ['/c', batch], { detached: true, stdio: 'ignore' }).unref();
  app.quit();
});

// Native file-picker for document uploads (used via window.electronAPI.openUploadDialog)
ipcMain.handle('upload:openDialog', async (_event, filters?: Electron.FileFilter[]) => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  return dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: filters ?? [
      { name: 'Documents', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
});
