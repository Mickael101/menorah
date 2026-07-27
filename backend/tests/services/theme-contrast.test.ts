import { describe, it, expect } from 'vitest';
import {
  relativeLuminance,
  contrastRatio,
  meetsContrast,
  checkThemeContrast,
  BUILTIN_THEMES,
  TEXT_CONTRAST_MIN,
  GRAPHIC_CONTRAST_MIN,
  type ThemeTokens
} from '../../src/models/theme';

// Contraste AA calcule cote backend, seuils 4,5 (texte) / 3,0 (objet graphique).
// Aucun nombre magique dans les assertions : on reference LA constante exportee,
// sinon un test « vert » ne prouverait que sa propre copie du seuil.

const BASE: ThemeTokens = {
  base: 'midnight',
  backgroundColor: '#000000',
  backgroundImage: null,
  plateColorGold: '#FFFFFF',
  plateColorDiamond: '#FFFFFF',
  plateColorBronze: '#FFFFFF',
  plateTextColor: '#FFFFFF',
  headerTextColor: '#FFFFFF',
  statsTextColor: '#FFFFFF',
  chartPrimaryColor: '#FFFFFF',
  chartSecondaryColor: '#FFFFFF'
};

describe('luminance et ratio WCAG', () => {
  it('donne 21 entre noir et blanc, 1 entre deux couleurs egales', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5);
  });

  it('supporte la forme courte #rgb', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(relativeLuminance('#ffffff'), 6);
    expect(relativeLuminance('#000')).toBeCloseTo(relativeLuminance('#000000'), 6);
  });

  it('traite une couleur illisible comme une violation (ratio 1)', () => {
    expect(contrastRatio('rgba(0,0,0,0.4)', '#000000')).toBe(1);
  });
});

describe('frontiere de seuil INCLUSIVE', () => {
  it('accepte exactement au seuil, refuse juste en dessous', () => {
    expect(meetsContrast(TEXT_CONTRAST_MIN, TEXT_CONTRAST_MIN)).toBe(true);
    expect(meetsContrast(4.49, TEXT_CONTRAST_MIN)).toBe(false);
    expect(meetsContrast(GRAPHIC_CONTRAST_MIN, GRAPHIC_CONTRAST_MIN)).toBe(true);
    expect(meetsContrast(2.99, GRAPHIC_CONTRAST_MIN)).toBe(false);
  });

  it('cas limite couleur : #757575 sur #000 passe (4,56), #747474 refuse (4,49)', () => {
    // Verifie d'abord que ces couleurs encadrent bien 4,5, puis la decision.
    expect(contrastRatio('#757575', '#000000')).toBeGreaterThanOrEqual(TEXT_CONTRAST_MIN);
    expect(contrastRatio('#747474', '#000000')).toBeLessThan(TEXT_CONTRAST_MIN);

    const accepted = checkThemeContrast({ ...BASE, headerTextColor: '#757575' });
    expect(accepted.find((v) => v.pair === 'headerTextColor')).toBeUndefined();

    const refused = checkThemeContrast({ ...BASE, headerTextColor: '#747474' });
    const violation = refused.find((v) => v.pair === 'headerTextColor');
    expect(violation).toBeDefined();
    expect(violation?.required).toBe(TEXT_CONTRAST_MIN);
    expect(violation?.ratio).toBeLessThan(TEXT_CONTRAST_MIN);
  });
});

describe('checkThemeContrast', () => {
  it('ne signale rien sur un jeu de couleurs lisible', () => {
    expect(checkThemeContrast(BASE)).toEqual([]);
  });

  it('signale toutes les paires texte fautives sur un fond mal choisi', () => {
    // Texte gris pale sur fond blanc : les trois textes tombent sous 4,5.
    const bad: ThemeTokens = {
      ...BASE,
      backgroundColor: '#FFFFFF',
      headerTextColor: '#BBBBBB',
      statsTextColor: '#BBBBBB',
      plateTextColor: '#BBBBBB',
      chartPrimaryColor: '#111111'
    };
    const violations = checkThemeContrast(bad);
    const pairs = violations.map((v) => v.pair).sort();
    expect(pairs).toEqual(['headerTextColor', 'plateTextColor', 'statsTextColor']);
  });

  it('applique 3,0 (et non 4,5) a l objet graphique', () => {
    // chartPrimary a un ratio entre 3,0 et 4,5 : accepte comme graphique,
    // il aurait ete refuse comme texte.
    const tokens: ThemeTokens = { ...BASE, backgroundColor: '#000000', chartPrimaryColor: '#5c5c5c' };
    const ratio = contrastRatio('#5c5c5c', '#000000');
    expect(ratio).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST_MIN);
    expect(ratio).toBeLessThan(TEXT_CONTRAST_MIN);
    expect(checkThemeContrast(tokens).find((v) => v.pair === 'chartPrimaryColor')).toBeUndefined();
  });
});

describe('les sept themes integres passent le contraste', () => {
  it.each(BUILTIN_THEMES.map((t) => [t.name, t] as const))('%s', (_name, theme) => {
    expect(checkThemeContrast(theme.tokens)).toEqual([]);
  });
});
