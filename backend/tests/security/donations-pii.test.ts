import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../helpers/app';

const ADMIN_TOKEN = 'test-admin-token';

describe('protection des donnees donateurs', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterEach(() => {
    delete process.env.ADMIN_TOKEN;
  });

  describe('GET /api/donations/export.csv', () => {
    it('refuse sans token admin', async () => {
      process.env.ADMIN_TOKEN = ADMIN_TOKEN;

      const response = await request(app).get('/api/donations/export.csv');

      expect(response.status).toBe(401);
    });

    it('accepte avec le token en en-tete', async () => {
      process.env.ADMIN_TOKEN = ADMIN_TOKEN;

      const response = await request(app)
        .get('/api/donations/export.csv')
        .set('x-admin-token', ADMIN_TOKEN);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('accepte avec le token en query (telechargement par lien)', async () => {
      process.env.ADMIN_TOKEN = ADMIN_TOKEN;

      const response = await request(app)
        .get(`/api/donations/export.csv?token=${ADMIN_TOKEN}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/donations', () => {
    it('reste ouvert : l ecran public en depend', async () => {
      const response = await request(app).get('/api/donations');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.donations)).toBe(true);
      expect(response.body.stats).toBeDefined();
    });

    it('n expose ni email, ni telephone, ni reference', async () => {
      await request(app)
        .post('/api/donations')
        .send({
          firstName: 'Test',
          lastName: 'Projection',
          amount: 500000,
          email: 'fuite@example.com',
          phone: '0500000000',
          reference: 'REF-SECRETE'
        });

      const response = await request(app).get('/api/donations');

      expect(response.status).toBe(200);
      expect(response.body.donations.length).toBeGreaterThan(0);

      for (const donation of response.body.donations) {
        expect(donation).not.toHaveProperty('email');
        expect(donation).not.toHaveProperty('phone');
        expect(donation).not.toHaveProperty('reference');
      }

      // Le corps entier ne doit contenir aucune trace des valeurs sensibles
      const raw = JSON.stringify(response.body);
      expect(raw).not.toContain('fuite@example.com');
      expect(raw).not.toContain('0500000000');
      expect(raw).not.toContain('REF-SECRETE');
    });

    it('conserve ce dont l ecran public a besoin', async () => {
      const response = await request(app).get('/api/donations');
      const donation = response.body.donations[0];

      expect(donation).toHaveProperty('id');
      expect(donation).toHaveProperty('firstName');
      expect(donation).toHaveProperty('lastName');
      expect(donation).toHaveProperty('amount');
      expect(donation).toHaveProperty('createdAt');
    });

    it('refuse ?full=1 sans token admin', async () => {
      process.env.ADMIN_TOKEN = ADMIN_TOKEN;

      const response = await request(app).get('/api/donations?full=1');

      expect(response.status).toBe(401);
    });

    it('renvoie le payload complet avec ?full=1 et token', async () => {
      process.env.ADMIN_TOKEN = ADMIN_TOKEN;

      const response = await request(app)
        .get('/api/donations?full=1')
        .set('x-admin-token', ADMIN_TOKEN);

      expect(response.status).toBe(200);
      const donation = response.body.donations[0];
      expect(donation).toHaveProperty('email');
      expect(donation).toHaveProperty('phone');
      expect(donation).toHaveProperty('reference');
    });
  });

  describe('GET /api/donations/:id', () => {
    it('refuse sans token admin', async () => {
      process.env.ADMIN_TOKEN = ADMIN_TOKEN;

      const response = await request(app).get('/api/donations/1');

      expect(response.status).toBe(401);
    });

    it('accepte avec le token admin', async () => {
      process.env.ADMIN_TOKEN = ADMIN_TOKEN;

      const response = await request(app)
        .get('/api/donations/1')
        .set('x-admin-token', ADMIN_TOKEN);

      expect([200, 404]).toContain(response.status);
    });
  });
});
