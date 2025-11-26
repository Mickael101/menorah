import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initDatabase } from './db/init';
import { socketService } from './services/socket.service';
import donationsRouter from './routes/donations';
import statsRouter from './routes/stats';
import configRouter from './routes/config';

// Create Express app
const app = express();
const server = createServer(app);

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
app.use(express.json());

// Initialize Socket.IO
socketService.init(server);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API Routes
app.use('/api/donations', donationsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/config', configRouter);

// Start server with async database initialization
const PORT = process.env.PORT || 3000;

async function start() {
  await initDatabase();
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
