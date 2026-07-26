import { Database } from 'sql.js';

// Migrations du schema, ordonnees et IDEMPOTENTES.
//
// Elles tournent a chaque demarrage (db/init.ts) et quatre fois par suite de
// tests : l'idempotence n'est pas une elegance, c'est une condition de
// fonctionnement.
//
// Le depot n'utilise pas de framework de migration (KISS, constitution du
// projet) : on suit l'idiome deja en place, CREATE TABLE IF NOT EXISTS puis
// ALTER TABLE conditionnel. Une seule difference assumee avec le code
// precedent : on SONDE le schema au lieu d'avaler l'erreur d'un ALTER dans un
// try/catch. Un ADD COLUMN qui echoue pour une autre raison qu'une colonne
// deja presente doit remonter, pas se manifester 200 lignes plus loin en
// « no such column ».

// La premiere soiree, celle qui recueille tout l'existant.
const FIRST_EVENT_ID = 1;
const FIRST_EVENT_SLUG = 'orot-netanel';
const DEFAULT_FIRST_EVENT_NAME = 'Orot Netanel';

function hasColumn(db: Database, table: string, column: string): boolean {
  const result = db.exec(`PRAGMA table_info(${table})`);
  if (result.length === 0) {
    return false;
  }
  const nameIndex = result[0].columns.indexOf('name');
  return result[0].values.some((row) => row[nameIndex] === column);
}

function tableExists(db: Database, table: string): boolean {
  const result = db.exec(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, [table]);
  return result.length > 0 && result[0].values.length > 0;
}

function scalar(db: Database, sql: string): unknown {
  const result = db.exec(sql);
  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }
  return result[0].values[0][0];
}

export function runMigrations(db: Database): void {
  createEventsTable(db);
  createEventConfigsTable(db);
  createMediaTable(db);
  createThemesTable(db);
  addEventIdToDonations(db);
  seedFirstEvent(db);
  copyLegacyConfig(db);
  createEventIndexes(db);
}

function createEventsTable(db: Database): void {
  // admin_code_hash est NULLABLE, contrairement a la premiere redaction de la
  // spec. Raison : la soiree issue de la migration n'a AUCUN code — en
  // inventer un serait inventer un secret que personne ne connait. Une soiree
  // sans code reste pilotable par le jeton organisateur, ce qui est exactement
  // le fonctionnement actuel. Le code s'ajoute ensuite, explicitement.
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      admin_code_hash TEXT,
      logo_url TEXT,
      default_locale TEXT NOT NULL DEFAULT 'he',
      currency TEXT NOT NULL DEFAULT 'ILS',
      created_at TEXT DEFAULT (datetime('now')),
      archived_at TEXT
    )
  `);
}

function createEventConfigsTable(db: Database): void {
  // Remplace le singleton `config` et sa contrainte CHECK(id = 1). Les valeurs
  // par defaut sont reprises a l'identique de l'ancienne table, pour qu'une
  // soiree creee sans configuration se comporte comme aujourd'hui.
  // premium_tiers existe des maintenant parce que le schema doit etre stable
  // pour toute la suite du chantier : les paliers sont encore codes en dur
  // cote frontend, et ils viendront s'y brancher sans nouvelle migration.
  db.run(`
    CREATE TABLE IF NOT EXISTS event_configs (
      event_id INTEGER PRIMARY KEY REFERENCES events(id),
      goal_amount INTEGER NOT NULL DEFAULT 10000000,
      preset_amounts TEXT NOT NULL DEFAULT '[1800,3600,18000,36000,100000]',
      premium_tiers TEXT NOT NULL DEFAULT '[]',
      menorah_segments TEXT NOT NULL DEFAULT '[]',
      display_settings TEXT NOT NULL DEFAULT '{}',
      theme_id INTEGER REFERENCES themes(id),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

function createMediaTable(db: Database): void {
  // GIF, sons et SVG rattaches a une soiree. Les medias existants sont
  // aujourd'hui stockes a plat sur le disque : leur rattachement est traite
  // par la tranche qui portera les routes de medias, pas ici.
  db.run(`
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id),
      kind TEXT NOT NULL,
      filename TEXT NOT NULL,
      audio_filename TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

function createThemesTable(db: Database): void {
  // event_id NULL = preset livre avec l'application, partage par toutes les
  // soirees. Non NULL = theme personnalise appartenant a une soiree.
  db.run(`
    CREATE TABLE IF NOT EXISTS themes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER REFERENCES events(id),
      name TEXT NOT NULL,
      tokens_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

function addEventIdToDonations(db: Database): void {
  if (!tableExists(db, 'donations') || hasColumn(db, 'donations', 'event_id')) {
    return;
  }
  db.run(`ALTER TABLE donations ADD COLUMN event_id INTEGER`);
}

// Le nom de la premiere soiree est REPRIS de la marque deja configuree par
// l'utilisateur, pas invente : c'est le nom qu'il voit en haut de son
// administration depuis le debut.
function legacyEventName(db: Database): string {
  if (!tableExists(db, 'config')) {
    return DEFAULT_FIRST_EVENT_NAME;
  }
  const raw = scalar(db, 'SELECT display_settings FROM config WHERE id = 1');
  if (typeof raw !== 'string' || raw.trim() === '') {
    return DEFAULT_FIRST_EVENT_NAME;
  }
  try {
    const settings = JSON.parse(raw) as {
      adminBranding?: Record<string, { title?: string } | undefined>;
    };
    const branding = settings.adminBranding;
    const title = branding?.fr?.title || branding?.en?.title || branding?.he?.title;
    return typeof title === 'string' && title.trim() !== '' ? title.trim() : DEFAULT_FIRST_EVENT_NAME;
  } catch {
    // Une configuration illisible ne doit pas empecher le demarrage : on
    // retombe sur le nom par defaut et la soiree reste renommable.
    return DEFAULT_FIRST_EVENT_NAME;
  }
}

function seedFirstEvent(db: Database): void {
  const existing = scalar(db, 'SELECT COUNT(*) FROM events');
  if (existing === 0) {
    db.run(
      `INSERT INTO events (id, slug, name, status) VALUES (?, ?, ?, 'active')`,
      [FIRST_EVENT_ID, FIRST_EVENT_SLUG, legacyEventName(db)]
    );
  }

  // Rattachement des dons orphelins. Volontairement dissocie de la creation :
  // un don peut arriver sans event_id apres coup (ancienne route deployee en
  // cohabitation), et cette ligne doit alors le rattraper au demarrage suivant.
  if (tableExists(db, 'donations') && hasColumn(db, 'donations', 'event_id')) {
    db.run(`UPDATE donations SET event_id = ? WHERE event_id IS NULL`, [FIRST_EVENT_ID]);
  }
}

// Recopie unique de l'ancien singleton vers la configuration de la soiree 1.
// La condition « aucune ligne pour cette soiree » est ce qui rend l'operation
// idempotente : au rejeu, une valeur modifiee depuis n'est PAS ecrasee. Une
// migration qui reecrirait a chaque demarrage reinitialiserait silencieusement
// la configuration du client a chaque redemarrage du serveur.
function copyLegacyConfig(db: Database): void {
  const alreadyCopied = scalar(db, `SELECT COUNT(*) FROM event_configs WHERE event_id = ${FIRST_EVENT_ID}`);
  if (alreadyCopied !== 0) {
    return;
  }

  if (!tableExists(db, 'config')) {
    db.run(`INSERT INTO event_configs (event_id) VALUES (?)`, [FIRST_EVENT_ID]);
    return;
  }

  const result = db.exec(
    `SELECT goal_amount, preset_amounts, menorah_segments, display_settings FROM config WHERE id = 1`
  );
  if (result.length === 0 || result[0].values.length === 0) {
    db.run(`INSERT INTO event_configs (event_id) VALUES (?)`, [FIRST_EVENT_ID]);
    return;
  }

  const [goalAmount, presetAmounts, menorahSegments, displaySettings] = result[0].values[0];
  db.run(
    `INSERT INTO event_configs (event_id, goal_amount, preset_amounts, menorah_segments, display_settings)
     VALUES (?, ?, ?, ?, ?)`,
    [
      FIRST_EVENT_ID,
      goalAmount as number,
      presetAmounts as string,
      menorahSegments as string,
      displaySettings as string
    ]
  );
}

function createEventIndexes(db: Database): void {
  if (!tableExists(db, 'donations') || !hasColumn(db, 'donations', 'event_id')) {
    return;
  }
  // L'index chronologique existant porte sur created_at seul : il ne sert plus
  // a rien des qu'une requete filtre par soiree. Celui-ci le remplace pour
  // l'usage reel (les dons d'UNE soiree, du plus recent au plus ancien) ;
  // l'ancien est conserve, il ne coute rien a ce volume.
  db.run(`CREATE INDEX IF NOT EXISTS idx_donations_event_created ON donations(event_id, created_at)`);
}
