import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { socketService } from '../services/socket.service';
import { mediaService } from '../services/media.service';
import { uploadsRoot } from '../config/storage';
import { requireEventAdmin } from '../middleware/admin-auth';
import { requestEventId } from '../middleware/resolve-event';
import { isInside } from '../middleware/path-boundary';
import { EventRouteContext } from './event-context';

// Configure upload directories
const gifUploadDir = path.join(uploadsRoot, 'gifs');
const audioUploadDir = path.join(uploadsRoot, 'audio');
const visualUploadDir = path.join(uploadsRoot, 'visuals');

// Ensure upload directories exist
for (const dir of [gifUploadDir, audioUploadDir, visualUploadDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
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

// SVGs are stored separately from celebration GIFs and are rendered as images,
// never injected into the page DOM.
const visualStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, visualUploadDir);
  },
  filename: (_req, _file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `visual-${uniqueSuffix}.svg`);
  }
});

const visualUpload = multer({
  storage: visualStorage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const isSvg = file.mimetype === 'image/svg+xml'
      && path.extname(file.originalname).toLowerCase() === '.svg';
    if (isSvg) {
      cb(null, true);
    } else {
      cb(new Error('Only SVG files are allowed'));
    }
  }
});

function isSafeSvg(source: string): boolean {
  const normalized = source.toLowerCase();
  return normalized.includes('<svg')
    && !/<script\b/i.test(source)
    && !/<foreignobject\b/i.test(source)
    && !/\son[a-z]+\s*=/i.test(source)
    && !/javascript\s*:/i.test(source)
    && !/<!doctype/i.test(source);
}

function audioUrlOf(audioFilename: string | null): string | null {
  return audioFilename ? `/uploads/audio/${audioFilename}` : null;
}

function mtimeOf(dir: string, filename: string): Date {
  try {
    return fs.statSync(path.join(dir, filename)).mtime;
  } catch {
    return new Date(0);
  }
}

// Fabrique : monte le meme corps sur la soiree active (herite) et sur la soiree
// nommee (prefixe). Les GIF, sons et associations sont cloisonnes par soiree via
// la table `media` — la lecture du repertoire a plat, qui melangeait toutes les
// soirees, a disparu.
export function createGifsRouter(ctx: EventRouteContext): Router {
  const router = Router({ mergeParams: true });
  const requireAdminOfEvent = requireEventAdmin(ctx.getTargetEventId);

  // GET /gifs - liste des GIF de la soiree, avec leur son associe (public)
  router.get('/', ctx.resolveEvent, (req: Request, res: Response) => {
    try {
      const gifs = mediaService.listGifs(requestEventId(req))
        .map((media) => ({
          filename: media.filename,
          url: `/uploads/gifs/${media.filename}`,
          audioUrl: audioUrlOf(media.audioFilename),
          uploadedAt: mtimeOf(gifUploadDir, media.filename)
        }))
        .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
      res.json(gifs);
    } catch (error) {
      console.error('Error listing GIFs:', error);
      res.status(500).json({ error: 'Failed to list GIFs' });
    }
  });

  // GET /gifs/audio - liste des audios de la soiree (public)
  router.get('/audio', ctx.resolveEvent, (req: Request, res: Response) => {
    try {
      const audioFiles = mediaService.listAudio(requestEventId(req))
        .map((filename) => ({
          filename,
          url: `/uploads/audio/${filename}`,
          uploadedAt: mtimeOf(audioUploadDir, filename)
        }))
        .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
      res.json(audioFiles);
    } catch (error) {
      console.error('Error listing audio files:', error);
      res.status(500).json({ error: 'Failed to list audio files' });
    }
  });

  // POST /gifs/upload - GIF (admin de la soiree). Auth et resolution AVANT
  // multer : un fichier n'est ecrit sur disque que pour une requete autorisee.
  router.post('/upload', requireAdminOfEvent, ctx.resolveEvent, gifUpload.single('gif'), (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      mediaService.add(requestEventId(req), 'gif', req.file.filename);
      res.json({
        filename: req.file.filename,
        url: `/uploads/gifs/${req.file.filename}`,
        audioUrl: null,
        uploadedAt: new Date()
      });
    } catch (error) {
      console.error('Error uploading GIF:', error);
      res.status(500).json({ error: 'Failed to upload GIF' });
    }
  });

  // POST /gifs/upload-svg - visuel de campagne (admin de la soiree)
  router.post('/upload-svg', requireAdminOfEvent, ctx.resolveEvent, visualUpload.single('visual'), (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No SVG uploaded' });
      }

      const source = fs.readFileSync(req.file.path, 'utf-8');
      if (!isSafeSvg(source)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'SVG non sécurisé ou invalide' });
      }

      mediaService.add(requestEventId(req), 'visual', req.file.filename);
      res.json({
        filename: req.file.filename,
        url: `/uploads/visuals/${req.file.filename}`,
        uploadedAt: new Date()
      });
    } catch (error) {
      console.error('Error uploading SVG:', error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Failed to upload SVG' });
    }
  });

  // POST /gifs/upload-audio - audio (admin de la soiree)
  router.post('/upload-audio', requireAdminOfEvent, ctx.resolveEvent, audioUpload.single('audio'), (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded' });
      }
      mediaService.add(requestEventId(req), 'audio', req.file.filename);
      res.json({
        filename: req.file.filename,
        url: `/uploads/audio/${req.file.filename}`,
        uploadedAt: new Date()
      });
    } catch (error) {
      console.error('Error uploading audio:', error);
      res.status(500).json({ error: 'Failed to upload audio' });
    }
  });

  // POST /gifs/associate-audio - associe un son a un GIF (admin de la soiree)
  router.post('/associate-audio', requireAdminOfEvent, ctx.resolveEvent, (req: Request, res: Response) => {
    try {
      const { gifFilename, audioUrl } = req.body;

      if (!gifFilename) {
        return res.status(400).json({ error: 'gifFilename is required' });
      }

      const eventId = requestEventId(req);
      // Le GIF doit appartenir a cette soiree : sans cette garde, l'admin de A
      // creerait une association sur un GIF de B.
      if (!mediaService.owns(eventId, 'gif', gifFilename)) {
        return res.status(404).json({ error: 'GIF not found' });
      }

      const audioFilename = typeof audioUrl === 'string' && audioUrl
        ? audioUrl.split('/').pop() || null
        : null;
      // L'audio doit lui aussi appartenir a cette soiree : sans cette garde,
      // l'admin de A associerait a son GIF un son de B (cloisonnement medias
      // contournable sur l'axe audio). L'audio nul reste autorise : c'est la
      // dissociation.
      if (audioFilename && !mediaService.owns(eventId, 'audio', audioFilename)) {
        return res.status(404).json({ error: 'Audio file not found' });
      }
      mediaService.setGifAudio(eventId, gifFilename, audioFilename);

      res.json({ success: true, gifFilename, audioUrl: audioUrlOf(audioFilename) });
    } catch (error) {
      console.error('Error associating audio:', error);
      res.status(500).json({ error: 'Failed to associate audio' });
    }
  });

  // POST /gifs/trigger - declenche GIF + son sur les ecrans de la soiree (admin)
  router.post('/trigger', requireAdminOfEvent, ctx.resolveEvent, (req: Request, res: Response) => {
    try {
      const { gifUrl, audioUrl } = req.body;

      if (!gifUrl) {
        return res.status(400).json({ error: 'gifUrl is required' });
      }

      const eventId = requestEventId(req);
      const filename = gifUrl.split('/').pop();
      const finalAudioUrl = audioUrl
        || (filename ? audioUrlOf(mediaService.getGifAudio(eventId, filename)) : null);

      socketService.emitGifTrigger(eventId, gifUrl, finalAudioUrl || undefined);

      res.json({ success: true, message: 'GIF triggered on the displays of the event', audioUrl: finalAudioUrl });
    } catch (error) {
      console.error('Error triggering GIF:', error);
      res.status(500).json({ error: 'Failed to trigger GIF' });
    }
  });

  // DELETE /gifs/audio/:filename - supprime un audio + ses associations (admin)
  router.delete('/audio/:filename', requireAdminOfEvent, ctx.resolveEvent, (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const filePath = path.join(audioUploadDir, filename);

      if (!isInside(audioUploadDir, filePath)) {
        return res.status(400).json({ error: 'Invalid filename' });
      }

      const eventId = requestEventId(req);
      if (!mediaService.owns(eventId, 'audio', filename)) {
        return res.status(404).json({ error: 'Audio file not found' });
      }

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      mediaService.clearAudioAssociations(eventId, filename);
      mediaService.remove(eventId, 'audio', filename);

      res.json({ success: true, message: 'Audio file deleted' });
    } catch (error) {
      console.error('Error deleting audio:', error);
      res.status(500).json({ error: 'Failed to delete audio file' });
    }
  });

  // DELETE /gifs/:filename - supprime un GIF (admin de la soiree)
  router.delete('/:filename', requireAdminOfEvent, ctx.resolveEvent, (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const filePath = path.join(gifUploadDir, filename);

      if (!isInside(gifUploadDir, filePath)) {
        return res.status(400).json({ error: 'Invalid filename' });
      }

      const eventId = requestEventId(req);
      if (!mediaService.owns(eventId, 'gif', filename)) {
        return res.status(404).json({ error: 'GIF not found' });
      }

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      mediaService.remove(eventId, 'gif', filename);

      res.json({ success: true, message: 'GIF deleted' });
    } catch (error) {
      console.error('Error deleting GIF:', error);
      res.status(500).json({ error: 'Failed to delete GIF' });
    }
  });

  return router;
}
