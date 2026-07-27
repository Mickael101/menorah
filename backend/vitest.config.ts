import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Repart d'une base vide a chaque suite (voir le fichier pour le pourquoi).
    globalSetup: ['./tests/helpers/global-setup.ts'],
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
    fileParallelism: false,
    // Processus plutot que threads. Observe une execution sur trois sur cette
    // machine : « Worker exited unexpectedly » (tinypool), un fichier de tests
    // ENTIER perdu, et un resume qui se lit comme vert — « 8 passed (9) »,
    // « 53 passed (61) », sans une seule ligne FAIL. Le fichier perdu etait
    // celui qui garde les cinq ecrans publics. Le code de sortie valait bien 1,
    // mais le resume trompe l'oeil, et un gate qu'on lit de travers ne protege
    // rien. Les processus isolent mieux les modules natifs, dont le wasm de
    // sql.js.
    pool: 'forks',
    // UN SEUL fork, reutilise pour toute la suite. Le 2026-07-28, sous la charge
    // de plusieurs sessions d'agents concurrentes, `forks` seul crashait encore
    // un worker par-ci par-la (meme symptome trompeur : « 186 passed (188) »,
    // 1 error, zero FAIL). Comme fileParallelism est deja false, un fork par
    // fichier n'apportait AUCUN parallelisme — seulement 25 spawns et 25
    // rechargements du wasm sql.js, autant d'occasions de mourir sous contention.
    // singleFork supprime les spawns mid-run (donc le faux-vert) ET divise la
    // duree par ~3 (un seul chargement wasm : ~10 s au lieu de ~31 s).
    poolOptions: { forks: { singleFork: true } }
  }
});
