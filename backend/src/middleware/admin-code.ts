import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

// Hachage du code admin d'une soiree. Bibliotheque standard de Node
// (crypto.scryptSync) : AUCUNE dependance ajoutee, contrainte YAGNI du projet.
//
// Format stocke, auto-descriptif — les parametres voyagent avec l'empreinte,
// pour qu'un durcissement futur de N ne rende pas invérifiables les codes deja
// en base :
//
//   scrypt$<N>$<r>$<p>$<sel base64>$<empreinte base64>
//
// Le code en clair n'est JAMAIS ecrit en base, ni logue, ni renvoye par une
// route : seule sa transformation a sens unique circule.

// Cout memoire/CPU de scrypt. 16384 est la reference d'OWASP pour un usage
// interactif ; r et p suivent la meme reference. Changer N ici n'invalide pas
// les codes existants : leur propre N est relu depuis leur empreinte.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

// Un code en clair pour une nouvelle soiree. base64url : lisible, transmissible
// oralement sans ambiguite de casse hasardeuse, et sans caractere a echapper
// dans une URL. Renvoye UNE seule fois par la route de creation, jamais stocke.
export function generateAdminCode(): string {
  return randomBytes(9).toString('base64url');
}

export function hashAdminCode(code: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const derived = scryptSync(code, salt, KEY_LENGTH, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

// Comparaison en temps constant. Un code errone met le meme temps a etre refuse
// qu'un code correct, ce qui prive un attaquant du canal temporel.
export function verifyAdminCode(code: string, stored: string | null | undefined): boolean {
  if (!stored) {
    return false;
  }

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], 'base64');
    expected = Buffer.from(parts[5], 'base64');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) {
    return false;
  }

  let derived: Buffer;
  try {
    derived = scryptSync(code, salt, expected.length, { N: n, r, p });
  } catch {
    // scrypt refuse des parametres incoherents (N non puissance de 2, memoire
    // insuffisante) : une empreinte corrompue en base ne doit pas faire tomber
    // le serveur, elle doit simplement ne valider aucun code.
    return false;
  }

  // timingSafeEqual leve si les longueurs different ; on les a alignees via
  // expected.length, mais la garde reste par prudence.
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}
