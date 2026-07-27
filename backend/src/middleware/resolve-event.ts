import { Request, Response, NextFunction } from 'express';
import { eventService } from '../services/event.service';
import { eventAdminGrant, EventAdminGrant } from './admin-auth';

declare global {
  namespace Express {
    interface Request {
      // Pose par resolveActiveEvent. Optionnel dans le type parce qu'Express ne
      // sait pas qu'un middleware l'a garanti ; requestEventId() transforme
      // cette incertitude en erreur immediate plutot qu'en requete non filtree.
      eventId?: number;
      // Memoisation du verdict d'autorite pour CETTE requete (voir
      // eventGrantOf). Deux gardes du POST de don ont besoin du meme verdict :
      // le limiteur (au-dela du plafond) puis requireActiveOrAdmin (toujours).
      // Sans memoire, une requete deja evaluee payait un SECOND scrypt.
      eventGrant?: EventAdminGrant;
    }
  }
}

// Verdict d'autorite de la requete face a la soiree resolue, calcule AU PLUS UNE
// FOIS. La regle reste ecrite dans admin-auth.ts et nulle part ailleurs : ceci
// n'est qu'un cache de requete.
//
// Sound par construction : req.eventId est pose par resolveEvent, monte devant
// toutes les gardes, et ne change plus ensuite. Le verdict ne peut donc pas
// changer non plus au cours de la requete.
export function eventGrantOf(req: Request): EventAdminGrant {
  if (req.eventGrant === undefined) {
    req.eventGrant = eventAdminGrant(req, () => req.eventId ?? null);
  }
  return req.eventGrant;
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

// Routes prefixees /api/events/:eventId/... : la soiree est nommee dans l'URL.
// Un identifiant inexistant renvoie 404 SEC, jamais un repli sur une autre
// soiree (qui afficherait les dons de A sur l'ecran de B) ni le message interne
// d'implementation. Requiert mergeParams sur le routeur pour voir :eventId.
export function resolveParamEvent(req: Request, res: Response, next: NextFunction): void {
  const id = Number(req.params.eventId);
  if (!Number.isInteger(id) || id <= 0 || eventService.getById(id) === null) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  req.eventId = id;
  next();
}

// Le POST de don ecrit sur la soiree resolue en amont (active pour le montage
// herite, nommee par :eventId pour le montage prefixe). resolveParamEvent ne
// verifie que l'EXISTENCE : sans ce garde-fou, /e/<slug>/don d'une soiree
// ARCHIVEE ou en BROUILLON — dont plus personne ne surveille les QR — continue
// d'accepter les dons du PUBLIC.
//
// Mais l'outil sert plusieurs soirees a la fois et un OPERATEUR admin doit
// pouvoir saisir un don sur une soiree qui n'est pas (ou plus) active :
// preparation en brouillon, rattrapage apres archivage. La garde n'est donc pas
// « soiree active », elle est « soiree active OU autorite admin sur CETTE
// soiree » — l'autorite etant celle de admin-auth.ts, jamais une seconde
// implementation.
//
// Ce qui reste refuse, et c'est tout l'objet : le don PUBLIC, sans jeton, vers
// une soiree non-active.
//
// A monter APRES resolveEvent (qui pose req.eventId). Sur le montage herite la
// soiree resolue est active par construction : la garde y est un no-op.
export function requireActiveOrAdmin(req: Request, res: Response, next: NextFunction): void {
  const event = req.eventId !== undefined ? eventService.getById(req.eventId) : null;
  if (event && event.status === 'active') {
    next();
    return;
  }

  // eventGrantOf, pas eventAdminGrant : sur le POST de don, le limiteur a
  // peut-etre deja pose la question (au-dela du plafond). Recalculer ici
  // paierait un SECOND scrypt pour la meme requete.
  const grant = eventGrantOf(req);
  if (grant === 'organizer' || grant === 'event-admin') {
    next();
    return;
  }
  // Aucun secret d'environnement : meme politique que le reste de la couche
  // d'authentification (admin-auth.ts handleMissingSecret), et non le 403
  // generique. En production c'est une erreur de CONFIGURATION : on echoue
  // ferme, bruyamment, pour qu'elle se voie dans les journaux au lieu de se
  // deguiser en refus de politique. Hors production le contournement de
  // developpement reste ouvert, sinon la saisie admin d'une soiree en brouillon
  // serait la SEULE chose cassee sur un poste de developpement sans secret.
  if (grant === 'unconfigured') {
    if (process.env.NODE_ENV !== 'production') {
      next();
      return;
    }
    console.error('SECURITY: aucun secret admin configure — saisie de don refusee');
    res.status(503).json({ error: 'Admin authentication is not configured' });
    return;
  }

  // 403 reserve au refus de POLITIQUE : secrets configures, et cette requete
  // n'a pas d'autorite sur cette soiree — typiquement le don PUBLIC vers une
  // soiree non active.
  res.status(403).json({ error: 'This event is not accepting donations' });
}

export function requestEventId(req: Request): number {
  if (req.eventId === undefined) {
    throw new Error('la soiree n a pas ete resolue devant cette route');
  }
  return req.eventId;
}
