import { getDb, saveDatabase } from '../db/init';
import { Donation, CreateDonationRequest, UpdateDonationRequest, DonationStats, PREMIUM_WORDS, PremiumWord } from '../models/types';
import { DonationRow, rowToDonation } from '../models/donation';
import { buildStats } from '../models/stats';
import { configService } from './config.service';

class DonationService {
  // Get all donations
  getAll(): Donation[] {
    const db = getDb();
    const result = db.exec(`SELECT * FROM donations ORDER BY created_at DESC`);

    if (result.length === 0) {
      return [];
    }

    const columns = result[0].columns;
    const rows = result[0].values.map(values => {
      const row: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        row[col] = values[i];
      });
      return row as unknown as DonationRow;
    });

    return rows.map(rowToDonation);
  }

  // Get donation by ID
  getById(id: number): Donation | null {
    const db = getDb();
    const result = db.exec(`SELECT * FROM donations WHERE id = ?`, [id]);

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const columns = result[0].columns;
    const values = result[0].values[0];
    const row: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });

    return rowToDonation(row as unknown as DonationRow);
  }

  // Create new donation
  create(data: CreateDonationRequest): Donation {
    const db = getDb();
    db.run(
      `INSERT INTO donations (first_name, last_name, amount, reference, premium_word_id) VALUES (?, ?, ?, ?, ?)`,
      [data.firstName, data.lastName, data.amount, data.reference || null, data.premiumWordId || null]
    );

    const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
    saveDatabase();

    const donation = this.getById(lastId);
    if (!donation) {
      throw new Error('Failed to create donation');
    }

    return donation;
  }

  // Update existing donation
  update(id: number, data: UpdateDonationRequest): Donation | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.firstName !== undefined) {
      updates.push('first_name = ?');
      values.push(data.firstName);
    }
    if (data.lastName !== undefined) {
      updates.push('last_name = ?');
      values.push(data.lastName);
    }
    if (data.amount !== undefined) {
      updates.push('amount = ?');
      values.push(data.amount);
    }
    if (data.reference !== undefined) {
      updates.push('reference = ?');
      values.push(data.reference || null);
    }
    if (data.premiumWordId !== undefined) {
      updates.push('premium_word_id = ?');
      values.push(data.premiumWordId || null);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    const db = getDb();
    db.run(`UPDATE donations SET ${updates.join(', ')} WHERE id = ?`, values);
    saveDatabase();

    return this.getById(id);
  }

  // Delete donation
  delete(id: number): Donation | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }

    const db = getDb();
    db.run('DELETE FROM donations WHERE id = ?', [id]);
    saveDatabase();

    return existing;
  }

  // Get total amount and count
  getTotals(): { totalAmount: number; donationCount: number } {
    const db = getDb();
    const result = db.exec(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM donations`);

    if (result.length > 0 && result[0].values.length > 0) {
      return {
        totalAmount: result[0].values[0][0] as number,
        donationCount: result[0].values[0][1] as number
      };
    }

    return { totalAmount: 0, donationCount: 0 };
  }

  // Get current statistics
  getStats(): DonationStats {
    const { totalAmount, donationCount } = this.getTotals();
    const config = configService.get();

    return buildStats(
      totalAmount,
      donationCount,
      config.goalAmount,
      config.menorahSegments
    );
  }

  // Get used premium word IDs
  getUsedPremiumWordIds(): string[] {
    const db = getDb();
    const result = db.exec(`SELECT premium_word_id FROM donations WHERE premium_word_id IS NOT NULL`);

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map(row => row[0] as string);
  }

  // Get premium words with availability status
  getPremiumWords(): Array<PremiumWord & { available: boolean; donorName?: string }> {
    const usedWordIds = this.getUsedPremiumWordIds();
    const donations = this.getAll();

    return PREMIUM_WORDS.map(word => {
      const isUsed = usedWordIds.includes(word.id);
      const donation = donations.find(d => d.premiumWordId === word.id);

      return {
        ...word,
        available: !isUsed,
        donorName: donation ? `${donation.firstName} ${donation.lastName}` : undefined
      };
    });
  }
}

export const donationService = new DonationService();
