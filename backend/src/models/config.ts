import {
  Config,
  MenorahSegment,
  DisplaySettings,
  DisplayThemeId,
  DisplayThemePalette,
  DisplayVisualMode,
  DonationAnimationStyle,
  DisplayTextDirection,
  DisplayTextSettings,
  AdminBrandingSettings,
  PledgeTextsSettings,
  PledgePageCopy,
  PledgeRequiredFields,
  DEFAULT_DISPLAY_SETTINGS,
  DEFAULT_DISPLAY_TEXTS,
  DEFAULT_ADMIN_BRANDING,
  DEFAULT_PLEDGE_TEXTS,
  DEFAULT_PLEDGE_REQUIRED_FIELDS,
  DEFAULT_THEME_PALETTES,
  PLEDGE_FIELD_KEYS,
  ADMIN_BRANDING_LOCALES,
  DISPLAY_THEME_IDS,
  DISPLAY_VISUAL_MODES,
  DONATION_ANIMATION_STYLES,
  DISPLAY_TEXT_DIRECTIONS
} from './types';

// Database row format
export interface ConfigRow {
  id: number;
  goal_amount: number;
  preset_amounts: string; // JSON string
  menorah_segments: string; // JSON string
  display_settings: string; // JSON string
  updated_at: string;
}

// Convert database row to API format
export function rowToConfig(row: ConfigRow): Config {
  // Parse display settings with defaults fallback
  let displaySettings: DisplaySettings = { ...DEFAULT_DISPLAY_SETTINGS };
  try {
    const parsed = JSON.parse(row.display_settings || '{}');
    displaySettings = normalizeDisplaySettings(parsed);
  } catch (e) {
    // Use defaults if parsing fails
  }

  return {
    goalAmount: row.goal_amount,
    presetAmounts: JSON.parse(row.preset_amounts),
    menorahSegments: JSON.parse(row.menorah_segments),
    displaySettings
  };
}

// Validate config update
export function validateConfigUpdate(data: unknown): Partial<Config> {
  const req = data as Partial<Config>;
  const result: Partial<Config> = {};

  if (req.goalAmount !== undefined) {
    if (typeof req.goalAmount !== 'number' || req.goalAmount <= 0) {
      throw new Error('goalAmount must be a positive number');
    }
    result.goalAmount = Math.floor(req.goalAmount);
  }

  if (req.presetAmounts !== undefined) {
    if (!Array.isArray(req.presetAmounts)) {
      throw new Error('presetAmounts must be an array');
    }
    if (req.presetAmounts.some(a => typeof a !== 'number' || a <= 0)) {
      throw new Error('presetAmounts must contain positive numbers');
    }
    result.presetAmounts = req.presetAmounts.map(a => Math.floor(a));
  }

  if (req.menorahSegments !== undefined) {
    if (!Array.isArray(req.menorahSegments)) {
      throw new Error('menorahSegments must be an array');
    }
    result.menorahSegments = req.menorahSegments.map(validateSegment);
  }

  if (req.displaySettings !== undefined) {
    result.displaySettings = validateDisplaySettings(req.displaySettings);
  }

  return result;
}

// Validate display settings
function validateDisplaySettings(settings: unknown): DisplaySettings {
  return normalizeDisplaySettings(settings);
}

const COLOR_FIELDS: (keyof Omit<DisplayThemePalette, 'backgroundImage'>)[] = [
  'backgroundColor', 'plateColorGold', 'plateColorDiamond', 'plateColorBronze',
  'plateTextColor', 'headerTextColor', 'statsTextColor',
  'chartPrimaryColor', 'chartSecondaryColor'
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeDisplayTexts(value: unknown): DisplayTextSettings {
  const source = isRecord(value) ? value : {};
  const result = { ...DEFAULT_DISPLAY_TEXTS };

  for (const key of Object.keys(result) as (keyof DisplayTextSettings)[]) {
    const text = source[key];
    if (typeof text === 'string') {
      result[key] = text.slice(0, key === 'thankYouMessage' ? 240 : 100);
    }
  }

  return result;
}

function normalizeAdminBranding(value: unknown): AdminBrandingSettings {
  const source = isRecord(value) ? value : {};
  const result = structuredClone(DEFAULT_ADMIN_BRANDING);

  for (const locale of ADMIN_BRANDING_LOCALES) {
    const localizedSource = isRecord(source[locale]) ? source[locale] : {};
    const title = localizedSource.title;
    const subtitle = localizedSource.subtitle;

    if (typeof title === 'string') {
      result[locale].title = title.slice(0, 80);
    }
    if (typeof subtitle === 'string') {
      result[locale].subtitle = subtitle.slice(0, 160);
    }
  }

  return result;
}

function normalizePledgeTexts(value: unknown): PledgeTextsSettings {
  const source = isRecord(value) ? value : {};
  const result = structuredClone(DEFAULT_PLEDGE_TEXTS);

  for (const locale of ADMIN_BRANDING_LOCALES) {
    const localizedSource = isRecord(source[locale]) ? source[locale] : {};
    for (const key of Object.keys(result[locale]) as (keyof PledgePageCopy)[]) {
      const text = localizedSource[key];
      if (typeof text === 'string') {
        result[locale][key] = text.slice(0, key === 'subtitle' || key === 'thankMessage' ? 300 : 120);
      }
    }
  }

  return result;
}

function normalizePledgeRequiredFields(value: unknown): PledgeRequiredFields {
  const source = isRecord(value) ? value : {};
  const result = { ...DEFAULT_PLEDGE_REQUIRED_FIELDS };

  for (const key of PLEDGE_FIELD_KEYS) {
    if (typeof source[key] === 'boolean') {
      result[key] = source[key] as boolean;
    }
  }

  return result;
}

function validateThemePalette(
  palette: unknown,
  defaults: DisplayThemePalette
): DisplayThemePalette {
  const result: DisplayThemePalette = { ...defaults };
  if (!isRecord(palette)) return result;

  for (const field of COLOR_FIELDS) {
    const value = palette[field];
    if (typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value)) {
      result[field] = value;
    }
  }

  if (palette.backgroundImage === null || typeof palette.backgroundImage === 'string') {
    result.backgroundImage = palette.backgroundImage;
  }

  return result;
}

export function normalizeDisplaySettings(settings: unknown): DisplaySettings {
  const source = isRecord(settings) ? settings : {};
  const requestedTheme = source.theme;
  const theme: DisplayThemeId = typeof requestedTheme === 'string'
    && DISPLAY_THEME_IDS.includes(requestedTheme as DisplayThemeId)
    ? requestedTheme as DisplayThemeId
    : 'premium';

  const themePalettes = structuredClone(DEFAULT_THEME_PALETTES);
  const storedPalettes = isRecord(source.themePalettes) ? source.themePalettes : null;

  for (const themeId of DISPLAY_THEME_IDS) {
    themePalettes[themeId] = validateThemePalette(
      storedPalettes?.[themeId],
      themePalettes[themeId]
    );
  }

  // Migrate the previous single-palette format into Gala premium.
  if (!storedPalettes) {
    themePalettes.premium = validateThemePalette(source, themePalettes.premium);
  }

  const activePalette = themePalettes[theme];
  const requestedVisualMode = source.visualMode;
  const visualMode: DisplayVisualMode = typeof requestedVisualMode === 'string'
    && DISPLAY_VISUAL_MODES.includes(requestedVisualMode as DisplayVisualMode)
    ? requestedVisualMode as DisplayVisualMode
    : 'none';
  const customSvgUrl = source.customSvgUrl === null || typeof source.customSvgUrl === 'string'
    ? source.customSvgUrl
    : null;
  const requestedAnimation = source.donationAnimation;
  const donationAnimation: DonationAnimationStyle = typeof requestedAnimation === 'string'
    && DONATION_ANIMATION_STYLES.includes(requestedAnimation as DonationAnimationStyle)
    ? requestedAnimation as DonationAnimationStyle
    : 'prestige';
  const requestedDirection = source.textDirection;
  const textDirection: DisplayTextDirection = typeof requestedDirection === 'string'
    && DISPLAY_TEXT_DIRECTIONS.includes(requestedDirection as DisplayTextDirection)
    ? requestedDirection as DisplayTextDirection
    : 'auto';
  const texts = normalizeDisplayTexts(source.texts);
  const adminBranding = normalizeAdminBranding(source.adminBranding);
  const pledgeTexts = normalizePledgeTexts(source.pledgeTexts);
  const pledgeRequiredFields = normalizePledgeRequiredFields(source.pledgeRequiredFields);
  const donationSound = source.donationSound === null || typeof source.donationSound === 'string'
    ? source.donationSound
    : null;

  return {
    theme,
    themePalettes,
    ...activePalette,
    visualMode,
    customSvgUrl,
    donationAnimation,
    textDirection,
    texts,
    adminBranding,
    pledgeTexts,
    pledgeRequiredFields,
    donationSound
  };
}

function validateSegment(seg: unknown): MenorahSegment {
  const s = seg as MenorahSegment;

  if (!s.id || typeof s.id !== 'string') {
    throw new Error('segment id is required');
  }
  if (typeof s.thresholdPercent !== 'number' || s.thresholdPercent < 0 || s.thresholdPercent > 100) {
    throw new Error('thresholdPercent must be between 0 and 100');
  }
  if (typeof s.order !== 'number' || s.order < 1) {
    throw new Error('order must be a positive integer');
  }

  return {
    id: s.id,
    thresholdPercent: s.thresholdPercent,
    order: Math.floor(s.order)
  };
}
