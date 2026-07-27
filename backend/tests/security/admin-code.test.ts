import { describe, it, expect } from 'vitest';
import { hashAdminCode, verifyAdminCode } from '../../src/middleware/admin-code';

// Le hachage du code de soiree n'a besoin d'aucune base : c'est une pure
// transformation. On verifie qu'il tient ses trois promesses — round-trip,
// sel aleatoire, robustesse au format corrompu — sans jamais faire circuler le
// code en clair au-dela de l'appel.

describe('hachage du code admin de soiree', () => {
  it('valide un code contre sa propre empreinte', () => {
    const hash = hashAdminCode('code-de-la-soiree');

    expect(verifyAdminCode('code-de-la-soiree', hash)).toBe(true);
    expect(verifyAdminCode('mauvais-code', hash)).toBe(false);
  });

  it('produit une empreinte au format auto-descriptif, sans le code en clair', () => {
    const hash = hashAdminCode('secret-lisible');

    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    // Le code en clair ne doit apparaitre nulle part dans l'empreinte.
    expect(hash).not.toContain('secret-lisible');
  });

  it('tire un sel different a chaque hachage du meme code', () => {
    const a = hashAdminCode('meme-code');
    const b = hashAdminCode('meme-code');

    expect(a).not.toBe(b);
    // Mais les deux empreintes valident le meme code.
    expect(verifyAdminCode('meme-code', a)).toBe(true);
    expect(verifyAdminCode('meme-code', b)).toBe(true);
  });

  it('ne valide rien contre une empreinte absente ou corrompue', () => {
    expect(verifyAdminCode('x', null)).toBe(false);
    expect(verifyAdminCode('x', undefined)).toBe(false);
    expect(verifyAdminCode('x', '')).toBe(false);
    expect(verifyAdminCode('x', 'pas-un-format-scrypt')).toBe(false);
    expect(verifyAdminCode('x', 'scrypt$16384$8$1$sel-invalide')).toBe(false);
    expect(verifyAdminCode('x', 'bcrypt$16384$8$1$c2Vs$ZW1w')).toBe(false);
  });
});
