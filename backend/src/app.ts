import express from 'express';
import cors from 'cors';
import path from 'path';
import donationsRouter from './routes/donations';
import statsRouter from './routes/stats';
import configRouter from './routes/config';
import gifsRouter from './routes/gifs';
import adminRouter from './routes/admin';
import { uploadsRoot } from './config/storage';

// Construit l'app Express sans effet de bord : ni base de donnees, ni listen.
// Permet a Supertest de l'attaquer directement.
export function createApp(): express.Express {
  const app = express();

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }));

  app.use(express.json());

  const publicPath = path.join(__dirname, '../public');
  app.use('/uploads', express.static(uploadsRoot));
  app.use(express.static(publicPath));

  app.use('/api/donations', donationsRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/config', configRouter);
  app.use('/api/gifs', gifsRouter);
  app.use('/api/admin', adminRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  return app;
}
