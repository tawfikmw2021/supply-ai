import { defineConfig, Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'fs';
import https from 'https';
import path from 'path';

const certsDir = path.resolve(__dirname, '../backend/certs');
const keyPath  = path.join(certsDir, 'server.key');
const certPath = path.join(certsDir, 'server.crt');

const httpsConfig =
  fs.existsSync(keyPath) && fs.existsSync(certPath)
    ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
    : undefined;

const httpsMirrorPlugin = (): Plugin => ({
  name: 'https-mirror',
  configureServer(server) {
    if (!httpsConfig) return;
    server.httpServer?.once('listening', () => {
      const httpsPort = 5174;
      https.createServer(httpsConfig, server.middlewares).listen(httpsPort, '0.0.0.0', () => {
        console.log(`  HTTPS mirror: https://0.0.0.0:${httpsPort}/`);
      });
    });
  },
});

export default defineConfig({
  plugins: [vue(), httpsMirrorPlugin()],
  build: {
    outDir: '../backend/public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/auth':      { target: 'http://localhost:3100', changeOrigin: true },
      '/accounts':  {
        target: 'http://localhost:3100',
        changeOrigin: true,
        bypass(req: any) {
          // Browser page navigations (Accept: text/html) must get index.html,
          // not be forwarded to the backend — only API calls should be proxied.
          if (req.headers.accept?.includes('text/html')) return '/index.html';
        },
      },
      '/products':  { target: 'http://localhost:3100', changeOrigin: true },
      '/documents': { target: 'http://localhost:3100', changeOrigin: true },
      '/audit':     { target: 'http://localhost:3100', changeOrigin: true },
      '/suppliers': { target: 'http://localhost:3100', changeOrigin: true },
      '/clients':   { target: 'http://localhost:3100', changeOrigin: true },
      '/users':     { target: 'http://localhost:3100', changeOrigin: true },
      '/invoices':  { target: 'http://localhost:3100', changeOrigin: true },
      '/templates': { target: 'http://localhost:3100', changeOrigin: true },
      '/dashboard': { target: 'http://localhost:3100', changeOrigin: true },
      '/loaders':   { target: 'http://localhost:3100', changeOrigin: true },
      '/uploads':   { target: 'http://localhost:3100', changeOrigin: true },
    },
  },
});
