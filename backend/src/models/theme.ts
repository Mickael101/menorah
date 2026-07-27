import {
  DisplayThemeId,
  DISPLAY_THEME_IDS,
  DisplayThemePalette,
  DEFAULT_THEME_PALETTES
} from './types';

// Un theme d'affichage = une FAMILLE structurelle (`base`, l'une des sept
// livrees avec l'application) dont le moteur de rendu tire surfaces, polices,
// arrondis et intensites, PLUS les couleurs de palette qui, elles, varient.
// Deux soirees portant les memes valeurs rendent donc a l'identique : c'est ce
// qui rend un theme exportable puis importable sans redeploiement.
//
// La structure n'est volontairement PAS stockee ici : le moteur de rendu
// (composants d'affichage, hors perimetre de cette tranche) la derive du `base`.
// Y recopier surfaces et polices creerait des donnees mortes que rien ne lit.
export interface ThemeTokens extends DisplayThemePalette {
  base: DisplayThemeId;
}

// Ce qu'une lecture de theme expose. Rien de secret n'y figure : un theme est,
// par nature, entierement public des qu'il est applique a un ecran de salle.
export interface ThemeRecord {
  id: number;
  // null => preset livre avec l'application, partage par toutes les soirees.
  // Non null => theme personnalise appartenant a une soiree.
  eventId: number | null;
  name: string;
  // Derive de eventId === null. Un builtin ne se supprime pas et ne s'edite pas ;
  // il se duplique. Expose explicitement pour que la galerie n'ait pas a
  // reconstruire la regle cote client.
  builtin: boolean;
  tokens: ThemeTokens;
  createdAt: string | null;
}

// Format en base (snake_case).
export interface ThemeRow {
  id: number;
  event_id: number | null;
  name: string;
  tokens_json: string;
  created_at: string | null;
}

// ---------------------------------------------------------------------------
// Contraste WCAG (formule officielle de luminance relative)
// ---------------------------------------------------------------------------

// Seuils AA : 4,5 pour le texte, 3,0 pour un objet graphique essentiel
// (WCAG 1.4.3 et 1.4.11). Exposes pour que les tests referencent LA constante,
// jamais un nombre recopie.
export const TEXT_CONTRAST_MIN = 4.5;
export const GRAPHIC_CONTRAST_MIN = 3.0;

const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// #rgb comme #rrggbb. Retourne null si la chaine n'est pas un hex : la
// verification de contraste ne peut se prononcer que sur une couleur qu'elle
// sait lire.
function parseHex(hex: string): [number, number, number] | null {
  if (typeof hex !== 'string' || !HEX_PATTERN.test(hex)) {
    return null;
  }
  let body = hex.slice(1);
  if (body.length === 3) {
    body = body.split('').map((c) => c + c).join('');
  }
  const n = parseInt(body, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Luminance relative selon WCAG. -1 si la couleur est illisible (non hex) :
// l'appelant en fait une violation plutot que de calculer sur du vide.
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) {
    return -1;
  }
  const [r, g, b] = rgb;
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

// Ratio de contraste (1 a 21). Deux couleurs illisibles donneraient un ratio de
// 1, donc une violation : c'est le comportement voulu.
export function contrastRatio(foreground: string, background: string): number {
  const lf = relativeLuminance(foreground);
  const lb = relativeLuminance(background);
  if (lf < 0 || lb < 0) {
    return 1;
  }
  const hi = Math.max(lf, lb);
  const lo = Math.min(lf, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// Un ratio atteint-il son seuil ? Frontiere INCLUSIVE : 4,5 passe, 4,49 non.
// L'epsilon absorbe l'erreur de representation flottante pour qu'un ratio
// exactement egal au seuil ne soit jamais refuse par accident.
export function meetsContrast(ratio: number, minimum: number): boolean {
  return ratio >= minimum - 1e-9;
}

export interface ContrastViolation {
  pair: string;
  foreground: string;
  background: string;
  ratio: number;
  required: number;
}

// Les paires verifiees. Le fond commun est backgroundColor.
//   - Texte (>= 4,5) : les trois couleurs de texte reellement posees sur le
//     fond de l'ecran.
//   - Objet graphique (>= 3,0) : la couleur primaire du graphique, qui porte la
//     courbe/jauge de progression. La couleur SECONDAIRE en est le compagnon de
//     degrade (remplissage decoratif) : elle n'est pas un objet graphique
//     essentiel au sens de WCAG 1.4.11, et cinq des sept presets livres la
//     posent volontairement sous 3,0. La verifier casserait des themes valides.
const TEXT_KEYS: (keyof DisplayThemePalette)[] = [
  'headerTextColor',
  'statsTextColor',
  'plateTextColor'
];
const GRAPHIC_KEYS: (keyof DisplayThemePalette)[] = ['chartPrimaryColor'];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function checkThemeContrast(tokens: ThemeTokens): ContrastViolation[] {
  const bg = tokens.backgroundColor;
  const violations: ContrastViolation[] = [];

  const test = (key: keyof DisplayThemePalette, required: number): void => {
    const fg = tokens[key] as string;
    const ratio = contrastRatio(fg, bg);
    if (!meetsContrast(ratio, required)) {
      violations.push({ pair: key, foreground: fg, background: bg, ratio: round2(ratio), required });
    }
  };

  for (const key of TEXT_KEYS) {
    test(key, TEXT_CONTRAST_MIN);
  }
  for (const key of GRAPHIC_KEYS) {
    test(key, GRAPHIC_CONTRAST_MIN);
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Validation de schema
// ---------------------------------------------------------------------------

const COLOR_KEYS: (keyof DisplayThemePalette)[] = [
  'backgroundColor',
  'plateColorGold',
  'plateColorDiamond',
  'plateColorBronze',
  'plateTextColor',
  'headerTextColor',
  'statsTextColor',
  'chartPrimaryColor',
  'chartSecondaryColor'
];

function isThemeBase(value: unknown): value is DisplayThemeId {
  return typeof value === 'string' && (DISPLAY_THEME_IDS as readonly string[]).includes(value);
}

// Valide la FORME d'un jeu de tokens (schema), independamment du contraste.
// Une forme invalide est une requete malformee (400) ; un contraste insuffisant
// est une requete comprise mais refusee (422). Les deux ne se melangent pas.
export function validateThemeTokens(data: unknown): ThemeTokens {
  const body = (data ?? {}) as Record<string, unknown>;

  if (!isThemeBase(body.base)) {
    throw new Error(`base must be one of ${DISPLAY_THEME_IDS.join(', ')}`);
  }

  const tokens = { base: body.base } as ThemeTokens;

  for (const key of COLOR_KEYS) {
    const value = body[key];
    if (typeof value !== 'string' || !HEX_PATTERN.test(value)) {
      throw new Error(`${key} must be a hex color (#rgb or #rrggbb)`);
    }
    (tokens as Record<string, unknown>)[key] = value;
  }

  const image = body.backgroundImage;
  if (image === undefined || image === null) {
    tokens.backgroundImage = null;
  } else if (typeof image === 'string') {
    tokens.backgroundImage = image.slice(0, 500);
  } else {
    throw new Error('backgroundImage must be a string URL or null');
  }

  return tokens;
}

function validateName(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('name is required');
  }
  return value.trim().slice(0, 80);
}

export interface CreateThemeInput {
  eventId: number;
  name: string;
  tokens: ThemeTokens;
}

export function validateCreateTheme(data: unknown): CreateThemeInput {
  const body = (data ?? {}) as Record<string, unknown>;
  const eventId = Number(body.eventId);
  if (!Number.isInteger(eventId)) {
    throw new Error('eventId is required');
  }
  return {
    eventId,
    name: validateName(body.name),
    tokens: validateThemeTokens(body.tokens)
  };
}

export interface UpdateThemeInput {
  name?: string;
  tokens?: ThemeTokens;
}

export function validateUpdateTheme(data: unknown): UpdateThemeInput {
  const body = (data ?? {}) as Record<string, unknown>;
  const patch: UpdateThemeInput = {};
  if (body.name !== undefined) {
    patch.name = validateName(body.name);
  }
  if (body.tokens !== undefined) {
    patch.tokens = validateThemeTokens(body.tokens);
  }
  return patch;
}

export function rowToTheme(row: ThemeRow): ThemeRecord {
  let tokens: ThemeTokens;
  try {
    tokens = JSON.parse(row.tokens_json) as ThemeTokens;
  } catch {
    // Un theme illisible en base ne doit pas faire tomber toute la galerie : on
    // le rabat sur le preset premium plutot que de lever. La cause reelle est
    // journalisee par l'appelant s'il le souhaite.
    tokens = { base: 'premium', ...DEFAULT_THEME_PALETTES.premium };
  }
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    builtin: row.event_id === null,
    tokens,
    createdAt: row.created_at
  };
}

// ---------------------------------------------------------------------------
// Themes integres, seedes en base par la migration
// ---------------------------------------------------------------------------

// Noms d'affichage repris de frontend/src/theme/displayThemes.ts (source
// canonique cote client). Stockes comme libelle de repli : la galerie affiche
// le libelle traduit pour un builtin, ce nom sert quand la traduction manque.
const BUILTIN_THEME_NAMES: Record<DisplayThemeId, string> = {
  premium: 'Gala premium',
  modern: 'Show moderne',
  ceremonial: 'Cérémonial',
  royal: 'Pourpre royal',
  emerald: 'Vert émeraude',
  ivory: 'Ivoire clair',
  midnight: 'Nuit platine'
};

export interface BuiltinThemeSeed {
  name: string;
  tokens: ThemeTokens;
}

// Construits a partir de DEFAULT_THEME_PALETTES (la meme source que le moteur de
// rendu) : aucune couleur n'est recopiee a la main, donc aucune ne peut diverger.
export const BUILTIN_THEMES: BuiltinThemeSeed[] = DISPLAY_THEME_IDS.map((id) => ({
  name: BUILTIN_THEME_NAMES[id],
  tokens: { base: id, ...DEFAULT_THEME_PALETTES[id] }
}));
