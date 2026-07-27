import { describe, it, expect } from 'vitest';
import path from 'path';
import { isInside } from '../../src/middleware/path-boundary';

// C10 : la frontiere de repertoire doit tenir la ou le prefixe de chaine cedait.
describe('frontiere de repertoire (isInside)', () => {
  const dir = path.resolve('/data/uploads/audio');

  it('accepte un fichier reellement dans le dossier', () => {
    expect(isInside(dir, path.join(dir, 'audio-123.mp3'))).toBe(true);
  });

  it('rejette une remontee, meme si elle commence par le dossier', () => {
    // Le piege exact que startsWith laissait passer.
    expect(isInside(dir, path.join(dir, '../audio-evil/x.mp3'))).toBe(false);
    expect(isInside(dir, path.join(dir, '..', '..', 'etc', 'passwd'))).toBe(false);
  });

  it('rejette un chemin absolu hors du dossier', () => {
    expect(isInside(dir, path.resolve('/etc/passwd'))).toBe(false);
  });

  it('rejette le dossier lui-meme', () => {
    expect(isInside(dir, dir)).toBe(false);
  });

  it('rejette un dossier voisin dont le nom partage le prefixe', () => {
    // /data/uploads/audio-secret commence par /data/uploads/audio mais est
    // un autre dossier : le piege classique du startsWith.
    expect(isInside(dir, path.resolve('/data/uploads/audio-secret/x.mp3'))).toBe(false);
  });
});
