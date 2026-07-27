import { Request, Response, NextFunction } from 'express';
import { eventService } from '../services/event.service';

// Deux niveaux d'acces, un seul en-tete (contrat § Authentification) :
//   - ORGANIZER_TOKEN : tout, sur toutes les soirees ;
//   - ADMIN_TOKEN : ALIAS de compatibilite de ORGANIZER_TOKEN. Non negociable :
//     la production a ADMIN_TOKEN configure, renommer le secret sans alias
//     enfermerait le commanditaire dehors au premier deploiement ;
//   - code propre a une soiree, hache dans events.admin_code_hash : cette
//     soiree uniquement.
//
// L'en-tete reste x-admin-token, avec le repli ?token= historique.

interface EnvSecrets {
  organizer?: string;
  admin?: string;
}

function envSecrets(): EnvSecrets {
  const organizer = process.env.ORGANIZER_TOKEN?.trim();
  const admin = process.env.ADMIN_TOKEN?.trim();
  return {
    organizer: organizer || undefined,
    admin: admin || undefined
  };
}

function providedToken(req: Request): string {
  return req.header('x-admin-token')
    || (typeof req.query.token === 'string' ? req.query.token : '');
}

// La requete PRETEND-elle a une autorite ? Question volontairement SANS cout :
// ni base, ni scrypt, seulement la presence du jeton. Le limiteur de dons s'en
// sert pour distinguer, au-dela du plafond, une rafale PUBLIQUE (rien a
// verifier, donc rien a reprocher) d'une tentative de contournement (qui, elle,
// merite d'etre comptee). Ne dit rien de la VALIDITE du jeton : c'est le role de
// eventAdminGrant, et lui coute cher.
export function hasProvidedAdminToken(req: Request): boolean {
  return providedToken(req) !== '';
}

function isOrganizer(provided: string, secrets: EnvSecrets): boolean {
  if (!provided) {
    return false;
  }
  // Ordre du contrat : ORGANIZER_TOKEN puis l'alias ADMIN_TOKEN.
  return provided === secrets.organizer || provided === secrets.admin;
}

// Comportement « secret absent » du LOT 0, conserve tel quel : en production,
// l'absence de TOUT secret d'environnement echoue ferme (503) ; hors
// production, le contournement de developpement reste ouvert. Les codes de
// soiree ne levent pas cette garde : la production a toujours ADMIN_TOKEN, et un
// deploiement sans aucun secret d'environnement est une erreur de configuration,
// pas un mode de fonctionnement.
// Renvoie true si la requete a ete tranchee (503 ou next appele), false si
// l'appelant doit poursuivre son propre controle.
function handleMissingSecret(secrets: EnvSecrets, res: Response, next: NextFunction): boolean {
  if (secrets.organizer || secrets.admin) {
    return false;
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('SECURITY: aucun secret admin configure — requete admin refusee');
    res.status(503).json({ error: 'Admin authentication is not configured' });
    return true;
  }
  next();
  return true;
}

// Protege les routes de niveau ORGANISATEUR : celles qui ne portent pas sur une
// soiree particuliere (liste et creation de soirees, sauvegardes globales).
// Un code de soiree n'y donne jamais acces.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const secrets = envSecrets();
  if (handleMissingSecret(secrets, res, next)) {
    return;
  }

  if (isOrganizer(providedToken(req), secrets)) {
    next();
    return;
  }

  res.status(401).json({ error: 'Unauthorized: admin token required' });
}

// Extrait, selon le point de montage, l'identifiant de la soiree ciblee :
// le parametre :eventId pour une route prefixee, la soiree active pour une
// route heritee. null quand aucune cible ne peut etre determinee.
export type TargetEventResolver = (req: Request) => number | null;

// Verdict d'autorite d'une requete face a UNE soiree. Ecrit ICI et nulle part
// ailleurs : toute garde qui a besoin de savoir « cette requete porte-t-elle une
// autorite admin sur cette soiree ? » (requireEventAdmin, requireActiveOrAdmin)
// passe par cette fonction. Une deuxieme implementation de la regle serait une
// deuxieme chance de se tromper.
//
//   'unconfigured' : aucun secret d'environnement. L'appelant tranche (503 en
//                    production, contournement de developpement sinon) — c'est
//                    une decision de POLITIQUE, pas d'autorite.
//   'organizer'    : ORGANIZER_TOKEN (ou son alias ADMIN_TOKEN) : toutes soirees.
//   'event-admin'  : code propre a la soiree CIBLEE.
//   'none'         : aucun jeton, ou jeton sans pouvoir sur cette soiree.
//
// `getTargetEventId` est paresseux : la cible n'est resolue que si le verdict en
// depend vraiment (l'organisateur n'a pas besoin qu'on interroge la base).
export type EventAdminGrant = 'unconfigured' | 'organizer' | 'event-admin' | 'none';

export function eventAdminGrant(req: Request, getTargetEventId: () => number | null): EventAdminGrant {
  const secrets = envSecrets();
  if (!secrets.organizer && !secrets.admin) {
    return 'unconfigured';
  }

  const provided = providedToken(req);
  if (!provided) {
    return 'none';
  }
  if (isOrganizer(provided, secrets)) {
    return 'organizer';
  }

  const targetId = getTargetEventId();
  if (targetId !== null && eventService.verifyAdminCode(targetId, provided)) {
    return 'event-admin';
  }
  return 'none';
}

// Protege une route portant sur UNE soiree. Accepte l'organisateur (tout) ou
// l'admin de la soiree CIBLEE (elle seule). Un code valide pour une AUTRE
// soiree renvoie 403, pas 401 : le secret est bon, c'est la portee qui est
// refusee.
//
// A monter AVANT la resolution de soiree : sans cet ordre, l'absence de soiree
// active ferait repondre 503 a une requete sans jeton qui merite un 401. L'auth
// se prononce d'abord ; la soiree n'est resolue qu'ensuite, pour la seule
// requete deja authentifiee.
export function requireEventAdmin(getTargetEventId: TargetEventResolver) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const secrets = envSecrets();
    if (handleMissingSecret(secrets, res, next)) {
      return;
    }

    const provided = providedToken(req);
    if (!provided) {
      res.status(401).json({ error: 'Unauthorized: admin token required' });
      return;
    }

    const grant = eventAdminGrant(req, () => getTargetEventId(req));
    if (grant === 'organizer' || grant === 'event-admin') {
      next();
      return;
    }

    // Le code est-il valide pour une autre soiree ? Si oui, le secret est bon
    // mais hors perimetre : 403. Sinon, secret inconnu : 401.
    if (eventService.findEventByAdminCode(provided) !== null) {
      res.status(403).json({ error: 'Forbidden: this code does not grant access to this event' });
      return;
    }

    res.status(401).json({ error: 'Unauthorized: admin token required' });
  };
}
