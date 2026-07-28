import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { sceneService } from '../services/scene.service';
import { configService } from '../services/config.service';
import { donationService } from '../services/donation.service';
import { socketService } from '../services/socket.service';
import { requireAdmin, requireEventAdmin } from '../middleware/admin-auth';
import { uploadsRoot } from '../config/storage';
import { isInside } from '../middleware/path-boundary';

// ---------------------------------------------------------------------------
// /api/scenes — bibliotheque de scenes Rive (Atelier Scenes)
// ---------------------------------------------------------------------------
//
// Meme patron que routes/themes.ts : gestion (upload, suppression) reservee a
// l'organisateur ; la LISTE est ouverte a l'admin d'une soiree (?eventId=) car
// c'est lui qui choisit la scene a activer. L'activation elle-meme passe par
// PUT /config (displaySettings), pas par ce routeur.

const sceneUploadDir = path.join(uploadsRoot, 'scenes');
if (!fs.existsSync(sceneUploadDir)) {
  fs.mkdirSync(sceneUploadDir, { recursive: true });
}

const sceneStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, sceneUploadDir);
  },
  filename: (_req, _file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `scene-${uniqueSuffix}.riv`);
  }
});

// Un .riv arrive en application/octet-stream : le filtre multer ne peut juger
// que l'extension ; les magic bytes sont verifies apres ecriture, comme le
// contenu SVG dans routes/gifs.ts.
const sceneUpload = multer({
  storage: sceneStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max (spec §4)
  },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.riv') {
      cb(null, true);
    } else {
      cb(new Error('Only .riv files are allowed'));
    }
  }
});

function hasRiveMagicBytes(filePath: string): boolean {
  try {
    const header = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    try {
      fs.readSync(fd, header, 0, 4, 0);
    } finally {
      fs.closeSync(fd);
    }
    return header.equals(Buffer.from('RIVE', 'ascii'));
  } catch {
    return false;
  }
}

const scenesRouter = Router();

// GET /api/scenes[?eventId=] — liste. Avec eventId : admin de cette soiree ou
// organisateur. Sans eventId : organisateur seulement (meme regle que themes).
scenesRouter.get(
  '/',
  requireEventAdmin((req) => {
    const id = Number(req.query.eventId);
    return Number.isInteger(id) ? id : null;
  }),
  (_req: Request, res: Response) => {
    try {
      res.json({ scenes: sceneService.list() });
    } catch (error) {
      console.error('Error listing scenes:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Les refus de multer (extension non .riv, fichier > 10 Mo) doivent etre des
// 400 contractuels (spec §6), pas des 500 du handler d'erreur par defaut
// d'Express. Multer supprime lui-meme le fichier partiel sur ces erreurs.
function sceneUploadGate(req: Request, res: Response, next: NextFunction): void {
  sceneUpload.single('scene')(req, res, (uploadError: unknown) => {
    if (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Invalid scene upload';
      res.status(400).json({ error: message });
      return;
    }
    next();
  });
}

// POST /api/scenes — upload d'une scene (organisateur). Auth AVANT multer :
// un fichier n'est ecrit sur disque que pour une requete autorisee.
scenesRouter.post('/', requireAdmin, sceneUploadGate, (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No scene file uploaded' });
    }

    if (!hasRiveMagicBytes(req.file.path)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Not a valid Rive (.riv) file' });
    }

    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const name = rawName || path.basename(req.file.originalname, '.riv');
    const scene = sceneService.create(name, req.file.filename);
    res.status(201).json({ scene });
  } catch (error) {
    console.error('Error uploading scene:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to upload scene' });
  }
});

// DELETE /api/scenes/:id — suppression (organisateur). Les soirees qui
// referencaient la scene repassent en visualMode 'none' et leur config est
// rediffusee : l'ecran ne doit jamais pointer un fichier disparu (spec §6).
scenesRouter.delete('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const scene = sceneService.get(id);
    if (!scene) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const referencingEvents = sceneService.eventsReferencing(id);
    sceneService.remove(id);

    for (const eventId of referencingEvents) {
      const config = configService.get(eventId);
      const healedSettings = {
        ...config.displaySettings,
        visualMode: 'none' as const,
        sceneId: null,
        sceneUrl: null
      };
      const updated = configService.update(eventId, { displaySettings: healedSettings });
      socketService.emitConfigUpdated(eventId, updated, donationService.getStats(eventId));
    }

    const filePath = path.join(sceneUploadDir, scene.filename);
    if (isInside(sceneUploadDir, filePath) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(204).end();
  } catch (error) {
    console.error('Error deleting scene:', error);
    res.status(500).json({ error: 'Failed to delete scene' });
  }
});

export default scenesRouter;
