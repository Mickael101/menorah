import { EventRecord, EventStatus, EVENT_STATUSES } from './types';

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
