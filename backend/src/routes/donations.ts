import { Router, Request, Response, NextFunction } from 'express';
import { donationService } from '../services/donation.service';
import { socketService } from '../services/socket.service';
import { validateCreateRequest, validateUpdateRequest, toPublicDonation } from '../models/donation';
import { PREMIUM_TIERS } from '../models/types';
import { requireEventAdmin } from '../middleware/admin-auth';
import { requestEventId, requireActiveOrAdmin } from '../middleware/resolve-event';
import { rateLimit } from '../middleware/rate-limit';
import { UnknownEventError } from '../services/event.service';
import { EventRouteContext } from './event-context';

// Public self-service page posts here: keep it open but throttled
const createLimiter = rateLimit(10, 10 * 60 * 1000);

type CsvLocale = 'fr' | 'en' | 'he';

const CSV_HEADERS: Record<CsvLocale, string[]> = {
  fr: ['ID', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Montant (₪)', 'Référence', 'Mot premium', 'Créé le', 'Modifié le'],
  en: ['ID', 'First name', 'Last name', 'Email', 'Phone', 'Amount (₪)', 'Reference', 'Premium word', 'Created at', 'Updated at'],
  he: ['מזהה', 'שם פרטי', 'שם משפחה', 'דוא״ל', 'טלפון', 'סכום (₪)', 'אסמכתה', 'מילת פרימיום', 'נוצר בתאריך', 'עודכן בתאריך']
};

function sanitizeSpreadsheetValue(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value: unknown): string {
  return `"${sanitizeSpreadsheetValue(value).replace(/"/g, '""')}"`;
}

// Le payload complet (email, telephone, reference) est une demande explicite.
const wantsFullPayload = (req: Request): boolean => req.query.full === '1';

export function createDonationsRouter(ctx: EventRouteContext): Router {
  const router = Router({ mergeParams: true });
  const requireAdminOfEvent = requireEventAdmin(ctx.getTargetEventId);

  // GET /donations/premium-words - mots premium avec disponibilite (public)
  router.get('/premium-words', ctx.resolveEvent, (req: Request, res: Response) => {
    try {
      const words = donationService.getPremiumWords(requestEventId(req));
      res.json({ words, tiers: PREMIUM_TIERS });
    } catch (error) {
      console.error('Error fetching premium words:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /donations/export.csv - export UTF-8 (admin de la soiree).
  // Doit rester avant /:id pour que "export.csv" ne soit pas lu comme un ID.
  // L'auth passe AVANT la resolution de soiree : sans jeton et sans soiree
  // active, la reponse est 401 (defaut d'authentification), pas 503 (defaut de
  // configuration) — le 503 masquait le 401.
  router.get('/export.csv', requireAdminOfEvent, ctx.resolveEvent, (req: Request, res: Response) => {
    try {
      const requestedLocale = req.query.lang;
      const locale: CsvLocale = requestedLocale === 'en' || requestedLocale === 'he'
        ? requestedLocale
        : 'fr';
      const rows = donationService.getAll(requestEventId(req)).map(donation => [
        donation.id,
        donation.firstName,
        donation.lastName,
        donation.email,
        donation.phone,
        (donation.amount / 100).toFixed(2),
        donation.reference,
        donation.premiumWordId,
        donation.createdAt,
        donation.updatedAt
      ]);
      const csv = [CSV_HEADERS[locale], ...rows]
        .map(row => row.map(csvCell).join(';'))
        .join('\r\n');
      const date = new Date().toISOString().slice(0, 10);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="donations-${date}.csv"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(`\uFEFF${csv}`);
    } catch (error) {
      console.error('Error exporting donations:', error);
      res.status(500).json({ error: 'Failed to export donations' });
    }
  });

  // GET /donations - liste depouillee par defaut (l'ecran public en depend).
  // GET /donations?full=1 - payload complet, reserve a l'admin de la soiree.
  // L'auth de ?full=1 passe avant la resolution : le depouillement etant le
  // defaut, un oubli de garde echoue ferme, on n'expose jamais de donnee
  // personnelle par accident.
  router.get(
    '/',
    (req: Request, res: Response, next: NextFunction) => {
      if (wantsFullPayload(req)) {
        requireAdminOfEvent(req, res, next);
        return;
      }
      next();
    },
    ctx.resolveEvent,
    (req: Request, res: Response) => {
      try {
        const eventId = requestEventId(req);
        const donations = donationService.getAll(eventId);
        const stats = donationService.getStats(eventId);

        res.json({
          donations: wantsFullPayload(req) ? donations : donations.map(toPublicDonation),
          stats
        });
      } catch (error) {
        if (error instanceof UnknownEventError) {
          return res.status(404).json({ error: 'Event not found' });
        }
        console.error('Error fetching donations:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // GET /donations/:id - un don complet (admin de la soiree)
  router.get('/:id', requireAdminOfEvent, ctx.resolveEvent, (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      const donation = donationService.getById(requestEventId(req), id);
      if (!donation) {
        return res.status(404).json({ error: 'Donation not found' });
      }

      res.json(donation);
    } catch (error) {
      console.error('Error fetching donation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /donations - creation publique, limitee. resolveEvent d'abord : la
  // soiree doit exister pour recevoir le don. Puis le limiteur, puis seulement
  // la garde d'etat : requireActiveOrAdmin peut avoir a verifier un code de
  // soiree, c'est-a-dire a derouler un scrypt ; le laisser derriere le limiteur
  // evite qu'un jeton bidon envoye en boucle sur ce chemin PUBLIC ne devienne un
  // amplificateur de charge. Un don public vers une soiree non-active est refuse
  // (403), un don saisi par un admin authentifie passe.
  router.post('/', ctx.resolveEvent, createLimiter, requireActiveOrAdmin, (req: Request, res: Response) => {
    try {
      const eventId = requestEventId(req);
      const data = validateCreateRequest(req.body);
      const donation = donationService.create(eventId, data);
      const stats = donationService.getStats(eventId);

      socketService.emitDonationNew(eventId, donation, stats);

      res.status(201).json({ donation, stats });
    } catch (error) {
      console.error('Error creating donation:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // PUT /donations/:id - modification (admin de la soiree)
  router.put('/:id', requireAdminOfEvent, ctx.resolveEvent, (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      const eventId = requestEventId(req);
      // C9 : le montant courant est passe a la validation. Sans lui, modifier
      // premium_word_id sans renvoyer amount ferait retomber le montant a 0,
      // et getPremiumLevel(0) effacerait silencieusement le mot sacre.
      const existing = donationService.getById(eventId, id);
      if (!existing) {
        return res.status(404).json({ error: 'Donation not found' });
      }
      const data = validateUpdateRequest(req.body, existing.amount);
      const donation = donationService.update(eventId, id, data);

      if (!donation) {
        return res.status(404).json({ error: 'Donation not found' });
      }

      const stats = donationService.getStats(eventId);

      socketService.emitDonationUpdated(eventId, donation, stats);

      res.json({ donation, stats });
    } catch (error) {
      console.error('Error updating donation:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // DELETE /donations/:id - suppression (admin de la soiree)
  router.delete('/:id', requireAdminOfEvent, ctx.resolveEvent, (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      const eventId = requestEventId(req);
      const donation = donationService.delete(eventId, id);
      if (!donation) {
        return res.status(404).json({ error: 'Donation not found' });
      }

      const stats = donationService.getStats(eventId);

      socketService.emitDonationDeleted(eventId, id, stats);

      res.json({ donation, stats });
    } catch (error) {
      console.error('Error deleting donation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
