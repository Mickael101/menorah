import type express from 'express';
import { createApp } from '../../src/app';
import { initDatabase } from '../../src/db/init';

let cached: express.Express | null = null;

// Initialise la base de test une seule fois puis reutilise l'app.
// La base vit dans DATA_DIR (voir vitest.config.ts), jamais dans backend/db/.
export async function createTestApp(): Promise<express.Express> {
  if (!cached) {
    await initDatabase();
    cached = createApp();
  }
  return cached;
}
