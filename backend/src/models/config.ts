import { Config, MenorahSegment, DisplaySettings, DEFAULT_DISPLAY_SETTINGS } from './types';

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
    displaySettings = { ...DEFAULT_DISPLAY_SETTINGS, ...parsed };
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
  const s = settings as Partial<DisplaySettings>;
  const result: DisplaySettings = { ...DEFAULT_DISPLAY_SETTINGS };

  // Validate color fields (hex format)
  const colorFields: (keyof DisplaySettings)[] = [
    'backgroundColor', 'plateColorGold', 'plateColorDiamond', 'plateColorBronze',
    'plateTextColor', 'headerTextColor', 'statsTextColor',
    'chartPrimaryColor', 'chartSecondaryColor'
  ];

  for (const field of colorFields) {
    if (s[field] !== undefined) {
      const value = s[field] as string;
      if (typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value)) {
        (result as any)[field] = value;
      }
    }
  }

  // Validate background image (URL or null)
  if (s.backgroundImage !== undefined) {
    if (s.backgroundImage === null || typeof s.backgroundImage === 'string') {
      result.backgroundImage = s.backgroundImage;
    }
  }

  return result;
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
