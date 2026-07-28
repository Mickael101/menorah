import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../helpers/app';
import { insertEvent } from '../helpers/events';
import { getDb, saveDatabase } from '../../src/db/init';
import { sceneService } from '../../src/services/scene.service';

const ORGANIZER_TOKEN = 'organisateur-scene-binding';

describe('liaison displaySettings <-> scene', () => {
  let app: express.Express;
  let eventId = 0;
  let sceneId = 0;

  beforeAll(async () => {
    app = await createTestApp();
    process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;
    eventId = insertEvent({ slug: 'scene-binding', name: 'Scene Binding' });
    sceneId = sceneService.create('Batiment binding', 'test-binding.riv').id;
  });

  afterAll(() => {
    const db = getDb();
    db.run('DELETE FROM scenes WHERE id = ?', [sceneId]);
    db.run('DELETE FROM event_configs WHERE event_id = ?', [eventId]);
    db.run('DELETE FROM events WHERE id = ?', [eventId]);
    saveDatabase();
    delete process.env.ORGANIZER_TOKEN;
  });

  function putSettings(displaySettings: Record<string, unknown>) {
    return request(app)
      .put(`/api/events/${eventId}/config`)
      .set('x-admin-token', ORGANIZER_TOKEN)
      .send({ displaySettings });
  }

  it('active une scene existante et reecrit sceneUrl cote serveur', async () => {
    const response = await putSettings({
      visualMode: 'scene',
      sceneId,
      sceneUrl: '/uploads/scenes/forge-par-le-client.riv'
    });
    expect(response.status).toBe(200);
    expect(response.body.displaySettings.visualMode).toBe('scene');
    expect(response.body.displaySettings.sceneId).toBe(sceneId);
    expect(response.body.displaySettings.sceneUrl).toBe('/uploads/scenes/test-binding.riv');
  });

  it('persiste la liaison : GET config relit sceneUrl', async () => {
    const response = await request(app).get(`/api/events/${eventId}/config`);
    expect(response.status).toBe(200);
    expect(response.body.displaySettings.sceneUrl).toBe('/uploads/scenes/test-binding.riv');
  });

  it('refuse en 400 un sceneId inconnu quand visualMode=scene', async () => {
    const response = await putSettings({ visualMode: 'scene', sceneId: 999999 });
    expect(response.status).toBe(400);
  });

  it('refuse en 400 visualMode=scene sans sceneId', async () => {
    const response = await putSettings({ visualMode: 'scene' });
    expect(response.status).toBe(400);
  });

  it('hors mode scene, sceneUrl reste coherent sans bloquer la sauvegarde', async () => {
    const response = await putSettings({ visualMode: 'none', sceneId: null });
    expect(response.status).toBe(200);
    expect(response.body.displaySettings.sceneUrl).toBeNull();
  });
});
