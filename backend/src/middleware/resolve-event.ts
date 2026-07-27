import { Request, Response, NextFunction } from 'express';
import { eventService } from '../services/event.service';

declare global {
  namespace Express {
    interface Request {
      // Pose par resolveActiveEvent. Optionnel dans le type parce qu'Express ne
      // sait pas qu'un middleware l'a garanti ; requestEventId() transforme
      // cette incertitude en erreur immediate plutot qu'en requete non filtree.
      eventId?: number;
    }
  }
}

// Les routes heritees (/api/donations, /api/config, /api/stats, /api/gifs) n'ont
// pas de soiree dans leur URL : des QR codes vers /don sont peut-etre deja
// imprimes. Elles resolvent la soiree active.
export function resolveActiveEvent(req: Request, res: Response, next: NextFunction): void {
  const { event } = eventService.resolveActive();

  if (!event) {
    // 503 et non 404 : la route existe, c'est la configuration du serveur qui
    // est incomplete. Retomber sur une soiree archivee afficherait ses dons sur
    // l'ecran de la salle sans que personne ne s'en apercoive.
    console.error('CONFIGURATION: aucune soiree active — requete heritee refusee');
    res.status(503).json({ error: 'No active event is configured' });
    return;
  }

  req.eventId = event.id;
  next();
}

export function requestEventId(req: Request): number {
  if (req.eventId === undefined) {
    throw new Error('resolveActiveEvent n a pas ete monte devant cette route');
  }
  return req.eventId;
}
