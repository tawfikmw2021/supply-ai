import { Router, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { getAccountDb } from '../accountDb';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { UPLOADS_DIR } from './documents';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const MIN_MATCHES = 12;
const MAX_SIZE = 800;

// ── Initialize OpenCV once ────────────────────────────
let cv: any = null;
const cvReady = new Promise<void>((resolve, reject) => {
  try {
    const lib = require('@techstark/opencv-js');
    lib.onRuntimeInitialized = () => { cv = lib; resolve(); };
    setTimeout(() => reject(new Error('OpenCV init timeout')), 15000);
  } catch (e) { reject(e); }
});

async function toGrayMat(buffer: Buffer): Promise<any> {
  const { data, info } = await sharp(buffer)
    .resize({ width: MAX_SIZE, height: MAX_SIZE, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgba = new cv.Mat(info.height, info.width, cv.CV_8UC4);
  rgba.data.set(new Uint8Array(data.buffer));
  const gray = new cv.Mat();
  cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
  rgba.delete();
  return gray;
}

router.post('/', authMiddleware, upload.single('image'), async (req: AuthRequest, res: Response): Promise<void> => {
  await cvReady;
  if (!req.file) { res.status(400).json({ message: 'No image' }); return; }

  const db = getAccountDb(req.accountId!);
  const products = db.prepare(`
    SELECT p.id, p.name, p.code, p.category, p.sale_price, d.url
    FROM products p
    JOIN documents d ON p.document_id = d.id
    WHERE d.type = 'image'
  `).all() as any[];

  if (!products.length) { res.json({ detected: [] }); return; }

  let sceneGray: any, sceneKp: any, sceneDesc: any, orb: any;
  try {
    sceneGray = await toGrayMat(req.file.buffer);
    sceneKp   = new cv.KeyPointVector();
    sceneDesc = new cv.Mat();
    orb       = new cv.ORB(1500);
    orb.detectAndCompute(sceneGray, new cv.Mat(), sceneKp, sceneDesc);

    if (sceneDesc.empty()) { res.json({ detected: [] }); return; }

    const detected: any[] = [];

    for (const p of products) {
      const imgPath = path.join(UPLOADS_DIR, path.basename(p.url));
      if (!fs.existsSync(imgPath)) continue;

      let tmplGray: any, tmplKp: any, tmplDesc: any, bf: any, matches: any;
      try {
        tmplGray = await toGrayMat(fs.readFileSync(imgPath));
        tmplKp   = new cv.KeyPointVector();
        tmplDesc = new cv.Mat();
        orb.detectAndCompute(tmplGray, new cv.Mat(), tmplKp, tmplDesc);

        if (tmplDesc.empty()) continue;

        bf      = new cv.BFMatcher(cv.NORM_HAMMING, true);
        matches = new cv.DMatchVector();
        bf.match(tmplDesc, sceneDesc, matches);

        let good = 0;
        for (let i = 0; i < matches.size(); i++) {
          if (matches.get(i).distance < 55) good++;
        }

        if (good >= MIN_MATCHES) {
          detected.push({
            id: p.id, name: p.name, code: p.code,
            category: p.category, sale_price: p.sale_price,
            matches: good,
            confidence: Math.min(99, Math.round((good / (good + 5)) * 100)),
          });
        }
      } finally {
        tmplGray?.delete(); tmplDesc?.delete(); tmplKp?.delete();
        bf?.delete(); matches?.delete();
      }
    }

    detected.sort((a, b) => b.matches - a.matches);
    res.json({ detected });

  } finally {
    sceneGray?.delete(); sceneDesc?.delete(); sceneKp?.delete(); orb?.delete();
  }
});

export default router;
