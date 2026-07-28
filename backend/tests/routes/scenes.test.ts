import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import fs from 'fs';
import path from 'path';
import { createTestApp } from '../helpers/app';
import { insertEvent } from '../helpers/events';
import { getDb, saveDatabase } from '../../src/db/init';
import { hashAdminCode } from '../../src/middleware/admin-code';
import { uploadsRoot } from '../../src/config/storage';

const ORGANIZER_TOKEN = 'organisateur-scenes';
const CODE_A = 'code-soiree-scenes-a';

// Un contenu .riv minimal pour les tests : seuls les magic bytes comptent
// pour la validation d'upload (le decodage complet est le travail du runtime).
const RIVE_BYTES = Buffer.concat([Buffer.from('RIVE', 'ascii'), Buffer.alloc(64)]);
const NOT_RIVE_BYTES = Buffer.concat([Buffer.from('PK', 'latin1'), Buffer.alloc(64)]);

const uploadedFilenames: string[] = [];
const createdEvents: number[] = [];

function scenesDir(): string {
  return path.join(uploadsRoot, 'scenes');
}

describe('routes /api/scenes', () => {
  let app: express.Express;
  let eventA = 0;

  beforeAll(async () => {
    app = await createTestApp();
    process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;
    eventA = insertEvent({ slug: 'scenes-a', name: 'Scenes A', adminCodeHash: hashAdminCode(CODE_A) });
    createdEvents.push(eventA);
  });

  afterAll(() => {
    const db = getDb();
    for (const filename of uploadedFilenames) {
      const filePath = path.join(scenesDir(), filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      db.run('DELETE FROM scenes WHERE filename = ?', [filename]);
    }
    for (const id of createdEvents) {
      db.run('DELETE FROM event_configs WHERE event_id = ?', [id]);
      db.run('DELETE FROM events WHERE id = ?', [id]);
    }
    saveDatabase();
    delete process.env.ORGANIZER_TOKEN;
  });

  async function uploadScene(name: string, body: Buffer, filename = 'batiment.riv') {
    const response = await request(app)
      .post('/api/scenes')
      .set('x-admin-token', ORGANIZER_TOKEN)
      .field('name', name)
      .attach('scene', body, filename);
    if (response.status === 201) {
      uploadedFilenames.push(response.body.scene.filename);
    }
    return response;
  }

  it('refuse l upload sans jeton organisateur (y compris avec un code de soiree)', async () => {
    const anonymous = await request(app).post('/api/scenes').attach('scene', RIVE_BYTES, 'x.riv');
    expect(anonymous.status).toBe(401);
    const eventAdmin = await request(app)
      .post('/api/scenes')
      .set('x-admin-token', CODE_A)
      .attach('scene', RIVE_BYTES, 'x.riv');
    expect(eventAdmin.status).toBe(401);
  });

  it('accepte un .riv valide et le sert sous /uploads/scenes/', async () => {
    const response = await uploadScene('Batiment reel', RIVE_BYTES);
    expect(response.status).toBe(201);
    expect(response.body.scene.name).toBe('Batiment reel');
    expect(response.body.scene.url).toMatch(/^\/uploads\/scenes\/scene-.+\.riv$/);
    expect(fs.existsSync(path.join(scenesDir(), response.body.scene.filename))).toBe(true);
  });

  it('refuse en 400 un fichier sans magic bytes RIVE et ne laisse rien sur disque', async () => {
    const before = fs.readdirSync(scenesDir()).length;
    const response = await uploadScene('Faux', NOT_RIVE_BYTES);
    expect(response.status).toBe(400);
    expect(fs.readdirSync(scenesDir()).length).toBe(before);
  });

  it('refuse en 400 (pas 500) une extension autre que .riv — contrat spec §6', async () => {
    const before = fs.readdirSync(scenesDir()).length;
    const response = await uploadScene('Mauvaise extension', RIVE_BYTES, 'batiment.svg');
    expect(response.status).toBe(400);
    expect(fs.readdirSync(scenesDir()).length).toBe(before);
  });

  it('refuse en 400 (pas 500) un fichier au-dela de 10 Mo — contrat spec §6', async () => {
    const before = fs.readdirSync(scenesDir()).length;
    const oversized = Buffer.concat([Buffer.from('RIVE', 'ascii'), Buffer.alloc(10 * 1024 * 1024)]);
    const response = await uploadScene('Trop gros', oversized);
    expect(response.status).toBe(400);
    expect(fs.readdirSync(scenesDir()).length).toBe(before);
  });

  it('liste les scenes pour l admin de la soiree via ?eventId=', async () => {
    const response = await request(app)
      .get(`/api/scenes?eventId=${eventA}`)
      .set('x-admin-token', CODE_A);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.scenes)).toBe(true);
  });

  it('refuse la liste sans jeton', async () => {
    const response = await request(app).get('/api/scenes');
    expect(response.status).toBe(401);
  });

  it('DELETE guerit la soiree referente : visualMode none, sceneId et sceneUrl null, fichier supprime', async () => {
    const uploaded = await uploadScene('A supprimer', RIVE_BYTES);
    expect(uploaded.status).toBe(201);
    const sceneId = uploaded.body.scene.id;
    const filename = uploaded.body.scene.filename;

    const activation = await request(app)
      .put(`/api/events/${eventA}/config`)
      .set('x-admin-token', ORGANIZER_TOKEN)
      .send({ displaySettings: { visualMode: 'scene', sceneId } });
    expect(activation.status).toBe(200);

    const deletion = await request(app)
      .delete(`/api/scenes/${sceneId}`)
      .set('x-admin-token', ORGANIZER_TOKEN);
    expect(deletion.status).toBe(204);
    expect(fs.existsSync(path.join(scenesDir(), filename))).toBe(false);

    const config = await request(app).get(`/api/events/${eventA}/config`);
    expect(config.body.displaySettings.visualMode).toBe('none');
    expect(config.body.displaySettings.sceneId).toBeNull();
    expect(config.body.displaySettings.sceneUrl).toBeNull();
  });

  it('DELETE d un id inconnu renvoie 404', async () => {
    const response = await request(app)
      .delete('/api/scenes/999999')
      .set('x-admin-token', ORGANIZER_TOKEN);
    expect(response.status).toBe(404);
  });
});
