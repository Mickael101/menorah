import { describe, it, expect, afterEach } from 'vitest';
import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { runMigrations } from '../../src/db/migrations';
import { uploadsRoot, gifAudioFilePath } from '../../src/config/storage';

// B4 : les fichiers deja sur le disque doivent entrer dans la table `media`,
// rattaches a la soiree fondatrice, et les associations GIF -> son de l'ancien
// gif-audio.json global doivent suivre. Sans cet inventaire, tout media livre
// disparaitrait au passage au cloisonnement par soiree.

const gifsDir = path.join(uploadsRoot, 'gifs');
const audioDir = path.join(uploadsRoot, 'audio');
const visualsDir = path.join(uploadsRoot, 'visuals');

// Noms distinctifs pour ne rien confondre avec d'eventuels fichiers d'autres
// suites et pour un nettoyage cible.
const SEED_GIF_WITH_AUDIO = 'gif-seed-avec-son.gif';
const SEED_GIF_ALONE = 'gif-seed-seul.png';
const SEED_AUDIO = 'audio-seed.mp3';
const SEED_VISUAL = 'visual-seed.svg';

function write(dir: string, filename: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), 'x');
}

function cleanup(): void {
  for (const [dir, name] of [
    [gifsDir, SEED_GIF_WITH_AUDIO],
    [gifsDir, SEED_GIF_ALONE],
    [audioDir, SEED_AUDIO],
    [visualsDir, SEED_VISUAL]
  ] as const) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
  }
  if (fs.existsSync(gifAudioFilePath)) {
    fs.unlinkSync(gifAudioFilePath);
  }
}

async function emptyDb(): Promise<Database> {
  const SQL = await initSqlJs();
  return new SQL.Database();
}

function rows(db: Database, sql: string): unknown[][] {
  const result = db.exec(sql);
  return result.length === 0 ? [] : result[0].values;
}

describe('inventaire des medias existants (B4)', () => {
  afterEach(() => {
    cleanup();
  });

  it('rattache GIF, audio et SVG a la soiree, et migre l association du son', async () => {
    write(gifsDir, SEED_GIF_WITH_AUDIO);
    write(gifsDir, SEED_GIF_ALONE);
    write(audioDir, SEED_AUDIO);
    write(visualsDir, SEED_VISUAL);
    fs.mkdirSync(path.dirname(gifAudioFilePath), { recursive: true });
    fs.writeFileSync(
      gifAudioFilePath,
      JSON.stringify({ [SEED_GIF_WITH_AUDIO]: `/uploads/audio/${SEED_AUDIO}` })
    );

    const db = await emptyDb();
    runMigrations(db);

    const media = rows(
      db,
      `SELECT kind, filename, audio_filename, event_id FROM media
        WHERE filename IN ('${SEED_GIF_WITH_AUDIO}', '${SEED_GIF_ALONE}', '${SEED_AUDIO}', '${SEED_VISUAL}')
        ORDER BY filename`
    );

    // Tous rattaches a la soiree fondatrice (id 1, la seule active).
    for (const row of media) {
      expect(row[3]).toBe(1);
    }

    const byName = new Map(media.map((r) => [r[1] as string, r]));
    expect(byName.get(SEED_GIF_WITH_AUDIO)?.[0]).toBe('gif');
    expect(byName.get(SEED_GIF_WITH_AUDIO)?.[2]).toBe(SEED_AUDIO); // association migree
    expect(byName.get(SEED_GIF_ALONE)?.[0]).toBe('gif');
    expect(byName.get(SEED_GIF_ALONE)?.[2]).toBeNull();
    expect(byName.get(SEED_AUDIO)?.[0]).toBe('audio');
    expect(byName.get(SEED_VISUAL)?.[0]).toBe('visual');
  });

  it('ne re-inventorie pas si media est deja peuplee (idempotence)', async () => {
    write(gifsDir, SEED_GIF_ALONE);

    const db = await emptyDb();
    runMigrations(db);
    const premierCompte = rows(db, `SELECT COUNT(*) FROM media WHERE filename = '${SEED_GIF_ALONE}'`)[0][0];
    expect(premierCompte).toBe(1);

    // Un rejeu (redemarrage) ne doit pas dupliquer.
    runMigrations(db);
    const secondCompte = rows(db, `SELECT COUNT(*) FROM media WHERE filename = '${SEED_GIF_ALONE}'`)[0][0];
    expect(secondCompte).toBe(1);
  });
});
