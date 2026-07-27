import express from 'express';
import cors from 'cors';
import path from 'path';
import { createDonationsRouter } from './routes/donations';
import { createStatsRouter } from './routes/stats';
import { createConfigRouter } from './routes/config';
import { createGifsRouter } from './routes/gifs';
import adminRouter from './routes/admin';
import eventsRouter from './routes/events';
import themesRouter, { eventThemeRouter } from './routes/themes';
import { legacyEventContext, paramEventContext } from './routes/event-context';
import { uploadsRoot } from './config/storage';

// C8 : origine(s) CORS configurables par CORS_ORIGIN (liste separee par
// virgules), consommee AUSSI par le socket (front S) avec la MEME variable.
// Defaut = comportement actuel (origin: '*'), pour ne pas casser un ecran en
// production qui n'aurait pas encore la variable.
function corsOrigin(): string[] | '*' {
  const configured = process.env.CORS_ORIGIN?.trim();
  if (!configured) {
    return '*';
  }
  const list = configured.split(',').map((o) => o.trim()).filter(Boolean);
  // Meme normalisation que socketCorsOrigin() : un `*` seul doit devenir la
  // chaine allow-all, pas le tableau `['*']`. Dans un tableau, le litteral `'*'`
  // ne matche jamais un vrai header Origin, et cors n'emet alors aucun
  // Access-Control-Allow-Origin — toutes les requetes cross-origin echouent.
  return list.length === 1 && list[0] === '*' ? '*' : list;
}

// Construit l'app Express sans effet de bord : ni base de donnees, ni listen.
// Permet a Supertest de l'attaquer directement.
export function createApp(): express.Express {
  const app = express();

  app.use(cors({
    origin: corsOrigin(),
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }));

  app.use(express.json());

  const publicPath = path.join(__dirname, '../public');
  app.use('/uploads', express.static(uploadsRoot));
  app.use(express.static(publicPath));

  // Routes de gestion des soirees. Montee AVANT les routes de ressources
  // prefixees : les chemins /api/events/:eventId/<ressource> ne matchent aucune
  // route de ce routeur, ils retombent donc sur les montages prefixes suivants.
  app.use('/api/events', eventsRouter);

  // Routes de RESSOURCES, montees deux fois a partir du meme corps :
  //   - herite  (/api/donations...)          resolu sur la soiree ACTIVE ;
  //   - prefixe (/api/events/:eventId/...)    resolu sur la soiree NOMMEE.
  // Meme forme de reponse des deux cotes : c'est la condition de migration du
  // frontend. /api/admin en est exclu a dessein : il sert le fichier de base
  // entier (TOUTES les soirees) et reste au niveau organisateur.
  app.use('/api/donations', createDonationsRouter(legacyEventContext));
  app.use('/api/stats', createStatsRouter(legacyEventContext));
  app.use('/api/config', createConfigRouter(legacyEventContext));
  app.use('/api/gifs', createGifsRouter(legacyEventContext));

  app.use('/api/events/:eventId/donations', createDonationsRouter(paramEventContext));
  app.use('/api/events/:eventId/stats', createStatsRouter(paramEventContext));
  app.use('/api/events/:eventId/config', createConfigRouter(paramEventContext));
  app.use('/api/events/:eventId/gifs', createGifsRouter(paramEventContext));

  // Moteur de themes (C1) : gestion au niveau organisateur sous /api/themes,
  // application par soiree sous /api/events/:eventId/theme (lecture publique).
  app.use('/api/themes', themesRouter);
  app.use('/api/events/:eventId/theme', eventThemeRouter);

  app.use('/api/admin', adminRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  return app;
}
