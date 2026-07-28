import {
  DEFAULT_DISPLAY_SETTINGS,
  DEFAULT_DISPLAY_TEXTS,
  DEFAULT_ADMIN_BRANDING,
  DEFAULT_PLEDGE_TEXTS,
  DEFAULT_PLEDGE_REQUIRED_FIELDS,
  DEFAULT_THEME_PALETTES,
  DISPLAY_THEME_IDS,
  DISPLAY_VISUAL_MODES,
  type DisplaySettings,
  type DisplayThemeId,
  type DisplayThemePalette,
  type DisplayVisualMode
} from '../composables/useDonations';

// 'Heebo' figure dans CHAQUE pile de polices, juste apres la police latine du
// theme. Le repli CSS se fait glyphe par glyphe : le latin garde la police du
// theme, et chaque caractere hebreu — absent d'Inter, de Poppins et de Georgia —
// descend sur Heebo au lieu de tomber sur un repli systeme. Ne pas retirer sans
// verifier /display avec des noms de donateurs hebreux : ce sont eux, et non les
// titres, qui constituent le contenu principal de l'ecran.
export interface DisplayThemeDefinition {
  id: DisplayThemeId;
  name: string;
  shortName: string;
  description: string;
  mood: string;
  surface: string;
  surfaceStrong: string;
  plateSurface: string;
  plateBorder: string;
  visualBackdrop: string;
  fontBody: string;
  fontDisplay: string;
  radius: string;
  tracking: string;
}

export const DISPLAY_THEMES: DisplayThemeDefinition[] = [
  {
    id: 'premium',
    name: 'Gala premium',
    shortName: 'Premium',
    description: 'Bleu nuit, or chaud et surfaces raffinées.',
    mood: 'Élégant',
    surface: 'rgba(12, 15, 33, 0.76)',
    surfaceStrong: 'rgba(9, 12, 28, 0.94)',
    plateSurface: 'linear-gradient(135deg, rgba(30, 33, 49, 0.98), rgba(11, 13, 27, 0.98))',
    plateBorder: 'rgba(255, 255, 255, 0.12)',
    visualBackdrop: 'radial-gradient(circle, color-mix(in srgb, var(--header-text-color) 16%, transparent), transparent 68%)',
    fontBody: "'Inter', 'Heebo', 'Segoe UI', sans-serif",
    fontDisplay: "'Poppins', 'Heebo', 'Segoe UI', sans-serif",
    radius: '18px',
    tracking: '0.08em'
  },
  {
    id: 'modern',
    name: 'Show moderne',
    shortName: 'Moderne',
    description: 'Bleu électrique, contraste net et énergie de plateau.',
    mood: 'Dynamique',
    surface: 'rgba(3, 25, 36, 0.78)',
    surfaceStrong: 'rgba(2, 18, 28, 0.96)',
    plateSurface: 'linear-gradient(105deg, rgba(7, 34, 46, 0.98), rgba(3, 20, 31, 0.98))',
    plateBorder: 'color-mix(in srgb, var(--chart-primary-color) 30%, transparent)',
    visualBackdrop: 'radial-gradient(circle, color-mix(in srgb, var(--chart-primary-color) 18%, transparent), transparent 66%)',
    fontBody: "'Inter', 'Heebo', 'Segoe UI', sans-serif",
    fontDisplay: "'Inter', 'Heebo', 'Segoe UI', sans-serif",
    radius: '10px',
    tracking: '0.14em'
  },
  {
    id: 'ceremonial',
    name: 'Cérémonial',
    shortName: 'Cérémonial',
    description: 'Bordeaux profond, or ancien et présence solennelle.',
    mood: 'Prestigieux',
    surface: 'rgba(38, 12, 17, 0.78)',
    surfaceStrong: 'rgba(29, 8, 13, 0.96)',
    plateSurface: 'linear-gradient(135deg, rgba(60, 20, 28, 0.98), rgba(28, 9, 14, 0.98))',
    plateBorder: 'color-mix(in srgb, var(--header-text-color) 26%, transparent)',
    visualBackdrop: 'radial-gradient(circle, color-mix(in srgb, var(--header-text-color) 14%, transparent), transparent 68%)',
    fontBody: "Georgia, 'Heebo', 'Times New Roman', serif",
    fontDisplay: "Georgia, 'Heebo', 'Times New Roman', serif",
    radius: '6px',
    tracking: '0.1em'
  },
  {
    id: 'royal',
    name: 'Pourpre royal',
    shortName: 'Royal',
    description: 'Pourpre profond, or clair et allure de grande soirée.',
    mood: 'Majestueux',
    surface: 'rgba(28, 12, 42, 0.78)',
    surfaceStrong: 'rgba(20, 8, 31, 0.95)',
    plateSurface: 'linear-gradient(135deg, rgba(48, 22, 68, 0.98), rgba(20, 8, 31, 0.98))',
    plateBorder: 'color-mix(in srgb, var(--header-text-color) 24%, transparent)',
    visualBackdrop: 'radial-gradient(circle, color-mix(in srgb, var(--chart-primary-color) 18%, transparent), transparent 68%)',
    fontBody: "'Inter', 'Heebo', 'Segoe UI', sans-serif",
    fontDisplay: "'Poppins', 'Heebo', 'Segoe UI', sans-serif",
    radius: '16px',
    tracking: '0.09em'
  },
  {
    id: 'emerald',
    name: 'Vert émeraude',
    shortName: 'Émeraude',
    description: 'Vert forêt, or doux et atmosphère apaisée.',
    mood: 'Serein',
    surface: 'rgba(6, 32, 22, 0.78)',
    surfaceStrong: 'rgba(3, 22, 15, 0.95)',
    plateSurface: 'linear-gradient(135deg, rgba(10, 46, 32, 0.98), rgba(3, 22, 15, 0.98))',
    plateBorder: 'color-mix(in srgb, var(--chart-primary-color) 26%, transparent)',
    visualBackdrop: 'radial-gradient(circle, color-mix(in srgb, var(--chart-primary-color) 16%, transparent), transparent 66%)',
    fontBody: "'Inter', 'Heebo', 'Segoe UI', sans-serif",
    fontDisplay: "'Poppins', 'Heebo', 'Segoe UI', sans-serif",
    radius: '14px',
    tracking: '0.08em'
  },
  {
    // Seul theme CLAIR de la liste : utile quand la salle est tres eclairee
    // en journee, ou l'ecran d'un fond sombre devient gris et delave.
    id: 'ivory',
    name: 'Ivoire clair',
    shortName: 'Ivoire',
    description: 'Fond clair, or antique et texte sombre. Pour une salle très éclairée.',
    mood: 'Lumineux',
    surface: 'rgba(255, 255, 255, 0.82)',
    surfaceStrong: 'rgba(255, 255, 255, 0.95)',
    plateSurface: 'linear-gradient(135deg, #FFFFFF, #F2EADA)',
    plateBorder: 'rgba(34, 28, 16, 0.14)',
    visualBackdrop: 'radial-gradient(circle, color-mix(in srgb, var(--header-text-color) 14%, transparent), transparent 70%)',
    fontBody: "'Inter', 'Heebo', 'Segoe UI', sans-serif",
    fontDisplay: "'Poppins', 'Heebo', 'Segoe UI', sans-serif",
    radius: '12px',
    tracking: '0.06em'
  },
  {
    id: 'midnight',
    name: 'Nuit platine',
    shortName: 'Platine',
    description: 'Noir profond, argent et sobriété absolue. Sans or.',
    mood: 'Épuré',
    surface: 'rgba(10, 10, 12, 0.8)',
    surfaceStrong: 'rgba(4, 4, 6, 0.96)',
    plateSurface: 'linear-gradient(135deg, rgba(22, 22, 26, 0.98), rgba(6, 6, 8, 0.98))',
    plateBorder: 'rgba(255, 255, 255, 0.14)',
    visualBackdrop: 'radial-gradient(circle, rgba(255, 255, 255, 0.08), transparent 66%)',
    fontBody: "'Inter', 'Heebo', 'Segoe UI', sans-serif",
    fontDisplay: "'Inter', 'Heebo', 'Segoe UI', sans-serif",
    radius: '4px',
    tracking: '0.16em'
  }
];

export const DISPLAY_THEME_BY_ID = Object.fromEntries(
  DISPLAY_THEMES.map(theme => [theme.id, theme])
) as Record<DisplayThemeId, DisplayThemeDefinition>;

function isThemeId(value: unknown): value is DisplayThemeId {
  return typeof value === 'string' && DISPLAY_THEME_IDS.includes(value as DisplayThemeId);
}

export function cloneDisplaySettings(settings?: Partial<DisplaySettings>): DisplaySettings {
  const source = settings ?? DEFAULT_DISPLAY_SETTINGS;
  const theme = isThemeId(source.theme) ? source.theme : 'premium';
  const visualMode: DisplayVisualMode = DISPLAY_VISUAL_MODES.includes(source.visualMode as DisplayVisualMode)
    ? source.visualMode as DisplayVisualMode
    : 'none';
  const customSvgUrl = typeof source.customSvgUrl === 'string' ? source.customSvgUrl : null;
  const hasStoredPalettes = source.themePalettes && typeof source.themePalettes === 'object';
  const themePalettes = structuredClone(DEFAULT_THEME_PALETTES);

  for (const themeId of DISPLAY_THEME_IDS) {
    const storedPalette = hasStoredPalettes ? source.themePalettes?.[themeId] : undefined;
    themePalettes[themeId] = {
      ...themePalettes[themeId],
      ...(storedPalette ?? {})
    };
  }

  if (!hasStoredPalettes) {
    themePalettes.premium = {
      ...themePalettes.premium,
      ...pickLegacyPalette(source)
    };
  }

  return {
    ...DEFAULT_DISPLAY_SETTINGS,
    ...source,
    theme,
    visualMode,
    customSvgUrl,
    texts: {
      ...DEFAULT_DISPLAY_TEXTS,
      ...(source.texts ?? {})
    },
    adminBranding: {
      fr: { ...DEFAULT_ADMIN_BRANDING.fr, ...(source.adminBranding?.fr ?? {}) },
      en: { ...DEFAULT_ADMIN_BRANDING.en, ...(source.adminBranding?.en ?? {}) },
      he: { ...DEFAULT_ADMIN_BRANDING.he, ...(source.adminBranding?.he ?? {}) }
    },
    pledgeTexts: {
      fr: { ...DEFAULT_PLEDGE_TEXTS.fr, ...(source.pledgeTexts?.fr ?? {}) },
      en: { ...DEFAULT_PLEDGE_TEXTS.en, ...(source.pledgeTexts?.en ?? {}) },
      he: { ...DEFAULT_PLEDGE_TEXTS.he, ...(source.pledgeTexts?.he ?? {}) }
    },
    pledgeRequiredFields: {
      ...DEFAULT_PLEDGE_REQUIRED_FIELDS,
      ...(source.pledgeRequiredFields ?? {})
    },
    // Copie PROFONDE : le spread de `source` plus haut recopierait le tableau
    // par reference, et l'edition admin mutait alors l'etat partage (isDirty
    // toujours faux). Chaque regle est recopiee objet par objet.
    celebrations: Array.isArray(source.celebrations)
      ? source.celebrations.map((rule) => ({ ...rule }))
      : [],
    themePalettes,
    ...themePalettes[theme]
  };
}

function pickLegacyPalette(settings: Partial<DisplaySettings>): Partial<DisplayThemePalette> {
  const keys: (keyof DisplayThemePalette)[] = [
    'backgroundColor', 'backgroundImage', 'plateColorGold', 'plateColorDiamond',
    'plateColorBronze', 'plateTextColor', 'headerTextColor', 'statsTextColor',
    'chartPrimaryColor', 'chartSecondaryColor'
  ];
  const palette: Partial<DisplayThemePalette> = {};

  for (const key of keys) {
    const value = settings[key];
    if (value !== undefined) {
      (palette as Record<string, unknown>)[key] = value;
    }
  }

  return palette;
}

export function getActiveThemePalette(settings: DisplaySettings): DisplayThemePalette {
  return settings.themePalettes?.[settings.theme]
    ?? DEFAULT_THEME_PALETTES[settings.theme]
    ?? DEFAULT_THEME_PALETTES.premium;
}

export function getDisplayThemeStyles(settings: DisplaySettings): Record<string, string> {
  const palette = getActiveThemePalette(settings);
  const theme = DISPLAY_THEME_BY_ID[settings.theme] ?? DISPLAY_THEME_BY_ID.premium;

  return {
    '--bg-color': palette.backgroundColor,
    '--bg-image': palette.backgroundImage ? `url(${palette.backgroundImage})` : 'none',
    '--header-text-color': palette.headerTextColor,
    '--stats-text-color': palette.statsTextColor,
    '--chart-primary-color': palette.chartPrimaryColor,
    '--chart-secondary-color': palette.chartSecondaryColor,
    '--plate-gold': palette.plateColorGold,
    '--plate-diamond': palette.plateColorDiamond,
    '--plate-bronze': palette.plateColorBronze,
    '--plate-text': palette.plateTextColor,
    '--theme-surface': theme.surface,
    '--theme-surface-strong': theme.surfaceStrong,
    '--theme-plate-surface': theme.plateSurface,
    '--theme-plate-border': theme.plateBorder,
    '--theme-visual-backdrop': theme.visualBackdrop,
    '--theme-font-body': theme.fontBody,
    '--theme-font-display': theme.fontDisplay,
    '--theme-radius': theme.radius,
    '--theme-tracking': theme.tracking
  };
}

// --- Ajout pur pour la page publique /don (DonorPledgePage) ---
// Rien au-dessus n'est modifie : ces exports s'ajoutent au patron existant.

// Luminance relative WCAG d'une couleur hex (#RGB ou #RRGGBB).
function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean;
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = channel(parseInt(full.slice(0, 2), 16));
  const g = channel(parseInt(full.slice(2, 4), 16));
  const b = channel(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Texte lisible (fonce ou clair) a poser SUR une surface d'accent PLEINE (CTA,
// montant selectionne). Le choix suit la luminance de l'accent : le point de
// bascule noir/blanc (avec ces deux extremes) est a ~0.19. Verifie AA (>= 4.5)
// pour les 7 accents livres ; renvoie du blanc si l'admin definit un accent
// reellement sombre via themePalettes. Voir la matrice dans le rapport de session.
export function getReadableTextOn(backgroundHex: string): string {
  return relativeLuminance(backgroundHex) > 0.18 ? '#0B0B12' : '#FFFFFF';
}

// Variables du theme de la soiree pour /don : identiques a celles des ecrans de
// salle (getDisplayThemeStyles), plus la couleur de texte a contraste garanti sur
// les surfaces d'accent pleines. La page tire ainsi fond/texte/accents du meme
// endroit que les displays (Personnalisation -> Theme et couleurs).
export function getPledgeThemeStyles(settings: DisplaySettings): Record<string, string> {
  const palette = getActiveThemePalette(settings);
  return {
    ...getDisplayThemeStyles(settings),
    '--accent-contrast-text': getReadableTextOn(palette.chartPrimaryColor)
  };
}

export function resetThemePalette(
  settings: DisplaySettings,
  themeId: DisplayThemeId
): DisplaySettings {
  const next = cloneDisplaySettings(settings);
  next.themePalettes[themeId] = structuredClone(DEFAULT_THEME_PALETTES[themeId]);
  return {
    ...next,
    ...(next.theme === themeId ? next.themePalettes[themeId] : {})
  };
}
