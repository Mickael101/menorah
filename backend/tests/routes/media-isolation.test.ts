import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import path from 'path';
import fs from 'fs';
import { createTestApp } from '../helpers/app';
import { insertEvent } from '../helpers/events';
import { getDb, saveDatabase } from '../../src/db/init';
import { uploadsRoot } from '../../src/config/storage';

// B4 : les GIF sont cloisonnes par soiree via la table `media`. Un GIF televerse
// sur A ne doit jamais apparaitre sur B, ni etre supprimable depuis B.

const ORGANIZER_TOKEN = 'organisateur-media';
const GIF_BYTES = Buffer.from('GIF89a', 'binary');

let soireeA = 0;
let soireeB = 0;
const uploaded: string[] = [];

describe('cloisonnement des medias par soiree', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await createTestApp();
    process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;
    soireeA = insertEvent({ slug: 'media-a', name: 'Media A' });
    soireeB = insertEvent({ slug: 'media-b', name: 'Media B' });
  });

  afterAll(() => {
    const db = getDb();
    for (const id of [soireeA, soireeB]) {
      db.run('DELETE FROM media WHERE event_id = ?', [id]);
      db.run('DELETE FROM events WHERE id = ?', [id]);
    }
    saveDatabase();
    for (const filename of uploaded) {
      const p = path.join(uploadsRoot, 'gifs', filename);
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    }
    delete process.env.ORGANIZER_TOKEN;
  });

  async function uploadGif(eventId: number) {
    const response = await request(app)
      .post(`/api/events/${eventId}/gifs/upload`)
      .set('x-admin-token', ORGANIZER_TOKEN)
      .attach('gif', GIF_BYTES, { filename: 'celebration.gif', contentType: 'image/gif' });
    if (response.status === 200 && response.body.filename) {
      uploaded.push(response.body.filename);
    }
    return response;
  }

  it('un GIF de A n apparait que sur A, jamais sur B', async () => {
    const up = await uploadGif(soireeA);
    expect(up.status).toBe(200);
    const filename = up.body.filename;

    const surA = await request(app).get(`/api/events/${soireeA}/gifs`);
    const surB = await request(app).get(`/api/events/${soireeB}/gifs`);

    expect(surA.body.map((g: { filename: string }) => g.filename)).toContain(filename);
    expect(surB.body.map((g: { filename: string }) => g.filename)).not.toContain(filename);
  });

  it('refuse de supprimer depuis B un GIF appartenant a A', async () => {
    const up = await uploadGif(soireeA);
    const filename = up.body.filename;

    const suppressionDepuisB = await request(app)
      .delete(`/api/events/${soireeB}/gifs/${filename}`)
      .set('x-admin-token', ORGANIZER_TOKEN);
    expect(suppressionDepuisB.status).toBe(404);

    // Le GIF est intact sur A.
    const surA = await request(app).get(`/api/events/${soireeA}/gifs`);
    expect(surA.body.map((g: { filename: string }) => g.filename)).toContain(filename);
  });

  it('exige l admin de soiree pour televerser', async () => {
    const response = await request(app)
      .post(`/api/events/${soireeA}/gifs/upload`)
      .attach('gif', GIF_BYTES, { filename: 'sans-jeton.gif', contentType: 'image/gif' });
    expect(response.status).toBe(401);
  });

  it('GET /api/events/:id/gifs est public et scope a la soiree', async () => {
    const response = await request(app).get(`/api/events/${soireeB}/gifs`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});
