import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { rateLimit, FreeVerdict, CostlyVerdict } from '../../src/middleware/rate-limit';
import { createTestApp } from '../helpers/app';
import { getDb, saveDatabase } from '../../src/db/init';
import { eventService } from '../../src/services/event.service';

// La cle du limiteur est l'IP SEULE : le plafond est GLOBAL, toutes soirees
// confondues.
//
// L'essai precedent (cle IP + soiree, pour ne pas penaliser deux soirees
// derriere un meme reseau) multipliait en fait le plafond par le nombre de
// soirees atteignables — brouillons et archives compris, joignables
// publiquement via POST /api/events/:id/donations. Le quota devenait
// contournable a volonte : il suffisait de changer d'identifiant de soiree dans
// l'URL. Ce fichier encodait ce comportement et affirmait qu'un quota epuise sur
// la soiree 1 laissait la soiree 2 intacte ; il prouvait donc le trou.
//
// L'IP vient desormais de req.ip, pas de x-forwarded-for[0] (que le client
// ecrit lui-meme). Les apps de test posent donc `trust proxy` comme la vraie
// app : c'est ce reglage qui fait deriver a Express l'entree ecrite par le
// proxy, et qui rend le fait de poser x-forwarded-for representatif.
function appWithLimiter() {
  const app = express();
  app.set('trust proxy', 1);
  const limiter = rateLimit(2, 60_000);
  app.post('/e/:eventId/don', (req, _res, next) => {
    req.eventId = Number(req.params.eventId);
    next();
  }, limiter, (_req, res) => res.json({ ok: true }));
  return app;
}

describe('rate-limit : plafond GLOBAL par IP', () => {
  it('ne se laisse pas contourner en changeant de soiree', async () => {
    const app = appWithLimiter();

    // Deux requetes sur la soiree 1 : le quota de l'IP est atteint.
    expect((await request(app).post('/e/1/don')).status).toBe(200);
    expect((await request(app).post('/e/1/don')).status).toBe(200);
    expect((await request(app).post('/e/1/don')).status).toBe(429);

    // Changer de soiree ne rend PAS un quota neuf : c'est l'IP qui est limitee.
    expect((await request(app).post('/e/2/don')).status).toBe(429);
    expect((await request(app).post('/e/99999/don')).status).toBe(429);
  });

  it('limite chaque IP separement', async () => {
    const app = appWithLimiter();

    // L'IP A epuise son quota...
    expect((await request(app).post('/e/1/don').set('x-forwarded-for', '10.0.0.1')).status).toBe(200);
    expect((await request(app).post('/e/1/don').set('x-forwarded-for', '10.0.0.1')).status).toBe(200);
    expect((await request(app).post('/e/1/don').set('x-forwarded-for', '10.0.0.1')).status).toBe(429);

    // ...sans consommer celui de l'IP B, sur la meme soiree.
    expect((await request(app).post('/e/1/don').set('x-forwarded-for', '10.0.0.2')).status).toBe(200);
    expect((await request(app).post('/e/1/don').set('x-forwarded-for', '10.0.0.2')).status).toBe(200);
    expect((await request(app).post('/e/1/don').set('x-forwarded-for', '10.0.0.2')).status).toBe(429);
  });

  it('ignore l IP que le CLIENT s invente en tete de x-forwarded-for', async () => {
    // Derriere un proxy (1 saut), l'IP REELLE est ajoutee A LA FIN de
    // x-forwarded-for : tout ce qui precede a ete ecrit par le client. Le
    // limiteur lisait la PREMIERE entree — chacun pouvait donc se fabriquer un
    // quota neuf a chaque requete, et faire enfler les Maps au passage.
    const app = appWithLimiter();
    const REELLE = '203.0.113.9';
    const depuisUneIpInventee = (inventee: string) =>
      request(app).post('/e/1/don').set('x-forwarded-for', `${inventee}, ${REELLE}`);

    expect((await depuisUneIpInventee('9.9.9.1')).status).toBe(200);
    expect((await depuisUneIpInventee('9.9.9.2')).status).toBe(200);
    // Trois IP inventees differentes, une seule IP reelle : le quota est epuise.
    expect((await depuisUneIpInventee('9.9.9.3')).status).toBe(429);
  });

  it('ne fabrique pas un quota neuf quand la soiree change dans un MEME montage', async () => {
    // Le miroir du premier test, mais sur un seul point de montage : c'est
    // req.eventId, et non l'URL, qui varie. Une cle qui reintegrerait la soiree
    // rendrait la 2e requete verte. Le montage sans soiree du tout est couvert
    // par la 3e : la cle ne depend d'aucune resolution en amont.
    const app = express();
    app.set('trust proxy', 1);
    app.post(
      '/don',
      (req, _res, next) => {
        const asked = Number(req.query.event);
        if (Number.isInteger(asked) && asked > 0) {
          req.eventId = asked;
        }
        next();
      },
      rateLimit(1, 60_000),
      (_req, res) => res.json({ ok: true })
    );

    expect((await request(app).post('/don?event=1')).status).toBe(200);
    expect((await request(app).post('/don?event=2')).status).toBe(429);
    expect((await request(app).post('/don')).status).toBe(429);
  });
});

// --- Exemption d'autorite : DIFFEREE, SCINDEE et BORNEE ---------------------
//
// Verifier un code de soiree deroule un scrypt (~50 ms). Le plafond ne peut donc
// pas etre leve « avant », sur un chemin public : ce serait offrir un
// amplificateur de charge a n'importe quel jeton bidon. Le contournement est
// consulte UNIQUEMENT au-dela du plafond.
//
// Au-dela du plafond, il se decide en deux temps :
//   - un verdict GRATUIT, toujours consulte, qui reconnait l'organisateur sans
//     rien depenser ;
//   - un verdict COUTEUX, consulte seulement derriere un 'needs-check' et
//     seulement tant que le budget d'echecs n'est pas epuise.
//
// App nue : c'est le MIDDLEWARE qui est sous test ici, pas une route.
function appWith(limiter: ReturnType<typeof rateLimit>) {
  const app = express();
  app.post('/don', limiter, (_req, res) => res.json({ ok: true }));
  return app;
}

describe('rate-limit : contournement d autorite au-dela du plafond', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ne consulte AUCUN verdict sous le plafond', async () => {
    // Le coeur du dispositif : tant qu'il reste du quota, personne ne paie de
    // verification d'autorite — donc aucun scrypt n'est atteignable.
    const free = vi.fn((): FreeVerdict => 'grant');
    const costly = vi.fn((): CostlyVerdict => 'grant');
    const app = appWith(rateLimit(2, 60_000, { freeVerdict: free, costlyVerdict: costly }));

    expect((await request(app).post('/don')).status).toBe(200);
    expect((await request(app).post('/don')).status).toBe(200);
    expect(free).not.toHaveBeenCalled();
    expect(costly).not.toHaveBeenCalled();

    // Au 3e seulement, le plafond etant atteint, la question est posee.
    expect((await request(app).post('/don')).status).toBe(200);
    expect(free).toHaveBeenCalledTimes(1);
    // Et la partie CHERE reste hors d'atteinte : le verdict gratuit a suffi.
    expect(costly).not.toHaveBeenCalled();
  });

  it('traduit les verdicts : grant passe, no-claim refuse, needs-check delegue', async () => {
    let free: FreeVerdict = 'no-claim';
    let costly: CostlyVerdict = 'deny';
    const app = appWith(rateLimit(1, 60_000, {
      freeVerdict: () => free,
      costlyVerdict: () => costly
    }));

    expect((await request(app).post('/don')).status).toBe(200);

    free = 'no-claim';
    expect((await request(app).post('/don')).status).toBe(429);
    free = 'grant';
    expect((await request(app).post('/don')).status).toBe(200);

    free = 'needs-check';
    costly = 'deny';
    expect((await request(app).post('/don')).status).toBe(429);
    costly = 'grant';
    expect((await request(app).post('/don')).status).toBe(200);
  });

  it('sans contournement declare, le plafond reste sec', async () => {
    const app = appWith(rateLimit(1, 60_000));

    expect((await request(app).post('/don')).status).toBe(200);
    expect((await request(app).post('/don')).status).toBe(429);
  });

  it('borne le nombre de verifications COUTEUSES refusees par fenetre', async () => {
    // Une fois le budget d'echecs epuise, la branche chere n'est PLUS invoquee :
    // c'est ce qui plafonne le nombre de scrypts qu'une IP peut declencher.
    const costly = vi.fn((): CostlyVerdict => 'deny');
    const app = appWith(rateLimit(1, 60_000, {
      freeVerdict: () => 'needs-check',
      costlyVerdict: costly,
      maxBypassFailures: 3
    }));

    expect((await request(app).post('/don')).status).toBe(200);

    for (let i = 0; i < 8; i++) {
      expect((await request(app).post('/don')).status).toBe(429);
    }

    expect(costly).toHaveBeenCalledTimes(3);
  });

  it('borne a 30 par defaut, sans avoir a le declarer', async () => {
    // Le defaut est ce qui protege la vraie route : donations.ts ne passe pas
    // maxBypassFailures. Si la constante disparaissait ou devenait Infinity,
    // rien d'autre dans la suite ne s'en apercevrait.
    const costly = vi.fn((): CostlyVerdict => 'deny');
    const app = appWith(rateLimit(1, 60_000, {
      freeVerdict: () => 'needs-check',
      costlyVerdict: costly
    }));

    expect((await request(app).post('/don')).status).toBe(200);
    for (let i = 0; i < 40; i++) {
      expect((await request(app).post('/don')).status).toBe(429);
    }

    expect(costly).toHaveBeenCalledTimes(30);
  });

  it('une rafale SANS jeton ne consomme pas le budget (wifi de salle)', async () => {
    // Les donateurs de la salle partagent l'IP de l'operateur. Leurs refus a eux
    // ne pretendent a aucune autorite ('no-claim') : ils ne coutent rien, donc
    // ils ne doivent rien fermer.
    let free: FreeVerdict = 'no-claim';
    const costly = vi.fn((): CostlyVerdict => 'grant');
    const app = appWith(rateLimit(1, 60_000, {
      freeVerdict: () => free,
      costlyVerdict: costly,
      maxBypassFailures: 2
    }));

    expect((await request(app).post('/don')).status).toBe(200);
    for (let i = 0; i < 10; i++) {
      expect((await request(app).post('/don')).status).toBe(429);
    }
    expect(costly).not.toHaveBeenCalled();

    // L'admin de soiree arrive ensuite : la branche couteuse lui est intacte.
    free = 'needs-check';
    expect((await request(app).post('/don')).status).toBe(200);
    expect(costly).toHaveBeenCalledTimes(1);
  });

  it('une rafale de jetons INVALIDES ferme la branche couteuse pour la fenetre', async () => {
    // Le pendant du test precedent : 'deny' consomme le budget. C'est le prix a
    // payer pour que le scrypt reste borne.
    let costly: CostlyVerdict = 'deny';
    const spy = vi.fn(() => costly);
    const app = appWith(rateLimit(1, 60_000, {
      freeVerdict: () => 'needs-check',
      costlyVerdict: spy,
      maxBypassFailures: 2
    }));

    expect((await request(app).post('/don')).status).toBe(200);
    expect((await request(app).post('/don')).status).toBe(429);
    expect((await request(app).post('/don')).status).toBe(429);
    expect(spy).toHaveBeenCalledTimes(2);

    costly = 'grant';
    expect((await request(app).post('/don')).status).toBe(429);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('le budget epuise ne verrouille PAS l autorite gratuite (organisateur)', async () => {
    // REGRESSION. Le budget d'echecs precedait autrefois la consultation du
    // contournement, et le contournement melangeait les deux verdicts : un tiers
    // qui envoyait des POST avec un jeton bidon depuis l'IP de la salle epuisait
    // le budget, apres quoi l'OPERATEUR muni du VRAI jeton — dont la
    // verification est une simple comparaison de chaine — recevait 429 sur
    // chaque don pendant toute la fenetre. Symetrique exact du cas 'no-claim'
    // qu'on voulait eviter.
    //
    // Le verdict GRATUIT est desormais rendu AVANT toute lecture du budget : il
    // ne peut plus etre ferme par des echecs que l'organisateur n'a pas commis.
    let free: FreeVerdict = 'needs-check';
    const costly = vi.fn((): CostlyVerdict => 'deny');
    const app = appWith(rateLimit(1, 60_000, {
      freeVerdict: () => free,
      costlyVerdict: costly,
      maxBypassFailures: 2
    }));

    expect((await request(app).post('/don')).status).toBe(200);

    // Le tiers epuise le budget, puis continue : la branche chere est fermee.
    for (let i = 0; i < 6; i++) {
      expect((await request(app).post('/don')).status).toBe(429);
    }
    expect(costly).toHaveBeenCalledTimes(2);

    // L'operateur, meme IP, meme fenetre : il passe.
    free = 'grant';
    expect((await request(app).post('/don')).status).toBe(200);
    expect((await request(app).post('/don')).status).toBe(200);
    // Et son passage n'a rien coute : la branche chere n'a pas ete rouverte.
    expect(costly).toHaveBeenCalledTimes(2);
  });

  it('un passage accorde ne consomme PAS le quota public', async () => {
    // Preuve par la fenetre glissante : seul un horodatage ECRIT dans le quota
    // public peut survivre a l'expiration du premier. Si les passages accordes
    // en consommaient, la requete publique finale serait encore refusee.
    // Seule l'horloge est simulee (toFake: ['Date']) : les vraies E/S de
    // supertest continuent de tourner.
    vi.useFakeTimers({ toFake: ['Date'] });
    const t0 = new Date('2026-07-28T20:00:00Z').getTime();
    vi.setSystemTime(t0);

    let free: FreeVerdict = 'no-claim';
    const app = appWith(rateLimit(1, 60_000, { freeVerdict: () => free }));

    expect((await request(app).post('/don')).status).toBe(200); // quota : 1/1
    expect((await request(app).post('/don')).status).toBe(429);

    // A mi-fenetre, l'operateur saisit trois dons authentifies.
    vi.setSystemTime(t0 + 30_000);
    free = 'grant';
    expect((await request(app).post('/don')).status).toBe(200);
    expect((await request(app).post('/don')).status).toBe(200);
    expect((await request(app).post('/don')).status).toBe(200);

    // Le seul horodatage public (t0) vient d'expirer ; ceux de l'operateur,
    // s'ils existaient, seraient encore vivants (t0+30s).
    vi.setSystemTime(t0 + 61_000);
    free = 'no-claim';
    expect((await request(app).post('/don')).status).toBe(200);
  });
});

// --- Integration : la vraie app, la vraie authentification ------------------
//
// Les tests synthetiques ci-dessus prouvent la MECANIQUE du limiteur. Ceux-ci
// prouvent le CABLAGE : que le POST de don reel exempte bien l'operateur du gala
// et personne d'autre, avec le VRAI predicat de donations.ts — pas un espion.
describe('POST de don : l autorite reelle est exemptee du plafond', () => {
  const ORGANIZER_TOKEN = 'organisateur-limiteur';
  const SALLE_IP = '203.0.113.77';
  const AUTRE_SALLE_IP = '203.0.113.78';
  const SALLE_ATTAQUEE_IP = '203.0.113.79';
  const PLAFOND = 10;

  let app: express.Express;
  let eventId = 0;
  let eventAdminCode = '';

  beforeAll(async () => {
    // Hors production l'authentification laisse passer sans secret configure :
    // sans ce jeton, tout ce fichier serait vert sans rien prouver. Pose AVANT
    // createApp.
    process.env.ADMIN_TOKEN = ORGANIZER_TOKEN;
    app = await createTestApp();

    const creation = await request(app)
      .post('/api/events')
      .set('x-admin-token', ORGANIZER_TOKEN)
      .send({ slug: 'limiteur-exemption', name: 'Limiteur Exemption', status: 'active' });

    expect(creation.status).toBe(201);
    eventId = creation.body.event.id;
    // Le code admin de soiree n'est renvoye QU'ICI, une seule fois.
    eventAdminCode = creation.body.adminCode;
    expect(typeof eventAdminCode).toBe('string');
    expect(eventAdminCode.length).toBeGreaterThan(0);

    // created_at volontairement ancien : la soiree active du seed reste la plus
    // recente, donc resolveActive() — et avec lui le flux herite des autres
    // fichiers — ne bouge pas.
    getDb().run("UPDATE events SET created_at = '2000-01-01 00:00:00' WHERE id = ?", [eventId]);
    saveDatabase();
  });

  afterAll(() => {
    // Les POST de dons ont sauvegarde toute la base : on efface dons ET soiree
    // de test avant le dernier save.
    const db = getDb();
    db.run('DELETE FROM donations WHERE event_id = ?', [eventId]);
    db.run('DELETE FROM event_configs WHERE event_id = ?', [eventId]);
    db.run('DELETE FROM events WHERE id = ?', [eventId]);
    saveDatabase();
    delete process.env.ADMIN_TOKEN;
  });

  function donDepuis(ip: string, lastName: string) {
    return request(app)
      .post(`/api/events/${eventId}/donations`)
      .set('x-forwarded-for', ip)
      .send({ firstName: 'Don', lastName, amount: 1800 });
  }

  function don(lastName: string) {
    return donDepuis(SALLE_IP, lastName);
  }

  it('plafonne le public mais laisse passer organisateur et admin de soiree', async () => {
    // 1. La salle epuise le plafond public depuis son wifi partage.
    for (let i = 0; i < PLAFOND; i++) {
      expect((await don(`Public${i}`)).status).toBe(201);
    }
    expect((await don('Onzieme')).status).toBe(429);

    // 2. L'operateur du gala, jeton organisateur : il passe.
    const parOrganisateur = await don('Organisateur').set('x-admin-token', ORGANIZER_TOKEN);
    expect(parOrganisateur.status).toBe(201);
    expect(parOrganisateur.body.donation.id).toBeGreaterThan(0);

    // 3. L'admin de CETTE soiree, avec le code renvoye a la creation : il passe
    //    aussi (c'est lui qui tient le panneau, sans le secret d'organisateur).
    const parAdminSoiree = await don('AdminSoiree').set('x-admin-token', eventAdminCode);
    expect(parAdminSoiree.status).toBe(201);

    // 4. Le public reste plafonne : les passages accordes n'ont pas consomme —
    //    ni rendu — le quota des donateurs.
    expect((await don('EncorePublic')).status).toBe(429);

    // 5. Un jeton bidon n'ouvre rien.
    expect((await don('Bidon').set('x-admin-token', 'ce-jeton-nexiste-pas')).status).toBe(429);
  });

  it('une longue rafale ANONYME ne ferme la porte a aucune des deux autorites', async () => {
    // Le predicat REEL de donations.ts, pas un espion : c'est lui qui decide que
    // le trafic sans jeton vaut 'no-claim'. S'il retombait sur 'needs-check',
    // ces 35 refus consommeraient le budget par defaut (30) et le code de soiree
    // — la branche COUTEUSE — se verrouillerait pour toute la fenetre.
    //
    // Une autre IP que le test precedent : le quota est par IP, et cette rafale
    // doit partir d'un compteur neuf.
    for (let i = 0; i < PLAFOND; i++) {
      expect((await donDepuis(AUTRE_SALLE_IP, `Foule${i}`)).status).toBe(201);
    }

    for (let i = 0; i < 35; i++) {
      expect((await donDepuis(AUTRE_SALLE_IP, `Anonyme${i}`)).status).toBe(429);
    }

    // L'organisateur : verdict GRATUIT, jamais soumis au budget.
    const parOrganisateur = await donDepuis(AUTRE_SALLE_IP, 'OrganisateurApresRafale')
      .set('x-admin-token', ORGANIZER_TOKEN);
    expect(parOrganisateur.status).toBe(201);

    // L'admin de soiree : verdict COUTEUX, qui n'aurait plus de budget si la
    // rafale anonyme l'avait consomme. C'est LUI qui rougit a la moindre
    // reclassification du trafic public.
    const parAdminSoiree = await donDepuis(AUTRE_SALLE_IP, 'AdminApresRafale')
      .set('x-admin-token', eventAdminCode);
    expect(parAdminSoiree.status).toBe(201);
  });

  it('un tiers qui brule le budget avec des jetons bidon ne bloque pas l organisateur', async () => {
    // REGRESSION, cablee de bout en bout. Le budget d'echecs est concu pour
    // borner le scrypt ; il ne doit borner QUE lui. Quand il precedait le
    // verdict d'autorite, il suffisait a un tiers d'envoyer des POST avec un
    // x-admin-token bidon depuis l'IP de la salle pour que l'OPERATEUR, muni du
    // vrai ORGANIZER_TOKEN, se retrouve a 429 sur chaque don de la soiree.
    for (let i = 0; i < PLAFOND; i++) {
      expect((await donDepuis(SALLE_ATTAQUEE_IP, `Debut${i}`)).status).toBe(201);
    }

    // 35 > 30 (budget par defaut) : la branche couteuse est fermee pour la
    // fenetre. C'est voulu — c'est meme le but.
    for (let i = 0; i < 35; i++) {
      const attaque = await donDepuis(SALLE_ATTAQUEE_IP, `Bidon${i}`)
        .set('x-admin-token', 'jeton-invente-par-un-tiers');
      expect(attaque.status).toBe(429);
    }

    // L'operateur n'a rien a voir avec ces echecs : son jeton se verifie par
    // comparaison de chaine, sans jamais consulter le budget.
    const parOrganisateur = await donDepuis(SALLE_ATTAQUEE_IP, 'OperateurSousAttaque')
      .set('x-admin-token', ORGANIZER_TOKEN);
    expect(parOrganisateur.status).toBe(201);
  });
});

// --- Une seule verification d'autorite par requete --------------------------
//
// Deux gardes consecutives ont besoin du meme verdict sur le POST de don : le
// limiteur (au-dela du plafond) puis requireActiveOrAdmin (toujours). Chacune
// posait la question a son tour, ce qui faisait DEUX scrypt pour une seule
// requete — sur le chemin exact qu'on venait de vouloir borner. Le verdict est
// desormais memoise sur la requete.
describe('POST de don : l autorite ne se verifie qu UNE fois par requete', () => {
  const ORGANIZER_TOKEN = 'organisateur-memo';
  const IP = '203.0.113.90';
  const PLAFOND = 10;

  let app: express.Express;
  let eventId = 0;
  let eventAdminCode = '';

  beforeAll(async () => {
    process.env.ADMIN_TOKEN = ORGANIZER_TOKEN;
    app = await createTestApp();

    // Soiree en BROUILLON : c'est le seul cas ou les deux gardes ont vraiment
    // besoin du verdict. Sur une soiree active, requireActiveOrAdmin s'arrete a
    // l'etat et ne demande rien — le double calcul y serait invisible.
    const creation = await request(app)
      .post('/api/events')
      .set('x-admin-token', ORGANIZER_TOKEN)
      .send({ slug: 'limiteur-memo', name: 'Limiteur Memo' });

    expect(creation.status).toBe(201);
    expect(creation.body.event.status).toBe('draft');
    eventId = creation.body.event.id;
    eventAdminCode = creation.body.adminCode;
  });

  afterAll(() => {
    const db = getDb();
    db.run('DELETE FROM donations WHERE event_id = ?', [eventId]);
    db.run('DELETE FROM event_configs WHERE event_id = ?', [eventId]);
    db.run('DELETE FROM events WHERE id = ?', [eventId]);
    saveDatabase();
    delete process.env.ADMIN_TOKEN;
  });

  it('ne deroule qu UN scrypt pour une saisie admin au-dela du plafond', async () => {
    // Les dons publics vers une soiree en brouillon sont refuses (403) par la
    // garde d'etat, mais le limiteur, monte devant elle, les compte : c'est
    // ainsi que le plafond se remplit ici.
    for (let i = 0; i < PLAFOND; i++) {
      const refus = await request(app)
        .post(`/api/events/${eventId}/donations`)
        .set('x-forwarded-for', IP)
        .send({ firstName: 'Public', lastName: `Brouillon${i}`, amount: 1500 });
      expect(refus.status).toBe(403);
    }

    // verifyAdminCode EST le scrypt : le compter, c'est compter les scrypt.
    const scrypt = vi.spyOn(eventService, 'verifyAdminCode');
    try {
      const saisie = await request(app)
        .post(`/api/events/${eventId}/donations`)
        .set('x-forwarded-for', IP)
        .set('x-admin-token', eventAdminCode)
        .send({ firstName: 'Saisie', lastName: 'Memoisee', amount: 3600 });

      // Le limiteur l'exempte du plafond, la garde d'etat accepte la saisie
      // admin sur un brouillon.
      expect(saisie.status).toBe(201);
      // ...et les deux gardes ont partage le MEME calcul.
      expect(scrypt).toHaveBeenCalledTimes(1);
    } finally {
      scrypt.mockRestore();
    }
  });
});
