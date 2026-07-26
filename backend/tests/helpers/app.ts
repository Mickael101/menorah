import type express from 'express';
import path from 'path';
import { createApp } from '../../src/app';
import { initDatabase } from '../../src/db/init';

const EXPECTED_DATA_DIR = path.resolve(__dirname, '../../.tmp-test-data');

// Garde-fou d'isolation.
//
// storage.ts resout le chemin de la base depuis DATA_DIR au chargement du
// module. Si DATA_DIR n'est pas pose, il retombe sur backend/db/donations.db,
// c'est-a-dire une VRAIE base. Les tests inserent des donnees : ecrire dedans
// polluerait des dons reels.
//
// DATA_DIR est pose par backend/vitest.config.ts — mais cette config n'est
// lue que si vitest est lance avec backend/ pour racine. Un `npx vitest`
// depuis le dossier parent resout un autre binaire, ignore la config, et
// l'isolation disparait silencieusement.
//
// Ce garde-fou rend l'isolation structurelle : il echoue bruyamment au lieu
// de laisser les tests ecrire dans une base reelle.
function assertIsolatedDatabase(): void {
  const dataDir = process.env.DATA_DIR;

  if (!dataDir) {
    throw new Error(
      'ISOLATION: DATA_DIR n est pas pose. Les tests ecriraient dans backend/db/donations.db.\n' +
      'Lancez la suite depuis backend/ : `cd backend && npm test`.'
    );
  }

  if (path.resolve(dataDir) !== EXPECTED_DATA_DIR) {
    throw new Error(
      `ISOLATION: DATA_DIR pointe vers ${path.resolve(dataDir)}\n` +
      `alors que les tests exigent ${EXPECTED_DATA_DIR}.\n` +
      'Lancez la suite depuis backend/ : `cd backend && npm test`.'
    );
  }
}

let cached: express.Express | null = null;

// Initialise la base de test une seule fois puis reutilise l'app.
// La base vit dans DATA_DIR (voir vitest.config.ts), jamais dans backend/db/.
export async function createTestApp(): Promise<express.Express> {
  assertIsolatedDatabase();

  if (!cached) {
    await initDatabase();
    cached = createApp();
  }
  return cached;
}
