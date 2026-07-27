import { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { uploadsRoot, gifAudioFilePath } from '../config/storage';

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

function scalar(db: Database, sql: string, params: (string | number)[] = []): unknown {
  const result = db.exec(sql, params);
  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }
  return result[0].values[0][0];
}

// Y a-t-il quelque chose a adopter ? Autrement dit : cette base a-t-elle deja
// servi ? La reponse decide du NOM de la premiere soiree, et ce nom finit dans
// une URL publique — une synagogue qui deploie l'application pour la premiere
// fois ne doit pas heriter du slug du client fondateur.
function hasLegacyData(db: Database): boolean {
  if (tableExists(db, 'donations') && scalar(db, 'SELECT COUNT(*) FROM donations') !== 0) {
    return true;
  }
  if (!tableExists(db, 'config')) {
    return false;
  }
  // init.ts insere TOUJOURS une ligne config(id=1) avec ses valeurs par defaut,
  // meme sur une base vierge : la presence de la ligne ne prouve donc rien, il
  // faut regarder si elle a ete TOUCHEE.
  const touched = scalar(
    db,
    `SELECT COUNT(*) FROM config
      WHERE id = 1
        AND (COALESCE(display_settings, '') NOT IN ('', '{}')
          OR goal_amount <> 10000000
          OR COALESCE(menorah_segments, '[]') <> '[]')`
  );
  return touched !== 0;
}

// La migration a-t-elle deja tourne sur cette base ? Sans cette question, une
// soiree que l'organisateur a volontairement SUPPRIMEE ressuscite au
// redemarrage suivant, avec son slug d'origine et le statut actif.
function migrationAlreadyApplied(db: Database): boolean {
  if (tableExists(db, 'event_configs') && scalar(db, 'SELECT COUNT(*) FROM event_configs') !== 0) {
    return true;
  }
  return (
    tableExists(db, 'donations') &&
    hasColumn(db, 'donations', 'event_id') &&
    scalar(db, 'SELECT COUNT(*) FROM donations WHERE event_id IS NOT NULL') !== 0
  );
}

function mostRecentActiveEventId(db: Database): number | null {
  const id = scalar(
    db,
    `SELECT id FROM events WHERE status = 'active' ORDER BY created_at DESC, id DESC LIMIT 1`
  );
  return typeof id === 'number' ? id : null;
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
  seedMediaFromDisk(db);
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
  // DIVERGENCE ASSUMEE avec la spec §4.1, qui demande
  // `event_id INTEGER NOT NULL REFERENCES events(id)`. SQLite refuse
  // `ADD COLUMN NOT NULL` sans valeur par defaut, et ne sait pas ajouter une
  // contrainte de cle etrangere a une table existante : les deux exigeraient de
  // recreer la table et d'y recopier des dons reels, ce qui est un risque bien
  // superieur au benefice. La colonne est donc nullable et sans REFERENCES ;
  // l'integrite est tenue par attachOrphanDonations, qui rattrape a la fois les
  // NULL et les identifiants qui ne pointent vers rien.
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
  const noEventYet = scalar(db, 'SELECT COUNT(*) FROM events') === 0;

  if (noEventYet && !migrationAlreadyApplied(db)) {
    const legacy = hasLegacyData(db);
    db.run(`INSERT INTO events (id, slug, name, status) VALUES (?, ?, ?, 'active')`, [
      FIRST_EVENT_ID,
      legacy ? FIRST_EVENT_SLUG : freshInstallSlug(),
      legacy ? legacyEventName(db) : freshInstallName()
    ]);
  }

  attachOrphanDonations(db);
}

// Rattachement des dons sans soiree valide. Volontairement dissocie de la
// creation, et volontairement en DEUX cas :
//   - event_id NULL : un don insere par une ancienne route deployee en
//     cohabitation, que le demarrage suivant doit rattraper ;
//   - event_id qui ne pointe vers RIEN : etat atteint des qu'une soiree est
//     supprimee. C'est le plus dangereux des deux, parce que le don n'est ni
//     NULL — donc jamais repris par un rattrapage naif — ni valide : il
//     disparait de tous les ecrans, de tous les totaux et de tous les exports
//     des que les routes filtrent par soiree.
// On vise la soiree active la plus recente, jamais un identifiant en dur : le
// numero 1 peut avoir ete supprime.
function attachOrphanDonations(db: Database): void {
  if (!tableExists(db, 'donations') || !hasColumn(db, 'donations', 'event_id')) {
    return;
  }

  const target = mostRecentActiveEventId(db);
  if (target === null) {
    // Aucune soiree active : rattacher a l'aveugle recreerait le probleme.
    // Mieux vaut laisser l'anomalie visible que la deplacer.
    const orphans = scalar(
      db,
      `SELECT COUNT(*) FROM donations d
        WHERE d.event_id IS NULL
           OR NOT EXISTS (SELECT 1 FROM events e WHERE e.id = d.event_id)`
    );
    if (orphans !== 0) {
      console.warn(
        `MIGRATION: ${orphans} don(s) sans soiree valide, et aucune soiree active pour les recevoir.`
      );
    }
    return;
  }

  db.run(
    `UPDATE donations SET event_id = ?
      WHERE event_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM events e WHERE e.id = donations.event_id)`,
    [target]
  );
}

// Une installation neuve porte un nom neutre, surchargeable par l'environnement.
// Le slug est visible dans l'URL publique /e/<slug>/... : y laisser la marque du
// premier client serait un defaut de conception pour un produit destine a
// plusieurs synagogues.
function freshInstallSlug(): string {
  return process.env.EVENT_DEFAULT_SLUG?.trim() || 'soiree-1';
}

function freshInstallName(): string {
  return process.env.EVENT_DEFAULT_NAME?.trim() || 'Soiree 1';
}

// Recopie unique de l'ancien singleton vers la configuration de la soiree 1.
// La condition « aucune ligne pour cette soiree » est ce qui rend l'operation
// idempotente : au rejeu, une valeur modifiee depuis n'est PAS ecrasee. Une
// migration qui reecrirait a chaque demarrage reinitialiserait silencieusement
// la configuration du client a chaque redemarrage du serveur.
function copyLegacyConfig(db: Database): void {
  // Pas de configuration pour une soiree qui n'existe pas. Sans cette garde, une
  // soiree supprimee laissait derriere elle une ligne fantome que le rejeu
  // recreait indefiniment.
  const eventExists = scalar(db, 'SELECT COUNT(*) FROM events WHERE id = ?', [FIRST_EVENT_ID]);
  if (eventExists === 0) {
    return;
  }

  const alreadyCopied = scalar(db, 'SELECT COUNT(*) FROM event_configs WHERE event_id = ?', [
    FIRST_EVENT_ID
  ]) !== 0;

  if (!tableExists(db, 'config')) {
    if (!alreadyCopied) {
      db.run(`INSERT INTO event_configs (event_id) VALUES (?)`, [FIRST_EVENT_ID]);
    }
    return;
  }

  const result = db.exec(
    `SELECT goal_amount, preset_amounts, menorah_segments, display_settings, updated_at
       FROM config WHERE id = 1`
  );
  if (result.length === 0 || result[0].values.length === 0) {
    if (!alreadyCopied) {
      db.run(`INSERT INTO event_configs (event_id) VALUES (?)`, [FIRST_EVENT_ID]);
    }
    return;
  }

  const [goalAmount, presetAmounts, menorahSegments, displaySettings, legacyUpdatedAt] =
    result[0].values[0];

  // LA FENETRE. Entre le deploiement de cette migration et celui de la tranche
  // qui bascule les ECRITURES vers event_configs, l'administration ecrit encore
  // dans `config`. Une recopie strictement unique perdrait alors, au
  // basculement et sans un mot, tout ce que le client a regle dans
  // l'intervalle : objectif, segments, thème, marque.
  // On rafraichit donc tant que l'ancienne table est PLUS RECENTE. C'est sûr
  // precisement parce que rien n'ecrit encore event_configs : le jour ou elle
  // devient la source ecrite, son updated_at depasse celui de config et le
  // rafraichissement s'arrete de lui-meme, sans code a retirer.
  if (alreadyCopied) {
    const legacyIsNewer = scalar(
      db,
      `SELECT COUNT(*) FROM event_configs
        WHERE event_id = ? AND COALESCE(?, '') > COALESCE(updated_at, '')`,
      [FIRST_EVENT_ID, (legacyUpdatedAt as string) ?? '']
    );
    if (legacyIsNewer === 0) {
      return;
    }
    db.run(
      `UPDATE event_configs
          SET goal_amount = ?, preset_amounts = ?, menorah_segments = ?, display_settings = ?,
              updated_at = ?
        WHERE event_id = ?`,
      [
        goalAmount as number,
        presetAmounts as string,
        menorahSegments as string,
        displaySettings as string,
        (legacyUpdatedAt as string) ?? '',
        FIRST_EVENT_ID
      ]
    );
    return;
  }

  db.run(
    `INSERT INTO event_configs (event_id, goal_amount, preset_amounts, menorah_segments, display_settings, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      FIRST_EVENT_ID,
      goalAmount as number,
      presetAmounts as string,
      menorahSegments as string,
      displaySettings as string,
      (legacyUpdatedAt as string) ?? ''
    ]
  );
}

// Inventaire des medias deja sur le disque vers la table `media`, rattaches a la
// soiree fondatrice. Jusqu'ici les GIF, sons et SVG etaient listes a plat depuis
// le repertoire uploads/, toutes soirees confondues ; la table existait mais
// n'etait ni lue ni ecrite. Cette migration lui donne son contenu initial pour
// que les fichiers deja livres n'aient pas l'air d'avoir disparu au passage au
// cloisonnement par soiree.
//
// Idempotente par la meme sonde que le reste : elle ne s'execute que si `media`
// est VIDE. Des qu'un upload y a insere une ligne, le rejeu ne touche plus rien
// — sinon un fichier supprime par l'admin reapparaitrait au redemarrage suivant.
function seedMediaFromDisk(db: Database): void {
  if (!tableExists(db, 'media')) {
    return;
  }
  if (scalar(db, 'SELECT COUNT(*) FROM media') !== 0) {
    return;
  }

  const target = mostRecentActiveEventId(db) ?? FIRST_EVENT_ID;
  if (scalar(db, 'SELECT COUNT(*) FROM events WHERE id = ?', [target]) === 0) {
    return;
  }

  const associations = loadGifAudioAssociations();

  seedMediaKind(db, target, 'gif', path.join(uploadsRoot, 'gifs'), /\.(gif|png|jpe?g|webp)$/i, associations);
  seedMediaKind(db, target, 'audio', path.join(uploadsRoot, 'audio'), /\.(mp3|wav|ogg|webm|aac|m4a)$/i);
  seedMediaKind(db, target, 'visual', path.join(uploadsRoot, 'visuals'), /\.svg$/i);
}

function seedMediaKind(
  db: Database,
  eventId: number,
  kind: string,
  dir: string,
  pattern: RegExp,
  associations?: Map<string, string>
): void {
  let files: string[];
  try {
    if (!fs.existsSync(dir)) {
      return;
    }
    files = fs.readdirSync(dir);
  } catch {
    // Un repertoire d'uploads illisible ne doit pas empecher le demarrage.
    return;
  }

  for (const filename of files) {
    if (!pattern.test(filename)) {
      continue;
    }
    const audioFilename = associations?.get(filename) ?? null;
    db.run('INSERT INTO media (event_id, kind, filename, audio_filename) VALUES (?, ?, ?, ?)', [
      eventId,
      kind,
      filename,
      audioFilename
    ]);
  }
}

// Les associations GIF -> son vivaient dans un gif-audio.json GLOBAL (une seule
// carte pour toutes les soirees). On les relit une derniere fois ici pour les
// couler dans media.audio_filename, ou elles deviennent propres a une soiree. La
// valeur stockee etait une URL (/uploads/audio/xxx) : on ne garde que le nom de
// fichier, forme attendue par media.
function loadGifAudioAssociations(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    if (!fs.existsSync(gifAudioFilePath)) {
      return map;
    }
    const raw = JSON.parse(fs.readFileSync(gifAudioFilePath, 'utf-8')) as Record<string, string>;
    for (const [gifFilename, audioUrl] of Object.entries(raw)) {
      if (typeof audioUrl === 'string' && audioUrl) {
        const audioFilename = audioUrl.split('/').pop();
        if (audioFilename) {
          map.set(gifFilename, audioFilename);
        }
      }
    }
  } catch {
    // Un fichier d'associations illisible n'empeche pas le demarrage : les GIF
    // seront simplement sans son associe, etat rattrapable a la main.
  }
  return map;
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
