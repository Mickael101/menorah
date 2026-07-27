import path from 'path';

// C10 : une VRAIE frontiere de repertoire, pas un prefixe de chaine.
// `filePath.startsWith(dir)` acceptait `path.join(dir, '../audio-evil/x')`, qui
// commence bien par `dir` mais en sort. path.relative repond a la question
// juste — « pour aller de dir a target, faut-il remonter ? » — et rejette la
// remontee (`..`), le chemin absolu, et la cible egale au dossier lui-meme.
export function isInside(dir: string, target: string): boolean {
  const rel = path.relative(dir, target);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}
