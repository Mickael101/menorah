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
});
