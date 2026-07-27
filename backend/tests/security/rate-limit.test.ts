import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { rateLimit } from '../../src/middleware/rate-limit';

// B6 : la cle du limiteur est IP + soiree. Deux soirees derriere la meme IP
// (une salle, un seul reseau) ne doivent pas se partager le quota.
function appWithLimiter() {
  const app = express();
  const limiter = rateLimit(2, 60_000);
  app.post('/e/:eventId/don', (req, _res, next) => {
    req.eventId = Number(req.params.eventId);
    next();
  }, limiter, (_req, res) => res.json({ ok: true }));
  return app;
}

describe('rate-limit keye par IP + soiree', () => {
  it('ne fait pas deborder une soiree a cause du quota d une autre', async () => {
    const app = appWithLimiter();

    // Deux requetes sur la soiree 1 : atteignent le quota.
    expect((await request(app).post('/e/1/don')).status).toBe(200);
    expect((await request(app).post('/e/1/don')).status).toBe(200);
    // La troisieme sur la soiree 1 est refusee.
    expect((await request(app).post('/e/1/don')).status).toBe(429);

    // Mais la soiree 2, depuis la meme IP, a son propre quota intact.
    expect((await request(app).post('/e/2/don')).status).toBe(200);
    expect((await request(app).post('/e/2/don')).status).toBe(200);
    expect((await request(app).post('/e/2/don')).status).toBe(429);
  });
});
