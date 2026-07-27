import { getDb, saveDatabase } from '../db/init';

// La table `media` devient la source de verite du rattachement d'un fichier a
// une soiree. Les fichiers restent stockes a plat sur le disque (uploads/),
// mais QUELLE soiree possede quel fichier — et quel son est associe a quel GIF —
// se lit desormais en base, par soiree, et non plus dans un listing de
// repertoire global ni dans un gif-audio.json partage par tout le monde.

export type MediaKind = 'gif' | 'audio' | 'visual';

export interface MediaGif {
  filename: string;
  audioFilename: string | null;
}

class MediaService {
  // Les GIF d'une soiree, avec leur son associe eventuel.
  listGifs(eventId: number): MediaGif[] {
    const result = getDb().exec(
      `SELECT filename, audio_filename FROM media WHERE event_id = ? AND kind = 'gif'`,
      [eventId]
    );
    if (result.length === 0) {
      return [];
    }
    return result[0].values.map((row) => ({
      filename: row[0] as string,
      audioFilename: (row[1] as string | null) ?? null
    }));
  }

  // Les fichiers audio d'une soiree.
  listAudio(eventId: number): string[] {
    const result = getDb().exec(
      `SELECT filename FROM media WHERE event_id = ? AND kind = 'audio'`,
      [eventId]
    );
    if (result.length === 0) {
      return [];
    }
    return result[0].values.map((row) => row[0] as string);
  }

  // Ce fichier appartient-il bien a CETTE soiree ? Garde d'isolation avant toute
  // suppression : sans elle, l'admin de A supprimerait un media de B.
  owns(eventId: number, kind: MediaKind, filename: string): boolean {
    const result = getDb().exec(
      `SELECT 1 FROM media WHERE event_id = ? AND kind = ? AND filename = ?`,
      [eventId, kind, filename]
    );
    return result.length > 0 && result[0].values.length > 0;
  }

  // Rattache un nouveau fichier a une soiree. Idempotent sur (soiree, type, nom)
  // pour ne pas dupliquer si un rejeu survient.
  add(eventId: number, kind: MediaKind, filename: string): void {
    if (this.owns(eventId, kind, filename)) {
      return;
    }
    getDb().run(
      `INSERT INTO media (event_id, kind, filename) VALUES (?, ?, ?)`,
      [eventId, kind, filename]
    );
    saveDatabase();
  }

  getGifAudio(eventId: number, gifFilename: string): string | null {
    const result = getDb().exec(
      `SELECT audio_filename FROM media WHERE event_id = ? AND kind = 'gif' AND filename = ?`,
      [eventId, gifFilename]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }
    return (result[0].values[0][0] as string | null) ?? null;
  }

  setGifAudio(eventId: number, gifFilename: string, audioFilename: string | null): void {
    getDb().run(
      `UPDATE media SET audio_filename = ? WHERE event_id = ? AND kind = 'gif' AND filename = ?`,
      [audioFilename, eventId, gifFilename]
    );
    saveDatabase();
  }

  remove(eventId: number, kind: MediaKind, filename: string): void {
    getDb().run(
      `DELETE FROM media WHERE event_id = ? AND kind = ? AND filename = ?`,
      [eventId, kind, filename]
    );
    saveDatabase();
  }

  // Un audio supprime ne doit plus etre reference par aucun GIF de la soiree.
  clearAudioAssociations(eventId: number, audioFilename: string): void {
    getDb().run(
      `UPDATE media SET audio_filename = NULL
        WHERE event_id = ? AND kind = 'gif' AND audio_filename = ?`,
      [eventId, audioFilename]
    );
    saveDatabase();
  }
}

export const mediaService = new MediaService();
