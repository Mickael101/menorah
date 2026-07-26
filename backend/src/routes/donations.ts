import { Router, Request, Response, NextFunction } from 'express';
import { donationService } from '../services/donation.service';
import { socketService } from '../services/socket.service';
import { validateCreateRequest, validateUpdateRequest, toPublicDonation } from '../models/donation';
import { PREMIUM_TIERS } from '../models/types';
import { requireAdmin } from '../middleware/admin-auth';
import { rateLimit } from '../middleware/rate-limit';

const router = Router();

// Public self-service page posts here: keep it open but throttled
const createLimiter = rateLimit(10, 10 * 60 * 1000);

type CsvLocale = 'fr' | 'en' | 'he';

const CSV_HEADERS: Record<CsvLocale, string[]> = {
  fr: ['ID', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Montant (₪)', 'Référence', 'Mot premium', 'Créé le', 'Modifié le'],
  en: ['ID', 'First name', 'Last name', 'Email', 'Phone', 'Amount (₪)', 'Reference', 'Premium word', 'Created at', 'Updated at'],
  he: ['מזהה', 'שם פרטי', 'שם משפחה', 'דוא״ל', 'טלפון', 'סכום (₪)', 'אסמכתה', 'מילת פרימיום', 'נוצר בתאריך', 'עודכן בתאריך']
};

function sanitizeSpreadsheetValue(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value: unknown): string {
  return `"${sanitizeSpreadsheetValue(value).replace(/"/g, '""')}"`;
}

// GET /api/donations/premium-words - Get premium words with availability
router.get('/premium-words', (_req: Request, res: Response) => {
  try {
    const words = donationService.getPremiumWords();
    res.json({ words, tiers: PREMIUM_TIERS });
  } catch (error) {
    console.error('Error fetching premium words:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/donations/export.csv - Download a read-only UTF-8 export.
// This route must stay before /:id so "export.csv" is not parsed as an ID.
router.get('/export.csv', requireAdmin, (req: Request, res: Response) => {
  try {
    const requestedLocale = req.query.lang;
    const locale: CsvLocale = requestedLocale === 'en' || requestedLocale === 'he'
      ? requestedLocale
      : 'fr';
    const rows = donationService.getAll().map(donation => [
      donation.id,
      donation.firstName,
      donation.lastName,
      donation.email,
      donation.phone,
      (donation.amount / 100).toFixed(2),
      donation.reference,
      donation.premiumWordId,
      donation.createdAt,
      donation.updatedAt
    ]);
    const csv = [CSV_HEADERS[locale], ...rows]
      .map(row => row.map(csvCell).join(';'))
      .join('\r\n');
    const date = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="donations-${date}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error('Error exporting donations:', error);
    res.status(500).json({ error: 'Failed to export donations' });
  }
});

// Le payload complet (email, telephone, reference) est une demande explicite.
const wantsFullPayload = (req: Request): boolean => req.query.full === '1';

// GET /api/donations - liste depouillee par defaut (l'ecran public en depend).
// GET /api/donations?full=1 - payload complet, reserve a l'admin.
// Le depouillement etant le comportement par defaut, un oubli de garde
// echoue ferme : on n'expose jamais de donnee personnelle par accident.
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  if (wantsFullPayload(req)) {
    requireAdmin(req, res, next);
    return;
  }
  next();
}, (req: Request, res: Response) => {
  try {
    const donations = donationService.getAll();
    const stats = donationService.getStats();

    res.json({
      donations: wantsFullPayload(req) ? donations : donations.map(toPublicDonation),
      stats
    });
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/donations/:id - Get donation by ID
router.get('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const donation = donationService.getById(id);
    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    res.json(donation);
  } catch (error) {
    console.error('Error fetching donation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/donations - Create donation (public, rate-limited)
router.post('/', createLimiter, (req: Request, res: Response) => {
  try {
    const data = validateCreateRequest(req.body);
    const donation = donationService.create(data);
    const stats = donationService.getStats();

    // Emit real-time event
    socketService.emitDonationNew(donation, stats);

    res.status(201).json({ donation, stats });
  } catch (error) {
    console.error('Error creating donation:', error);
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// PUT /api/donations/:id - Update donation (admin only)
router.put('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const data = validateUpdateRequest(req.body);
    const donation = donationService.update(id, data);

    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    const stats = donationService.getStats();

    // Emit real-time event
    socketService.emitDonationUpdated(donation, stats);

    res.json({ donation, stats });
  } catch (error) {
    console.error('Error updating donation:', error);
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// DELETE /api/donations/:id - Delete donation (admin only)
router.delete('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const donation = donationService.delete(id);
    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    const stats = donationService.getStats();

    // Emit real-time event
    socketService.emitDonationDeleted(id, stats);

    res.json({ donation, stats });
  } catch (error) {
    console.error('Error deleting donation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
