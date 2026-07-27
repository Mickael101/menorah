import { EventRecord, EventStatus, EVENT_STATUSES } from './types';

// Les deux projections du contrat. admin_code_hash n'appartient a aucune des
// deux : EventRecord ne le porte deja pas, ces types en derivent, la fuite est
// donc impossible par construction.
//
// EventPublic  : ce que /active et /by-slug exposent sans authentification.
// EventSummary : EventPublic + horodatages + agregats, pour l'organisateur.
export type EventPublic = Omit<EventRecord, 'createdAt' | 'archivedAt'>;
export type EventSummary = EventRecord & { donationCount: number; totalAmount: number };

export function toEventPublic(event: EventRecord): EventPublic {
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    status: event.status,
    logoUrl: event.logoUrl,
    defaultLocale: event.defaultLocale,
    currency: event.currency
  };
}

export function toEventSummary(
  event: EventRecord,
  totals: { donationCount: number; totalAmount: number }
): EventSummary {
  return {
    ...event,
    donationCount: totals.donationCount,
    totalAmount: totals.totalAmount
  };
}

// Ce que la creation et la mise a jour acceptent d'ecrire. Volontairement
// distinct d'EventRecord : les agregats et les horodatages ne s'ecrivent jamais
// a la main, et admin_code_hash passe par un canal dedie (le code hache).
export interface CreateEventInput {
  slug: string;
  name: string;
  status: EventStatus;
  logoUrl: string | null;
  defaultLocale: string;
  currency: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requireString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} is required`);
  }
  return value.trim().slice(0, max);
}

function validateSlug(value: unknown): string {
  const slug = requireString(value, 'slug', 64).toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error('slug must contain only lowercase letters, digits and single hyphens');
  }
  return slug;
}

function validateStatus(value: unknown): EventStatus {
  if (!EVENT_STATUSES.includes(value as EventStatus)) {
    throw new Error(`status must be one of ${EVENT_STATUSES.join(', ')}`);
  }
  return value as EventStatus;
}

export function validateCreateEvent(data: unknown): CreateEventInput {
  const body = (data ?? {}) as Record<string, unknown>;
  return {
    slug: validateSlug(body.slug),
    name: requireString(body.name, 'name', 120),
    status: body.status === undefined ? 'draft' : validateStatus(body.status),
    logoUrl: typeof body.logoUrl === 'string' ? body.logoUrl.trim().slice(0, 500) : null,
    defaultLocale: typeof body.defaultLocale === 'string' && body.defaultLocale.trim()
      ? body.defaultLocale.trim().slice(0, 10)
      : 'he',
    currency: typeof body.currency === 'string' && body.currency.trim()
      ? body.currency.trim().slice(0, 10)
      : 'ILS'
  };
}

// Mise a jour partielle : seuls les champs presents sont touches. Une cle
// absente laisse la valeur en base intacte, une cle presente la remplace.
export function validateUpdateEvent(data: unknown): Partial<CreateEventInput> {
  const body = (data ?? {}) as Record<string, unknown>;
  const patch: Partial<CreateEventInput> = {};

  if (body.slug !== undefined) patch.slug = validateSlug(body.slug);
  if (body.name !== undefined) patch.name = requireString(body.name, 'name', 120);
  if (body.status !== undefined) patch.status = validateStatus(body.status);
  if (body.logoUrl !== undefined) {
    patch.logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim().slice(0, 500) : null;
  }
  if (body.defaultLocale !== undefined) {
    patch.defaultLocale = requireString(body.defaultLocale, 'defaultLocale', 10);
  }
  if (body.currency !== undefined) {
    patch.currency = requireString(body.currency, 'currency', 10);
  }

  return patch;
}

// Format en base (snake_case). admin_code_hash est volontairement absent :
// la colonne existe, mais rien de ce fichier ne sait la transporter.
export interface EventRow {
  id: number;
  slug: string;
  name: string;
  status: string;
  logo_url: string | null;
  default_locale: string;
  currency: string;
  created_at: string | null;
  archived_at: string | null;
}

export function rowToEvent(row: EventRow): EventRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    // Le statut vient d'une colonne TEXT libre : une valeur inconnue est
    // traitee comme un brouillon plutot que propagee telle quelle, sans quoi
    // une faute de frappe en base rendrait une soiree « active » par accident.
    status: EVENT_STATUSES.includes(row.status as EventStatus) ? (row.status as EventStatus) : 'draft',
    logoUrl: row.logo_url,
    defaultLocale: row.default_locale,
    currency: row.currency,
    createdAt: row.created_at,
    archivedAt: row.archived_at
  };
}
