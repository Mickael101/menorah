import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { socketService } from '../services/socket.service';

const router = Router();

// Configure upload directories
const gifUploadDir = path.join(__dirname, '../../public/uploads/gifs');
const audioUploadDir = path.join(__dirname, '../../public/uploads/audio');

// Ensure upload directories exist
if (!fs.existsSync(gifUploadDir)) {
  fs.mkdirSync(gifUploadDir, { recursive: true });
}
if (!fs.existsSync(audioUploadDir)) {
  fs.mkdirSync(audioUploadDir, { recursive: true });
}

// Configure multer for GIF uploads (50MB max)
const gifStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, gifUploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `gif-${uniqueSuffix}${ext}`);
  }
});

const gifUpload = multer({
  storage: gifStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/gif', 'image/png', 'image/jpeg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only GIF and image files are allowed'));
    }
  }
});

// Configure multer for audio uploads (50MB max)
const audioStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, audioUploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `audio-${uniqueSuffix}${ext}`);
  }
});

const audioUpload = multer({
  storage: audioStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/m4a', 'audio/x-m4a'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed (mp3, wav, ogg, webm, aac, m4a)'));
    }
  }
});

// Store GIF-audio associations in memory (could be moved to DB)
const gifAudioMap = new Map<string, string>();
const uploadDir = gifUploadDir; // Keep for backward compatibility

// GET /api/gifs - List all uploaded GIFs with their associated audio
router.get('/', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(gifUploadDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(gifUploadDir);
    const gifs = files
      .filter(file => /\.(gif|png|jpg|jpeg|webp)$/i.test(file))
      .map(file => ({
        filename: file,
        url: `/uploads/gifs/${file}`,
        audioUrl: gifAudioMap.get(file) || null,
        uploadedAt: fs.statSync(path.join(gifUploadDir, file)).mtime
      }))
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

    res.json(gifs);
  } catch (error) {
    console.error('Error listing GIFs:', error);
    res.status(500).json({ error: 'Failed to list GIFs' });
  }
});

// POST /api/gifs/upload - Upload a new GIF (50MB max)
router.post('/upload', gifUpload.single('gif'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const gif = {
      filename: req.file.filename,
      url: `/uploads/gifs/${req.file.filename}`,
      audioUrl: null,
      uploadedAt: new Date()
    };

    res.json(gif);
  } catch (error) {
    console.error('Error uploading GIF:', error);
    res.status(500).json({ error: 'Failed to upload GIF' });
  }
});

// POST /api/gifs/upload-audio - Upload audio file
router.post('/upload-audio', audioUpload.single('audio'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const audio = {
      filename: req.file.filename,
      url: `/uploads/audio/${req.file.filename}`,
      uploadedAt: new Date()
    };

    res.json(audio);
  } catch (error) {
    console.error('Error uploading audio:', error);
    res.status(500).json({ error: 'Failed to upload audio' });
  }
});

// POST /api/gifs/associate-audio - Associate audio with a GIF
router.post('/associate-audio', (req: Request, res: Response) => {
  try {
    const { gifFilename, audioUrl } = req.body;

    if (!gifFilename) {
      return res.status(400).json({ error: 'gifFilename is required' });
    }

    if (audioUrl) {
      gifAudioMap.set(gifFilename, audioUrl);
    } else {
      gifAudioMap.delete(gifFilename);
    }

    res.json({ success: true, gifFilename, audioUrl });
  } catch (error) {
    console.error('Error associating audio:', error);
    res.status(500).json({ error: 'Failed to associate audio' });
  }
});

// POST /api/gifs/trigger - Trigger GIF (with optional audio) on all display pages
router.post('/trigger', (req: Request, res: Response) => {
  try {
    const { gifUrl, audioUrl } = req.body;

    if (!gifUrl) {
      return res.status(400).json({ error: 'gifUrl is required' });
    }

    // Get associated audio if not provided
    const filename = gifUrl.split('/').pop();
    const finalAudioUrl = audioUrl || (filename ? gifAudioMap.get(filename) : null);

    // Emit to all connected display pages
    socketService.emitGifTrigger(gifUrl, finalAudioUrl || undefined);

    res.json({ success: true, message: 'GIF triggered on all displays', audioUrl: finalAudioUrl });
  } catch (error) {
    console.error('Error triggering GIF:', error);
    res.status(500).json({ error: 'Failed to trigger GIF' });
  }
});

// GET /api/gifs/audio - List all uploaded audio files
router.get('/audio', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(audioUploadDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(audioUploadDir);
    const audioFiles = files
      .filter(file => /\.(mp3|wav|ogg|webm|aac|m4a)$/i.test(file))
      .map(file => ({
        filename: file,
        url: `/uploads/audio/${file}`,
        uploadedAt: fs.statSync(path.join(audioUploadDir, file)).mtime
      }))
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

    res.json(audioFiles);
  } catch (error) {
    console.error('Error listing audio files:', error);
    res.status(500).json({ error: 'Failed to list audio files' });
  }
});

// DELETE /api/gifs/audio/:filename - Delete an audio file
router.delete('/audio/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(audioUploadDir, filename);

    if (!filePath.startsWith(audioUploadDir)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Audio file not found' });
    }

    fs.unlinkSync(filePath);

    // Remove from any GIF associations
    for (const [gifFile, audioUrl] of gifAudioMap.entries()) {
      if (audioUrl.includes(filename)) {
        gifAudioMap.delete(gifFile);
      }
    }

    res.json({ success: true, message: 'Audio file deleted' });
  } catch (error) {
    console.error('Error deleting audio:', error);
    res.status(500).json({ error: 'Failed to delete audio file' });
  }
});

// DELETE /api/gifs/:filename - Delete a GIF
router.delete('/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(gifUploadDir, filename);

    if (!filePath.startsWith(gifUploadDir)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'GIF not found' });
    }

    fs.unlinkSync(filePath);
    gifAudioMap.delete(filename);

    res.json({ success: true, message: 'GIF deleted' });
  } catch (error) {
    console.error('Error deleting GIF:', error);
    res.status(500).json({ error: 'Failed to delete GIF' });
  }
});

export default router;
