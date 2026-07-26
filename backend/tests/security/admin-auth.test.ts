import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../helpers/app';

describe('requireAdmin sans secret configure', () => {
  let app: express.Express;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.ADMIN_TOKEN;
  });

  it('refuse en production quand ADMIN_TOKEN est absent', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_TOKEN;

    const response = await request(app).get('/api/donations/export.csv');

    expect(response.status).toBe(503);
    expect(response.body.error).toContain('not configured');
  });

  it('refuse en production quand ADMIN_TOKEN est vide', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_TOKEN = '   ';

    const response = await request(app).get('/api/donations/export.csv');

    expect(response.status).toBe(503);
  });

  it('laisse passer en developpement local pour ne pas gener le dev', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ADMIN_TOKEN;

    const response = await request(app).get('/api/donations/export.csv');

    expect(response.status).toBe(200);
  });

  it('refuse un mauvais token meme en developpement', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ADMIN_TOKEN = 'le-bon-token';

    const response = await request(app)
      .get('/api/donations/export.csv')
      .set('x-admin-token', 'le-mauvais-token');

    expect(response.status).toBe(401);
  });
});
