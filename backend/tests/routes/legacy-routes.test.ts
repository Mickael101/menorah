import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../helpers/app';
import { getDb } from '../../src/db/init';
import { eventService } from '../../src/services/event.service';

// Des QR codes vers /don peuvent deja etre imprimes et cinq ecrans publics
// appellent ces routes. Elles ne changent ni d'URL ni de forme de reponse :
// elles resolvent desormais la soiree active, et c'est tout ce qui change.

function scalaire(sql: string, params: (string | number)[]): unknown {
  const result = getDb().exec(sql, params);
  return result.length === 0 || result[0].values.length === 0 ? null : result[0].values[0][0];
}

describe('routes heritees resolues sur la soiree active', () => {
  let app: express.Express;
  let soireeActive = 0;

  beforeAll(async () => {
    app = await createTestApp();
    const { event } = eventService.resolveActive();
    if (!event) {
      throw new Error('La migration doit laisser une soiree active');
    }
    soireeActive = event.id;
  });

  it('GET /api/config garde sa forme', async () => {
    const response = await request(app).get('/api/config');

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual([
      'displaySettings',
      'goalAmount',
      'menorahSegments',
      'presetAmounts'
    ]);
  });

  it('GET /api/stats garde sa forme', async () => {
    const response = await request(app).get('/api/stats');

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual([
      'donationCount',
      'litSegments',
      'percentComplete',
      'totalAmount'
    ]);
  });

  it('GET /api/donations garde sa forme', async () => {
    const response = await request(app).get('/api/donations');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.donations)).toBe(true);
    expect(response.body.stats).toBeDefined();
  });

  it('GET /api/donations/premium-words garde sa forme', async () => {
    const response = await request(app).get('/api/donations/premium-words');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.words)).toBe(true);
    expect(Array.isArray(response.body.tiers)).toBe(true);
  });

  it('POST /api/donations rattache le don a la soiree active', async () => {
    const creation = await request(app)
      .post('/api/donations')
      .send({ firstName: 'Heritee', lastName: 'Route', amount: 1234 });

    expect(creation.status).toBe(201);
    expect(scalaire('SELECT event_id FROM donations WHERE id = ?', [creation.body.donation.id]))
      .toBe(soireeActive);
  });

  it('POST puis GET /api/donations resolvent la MEME soiree', async () => {
    // Si l'ecriture et la lecture divergeaient, la liste reviendrait vide et le
    // test anti-fuite de donations-pii passerait a vide : il n'y aurait plus
    // rien a fuir. L'assertion doit donc porter sur la presence du don.
    const creation = await request(app)
      .post('/api/donations')
      .send({ firstName: 'Aller', lastName: 'Retour', amount: 4321 });

    const lecture = await request(app).get('/api/donations');
    const identifiants = lecture.body.donations.map((don: { id: number }) => don.id);

    expect(identifiants).toContain(creation.body.donation.id);
  });

  it('PUT /api/config ecrit sur la soiree active, plus sur le singleton', async () => {
    const objectif = 654321;

    const response = await request(app).put('/api/config').send({ goalAmount: objectif });

    expect(response.status).toBe(200);
    expect(response.body.goalAmount).toBe(objectif);
    expect(scalaire('SELECT goal_amount FROM event_configs WHERE event_id = ?', [soireeActive]))
      .toBe(objectif);
    // L'ancien singleton n'est plus ni cree ni ecrit : sur base neuve la table
    // n'existe pas ; sur base ancienne elle survit mais ne recoit plus l'ecriture.
    const tableConfig = scalaire(
      "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'config'", []);
    if (tableConfig === 1) {
      expect(scalaire('SELECT goal_amount FROM config WHERE id = 1', [])).not.toBe(objectif);
    } else {
      expect(tableConfig).toBe(0);
    }
    expect((await request(app).get('/api/config')).body.goalAmount).toBe(objectif);
  });

  it('refuse explicitement de deviner quand aucune soiree n est active', async () => {
    const db = getDb();
    db.run("UPDATE events SET status = 'archived' WHERE status = 'active'");

    try {
      const response = await request(app).get('/api/donations');

      // 503 et non 404 : la route existe, c'est la configuration du serveur qui
      // est incomplete. Retomber sur une soiree archivee afficherait ses dons
      // sur l'ecran de la salle.
      expect(response.status).toBe(503);
      expect(response.body.error).toBeDefined();
    } finally {
      db.run("UPDATE events SET status = 'active' WHERE id = ?", [soireeActive]);
    }
  });
});
