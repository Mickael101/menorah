import { getDb } from '../db/init';
import { EventRecord } from '../models/types';
import { EventRow, rowToEvent } from '../models/event';

export interface ActiveEventResolution {
  event: EventRecord | null;
  // Deux soirees actives en meme temps sont legitimes. Ce qui ne doit pas
  // l'etre, c'est de resoudre une URL sans slug en silence : l'administration
  // affiche un avertissement a partir de ce drapeau.
  multipleActive: boolean;
}

// La soiree demandee n'existe pas. Distincte d'une soiree sans configuration :
// sans cette distinction, un slug mal orthographie rendrait une soiree vide
// parfaitement credible au lieu d'une erreur.
export class UnknownEventError extends Error {
  readonly eventId: number;

  constructor(eventId: number) {
    super(`Soiree inconnue : ${eventId}`);
    this.name = 'UnknownEventError';
    this.eventId = eventId;
  }
}

// Colonnes enumerees, jamais SELECT * : admin_code_hash vit dans la meme table
// et un SELECT * le ferait entrer dans le processus a chaque lecture.
const EVENT_COLUMNS =
  'id, slug, name, status, logo_url, default_locale, currency, created_at, archived_at';

// La plus recemment creee d'abord. created_at a la seconde pres en SQLite :
// l'identifiant est le vrai depart des ex aequo, pas un ornement.
const MOST_RECENT_FIRST = 'ORDER BY created_at DESC, id DESC';

class EventService {
  getById(id: number): EventRecord | null {
    return this.queryOne(`SELECT ${EVENT_COLUMNS} FROM events WHERE id = ?`, [id]);
  }

  getBySlug(slug: string): EventRecord | null {
    return this.queryOne(`SELECT ${EVENT_COLUMNS} FROM events WHERE slug = ?`, [slug]);
  }

  listAll(): EventRecord[] {
    return this.queryAll(`SELECT ${EVENT_COLUMNS} FROM events ${MOST_RECENT_FIRST}`, []);
  }

  resolveActive(): ActiveEventResolution {
    const active = this.queryAll(
      `SELECT ${EVENT_COLUMNS} FROM events WHERE status = 'active' ${MOST_RECENT_FIRST}`,
      []
    );

    return {
      event: active.length === 0 ? null : active[0],
      multipleActive: active.length > 1
    };
  }

  private queryOne(sql: string, params: (string | number)[]): EventRecord | null {
    const [first] = this.queryAll(sql, params);
    return first ?? null;
  }

  private queryAll(sql: string, params: (string | number)[]): EventRecord[] {
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
      return rowToEvent(mapped as unknown as EventRow);
    });
  }
}

export const eventService = new EventService();
