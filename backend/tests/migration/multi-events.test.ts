import { describe, it, expect } from 'vitest';
import initSqlJs, { Database } from 'sql.js';
import { runMigrations } from '../../src/db/migrations';

// Ces tests attaquent une base EN MEMOIRE, jamais un fichier : la migration
// multi-evenements touche des dons reels en production, et la seule facon
// honnete de la verifier est de reconstituer l'ancien schema puis de mesurer
// ce que la migration en fait.

// Le schema tel qu'il existait AVANT le LOT 1, reproduit a l'identique depuis
// db/init.ts (colonnes email et phone appendues par ALTER, comme en base reelle).
async function legacyDatabase(): Promise<Database> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      reference TEXT,
      premium_word_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`ALTER TABLE donations ADD COLUMN email TEXT`);
  db.run(`ALTER TABLE donations ADD COLUMN phone TEXT`);
  db.run(`
    CREATE TABLE config (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      goal_amount INTEGER NOT NULL DEFAULT 10000000,
      preset_amounts TEXT NOT NULL DEFAULT '[1800,3600,18000,36000,100000]',
      menorah_segments TEXT NOT NULL DEFAULT '[]',
      display_settings TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  return db;
}

function rows(db: Database, sql: string): unknown[][] {
  const result = db.exec(sql);
  return result.length === 0 ? [] : result[0].values;
}

function one(db: Database, sql: string): unknown {
  const values = rows(db, sql);
  return values.length === 0 ? null : values[0][0];
}

describe('migration multi-evenements', () => {
  it('rattache les dons existants a une premiere soiree, sans en perdre un seul', async () => {
    const db = await legacyDatabase();
    db.run(`INSERT INTO donations (first_name, last_name, amount) VALUES ('Mick', 'Levi', 1000)`);
    db.run(`INSERT INTO donations (first_name, last_name, amount) VALUES ('Dan', 'Cohen', 522)`);
    db.run(`INSERT INTO donations (first_name, last_name, amount) VALUES ('Sarah', 'Azoulay', 21111)`);

    runMigrations(db);

    expect(one(db, 'SELECT COUNT(*) FROM donations')).toBe(3);
    expect(one(db, 'SELECT COUNT(*) FROM events')).toBe(1);
    expect(one(db, 'SELECT slug FROM events WHERE id = 1')).toBe('orot-netanel');
    expect(one(db, "SELECT status FROM events WHERE id = 1")).toBe('active');
    expect(one(db, 'SELECT COUNT(*) FROM donations WHERE event_id = 1')).toBe(3);
    expect(one(db, 'SELECT SUM(amount) FROM donations')).toBe(22633);
  });

  it('recopie la configuration singleton vers la soiree, sans la reinventer', async () => {
    const db = await legacyDatabase();
    db.run(
      `INSERT INTO config (id, goal_amount, preset_amounts, menorah_segments, display_settings)
       VALUES (1, 250000, '[180,360]', '[{"id":"seg-1","threshold":10}]', ?)`,
      [JSON.stringify({ adminBranding: { fr: { title: 'Ohel Yeochoua', subtitle: 'x' } } })]
    );

    runMigrations(db);

    expect(one(db, 'SELECT goal_amount FROM event_configs WHERE event_id = 1')).toBe(250000);
    expect(one(db, 'SELECT preset_amounts FROM event_configs WHERE event_id = 1')).toBe('[180,360]');
    expect(one(db, 'SELECT menorah_segments FROM event_configs WHERE event_id = 1')).toBe(
      '[{"id":"seg-1","threshold":10}]'
    );
    expect(one(db, 'SELECT display_settings FROM event_configs WHERE event_id = 1')).toContain('Ohel Yeochoua');
    // Le nom de la soiree est REPRIS de la marque configuree, pas invente.
    expect(one(db, 'SELECT name FROM events WHERE id = 1')).toBe('Ohel Yeochoua');
  });

  it('se rejoue sans rien dupliquer ni rien ecraser', async () => {
    const db = await legacyDatabase();
    db.run(`INSERT INTO config (id, goal_amount) VALUES (1, 99000)`);
    db.run(`INSERT INTO donations (first_name, last_name, amount) VALUES ('Mick', 'Levi', 1000)`);

    runMigrations(db);
    // Une modification faite APRES la migration ne doit pas etre ecrasee par
    // le rejeu : c'est ce qui differencie une migration idempotente d'une
    // migration qui reinitialise a chaque demarrage.
    db.run(`UPDATE event_configs SET goal_amount = 123456 WHERE event_id = 1`);
    db.run(`UPDATE events SET name = 'Soiree renommee' WHERE id = 1`);
    db.run(`INSERT INTO events (slug, name, status) VALUES ('deuxieme', 'Deuxieme soiree', 'draft')`);

    runMigrations(db);
    runMigrations(db);

    expect(one(db, 'SELECT COUNT(*) FROM events')).toBe(2);
    expect(one(db, 'SELECT COUNT(*) FROM event_configs')).toBe(1);
    expect(one(db, 'SELECT goal_amount FROM event_configs WHERE event_id = 1')).toBe(123456);
    expect(one(db, 'SELECT name FROM events WHERE id = 1')).toBe('Soiree renommee');
    expect(one(db, 'SELECT COUNT(*) FROM donations')).toBe(1);
  });

  it('cree les tables du LOT 1 et l index chronologique par soiree', async () => {
    const db = await legacyDatabase();

    runMigrations(db);

    const tables = rows(db, `SELECT name FROM sqlite_master WHERE type = 'table'`).map((r) => r[0]);
    expect(tables).toContain('events');
    expect(tables).toContain('event_configs');
    expect(tables).toContain('media');
    expect(tables).toContain('themes');

    const indexes = rows(db, `SELECT name FROM sqlite_master WHERE type = 'index'`).map((r) => r[0]);
    expect(indexes).toContain('idx_donations_event_created');
  });

  it('part d une base entierement vide sans planter', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // Aucune table : c'est le cas d'un tout premier demarrage.
    expect(() => runMigrations(db)).not.toThrow();
    expect(one(db, 'SELECT COUNT(*) FROM events')).toBe(1);
  });
});
