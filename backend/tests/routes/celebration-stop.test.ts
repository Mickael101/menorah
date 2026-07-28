import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../helpers/app';
import { insertEvent } from '../helpers/events';
import { getDb, saveDatabase } from '../../src/db/init';

// POST /gifs/stop — le bouton d'urgence de l'operateur. Deux contrats :
// (1) il exige l'autorite admin (ADMIN pose, sinon requireAdmin laisse passer
//     hors production et un test sans jeton serait vert sans rien prouver) ;
// (2) il repond 200 avec l'autorite, meme sans celebration en cours
//     (evenement idempotent, l'ecran decide quoi couper).

const ORGANIZER_TOKEN = 'organisateur-stop';

let soiree = 0;

describe('POST /gifs/stop', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await createTestApp();
    process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;
    soiree = insertEvent({ slug: 'stop-a', name: 'Stop A' });
  });

  afterAll(() => {
    const db = getDb();
    db.run('DELETE FROM events WHERE id = ?', [soiree]);
    saveDatabase();
    delete process.env.ORGANIZER_TOKEN;
  });

  it('refuse sans jeton admin (401)', async () => {
    const response = await request(app).post(`/api/events/${soiree}/gifs/stop`);
    expect(response.status).toBe(401);
  });

  it('accepte avec le jeton organisateur, meme sans celebration en cours', async () => {
    const response = await request(app)
      .post(`/api/events/${soiree}/gifs/stop`)
      .set('x-admin-token', ORGANIZER_TOKEN);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
