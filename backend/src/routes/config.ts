import { Router, Request, Response } from 'express';
import { configService } from '../services/config.service';
import { donationService } from '../services/donation.service';
import { socketService } from '../services/socket.service';
import { validateConfigUpdate } from '../models/config';
import { requireEventAdmin } from '../middleware/admin-auth';
import { requestEventId } from '../middleware/resolve-event';
import { UnknownEventError } from '../services/event.service';
import { EventRouteContext } from './event-context';

export function createConfigRouter(ctx: EventRouteContext): Router {
  const router = Router({ mergeParams: true });

  // GET /config - configuration de la soiree (public)
  router.get('/', ctx.resolveEvent, (req: Request, res: Response) => {
    try {
      const config = configService.get(requestEventId(req));
      res.json(config);
    } catch (error) {
      if (error instanceof UnknownEventError) {
        return res.status(404).json({ error: 'Event not found' });
      }
      console.error('Error fetching config:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /config - mise a jour (admin de la soiree). L'auth passe AVANT la
  // resolution de soiree : sans jeton, la reponse est 401, jamais un 503
  // qui masquerait le defaut d'authentification.
  router.put('/', requireEventAdmin(ctx.getTargetEventId), ctx.resolveEvent, (req: Request, res: Response) => {
    try {
      const eventId = requestEventId(req);
      const data = validateConfigUpdate(req.body);
      const config = configService.update(eventId, data);
      const stats = donationService.getStats(eventId);

      socketService.emitConfigUpdated(eventId, config, stats);

      res.json(config);
    } catch (error) {
      if (error instanceof UnknownEventError) {
        return res.status(404).json({ error: 'Event not found' });
      }
      console.error('Error updating config:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  return router;
}
