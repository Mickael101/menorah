// Donation entity
export interface Donation {
  id: number;
  firstName: string;
  lastName: string;
  amount: number; // in cents (18000 = 180€)
  reference: string | null;
  createdAt: string;
  updatedAt: string;
}

// Create donation request
export interface CreateDonationRequest {
  firstName: string;
  lastName: string;
  amount: number;
  reference?: string;
}

// Update donation request
export interface UpdateDonationRequest {
  firstName?: string;
  lastName?: string;
  amount?: number;
  reference?: string;
}

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
