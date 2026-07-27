import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

// C8 : l'origine CORS devient configurable par CORS_ORIGIN, avec pour defaut le
// comportement actuel (origin: '*'). createApp lit la variable a la
// construction ; on cree donc une app par cas. /api/health n'a besoin d'aucune
// base, ce qui isole le test de la couche donnees.

describe('CORS configurable (C8)', () => {
  afterEach(() => {
    delete process.env.CORS_ORIGIN;
  });

  it('par defaut, autorise toutes les origines (pas de regression d ecran)', async () => {
    delete process.env.CORS_ORIGIN;
    const app = createApp();

    const response = await request(app).get('/api/health').set('Origin', 'https://n-importe-ou.example');

    expect(response.headers['access-control-allow-origin']).toBe('*');
  });

  it('un `*` explicite vaut allow-all, comme le defaut', async () => {
    // La normalisation compte : dans un TABLEAU, le litteral '*' ne matche
    // jamais un vrai en-tete Origin, et `cors` n'emet alors aucun
    // Access-Control-Allow-Origin — tous les ecrans cross-origin tombent. Le
    // `*` seul doit donc redevenir la chaine allow-all.
    process.env.CORS_ORIGIN = '*';
    const app = createApp();

    const response = await request(app).get('/api/health').set('Origin', 'https://n-importe-ou.example');

    expect(response.headers['access-control-allow-origin']).toBe('*');
  });

  it('un `*` NOYE dans une liste ne rend pas l app allow-all', async () => {
    // Le pendant du test precedent, et la raison d'etre du `list.length === 1` :
    // une liste qui contient `*` reste une liste blanche. Sans cette garde, une
    // variable mal recopiee ouvrirait l API a toutes les origines en silence.
    process.env.CORS_ORIGIN = '*, https://a.example';
    const app = createApp();

    const intrus = await request(app).get('/api/health').set('Origin', 'https://intrus.example');
    expect(intrus.headers['access-control-allow-origin']).not.toBe('*');
    expect(intrus.headers['access-control-allow-origin']).toBeUndefined();

    // L'origine reellement listee, elle, passe.
    const autorisee = await request(app).get('/api/health').set('Origin', 'https://a.example');
    expect(autorisee.headers['access-control-allow-origin']).toBe('https://a.example');
  });

  it('quand CORS_ORIGIN est pose, ne reflete que les origines autorisees', async () => {
    process.env.CORS_ORIGIN = 'https://a.example, https://b.example';
    const app = createApp();

    const autorisee = await request(app).get('/api/health').set('Origin', 'https://a.example');
    expect(autorisee.headers['access-control-allow-origin']).toBe('https://a.example');

    const refusee = await request(app).get('/api/health').set('Origin', 'https://intrus.example');
    expect(refusee.headers['access-control-allow-origin']).toBeUndefined();
  });
});
