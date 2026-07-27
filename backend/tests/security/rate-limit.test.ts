import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { rateLimit } from '../../src/middleware/rate-limit';

// La cle du limiteur est l'IP SEULE : le plafond est GLOBAL, toutes soirees
// confondues.
//
// L'essai precedent (cle IP + soiree, pour ne pas penaliser deux soirees
// derriere un meme reseau) multipliait en fait le plafond par le nombre de
// soirees atteignables — brouillons et archives compris, joignables
// publiquement via POST /api/events/:id/donations. Le quota devenait
// contournable a volonte : il suffisait de changer d'identifiant de soiree dans
// l'URL. Ce fichier encodait ce comportement et affirmait qu'un quota epuise sur
// la soiree 1 laissait la soiree 2 intacte ; il prouvait donc le trou.
function appWithLimiter() {
  const app = express();
  const limiter = rateLimit(2, 60_000);
  app.post('/e/:eventId/don', (req, _res, next) => {
    req.eventId = Number(req.params.eventId);
    next();
  }, limiter, (_req, res) => res.json({ ok: true }));
  return app;
}

describe('rate-limit : plafond GLOBAL par IP', () => {
  it('ne se laisse pas contourner en changeant de soiree', async () => {
    const app = appWithLimiter();

    // Deux requetes sur la soiree 1 : le quota de l'IP est atteint.
    expect((await request(app).post('/e/1/don')).status).toBe(200);
    expect((await request(app).post('/e/1/don')).status).toBe(200);
    expect((await request(app).post('/e/1/don')).status).toBe(429);

    // Changer de soiree ne rend PAS un quota neuf : c'est l'IP qui est limitee.
    expect((await request(app).post('/e/2/don')).status).toBe(429);
    expect((await request(app).post('/e/99999/don')).status).toBe(429);
  });

  it('limite chaque IP separement', async () => {
    const app = appWithLimiter();

    // L'IP A epuise son quota...
    expect((await request(app).post('/e/1/don').set('x-forwarded-for', '10.0.0.1')).status).toBe(200);
    expect((await request(app).post('/e/1/don').set('x-forwarded-for', '10.0.0.1')).status).toBe(200);
    expect((await request(app).post('/e/1/don').set('x-forwarded-for', '10.0.0.1')).status).toBe(429);

    // ...sans consommer celui de l'IP B, sur la meme soiree.
    expect((await request(app).post('/e/1/don').set('x-forwarded-for', '10.0.0.2')).status).toBe(200);
    expect((await request(app).post('/e/1/don').set('x-forwarded-for', '10.0.0.2')).status).toBe(200);
    expect((await request(app).post('/e/1/don').set('x-forwarded-for', '10.0.0.2')).status).toBe(429);
  });

  it('n exige plus de soiree resolue pour compter', async () => {
    // Le limiteur est monte sur un chemin sans resolution de soiree : la cle ne
    // depend plus de req.eventId, donc un montage sans resolveEvent en amont
    // reste correctement plafonne (avant, tout ce trafic partageait la cle
    // « :none » et se comptait ensemble par accident).
    const app = express();
    app.post('/don', rateLimit(1, 60_000), (_req, res) => res.json({ ok: true }));

    expect((await request(app).post('/don')).status).toBe(200);
    expect((await request(app).post('/don')).status).toBe(429);
  });
});
