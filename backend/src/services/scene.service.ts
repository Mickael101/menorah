import { getDb, saveDatabase } from '../db/init';

// Bibliotheque de scenes Rive. Le service ne touche que la table : les
// fichiers .riv (ecriture multer, suppression) sont la responsabilite de la
// route, comme pour les medias.

export interface SceneRecord {
  id: number;
  name: string;
  filename: string;
  url: string;
  createdAt: string;
}

function sceneUrl(filename: string): string {
  return `/uploads/scenes/${filename}`;
}

function rowToScene(values: unknown[], columns: string[]): SceneRecord {
  const filename = values[columns.indexOf('filename')] as string;
  return {
    id: values[columns.indexOf('id')] as number,
    name: values[columns.indexOf('name')] as string,
    filename,
    url: sceneUrl(filename),
    createdAt: values[columns.indexOf('created_at')] as string
  };
}

class SceneService {
  list(): SceneRecord[] {
    const result = getDb().exec(
      'SELECT id, name, filename, created_at FROM scenes ORDER BY created_at DESC, id DESC'
    );
    if (result.length === 0) {
      return [];
    }
    const { columns, values } = result[0];
    return values.map((row) => rowToScene(row, columns));
  }

  get(id: number): SceneRecord | null {
    const result = getDb().exec(
      'SELECT id, name, filename, created_at FROM scenes WHERE id = ?',
      [id]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }
    return rowToScene(result[0].values[0], result[0].columns);
  }

  create(name: string, filename: string): SceneRecord {
    const db = getDb();
    db.run('INSERT INTO scenes (name, filename) VALUES (?, ?)', [name, filename]);
    const idResult = db.exec('SELECT last_insert_rowid() AS id');
    const id = idResult[0].values[0][0] as number;
    saveDatabase();
    const created = this.get(id);
    if (!created) {
      throw new Error('Scene creation failed');
    }
    return created;
  }

  remove(id: number): 'removed' | 'not_found' {
    if (this.get(id) === null) {
      return 'not_found';
    }
    getDb().run('DELETE FROM scenes WHERE id = ?', [id]);
    saveDatabase();
    return 'removed';
  }

  // Soirees dont displaySettings pointe cette scene. Prefiltre LIKE grossier
  // puis verification JSON en JS : LIKE seul confondrait sceneId 1 et 12.
  eventsReferencing(sceneId: number): number[] {
    const result = getDb().exec(
      `SELECT event_id, display_settings FROM event_configs
       WHERE display_settings LIKE '%"sceneId"%'`
    );
    if (result.length === 0) {
      return [];
    }
    const { columns, values } = result[0];
    const eventIds: number[] = [];
    for (const row of values) {
      const raw = row[columns.indexOf('display_settings')] as string | null;
      if (!raw) {
        continue;
      }
      try {
        const parsed = JSON.parse(raw) as { sceneId?: unknown };
        if (parsed.sceneId === sceneId) {
          eventIds.push(row[columns.indexOf('event_id')] as number);
        }
      } catch {
        // Un blob illisible ne reference rien.
      }
    }
    return eventIds;
  }
}

export const sceneService = new SceneService();
