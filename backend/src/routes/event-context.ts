import { RequestHandler } from 'express';
import { resolveActiveEvent, resolveParamEvent } from '../middleware/resolve-event';
import { TargetEventResolver } from '../middleware/admin-auth';
import { eventService } from '../services/event.service';

// Une route de ressource (config, dons, stats, gifs) vit sous DEUX montages :
//   - herite : /api/config, /api/donations... resolus sur la soiree ACTIVE ;
//   - prefixe : /api/events/:eventId/config... resolus sur la soiree NOMMEE.
//
// Le comportement ne differe qu'en deux points — comment on trouve la soiree,
// et laquelle l'auth doit proteger. Ce contexte les isole, pour que le corps
// des routes soit ecrit UNE fois et monte deux fois.
export interface EventRouteContext {
  // Pose req.eventId ; 503 (herite, aucune active) ou 404 (prefixe, inconnue).
  resolveEvent: RequestHandler;
  // La soiree que requireEventAdmin doit proteger, connue AVANT resolveEvent.
  getTargetEventId: TargetEventResolver;
}

// Montage herite : la soiree active. getTargetEventId n'a pas besoin de la
// requete — la cible est la meme active qu'ailleurs.
export const legacyEventContext: EventRouteContext = {
  resolveEvent: resolveActiveEvent,
  getTargetEventId: () => eventService.resolveActive().event?.id ?? null
};

// Montage prefixe : la soiree du parametre d'URL. La cible est lisible avant
// meme la resolution, ce qui laisse l'auth se prononcer en premier.
export const paramEventContext: EventRouteContext = {
  resolveEvent: resolveParamEvent,
  getTargetEventId: (req) => {
    const id = Number(req.params.eventId);
    return Number.isInteger(id) ? id : null;
  }
};
