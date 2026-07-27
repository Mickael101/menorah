import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import path from 'path';
import fs from 'fs';
import { createTestApp } from '../helpers/app';
import { insertEvent } from '../helpers/events';
import { getDb, saveDatabase } from '../../src/db/init';
import { uploadsRoot } from '../../src/config/storage';
import { hashAdminCode } from '../../src/middleware/admin-code';

// B4 : les GIF sont cloisonnes par soiree via la table `media`. Un GIF televerse
// sur A ne doit jamais apparaitre sur B, ni etre supprimable depuis B.

const ORGANIZER_TOKEN = 'organisateur-media';
const CODE_A = 'code-media-a';
const GIF_BYTES = Buffer.from('GIF89a', 'binary');
const AUDIO_BYTES = Buffer.from('ID3\x03\x00\x00\x00', 'binary');

let soireeA = 0;
let soireeB = 0;
const uploaded: string[] = [];
const uploadedAudio: string[] = [];

describe('cloisonnement des medias par soiree', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await createTestApp();
    process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;
    // Un code propre a A : les gardes d'appartenance doivent tenir face a
    // l'admin LEGITIME de A, pas seulement face a un inconnu. C'est lui, et lui
    // seul, qui peut tenter d'attirer un media de B.
    soireeA = insertEvent({ slug: 'media-a', name: 'Media A', adminCodeHash: hashAdminCode(CODE_A) });
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
    for (const filename of uploadedAudio) {
      const p = path.join(uploadsRoot, 'audio', filename);
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

  async function uploadAudio(eventId: number) {
    const response = await request(app)
      .post(`/api/events/${eventId}/gifs/upload-audio`)
      .set('x-admin-token', ORGANIZER_TOKEN)
      .attach('audio', AUDIO_BYTES, { filename: 'shofar.mp3', contentType: 'audio/mpeg' });
    if (response.status === 200 && response.body.filename) {
      uploadedAudio.push(response.body.filename);
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

  // Le cloisonnement a DEUX axes : le GIF et le SON. La garde sur le GIF etait
  // testee, celle sur le son ne l'etait pas — l'admin de A pouvait donc, sans
  // que rien ne rougisse, accrocher a son GIF un enregistrement televerse sur B
  // et le faire jouer dans sa salle. Le nom du fichier suffit : il transite en
  // clair dans audioUrl.
  describe('association GIF/son : le son doit appartenir a la soiree', () => {
    it('refuse en 404 un son de B accroche a un GIF de A', async () => {
      const audioB = await uploadAudio(soireeB);
      expect(audioB.status).toBe(200);
      const gifA = await uploadGif(soireeA);
      expect(gifA.status).toBe(200);

      const vol = await request(app)
        .post(`/api/events/${soireeA}/gifs/associate-audio`)
        .set('x-admin-token', CODE_A)
        .send({ gifFilename: gifA.body.filename, audioUrl: `/uploads/audio/${audioB.body.filename}` });

      expect(vol.status).toBe(404);

      // Et rien n'a ete ecrit : le GIF de A reste sans son.
      const surA = await request(app).get(`/api/events/${soireeA}/gifs`);
      const entree = surA.body.find((g: { filename: string }) => g.filename === gifA.body.filename);
      expect(entree.audioUrl).toBeNull();
    });

    it('accepte le son de SA propre soiree', async () => {
      // Le miroir : sans lui, un 404 systematique passerait pour une garde.
      const audioA = await uploadAudio(soireeA);
      expect(audioA.status).toBe(200);
      const gifA = await uploadGif(soireeA);

      const association = await request(app)
        .post(`/api/events/${soireeA}/gifs/associate-audio`)
        .set('x-admin-token', CODE_A)
        .send({ gifFilename: gifA.body.filename, audioUrl: `/uploads/audio/${audioA.body.filename}` });

      expect(association.status).toBe(200);
      expect(association.body.audioUrl).toBe(`/uploads/audio/${audioA.body.filename}`);
    });

    it('accepte audioUrl null : c est la DISSOCIATION, pas une intrusion', async () => {
      // La garde ne doit pas mordre sur le cas ou l'admin retire simplement le
      // son de son GIF — sinon la fonctionnalite disparait avec la faille.
      const audioA = await uploadAudio(soireeA);
      const gifA = await uploadGif(soireeA);
      await request(app)
        .post(`/api/events/${soireeA}/gifs/associate-audio`)
        .set('x-admin-token', CODE_A)
        .send({ gifFilename: gifA.body.filename, audioUrl: `/uploads/audio/${audioA.body.filename}` });

      const dissociation = await request(app)
        .post(`/api/events/${soireeA}/gifs/associate-audio`)
        .set('x-admin-token', CODE_A)
        .send({ gifFilename: gifA.body.filename, audioUrl: null });

      expect(dissociation.status).toBe(200);
      expect(dissociation.body.audioUrl).toBeNull();
    });
  });
});
