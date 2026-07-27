import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { rateLimit, OverLimitVerdict } from '../../src/middleware/rate-limit';
import { createTestApp } from '../helpers/app';
import { getDb, saveDatabase } from '../../src/db/init';

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
function appWithLimiter() {
  const app = express();
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

  it('n exige plus de soiree resolue pour compter', async () => {
    // Le limiteur est monte sur un chemin sans resolution de soiree : la cle ne
    // depend plus de req.eventId, donc un montage sans resolveEvent en amont
    // reste correctement plafonne (avant, tout ce trafic partageait la cle
    // « :none » et se comptait ensemble par accident).
    const app = express();
    app.post('/don', rateLimit(1, 60_000), (_req, res) => res.json({ ok: true }));

    expect((await request(app).post('/don')).status).toBe(200);
    expect((await request(app).post('/don')).status).toBe(429);
  });
});

// --- Exemption d'autorite, DIFFEREE et BORNEE -------------------------------
//
// Verifier une autorite de soiree peut derouler un scrypt (~50 ms). Le plafond
// ne peut donc pas etre leve « avant », sur un chemin public : ce serait offrir
// un amplificateur de charge a n'importe quel jeton bidon. Le contournement est
// consulte UNIQUEMENT au-dela du plafond, et le nombre de verifications
// refusees est lui-meme borne par IP et par fenetre.
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

  it('ne consulte JAMAIS le contournement sous le plafond', async () => {
    // Le coeur du dispositif : tant qu'il reste du quota, personne ne paie de
    // verification d'autorite — donc aucun scrypt n'est atteignable.
    const bypass = vi.fn((): OverLimitVerdict => 'grant');
    const app = appWith(rateLimit(2, 60_000, { overLimitBypass: bypass }));

    expect((await request(app).post('/don')).status).toBe(200);
    expect((await request(app).post('/don')).status).toBe(200);
    expect(bypass).not.toHaveBeenCalled();

    // Au 3e seulement, le plafond etant atteint, la question est posee.
    expect((await request(app).post('/don')).status).toBe(200);
    expect(bypass).toHaveBeenCalledTimes(1);
  });

  it('traduit les trois verdicts : grant passe, deny et no-claim refusent', async () => {
    let verdict: OverLimitVerdict = 'no-claim';
    const app = appWith(rateLimit(1, 60_000, { overLimitBypass: () => verdict }));

    expect((await request(app).post('/don')).status).toBe(200);

    verdict = 'no-claim';
    expect((await request(app).post('/don')).status).toBe(429);
    verdict = 'deny';
    expect((await request(app).post('/don')).status).toBe(429);
    verdict = 'grant';
    expect((await request(app).post('/don')).status).toBe(200);
  });

  it('sans contournement declare, le plafond reste sec', async () => {
    const app = appWith(rateLimit(1, 60_000));

    expect((await request(app).post('/don')).status).toBe(200);
    expect((await request(app).post('/don')).status).toBe(429);
  });

  it('borne le nombre de verifications refusees par fenetre (anti-amplification)', async () => {
    // Une fois le budget d'echecs epuise, le contournement n'est PLUS invoque :
    // c'est ce qui plafonne le nombre de scrypts qu'une IP peut declencher.
    const bypass = vi.fn((): OverLimitVerdict => 'deny');
    const app = appWith(rateLimit(1, 60_000, { overLimitBypass: bypass, maxBypassFailures: 3 }));

    expect((await request(app).post('/don')).status).toBe(200);

    for (let i = 0; i < 8; i++) {
      expect((await request(app).post('/don')).status).toBe(429);
    }

    expect(bypass).toHaveBeenCalledTimes(3);
  });

  it('une rafale SANS jeton ne verrouille pas le contournement (wifi de salle)', async () => {
    // Les donateurs de la salle partagent l'IP de l'operateur. Leurs refus a eux
    // ne pretendent a aucune autorite ('no-claim') : ils ne coutent rien, donc
    // ils ne doivent rien fermer.
    let verdict: OverLimitVerdict = 'no-claim';
    const bypass = vi.fn(() => verdict);
    const app = appWith(rateLimit(1, 60_000, { overLimitBypass: bypass, maxBypassFailures: 2 }));

    expect((await request(app).post('/don')).status).toBe(200);
    for (let i = 0; i < 10; i++) {
      expect((await request(app).post('/don')).status).toBe(429);
    }
    expect(bypass).toHaveBeenCalledTimes(10);

    // L'operateur arrive ensuite avec son vrai jeton : la porte est intacte.
    verdict = 'grant';
    expect((await request(app).post('/don')).status).toBe(200);
    expect(bypass).toHaveBeenCalledTimes(11);
  });

  it('une rafale de jetons INVALIDES, elle, ferme la porte pour la fenetre', async () => {
    // Le pendant du test precedent : 'deny' consomme le budget. C'est le prix a
    // payer pour que le scrypt reste borne — et la raison d'etre du troisieme
    // verdict.
    let verdict: OverLimitVerdict = 'deny';
    const bypass = vi.fn(() => verdict);
    const app = appWith(rateLimit(1, 60_000, { overLimitBypass: bypass, maxBypassFailures: 2 }));

    expect((await request(app).post('/don')).status).toBe(200);
    expect((await request(app).post('/don')).status).toBe(429);
    expect((await request(app).post('/don')).status).toBe(429);
    expect(bypass).toHaveBeenCalledTimes(2);

    verdict = 'grant';
    expect((await request(app).post('/don')).status).toBe(429);
    expect(bypass).toHaveBeenCalledTimes(2);
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

    let verdict: OverLimitVerdict = 'no-claim';
    const app = appWith(rateLimit(1, 60_000, { overLimitBypass: () => verdict }));

    expect((await request(app).post('/don')).status).toBe(200); // quota : 1/1
    expect((await request(app).post('/don')).status).toBe(429);

    // A mi-fenetre, l'operateur saisit trois dons authentifies.
    vi.setSystemTime(t0 + 30_000);
    verdict = 'grant';
    expect((await request(app).post('/don')).status).toBe(200);
    expect((await request(app).post('/don')).status).toBe(200);
    expect((await request(app).post('/don')).status).toBe(200);

    // Le seul horodatage public (t0) vient d'expirer ; ceux de l'operateur,
    // s'ils existaient, seraient encore vivants (t0+30s).
    vi.setSystemTime(t0 + 61_000);
    verdict = 'no-claim';
    expect((await request(app).post('/don')).status).toBe(200);
  });
});

// --- Integration : la vraie app, la vraie authentification ------------------
//
// Les tests synthetiques ci-dessus prouvent la MECANIQUE du limiteur. Celui-ci
// prouve le CABLAGE : que le POST de don reel exempte bien l'operateur du gala
// et personne d'autre.
describe('POST de don : l autorite reelle est exemptee du plafond', () => {
  const ORGANIZER_TOKEN = 'organisateur-limiteur';
  const SALLE_IP = '203.0.113.77';
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

  function don(lastName: string) {
    return request(app)
      .post(`/api/events/${eventId}/donations`)
      .set('x-forwarded-for', SALLE_IP)
      .send({ firstName: 'Don', lastName, amount: 1800 });
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
});
