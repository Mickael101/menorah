import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../helpers/app';
import { getDb, saveDatabase } from '../../src/db/init';

// Routes de gestion des soirees du contrat. On passe par l'app reelle avec un
// ORGANIZER_TOKEN pose : hors production le middleware laisserait passer sans
// jeton, et un test de creation « vert » ne prouverait pas l'acces organisateur.

const ORGANIZER_TOKEN = 'organisateur-e2';

// Les soirees creees ici sont PERSISTEES (la route ecrit sur disque). On les
// cree en `draft` pour ne pas deplacer la soiree active vue par les autres
// fichiers, et on les efface en fin de suite.
const created: number[] = [];

describe('routes de gestion des soirees', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await createTestApp();
    process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;
  });

  afterAll(() => {
    const db = getDb();
    for (const id of created) {
      db.run('DELETE FROM event_configs WHERE event_id = ?', [id]);
      db.run('DELETE FROM events WHERE id = ?', [id]);
    }
    saveDatabase();
    delete process.env.ORGANIZER_TOKEN;
  });

  async function createEvent(body: Record<string, unknown>) {
    const response = await request(app)
      .post('/api/events')
      .set('x-admin-token', ORGANIZER_TOKEN)
      .send(body);
    if (response.status === 201) {
      created.push(response.body.event.id);
    }
    return response;
  }

  describe('POST /api/events', () => {
    it('cree une soiree et renvoie le code admin en clair une seule fois', async () => {
      const response = await createEvent({ slug: 'e2-creation', name: 'E2 Creation' });

      expect(response.status).toBe(201);
      expect(typeof response.body.adminCode).toBe('string');
      expect(response.body.adminCode.length).toBeGreaterThan(0);

      // EventSummary complet, jamais l'empreinte du code.
      const event = response.body.event;
      expect(event.slug).toBe('e2-creation');
      expect(event.status).toBe('draft');
      expect(event).toHaveProperty('createdAt');
      expect(event).toHaveProperty('donationCount', 0);
      expect(event).toHaveProperty('totalAmount', 0);
      expect(JSON.stringify(event)).not.toContain('admin_code_hash');
      expect(JSON.stringify(event)).not.toContain('adminCodeHash');
      expect(JSON.stringify(event)).not.toContain('scrypt$');
    });

    it('refuse sans jeton organisateur', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({ slug: 'e2-refuse', name: 'Refuse' });

      expect(response.status).toBe(401);
    });

    it('refuse un slug deja pris en 409', async () => {
      await createEvent({ slug: 'e2-doublon', name: 'Premiere' });
      const response = await createEvent({ slug: 'e2-doublon', name: 'Doublon' });

      expect(response.status).toBe(409);
    });

    it('refuse un slug malforme en 400', async () => {
      const response = await createEvent({ slug: 'E2 Majuscules Espaces', name: 'Mauvais' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/events', () => {
    it('liste les soirees pour l organisateur, sans empreinte de code', async () => {
      const response = await request(app)
        .get('/api/events')
        .set('x-admin-token', ORGANIZER_TOKEN);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.events)).toBe(true);
      expect(JSON.stringify(response.body)).not.toContain('admin_code_hash');
      expect(JSON.stringify(response.body)).not.toContain('scrypt$');
      // Chaque entree porte les agregats du contrat.
      for (const event of response.body.events) {
        expect(event).toHaveProperty('donationCount');
        expect(event).toHaveProperty('totalAmount');
      }
    });

    it('refuse sans jeton organisateur', async () => {
      const response = await request(app).get('/api/events');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/events/active', () => {
    it('renvoie la soiree active en projection publique, sans horodatage', async () => {
      const response = await request(app).get('/api/events/active');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('multipleActive');
      expect(response.body.event).not.toBeNull();
      // EventPublic : ni createdAt, ni archivedAt, ni agregats.
      expect(response.body.event).not.toHaveProperty('createdAt');
      expect(response.body.event).not.toHaveProperty('archivedAt');
      expect(response.body.event).toHaveProperty('slug');
    });

    it('signale l ambiguite par un en-tete quand deux soirees sont actives', async () => {
      // Deux soirees actives ajoutees EN MEMOIRE (pas de saveDatabase) : elles
      // ne polluent pas le fichier partage par les autres suites.
      const db = getDb();
      db.run("INSERT INTO events (slug, name, status) VALUES ('e2-active-x', 'X', 'active')");
      db.run("INSERT INTO events (slug, name, status) VALUES ('e2-active-y', 'Y', 'active')");

      try {
        const response = await request(app).get('/api/events/active');

        expect(response.status).toBe(200);
        expect(response.body.multipleActive).toBe(true);
        expect(response.headers['x-multiple-active-events']).toBe('true');
      } finally {
        db.run("DELETE FROM events WHERE slug IN ('e2-active-x', 'e2-active-y')");
      }
    });
  });

  describe('GET /api/events/by-slug/:slug', () => {
    it('resout un slug connu, publiquement', async () => {
      await createEvent({ slug: 'e2-par-slug', name: 'Par slug' });

      const response = await request(app).get('/api/events/by-slug/e2-par-slug');

      expect(response.status).toBe(200);
      expect(response.body.event.slug).toBe('e2-par-slug');
      expect(response.body.event).not.toHaveProperty('createdAt');
    });

    it('renvoie 404 pour un slug inconnu', async () => {
      const response = await request(app).get('/api/events/by-slug/slug-fantome');
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/events/:eventId', () => {
    it('met a jour une soiree et renvoie l EventSummary', async () => {
      const creation = await createEvent({ slug: 'e2-maj', name: 'Avant' });
      const id = creation.body.event.id;

      const response = await request(app)
        .put(`/api/events/${id}`)
        .set('x-admin-token', ORGANIZER_TOKEN)
        .send({ name: 'Apres', status: 'active' });

      expect(response.status).toBe(200);
      expect(response.body.event.name).toBe('Apres');
      expect(response.body.event.status).toBe('active');

      // Remis en draft pour ne pas laisser une soiree active persistee.
      await request(app).put(`/api/events/${id}`).set('x-admin-token', ORGANIZER_TOKEN).send({ status: 'draft' });
    });

    it('renvoie 404 pour une soiree inconnue', async () => {
      const response = await request(app)
        .put('/api/events/9999999')
        .set('x-admin-token', ORGANIZER_TOKEN)
        .send({ name: 'Fantome' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/events/:eventId/admin-code', () => {
    it('regenere le code : le nouveau authentifie, l ancien ne vaut plus', async () => {
      const creation = await createEvent({ slug: 'e2-rotation', name: 'Rotation' });
      const id = creation.body.event.id;
      const ancienCode = creation.body.adminCode;

      const rotation = await request(app)
        .post(`/api/events/${id}/admin-code`)
        .set('x-admin-token', ORGANIZER_TOKEN);

      expect(rotation.status).toBe(200);
      const nouveauCode = rotation.body.adminCode;
      expect(typeof nouveauCode).toBe('string');
      expect(nouveauCode).not.toBe(ancienCode);

      // Le nouveau code doit ouvrir la soiree ; l'ancien doit etre refuse.
      // On sort ORGANIZER_TOKEN de la comparaison en visant l'admin de soiree.
      const avecNouveau = await request(app)
        .put(`/api/events/${id}`)
        .set('x-admin-token', nouveauCode)
        .send({ name: 'Renommee' });
      expect(avecNouveau.status).toBe(200);

      const avecAncien = await request(app)
        .put(`/api/events/${id}`)
        .set('x-admin-token', ancienCode)
        .send({ name: 'Ne devrait pas passer' });
      expect(avecAncien.status).toBe(401);
    });

    it('refuse la regeneration sans jeton organisateur', async () => {
      const creation = await createEvent({ slug: 'e2-rotation-refus', name: 'Refus' });
      const id = creation.body.event.id;

      const response = await request(app).post(`/api/events/${id}/admin-code`);
      expect(response.status).toBe(401);
    });
  });
});
