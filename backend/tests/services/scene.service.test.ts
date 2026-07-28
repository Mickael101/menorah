import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp } from '../helpers/app';
import { insertEvent } from '../helpers/events';
import { getDb, saveDatabase } from '../../src/db/init';
import { sceneService } from '../../src/services/scene.service';

// La table scenes est globale (bibliotheque de l'organisateur) : pas de
// rattachement a une soiree, contrairement a media.

const createdEvents: number[] = [];

describe('sceneService', () => {
  beforeAll(async () => {
    await createTestApp();
  });

  afterAll(() => {
    const db = getDb();
    db.run("DELETE FROM scenes WHERE filename LIKE 'test-scene-%'");
    for (const id of createdEvents) {
      db.run('DELETE FROM event_configs WHERE event_id = ?', [id]);
      db.run('DELETE FROM events WHERE id = ?', [id]);
    }
    saveDatabase();
  });

  it('cree puis liste une scene avec son url derivee', () => {
    const scene = sceneService.create('Batiment', 'test-scene-a.riv');
    expect(scene.id).toBeGreaterThan(0);
    expect(scene.name).toBe('Batiment');
    expect(scene.url).toBe('/uploads/scenes/test-scene-a.riv');
    const listed = sceneService.list().find((s) => s.id === scene.id);
    expect(listed?.filename).toBe('test-scene-a.riv');
  });

  it('get renvoie null pour un id inconnu', () => {
    expect(sceneService.get(999999)).toBeNull();
  });

  it('remove supprime et signale not_found sur un id inconnu', () => {
    const scene = sceneService.create('Ephemere', 'test-scene-b.riv');
    expect(sceneService.remove(scene.id)).toBe('removed');
    expect(sceneService.get(scene.id)).toBeNull();
    expect(sceneService.remove(scene.id)).toBe('not_found');
  });

  it('eventsReferencing trouve la soiree dont displaySettings pointe la scene — et elle seule', () => {
    const scene = sceneService.create('Reference', 'test-scene-c.riv');
    const other = sceneService.create('Autre', 'test-scene-d.riv');
    const eventA = insertEvent({ slug: 'scene-svc-a', name: 'Scene Svc A' });
    const eventB = insertEvent({ slug: 'scene-svc-b', name: 'Scene Svc B' });
    createdEvents.push(eventA, eventB);

    const db = getDb();
    db.run('INSERT OR IGNORE INTO event_configs (event_id) VALUES (?)', [eventA]);
    db.run('UPDATE event_configs SET display_settings = ? WHERE event_id = ?', [
      JSON.stringify({ visualMode: 'scene', sceneId: scene.id, sceneUrl: scene.url }),
      eventA
    ]);
    db.run('INSERT OR IGNORE INTO event_configs (event_id) VALUES (?)', [eventB]);
    db.run('UPDATE event_configs SET display_settings = ? WHERE event_id = ?', [
      JSON.stringify({ visualMode: 'scene', sceneId: other.id, sceneUrl: other.url }),
      eventB
    ]);
    saveDatabase();

    expect(sceneService.eventsReferencing(scene.id)).toEqual([eventA]);
  });
});
