import { getDb, saveDatabase } from '../db/init';
import { eventService, UnknownEventError } from './event.service';
import {
  ThemeRecord,
  ThemeRow,
  ThemeTokens,
  CreateThemeInput,
  rowToTheme
} from '../models/theme';

// Tentative de modification d'un theme integre. Distincte d'une erreur de
// validation pour que la route reponde 409 (conflit avec l'etat de la
// ressource) et non 400 : un builtin se duplique, il ne se modifie pas.
export class BuiltinThemeError extends Error {
  constructor() {
    super('Un theme integre ne peut etre ni modifie ni supprime : dupliquez-le');
    this.name = 'BuiltinThemeError';
  }
}

// Application d'un theme d'une AUTRE soiree a celle-ci. Le theme existe, mais il
// n'appartient pas a l'appelant : 403 (le secret est bon, la portee non), jamais
// 404 qui laisserait croire a une faute de frappe.
export class ThemeScopeError extends Error {
  constructor() {
    super("Ce theme appartient a une autre soiree");
    this.name = 'ThemeScopeError';
  }
}

const ALL_COLUMNS = 'id, event_id, name, tokens_json, created_at';

// Les integres d'abord (event_id NULL en tete), puis les personnalises du plus
// recent au plus ancien : l'ordre de la galerie.
const GALLERY_ORDER = 'ORDER BY (event_id IS NOT NULL), created_at DESC, id DESC';

class ThemeService {
  getById(id: number): ThemeRecord | null {
    return this.queryOne(`SELECT ${ALL_COLUMNS} FROM themes WHERE id = ?`, [id]);
  }

  // Galerie d'une soiree : integres partages + themes propres a la soiree.
  listForEvent(eventId: number): ThemeRecord[] {
    this.assertEventExists(eventId);
    return this.queryAll(
      `SELECT ${ALL_COLUMNS} FROM themes WHERE event_id IS NULL OR event_id = ? ${GALLERY_ORDER}`,
      [eventId]
    );
  }

  // Vue organisateur : integres + tous les themes personnalises, soirees
  // confondues.
  listAll(): ThemeRecord[] {
    return this.queryAll(`SELECT ${ALL_COLUMNS} FROM themes ${GALLERY_ORDER}`, []);
  }

  create(input: CreateThemeInput): ThemeRecord {
    this.assertEventExists(input.eventId);

    const db = getDb();
    db.run(`INSERT INTO themes (event_id, name, tokens_json) VALUES (?, ?, ?)`, [
      input.eventId,
      input.name,
      JSON.stringify(input.tokens)
    ]);
    const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number;
    saveDatabase();

    const created = this.getById(id);
    if (!created) {
      throw new Error('Failed to create theme');
    }
    return created;
  }

  update(id: number, patch: { name?: string; tokens?: ThemeTokens }): ThemeRecord | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }
    if (existing.builtin) {
      throw new BuiltinThemeError();
    }

    const updates: string[] = [];
    const values: (string | number)[] = [];
    if (patch.name !== undefined) {
      updates.push('name = ?');
      values.push(patch.name);
    }
    if (patch.tokens !== undefined) {
      updates.push('tokens_json = ?');
      values.push(JSON.stringify(patch.tokens));
    }

    if (updates.length > 0) {
      const db = getDb();
      db.run(`UPDATE themes SET ${updates.join(', ')} WHERE id = ?`, [...values, id]);
      saveDatabase();
    }

    return this.getById(id);
  }

  // 'not_found' | 'builtin' | 'deleted' : l'appelant traduit chaque cas en code
  // HTTP sans avoir a relire l'etat.
  remove(id: number): 'not_found' | 'builtin' | 'deleted' {
    const existing = this.getById(id);
    if (!existing) {
      return 'not_found';
    }
    if (existing.builtin) {
      return 'builtin';
    }

    const db = getDb();
    // Une soiree qui portait ce theme ne doit pas se retrouver avec un
    // theme_id pendant dans le vide : on le detache avant de supprimer.
    // sql.js n'applique pas ON DELETE de lui-meme a ce schema.
    db.run('UPDATE event_configs SET theme_id = NULL WHERE theme_id = ?', [id]);
    db.run('DELETE FROM themes WHERE id = ?', [id]);
    saveDatabase();
    return 'deleted';
  }

  // Lecture publique : le theme applique a une soiree (offline-safe cote ecran).
  // null si la soiree n'a rien applique.
  appliedTheme(eventId: number): ThemeRecord | null {
    this.assertEventExists(eventId);
    const rows = getDb().exec('SELECT theme_id FROM event_configs WHERE event_id = ?', [eventId]);
    if (rows.length === 0 || rows[0].values.length === 0) {
      return null;
    }
    const themeId = rows[0].values[0][0];
    if (typeof themeId !== 'number') {
      return null;
    }
    return this.getById(themeId);
  }

  // Applique un theme a une soiree (pose event_configs.theme_id). Un theme
  // integre (event_id NULL) est applicable partout ; un theme personnalise ne
  // l'est que sur sa propre soiree.
  applyToEvent(eventId: number, themeId: number): ThemeRecord | null {
    this.assertEventExists(eventId);
    const theme = this.getById(themeId);
    if (!theme) {
      return null;
    }
    if (theme.eventId !== null && theme.eventId !== eventId) {
      throw new ThemeScopeError();
    }

    const db = getDb();
    db.run('INSERT OR IGNORE INTO event_configs (event_id) VALUES (?)', [eventId]);
    db.run("UPDATE event_configs SET theme_id = ?, updated_at = datetime('now') WHERE event_id = ?", [
      themeId,
      eventId
    ]);
    saveDatabase();
    return theme;
  }

  private assertEventExists(eventId: number): void {
    if (eventService.getById(eventId) === null) {
      throw new UnknownEventError(eventId);
    }
  }

  private queryOne(sql: string, params: (string | number)[]): ThemeRecord | null {
    const [first] = this.queryAll(sql, params);
    return first ?? null;
  }

  private queryAll(sql: string, params: (string | number)[]): ThemeRecord[] {
    const result = getDb().exec(sql, params);
    if (result.length === 0) {
      return [];
    }
    const { columns, values } = result[0];
    return values.map((row) => {
      const mapped: Record<string, unknown> = {};
      columns.forEach((column, index) => {
        mapped[column] = row[index];
      });
      return rowToTheme(mapped as unknown as ThemeRow);
    });
  }
}

export const themeService = new ThemeService();
