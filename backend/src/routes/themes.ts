import { Router, Request, Response } from 'express';
import { themeService, BuiltinThemeError, ThemeScopeError } from '../services/theme.service';
import { validateCreateTheme, validateUpdateTheme, checkThemeContrast } from '../models/theme';
import { requireAdmin, requireEventAdmin } from '../middleware/admin-auth';
import { UnknownEventError } from '../services/event.service';

// ---------------------------------------------------------------------------
// /api/themes — gestion des themes (niveau organisateur)
// ---------------------------------------------------------------------------
//
// Meme patron que routes/events.ts : un routeur construit ici, monte dans
// app.ts. La creation, l'edition et la suppression sont reservees a
// l'organisateur (contrat § Authentification) ; l'APPLICATION a une soiree, qui
// releve de l'admin de la soiree, vit dans eventThemeRouter plus bas.

const themesRouter = Router();

// GET /api/themes[?eventId=] — galerie. Avec eventId : integres + themes de la
// soiree, accessible a l'admin de cette soiree. Sans eventId : tous les themes,
// reserve a l'organisateur. requireEventAdmin lit la cible dans la requete et
// laisse toujours passer l'organisateur ; sans cible, seul l'organisateur passe.
themesRouter.get(
  '/',
  requireEventAdmin((req) => {
    const id = Number(req.query.eventId);
    return Number.isInteger(id) ? id : null;
  }),
  (req: Request, res: Response) => {
    try {
      const eventId = Number(req.query.eventId);
      const themes = Number.isInteger(eventId)
        ? themeService.listForEvent(eventId)
        : themeService.listAll();
      res.json({ themes });
    } catch (error) {
      if (error instanceof UnknownEventError) {
        return res.status(404).json({ error: 'Event not found' });
      }
      console.error('Error listing themes:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/themes — creation d'un theme personnalise (organisateur). Le
// contraste AA est REFUSANT : un jeu de couleurs qui laisse un texte sous 4,5 ou
// la courbe sous 3,0 sur le fond declare renvoie 422 avec le detail des paires
// fautives, jamais un theme illisible enregistre en silence.
themesRouter.post('/', requireAdmin, (req: Request, res: Response) => {
  try {
    const input = validateCreateTheme(req.body);
    const violations = checkThemeContrast(input.tokens);
    if (violations.length > 0) {
      return res.status(422).json({ error: 'Contraste AA insuffisant', violations });
    }
    const theme = themeService.create(input);
    res.status(201).json({ theme });
  } catch (error) {
    if (error instanceof UnknownEventError) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creating theme:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/themes/:id — edition (organisateur). Meme mur de contraste. Un theme
// integre renvoie 409 : il se duplique, il ne se modifie pas.
themesRouter.put('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    const patch = validateUpdateTheme(req.body);
    if (patch.tokens) {
      const violations = checkThemeContrast(patch.tokens);
      if (violations.length > 0) {
        return res.status(422).json({ error: 'Contraste AA insuffisant', violations });
      }
    }
    const theme = themeService.update(id, patch);
    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    res.json({ theme });
  } catch (error) {
    if (error instanceof BuiltinThemeError) {
      return res.status(409).json({ error: error.message });
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error updating theme:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/themes/:id — suppression (organisateur). Integre => 409.
themesRouter.delete('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    const outcome = themeService.remove(id);
    if (outcome === 'not_found') {
      return res.status(404).json({ error: 'Theme not found' });
    }
    if (outcome === 'builtin') {
      return res.status(409).json({ error: 'Un theme integre ne peut etre supprime' });
    }
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting theme:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default themesRouter;

// ---------------------------------------------------------------------------
// /api/events/:eventId/theme — theme applique a une soiree
// ---------------------------------------------------------------------------
//
// mergeParams pour lire :eventId du point de montage. La lecture est PUBLIQUE
// (un ecran de salle doit pouvoir la relire sans jeton) ; l'application est
// reservee a l'admin de la soiree ciblee.

export const eventThemeRouter = Router({ mergeParams: true });

function paramEventId(req: Request): number | null {
  const id = Number(req.params.eventId);
  return Number.isInteger(id) ? id : null;
}

// GET /api/events/:eventId/theme — theme applique (public). null si la soiree
// n'a rien applique. Soiree inconnue => 404.
eventThemeRouter.get('/', (req: Request, res: Response) => {
  try {
    const eventId = paramEventId(req);
    if (eventId === null) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const theme = themeService.appliedTheme(eventId);
    res.json({ theme });
  } catch (error) {
    if (error instanceof UnknownEventError) {
      return res.status(404).json({ error: 'Event not found' });
    }
    console.error('Error reading applied theme:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/events/:eventId/theme — applique un theme a la soiree (admin de la
// soiree). Corps : { themeId }. L'auth se prononce AVANT toute resolution, comme
// partout ailleurs dans ce depot.
eventThemeRouter.put('/', requireEventAdmin(paramEventId), (req: Request, res: Response) => {
  try {
    const eventId = paramEventId(req);
    if (eventId === null) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const themeId = Number((req.body ?? {}).themeId);
    if (!Number.isInteger(themeId)) {
      return res.status(400).json({ error: 'themeId is required' });
    }
    const theme = themeService.applyToEvent(eventId, themeId);
    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    res.json({ theme });
  } catch (error) {
    if (error instanceof UnknownEventError) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (error instanceof ThemeScopeError) {
      return res.status(403).json({ error: error.message });
    }
    console.error('Error applying theme:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
