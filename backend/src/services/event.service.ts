import { getDb, saveDatabase } from '../db/init';
import { EventRecord } from '../models/types';
import { EventRow, rowToEvent, CreateEventInput } from '../models/event';
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

// Le slug est la clef publique de l'URL /e/<slug> : deux soirees ne peuvent pas
// le partager. Distincte d'une erreur de validation pour que la route reponde
// 409 (conflit) et non 400 (requete malformee).
export class SlugTakenError extends Error {
  readonly slug: string;

  constructor(slug: string) {
    super(`Slug deja utilise : ${slug}`);
    this.name = 'SlugTakenError';
    this.slug = slug;
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

  // NOTE : findEventByAdminCode (balayage de TOUTES les soirees, un scryptSync
  // par ligne) a ete retire le 2026-07-28. Il ne servait qu'a distinguer un 401
  // d'un 403 dans requireEventAdmin, au prix d'un scrypt par soiree sur des
  // routes ni limitees ni authentifiees — un vecteur de deni de service sur le
  // thread unique. Le refus est desormais un 401 sec. Ne pas le reintroduire.

  private adminCodeHash(eventId: number): string | null {
    const rows = getDb().exec('SELECT admin_code_hash FROM events WHERE id = ?', [eventId]);
    if (rows.length === 0 || rows[0].values.length === 0) {
      return null;
    }
    const value = rows[0].values[0][0];
    return typeof value === 'string' ? value : null;
  }

  // Slug deja pris : distincte des erreurs de validation pour que la route
  // reponde 409 plutot que 400. La contrainte UNIQUE en base la leve aussi,
  // mais un controle prealable rend le message clair au lieu d'une erreur SQL.
  create(input: CreateEventInput, adminCodeHash: string | null): EventRecord {
    if (this.getBySlug(input.slug) !== null) {
      throw new SlugTakenError(input.slug);
    }

    const db = getDb();
    db.run(
      `INSERT INTO events (slug, name, status, admin_code_hash, logo_url, default_locale, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.slug, input.name, input.status, adminCodeHash, input.logoUrl, input.defaultLocale, input.currency]
    );
    const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number;
    saveDatabase();

    const created = this.getById(id);
    if (!created) {
      throw new Error('Failed to create event');
    }
    return created;
  }

  updateEvent(eventId: number, patch: Partial<CreateEventInput>): EventRecord | null {
    if (this.getById(eventId) === null) {
      return null;
    }

    if (patch.slug !== undefined) {
      const holder = this.getBySlug(patch.slug);
      if (holder !== null && holder.id !== eventId) {
        throw new SlugTakenError(patch.slug);
      }
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    const column: Record<keyof CreateEventInput, string> = {
      slug: 'slug',
      name: 'name',
      status: 'status',
      logoUrl: 'logo_url',
      defaultLocale: 'default_locale',
      currency: 'currency'
    };

    for (const key of Object.keys(patch) as (keyof CreateEventInput)[]) {
      updates.push(`${column[key]} = ?`);
      values.push(patch[key] as string | null);
    }

    // archived_at suit le statut : renseigne a l'archivage, efface au retour en
    // brouillon ou en activite, pour que la colonne ne mente jamais sur l'etat.
    if (patch.status !== undefined) {
      updates.push(patch.status === 'archived' ? "archived_at = datetime('now')" : 'archived_at = NULL');
    }

    if (updates.length > 0) {
      const db = getDb();
      db.run(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`, [...values, eventId]);
      saveDatabase();
    }

    return this.getById(eventId);
  }

  setAdminCodeHash(eventId: number, adminCodeHash: string): boolean {
    if (this.getById(eventId) === null) {
      return false;
    }
    const db = getDb();
    db.run('UPDATE events SET admin_code_hash = ? WHERE id = ?', [adminCodeHash, eventId]);
    saveDatabase();
    return true;
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
