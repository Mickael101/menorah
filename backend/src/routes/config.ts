import { Router, Request, Response } from 'express';
import { configService } from '../services/config.service';
import { donationService } from '../services/donation.service';
import { socketService } from '../services/socket.service';
import { validateConfigUpdate } from '../models/config';

const router = Router();

// GET /api/config - Get current configuration
router.get('/', (_req: Request, res: Response) => {
  try {
    const config = configService.get();
    res.json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/config - Update configuration
router.put('/', (req: Request, res: Response) => {
  try {
    const data = validateConfigUpdate(req.body);
    const config = configService.update(data);
    const stats = donationService.getStats();

    // Emit real-time event
    socketService.emitConfigUpdated(config, stats);

    res.json(config);
  } catch (error) {
    console.error('Error updating config:', error);
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
