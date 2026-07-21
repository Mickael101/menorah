import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { databaseFilePath } from '../config/storage';
import { requireAdmin } from '../middleware/admin-auth';
import { backupsDir, listBackups, snapshotDatabase } from '../services/backup.service';

const router = Router();

router.use(requireAdmin);

// GET /api/admin/backups - List available database backups
router.get('/backups', (_req: Request, res: Response) => {
  try {
    res.json({ backups: listBackups() });
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// POST /api/admin/backups - Force an immediate snapshot
router.post('/backups', (_req: Request, res: Response) => {
  try {
    const name = snapshotDatabase('manual', true);
    res.json({ created: name });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// GET /api/admin/backup.db - Download the live database file
router.get('/backup.db', (_req: Request, res: Response) => {
  if (!fs.existsSync(databaseFilePath)) {
    res.status(404).json({ error: 'Database file not found' });
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  res.download(databaseFilePath, `donations-live-${date}.db`);
});

// GET /api/admin/backups/:name - Download a specific backup
router.get('/backups/:name', (req: Request, res: Response) => {
  const name = path.basename(req.params.name);
  if (!name.endsWith('.db')) {
    res.status(400).json({ error: 'Invalid backup name' });
    return;
  }
  const filePath = path.join(backupsDir, name);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Backup not found' });
    return;
  }
  res.download(filePath, name);
});

export default router;
