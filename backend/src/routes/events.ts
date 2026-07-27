import { Router, Request, Response } from 'express';
import { eventService, SlugTakenError } from '../services/event.service';
import { donationService } from '../services/donation.service';
import {
  toEventPublic,
  toEventSummary,
  validateCreateEvent,
  validateUpdateEvent
} from '../models/event';
import { requireAdmin, requireEventAdmin } from '../middleware/admin-auth';
import { generateAdminCode, hashAdminCode } from '../middleware/admin-code';

const router = Router();

function summaryOf(eventId: number) {
  const event = eventService.getById(eventId);
  if (!event) {
    return null;
  }
  return toEventSummary(event, donationService.getTotals(eventId));
}

// GET /api/events - liste des soirees avec agregats (organisateur)
router.get('/', requireAdmin, (_req: Request, res: Response) => {
  try {
    const events = eventService.listAll().map((event) =>
      toEventSummary(event, donationService.getTotals(event.id))
    );
    res.json({ events });
  } catch (error) {
    console.error('Error listing events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events - creation (organisateur). Le code admin en clair est
// renvoye UNE seule fois ici : il n'est ni stocke, ni relisible ensuite.
router.post('/', requireAdmin, (req: Request, res: Response) => {
  try {
    const input = validateCreateEvent(req.body);
    const adminCode = generateAdminCode();
    const event = eventService.create(input, hashAdminCode(adminCode));
    res.status(201).json({
      event: toEventSummary(event, { donationCount: 0, totalAmount: 0 }),
      adminCode
    });
  } catch (error) {
    if (error instanceof SlugTakenError) {
      return res.status(409).json({ error: 'Slug already in use' });
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/active - soiree active (public). L'ambiguite de deux soirees
// actives n'est pas silencieuse : elle est loguee ET signalee par un en-tete,
// pour que le donateur qui scanne un QR sans slug ne soit pas dirige au hasard.
router.get('/active', (_req: Request, res: Response) => {
  try {
    const { event, multipleActive } = eventService.resolveActive();
    if (multipleActive) {
      console.warn('AMBIGUITE: plusieurs soirees actives — /api/events/active a resolu la plus recente');
      res.setHeader('X-Multiple-Active-Events', 'true');
    }
    res.json({
      event: event ? toEventPublic(event) : null,
      multipleActive
    });
  } catch (error) {
    console.error('Error resolving active event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/by-slug/:slug - resolution du slug (public). Le frontend en a
// besoin AVANT de pouvoir s'authentifier : c'est pourquoi elle est publique.
router.get('/by-slug/:slug', (req: Request, res: Response) => {
  try {
    const event = eventService.getBySlug(req.params.slug);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ event: toEventPublic(event) });
  } catch (error) {
    console.error('Error resolving event slug:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/events/:eventId - mise a jour (admin de la soiree)
router.put(
  '/:eventId',
  requireEventAdmin((req) => {
    const id = Number(req.params.eventId);
    return Number.isInteger(id) ? id : null;
  }),
  (req: Request, res: Response) => {
    try {
      const eventId = Number(req.params.eventId);
      const patch = validateUpdateEvent(req.body);
      const event = eventService.updateEvent(eventId, patch);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.json({ event: summaryOf(event.id) });
    } catch (error) {
      if (error instanceof SlugTakenError) {
        return res.status(409).json({ error: 'Slug already in use' });
      }
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Error updating event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/events/:eventId/admin-code - regeneration du code (organisateur).
// Nouveau code en clair renvoye une seule fois ; l'ancien cesse aussitot de
// valoir. Reserve a l'organisateur : un admin de soiree ne remet pas son propre
// secret.
router.post('/:eventId/admin-code', requireAdmin, (req: Request, res: Response) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isInteger(eventId)) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const adminCode = generateAdminCode();
    if (!eventService.setAdminCodeHash(eventId, hashAdminCode(adminCode))) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ adminCode });
  } catch (error) {
    console.error('Error regenerating admin code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
