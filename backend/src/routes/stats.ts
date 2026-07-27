import { Router, Request, Response } from 'express';
import { donationService } from '../services/donation.service';
import { requestEventId } from '../middleware/resolve-event';
import { UnknownEventError } from '../services/event.service';
import { EventRouteContext } from './event-context';

// Fabrique : le meme corps de route, monte une fois sur la soiree active
// (herite) et une fois sur la soiree du parametre (prefixe). mergeParams laisse
// voir :eventId sous le montage prefixe.
export function createStatsRouter(ctx: EventRouteContext): Router {
  const router = Router({ mergeParams: true });

  // GET /stats - statistiques de la soiree
  router.get('/', ctx.resolveEvent, (req: Request, res: Response) => {
    try {
      const stats = donationService.getStats(requestEventId(req));
      res.json(stats);
    } catch (error) {
      if (error instanceof UnknownEventError) {
        return res.status(404).json({ error: 'Event not found' });
      }
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
