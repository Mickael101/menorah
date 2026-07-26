import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from './helpers/app';

describe('harnais de test', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('repond sur /api/health', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it("n'ecrit pas dans la base de production", () => {
    expect(process.env.DATA_DIR).toBeTruthy();
    expect(process.env.DATA_DIR).toContain('.tmp-test-data');
  });
});
