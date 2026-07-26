import { createServer } from 'http';
import { createApp } from './app';
import { initDatabase } from './db/init';
import { socketService } from './services/socket.service';
import { snapshotDatabase, startBackupScheduler } from './services/backup.service';

const app = createApp();
const server = createServer(app);

socketService.init(server);

const PORT = process.env.PORT || 3000;

async function start(): Promise<void> {
  // AVANT la migration, pas apres. Le filet de securite pre-deploiement
  // n'existe que s'il capture l'etat ANTERIEUR : `startBackupScheduler()` prend
  // deja un instantane au demarrage, mais il s'execute apres `initDatabase()`,
  // donc il photographiait une base DEJA migree. L'etat anterieur le plus frais
  // disponible pour un retour arriere etait alors la sauvegarde horaire de
  // l'instance precedente — jusqu'a soixante minutes de retard, c'est-a-dire,
  // un soir de collecte, la totalite des dons de la soiree. Et sur un volume
  // neuf, aucune sauvegarde du tout.
  // Sans effet si le fichier n'existe pas encore : sur une installation neuve,
  // il n'y a rien a sauvegarder.
  snapshotDatabase('pre-migration', true);

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
