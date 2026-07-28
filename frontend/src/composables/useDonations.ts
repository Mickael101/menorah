import { ref } from 'vue';
import { adminFetch, scopedApiUrl } from './useAdminAuth';
import { currentEventScope } from './useEventContext';

// Types matching backend
export interface Donation {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  amount: number;
  reference: string | null;
  premiumWordId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PremiumWord {
  id: string;
  level: number;
  wordIndex: number;
  maskId: string;
  label: string;
  available: boolean;
  donorName?: string;
}

export interface PremiumTier {
  level: number;
  amount: number;
  wordCount: number;
}

export interface DonationStats {
  totalAmount: number;
  donationCount: number;
  percentComplete: number;
  litSegments: string[];
}

export const DISPLAY_THEME_IDS = ['premium', 'modern', 'ceremonial', 'royal', 'emerald', 'ivory', 'midnight'] as const;
export type DisplayThemeId = typeof DISPLAY_THEME_IDS[number];

export const DISPLAY_VISUAL_MODES = ['none', 'menorah', 'custom', 'scene'] as const;
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
    title: '',
    subtitle: 'Panel d’administration des dons'
  },
  en: {
    title: '',
    subtitle: 'Donation administration panel'
  },
  he: {
    title: '',
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

// Which identity fields are mandatory on the public /don page — admin-configurable.
// The amount is always required (a donation is defined by its amount).
export const PLEDGE_FIELD_KEYS = ['firstName', 'lastName', 'phone', 'email'] as const;
export type PledgeFieldKey = typeof PLEDGE_FIELD_KEYS[number];
export type PledgeRequiredFields = Record<PledgeFieldKey, boolean>;

export const DEFAULT_PLEDGE_REQUIRED_FIELDS: PledgeRequiredFields = {
  firstName: true,
  lastName: true,
  phone: true,
  email: false
};

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
  browserTitle: string;
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
  organizationName: '',
  browserTitle: 'OROT NETANEL',
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
  },
  royal: {
    backgroundColor: '#150720',
    backgroundImage: null,
    plateColorGold: '#E8C766',
    plateColorDiamond: '#D6C7E8',
    plateColorBronze: '#A9749B',
    plateTextColor: '#F6EFFA',
    headerTextColor: '#EBC96F',
    statsTextColor: '#F3EAF8',
    chartPrimaryColor: '#C69AE0',
    chartSecondaryColor: '#6B3E8F'
  },
  emerald: {
    backgroundColor: '#04170F',
    backgroundImage: null,
    plateColorGold: '#E3C46A',
    plateColorDiamond: '#BFE3D2',
    plateColorBronze: '#8C7A46',
    plateTextColor: '#EFF7F1',
    headerTextColor: '#E9D08A',
    statsTextColor: '#EAF6EE',
    chartPrimaryColor: '#4FC08A',
    chartSecondaryColor: '#1E6B49'
  },
  ivory: {
    backgroundColor: '#F6F1E6',
    backgroundImage: null,
    plateColorGold: '#B08328',
    plateColorDiamond: '#8A93A6',
    plateColorBronze: '#9A6A3C',
    plateTextColor: '#221C10',
    headerTextColor: '#8A6116',
    statsTextColor: '#2A2318',
    chartPrimaryColor: '#B08328',
    chartSecondaryColor: '#DCCFAE'
  },
  midnight: {
    backgroundColor: '#020203',
    backgroundImage: null,
    plateColorGold: '#D8D8DE',
    plateColorDiamond: '#F0F1F4',
    plateColorBronze: '#8E8E96',
    plateTextColor: '#F5F5F7',
    headerTextColor: '#E8E8EC',
    statsTextColor: '#FAFAFB',
    chartPrimaryColor: '#C9CAD1',
    chartSecondaryColor: '#4A4B52'
  }
};

// Palier de celebration (miroir du backend, models/types.ts) : a partir de
// minAmount (agorot), declencher ce GIF. Le son joue est celui associe au GIF
// dans la galerie, a defaut le son par defaut donationSound.
export interface CelebrationRule {
  id: string;
  minAmount: number; // agorot, > 0
  gifUrl: string;    // /uploads/gifs/<fichier>
  playOnDisplay: boolean;
  playOnPledge: boolean;
}

export type CelebrationScope = 'display' | 'pledge';

// Regle gagnante : parmi les regles actives sur cette portee et dont le seuil
// est atteint, le plus HAUT minAmount l'emporte (egalite -> premiere du
// tableau). Pure et defensive : un tableau absent ou une entree malformee ne
// doit jamais faire tomber un ecran public.
export function matchCelebrationRule(
  amount: number,
  rules: CelebrationRule[] | undefined | null,
  scope: CelebrationScope
): CelebrationRule | null {
  if (!Array.isArray(rules)) return null;
  let best: CelebrationRule | null = null;
  for (const rule of rules) {
    if (!rule || typeof rule.minAmount !== 'number' || typeof rule.gifUrl !== 'string') continue;
    if (scope === 'display' ? !rule.playOnDisplay : !rule.playOnPledge) continue;
    if (rule.minAmount > amount) continue;
    if (!best || rule.minAmount > best.minAmount) best = rule;
  }
  return best;
}

export interface DisplaySettings extends DisplayThemePalette {
  theme: DisplayThemeId;
  themePalettes: Record<DisplayThemeId, DisplayThemePalette>;
  visualMode: DisplayVisualMode;
  customSvgUrl: string | null;
  sceneId: number | null;
  sceneUrl: string | null;
  donationAnimation: DonationAnimationStyle;
  textDirection: DisplayTextDirection;
  texts: DisplayTextSettings;
  adminBranding: AdminBrandingSettings;
  pledgeTexts: PledgeTextsSettings;
  pledgeRequiredFields: PledgeRequiredFields;
  donationSound: string | null;
  celebrations: CelebrationRule[];
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  theme: 'premium',
  themePalettes: structuredClone(DEFAULT_THEME_PALETTES),
  ...DEFAULT_THEME_PALETTES.premium,
  visualMode: 'none',
  customSvgUrl: null,
  sceneId: null,
  sceneUrl: null,
  donationAnimation: 'prestige',
  textDirection: 'auto',
  texts: structuredClone(DEFAULT_DISPLAY_TEXTS),
  adminBranding: structuredClone(DEFAULT_ADMIN_BRANDING),
  pledgeTexts: structuredClone(DEFAULT_PLEDGE_TEXTS),
  pledgeRequiredFields: { ...DEFAULT_PLEDGE_REQUIRED_FIELDS },
  donationSound: null,
  celebrations: []
};

export interface Config {
  goalAmount: number;
  presetAmounts: number[];
  menorahSegments: { id: string; thresholdPercent: number; order: number }[];
  displaySettings: DisplaySettings;
}

// Shared state
const donations = ref<Donation[]>([]);
const stats = ref<DonationStats>({
  totalAmount: 0,
  donationCount: 0,
  percentComplete: 0,
  litSegments: []
});
const config = ref<Config>({
  goalAmount: 10000000,
  presetAmounts: [1800, 3600, 18000, 36000, 100000],
  menorahSegments: [],
  displaySettings: { ...DEFAULT_DISPLAY_SETTINGS }
});
const premiumWords = ref<PremiumWord[]>([]);
const premiumTiers = ref<PremiumTier[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

export function useDonations() {
  // Fetch all donations
  // full: true demande le payload complet (email, telephone, reference).
  // Reserve a l'admin ; les ecrans publics appellent sans argument et
  // recoivent une projection depouillee.
  async function fetchDonations(options: { full?: boolean } = {}): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = options.full
        ? await adminFetch('/api/donations?full=1')
        : await fetch(scopedApiUrl('/api/donations', currentEventScope()));
      if (!response.ok) throw new Error('Failed to fetch donations');

      const data = await response.json();
      donations.value = data.donations;
      stats.value = data.stats;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      isLoading.value = false;
    }
  }

  // Fetch config
  async function fetchConfig(): Promise<void> {
    try {
      const response = await fetch(scopedApiUrl('/api/config', currentEventScope()));
      if (!response.ok) throw new Error('Failed to fetch config');

      config.value = await response.json();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
    }
  }

  // Fetch premium words with availability. Event-scope comme fetchDonations /
  // fetchConfig : sur une route prefixee, frappe la soiree ADMINISTREE via
  // scopedApiUrl (route /api/events/:id/donations/premium-words), pas la soiree
  // active. Portee nulle (route heritee) => URL inchangee.
  async function fetchPremiumWords(): Promise<void> {
    try {
      const response = await fetch(scopedApiUrl('/api/donations/premium-words', currentEventScope()));
      if (!response.ok) throw new Error('Failed to fetch premium words');

      const data = await response.json();
      premiumWords.value = data.words;
      premiumTiers.value = data.tiers;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
    }
  }

  // Create donation
  async function createDonation(data: {
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    amount: number;
    reference?: string;
    premiumWordId?: string;
  }): Promise<Donation | null> {
    isLoading.value = true;
    error.value = null;

    try {
      // Via adminFetch, et non un fetch brut : CE MEME appel sert la page
      // publique (DonorPledgePage) et la saisie de l'operateur (DonationForm).
      // Le backend n'accepte un don vers une soiree NON-ACTIVE que s'il porte
      // une autorite admin (requireActiveOrAdmin) ; sans le jeton, la saisie
      // admin d'une soiree en brouillon ou archivee reviendrait 403. adminFetch
      // n'ajoute d'en-tete que s'il existe un jeton pour la portee : pour un
      // donateur du public, la requete est byte-identique a avant (et
      // scopedApiUrl y faisait deja la meme reecriture d'URL).
      const response = await adminFetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create donation');
      }

      const result = await response.json();
      return result.donation;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  // Update donation
  async function updateDonation(
    id: number,
    data: Partial<Donation>
  ): Promise<Donation | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await adminFetch(`/api/donations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update donation');
      }

      const result = await response.json();
      return result.donation;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  // Delete donation
  async function deleteDonation(id: number): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await adminFetch(`/api/donations/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete donation');
      }

      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  // Update config
  async function updateConfig(data: Partial<Config>): Promise<Config | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await adminFetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update config');
      }

      config.value = await response.json();
      return config.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  // Update local state from socket events
  function handleDonationNew(donation: Donation, newStats: DonationStats): void {
    // Avoid duplicates
    if (!donations.value.some(d => d.id === donation.id)) {
      donations.value = [donation, ...donations.value];
    }
    stats.value = newStats;
  }

  function handleDonationUpdated(donation: Donation, newStats: DonationStats): void {
    const index = donations.value.findIndex(d => d.id === donation.id);
    if (index !== -1) {
      donations.value[index] = donation;
    }
    stats.value = newStats;
  }

  function handleDonationDeleted(donationId: number, newStats: DonationStats): void {
    donations.value = donations.value.filter(d => d.id !== donationId);
    stats.value = newStats;
  }

  function handleConfigUpdated(newConfig: Config, newStats: DonationStats): void {
    config.value = newConfig;
    stats.value = newStats;
  }

  // Format amount from agorot to shekels
  const formatAmount = (cents: number): string => {
    const hasAgorot = Math.abs(cents) % 100 !== 0;

    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: hasAgorot ? 2 : 0,
      maximumFractionDigits: hasAgorot ? 2 : 0
    }).format(cents / 100);
  };

  return {
    donations,
    stats,
    config,
    premiumWords,
    premiumTiers,
    isLoading,
    error,
    fetchDonations,
    fetchConfig,
    fetchPremiumWords,
    createDonation,
    updateDonation,
    deleteDonation,
    updateConfig,
    handleDonationNew,
    handleDonationUpdated,
    handleDonationDeleted,
    handleConfigUpdated,
    formatAmount
  };
}
