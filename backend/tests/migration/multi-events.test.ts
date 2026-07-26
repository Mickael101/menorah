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

  it('ne retouche JAMAIS le rattachement d un don deja attribue', async () => {
    // Le test le plus important du fichier. Sans le WHERE event_id IS NULL,
    // chaque redemarrage reassigne TOUS les dons de TOUTES les soirees a la
    // soiree 1 — et les cinq tests d'origine restaient verts, parce qu'aucun
    // ne mettait de don dans la deuxieme soiree.
    const db = await legacyDatabase();
    runMigrations(db);
    db.run(`INSERT INTO events (slug, name, status) VALUES ('soiree-b', 'Soiree B', 'active')`);
    db.run(`INSERT INTO donations (first_name, last_name, amount, event_id) VALUES ('Dan', 'Cohen', 522, 2)`);
    db.run(`INSERT INTO donations (first_name, last_name, amount, event_id) VALUES ('Mick', 'Levi', 1000, 1)`);

    runMigrations(db);

    expect(one(db, "SELECT event_id FROM donations WHERE first_name = 'Dan'")).toBe(2);
    expect(one(db, "SELECT event_id FROM donations WHERE first_name = 'Mick'")).toBe(1);
  });

  it('rattache un don devenu orphelin a la soiree active', async () => {
    // Un event_id qui ne pointe vers rien n'est ni NULL — donc jamais repris —
    // ni valide : le don devient invisible partout des que les routes filtrent
    // par soiree. C'est l'etat final atteint quand une soiree est supprimee.
    const db = await legacyDatabase();
    db.run(`INSERT INTO donations (first_name, last_name, amount) VALUES ('Sarah', 'Azoulay', 700)`);
    runMigrations(db);
    db.run(`INSERT INTO events (slug, name, status) VALUES ('soiree-b', 'Soiree B', 'active')`);
    db.run(`UPDATE donations SET event_id = 99 WHERE first_name = 'Sarah'`);

    runMigrations(db);

    const reattached = one(db, "SELECT event_id FROM donations WHERE first_name = 'Sarah'");
    expect(reattached).toBe(2);
    expect(one(db, 'SELECT COUNT(*) FROM donations d WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.id = d.event_id)')).toBe(0);
  });

  it('ne ressuscite pas une soiree que l organisateur a supprimee', async () => {
    const db = await legacyDatabase();
    db.run(`INSERT INTO donations (first_name, last_name, amount) VALUES ('Mick', 'Levi', 1000)`);
    runMigrations(db);
    db.run(`INSERT INTO events (slug, name, status) VALUES ('vraie-soiree', 'Vraie soiree', 'active')`);
    db.run(`UPDATE donations SET event_id = 2`);
    db.run(`DELETE FROM event_configs WHERE event_id = 1`);
    db.run(`DELETE FROM events WHERE id = 1`);

    runMigrations(db);

    expect(one(db, 'SELECT COUNT(*) FROM events WHERE id = 1')).toBe(0);
    // Et surtout : aucune configuration fantome pour une soiree qui n'existe pas.
    expect(one(db, 'SELECT COUNT(*) FROM event_configs WHERE event_id = 1')).toBe(0);
  });

  it('ne nomme pas une installation neuve d apres le premier client', async () => {
    // La marque du client fondateur ne doit pas se retrouver dans le slug d'une
    // synagogue qui deploie l'application pour la premiere fois — le slug est
    // visible dans l'URL publique.
    const db = await legacyDatabase();
    db.run(`INSERT INTO config (id) VALUES (1)`);

    runMigrations(db);

    expect(one(db, 'SELECT slug FROM events WHERE id = 1')).not.toBe('orot-netanel');
    // L'application a toujours besoin d'une soiree active pour repondre.
    expect(one(db, "SELECT COUNT(*) FROM events WHERE status = 'active'")).toBe(1);
  });

  it('rafraichit la configuration tant que l ancienne table reste la source ecrite', async () => {
    // Fenetre reelle : entre le deploiement de cette migration et celui de la
    // tranche qui bascule les ecritures, l'administration ecrit encore dans
    // `config`. Sans rafraichissement, tout ce que le client regle dans cet
    // intervalle est silencieusement perdu au basculement.
    const db = await legacyDatabase();
    db.run(`INSERT INTO config (id, goal_amount, display_settings) VALUES (1, 100000, '{"theme":"ivory"}')`);
    runMigrations(db);
    expect(one(db, 'SELECT goal_amount FROM event_configs WHERE event_id = 1')).toBe(100000);

    db.run(`UPDATE config SET goal_amount = 4500000, updated_at = datetime('now', '+1 second') WHERE id = 1`);
    runMigrations(db);

    expect(one(db, 'SELECT goal_amount FROM event_configs WHERE event_id = 1')).toBe(4500000);
  });

  it('interdit deux soirees sur le meme slug', async () => {
    // Contrainte dont depend tout le routage /e/:slug.
    const db = await legacyDatabase();
    runMigrations(db);
    const existingSlug = one(db, 'SELECT slug FROM events WHERE id = 1') as string;

    expect(() =>
      db.run(`INSERT INTO events (slug, name, status) VALUES (?, 'Doublon', 'draft')`, [existingSlug])
    ).toThrow();
  });

  it('fige le contrat de colonnes de chaque table', async () => {
    // Une liste litterale, comparee au schema reel. C'est ce qui empeche une
    // colonne du contrat de disparaitre sans qu'aucun test ne bronche.
    const db = await legacyDatabase();
    runMigrations(db);

    const columnsOf = (table: string): string[] =>
      rows(db, `PRAGMA table_info(${table})`)
        .map((r) => String(r[1]))
        .sort();

    expect(columnsOf('events')).toEqual(
      ['admin_code_hash', 'archived_at', 'created_at', 'currency', 'default_locale', 'id', 'logo_url', 'name', 'slug', 'status'].sort()
    );
    expect(columnsOf('event_configs')).toEqual(
      ['display_settings', 'event_id', 'goal_amount', 'menorah_segments', 'premium_tiers', 'preset_amounts', 'theme_id', 'updated_at'].sort()
    );
    expect(columnsOf('media')).toEqual(
      ['audio_filename', 'created_at', 'event_id', 'filename', 'id', 'kind'].sort()
    );
    expect(columnsOf('themes')).toEqual(['created_at', 'event_id', 'id', 'name', 'tokens_json'].sort());
    expect(columnsOf('donations')).toContain('event_id');
  });

  it('part d une base entierement vide sans planter', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // Aucune table : c'est le cas d'un tout premier demarrage.
    expect(() => runMigrations(db)).not.toThrow();
    expect(one(db, 'SELECT COUNT(*) FROM events')).toBe(1);
  });
});
