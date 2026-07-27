import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../helpers/app';
import { insertEvent } from '../helpers/events';
import { getDb, saveDatabase } from '../../src/db/init';
import { hashAdminCode } from '../../src/middleware/admin-code';

// Les routes prefixees /api/events/:eventId/... doivent avoir EXACTEMENT la
// forme de reponse des routes heritees (condition de migration du frontend), et
// resoudre la soiree NOMMEE, jamais un repli silencieux.

const ORGANIZER_TOKEN = 'organisateur-prefixe';
const CODE_A = 'code-prefixe-a';
const CODE_B = 'code-prefixe-b';

let soireeP = 0;
let soireeA = 0;
let soireeB = 0;
let soireeActive = 0;

describe('routes de ressources prefixees par soiree', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await createTestApp();
    // Secret configure : sans lui, hors production le middleware laisserait
    // passer et les cas d'auth seraient verts sans rien prouver.
    process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;
    // Soirees de test en `draft` : ne pas deplacer la soiree active partagee.
    soireeP = insertEvent({ slug: 'prefixe-p', name: 'Prefixe P' });
    soireeA = insertEvent({ slug: 'prefixe-a', name: 'Prefixe A', adminCodeHash: hashAdminCode(CODE_A) });
    soireeB = insertEvent({ slug: 'prefixe-b', name: 'Prefixe B', adminCodeHash: hashAdminCode(CODE_B) });
    // Une soiree ACTIVE a nous, pour prouver que le don public passe toujours
    // sur le montage prefixe. `created_at` volontairement ancien : la soiree
    // active du seed reste la plus recente, donc resolveActive() — et avec elle
    // tout le flux herite des autres fichiers — ne bouge pas.
    soireeActive = insertEvent({
      slug: 'prefixe-active',
      name: 'Prefixe Active',
      status: 'active',
      createdAt: '2000-01-01 00:00:00'
    });
  });

  afterAll(() => {
    // insertEvent n'a rien persiste, mais un POST de don a sauvegarde toute la
    // base : on efface donc dons ET soirees de test avant le dernier save.
    const db = getDb();
    for (const id of [soireeP, soireeA, soireeB, soireeActive]) {
      db.run('DELETE FROM donations WHERE event_id = ?', [id]);
      db.run('DELETE FROM event_configs WHERE event_id = ?', [id]);
      db.run('DELETE FROM events WHERE id = ?', [id]);
    }
    saveDatabase();
    delete process.env.ORGANIZER_TOKEN;
  });

  describe('formes de reponse identiques aux heritees', () => {
    it('GET /api/events/:id/config garde la forme', async () => {
      const response = await request(app).get(`/api/events/${soireeP}/config`);

      expect(response.status).toBe(200);
      expect(Object.keys(response.body).sort()).toEqual([
        'displaySettings',
        'goalAmount',
        'menorahSegments',
        'presetAmounts'
      ]);
    });

    it('GET /api/events/:id/stats garde la forme', async () => {
      const response = await request(app).get(`/api/events/${soireeP}/stats`);

      expect(response.status).toBe(200);
      expect(Object.keys(response.body).sort()).toEqual([
        'donationCount',
        'litSegments',
        'percentComplete',
        'totalAmount'
      ]);
    });

    it('GET /api/events/:id/donations garde la forme', async () => {
      const response = await request(app).get(`/api/events/${soireeP}/donations`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.donations)).toBe(true);
      expect(response.body.stats).toBeDefined();
    });

    it('GET /api/events/:id/donations/premium-words garde la forme', async () => {
      // Route PUBLIQUE (la page de promesse de don l'appelle sans jeton) et
      // consommee telle quelle par le frontend : il lit `words` ET `tiers`.
      // Rien d'autre dans la suite ne montait cette route sur le prefixe — un
      // /premium-words avale par /:id, ou une reponse amputee de `tiers`,
      // seraient passes inapercus jusqu'au gala.
      const response = await request(app).get(`/api/events/${soireeP}/donations/premium-words`);

      expect(response.status).toBe(200);
      expect(Object.keys(response.body).sort()).toEqual(['tiers', 'words']);
      expect(Array.isArray(response.body.words)).toBe(true);
      expect(response.body.tiers).toBeDefined();
    });
  });

  describe('soiree inexistante', () => {
    it('GET /api/events/:id/config renvoie 404 sec, pas de repli', async () => {
      const response = await request(app).get('/api/events/9999999/config');
      expect(response.status).toBe(404);
      // Jamais le message interne d'implementation.
      expect(JSON.stringify(response.body)).not.toContain('Soiree inconnue');
    });

    it('GET /api/events/:id/donations renvoie 404 sec', async () => {
      const response = await request(app).get('/api/events/9999999/donations');
      expect(response.status).toBe(404);
    });
  });

  describe('rattachement a la bonne soiree', () => {
    it('POST /api/events/:id/donations rattache le don a la soiree nommee', async () => {
      // Soiree en brouillon : c'est une SAISIE ADMIN, donc jeton organisateur.
      // Le don public vers une soiree non-active est couvert plus bas.
      const creation = await request(app)
        .post(`/api/events/${soireeP}/donations`)
        .set('x-admin-token', ORGANIZER_TOKEN)
        .send({ firstName: 'Prefixe', lastName: 'Don', amount: 4200 });

      expect(creation.status).toBe(201);
      const row = getDb().exec('SELECT event_id FROM donations WHERE id = ?', [creation.body.donation.id]);
      expect(row[0].values[0][0]).toBe(soireeP);
    });

    it('ne laisse pas voir un don de A sur la route de B', async () => {
      const creation = await request(app)
        .post(`/api/events/${soireeA}/donations`)
        .set('x-admin-token', CODE_A)
        .send({ firstName: 'IsoleA', lastName: 'X', amount: 999 });

      expect(creation.status).toBe(201);
      const surB = await request(app).get(`/api/events/${soireeB}/donations`);
      const ids = surB.body.donations.map((d: { id: number }) => d.id);
      expect(ids).not.toContain(creation.body.donation.id);
    });
  });

  // L'outil sert plusieurs soirees a la fois : plusieurs peuvent etre actives,
  // et un operateur admin doit pouvoir saisir un don sur une soiree en brouillon
  // ou archivee (preparation, rattrapage). Ce qui doit rester ferme, c'est le
  // don PUBLIC — sans jeton — vers une soiree qui n'accueille personne.
  describe('don vers une soiree non-active', () => {
    it('refuse en 403 un don PUBLIC (sans jeton) vers une soiree en brouillon', async () => {
      const refus = await request(app)
        .post(`/api/events/${soireeP}/donations`)
        .send({ firstName: 'Public', lastName: 'Brouillon', amount: 1000 });

      expect(refus.status).toBe(403);
      // Et rien n'a ete ecrit.
      const rows = getDb().exec(
        `SELECT id FROM donations WHERE event_id = ? AND last_name = 'Brouillon'`,
        [soireeP]
      );
      expect(rows.length).toBe(0);
    });

    it('accepte le don saisi avec le code admin de CETTE soiree', async () => {
      const creation = await request(app)
        .post(`/api/events/${soireeA}/donations`)
        .set('x-admin-token', CODE_A)
        .send({ firstName: 'Saisie', lastName: 'Admin', amount: 2500 });

      expect(creation.status).toBe(201);
      expect(creation.body.donation.amount).toBe(2500);
    });

    it('refuse en 403 le code d une AUTRE soiree', async () => {
      const refus = await request(app)
        .post(`/api/events/${soireeA}/donations`)
        .set('x-admin-token', CODE_B)
        .send({ firstName: 'Voisin', lastName: 'Indiscret', amount: 700 });

      expect(refus.status).toBe(403);
    });

    it('en PRODUCTION sans aucun secret, echoue ferme en 503 et non en 403', async () => {
      // La garde d'etat retombait sur le 403 generique quand aucun secret n'est
      // configure. C'est un mensonge de diagnostic : rien ne refuse le don par
      // POLITIQUE, c'est le serveur qui est mal deploye. Le reste de la couche
      // d'authentification (admin-auth.ts handleMissingSecret) repond 503 avec
      // un journal SECURITY dans exactement ce cas ; la garde d'etat doit dire
      // la meme chose, sinon l'incident se deguise en refus normal.
      const nodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      delete process.env.ORGANIZER_TOKEN;

      try {
        const response = await request(app)
          .post(`/api/events/${soireeP}/donations`)
          .send({ firstName: 'Public', lastName: 'SansSecret', amount: 1100 });

        expect(response.status).toBe(503);
      } finally {
        process.env.NODE_ENV = nodeEnv;
        process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;
      }
    });

    it('laisse passer le don PUBLIC vers une soiree ACTIVE', async () => {
      const creation = await request(app)
        .post(`/api/events/${soireeActive}/donations`)
        .send({ firstName: 'Public', lastName: 'Bienvenu', amount: 1800 });

      expect(creation.status).toBe(201);
    });
  });

  describe('auth de soiree sur les routes prefixees', () => {
    it('accepte le code de B sur une ressource de B', async () => {
      const response = await request(app)
        .put(`/api/events/${soireeB}/config`)
        .set('x-admin-token', CODE_B)
        .send({ goalAmount: 5000 });

      expect(response.status).toBe(200);
      expect(response.body.goalAmount).toBe(5000);
    });

    it('refuse en 401 le code de A sur une ressource de B', async () => {
      // 401 et non 403 : requireEventAdmin ne cherche plus a savoir si le code
      // refuse ouvre une AUTRE soiree. Produire ce diagnostic coutait un
      // scryptSync par soiree existante, sur une route ni limitee ni
      // authentifiee (voir tests/security/event-admin.test.ts). Ce qui compte
      // ici reste vrai : le code de A n'ecrit rien sur B.
      const response = await request(app)
        .put(`/api/events/${soireeB}/config`)
        .set('x-admin-token', CODE_A)
        .send({ goalAmount: 6000 });

      expect(response.status).toBe(401);

      // Et la configuration de B n'a pas bouge.
      const config = await request(app).get(`/api/events/${soireeB}/config`);
      expect(config.body.goalAmount).not.toBe(6000);
    });

    it('accepte l organisateur sur n importe quelle soiree', async () => {
      const response = await request(app)
        .put(`/api/events/${soireeA}/config`)
        .set('x-admin-token', ORGANIZER_TOKEN)
        .send({ goalAmount: 7000 });

      expect(response.status).toBe(200);
    });

    it('refuse ?full=1 sans jeton en 401', async () => {
      const response = await request(app).get(`/api/events/${soireeA}/donations?full=1`);
      expect(response.status).toBe(401);
    });

    it('export CSV : organisateur accepte, absence de jeton refusee', async () => {
      const ok = await request(app)
        .get(`/api/events/${soireeA}/donations/export.csv`)
        .set('x-admin-token', ORGANIZER_TOKEN);
      expect(ok.status).toBe(200);
      expect(ok.headers['content-type']).toContain('text/csv');

      const refuse = await request(app).get(`/api/events/${soireeA}/donations/export.csv`);
      expect(refuse.status).toBe(401);
    });
  });
});

// L'auth doit se prononcer AVANT la resolution de soiree. Sans soiree active,
// l'export CSV herite sans jeton doit repondre 401 (defaut d'authentification),
// jamais 503 (defaut de configuration) qui masquait le 401.
describe('ordre des middlewares sur les routes heritees', () => {
  let app: express.Express;
  let soireeActive = 0;

  beforeAll(async () => {
    app = await createTestApp();
    const row = getDb().exec("SELECT id FROM events WHERE status = 'active' ORDER BY created_at DESC, id DESC LIMIT 1");
    soireeActive = row[0].values[0][0] as number;
  });

  afterAll(() => {
    delete process.env.ADMIN_TOKEN;
  });

  it('CSV herite sans jeton ni soiree active renvoie 401, pas 503', async () => {
    process.env.ADMIN_TOKEN = 'secret-present';
    const db = getDb();
    db.run("UPDATE events SET status = 'archived' WHERE status = 'active'");

    try {
      const response = await request(app).get('/api/donations/export.csv');
      expect(response.status).toBe(401);
    } finally {
      db.run("UPDATE events SET status = 'active' WHERE id = ?", [soireeActive]);
    }
  });
});
