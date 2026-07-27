import { getDb } from '../db/init';
import { EventRecord } from '../models/types';
import { EventRow, rowToEvent } from '../models/event';
import { verifyAdminCode } from '../middleware/admin-code';

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

  // Le code admin en clair est confronte a l'empreinte d'UNE soiree precise.
  // L'empreinte ne sort jamais de la couche donnees : seule la reponse booleenne
  // remonte, jamais le hash. C'est ce qui garde EVENT_COLUMNS libre de
  // admin_code_hash tout en autorisant l'authentification.
  verifyAdminCode(eventId: number, code: string): boolean {
    const hash = this.adminCodeHash(eventId);
    return verifyAdminCode(code, hash);
  }

  // A quelle soiree, s'il en est une, ce code donne-t-il acces ? Sert a
  // distinguer un secret INCONNU (401) d'un secret VALIDE mais hors perimetre
  // (403) : sans cette question, l'admin de la soiree A recevrait un 401
  // trompeur sur la soiree B, comme si son code etait mauvais.
  findEventByAdminCode(code: string): number | null {
    const rows = getDb().exec(
      `SELECT id, admin_code_hash FROM events WHERE admin_code_hash IS NOT NULL`
    );
    if (rows.length === 0) {
      return null;
    }
    for (const [id, hash] of rows[0].values) {
      if (verifyAdminCode(code, hash as string)) {
        return id as number;
      }
    }
    return null;
  }

  private adminCodeHash(eventId: number): string | null {
    const rows = getDb().exec('SELECT admin_code_hash FROM events WHERE id = ?', [eventId]);
    if (rows.length === 0 || rows[0].values.length === 0) {
      return null;
    }
    const value = rows[0].values[0][0];
    return typeof value === 'string' ? value : null;
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
