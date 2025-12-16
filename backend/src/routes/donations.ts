import { Router, Request, Response } from 'express';
import { donationService } from '../services/donation.service';
import { socketService } from '../services/socket.service';
import { validateCreateRequest, validateUpdateRequest } from '../models/donation';
import { PREMIUM_TIERS } from '../models/types';

const router = Router();

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

// GET /api/donations - List all donations
router.get('/', (_req: Request, res: Response) => {
  try {
    const donations = donationService.getAll();
    const stats = donationService.getStats();

    res.json({ donations, stats });
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/donations/:id - Get donation by ID
router.get('/:id', (req: Request, res: Response) => {
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

// POST /api/donations - Create donation
router.post('/', (req: Request, res: Response) => {
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

// PUT /api/donations/:id - Update donation
router.put('/:id', (req: Request, res: Response) => {
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

// DELETE /api/donations/:id - Delete donation
router.delete('/:id', (req: Request, res: Response) => {
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
