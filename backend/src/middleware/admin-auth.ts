import { Request, Response, NextFunction } from 'express';

// Protects mutating/admin routes with a shared secret.
// If ADMIN_TOKEN is not configured (local dev), access is allowed.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = process.env.ADMIN_TOKEN?.trim();
  if (!token) {
    next();
    return;
  }

  const provided = req.header('x-admin-token') || (typeof req.query.token === 'string' ? req.query.token : '');
  if (provided === token) {
    next();
    return;
  }

  res.status(401).json({ error: 'Unauthorized: admin token required' });
}
