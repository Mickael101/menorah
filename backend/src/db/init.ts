import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { databaseFilePath } from '../config/storage';
import { runMigrations } from './migrations';

const DB_PATH = databaseFilePath;

let db: Database;

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // SQLite desactive les cles etrangeres PAR DEFAUT, et par connexion. Sans
  // cette ligne, les REFERENCES declarees dans le schema multi-evenements ne
  // contraignent RIEN : `PRAGMA foreign_key_list(donations)` renvoyait une liste
  // vide, et `media.event_id NOT NULL REFERENCES events(id)` avait l'air d'une
  // garantie sans en etre une. Des trois etats possibles — contraintes reelles,
  // contraintes retirees, contraintes decoratives — le dernier est le pire.
  // Activer le pragma ne valide PAS les lignes existantes, seulement les
  // ecritures a venir : l'activation est donc sans risque sur une base deja en
  // service.
  db.run('PRAGMA foreign_keys = ON');

  // Create donations table
  db.run(`
    CREATE TABLE IF NOT EXISTS donations (
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

  // Migration: Add premium_word_id column if it doesn't exist
  try {
    db.run(`ALTER TABLE donations ADD COLUMN premium_word_id TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add email column if it doesn't exist
  try {
    db.run(`ALTER TABLE donations ADD COLUMN email TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add phone column if it doesn't exist
  try {
    db.run(`ALTER TABLE donations ADD COLUMN phone TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Create index for chronological ordering
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at)
  `);

  // La table heritee `config` n'est PLUS creee : plus rien ne l'ecrit depuis la
  // bascule vers event_configs, et la migration tolere son absence (lectures
  // gardees par tableExists). Sur une base ancienne qui la porte encore, on
  // garantit seulement la colonne attendue par la recopie de bascule :
  try {
    db.run(`ALTER TABLE config ADD COLUMN display_settings TEXT NOT NULL DEFAULT '{}'`);
  } catch (e) {
    // Base neuve (table absente) ou colonne deja presente : rien a faire
  }

  // Schema multi-evenements. Idempotent ; recopie `config` si elle existe
  // et rattache les dons.
  runMigrations(db);

  // Save to file
  saveDatabase();

  console.log('Database initialized successfully');
}

export function getDb(): Database {
  return db;
}

export function saveDatabase(): void {
  const data = db.export();
  const buffer = Buffer.from(data);

  // Ensure directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Ecriture ATOMIQUE. sql.js reecrit le fichier ENTIER a chaque sauvegarde, et
  // c'est l'unique point d'ecriture de la base : une interruption au milieu d'un
  // writeFileSync direct laissait un fichier tronque, c'est-a-dire la perte de
  // tous les dons. Ecrire a cote puis renommer rend l'operation tout-ou-rien —
  // un rename sur le meme systeme de fichiers est atomique.
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, DB_PATH);

  // db.export() REMET `foreign_keys` a 0 sur la connexion vivante. Mesure :
  // ouverture 0 -> pragma ON 1 -> migrations 1 -> apres export 0. Comme la
  // premiere sauvegarde a lieu des la fin d'initDatabase(), les cles etrangeres
  // n'etaient appliquees que pendant la migration, et decoratives ensuite —
  // c'est-a-dire exactement l'etat que l'activation devait supprimer. Le pragma
  // est donc repose apres chaque export.
  db.run('PRAGMA foreign_keys = ON');
}
