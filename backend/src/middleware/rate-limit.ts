import { Request, Response, NextFunction } from 'express';

interface WindowEntry {
  timestamps: number[];
}

// Verdict rendu par le contournement, consulte UNIQUEMENT au-dela du plafond.
//
//   'grant'    : la requete porte une autorite reelle. Elle passe SANS consommer
//                le quota public : le trafic authentifie de l'operateur ne doit
//                pas manger le budget des donateurs derriere le meme wifi.
//   'no-claim' : la requete ne pretend a aucune autorite (aucun jeton fourni,
//                ou politique de developpement). Refusee, mais sans consommer le
//                budget d'echecs : une rafale publique dans une salle bondee ne
//                doit pas verrouiller le contournement de l'operateur, qui
//                partage la meme IP.
//   'deny'     : autorite PRETENDUE et refusee. Refusee ET comptee : c'est la
//                seule voie qui a pu couter un scrypt, donc la seule qu'il faut
//                borner.
export type OverLimitVerdict = 'grant' | 'deny' | 'no-claim';

export interface RateLimitOptions {
  // Consulte SEULEMENT quand le plafond est deja atteint. Sous le plafond, le
  // limiteur ne l'appelle jamais : verifier une autorite peut derouler un scrypt
  // (~50 ms), et le faire sur un chemin PUBLIC a chaque requete transformerait
  // le limiteur lui-meme en amplificateur de charge. Le cout d'authentification
  // est donc DIFFERE : personne ne le paie tant qu'il reste du quota.
  overLimitBypass?: (req: Request) => OverLimitVerdict;
  // Borne anti-amplification : nombre maximal de verdicts 'deny' toleres par IP
  // et par fenetre. Au-dela, le contournement n'est meme plus consulte, donc un
  // flood de jetons bidon coute au plus ce nombre de scrypts par IP et par
  // fenetre — quoi qu'il arrive.
  maxBypassFailures?: number;
}

const DEFAULT_MAX_BYPASS_FAILURES = 30;

// Minimal in-memory per-IP rate limiter (single-instance deployment).
export function rateLimit(maxRequests: number, windowMs: number, opts: RateLimitOptions = {}) {
  const hits = new Map<string, WindowEntry>();
  // Seconde comptabilite, volontairement separee des hits : elle ne compte que
  // les tentatives d'autorite REFUSEES. Deux compteurs pour deux budgets, sinon
  // un flood de jetons bidon fermerait la porte aux vrais dons (et l'inverse).
  const failedBypass = new Map<string, WindowEntry>();
  const maxBypassFailures = opts.maxBypassFailures ?? DEFAULT_MAX_BYPASS_FAILURES;

  // Periodic cleanup so the maps never grow unbounded
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const map of [hits, failedBypass]) {
      for (const [key, entry] of map) {
        entry.timestamps = entry.timestamps.filter(t => t > cutoff);
        if (entry.timestamps.length === 0) {
          map.delete(key);
        }
      }
    }
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = (req.header('x-forwarded-for')?.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
    // Plafond GLOBAL par IP : une IP ne peut creer que `maxRequests` dons par
    // fenetre, TOUTES soirees confondues. Une cle IP+soiree (essai B6, pour ne
    // pas penaliser deux soirees derriere un meme reseau) multipliait le plafond
    // par le nombre de soirees — dont brouillons et archives, atteignables
    // publiquement via POST /api/events/:id/donations — et rendait le quota
    // contournable a volonte. L'isolation par IP prime sur le confort du reseau
    // partage.
    const key = ip;
    const now = Date.now();
    const entry = hits.get(key) || { timestamps: [] };

    entry.timestamps = entry.timestamps.filter(t => t > now - windowMs);

    if (entry.timestamps.length >= maxRequests) {
      // Au-dela du plafond SEULEMENT : c'est ici, et nulle part avant, qu'on
      // accepte de payer une verification d'autorite.
      const bypass = opts.overLimitBypass;
      if (!bypass) {
        refuse(res);
        return;
      }

      const failures = failedBypass.get(key) || { timestamps: [] };
      failures.timestamps = failures.timestamps.filter(t => t > now - windowMs);
      if (failures.timestamps.length >= maxBypassFailures) {
        // Budget d'echecs epuise : on refuse SANS invoquer le contournement.
        // C'est la borne : le scrypt n'est plus atteignable pour cette IP
        // jusqu'a la fenetre suivante.
        refuse(res);
        return;
      }

      const verdict = bypass(req);
      if (verdict === 'grant') {
        // Quota public volontairement NON consomme (voir OverLimitVerdict).
        next();
        return;
      }
      if (verdict === 'deny') {
        // Seul 'deny' entame le budget : 'no-claim' n'a rien coute et ne doit
        // rien fermer.
        failures.timestamps.push(now);
        failedBypass.set(key, failures);
      }
      refuse(res);
      return;
    }

    entry.timestamps.push(now);
    hits.set(key, entry);
    next();
  };
}

function refuse(res: Response): void {
  res.status(429).json({ error: 'Too many requests, please try again later' });
}
