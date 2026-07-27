import { Request, Response, NextFunction } from 'express';

interface WindowEntry {
  timestamps: number[];
}

// Le contournement du plafond se decide en DEUX temps, parce qu'il y a deux
// couts tres differents derriere le mot « autorite ».
//
// Verdict GRATUIT : une comparaison de chaine sur le jeton fourni, ni base ni
// scrypt. Il est TOUJOURS consulte au-dela du plafond.
//
//   'grant'       : autorite reconnue sans rien depenser (l'ORGANISATEUR, dont
//                   le jeton se compare a une variable d'environnement). Passe
//                   SANS consommer le quota public : le trafic de l'operateur ne
//                   doit pas manger le budget des donateurs derriere le meme
//                   wifi.
//   'no-claim'    : la requete ne pretend a aucune autorite (aucun jeton, ou
//                   politique de developpement). Refusee, sans toucher au budget
//                   d'echecs : une rafale publique dans une salle bondee ne doit
//                   rien fermer.
//   'needs-check' : un jeton est present et n'est pas celui de l'organisateur.
//                   Trancher exige la partie COUTEUSE.
export type FreeVerdict = 'grant' | 'no-claim' | 'needs-check';

// Verdict COUTEUX : celui qui peut derouler un scrypt (code propre a une
// soiree). Consulte seulement si le verdict gratuit a rendu 'needs-check' ET si
// le budget d'echecs n'est pas epuise.
//
//   'grant' : autorite confirmee, la requete passe.
//   'deny'  : autorite pretendue et refusee. Refusee ET comptee : c'est la seule
//             voie qui a pu couter un scrypt, donc la seule qu'il faut borner.
export type CostlyVerdict = 'grant' | 'deny';

export interface RateLimitOptions {
  // Consulte SEULEMENT quand le plafond est deja atteint. Sous le plafond, le
  // limiteur ne pose aucune question : verifier une autorite peut derouler un
  // scrypt (~50 ms), et le faire sur un chemin PUBLIC a chaque requete
  // transformerait le limiteur lui-meme en amplificateur de charge. Le cout
  // d'authentification est donc DIFFERE : personne ne le paie tant qu'il reste
  // du quota.
  freeVerdict?: (req: Request) => FreeVerdict;
  // Ne doit etre appele QUE derriere un 'needs-check' : c'est la branche chere.
  costlyVerdict?: (req: Request) => CostlyVerdict;
  // Borne anti-amplification : nombre maximal de verdicts 'deny' toleres par IP
  // et par fenetre. Au-dela, la branche COUTEUSE n'est plus consultee, donc un
  // flood de jetons bidon coute au plus ce nombre de scrypts par IP et par
  // fenetre — quoi qu'il arrive.
  //
  // Le budget ne borne QUE cette branche. Il ne peut ni verrouiller
  // l'organisateur (verdict gratuit, rendu AVANT toute consultation du budget)
  // ni le public (qui ne le consomme jamais). L'inverse etait une regression
  // reelle : trente POST avec un jeton bidon depuis l'IP de la salle epuisaient
  // le budget, et l'operateur muni du VRAI jeton — dont la verification est
  // gratuite — recevait 429 sur chaque don pendant toute la fenetre.
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
    // req.ip, et surtout PAS x-forwarded-for[0]. La premiere entree de cet
    // en-tete est celle que le CLIENT a ecrite : derriere un proxy (Railway,
    // 1 saut) l'IP reelle est ajoutee A LA FIN. Lire la premiere revenait a
    // laisser n'importe qui choisir sa cle de quota — un compteur neuf par IP
    // inventee, et deux Maps qui enflent a volonte. Express derive req.ip
    // correctement des lors que `trust proxy` est pose (voir app.ts).
    const ip = req.ip || 'unknown';
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
      const free = opts.freeVerdict;
      if (!free) {
        // Aucun contournement declare (appel a deux arguments) : plafond sec.
        refuse(res);
        return;
      }

      // 1. Le verdict GRATUIT, toujours. Il precede la consultation du budget :
      //    l'organisateur ne doit JAMAIS pouvoir etre verrouille par des echecs
      //    qu'il n'a pas commis.
      const verdict = free(req);
      if (verdict === 'grant') {
        // Quota public volontairement NON consomme (voir FreeVerdict).
        next();
        return;
      }
      if (verdict === 'no-claim') {
        // Rien n'a ete pretendu, rien n'a coute : on refuse sans entamer le
        // budget d'echecs.
        refuse(res);
        return;
      }

      // 2. 'needs-check' : seule voie vers la branche chere.
      const costly = opts.costlyVerdict;
      if (!costly) {
        refuse(res);
        return;
      }

      const failures = failedBypass.get(key) || { timestamps: [] };
      failures.timestamps = failures.timestamps.filter(t => t > now - windowMs);
      if (failures.timestamps.length >= maxBypassFailures) {
        // Budget epuise : refus SEC, sans invoquer la branche couteuse. C'est la
        // borne — le scrypt n'est plus atteignable pour cette IP jusqu'a la
        // fenetre suivante.
        refuse(res);
        return;
      }

      if (costly(req) === 'grant') {
        next();
        return;
      }
      // Autorite pretendue et refusee : c'est ce qui a coute, c'est ce qu'on
      // compte.
      failures.timestamps.push(now);
      failedBypass.set(key, failures);
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
