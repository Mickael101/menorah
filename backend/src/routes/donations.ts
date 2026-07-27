import { Router, Request, Response, NextFunction } from 'express';
import { donationService } from '../services/donation.service';
import { socketService } from '../services/socket.service';
import { validateCreateRequest, validateUpdateRequest, toPublicDonation } from '../models/donation';
import { PREMIUM_TIERS } from '../models/types';
import {
  adminSecretsConfigured,
  hasProvidedAdminToken,
  isOrganizerRequest,
  requireEventAdmin
} from '../middleware/admin-auth';
import { eventGrantOf, requestEventId, requireActiveOrAdmin } from '../middleware/resolve-event';
import { rateLimit, FreeVerdict, CostlyVerdict } from '../middleware/rate-limit';
import { UnknownEventError } from '../services/event.service';
import { EventRouteContext } from './event-context';

// Public self-service page posts here: keep it open but throttled.
//
// Le plafond vise le don PUBLIC. L'OPERATEUR de la soiree, lui, saisit les dons
// en rafale depuis le panneau admin : au 11e il se retrouvait a 429, et une
// salle entiere derriere un wifi partage ne presente qu'UNE seule IP. Une
// requete qui porte une autorite REELLE (organisateur, ou admin de la soiree
// ciblee) est donc exemptee du plafond.
//
// L'exemption est DIFFEREE : le contournement n'est consulte qu'une fois le
// plafond atteint (voir rate-limit.ts). Verifier un code de soiree deroule un
// scrypt ; le faire d'emblee sur ce chemin public ferait de n'importe quel jeton
// bidon un amplificateur de charge. Sous le plafond, personne ne paie rien.
const createLimiter = rateLimit(10, 10 * 60 * 1000, {
  // GRATUIT — aucune base, aucun scrypt. Toujours consulte au-dela du plafond,
  // AVANT le budget d'echecs.
  freeVerdict: (req: Request): FreeVerdict => {
    // Aucun jeton : c'est du trafic public, il n'y a rien a verifier et rien a
    // reprocher. 'no-claim' pour ne pas entamer le budget d'echecs — sinon une
    // rafale de donateurs de la salle verrouillerait la branche d'autorite,
    // dont ils partagent l'IP.
    if (!hasProvidedAdminToken(req)) {
      return 'no-claim';
    }
    // L'ORGANISATEUR se reconnait a une comparaison de chaine. Le dire ICI, et
    // pas dans la branche couteuse, est tout l'objet du decoupage : son passage
    // ne depend d'aucun budget, donc aucun tiers ne peut le lui fermer en
    // gaspillant ce budget depuis la meme IP.
    if (isOrganizerRequest(req)) {
      return 'grant';
    }
    // Aucun secret d'environnement : c'est une politique de developpement, pas
    // une attaque. Le plafond continue de s'appliquer, sans rien compter.
    if (!adminSecretsConfigured()) {
      return 'no-claim';
    }
    // Un jeton inconnu du niveau organisateur : seul un code de soiree peut
    // encore l'expliquer, et cela se paie.
    return 'needs-check';
  },
  // COUTEUX — au plus un scrypt (la soiree CIBLEE), et seulement derriere un
  // 'needs-check' dont le nombre est borne par fenetre et par IP.
  costlyVerdict: (req: Request): CostlyVerdict => {
    // eventGrantOf memoise le verdict sur la requete : requireActiveOrAdmin, qui
    // s'execute juste apres, le relit au lieu de refaire le scrypt.
    // req.eventId est pose par ctx.resolveEvent, monte AVANT le limiteur.
    const grant = eventGrantOf(req);
    return grant === 'organizer' || grant === 'event-admin' ? 'grant' : 'deny';
  }
});

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
  //
  // Precision qui a deja induit en erreur : requireActiveOrAdmin s'execute pour
  // CHAQUE requete — c'est la garde d'ETAT de la soiree, elle ne peut pas etre
  // conditionnelle. Ce qui est DIFFERE au-dela du plafond, c'est l'exemption du
  // plafond elle-meme (createLimiter ci-dessus), et le nombre de verifications
  // couteuses refusees y est borne par fenetre et par IP.
  //
  // Les deux gardes repondent a deux questions distinctes (« cette IP a-t-elle
  // encore droit au quota ? » / « cette soiree accueille-t-elle ce don ? ») et
  // restent lisibles seules. Elles partagent seulement le RESULTAT du calcul
  // d'autorite, memoise sur la requete par eventGrantOf : sans cela, une requete
  // deja evaluee par le limiteur payait un second scrypt ici meme.
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
