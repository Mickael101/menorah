import { adminFetch } from '../composables/useAdminAuth';
import type { DisplayThemeId, DisplayThemePalette } from '../composables/useDonations';
import { DISPLAY_THEME_IDS } from '../composables/useDonations';

// Client de l'API du moteur de themes (C1). Le backend est la source de verite ;
// ce module ne fait que dialoguer avec lui, PLUS une copie du calcul de
// contraste et de la validation de schema, necessaires cote client pour refuser
// un import illisible AVANT l'aller-retour reseau et pour avertir dans la
// galerie. Les seuils et les paires sont tenus identiques a models/theme.ts.

const API_BASE = import.meta.env.VITE_API_URL || '';

// Un theme = famille structurelle (base) + les dix couleurs de palette. Le
// moteur de rendu (composants d'affichage) tire la structure du `base`.
export interface ThemeTokens extends DisplayThemePalette {
  base: DisplayThemeId;
}

export interface ThemeRecord {
  id: number;
  eventId: number | null;
  name: string;
  builtin: boolean;
  tokens: ThemeTokens;
  createdAt: string | null;
}

// ---------------------------------------------------------------------------
// Contraste WCAG (miroir de backend/src/models/theme.ts)
// ---------------------------------------------------------------------------

export const TEXT_CONTRAST_MIN = 4.5;
export const GRAPHIC_CONTRAST_MIN = 3.0;

const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

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

export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) {
    return -1;
  }
  const [r, g, b] = rgb;
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

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

function meetsContrast(ratio: number, minimum: number): boolean {
  return ratio >= minimum - 1e-9;
}

export interface ContrastViolation {
  pair: string;
  foreground: string;
  background: string;
  ratio: number;
  required: number;
}

const TEXT_KEYS: (keyof DisplayThemePalette)[] = ['headerTextColor', 'statsTextColor', 'plateTextColor'];
const GRAPHIC_KEYS: (keyof DisplayThemePalette)[] = ['chartPrimaryColor'];

export function checkThemeContrast(tokens: ThemeTokens): ContrastViolation[] {
  const bg = tokens.backgroundColor;
  const violations: ContrastViolation[] = [];
  const test = (key: keyof DisplayThemePalette, required: number): void => {
    const fg = tokens[key] as string;
    const ratio = contrastRatio(fg, bg);
    if (!meetsContrast(ratio, required)) {
      violations.push({
        pair: key,
        foreground: fg,
        background: bg,
        ratio: Math.round(ratio * 100) / 100,
        required
      });
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
// Validation de schema (import de JSON)
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

export function validateThemeTokens(data: unknown): ThemeTokens {
  const body = (data ?? {}) as Record<string, unknown>;
  if (typeof body.base !== 'string' || !(DISPLAY_THEME_IDS as readonly string[]).includes(body.base)) {
    throw new Error(`base doit valoir l'un de : ${DISPLAY_THEME_IDS.join(', ')}`);
  }
  const tokens = { base: body.base as DisplayThemeId } as ThemeTokens;
  for (const key of COLOR_KEYS) {
    const value = body[key];
    if (typeof value !== 'string' || !HEX_PATTERN.test(value)) {
      throw new Error(`${key} doit etre une couleur hex (#rgb ou #rrggbb)`);
    }
    (tokens as unknown as Record<string, unknown>)[key] = value;
  }
  const image = body.backgroundImage;
  if (image === undefined || image === null) {
    tokens.backgroundImage = null;
  } else if (typeof image === 'string') {
    tokens.backgroundImage = image.slice(0, 500);
  } else {
    throw new Error('backgroundImage doit etre une URL ou null');
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Appels reseau
// ---------------------------------------------------------------------------

export class ThemeApiError extends Error {
  status: number;
  violations?: ContrastViolation[];
  constructor(message: string, status: number, violations?: ContrastViolation[]) {
    super(message);
    this.name = 'ThemeApiError';
    this.status = status;
    this.violations = violations;
  }
}

async function toError(response: Response): Promise<ThemeApiError> {
  let body: { error?: string; violations?: ContrastViolation[] } = {};
  try {
    body = await response.json();
  } catch {
    // Corps non-JSON : le statut suffit a construire l'erreur.
  }
  return new ThemeApiError(body.error || `HTTP ${response.status}`, response.status, body.violations);
}

// Identifiant de la soiree active (route publique). Le panneau d'administration
// travaille sur la soiree active tant que le routage /e/:slug (front FE) n'est
// pas cable ; on la resout ici plutot que d'inventer un eventId.
export async function resolveActiveEventId(): Promise<number | null> {
  const response = await fetch(`${API_BASE}/api/events/active`);
  if (!response.ok) {
    return null;
  }
  const body = await response.json();
  return body?.event?.id ?? null;
}

export async function fetchThemes(eventId: number | null): Promise<ThemeRecord[]> {
  const url = eventId === null
    ? `${API_BASE}/api/themes`
    : `${API_BASE}/api/themes?eventId=${eventId}`;
  const response = await adminFetch(url);
  if (!response.ok) {
    throw await toError(response);
  }
  const body = await response.json();
  return body.themes as ThemeRecord[];
}

export async function fetchAppliedTheme(eventId: number): Promise<ThemeRecord | null> {
  const response = await fetch(`${API_BASE}/api/events/${eventId}/theme`);
  if (!response.ok) {
    return null;
  }
  const body = await response.json();
  return (body.theme as ThemeRecord | null) ?? null;
}

export async function createTheme(eventId: number, name: string, tokens: ThemeTokens): Promise<ThemeRecord> {
  const response = await adminFetch(`${API_BASE}/api/themes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, name, tokens })
  });
  if (!response.ok) {
    throw await toError(response);
  }
  return (await response.json()).theme as ThemeRecord;
}

export async function updateTheme(
  id: number,
  patch: { name?: string; tokens?: ThemeTokens }
): Promise<ThemeRecord> {
  const response = await adminFetch(`${API_BASE}/api/themes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
  if (!response.ok) {
    throw await toError(response);
  }
  return (await response.json()).theme as ThemeRecord;
}

export async function deleteTheme(id: number): Promise<void> {
  const response = await adminFetch(`${API_BASE}/api/themes/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw await toError(response);
  }
}

export async function applyTheme(eventId: number, themeId: number): Promise<ThemeRecord> {
  const response = await adminFetch(`${API_BASE}/api/events/${eventId}/theme`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ themeId })
  });
  if (!response.ok) {
    throw await toError(response);
  }
  return (await response.json()).theme as ThemeRecord;
}

// ---------------------------------------------------------------------------
// Ponts avec le modele de reglages existant (displaySettings)
// ---------------------------------------------------------------------------

// Extrait les dix couleurs de palette d'un jeu de tokens.
export function tokensToPalette(tokens: ThemeTokens): DisplayThemePalette {
  return {
    backgroundColor: tokens.backgroundColor,
    backgroundImage: tokens.backgroundImage,
    plateColorGold: tokens.plateColorGold,
    plateColorDiamond: tokens.plateColorDiamond,
    plateColorBronze: tokens.plateColorBronze,
    plateTextColor: tokens.plateTextColor,
    headerTextColor: tokens.headerTextColor,
    statsTextColor: tokens.statsTextColor,
    chartPrimaryColor: tokens.chartPrimaryColor,
    chartSecondaryColor: tokens.chartSecondaryColor
  };
}

// Assemble des tokens depuis une base et une palette (pour dupliquer/enregistrer
// le theme en cours d'edition).
export function paletteToTokens(base: DisplayThemeId, palette: DisplayThemePalette): ThemeTokens {
  return { base, ...palette };
}
