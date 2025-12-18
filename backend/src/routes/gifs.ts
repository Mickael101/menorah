import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { socketService } from '../services/socket.service';

const router = Router();

// Configure upload directory
const uploadDir = path.join(__dirname, '../../public/uploads/gifs');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for GIF uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `gif-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    // Accept only GIF and image files
    const allowedTypes = ['image/gif', 'image/png', 'image/jpeg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only GIF and image files are allowed'));
    }
  }
});

// GET /api/gifs - List all uploaded GIFs
router.get('/', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(uploadDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(uploadDir);
    const gifs = files
      .filter(file => /\.(gif|png|jpg|jpeg|webp)$/i.test(file))
      .map(file => ({
        filename: file,
        url: `/uploads/gifs/${file}`,
        uploadedAt: fs.statSync(path.join(uploadDir, file)).mtime
      }))
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

    res.json(gifs);
  } catch (error) {
    console.error('Error listing GIFs:', error);
    res.status(500).json({ error: 'Failed to list GIFs' });
  }
});

// POST /api/gifs/upload - Upload a new GIF
router.post('/upload', upload.single('gif'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const gif = {
      filename: req.file.filename,
      url: `/uploads/gifs/${req.file.filename}`,
      uploadedAt: new Date()
    };

    res.json(gif);
  } catch (error) {
    console.error('Error uploading GIF:', error);
    res.status(500).json({ error: 'Failed to upload GIF' });
  }
});

// POST /api/gifs/trigger - Trigger GIF on all display pages
router.post('/trigger', (req: Request, res: Response) => {
  try {
    const { gifUrl } = req.body;

    if (!gifUrl) {
      return res.status(400).json({ error: 'gifUrl is required' });
    }

    // Emit to all connected display pages
    socketService.emitGifTrigger(gifUrl);

    res.json({ success: true, message: 'GIF triggered on all displays' });
  } catch (error) {
    console.error('Error triggering GIF:', error);
    res.status(500).json({ error: 'Failed to trigger GIF' });
  }
});

// DELETE /api/gifs/:filename - Delete a GIF
router.delete('/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadDir, filename);

    // Security check - prevent directory traversal
    if (!filePath.startsWith(uploadDir)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'GIF not found' });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, message: 'GIF deleted' });
  } catch (error) {
    console.error('Error deleting GIF:', error);
    res.status(500).json({ error: 'Failed to delete GIF' });
  }
});

export default router;
