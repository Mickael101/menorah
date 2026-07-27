import { getDb, saveDatabase } from '../db/init';
import { Donation, CreateDonationRequest, UpdateDonationRequest, DonationStats, PREMIUM_WORDS, PremiumWord } from '../models/types';
import { DonationRow, rowToDonation } from '../models/donation';
import { buildStats } from '../models/stats';
import { configService } from './config.service';

// eventId est le PREMIER parametre de chaque methode, sans exception : un
// oubli devient une erreur de compilation au lieu d'une requete qui balaie
// toutes les soirees.
class DonationService {
  // Get all donations
  getAll(eventId: number): Donation[] {
    const db = getDb();
    const result = db.exec(`SELECT * FROM donations WHERE event_id = ? ORDER BY created_at DESC`, [eventId]);

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
  getById(eventId: number, id: number): Donation | null {
    const db = getDb();
    const result = db.exec(`SELECT * FROM donations WHERE id = ? AND event_id = ?`, [id, eventId]);

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
  create(eventId: number, data: CreateDonationRequest): Donation {
    const db = getDb();
    db.run(
      `INSERT INTO donations (event_id, first_name, last_name, email, phone, amount, reference, premium_word_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [eventId, data.firstName, data.lastName ?? '', data.email || null, data.phone || null, data.amount, data.reference || null, data.premiumWordId || null]
    );

    const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
    saveDatabase();

    const donation = this.getById(eventId, lastId);
    if (!donation) {
      throw new Error('Failed to create donation');
    }

    return donation;
  }

  // Update existing donation
  update(eventId: number, id: number, data: UpdateDonationRequest): Donation | null {
    const existing = this.getById(eventId, id);
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
    if (data.email !== undefined) {
      updates.push('email = ?');
      values.push(data.email || null);
    }
    if (data.phone !== undefined) {
      updates.push('phone = ?');
      values.push(data.phone || null);
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
    values.push(id, eventId);

    const db = getDb();
    db.run(`UPDATE donations SET ${updates.join(', ')} WHERE id = ? AND event_id = ?`, values);
    saveDatabase();

    return this.getById(eventId, id);
  }

  // Delete donation
  delete(eventId: number, id: number): Donation | null {
    const existing = this.getById(eventId, id);
    if (!existing) {
      return null;
    }

    const db = getDb();
    db.run('DELETE FROM donations WHERE id = ? AND event_id = ?', [id, eventId]);
    saveDatabase();

    return existing;
  }

  // Get total amount and count
  getTotals(eventId: number): { totalAmount: number; donationCount: number } {
    const db = getDb();
    const result = db.exec(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM donations WHERE event_id = ?`,
      [eventId]
    );

    if (result.length > 0 && result[0].values.length > 0) {
      return {
        totalAmount: result[0].values[0][0] as number,
        donationCount: result[0].values[0][1] as number
      };
    }

    return { totalAmount: 0, donationCount: 0 };
  }

  // Get current statistics
  getStats(eventId: number): DonationStats {
    const { totalAmount, donationCount } = this.getTotals(eventId);
    // Le MEME eventId doit alimenter les deux lectures : mesurer les dons d'une
    // soiree contre l'objectif d'une autre ne leve aucune erreur, ca donne un
    // pourcentage faux et silencieux.
    const config = configService.get(eventId);

    return buildStats(
      totalAmount,
      donationCount,
      config.goalAmount,
      config.menorahSegments
    );
  }

  // Get used premium word IDs
  getUsedPremiumWordIds(eventId: number): string[] {
    const db = getDb();
    const result = db.exec(
      `SELECT premium_word_id FROM donations WHERE premium_word_id IS NOT NULL AND event_id = ?`,
      [eventId]
    );

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map(row => row[0] as string);
  }

  // Get premium words with availability status
  getPremiumWords(eventId: number): Array<PremiumWord & { available: boolean; donorName?: string }> {
    const usedWordIds = this.getUsedPremiumWordIds(eventId);
    const donations = this.getAll(eventId);

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
