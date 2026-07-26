import { Request, Response, NextFunction } from 'express';

// Protege les routes admin et les routes exposant des donnees personnelles.
//
// Sans ADMIN_TOKEN configure :
//   - en production, la requete est REFUSEE (503). Laisser passer reviendrait
//     a publier les donnees des donateurs a qui connait l'URL.
//   - hors production, la requete passe, pour ne pas gener le developpement local.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = process.env.ADMIN_TOKEN?.trim();

  if (!token) {
    if (process.env.NODE_ENV === 'production') {
      console.error('SECURITY: ADMIN_TOKEN absent — requete admin refusee');
      res.status(503).json({ error: 'Admin authentication is not configured' });
      return;
    }
    next();
    return;
  }

  const provided = req.header('x-admin-token')
    || (typeof req.query.token === 'string' ? req.query.token : '');

  if (provided === token) {
    next();
    return;
  }

  res.status(401).json({ error: 'Unauthorized: admin token required' });
}
