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

  if (!process.env.ADMIN_TOKEN?.trim()) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        'SECURITY: ADMIN_TOKEN absent en production — toutes les routes admin renverront 503. Configurez la variable.'
      );
    } else {
      console.warn('ADMIN_TOKEN absent : routes admin ouvertes (mode developpement).');
    }
  }

  startBackupScheduler();
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
