import { Request, Response, NextFunction } from 'express';

interface WindowEntry {
  timestamps: number[];
}

// Minimal in-memory per-IP rate limiter (single-instance deployment).
export function rateLimit(maxRequests: number, windowMs: number) {
  const hits = new Map<string, WindowEntry>();

  // Periodic cleanup so the map never grows unbounded
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, entry] of hits) {
      entry.timestamps = entry.timestamps.filter(t => t > cutoff);
      if (entry.timestamps.length === 0) {
        hits.delete(key);
      }
    }
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = (req.header('x-forwarded-for')?.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
    // Plafond GLOBAL par IP : une IP ne peut creer que `maxRequests` dons par
    // fenetre, TOUTES soirees confondues. Une cle IP+soiree (essai B6, pour ne
    // pas penaliser deux soirees derriere un meme reseau) multipliait le plafond
    // par le nombre de soirees — dont brouillons et archives, atteignables
    // publiquement via POST /api/events/:id/donations — et rendait le quota
    // contournable a volonte. L'isolation par IP prime sur le confort du reseau
    // partage.
    const key = ip;
    const now = Date.now();
    const entry = hits.get(key) || { timestamps: [] };

    entry.timestamps = entry.timestamps.filter(t => t > now - windowMs);

    if (entry.timestamps.length >= maxRequests) {
      res.status(429).json({ error: 'Too many requests, please try again later' });
      return;
    }

    entry.timestamps.push(now);
    hits.set(key, entry);
    next();
  };
}
