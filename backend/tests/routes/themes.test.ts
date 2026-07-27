import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../helpers/app';
import { insertEvent } from '../helpers/events';
import { getDb, saveDatabase } from '../../src/db/init';
import { hashAdminCode } from '../../src/middleware/admin-code';
import { DEFAULT_THEME_PALETTES } from '../../src/models/types';

// Moteur de themes (C1). App reelle avec ORGANIZER_TOKEN pose : hors production
// requireAdmin laisse passer sans jeton, un test « vert » sans jeton ne
// prouverait donc aucun controle d'acces.

const ORGANIZER_TOKEN = 'organisateur-themes';
const CODE_A = 'code-soiree-themes-a';
const CODE_B = 'code-soiree-themes-b';

// Un jeu de tokens valide et lisible, derive du preset premium.
function goodTokens(overrides: Record<string, unknown> = {}) {
  return { base: 'premium', ...DEFAULT_THEME_PALETTES.premium, ...overrides };
}

const createdThemes: number[] = [];
const createdEvents: number[] = [];

describe('routes du moteur de themes', () => {
  let app: express.Express;
  let eventA = 0;
  let eventB = 0;

  beforeAll(async () => {
    app = await createTestApp();
    process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;
    eventA = insertEvent({ slug: 'themes-a', name: 'Themes A', adminCodeHash: hashAdminCode(CODE_A) });
    eventB = insertEvent({ slug: 'themes-b', name: 'Themes B', adminCodeHash: hashAdminCode(CODE_B) });
    createdEvents.push(eventA, eventB);
  });

  afterAll(() => {
    const db = getDb();
    for (const id of createdThemes) {
      db.run('DELETE FROM themes WHERE id = ?', [id]);
    }
    for (const id of createdEvents) {
      db.run('DELETE FROM event_configs WHERE event_id = ?', [id]);
      db.run('DELETE FROM events WHERE id = ?', [id]);
    }
    saveDatabase();
    delete process.env.ORGANIZER_TOKEN;
  });

  async function createTheme(body: Record<string, unknown>) {
    const response = await request(app)
      .post('/api/themes')
      .set('x-admin-token', ORGANIZER_TOKEN)
      .send(body);
    if (response.status === 201) {
      createdThemes.push(response.body.theme.id);
    }
    return response;
  }

  describe('seed des themes integres', () => {
    it('expose les sept presets, marques builtin et non rattaches a une soiree', async () => {
      const response = await request(app)
        .get('/api/themes')
        .set('x-admin-token', ORGANIZER_TOKEN);
      expect(response.status).toBe(200);
      const builtins = response.body.themes.filter((t: { builtin: boolean }) => t.builtin);
      expect(builtins.length).toBeGreaterThanOrEqual(7);
      for (const t of builtins) {
        expect(t.eventId).toBeNull();
        expect(typeof t.tokens.base).toBe('string');
        expect(typeof t.tokens.backgroundColor).toBe('string');
      }
    });
  });

  describe('POST /api/themes', () => {
    it('cree un theme personnalise rattache a une soiree', async () => {
      const response = await createTheme({ eventId: eventA, name: 'Mon theme', tokens: goodTokens() });
      expect(response.status).toBe(201);
      expect(response.body.theme.builtin).toBe(false);
      expect(response.body.theme.eventId).toBe(eventA);
      expect(response.body.theme.name).toBe('Mon theme');
    });

    it('refuse sans jeton organisateur', async () => {
      const response = await request(app)
        .post('/api/themes')
        .send({ eventId: eventA, name: 'X', tokens: goodTokens() });
      expect(response.status).toBe(401);
    });

    it('refuse un schema malforme en 400', async () => {
      const response = await createTheme({ eventId: eventA, name: 'Bad', tokens: goodTokens({ base: 'inexistant' }) });
      expect(response.status).toBe(400);
    });

    it('enregistre un contraste AA insuffisant AVEC avertissements detailles (spec §5.4)', async () => {
      // Decision commanditaire : l'avertissement ne bloque pas l'enregistrement.
      const response = await createTheme({
        eventId: eventA,
        name: 'Illisible',
        tokens: goodTokens({ backgroundColor: '#000000', headerTextColor: '#747474' })
      });
      expect(response.status).toBe(201);
      expect(Array.isArray(response.body.warnings)).toBe(true);
      const pairs = response.body.warnings.map((v: { pair: string }) => v.pair);
      expect(pairs).toContain('headerTextColor');
    });

    it('un contraste au-dessus du seuil ne produit AUCUN avertissement', async () => {
      // #757575 sur #000 = 4,56 : juste au-dessus.
      const response = await createTheme({
        eventId: eventA,
        name: 'Limite haute',
        tokens: goodTokens({
          backgroundColor: '#000000',
          headerTextColor: '#757575',
          statsTextColor: '#FFFFFF',
          plateTextColor: '#FFFFFF',
          chartPrimaryColor: '#FFFFFF'
        })
      });
      expect(response.status).toBe(201);
      expect(response.body.warnings).toEqual([]);
    });
  });

  describe('PUT /api/themes/:id', () => {
    it('modifie un theme personnalise', async () => {
      const created = await createTheme({ eventId: eventA, name: 'A modifier', tokens: goodTokens() });
      const id = created.body.theme.id;
      const response = await request(app)
        .put(`/api/themes/${id}`)
        .set('x-admin-token', ORGANIZER_TOKEN)
        .send({ name: 'Renomme' });
      expect(response.status).toBe(200);
      expect(response.body.theme.name).toBe('Renomme');
    });

    it('refuse de modifier un theme integre en 409', async () => {
      const list = await request(app).get('/api/themes').set('x-admin-token', ORGANIZER_TOKEN);
      const builtin = list.body.themes.find((t: { builtin: boolean }) => t.builtin);
      const response = await request(app)
        .put(`/api/themes/${builtin.id}`)
        .set('x-admin-token', ORGANIZER_TOKEN)
        .send({ name: 'Interdit' });
      expect(response.status).toBe(409);
    });

    it('enregistre une edition sous seuil AVEC avertissements (spec §5.4)', async () => {
      const created = await createTheme({ eventId: eventA, name: 'Edit contraste', tokens: goodTokens() });
      const id = created.body.theme.id;
      const response = await request(app)
        .put(`/api/themes/${id}`)
        .set('x-admin-token', ORGANIZER_TOKEN)
        .send({ tokens: goodTokens({ backgroundColor: '#000000', headerTextColor: '#747474' }) });
      expect(response.status).toBe(200);
      const pairs = response.body.warnings.map((v: { pair: string }) => v.pair);
      expect(pairs).toContain('headerTextColor');
    });
  });

  describe('DELETE /api/themes/:id', () => {
    it('supprime un theme personnalise', async () => {
      const created = await createTheme({ eventId: eventA, name: 'A supprimer', tokens: goodTokens() });
      const id = created.body.theme.id;
      const response = await request(app).delete(`/api/themes/${id}`).set('x-admin-token', ORGANIZER_TOKEN);
      expect(response.status).toBe(204);
    });

    it('refuse de supprimer un theme integre en 409', async () => {
      const list = await request(app).get('/api/themes').set('x-admin-token', ORGANIZER_TOKEN);
      const builtin = list.body.themes.find((t: { builtin: boolean }) => t.builtin);
      const response = await request(app).delete(`/api/themes/${builtin.id}`).set('x-admin-token', ORGANIZER_TOKEN);
      expect(response.status).toBe(409);
    });
  });

  describe('application par soiree', () => {
    it('applique un theme integre a une soiree par son admin, lisible ensuite en public', async () => {
      const list = await request(app).get('/api/themes').set('x-admin-token', ORGANIZER_TOKEN);
      const builtin = list.body.themes.find((t: { builtin: boolean }) => t.builtin);

      const applied = await request(app)
        .put(`/api/events/${eventA}/theme`)
        .set('x-admin-token', CODE_A)
        .send({ themeId: builtin.id });
      expect(applied.status).toBe(200);
      expect(applied.body.theme.id).toBe(builtin.id);

      // Lecture publique, sans jeton.
      const publicRead = await request(app).get(`/api/events/${eventA}/theme`);
      expect(publicRead.status).toBe(200);
      expect(publicRead.body.theme.id).toBe(builtin.id);
    });

    it('refuse un code de soiree sur une AUTRE soiree en 403', async () => {
      const list = await request(app).get('/api/themes').set('x-admin-token', ORGANIZER_TOKEN);
      const builtin = list.body.themes.find((t: { builtin: boolean }) => t.builtin);
      const response = await request(app)
        .put(`/api/events/${eventB}/theme`)
        .set('x-admin-token', CODE_A)
        .send({ themeId: builtin.id });
      expect(response.status).toBe(403);
    });

    it('refuse d appliquer un theme personnalise d une AUTRE soiree en 403', async () => {
      const themeOfA = await createTheme({ eventId: eventA, name: 'Prive A', tokens: goodTokens() });
      const response = await request(app)
        .put(`/api/events/${eventB}/theme`)
        .set('x-admin-token', ORGANIZER_TOKEN)
        .send({ themeId: themeOfA.body.theme.id });
      expect(response.status).toBe(403);
    });

    it('renvoie 404 sur une soiree inconnue', async () => {
      const response = await request(app).get('/api/events/999999/theme');
      expect(response.status).toBe(404);
    });

    it('renvoie null quand la soiree n a rien applique', async () => {
      const response = await request(app).get(`/api/events/${eventB}/theme`);
      expect(response.status).toBe(200);
      expect(response.body.theme).toBeNull();
    });
  });
});
