import { describe, it, expect, beforeAll } from 'vitest';
import { initTestDatabase } from '../helpers/app';
import { getDb } from '../../src/db/init';
import { runMigrations } from '../../src/db/migrations';
import { configService } from '../../src/services/config.service';
import { eventService } from '../../src/services/event.service';

// La couture entre deux tranches.
//
// La migration rafraichit event_configs depuis l'ancienne table `config` TANT
// QUE celle-ci est plus recente, et son commentaire s'appuie sur une hypothese
// explicite : « rien n'ecrit encore event_configs ». Cette tranche invalide
// cette hypothese — c'est desormais la seule table ecrite.
//
// Le desamorcage est cense etre automatique : l'updated_at d'event_configs
// depasse celui de config des le premier reglage, et le rafraichissement
// s'arrete de lui-meme. « Cense » n'est pas une preuve : si l'ordre de
// comparaison se trompait, chaque redemarrage du serveur reinitialiserait
// silencieusement la configuration du client.

describe('couture migration / service de configuration', () => {
  beforeAll(async () => {
    await initTestDatabase();
  });

  it('un reglage enregistre survit au rejeu de la migration', () => {
    const { event } = eventService.resolveActive();
    if (!event) {
      throw new Error('La migration doit laisser une soiree active');
    }
    const objectif = 987654;

    configService.update(event.id, { goalAmount: objectif });

    // Ce que fait un redemarrage du serveur : rejouer la migration sur la base
    // existante.
    runMigrations(getDb());

    expect(configService.get(event.id).goalAmount).toBe(objectif);
  });

  it('ne se laisse pas ecraser par une ancienne table plus recente en apparence', () => {
    const { event } = eventService.resolveActive();
    if (!event) {
      throw new Error('La migration doit laisser une soiree active');
    }
    const db = getDb();
    const objectif = 111222;

    configService.update(event.id, { goalAmount: objectif });
    // Depuis la suppression de C6, init.ts ne cree plus la table heritee : une
    // base neuve n'en a pas. Le scenario teste une base ANCIENNE — on la
    // fabrique donc explicitement, au schema historique.
    db.run(`
      CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        goal_amount INTEGER NOT NULL DEFAULT 10000000,
        preset_amounts TEXT NOT NULL DEFAULT '[1800,3600,18000,36000,100000]',
        menorah_segments TEXT NOT NULL DEFAULT '[]',
        display_settings TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.run('INSERT OR IGNORE INTO config (id) VALUES (1)');
    // Cas defavorable : l'ancienne table porte un horodatage EGAL a celui de la
    // configuration de la soiree. Une comparaison non stricte rafraichirait, et
    // le reglage du client disparaitrait au redemarrage suivant.
    const memeInstant = db.exec('SELECT updated_at FROM event_configs WHERE event_id = ?', [event.id])[0]
      .values[0][0] as string;
    db.run('UPDATE config SET goal_amount = 1, updated_at = ? WHERE id = 1', [memeInstant]);

    runMigrations(db);

    expect(configService.get(event.id).goalAmount).toBe(objectif);
  });
});
