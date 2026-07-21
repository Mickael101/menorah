// Donation entity
export interface Donation {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  amount: number; // in cents (18000 = 180€)
  reference: string | null;
  premiumWordId: string | null; // ID of the premium word (e.g., "L1_W1" for Level 1 Word 1)
  createdAt: string;
  updatedAt: string;
}

// Create donation request
export interface CreateDonationRequest {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  amount: number;
  reference?: string;
  premiumWordId?: string;
}

// Update donation request
export interface UpdateDonationRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  amount?: number;
  reference?: string;
  premiumWordId?: string;
}

// Premium word configuration
export interface PremiumWord {
  id: string;       // e.g., "L1_W1"
  level: number;    // 1, 2, or 3
  wordIndex: number; // 0-6 for level 1, 0-2 for level 2, 0 for level 3
  maskId: string;   // SVG mask ID
  label: string;    // Display label
}

// Premium tiers
export const PREMIUM_TIERS = [
  { level: 1, amount: 2600000, wordCount: 7 },
  { level: 2, amount: 3600000, wordCount: 3 },
  { level: 3, amount: 7200000, wordCount: 1 }
] as const;

// Premium words configuration with mask IDs
export const PREMIUM_WORDS: PremiumWord[] = [
  // Level 1 - 26,000 ₪ (7 words)
  { id: 'L1_W1', level: 1, wordIndex: 0, maskId: 'mask4_0_1', label: 'Mot 1' },
  { id: 'L1_W2', level: 1, wordIndex: 1, maskId: 'mask59_0_1', label: 'Mot 2' },
  { id: 'L1_W3', level: 1, wordIndex: 2, maskId: 'mask5_0_1', label: 'Mot 3' },
  { id: 'L1_W4', level: 1, wordIndex: 3, maskId: 'mask6_0_1', label: 'Mot 4' },
  { id: 'L1_W5', level: 1, wordIndex: 4, maskId: 'mask7_0_1', label: 'Mot 5' },
  { id: 'L1_W6', level: 1, wordIndex: 5, maskId: 'mask8_0_1', label: 'Mot 6' },
  { id: 'L1_W7', level: 1, wordIndex: 6, maskId: 'mask9_0_1', label: 'Mot 7' },
  // Level 2 - 36,000 ₪ (3 words)
  { id: 'L2_W1', level: 2, wordIndex: 0, maskId: 'mask2_0_1', label: 'Mot 1' },
  { id: 'L2_W2', level: 2, wordIndex: 1, maskId: 'mask3_0_1', label: 'Mot 2' },
  { id: 'L2_W3', level: 2, wordIndex: 2, maskId: 'mask0_0_1', label: 'Mot 3' },
  // Level 3 - 72,000 ₪ (1 word)
  { id: 'L3_W1', level: 3, wordIndex: 0, maskId: 'mask1_0_1', label: 'Mot Unique' }
];

// Menorah segment configuration
export interface MenorahSegment {
  id: string;
  thresholdPercent: number;
  order: number;
}

export const DISPLAY_THEME_IDS = ['premium', 'modern', 'ceremonial'] as const;
export type DisplayThemeId = typeof DISPLAY_THEME_IDS[number];

export const DISPLAY_VISUAL_MODES = ['none', 'menorah', 'custom'] as const;
export type DisplayVisualMode = typeof DISPLAY_VISUAL_MODES[number];

export const DONATION_ANIMATION_STYLES = ['prestige', 'confetti', 'ribbons', 'minimal'] as const;
export type DonationAnimationStyle = typeof DONATION_ANIMATION_STYLES[number];

export const DISPLAY_TEXT_DIRECTIONS = ['auto', 'ltr', 'rtl'] as const;
export type DisplayTextDirection = typeof DISPLAY_TEXT_DIRECTIONS[number];

export const ADMIN_BRANDING_LOCALES = ['fr', 'en', 'he'] as const;
export type AdminBrandingLocale = typeof ADMIN_BRANDING_LOCALES[number];

export interface AdminBrandingCopy {
  title: string;
  subtitle: string;
}

export type AdminBrandingSettings = Record<AdminBrandingLocale, AdminBrandingCopy>;

export const DEFAULT_ADMIN_BRANDING: AdminBrandingSettings = {
  fr: {
    title: 'Ohel Yeochoua',
    subtitle: 'Panel d’administration des dons'
  },
  en: {
    title: 'Ohel Yeochoua',
    subtitle: 'Donation administration panel'
  },
  he: {
    title: 'Ohel Yeochoua',
    subtitle: 'לוח ניהול התרומות'
  }
};

// Editable copy of the public /don pledge page, per locale.
// Empty strings hide the corresponding element on the page.
export interface PledgePageCopy {
  kicker: string;
  title: string;
  subtitle: string;
  thankTitle: string;
  thankMessage: string;
}

export type PledgeTextsSettings = Record<AdminBrandingLocale, PledgePageCopy>;

export const DEFAULT_PLEDGE_TEXTS: PledgeTextsSettings = {
  fr: {
    kicker: 'CAMPAGNE DE DONS',
    title: '',
    subtitle: 'Vous étiez absent lors de la soirée ? Enregistrez votre don ici, il rejoindra immédiatement le tableau des donateurs.',
    thankTitle: 'Merci',
    thankMessage: 'Votre générosité illumine notre communauté. Votre don a bien été enregistré.'
  },
  en: {
    kicker: 'DONATION CAMPAIGN',
    title: '',
    subtitle: 'Missed the event? Record your donation here and it will instantly join the donor board.',
    thankTitle: 'Thank you',
    thankMessage: 'Your generosity lights up our community. Your donation has been recorded.'
  },
  he: {
    kicker: 'קמפיין תרומות',
    title: '',
    subtitle: 'לא הייתם בערב ההתרמה? רשמו כאן את תרומתכם והיא תצטרף מיד ללוח התורמים.',
    thankTitle: 'תודה רבה',
    thankMessage: 'נדיבותכם מאירה את הקהילה שלנו. התרומה נרשמה בהצלחה.'
  }
};

export interface DisplayTextSettings {
  eventTitle: string;
  organizationName: string;
  boardKicker: string;
  boardTitle: string;
  liveLabel: string;
  reconnectingLabel: string;
  donorSingular: string;
  donorPlural: string;
  donationSingular: string;
  donationPlural: string;
  goalLabel: string;
  thankYouTitle: string;
  thankYouMessage: string;
}

export const DEFAULT_DISPLAY_TEXTS: DisplayTextSettings = {
  eventTitle: 'SOIRÉE DE GÉNÉROSITÉ',
  organizationName: 'OHEL YEHOSHUA',
  boardKicker: 'TABLEAU EN DIRECT',
  boardTitle: 'MERCI À NOS DONATEURS',
  liveLabel: 'EN DIRECT',
  reconnectingLabel: 'RECONNEXION...',
  donorSingular: 'DONATEUR',
  donorPlural: 'DONATEURS',
  donationSingular: 'don',
  donationPlural: 'dons',
  goalLabel: 'Objectif',
  thankYouTitle: 'Un grand merci',
  thankYouMessage: 'Votre générosité fait avancer la campagne'
};

export interface DisplayThemePalette {
  backgroundColor: string;
  backgroundImage: string | null;
  plateColorGold: string;
  plateColorDiamond: string;
  plateColorBronze: string;
  plateTextColor: string;
  headerTextColor: string;
  statsTextColor: string;
  chartPrimaryColor: string;
  chartSecondaryColor: string;
}

export const DEFAULT_THEME_PALETTES: Record<DisplayThemeId, DisplayThemePalette> = {
  premium: {
    backgroundColor: '#070914',
    backgroundImage: null,
    plateColorGold: '#E4BE63',
    plateColorDiamond: '#C8D4E3',
    plateColorBronze: '#B67846',
    plateTextColor: '#F8F3E8',
    headerTextColor: '#F2CC72',
    statsTextColor: '#F7F3EA',
    chartPrimaryColor: '#E4BE63',
    chartSecondaryColor: '#9B742B'
  },
  modern: {
    backgroundColor: '#03121B',
    backgroundImage: null,
    plateColorGold: '#FFE66D',
    plateColorDiamond: '#70E7FF',
    plateColorBronze: '#FF9B62',
    plateTextColor: '#F1FCFF',
    headerTextColor: '#67E8F9',
    statsTextColor: '#E9FBFF',
    chartPrimaryColor: '#67E8F9',
    chartSecondaryColor: '#7C6CFF'
  },
  ceremonial: {
    backgroundColor: '#16090C',
    backgroundImage: null,
    plateColorGold: '#D8B66A',
    plateColorDiamond: '#D8D0C3',
    plateColorBronze: '#A86F45',
    plateTextColor: '#FFF6E6',
    headerTextColor: '#E7C57A',
    statsTextColor: '#F6EAD8',
    chartPrimaryColor: '#D8B66A',
    chartSecondaryColor: '#7F2535'
  }
};

// Display customization settings. Legacy flat colors are kept for migration
// compatibility; the application renders the palette of the active theme.
export interface DisplaySettings extends DisplayThemePalette {
  theme: DisplayThemeId;
  themePalettes: Record<DisplayThemeId, DisplayThemePalette>;
  visualMode: DisplayVisualMode;
  customSvgUrl: string | null;
  donationAnimation: DonationAnimationStyle;
  textDirection: DisplayTextDirection;
  texts: DisplayTextSettings;
  adminBranding: AdminBrandingSettings;
  pledgeTexts: PledgeTextsSettings;
  donationSound: string | null;
}

// Default display settings
export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  theme: 'premium',
  themePalettes: structuredClone(DEFAULT_THEME_PALETTES),
  ...DEFAULT_THEME_PALETTES.premium,
  visualMode: 'none',
  customSvgUrl: null,
  donationAnimation: 'prestige',
  textDirection: 'auto',
  texts: structuredClone(DEFAULT_DISPLAY_TEXTS),
  adminBranding: structuredClone(DEFAULT_ADMIN_BRANDING),
  pledgeTexts: structuredClone(DEFAULT_PLEDGE_TEXTS),
  donationSound: null
};

// Global configuration
export interface Config {
  goalAmount: number;
  presetAmounts: number[];
  menorahSegments: MenorahSegment[];
  displaySettings: DisplaySettings;
}

// Computed donation statistics
export interface DonationStats {
  totalAmount: number;
  donationCount: number;
  percentComplete: number;
  litSegments: string[];
}

// API response with donation and stats
export interface DonationResponse {
  donation: Donation;
  stats: DonationStats;
}

// API response for donations list
export interface DonationsListResponse {
  donations: Donation[];
  stats: DonationStats;
}

// Socket.IO event types
export type DonationEventType = 'donation:new' | 'donation:updated' | 'donation:deleted';

export interface DonationEvent {
  type: DonationEventType;
  donation: Donation;
  stats: DonationStats;
}

export interface ConfigUpdatedEvent {
  type: 'config:updated';
  config: Config;
  stats: DonationStats;
}
