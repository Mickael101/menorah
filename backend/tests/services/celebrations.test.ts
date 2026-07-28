import { describe, it, expect } from 'vitest';
import { normalizeDisplaySettings } from '../../src/models/config';
import { DEFAULT_DISPLAY_SETTINGS, CELEBRATION_RULES_MAX } from '../../src/models/types';

// Contrat des paliers de celebration (montant -> GIF). La normalisation est la
// seule porte d'entree vers la base (PUT /config passe par validateConfigUpdate
// qui passe par elle) : elle doit conserver les regles saines et eliminer tout
// le reste sans jeter — une config anterieure au champ doit continuer a vivre.
describe('normalizeDisplaySettings — celebrations', () => {
  const rule = (over: Record<string, unknown> = {}) => ({
    id: 'r1',
    minAmount: 18000,
    gifUrl: '/uploads/gifs/gif-123-456.gif',
    playOnDisplay: true,
    playOnPledge: false,
    ...over
  });

  it('vaut [] par defaut — configs anterieures sans le champ', () => {
    expect(normalizeDisplaySettings({}).celebrations).toEqual([]);
    expect(DEFAULT_DISPLAY_SETTINGS.celebrations).toEqual([]);
  });

  it('conserve une regle valide, montant arrondi a l entier', () => {
    const result = normalizeDisplaySettings({ celebrations: [rule({ minAmount: 18000.9 })] });
    expect(result.celebrations).toEqual([rule({ minAmount: 18000 })]);
  });

  it('rejette les URLs hors /uploads/gifs/ et les chemins composes', () => {
    const bad = [
      rule({ gifUrl: 'https://evil.example/x.gif' }),
      rule({ gifUrl: '/uploads/audio/son.mp3' }),
      rule({ gifUrl: '/uploads/gifs/../autre' }),
      rule({ gifUrl: '' }),
      rule({ gifUrl: 42 })
    ];
    expect(normalizeDisplaySettings({ celebrations: bad }).celebrations).toEqual([]);
  });

  it('rejette les montants non positifs ou non numeriques', () => {
    const bad = [
      rule({ minAmount: 0 }),
      rule({ minAmount: -5 }),
      rule({ minAmount: 'beaucoup' }),
      rule({ minAmount: Infinity })
    ];
    expect(normalizeDisplaySettings({ celebrations: bad }).celebrations).toEqual([]);
  });

  it('une seule regle par GIF : le doublon tombe, la premiere gagne', () => {
    const result = normalizeDisplaySettings({
      celebrations: [rule(), rule({ id: 'r2', minAmount: 36000 })]
    });
    expect(result.celebrations).toHaveLength(1);
    expect(result.celebrations[0].id).toBe('r1');
    expect(result.celebrations[0].minAmount).toBe(18000);
  });

  it('booleens par defaut (ecran oui, /don non) et id regenere si absent', () => {
    const result = normalizeDisplaySettings({
      celebrations: [{ minAmount: 500, gifUrl: '/uploads/gifs/g.gif' }]
    });
    expect(result.celebrations[0]).toMatchObject({
      playOnDisplay: true,
      playOnPledge: false
    });
    expect(result.celebrations[0].id).toBeTruthy();
  });

  it('plafonne le nombre de regles a CELEBRATION_RULES_MAX', () => {
    const many = Array.from({ length: CELEBRATION_RULES_MAX + 10 }, (_, i) =>
      rule({ id: `r${i}`, gifUrl: `/uploads/gifs/g${i}.gif` }));
    const result = normalizeDisplaySettings({ celebrations: many });
    expect(result.celebrations).toHaveLength(CELEBRATION_RULES_MAX);
  });

  it('celebrations non-tableau devient []', () => {
    expect(normalizeDisplaySettings({ celebrations: 'rien' }).celebrations).toEqual([]);
    expect(normalizeDisplaySettings({ celebrations: { gifUrl: 'x' } }).celebrations).toEqual([]);
  });
});
