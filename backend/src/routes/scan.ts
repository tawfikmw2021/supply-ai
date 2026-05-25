import { Router, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { readBarcodesFromImageData } from 'zxing-wasm/reader';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

router.post('/', authMiddleware, upload.single('image'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ message: 'No image' }); return; }
  try {
    const { data, info } = await sharp(req.file.buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const results = await readBarcodesFromImageData({
      data: new Uint8ClampedArray(data.buffer),
      width: info.width,
      height: info.height,
    });

    if (!results.length) { res.json({ barcode: null }); return; }
    res.json({ barcode: results[0].text });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
