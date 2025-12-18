import { ref, computed } from 'vue';

// Types matching backend
export interface Donation {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
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

export interface DisplaySettings {
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
  donationSound: string | null;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  backgroundColor: '#0a0a1a',
  backgroundImage: null,
  plateColorGold: '#FFD700',
  plateColorDiamond: '#E8E8E8',
  plateColorBronze: '#CD7F32',
  plateTextColor: '#1a1400',
  headerTextColor: '#FFD700',
  statsTextColor: '#FFFFFF',
  chartPrimaryColor: '#FFD700',
  chartSecondaryColor: '#D4AF37',
  donationSound: null
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
  async function fetchDonations(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/donations');
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
      const response = await fetch('/api/config');
      if (!response.ok) throw new Error('Failed to fetch config');

      config.value = await response.json();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
    }
  }

  // Fetch premium words with availability
  async function fetchPremiumWords(): Promise<void> {
    try {
      const response = await fetch('/api/donations/premium-words');
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
    lastName: string;
    email?: string;
    amount: number;
    reference?: string;
    premiumWordId?: string;
  }): Promise<Donation | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/donations', {
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
      const response = await fetch(`/api/donations/${id}`, {
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
      const response = await fetch(`/api/donations/${id}`, {
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
      const response = await fetch('/api/config', {
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
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS'
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
