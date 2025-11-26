import { Donation, CreateDonationRequest, UpdateDonationRequest } from './types';

// Database row format (snake_case)
export interface DonationRow {
  id: number;
  first_name: string;
  last_name: string;
  amount: number;
  reference: string | null;
  created_at: string;
  updated_at: string;
}

// Convert database row to API format
export function rowToDonation(row: DonationRow): Donation {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    amount: row.amount,
    reference: row.reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
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

  return {
    firstName: req.firstName.trim().slice(0, 100),
    lastName: req.lastName.trim().slice(0, 100),
    amount: Math.floor(req.amount),
    reference: req.reference ? String(req.reference).trim().slice(0, 100) : undefined
  };
}

// Validate update request
export function validateUpdateRequest(data: unknown): UpdateDonationRequest {
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

  if (req.amount !== undefined) {
    if (typeof req.amount !== 'number' || req.amount <= 0) {
      throw new Error('amount must be a positive number');
    }
    result.amount = Math.floor(req.amount);
  }

  if (req.reference !== undefined) {
    result.reference = req.reference ? String(req.reference).trim().slice(0, 100) : undefined;
  }

  return result;
}
