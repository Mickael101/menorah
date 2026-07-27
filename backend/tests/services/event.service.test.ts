import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initTestDatabase } from '../helpers/app';
import { getDb } from '../../src/db/init';
import { eventService } from '../../src/services/event.service';

// Ces tests mutent la table events EN MEMOIRE et n'appellent jamais
// saveDatabase() : la base de test est un fichier partage par toute la suite,
// et une soiree fictive persistee ferait deriver les autres fichiers.

function insertEvent(
  slug: string,
  name: string,
  status: string,
  createdAt: string,
  adminCodeHash: string | null = null
): number {
  const db = getDb();
  db.run(
    `INSERT INTO events (slug, name, status, created_at, admin_code_hash) VALUES (?, ?, ?, ?, ?)`,
    [slug, name, status, createdAt, adminCodeHash]
  );
  return db.exec('SELECT last_insert_rowid()')[0].values[0][0] as number;
}

describe('service de soirees', () => {
  beforeAll(async () => {
    await initTestDatabase();
  });

  beforeEach(() => {
    // Table remise a plat avant chaque cas : la soiree issue de la migration
    // est `active`, elle fausserait toute assertion sur l'ambiguite.
    //
    // Les enfants d'abord. Aujourd'hui `PRAGMA foreign_keys` retombe a 0 des le
    // premier db.export(), donc l'ordre est indifferent — mais le jour ou les
    // cles etrangeres seront reellement appliquees, un DELETE sur events seul
    // echouerait. Ce nettoyage ne doit pas dependre de ce detail.
    const db = getDb();
    db.run('DELETE FROM event_configs');
    db.run('DELETE FROM events');
  });

  describe('resolveActive', () => {
    it('renvoie la soiree active et ne signale aucune ambiguite quand elle est seule', () => {
      insertEvent('seule-active', 'Seule active', 'active', '2026-07-01 20:00:00');
      insertEvent('un-brouillon', 'Brouillon', 'draft', '2026-07-02 20:00:00');
      insertEvent('une-archive', 'Archive', 'archived', '2026-07-03 20:00:00');

      const resolution = eventService.resolveActive();

      expect(resolution.event?.slug).toBe('seule-active');
      expect(resolution.multipleActive).toBe(false);
    });

    it('renvoie la plus recemment creee et signale l ambiguite quand deux soirees sont actives', () => {
      insertEvent('ancienne', 'Ancienne', 'active', '2026-07-01 20:00:00');
      insertEvent('recente', 'Recente', 'active', '2026-07-05 20:00:00');

      const resolution = eventService.resolveActive();

      expect(resolution.event?.slug).toBe('recente');
      expect(resolution.multipleActive).toBe(true);
    });

    it('departage sur l identifiant quand les dates de creation sont identiques', () => {
      // datetime('now') de SQLite a la seconde : deux soirees creees dans la
      // meme seconde sont un cas normal, pas un cas limite.
      insertEvent('meme-seconde-1', 'Premiere', 'active', '2026-07-05 20:00:00');
      const derniere = insertEvent('meme-seconde-2', 'Seconde', 'active', '2026-07-05 20:00:00');

      const resolution = eventService.resolveActive();

      expect(resolution.event?.id).toBe(derniere);
      expect(resolution.multipleActive).toBe(true);
    });

    it('ne devine rien quand aucune soiree n est active', () => {
      insertEvent('seulement-brouillon', 'Brouillon', 'draft', '2026-07-01 20:00:00');

      const resolution = eventService.resolveActive();

      expect(resolution.event).toBeNull();
      expect(resolution.multipleActive).toBe(false);
    });
  });

  describe('lectures', () => {
    it('retrouve une soiree par identifiant et par slug, et renvoie null sinon', () => {
      const id = insertEvent('orot-test', 'Orot Test', 'active', '2026-07-01 20:00:00');

      expect(eventService.getById(id)?.slug).toBe('orot-test');
      expect(eventService.getBySlug('orot-test')?.id).toBe(id);
      expect(eventService.getById(999999)).toBeNull();
      expect(eventService.getBySlug('slug-inexistant')).toBeNull();
    });

    it('liste toutes les soirees, quel que soit leur statut', () => {
      insertEvent('a', 'A', 'active', '2026-07-01 20:00:00');
      insertEvent('b', 'B', 'draft', '2026-07-02 20:00:00');
      insertEvent('c', 'C', 'archived', '2026-07-03 20:00:00');

      expect(eventService.listAll().map((event) => event.slug).sort()).toEqual(['a', 'b', 'c']);
    });

    it('n expose jamais le code admin hache', () => {
      const id = insertEvent('avec-code', 'Avec code', 'active', '2026-07-01 20:00:00', 'scrypt$16384$8$1$sel$empreinte');

      const parIdentifiant = eventService.getById(id);
      const parSlug = eventService.getBySlug('avec-code');
      const [premiere] = eventService.listAll();
      const { event: active } = eventService.resolveActive();

      for (const soiree of [parIdentifiant, parSlug, premiere, active]) {
        const serialise = JSON.stringify(soiree);
        expect(serialise).not.toContain('admin_code_hash');
        expect(serialise).not.toContain('adminCodeHash');
        expect(serialise).not.toContain('scrypt$');
      }
    });
  });
});
