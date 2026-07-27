import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../helpers/app';
import { insertEvent } from '../helpers/events';
import { getDb, saveDatabase } from '../../src/db/init';
import { eventService } from '../../src/services/event.service';
import { donationService } from '../../src/services/donation.service';
import { configService } from '../../src/services/config.service';

// Trois mutations avaient survecu a la suite : chacune produisait un resultat
// FAUX sans lever d erreur, et l assertion en place la validait quand meme. Ces
// trois tests les tuent — verifies par la revue : verts sur le code sain, ils
// echouent des que la mutation est appliquee.

const ADMIN_TOKEN = 'test-admin-token';

function scalaire(sql: string, params: (string | number)[]): unknown {
  const result = getDb().exec(sql, params);
  return result.length === 0 || result[0].values.length === 0 ? null : result[0].values[0][0];
}

function idsActifs(): number[] {
  const result = getDb().exec("SELECT id FROM events WHERE status = 'active'");
  return result.length === 0 ? [] : result[0].values.map((row) => row[0] as number);
}

describe('mutations survivantes', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  // MUTATION 1 : un UPDATE event_configs sans clause WHERE balaierait toute la
  // table sans erreur. L ancienne assertion comparait la config de B a ses
  // valeurs par DEFAUT : B n ayant pas de ligne, get() retombait sur le defaut
  // en dur et l assertion restait vraie meme apres un balayage complet. On donne
  // donc une ligne a B AVANT de regler A, puis on verifie que B est intact.
  it('regler une soiree ne balaie pas la configuration d une autre', () => {
    const soireeA = insertEvent({ slug: 'mut-cfg-a', name: 'Config A' });
    const soireeB = insertEvent({ slug: 'mut-cfg-b', name: 'Config B' });

    configService.update(soireeB, { goalAmount: 1111 });
    configService.update(soireeA, { goalAmount: 2222 });

    // Sans clause WHERE, regler A aurait ecrit 2222 sur la ligne de B aussi.
    expect(configService.get(soireeB).goalAmount).toBe(1111);
    expect(configService.get(soireeA).goalAmount).toBe(2222);
  });

  // MUTATION 2 : resoudre la soiree active pourrait etre un identifiant en dur
  // (« return 1 »). L ancien test comparait event_id a 1, la valeur SEMEE :
  // tautologique. On cree une soiree plus recente, on archive l ancienne, on
  // poste sur la route heritee, et on verifie que le don rejoint la NOUVELLE.
  // Sans cela, archiver la soiree 1 laisserait les ecrans publics et les QR
  // codes alimenter une soiree archivee, sans erreur.
  it('la route heritee rattache le don a la soiree active reelle, pas a un id en dur', async () => {
    const db = getDb();
    const { event: migration } = eventService.resolveActive();
    if (!migration) {
      throw new Error('La migration doit laisser une soiree active');
    }
    const actifsAvant = idsActifs();

    db.run("UPDATE events SET status = 'archived' WHERE status = 'active'");
    const nouvelle = insertEvent({
      slug: 'mut-active-recente',
      name: 'Recente',
      status: 'active',
      createdAt: '2099-01-01 00:00:00'
    });

    try {
      const creation = await request(app)
        .post('/api/donations')
        .send({ firstName: 'Nouvelle', lastName: 'Soiree', amount: 1500 });

      expect(creation.status).toBe(201);

      const eventId = scalaire('SELECT event_id FROM donations WHERE id = ?', [creation.body.donation.id]);
      expect(eventId).toBe(nouvelle);
      // Et surtout pas l ancienne, desormais archivee.
      expect(eventId).not.toBe(migration.id);
    } finally {
      db.run('DELETE FROM donations WHERE event_id = ?', [nouvelle]);
      db.run('DELETE FROM event_configs WHERE event_id = ?', [nouvelle]);
      db.run('DELETE FROM events WHERE id = ?', [nouvelle]);
      for (const id of actifsAvant) {
        db.run("UPDATE events SET status = 'active' WHERE id = ?", [id]);
      }
      saveDatabase();
    }
  });

  // MUTATION 3 : l export CSV n etait verifie que sur son statut et son type
  // MIME, jamais sur son CONTENU. Or c est la seule route qui expose email,
  // telephone et reference en clair : un getAll(1) en dur ferait telecharger a
  // l admin de la soiree active la liste nominative des donateurs de la
  // soiree 1. On met un donateur sur chaque soiree et on verifie que le CSV ne
  // contient que ceux de la soiree active resolue.
  //
  // Le jeton admin est pose explicitement : hors production requireAdmin laisse
  // passer par conception, et le test ne mordrait pas.
  it('l export CSV ne livre que les donateurs de la soiree active resolue', async () => {
    process.env.ADMIN_TOKEN = ADMIN_TOKEN;
    const db = getDb();
    const { event: migration } = eventService.resolveActive();
    if (!migration) {
      throw new Error('La migration doit laisser une soiree active');
    }
    const actifsAvant = idsActifs();

    // La soiree 1 (issue de la migration) est archivee et joue « l autre
    // soiree » ; une nouvelle soiree devient l active que l admin consulte.
    db.run("UPDATE events SET status = 'archived' WHERE status = 'active'");
    const active = insertEvent({
      slug: 'mut-csv-active',
      name: 'CSV active',
      status: 'active',
      createdAt: '2099-01-01 00:00:00'
    });

    const donArchive = donationService.create(migration.id, {
      firstName: 'Alix',
      lastName: 'DonateurArchive',
      amount: 1000,
      email: 'archive@example.com',
      phone: '0500000001',
      reference: 'REF-ARCHIVE'
    });
    const donActif = donationService.create(active, {
      firstName: 'Bela',
      lastName: 'DonateurActif',
      amount: 2000
    });

    try {
      const response = await request(app)
        .get('/api/donations/export.csv')
        .set('x-admin-token', ADMIN_TOKEN);

      expect(response.status).toBe(200);
      const csv = response.text;

      // La soiree active resolue est la nouvelle : son donateur y figure.
      expect(csv).toContain('DonateurActif');
      // Le donateur de la soiree archivee ne doit jamais fuiter dans cet export.
      expect(csv).not.toContain('DonateurArchive');
      expect(csv).not.toContain('archive@example.com');
      expect(csv).not.toContain('REF-ARCHIVE');
    } finally {
      db.run('DELETE FROM donations WHERE id IN (?, ?)', [donArchive.id, donActif.id]);
      db.run('DELETE FROM event_configs WHERE event_id = ?', [active]);
      db.run('DELETE FROM events WHERE id = ?', [active]);
      for (const id of actifsAvant) {
        db.run("UPDATE events SET status = 'active' WHERE id = ?", [id]);
      }
      saveDatabase();
      delete process.env.ADMIN_TOKEN;
    }
  });
});
