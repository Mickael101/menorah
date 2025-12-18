import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import { initDatabase } from './db/init';
import { socketService } from './services/socket.service';
import donationsRouter from './routes/donations';
import statsRouter from './routes/stats';
import configRouter from './routes/config';
import gifsRouter from './routes/gifs';

// Create Express app
const app = express();
const server = createServer(app);

// CORS (autorise tout en prod + localhost en dev)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.use(express.json());

// Initialize Socket.IO
socketService.init(server);

// Serve frontend static files
const publicPath = path.join(__dirname, "../public");
app.use(express.static(publicPath));

// API Routes
app.use('/api/donations', donationsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/config', configRouter);
app.use('/api/gifs', gifsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Catch-all to serve frontend
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

const PORT = process.env.PORT || 3000;

// Start server with async DB init
async function start() {
  await initDatabase();
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
