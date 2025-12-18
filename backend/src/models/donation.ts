import { Donation, CreateDonationRequest, UpdateDonationRequest, PREMIUM_WORDS, PREMIUM_TIERS } from './types';

// Database row format (snake_case)
export interface DonationRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  amount: number;
  reference: string | null;
  premium_word_id: string | null;
  created_at: string;
  updated_at: string;
}

// Convert database row to API format
export function rowToDonation(row: DonationRow): Donation {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    amount: row.amount,
    reference: row.reference,
    premiumWordId: row.premium_word_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Get premium level for an amount
export function getPremiumLevel(amount: number): number | null {
  const tier = PREMIUM_TIERS.find(t => t.amount === amount);
  return tier ? tier.level : null;
}

// Validate premium word ID for a given amount
export function validatePremiumWordId(wordId: string | undefined, amount: number): string | null {
  if (!wordId) return null;

  const level = getPremiumLevel(amount);
  if (!level) return null;

  const word = PREMIUM_WORDS.find(w => w.id === wordId && w.level === level);
  return word ? wordId : null;
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate create request
export function validateCreateRequest(data: unknown): CreateDonationRequest {
  const req = data as CreateDonationRequest;

  if (!req.firstName || typeof req.firstName !== 'string') {
    throw new Error('firstName is required');
  }
  if (!req.lastName || typeof req.lastName !== 'string') {
    throw new Error('lastName is required');
  }
  if (!req.amount || typeof req.amount !== 'number' || req.amount <= 0) {
    throw new Error('amount must be a positive number');
  }

  const amount = Math.floor(req.amount);
  const premiumWordId = validatePremiumWordId(req.premiumWordId, amount);

  // Validate email if provided
  let email: string | undefined;
  if (req.email && typeof req.email === 'string' && req.email.trim()) {
    const trimmedEmail = req.email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail)) {
      throw new Error('Invalid email format');
    }
    email = trimmedEmail.slice(0, 255);
  }

  // Validate phone if provided
  let phone: string | undefined;
  if (req.phone && typeof req.phone === 'string' && req.phone.trim()) {
    phone = req.phone.trim().slice(0, 20);
  }

  return {
    firstName: req.firstName.trim().slice(0, 100),
    lastName: req.lastName.trim().slice(0, 100),
    email,
    phone,
    amount,
    reference: req.reference ? String(req.reference).trim().slice(0, 100) : undefined,
    premiumWordId: premiumWordId || undefined
  };
}

// Validate update request
export function validateUpdateRequest(data: unknown, currentAmount?: number): UpdateDonationRequest {
  const req = data as UpdateDonationRequest;
  const result: UpdateDonationRequest = {};

  if (req.firstName !== undefined) {
    if (typeof req.firstName !== 'string' || !req.firstName.trim()) {
      throw new Error('firstName must be a non-empty string');
    }
    result.firstName = req.firstName.trim().slice(0, 100);
  }

  if (req.lastName !== undefined) {
    if (typeof req.lastName !== 'string' || !req.lastName.trim()) {
      throw new Error('lastName must be a non-empty string');
    }
    result.lastName = req.lastName.trim().slice(0, 100);
  }

  if (req.email !== undefined) {
    if (req.email && typeof req.email === 'string' && req.email.trim()) {
      const trimmedEmail = req.email.trim().toLowerCase();
      if (!isValidEmail(trimmedEmail)) {
        throw new Error('Invalid email format');
      }
      result.email = trimmedEmail.slice(0, 255);
    } else {
      result.email = undefined;
    }
  }

  if (req.phone !== undefined) {
    if (req.phone && typeof req.phone === 'string' && req.phone.trim()) {
      result.phone = req.phone.trim().slice(0, 20);
    } else {
      result.phone = undefined;
    }
  }

  if (req.amount !== undefined) {
    if (typeof req.amount !== 'number' || req.amount <= 0) {
      throw new Error('amount must be a positive number');
    }
    result.amount = Math.floor(req.amount);
  }

  if (req.reference !== undefined) {
    result.reference = req.reference ? String(req.reference).trim().slice(0, 100) : undefined;
  }

  if (req.premiumWordId !== undefined) {
    const amount = result.amount || currentAmount || 0;
    result.premiumWordId = validatePremiumWordId(req.premiumWordId, amount) || undefined;
  }

  return result;
}
