import { getDb } from '../../src/db/init';

export interface TestEventInput {
  slug: string;
  name?: string;
  status?: string;
  createdAt?: string;
  adminCodeHash?: string | null;
}

// Insere une soiree directement en base : le service de soirees est en lecture
// seule dans cette tranche, et un test ne doit pas dependre d'une route de
// creation qui n'existe pas encore.
export function insertEvent(input: TestEventInput): number {
  const db = getDb();
  db.run(
    `INSERT INTO events (slug, name, status, created_at, admin_code_hash) VALUES (?, ?, ?, ?, ?)`,
    [
      input.slug,
      input.name ?? input.slug,
      input.status ?? 'draft',
      input.createdAt ?? '2026-01-01 00:00:00',
      input.adminCodeHash ?? null
    ]
  );
  return db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number;
}
