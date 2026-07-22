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
    fontBody: "'Inter', 'Segoe UI', sans-serif",
    fontDisplay: "'Poppins', 'Segoe UI', sans-serif",
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
    fontBody: "'Inter', 'Segoe UI', sans-serif",
    fontDisplay: "'Inter', 'Segoe UI', sans-serif",
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
    fontBody: "Georgia, 'Times New Roman', serif",
    fontDisplay: "Georgia, 'Times New Roman', serif",
    radius: '6px',
    tracking: '0.1em'
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
