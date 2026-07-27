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
  });

  afterAll(() => {
    // insertEvent n'a rien persiste, mais un POST de don a sauvegarde toute la
    // base : on efface donc dons ET soirees de test avant le dernier save.
    const db = getDb();
    for (const id of [soireeP, soireeA, soireeB]) {
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
      const creation = await request(app)
        .post(`/api/events/${soireeP}/donations`)
        .send({ firstName: 'Prefixe', lastName: 'Don', amount: 4200 });

      expect(creation.status).toBe(201);
      const row = getDb().exec('SELECT event_id FROM donations WHERE id = ?', [creation.body.donation.id]);
      expect(row[0].values[0][0]).toBe(soireeP);
    });

    it('ne laisse pas voir un don de A sur la route de B', async () => {
      const creation = await request(app)
        .post(`/api/events/${soireeA}/donations`)
        .send({ firstName: 'IsoleA', lastName: 'X', amount: 999 });

      const surB = await request(app).get(`/api/events/${soireeB}/donations`);
      const ids = surB.body.donations.map((d: { id: number }) => d.id);
      expect(ids).not.toContain(creation.body.donation.id);
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

    it('refuse en 403 le code de A sur une ressource de B', async () => {
      const response = await request(app)
        .put(`/api/events/${soireeB}/config`)
        .set('x-admin-token', CODE_A)
        .send({ goalAmount: 6000 });

      expect(response.status).toBe(403);
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
