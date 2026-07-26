import { createServer } from 'http';
import { createApp } from './app';
import { initDatabase } from './db/init';
import { socketService } from './services/socket.service';
import { startBackupScheduler } from './services/backup.service';

const app = createApp();
const server = createServer(app);

socketService.init(server);

const PORT = process.env.PORT || 3000;

async function start(): Promise<void> {
  await initDatabase();
  startBackupScheduler();
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
