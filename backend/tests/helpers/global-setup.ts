import fs from 'fs';
import path from 'path';

const TEST_DATA_DIR = path.resolve(__dirname, '../../.tmp-test-data');

// La base de test est un FICHIER, et rien ne le nettoyait : les dons d'un run
// precedent survivaient au suivant. fileParallelism: false protege process.env,
// pas le disque. Tout test qui compte des lignes ou affirme « une seule soiree
// active » etait donc instable selon l'historique de la machine.
export default function setup(): void {
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
}
