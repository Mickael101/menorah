import fs from 'fs';
import path from 'path';
import { databaseFilePath } from '../config/storage';

const MAX_BACKUPS = 60;

export const backupsDir = path.join(path.dirname(databaseFilePath), 'backups');

let lastSnapshotMtimeMs = 0;

function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function listBackups(): Array<{ name: string; size: number; createdAt: string }> {
  if (!fs.existsSync(backupsDir)) {
    return [];
  }

  return fs.readdirSync(backupsDir)
    .filter(name => name.endsWith('.db'))
    .map(name => {
      const stat = fs.statSync(path.join(backupsDir, name));
      return { name, size: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function prune(): void {
  const backups = listBackups();
  for (const backup of backups.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(backupsDir, backup.name));
  }
}

// Copies the SQLite file to the backups directory (skips if unchanged since last snapshot).
export function snapshotDatabase(reason: string, force = false): string | null {
  if (!fs.existsSync(databaseFilePath)) {
    return null;
  }

  const mtimeMs = fs.statSync(databaseFilePath).mtimeMs;
  if (!force && mtimeMs === lastSnapshotMtimeMs) {
    return null;
  }

  fs.mkdirSync(backupsDir, { recursive: true });
  const name = `donations-${timestampSlug()}-${reason}.db`;
  fs.copyFileSync(databaseFilePath, path.join(backupsDir, name));
  lastSnapshotMtimeMs = mtimeMs;
  prune();
  console.log(`Database backup created: ${name}`);
  return name;
}

export function startBackupScheduler(): void {
  // Snapshot the pre-existing data as soon as the server boots (pre-deploy safety net)
  snapshotDatabase('startup', true);

  // Then hourly, only when the database actually changed
  setInterval(() => {
    try {
      snapshotDatabase('hourly');
    } catch (err) {
      console.error('Scheduled backup failed:', err);
    }
  }, 60 * 60 * 1000).unref();
}
