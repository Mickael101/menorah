import { Router, Request, Response } from 'express';
import { donationService } from '../services/donation.service';
import { requestEventId } from '../middleware/resolve-event';

const router = Router();

// GET /api/stats - Get current donation statistics
router.get('/', (req: Request, res: Response) => {
  try {
    const stats = donationService.getStats(requestEventId(req));
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
