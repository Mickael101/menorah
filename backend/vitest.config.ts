import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Base de test isolee : ne doit JAMAIS pointer vers backend/db/.
    // storage.ts lit DATA_DIR au chargement du module, donc la variable
    // doit etre posee avant l'evaluation des imports — c'est ce que fait
    // le champ env de Vitest.
    env: {
      DATA_DIR: path.resolve(__dirname, '.tmp-test-data'),
      NODE_ENV: 'test'
    },
    // sql.js charge un wasm : laisser de la marge au premier demarrage
    testTimeout: 20000,
    hookTimeout: 20000,
    // Les tests de securite mutent process.env (ADMIN_TOKEN, NODE_ENV).
    // La parallelisation des fichiers rendrait la suite instable au hasard.
    fileParallelism: false
  }
});
