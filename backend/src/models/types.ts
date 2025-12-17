// Donation entity
export interface Donation {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  amount: number; // in cents (18000 = 180€)
  reference: string | null;
  premiumWordId: string | null; // ID of the premium word (e.g., "L1_W1" for Level 1 Word 1)
  createdAt: string;
  updatedAt: string;
}

// Create donation request
export interface CreateDonationRequest {
  firstName: string;
  lastName: string;
  email?: string;
  amount: number;
  reference?: string;
  premiumWordId?: string;
}

// Update donation request
export interface UpdateDonationRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
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

// Global configuration
export interface Config {
  goalAmount: number;
  presetAmounts: number[];
  menorahSegments: MenorahSegment[];
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
