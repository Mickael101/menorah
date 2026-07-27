import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initTestDatabase } from '../helpers/app';
import { insertEvent } from '../helpers/events';
import { hashAdminCode } from '../../src/middleware/admin-code';
import { requireEventAdmin } from '../../src/middleware/admin-auth';

// L'auth a deux niveaux se prouve sur un harnais minimal : une route gardee par
// requireEventAdmin dont la cible est le parametre :eventId. Les vraies routes
// prefixees arrivent en E2 ; ce que cette tranche doit garantir, c'est la
// DECISION d'acces, isolee de tout le reste.
//
// PIEGE : hors production, requireAdmin laisse passer sans jeton par conception.
// Chaque cas pose donc ORGANIZER_TOKEN explicitement, sinon il serait vert sans
// rien prouver.

const ORGANIZER_TOKEN = 'jeton-organisateur';
const CODE_A = 'code-soiree-a';
const CODE_B = 'code-soiree-b';

let soireeA = 0;
let soireeB = 0;

function guardedApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.get(
    '/guard/:eventId',
    requireEventAdmin((req) => Number(req.params.eventId)),
    (_req, res) => res.json({ ok: true })
  );
  return app;
}

describe('requireEventAdmin — auth deux niveaux', () => {
  let app: express.Express;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    await initTestDatabase();
    soireeA = insertEvent({ slug: 'auth-a', name: 'Soiree A', adminCodeHash: hashAdminCode(CODE_A) });
    soireeB = insertEvent({ slug: 'auth-b', name: 'Soiree B', adminCodeHash: hashAdminCode(CODE_B) });
    app = guardedApp();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.ORGANIZER_TOKEN;
    delete process.env.ADMIN_TOKEN;
  });

  it('accepte ORGANIZER_TOKEN sur n importe quelle soiree', async () => {
    process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;

    for (const id of [soireeA, soireeB]) {
      const response = await request(app).get(`/guard/${id}`).set('x-admin-token', ORGANIZER_TOKEN);
      expect(response.status).toBe(200);
    }
  });

  it('accepte l alias ADMIN_TOKEN comme un organisateur', async () => {
    process.env.ADMIN_TOKEN = 'jeton-de-prod';

    const response = await request(app).get(`/guard/${soireeA}`).set('x-admin-token', 'jeton-de-prod');
    expect(response.status).toBe(200);
  });

  it('accepte le code d une soiree sur SA soiree', async () => {
    process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;

    const response = await request(app).get(`/guard/${soireeA}`).set('x-admin-token', CODE_A);
    expect(response.status).toBe(200);
  });

  it('refuse en 401 le code de A sur une ressource de B (desambiguisation retiree)', async () => {
    // Ce cas rendait 403 (« secret bon, portee refusee ») jusqu'a ce que le prix
    // de cette politesse soit mesure : pour la produire, la garde confrontait le
    // code refuse a TOUTES les soirees ayant un code, soit UN scryptSync par
    // soiree, sur une route ni limitee ni authentifiee. Quelques requetes
    // suffisaient a figer l'event loop de l'instance unique.
    //
    // Le 403 n'etait qu'un confort de diagnostic ; il ne vaut pas un deni de
    // service. Un code hors perimetre est desormais indistinguable d'un code
    // inconnu — ce qui, du point de vue de l'appelant, est aussi la bonne
    // reponse : il n'a rien a apprendre de l'existence des autres soirees.
    process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;

    const response = await request(app).get(`/guard/${soireeB}`).set('x-admin-token', CODE_A);
    expect(response.status).toBe(401);
  });

  it('refuse en 401 un code inconnu', async () => {
    process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;

    const response = await request(app).get(`/guard/${soireeA}`).set('x-admin-token', 'code-invente');
    expect(response.status).toBe(401);
  });

  it('refuse en 401 l absence de jeton quand un secret est configure', async () => {
    process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;

    const response = await request(app).get(`/guard/${soireeA}`);
    expect(response.status).toBe(401);
  });

  it('accepte le repli ?token= pour l organisateur', async () => {
    process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;

    const response = await request(app).get(`/guard/${soireeA}?token=${ORGANIZER_TOKEN}`);
    expect(response.status).toBe(200);
  });

  it('echoue ferme en 503 en production sans aucun secret configure', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ORGANIZER_TOKEN;
    delete process.env.ADMIN_TOKEN;

    const response = await request(app).get(`/guard/${soireeA}`);
    expect(response.status).toBe(503);
  });

  it('laisse passer hors production sans secret, par conception de dev', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ORGANIZER_TOKEN;
    delete process.env.ADMIN_TOKEN;

    const response = await request(app).get(`/guard/${soireeA}`);
    expect(response.status).toBe(200);
  });
});
