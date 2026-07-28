# Atelier Scènes v1 — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jouer sur l'écran de salle une scène Rive uploadée par l'organisateur, illuminée par le % de l'objectif, avec le pipeline de fabrication hors app et la scène bâtiment comme première production.

**Architecture:** Deux volets découplés par un contrat unique (state machine `Scene`, input number `progress` 0–100). Volet app : table + service + routes `/api/scenes` (organisateur), `displaySettings.visualMode: 'scene'` + `sceneId`/`sceneUrl` résolus serveur, `SceneDisplay.vue` avec runtime `@rive-app/canvas` lazy-loadé piloté par `stats.percentComplete`. Volet atelier : runbook + scripts dans `D:\Menora\atelier-scenes\` (jamais déployé).

**Tech Stack:** Express 4 + multer + sql.js (backend) · Vue 3 Composition + Vite (frontend) · `@rive-app/canvas` ^2 · vitest + supertest (backend), vitest node-env (frontend, nouveau) · playwright-cli (preuves).

**Spec:** `docs/specs/2026-07-28-atelier-scenes-design.md` (validée par le commanditaire le 2026-07-28).

## Global Constraints

- Branche de travail : `feat/atelier-scenes-2026-07-28` (existe déjà, porte la spec). Aucun `railway up` — la mise en prod attend le commanditaire.
- Base : **`sql.js`** uniquement. Ne jamais introduire `better-sqlite3`. Ne pas toucher à l'écriture atomique tmp+rename ni au `PRAGMA foreign_keys` reposé après `export()` (`backend/src/db/init.ts`).
- Tests backend : **depuis `backend/`** (`cd backend && npm test`), jamais depuis la racine. Si « Worker exited unexpectedly » : rejouer, ou `npx vitest run --pool=threads` (piège Windows connu, préexistant).
- Le gate d'un commit backend inclut `cd backend && npm run build` (tsc) — `npm test` seul ne voit pas les erreurs de types.
- Frontend : `cd frontend && npm run typecheck` (vue-tsc) + `npm run build` obligatoires avant chaque commit frontend.
- i18n admin : **parité stricte fr/en/he** — toute clé ajoutée l'est dans les 3 blocs de `frontend/src/composables/useAdminI18n.ts`.
- Ne jamais inventer de contenu éditorial affiché au public ; les libellés admin suivent le patron des libellés existants.
- Doc et code dans le même commit, date mise à jour dans `docs/README.md` (protocole docs vivantes).
- Messages de commit sans accents (style du dépôt), terminés par `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Auth de test : poser `process.env.ORGANIZER_TOKEN` dans `beforeAll` et le supprimer dans `afterAll` — hors production `requireAdmin` laisse passer sans jeton, un test vert sans jeton ne prouve rien.

---

### Task 1: Table `scenes` + `sceneService`

**Files:**
- Modify: `backend/src/db/migrations.ts` (après le bloc `CREATE TABLE IF NOT EXISTS themes`)
- Create: `backend/src/services/scene.service.ts`
- Test: `backend/tests/services/scene.service.test.ts`

**Interfaces:**
- Consumes: `getDb`, `saveDatabase` (`../db/init`).
- Produces (utilisé par Tasks 2, 3) :
  ```ts
  export interface SceneRecord { id: number; name: string; filename: string; url: string; createdAt: string; }
  sceneService.list(): SceneRecord[]
  sceneService.get(id: number): SceneRecord | null
  sceneService.create(name: string, filename: string): SceneRecord
  sceneService.remove(id: number): 'removed' | 'not_found'
  sceneService.eventsReferencing(sceneId: number): number[]
  ```
  `url` vaut toujours `/uploads/scenes/${filename}`.

- [ ] **Step 1: Écrire le test qui échoue**

`backend/tests/services/scene.service.test.ts` :

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp } from '../helpers/app';
import { insertEvent } from '../helpers/events';
import { getDb, saveDatabase } from '../../src/db/init';
import { sceneService } from '../../src/services/scene.service';

// La table scenes est globale (bibliotheque de l'organisateur) : pas de
// rattachement a une soiree, contrairement a media.

const createdEvents: number[] = [];

describe('sceneService', () => {
  beforeAll(async () => {
    await createTestApp();
  });

  afterAll(() => {
    const db = getDb();
    db.run("DELETE FROM scenes WHERE filename LIKE 'test-scene-%'");
    for (const id of createdEvents) {
      db.run('DELETE FROM event_configs WHERE event_id = ?', [id]);
      db.run('DELETE FROM events WHERE id = ?', [id]);
    }
    saveDatabase();
  });

  it('cree puis liste une scene avec son url derivee', () => {
    const scene = sceneService.create('Batiment', 'test-scene-a.riv');
    expect(scene.id).toBeGreaterThan(0);
    expect(scene.name).toBe('Batiment');
    expect(scene.url).toBe('/uploads/scenes/test-scene-a.riv');
    const listed = sceneService.list().find((s) => s.id === scene.id);
    expect(listed?.filename).toBe('test-scene-a.riv');
  });

  it('get renvoie null pour un id inconnu', () => {
    expect(sceneService.get(999999)).toBeNull();
  });

  it('remove supprime et signale not_found sur un id inconnu', () => {
    const scene = sceneService.create('Ephemere', 'test-scene-b.riv');
    expect(sceneService.remove(scene.id)).toBe('removed');
    expect(sceneService.get(scene.id)).toBeNull();
    expect(sceneService.remove(scene.id)).toBe('not_found');
  });

  it('eventsReferencing trouve la soiree dont displaySettings pointe la scene — et elle seule', () => {
    const scene = sceneService.create('Reference', 'test-scene-c.riv');
    const other = sceneService.create('Autre', 'test-scene-d.riv');
    const eventA = insertEvent({ slug: 'scene-svc-a', name: 'Scene Svc A' });
    const eventB = insertEvent({ slug: 'scene-svc-b', name: 'Scene Svc B' });
    createdEvents.push(eventA, eventB);

    const db = getDb();
    db.run('INSERT OR IGNORE INTO event_configs (event_id) VALUES (?)', [eventA]);
    db.run('UPDATE event_configs SET display_settings = ? WHERE event_id = ?', [
      JSON.stringify({ visualMode: 'scene', sceneId: scene.id, sceneUrl: scene.url }),
      eventA
    ]);
    db.run('INSERT OR IGNORE INTO event_configs (event_id) VALUES (?)', [eventB]);
    db.run('UPDATE event_configs SET display_settings = ? WHERE event_id = ?', [
      JSON.stringify({ visualMode: 'scene', sceneId: other.id, sceneUrl: other.url }),
      eventB
    ]);
    saveDatabase();

    expect(sceneService.eventsReferencing(scene.id)).toEqual([eventA]);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd backend && npx vitest run tests/services/scene.service.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/scene.service'`.

- [ ] **Step 3: Migration + service**

Dans `backend/src/db/migrations.ts`, juste après le bloc `CREATE TABLE IF NOT EXISTS themes (…)` (même fonction, même idiome — le dépôt n'utilise pas de framework de migration) :

```ts
  // Bibliotheque de scenes Rive (Atelier Scenes, spec 2026-07-28). Globale :
  // une scene est un actif de l'organisateur, activable par n'importe quelle
  // soiree via displaySettings.sceneId. Le fichier .riv vit sous
  // DATA_DIR/uploads/scenes/, servi par le montage statique /uploads existant.
  db.run(`
    CREATE TABLE IF NOT EXISTS scenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      filename TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
```

Créer `backend/src/services/scene.service.ts` :

```ts
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
```

- [ ] **Step 4: Vérifier le vert**

Run: `cd backend && npx vitest run tests/services/scene.service.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Gate + commit**

```bash
cd backend && npm test && npm run build
git add backend/src/db/migrations.ts backend/src/services/scene.service.ts backend/tests/services/scene.service.test.ts
git commit -m "feat(scenes): table scenes et sceneService (bibliotheque globale)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `displaySettings` — mode `scene`, `sceneId`/`sceneUrl` résolus serveur

**Files:**
- Modify: `backend/src/models/types.ts:81` (`DISPLAY_VISUAL_MODES`), interface `DisplaySettings` (~l.317), `DEFAULT_DISPLAY_SETTINGS` (~l.333)
- Modify: `backend/src/models/config.ts` (normalisation, autour de la l.264)
- Modify: `backend/src/services/config.service.ts` (résolution `sceneId` → `sceneUrl` dans `update()`)
- Test: `backend/tests/routes/scene-binding.test.ts`

**Interfaces:**
- Consumes: `sceneService.get` (Task 1).
- Produces (utilisé par Tasks 3, 5, 6) : `DisplaySettings` gagne `sceneId: number | null` et `sceneUrl: string | null` ; `DISPLAY_VISUAL_MODES` contient `'scene'`. Règle : `PUT /config` avec `visualMode:'scene'` et `sceneId` absent/inconnu → 400 « sceneId must reference an existing scene » ; avec scène valide → `sceneUrl` réécrit serveur (jamais confiance au client).

- [ ] **Step 1: Écrire le test qui échoue**

`backend/tests/routes/scene-binding.test.ts` :

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../helpers/app';
import { insertEvent } from '../helpers/events';
import { getDb, saveDatabase } from '../../src/db/init';
import { sceneService } from '../../src/services/scene.service';

const ORGANIZER_TOKEN = 'organisateur-scene-binding';

describe('liaison displaySettings <-> scene', () => {
  let app: express.Express;
  let eventId = 0;
  let sceneId = 0;

  beforeAll(async () => {
    app = await createTestApp();
    process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;
    eventId = insertEvent({ slug: 'scene-binding', name: 'Scene Binding' });
    sceneId = sceneService.create('Batiment binding', 'test-binding.riv').id;
  });

  afterAll(() => {
    const db = getDb();
    db.run('DELETE FROM scenes WHERE id = ?', [sceneId]);
    db.run('DELETE FROM event_configs WHERE event_id = ?', [eventId]);
    db.run('DELETE FROM events WHERE id = ?', [eventId]);
    saveDatabase();
    delete process.env.ORGANIZER_TOKEN;
  });

  function putSettings(displaySettings: Record<string, unknown>) {
    return request(app)
      .put(`/api/events/${eventId}/config`)
      .set('x-admin-token', ORGANIZER_TOKEN)
      .send({ displaySettings });
  }

  it('active une scene existante et reecrit sceneUrl cote serveur', async () => {
    const response = await putSettings({
      visualMode: 'scene',
      sceneId,
      sceneUrl: '/uploads/scenes/forge-par-le-client.riv'
    });
    expect(response.status).toBe(200);
    expect(response.body.displaySettings.visualMode).toBe('scene');
    expect(response.body.displaySettings.sceneId).toBe(sceneId);
    expect(response.body.displaySettings.sceneUrl).toBe('/uploads/scenes/test-binding.riv');
  });

  it('persiste la liaison : GET config relit sceneUrl', async () => {
    const response = await request(app).get(`/api/events/${eventId}/config`);
    expect(response.status).toBe(200);
    expect(response.body.displaySettings.sceneUrl).toBe('/uploads/scenes/test-binding.riv');
  });

  it('refuse en 400 un sceneId inconnu quand visualMode=scene', async () => {
    const response = await putSettings({ visualMode: 'scene', sceneId: 999999 });
    expect(response.status).toBe(400);
  });

  it('refuse en 400 visualMode=scene sans sceneId', async () => {
    const response = await putSettings({ visualMode: 'scene' });
    expect(response.status).toBe(400);
  });

  it('hors mode scene, sceneUrl reste coherent sans bloquer la sauvegarde', async () => {
    const response = await putSettings({ visualMode: 'none', sceneId: null });
    expect(response.status).toBe(200);
    expect(response.body.displaySettings.sceneUrl).toBeNull();
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd backend && npx vitest run tests/routes/scene-binding.test.ts`
Expected: FAIL — le premier test reçoit `visualMode: 'none'` (mode `scene` inconnu de la normalisation) et `sceneId`/`sceneUrl` absents du corps.

- [ ] **Step 3: Types + normalisation + résolution**

`backend/src/models/types.ts` :

```ts
export const DISPLAY_VISUAL_MODES = ['none', 'menorah', 'custom', 'scene'] as const;
```

Dans `interface DisplaySettings` (après `customSvgUrl: string | null;`) :

```ts
  sceneId: number | null;
  sceneUrl: string | null;
```

Dans `DEFAULT_DISPLAY_SETTINGS` (après `customSvgUrl: null,`) :

```ts
  sceneId: null,
  sceneUrl: null,
```

`backend/src/models/config.ts`, dans `normalizeDisplaySettings`, après le bloc `customSvgUrl` (l.264-266) :

```ts
  const rawSceneId = source.sceneId;
  const sceneId = typeof rawSceneId === 'number' && Number.isInteger(rawSceneId)
    ? rawSceneId
    : null;
  // sceneUrl est REECRIT par config.service a chaque sauvegarde ; on ne fait
  // ici que tolerer la valeur stockee pour la relecture du blob.
  const sceneUrl = typeof source.sceneUrl === 'string' ? source.sceneUrl : null;
```

et dans l'objet retourné, après `customSvgUrl,` :

```ts
    sceneId,
    sceneUrl,
```

`backend/src/services/config.service.ts` — importer le service :

```ts
import { sceneService } from './scene.service';
```

puis dans `update()`, remplacer le bloc `displaySettings` existant (l.63-66) par :

```ts
    if (data.displaySettings !== undefined) {
      this.resolveSceneBinding(data.displaySettings);
      updates.push('display_settings = ?');
      values.push(JSON.stringify(data.displaySettings));
    }
```

et ajouter la méthode privée (à côté de `assertEventExists`) :

```ts
  // Le serveur est la seule source de verite : sceneUrl est toujours derive
  // de sceneId au moment de la sauvegarde, jamais accepte du client. En mode
  // scene, une reference morte est une erreur de requete (400 via la route).
  private resolveSceneBinding(settings: DisplaySettings): void {
    if (settings.visualMode === 'scene') {
      const scene = settings.sceneId !== null ? sceneService.get(settings.sceneId) : null;
      if (!scene) {
        throw new Error('sceneId must reference an existing scene when visualMode is "scene"');
      }
      settings.sceneUrl = scene.url;
      return;
    }
    const scene = settings.sceneId !== null ? sceneService.get(settings.sceneId) : null;
    settings.sceneUrl = scene ? scene.url : null;
  }
```

Ajouter l'import de type si absent dans config.service.ts : `import { Config, DisplaySettings } from '../models/types';` (adapter à la ligne d'import existante).

- [ ] **Step 4: Vérifier le vert**

Run: `cd backend && npx vitest run tests/routes/scene-binding.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Gate + commit**

```bash
cd backend && npm test && npm run build
git add backend/src/models/types.ts backend/src/models/config.ts backend/src/services/config.service.ts backend/tests/routes/scene-binding.test.ts
git commit -m "feat(scenes): mode visuel scene avec sceneId/sceneUrl resolus serveur

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Routes `/api/scenes` (upload organisateur, liste, suppression + self-healing)

**Files:**
- Create: `backend/src/routes/scenes.ts`
- Modify: `backend/src/app.ts` (montage à côté de `/api/themes`)
- Test: `backend/tests/routes/scenes.test.ts`

**Interfaces:**
- Consumes: `sceneService` (Task 1), `configService.get/update` + règle `resolveSceneBinding` (Task 2), `requireAdmin`/`requireEventAdmin`, `socketService.emitConfigUpdated`, `donationService.getStats`, `uploadsRoot`, `isInside`.
- Produces (utilisé par Tasks 6, 8) :
  - `GET /api/scenes?eventId=` → `{ scenes: SceneRecord[] }` — organisateur sans `eventId`, admin de la soirée `eventId` sinon (même patron que `GET /api/themes`).
  - `POST /api/scenes` (organisateur, multipart champ **`scene`**, champ texte optionnel `name`) → 201 `{ scene: SceneRecord }`. Refus : extension ≠ `.riv`, > 10 Mo, magic bytes ≠ `RIVE` → 400.
  - `DELETE /api/scenes/:id` (organisateur) → 204 ; guérit les soirées référentes (`visualMode:'none'`, `sceneId:null`, `sceneUrl:null`) et rediffuse leur config.

- [ ] **Step 1: Écrire le test qui échoue**

`backend/tests/routes/scenes.test.ts` :

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import fs from 'fs';
import path from 'path';
import { createTestApp } from '../helpers/app';
import { insertEvent } from '../helpers/events';
import { getDb, saveDatabase } from '../../src/db/init';
import { hashAdminCode } from '../../src/middleware/admin-code';
import { uploadsRoot } from '../../src/config/storage';

const ORGANIZER_TOKEN = 'organisateur-scenes';
const CODE_A = 'code-soiree-scenes-a';

// Un contenu .riv minimal pour les tests : seuls les magic bytes comptent
// pour la validation d'upload (le decodage complet est le travail du runtime).
const RIVE_BYTES = Buffer.concat([Buffer.from('RIVE', 'ascii'), Buffer.alloc(64)]);
const NOT_RIVE_BYTES = Buffer.concat([Buffer.from('PK', 'latin1'), Buffer.alloc(64)]);

const uploadedFilenames: string[] = [];
const createdEvents: number[] = [];

function scenesDir(): string {
  return path.join(uploadsRoot, 'scenes');
}

describe('routes /api/scenes', () => {
  let app: express.Express;
  let eventA = 0;

  beforeAll(async () => {
    app = await createTestApp();
    process.env.ORGANIZER_TOKEN = ORGANIZER_TOKEN;
    eventA = insertEvent({ slug: 'scenes-a', name: 'Scenes A', adminCodeHash: hashAdminCode(CODE_A) });
    createdEvents.push(eventA);
  });

  afterAll(() => {
    const db = getDb();
    for (const filename of uploadedFilenames) {
      const filePath = path.join(scenesDir(), filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      db.run('DELETE FROM scenes WHERE filename = ?', [filename]);
    }
    for (const id of createdEvents) {
      db.run('DELETE FROM event_configs WHERE event_id = ?', [id]);
      db.run('DELETE FROM events WHERE id = ?', [id]);
    }
    saveDatabase();
    delete process.env.ORGANIZER_TOKEN;
  });

  async function uploadScene(name: string, body: Buffer, filename = 'batiment.riv') {
    const response = await request(app)
      .post('/api/scenes')
      .set('x-admin-token', ORGANIZER_TOKEN)
      .field('name', name)
      .attach('scene', body, filename);
    if (response.status === 201) {
      uploadedFilenames.push(response.body.scene.filename);
    }
    return response;
  }

  it('refuse l upload sans jeton organisateur (y compris avec un code de soiree)', async () => {
    const anonymous = await request(app).post('/api/scenes').attach('scene', RIVE_BYTES, 'x.riv');
    expect(anonymous.status).toBe(401);
    const eventAdmin = await request(app)
      .post('/api/scenes')
      .set('x-admin-token', CODE_A)
      .attach('scene', RIVE_BYTES, 'x.riv');
    expect(eventAdmin.status).toBe(401);
  });

  it('accepte un .riv valide et le sert sous /uploads/scenes/', async () => {
    const response = await uploadScene('Batiment reel', RIVE_BYTES);
    expect(response.status).toBe(201);
    expect(response.body.scene.name).toBe('Batiment reel');
    expect(response.body.scene.url).toMatch(/^\/uploads\/scenes\/scene-.+\.riv$/);
    expect(fs.existsSync(path.join(scenesDir(), response.body.scene.filename))).toBe(true);
  });

  it('refuse en 400 un fichier sans magic bytes RIVE et ne laisse rien sur disque', async () => {
    const before = fs.readdirSync(scenesDir()).length;
    const response = await uploadScene('Faux', NOT_RIVE_BYTES);
    expect(response.status).toBe(400);
    expect(fs.readdirSync(scenesDir()).length).toBe(before);
  });

  it('liste les scenes pour l admin de la soiree via ?eventId=', async () => {
    const response = await request(app)
      .get(`/api/scenes?eventId=${eventA}`)
      .set('x-admin-token', CODE_A);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.scenes)).toBe(true);
  });

  it('refuse la liste sans jeton', async () => {
    const response = await request(app).get('/api/scenes');
    expect(response.status).toBe(401);
  });

  it('DELETE guerit la soiree referente : visualMode none, sceneId et sceneUrl null, fichier supprime', async () => {
    const uploaded = await uploadScene('A supprimer', RIVE_BYTES);
    expect(uploaded.status).toBe(201);
    const sceneId = uploaded.body.scene.id;
    const filename = uploaded.body.scene.filename;

    const activation = await request(app)
      .put(`/api/events/${eventA}/config`)
      .set('x-admin-token', ORGANIZER_TOKEN)
      .send({ displaySettings: { visualMode: 'scene', sceneId } });
    expect(activation.status).toBe(200);

    const deletion = await request(app)
      .delete(`/api/scenes/${sceneId}`)
      .set('x-admin-token', ORGANIZER_TOKEN);
    expect(deletion.status).toBe(204);
    expect(fs.existsSync(path.join(scenesDir(), filename))).toBe(false);

    const config = await request(app).get(`/api/events/${eventA}/config`);
    expect(config.body.displaySettings.visualMode).toBe('none');
    expect(config.body.displaySettings.sceneId).toBeNull();
    expect(config.body.displaySettings.sceneUrl).toBeNull();
  });

  it('DELETE d un id inconnu renvoie 404', async () => {
    const response = await request(app)
      .delete('/api/scenes/999999')
      .set('x-admin-token', ORGANIZER_TOKEN);
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd backend && npx vitest run tests/routes/scenes.test.ts`
Expected: FAIL — 404 sur toutes les routes (`/api/scenes` non monté).

- [ ] **Step 3: Router + montage**

Créer `backend/src/routes/scenes.ts` :

```ts
import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { sceneService } from '../services/scene.service';
import { configService } from '../services/config.service';
import { donationService } from '../services/donation.service';
import { socketService } from '../services/socket.service';
import { requireAdmin, requireEventAdmin } from '../middleware/admin-auth';
import { uploadsRoot } from '../config/storage';
import { isInside } from '../middleware/path-boundary';

// ---------------------------------------------------------------------------
// /api/scenes — bibliotheque de scenes Rive (Atelier Scenes)
// ---------------------------------------------------------------------------
//
// Meme patron que routes/themes.ts : gestion (upload, suppression) reservee a
// l'organisateur ; la LISTE est ouverte a l'admin d'une soiree (?eventId=) car
// c'est lui qui choisit la scene a activer. L'activation elle-meme passe par
// PUT /config (displaySettings), pas par ce routeur.

const sceneUploadDir = path.join(uploadsRoot, 'scenes');
if (!fs.existsSync(sceneUploadDir)) {
  fs.mkdirSync(sceneUploadDir, { recursive: true });
}

const sceneStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, sceneUploadDir);
  },
  filename: (_req, _file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `scene-${uniqueSuffix}.riv`);
  }
});

// Un .riv arrive en application/octet-stream : le filtre multer ne peut juger
// que l'extension ; les magic bytes sont verifies apres ecriture, comme le
// contenu SVG dans routes/gifs.ts.
const sceneUpload = multer({
  storage: sceneStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max (spec §4)
  },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.riv') {
      cb(null, true);
    } else {
      cb(new Error('Only .riv files are allowed'));
    }
  }
});

function hasRiveMagicBytes(filePath: string): boolean {
  try {
    const header = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    try {
      fs.readSync(fd, header, 0, 4, 0);
    } finally {
      fs.closeSync(fd);
    }
    return header.equals(Buffer.from('RIVE', 'ascii'));
  } catch {
    return false;
  }
}

const scenesRouter = Router();

// GET /api/scenes[?eventId=] — liste. Avec eventId : admin de cette soiree ou
// organisateur. Sans eventId : organisateur seulement (meme regle que themes).
scenesRouter.get(
  '/',
  requireEventAdmin((req) => {
    const id = Number(req.query.eventId);
    return Number.isInteger(id) ? id : null;
  }),
  (_req: Request, res: Response) => {
    try {
      res.json({ scenes: sceneService.list() });
    } catch (error) {
      console.error('Error listing scenes:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/scenes — upload d'une scene (organisateur). Auth AVANT multer :
// un fichier n'est ecrit sur disque que pour une requete autorisee.
scenesRouter.post('/', requireAdmin, sceneUpload.single('scene'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No scene file uploaded' });
    }

    if (!hasRiveMagicBytes(req.file.path)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Not a valid Rive (.riv) file' });
    }

    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const name = rawName || path.basename(req.file.originalname, '.riv');
    const scene = sceneService.create(name, req.file.filename);
    res.status(201).json({ scene });
  } catch (error) {
    console.error('Error uploading scene:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to upload scene' });
  }
});

// DELETE /api/scenes/:id — suppression (organisateur). Les soirees qui
// referencaient la scene repassent en visualMode 'none' et leur config est
// rediffusee : l'ecran ne doit jamais pointer un fichier disparu (spec §6).
scenesRouter.delete('/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const scene = sceneService.get(id);
    if (!scene) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const referencingEvents = sceneService.eventsReferencing(id);
    sceneService.remove(id);

    for (const eventId of referencingEvents) {
      const config = configService.get(eventId);
      const healedSettings = {
        ...config.displaySettings,
        visualMode: 'none' as const,
        sceneId: null,
        sceneUrl: null
      };
      const updated = configService.update(eventId, { displaySettings: healedSettings });
      socketService.emitConfigUpdated(eventId, updated, donationService.getStats(eventId));
    }

    const filePath = path.join(sceneUploadDir, scene.filename);
    if (isInside(sceneUploadDir, filePath) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(204).end();
  } catch (error) {
    console.error('Error deleting scene:', error);
    res.status(500).json({ error: 'Failed to delete scene' });
  }
});

export default scenesRouter;
```

Dans `backend/src/app.ts` : ajouter l'import et le montage à côté des thèmes :

```ts
import scenesRouter from './routes/scenes';
```

```ts
  app.use('/api/themes', themesRouter);
  app.use('/api/events/:eventId/theme', eventThemeRouter);
  app.use('/api/scenes', scenesRouter);
```

- [ ] **Step 4: Vérifier le vert**

Run: `cd backend && npx vitest run tests/routes/scenes.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Gate + commit**

```bash
cd backend && npm test && npm run build
git add backend/src/routes/scenes.ts backend/src/app.ts backend/tests/routes/scenes.test.ts
git commit -m "feat(scenes): routes api/scenes avec upload organisateur et self-healing

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `sceneRuntime` (contrôleur Rive testable) + harnais vitest frontend

**Files:**
- Create: `frontend/src/scene/sceneRuntime.ts`
- Create: `frontend/vitest.config.ts`
- Modify: `frontend/package.json` (dépendance `@rive-app/canvas`, devDep `vitest`, script `test`)
- Test: `frontend/src/scene/sceneRuntime.test.ts`

**Interfaces:**
- Consumes: rien du dépôt (module autonome, runtime Rive injecté).
- Produces (utilisé par Task 5) :
  ```ts
  export interface RiveLikeInstance {
    stateMachineInputs(name: string): Array<{ name: string; value: number | boolean }>;
    resizeDrawingSurfaceToCanvas(): void;
    cleanup(): void;
  }
  export interface RiveLikeModule {
    Rive: new (params: {
      src: string;
      canvas: HTMLCanvasElement;
      autoplay: boolean;
      stateMachines: string;
      onLoad?: () => void;
      onLoadError?: () => void;
    }) => RiveLikeInstance;
  }
  export interface SceneRuntime { setProgress(percent: number): void; destroy(): void; }
  export function createSceneRuntime(options: {
    module: RiveLikeModule;
    canvas: HTMLCanvasElement;
    src: string;
    onError?: () => void;
  }): SceneRuntime
  ```
  Contrat de scène appliqué : state machine `Scene`, input `progress`, clamp 0–100.

- [ ] **Step 1: Installer les dépendances**

```bash
cd frontend && npm install @rive-app/canvas@^2 && npm install -D vitest@^2.1.9
```

Ajouter dans `frontend/package.json` → `scripts` : `"test": "vitest run"`.

Créer `frontend/vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config';

// Harnais minimal : le seul code frontend teste unitairement est le
// controleur de scene, du TypeScript pur sans DOM (canvas et runtime Rive
// injectes). Pas de jsdom, pas de @vue/test-utils : les composants restent
// couverts par vue-tsc + la verification navigateur.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
```

- [ ] **Step 2: Écrire le test qui échoue**

`frontend/src/scene/sceneRuntime.test.ts` :

```ts
import { describe, it, expect, vi } from 'vitest';
import { createSceneRuntime, type RiveLikeModule } from './sceneRuntime';

interface FakeParams {
  src: string;
  canvas: HTMLCanvasElement;
  autoplay: boolean;
  stateMachines: string;
  onLoad?: () => void;
  onLoadError?: () => void;
}

function makeFakeModule(inputs: Array<{ name: string; value: number | boolean }>) {
  const state = {
    params: null as FakeParams | null,
    cleanupCalls: 0,
    resizeCalls: 0
  };
  const module: RiveLikeModule = {
    Rive: class {
      constructor(params: FakeParams) {
        state.params = params;
      }
      stateMachineInputs(_name: string) {
        return inputs;
      }
      resizeDrawingSurfaceToCanvas() {
        state.resizeCalls += 1;
      }
      cleanup() {
        state.cleanupCalls += 1;
      }
    } as unknown as RiveLikeModule['Rive']
  };
  return { module, state };
}

const fakeCanvas = {} as HTMLCanvasElement;

describe('createSceneRuntime', () => {
  it('instancie Rive sur la state machine Scene avec autoplay', () => {
    const { module, state } = makeFakeModule([{ name: 'progress', value: 0 }]);
    createSceneRuntime({ module, canvas: fakeCanvas, src: '/uploads/scenes/x.riv' });
    expect(state.params?.stateMachines).toBe('Scene');
    expect(state.params?.autoplay).toBe(true);
    expect(state.params?.src).toBe('/uploads/scenes/x.riv');
  });

  it('applique le progress a l input apres onLoad, avec clamp 0-100', () => {
    const input = { name: 'progress', value: 0 };
    const { module, state } = makeFakeModule([input]);
    const runtime = createSceneRuntime({ module, canvas: fakeCanvas, src: 'x.riv' });

    runtime.setProgress(160); // avant chargement : memorise, pas applique
    expect(input.value).toBe(0);

    state.params?.onLoad?.();
    expect(state.resizeCalls).toBe(1);
    expect(input.value).toBe(100); // valeur memorisee, clampee

    runtime.setProgress(-12);
    expect(input.value).toBe(0);
    runtime.setProgress(61.8);
    expect(input.value).toBe(61.8);
  });

  it('signale onError quand la state machine n expose pas l input progress', () => {
    const onError = vi.fn();
    const { module, state } = makeFakeModule([{ name: 'autreChose', value: 0 }]);
    createSceneRuntime({ module, canvas: fakeCanvas, src: 'x.riv', onError });
    state.params?.onLoad?.();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('signale onError sur onLoadError (riv corrompu ou introuvable)', () => {
    const onError = vi.fn();
    const { module, state } = makeFakeModule([]);
    createSceneRuntime({ module, canvas: fakeCanvas, src: 'x.riv', onError });
    state.params?.onLoadError?.();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('destroy nettoie l instance Rive et reste idempotent', () => {
    const { module, state } = makeFakeModule([{ name: 'progress', value: 0 }]);
    const runtime = createSceneRuntime({ module, canvas: fakeCanvas, src: 'x.riv' });
    runtime.destroy();
    runtime.destroy();
    expect(state.cleanupCalls).toBe(1);
  });

  it('setProgress apres destroy est un no-op silencieux', () => {
    const input = { name: 'progress', value: 0 };
    const { module, state } = makeFakeModule([input]);
    const runtime = createSceneRuntime({ module, canvas: fakeCanvas, src: 'x.riv' });
    state.params?.onLoad?.();
    runtime.destroy();
    runtime.setProgress(50);
    expect(input.value).toBe(0);
  });
});
```

- [ ] **Step 3: Vérifier l'échec**

Run: `cd frontend && npm test`
Expected: FAIL — `Cannot find module './sceneRuntime'`.

- [ ] **Step 4: Implémenter le contrôleur**

`frontend/src/scene/sceneRuntime.ts` :

```ts
// Controleur du contrat de scene (spec §3) : state machine `Scene`, un seul
// input number `progress` (0-100). Le runtime Rive est INJECTE pour rester
// testable sans canvas ni wasm ; SceneDisplay.vue fournit le vrai module via
// import dynamique.

export interface RiveLikeInstance {
  stateMachineInputs(name: string): Array<{ name: string; value: number | boolean }>;
  resizeDrawingSurfaceToCanvas(): void;
  cleanup(): void;
}

export interface RiveLikeModule {
  Rive: new (params: {
    src: string;
    canvas: HTMLCanvasElement;
    autoplay: boolean;
    stateMachines: string;
    onLoad?: () => void;
    onLoadError?: () => void;
  }) => RiveLikeInstance;
}

export interface SceneRuntime {
  setProgress(percent: number): void;
  destroy(): void;
}

const STATE_MACHINE = 'Scene';
const PROGRESS_INPUT = 'progress';

function clamp(percent: number): number {
  if (!Number.isFinite(percent)) {
    return 0;
  }
  return Math.min(100, Math.max(0, percent));
}

export function createSceneRuntime(options: {
  module: RiveLikeModule;
  canvas: HTMLCanvasElement;
  src: string;
  onError?: () => void;
}): SceneRuntime {
  let destroyed = false;
  let progressInput: { name: string; value: number | boolean } | null = null;
  // La valeur peut arriver avant onLoad (snapshot initial) : on la memorise
  // et on l'applique des que la state machine est prete.
  let pendingProgress = 0;

  const instance = new options.module.Rive({
    src: options.src,
    canvas: options.canvas,
    autoplay: true,
    stateMachines: STATE_MACHINE,
    onLoad: () => {
      if (destroyed) {
        return;
      }
      instance.resizeDrawingSurfaceToCanvas();
      const inputs = instance.stateMachineInputs(STATE_MACHINE) ?? [];
      progressInput = inputs.find((input) => input.name === PROGRESS_INPUT) ?? null;
      if (!progressInput) {
        options.onError?.();
        return;
      }
      progressInput.value = clamp(pendingProgress);
    },
    onLoadError: () => {
      if (!destroyed) {
        options.onError?.();
      }
    }
  });

  return {
    setProgress(percent: number): void {
      if (destroyed) {
        return;
      }
      pendingProgress = clamp(percent);
      if (progressInput) {
        progressInput.value = pendingProgress;
      }
    },
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      progressInput = null;
      instance.cleanup();
    }
  };
}
```

- [ ] **Step 5: Vérifier le vert + gate + commit**

Run: `cd frontend && npm test` — Expected: PASS (6 tests).
Run: `cd frontend && npm run typecheck && npm run build` — Expected: exit 0.

```bash
git add frontend/src/scene/sceneRuntime.ts frontend/src/scene/sceneRuntime.test.ts frontend/vitest.config.ts frontend/package.json frontend/package-lock.json
git commit -m "feat(scenes): controleur sceneRuntime testable + harnais vitest frontend

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `SceneDisplay.vue` + branchement écran (`CampaignVisual`, `DisplayScreen`)

**Files:**
- Modify: `frontend/src/composables/useDonations.ts:45` (`DISPLAY_VISUAL_MODES`), interface `DisplaySettings` (~l.298), défauts (~l.314)
- Create: `frontend/src/components/display/SceneDisplay.vue`
- Modify: `frontend/src/components/display/CampaignVisual.vue`
- Modify: `frontend/src/components/display/DisplayScreen.vue` (l.44-55 computed + l.409-417 template)

**Interfaces:**
- Consumes: `createSceneRuntime` (Task 4), `stats.percentComplete` et `config.displaySettings` (déjà exposés par `useDonations` dans `DisplayScreen`, l.31-40).
- Produces : `SceneDisplay` props `{ sceneUrl: string; progress: number }`, émet `failed` ; `CampaignVisual` props étendues `{ mode, customSvgUrl?, sceneUrl?, progress? }`, ré-émet `scene-failed` ; miroir frontend de `sceneId`/`sceneUrl`.

- [ ] **Step 1: Miroir des types frontend**

`frontend/src/composables/useDonations.ts` :

- l.45 : `export const DISPLAY_VISUAL_MODES = ['none', 'menorah', 'custom', 'scene'] as const;`
- Dans l'interface `DisplaySettings`, après `customSvgUrl: string | null;` (l.299) :

```ts
  sceneId: number | null;
  sceneUrl: string | null;
```

- Dans l'objet de défauts, après `customSvgUrl: null,` (l.315) :

```ts
  sceneId: null,
  sceneUrl: null,
```

- Vérifier `frontend/src/theme/displayThemes.ts` (`cloneDisplaySettings`) : s'il clone champ par champ, ajouter `sceneId` et `sceneUrl` ; s'il fait un clone structurel, rien à faire.

- [ ] **Step 2: Créer `SceneDisplay.vue`**

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createSceneRuntime, type RiveLikeModule, type SceneRuntime } from '../../scene/sceneRuntime';

// Ecran d'une scene Rive (contrat spec §3) : un canvas, un input `progress`.
// Le runtime (~wasm) n'est charge qu'ici, en import dynamique : les soirees
// sans scene ne le paient pas. Toute defaillance emet `failed` — l'ecran
// retombe alors sur le visuel none, jamais de crash en soiree (spec §6).

const props = defineProps<{ sceneUrl: string; progress: number }>();
const emit = defineEmits<{ failed: [] }>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let runtime: SceneRuntime | null = null;

function teardown(): void {
  runtime?.destroy();
  runtime = null;
}

onMounted(async () => {
  if (!canvasRef.value) {
    emit('failed');
    return;
  }
  try {
    const riveModule = (await import('@rive-app/canvas')) as unknown as RiveLikeModule;
    runtime = createSceneRuntime({
      module: riveModule,
      canvas: canvasRef.value,
      src: props.sceneUrl,
      onError: () => {
        teardown();
        emit('failed');
      }
    });
    runtime.setProgress(props.progress);
  } catch (loadFailure) {
    console.warn('Scene runtime unavailable:', loadFailure);
    teardown();
    emit('failed');
  }
});

watch(() => props.progress, (value) => {
  runtime?.setProgress(value);
});

onBeforeUnmount(teardown);
</script>

<template>
  <canvas ref="canvasRef" class="scene-canvas" aria-hidden="true"></canvas>
</template>

<style scoped>
.scene-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
```

Note vue-tsc : le module réel `@rive-app/canvas` est structurellement compatible avec `RiveLikeModule` (constructeur `Rive` + les trois méthodes utilisées). Le cast `as unknown as RiveLikeModule` est là parce que le type réel du constructeur accepte bien plus de paramètres ; ne pas élargir `RiveLikeModule`, c'est la surface de test.

- [ ] **Step 3: Étendre `CampaignVisual.vue`**

Remplacer le contenu de `frontend/src/components/display/CampaignVisual.vue` par :

```vue
<script setup lang="ts">
import MenorahDisplay from './MenorahDisplay.vue';
import SceneDisplay from './SceneDisplay.vue';
import type { DisplayVisualMode } from '../../composables/useDonations';

defineProps<{
  mode: DisplayVisualMode;
  customSvgUrl?: string | null;
  sceneUrl?: string | null;
  progress?: number;
}>();

defineEmits<{ 'scene-failed': [] }>();
</script>

<template>
  <div class="campaign-visual" :class="`visual-${mode}`">
    <MenorahDisplay v-if="mode === 'menorah'" />
    <SceneDisplay
      v-else-if="mode === 'scene' && sceneUrl"
      :scene-url="sceneUrl"
      :progress="progress ?? 0"
      @failed="$emit('scene-failed')"
    />
    <img
      v-else-if="mode === 'custom' && customSvgUrl"
      :src="customSvgUrl"
      class="custom-visual"
      alt="Visuel personnalisé de la campagne"
    />
  </div>
</template>
```

(Conserver le bloc `<style scoped>` existant tel quel, en ajoutant à la règle `.campaign-visual :deep(.menorah-svg svg), .custom-visual` le sélecteur `.scene-canvas` — même dimensionnement `object-fit: contain` n'a pas de sens pour un canvas, ajouter à la place une règle dédiée :)

```css
.campaign-visual :deep(.scene-canvas) {
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 4: Brancher `DisplayScreen.vue`**

Dans le `<script setup>` (autour des l.44-55), ajouter après `const customSvgUrl = …` :

```ts
const sceneUrl = computed(() => config.value.displaySettings.sceneUrl ?? null);
// Une scene qui echoue au chargement retombe sur le visuel none (spec §6).
// Reinitialise quand l'admin change de scene : la nouvelle merite sa chance.
const sceneFailed = ref(false);
watch(sceneUrl, () => {
  sceneFailed.value = false;
});
```

(ajouter `ref` et `watch` à l'import Vue existant si absents), puis remplacer le computed `hasCampaignVisual` (l.52-55) par :

```ts
const hasCampaignVisual = computed(() =>
  visualMode.value === 'menorah'
  || (visualMode.value === 'custom' && Boolean(customSvgUrl.value))
  || (visualMode.value === 'scene' && Boolean(sceneUrl.value) && !sceneFailed.value)
);
```

Dans le template (l.413-416), enrichir les DEUX instances de `CampaignVisual` (avec et sans cadre) :

```html
<CampaignVisual
  :mode="visualMode"
  :custom-svg-url="customSvgUrl"
  :scene-url="sceneUrl"
  :progress="stats.percentComplete"
  @scene-failed="sceneFailed = true"
/>
```

- [ ] **Step 5: Gate + commit**

Run: `cd frontend && npm run typecheck && npm test && npm run build` — Expected: exit 0.
Run: `cd backend && npm test && npm run build` — Expected: toujours vert (aucun changement backend, non-régression).

```bash
git add frontend/src/composables/useDonations.ts frontend/src/components/display/SceneDisplay.vue frontend/src/components/display/CampaignVisual.vue frontend/src/components/display/DisplayScreen.vue frontend/src/theme/displayThemes.ts
git commit -m "feat(scenes): SceneDisplay pilote par percentComplete avec fallback none

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(Ne stager `displayThemes.ts` que s'il a été modifié à l'étape 1.)

---

### Task 6: Admin « Écran de salle » — carte « Scène animée » + sélecteur de bibliothèque

**Files:**
- Modify: `frontend/src/components/admin/DisplaySettingsPanel.vue` (carte après celle de `custom`, ~l.437 ; logique près de `selectVisualMode`, l.190)
- Modify: `frontend/src/composables/useAdminI18n.ts` (6 clés × 3 locales, ancres l.145/455/765)

**Interfaces:**
- Consumes: `GET /api/scenes?eventId=` (Task 3), `adminFetch` (`../../composables/useAdminAuth`, déjà importé l.19), `API_BASE` (l.34), `eventId` ref (l.47), `settings.sceneId`/`visualMode` (Task 5), clés i18n via `t()`.
- Produces: l'admin de soirée active une scène ; `settings.sceneId` part dans le `PUT /config` existant (barre d'enregistrement commune — aucun nouveau chemin de sauvegarde).

- [ ] **Step 1: Logique de chargement de la bibliothèque**

Dans le `<script setup>` de `DisplaySettingsPanel.vue`, après `function selectVisualMode(…)` (l.190-192) :

```ts
// Bibliotheque de scenes Rive (Atelier Scenes). Chargee a l'entree en mode
// scene ; l'upload reste hors app (organisateur, runbook de l'Atelier).
interface SceneOption { id: number; name: string; url: string; }
const scenes = ref<SceneOption[]>([]);
const scenesLoadError = ref('');
let scenesLoaded = false;

async function loadScenes(): Promise<void> {
  scenesLoadError.value = '';
  try {
    const query = eventId.value !== null ? `?eventId=${eventId.value}` : '';
    const response = await adminFetch(`${API_BASE}/api/scenes${query}`);
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'scenes load failed');
    }
    scenes.value = (result.scenes as SceneOption[]).map(({ id, name, url }) => ({ id, name, url }));
    scenesLoaded = true;
  } catch {
    scenesLoadError.value = t('display.visual.scene.loadError');
  }
}

function selectSceneMode(): void {
  selectVisualMode('scene');
  if (!scenesLoaded) {
    void loadScenes();
  }
}
```

Si `settings.visualMode === 'scene'` peut déjà être vrai à l'ouverture du panneau (config existante), charger aussi au montage : repérer le `onMounted` existant du composant et y ajouter :

```ts
  if (settings.value.visualMode === 'scene') {
    void loadScenes();
  }
```

- [ ] **Step 2: La carte + le sélecteur dans le template**

Après la carte `custom` dans `.visual-mode-grid` (même structure que les cartes l.400-435), ajouter :

```html
          <button
            type="button"
            class="visual-mode-card"
            :class="{ selected: settings.visualMode === 'scene' }"
            :aria-pressed="settings.visualMode === 'scene'"
            @click="selectSceneMode()"
          >
            <span class="visual-mode-preview scene-preview" aria-hidden="true">
              <span></span><span></span><span></span><span></span><span></span><span></span>
            </span>
            <span class="visual-mode-copy">
              <strong>{{ t('display.visual.scene.name') }}</strong>
              <small>{{ t('display.visual.scene.description') }}</small>
            </span>
            <span v-if="settings.visualMode === 'scene'" class="selected-badge">{{ t('common.active') }}</span>
          </button>
```

Juste après la fermeture de `.visual-mode-grid`, ajouter le sélecteur :

```html
        <div v-if="settings.visualMode === 'scene'" class="scene-picker">
          <label for="scene-picker-select">{{ t('display.visual.scene.selectLabel') }}</label>
          <select
            id="scene-picker-select"
            v-model.number="settings.sceneId"
            :disabled="scenes.length === 0"
          >
            <option v-for="scene in scenes" :key="scene.id" :value="scene.id">{{ scene.name }}</option>
          </select>
          <p v-if="scenesLoadError" class="scene-picker-error" role="alert">{{ scenesLoadError }}</p>
          <p v-else-if="scenes.length === 0" class="scene-picker-empty">{{ t('display.visual.scene.empty') }}</p>
        </div>
```

Style scoped (à côté des styles des cartes existantes) — `.scene-preview` en petite façade de fenêtres allumées, cohérente avec les previews voisines :

```css
.scene-preview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  padding: 6px;
}
.scene-preview span {
  border-radius: 2px;
  background: currentColor;
  opacity: 0.35;
  min-height: 8px;
}
.scene-preview span:nth-child(-n+3) {
  opacity: 0.9;
}
.scene-picker {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}
.scene-picker-error {
  color: var(--admin-danger, #b3261e);
}
.scene-picker-empty {
  opacity: 0.75;
}
```

(Adapter les noms de variables CSS à ceux réellement utilisés dans le fichier — reprendre la variable d'erreur déjà employée par `visualUploadError` à proximité.)

- [ ] **Step 3: Les 6 clés i18n × 3 locales**

Dans `frontend/src/composables/useAdminI18n.ts`, insérer immédiatement après la ligne `'display.visual.custom.description': …` de CHAQUE bloc de locale :

Bloc FR (après l.145) :

```ts
    'display.visual.scene.name': 'Scène animée',
    'display.visual.scene.description': 'Une scène Rive qui s’illumine au fil des dons.',
    'display.visual.scene.selectLabel': 'Scène à afficher',
    'display.visual.scene.empty': 'Aucune scène dans la bibliothèque pour le moment.',
    'display.visual.scene.loadError': 'Impossible de charger les scènes.',
```

Bloc EN (après l.455) :

```ts
    'display.visual.scene.name': 'Animated scene',
    'display.visual.scene.description': 'A Rive scene that lights up as donations come in.',
    'display.visual.scene.selectLabel': 'Scene to display',
    'display.visual.scene.empty': 'No scenes in the library yet.',
    'display.visual.scene.loadError': 'Unable to load scenes.',
```

Bloc HE (après l.765) :

```ts
    'display.visual.scene.name': 'סצנה מונפשת',
    'display.visual.scene.description': 'סצנת Rive שנדלקת בהדרגה עם התרומות.',
    'display.visual.scene.selectLabel': 'סצנה להצגה',
    'display.visual.scene.empty': 'אין עדיין סצנות בספרייה.',
    'display.visual.scene.loadError': 'לא ניתן לטעון את הסצנות.',
```

(5 clés par locale — le compteur de parité du dépôt doit rester aligné : vérifier qu'aucun bloc n'en reçoit plus que les autres.)

- [ ] **Step 4: Gate + commit**

Run: `cd frontend && npm run typecheck && npm test && npm run build` — Expected: exit 0.

```bash
git add frontend/src/components/admin/DisplaySettingsPanel.vue frontend/src/composables/useAdminI18n.ts
git commit -m "feat(scenes): carte Scene animee et selecteur de bibliotheque dans l admin

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: L'Atelier hors app — runbook, scripts, références

**Files (hors dépôt applicatif, nouveau dépôt git `D:\Menora\atelier-scenes\`):**
- Create: `D:\Menora\atelier-scenes\RUNBOOK.md`
- Create: `D:\Menora\atelier-scenes\scripts\simplify.ps1`
- Create: `D:\Menora\atelier-scenes\scripts\fetch-sample-riv.ps1`
- Create: `D:\Menora\atelier-scenes\scenes\building\THRESHOLDS.md`
- Copy: la source du POC (`D:\Menora\artifacts\building-svg-poc\scene-manifest.json` et le SVG `building-color-stacked.svg` s'il est présent dans ce dossier) vers `D:\Menora\atelier-scenes\scenes\building\reference\`

**Interfaces:**
- Consumes: POC `D:\Menora\artifacts\building-svg-poc\` (22 zones, seuils).
- Produces: le runbook exécutable par un humain ; `scenes/building/` prêt à recevoir `building.riv` (Task 9) ; un `.riv` d'exemple pour la vérification navigateur (Task 8).

- [ ] **Step 1: Initialiser le dépôt et copier les références**

```powershell
New-Item -ItemType Directory -Force D:\Menora\atelier-scenes\scripts, D:\Menora\atelier-scenes\scenes\building\reference
git -C D:\Menora\atelier-scenes init
Copy-Item D:\Menora\artifacts\building-svg-poc\scene-manifest.json D:\Menora\atelier-scenes\scenes\building\reference\
Get-ChildItem D:\Menora\artifacts\building-svg-poc\*.svg | Copy-Item -Destination D:\Menora\atelier-scenes\scenes\building\reference\
```

- [ ] **Step 2: `RUNBOOK.md`** — contenu complet :

```markdown
# Atelier Scènes — runbook de fabrication

Fabrique une scène Rive conforme au contrat de l'app menorah
(`docs/specs/2026-07-28-atelier-scenes-design.md`, §3). Une exécution = une
scène = un dossier sous `scenes/<nom>/`.

## Contrat de scène (rappel, non négociable)

- Un artboard unique ; state machine nommée exactement `Scene`.
- Un input **number** nommé exactement `progress`, plage 0–100.
- Les seuils d'illumination sont bakés dans la state machine.
- Transitions ≤ 2 s, sans flash ; pas de boucle agressive en régime établi.
- Le `.riv` est autonome (aucun asset externe) et pèse < 10 Mo.

## Étape 1 — Préparation de l'image

Objectif : une vue nette, cadrée, fond neutre. Au besoin, retravailler la
source avec OpenAI / Google / Midjourney (nettoyage, redressement,
complétion) — hors app, aucun outillage ici. Conserver l'original ET la
version préparée dans `scenes/<nom>/source/`.

## Étape 2 — Vectorisation (vtracer)

Référence POC : vtracer 0.6.15, mode couleur, hiérarchie stacked
(`scenes/building/reference/scene-manifest.json` → `source`).

    vtracer --input scenes/<nom>/source/prepared.png `
            --output scenes/<nom>/work/traced.svg `
            --colormode color --hierarchical stacked

Attendu : un SVG fidèle mais lourd (le POC : 2 822 chemins).

## Étape 3 — Simplification (OBLIGATOIRE, budget < 500 chemins)

    powershell -File scripts/simplify.ps1 -In scenes/<nom>/work/traced.svg -Out scenes/<nom>/work/simplified.svg

Puis, dans un éditeur SVG (Inkscape/Figma/Illustrator), regrouper les chemins
en CALQUES NOMMÉS PAR ZONE — pour le bâtiment, les 22 zones de
`scenes/building/THRESHOLDS.md`, noms de calques = `id` des zones. Compter
les chemins restants ; au-dessus de 500, fusionner encore (union par zone).

## Étape 4 — Animation (Rive Editor, travail HUMAIN)

1. Créer un fichier Rive, importer `simplified.svg` (les calques nommés
   arrivent comme nœuds).
2. Une timeline d'illumination par zone (opacité/teinte « éteint → allumé »,
   ≤ 2 s, easing doux).
3. State machine `Scene` : input number `progress` (0–100) ; chaque zone
   s'allume quand `progress` franchit son seuil (voir THRESHOLDS.md) —
   blend/layers par zone, seuils bakés dans les conditions.
4. Tester dans l'éditeur en balayant `progress` de 0 à 100 : ordre
   d'illumination du bas vers le haut, aucun flash.

## Étape 5 — Export + fiche + upload

1. Exporter `scenes/<nom>/<nom>.riv` (< 10 Mo) + une vignette PNG.
2. Compléter `scenes/<nom>/FICHE.md` : nom affiché, source, date, seuils.
3. Upload vers l'app (jeton ORGANISATEUR) :

       curl -X POST https://<hote>/api/scenes `
            -H "x-admin-token: <ORGANIZER_TOKEN>" `
            -F "name=<Nom affiché>" `
            -F "scene=@scenes/<nom>/<nom>.riv"

4. Activer dans l'admin de la soirée : Écran de salle → Scène animée →
   choisir la scène → Enregistrer.

## Vérification finale

Balayer des dons simulés jusqu'à 100 % de l'objectif sur une soirée de test
et comparer aux captures de référence (POC : 60 % et 100 %).
```

- [ ] **Step 3: `scripts/simplify.ps1`** :

```powershell
param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out
)
# Simplification SVGO multipasse : precision reduite, metadonnees purgees.
# Le regroupement en calques par zone reste un geste d'editeur (humain).
$config = Join-Path $PSScriptRoot 'svgo.config.mjs'
npx --yes svgo@3 --multipass --config $config -i $In -o $Out
$pathCount = (Select-String -Path $Out -Pattern '<path' -AllMatches).Matches.Count
Write-Host "Chemins apres simplification : $pathCount (budget contrat : < 500)"
if ($pathCount -ge 500) {
  Write-Warning 'Budget depasse : fusionner les chemins par zone dans un editeur SVG avant Rive.'
}
```

et `scripts/svgo.config.mjs` :

```js
export default {
  multipass: true,
  floatPrecision: 1,
  plugins: [
    'preset-default',
    'removeDimensions',
    'removeMetadata',
    'removeUselessDefs'
  ]
};
```

- [ ] **Step 4: `scripts/fetch-sample-riv.ps1`** (échantillon officiel pour les vérifications tant que `building.riv` n'existe pas) :

```powershell
param([string]$Out = (Join-Path $PSScriptRoot '..\samples\sample.riv'))
# Echantillon public officiel Rive (CDN de la doc). Sert UNIQUEMENT de fichier
# de fumee pour l'upload et le rendu — il n'a PAS la state machine `Scene`,
# donc l'ecran doit precisement montrer le fallback none avec lui.
New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
Invoke-WebRequest -Uri 'https://cdn.rive.app/animations/vehicles.riv' -OutFile $Out
Write-Host "Echantillon telecharge : $Out"
```

- [ ] **Step 5: `scenes/building/THRESHOLDS.md`** — générer depuis le manifeste POC la table des 22 zones (id, libellé, ordre, seuil %, preset) :

```powershell
$manifest = Get-Content D:\Menora\atelier-scenes\scenes\building\reference\scene-manifest.json | ConvertFrom-Json
$lines = @('# Bâtiment — zones et seuils (source : POC 2026-07-20)', '', '| Ordre | Zone (calque Rive) | Libellé | Seuil % | Preset |', '|---|---|---|---|---|')
$lines += $manifest.zones | Sort-Object order | ForEach-Object { "| $($_.order) | ``$($_.id)`` | $($_.label) | $($_.thresholdPercent) | $($_.animationPreset) |" }
Set-Content D:\Menora\atelier-scenes\scenes\building\THRESHOLDS.md $lines -Encoding UTF8
```

- [ ] **Step 6: Commit du dépôt atelier**

```bash
git -C D:/Menora/atelier-scenes add -A
git -C D:/Menora/atelier-scenes commit -m "atelier: runbook, simplification svgo, seuils batiment, echantillon riv

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Vérification navigateur + documentation vivante + gate final

**Files:**
- Create: `docs/verif/<date-du-jour>-atelier-scenes/` (captures)
- Modify: `docs/api-et-socket.md`, `docs/tests.md`, `docs/README.md`, `docs/historique.md`, `CLAUDE.md` (état), `docs/reste-a-faire.md`

**Interfaces:**
- Consumes: tout ce qui précède + `scripts/fetch-sample-riv.ps1` (Task 7) + playwright-cli.

- [ ] **Step 1: Monter l'app vérifiable**

```powershell
cd D:\Menora\menorah\frontend; npm run build
Copy-Item D:\Menora\menorah\frontend\dist\* D:\Menora\menorah\backend\public -Recurse -Force
# Lancer le backend avec auth reelle (sinon requireAdmin laisse tout passer) :
$env:ORGANIZER_TOKEN = 'verif-atelier-scenes'; cd D:\Menora\menorah\backend; npm run dev
```

(Vérifier dans `docs/deploiement.md` si un script de copie dist→public existe déjà ; l'utiliser à la place le cas échéant.)

- [ ] **Step 2: Préparer soirée + scène de test par l'API**

```powershell
$H = @{ 'x-admin-token' = 'verif-atelier-scenes' }
# Soiree de test (adapter au schema reel de POST /api/events, voir docs/api-et-socket.md)
$event = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/events -Headers $H -ContentType 'application/json' -Body '{"slug":"verif-scenes","name":"Verif Scenes"}'
# Upload de l echantillon .riv
powershell -File D:\Menora\atelier-scenes\scripts\fetch-sample-riv.ps1
$scene = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/scenes -Headers $H -Form @{ name = 'Echantillon'; scene = Get-Item D:\Menora\atelier-scenes\samples\sample.riv }
# Objectif bas pour atteindre 60/100 % avec quelques dons, puis activation
Invoke-RestMethod -Method Put -Uri "http://localhost:3000/api/events/$($event.event.id)/config" -Headers $H -ContentType 'application/json' -Body ('{"goalAmount":1000,"displaySettings":{"visualMode":"scene","sceneId":' + $scene.scene.id + '}}')
```

- [ ] **Step 3: Preuves playwright-cli**

Avec l'échantillon (sans state machine `Scene`) : ouvrir `/e/verif-scenes/display`, prouver le **fallback** — le canvas disparaît, l'écran reste sain, console sans erreur non maîtrisée. Puis, si `D:\Menora\atelier-scenes\scenes\building\building.riv` existe déjà (Task 9 faite), rejouer avec la vraie scène : captures à 0 %, ~60 % et 100 % en postant des dons opérateur, parité visuelle avec le POC. Captures nommées `01-fallback-sain.png`, `02-scene-0.png`, `03-scene-60.png`, `04-scene-100.png` dans `docs/verif/<date>-atelier-scenes/`. Vérifier aussi : l'admin affiche la carte « Scène animée » dans les 3 langues (captures fr/he), et une célébration par palier continue de fonctionner en mode scène (non-régression).

- [ ] **Step 4: Documentation vivante (même commit que les preuves)**

- `docs/api-et-socket.md` : section `/api/scenes` (3 routes, gardes, formats) + champs `sceneId`/`sceneUrl` de `displaySettings` + le contrat de scène (state machine `Scene`, input `progress` 0–100, réécriture serveur de `sceneUrl`).
- `docs/tests.md` : le gate frontend gagne `cd frontend && npm test` (vitest node-env, contrôleur de scène) — et le mentionner dans la ligne de gate.
- `docs/README.md` : dates de fraîcheur des documents touchés + ligne `verif/` mise à jour.
- `docs/historique.md` : entrée changelog datée (Atelier Scènes v1 : bibliothèque, mode scène, SceneDisplay, atelier hors app).
- `CLAUDE.md` : bloc « État au … » mis à jour (fonctionnalité livrée sur branche, `railway up` toujours en attente).
- `docs/reste-a-faire.md` : ajouter « fabriquer `building.riv` (Rive Editor, humain — runbook atelier-scenes) » si Task 9 pas encore faite.

- [ ] **Step 5: Gate final + commit + push**

```bash
cd backend && npm test && npm run build
cd ../frontend && npm run typecheck && npm test && npm run build
git add docs/
git commit -m "docs(scenes): preuves navigateur et doc synchronisee (api, tests, historique)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push -u origin feat/atelier-scenes-2026-07-28
```

Pas de merge master ni `railway up` sans feu vert du commanditaire.

---

### Task 9: Fabrication de `building.riv` — GESTE HUMAIN (Rive Editor)

**Files:**
- Create (humain, via runbook Task 7) : `D:\Menora\atelier-scenes\scenes\building\building.riv` + `FICHE.md` + vignette

Cette tâche ne peut PAS être exécutée par un agent : Rive Editor est une
application graphique. Elle suit le runbook (étapes 1→5) avec la source du
POC. Vérifier au passage le plan Rive Editor (gratuit vs payant) — risque
noté spec §9.

- [ ] **Step 1 (humain):** dérouler le runbook jusqu'à l'export `building.riv`.
- [ ] **Step 2 (agent, après dépôt du fichier):** upload organisateur, activation sur la soirée de vérification, rejouer les captures 0/60/100 % de Task 8 Step 3 avec la vraie scène, compléter `docs/verif/` et la ligne `reste-a-faire.md`, commit :

```bash
git add docs/
git commit -m "docs(scenes): preuves navigateur avec la scene batiment reelle

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Couverture spec → tasks (auto-vérification)

| Spec | Task |
|---|---|
| §3 pipeline atelier + contrat | 7 (runbook/scripts), 9 (fabrication) |
| §4 backend table/routes/validation | 1, 2, 3 |
| §4 admin (carte + sélecteur, rôles) | 6 |
| §4 écran (SceneDisplay, lazy, unmount) | 4, 5 |
| §5 flux serveur → progress | 2 (résolution), 5 (branchement stats) |
| §6 erreurs (fallback, 400, self-healing, reduced-motion*) | 2, 3, 4, 5 |
| §7 tests + vérif navigateur + gate | 1-6 (TDD), 8 |
| §10 critères de done | 8, 9 |

*Reduced-motion : le contrat impose des transitions sobres côté scène (runbook) ; `progress` est appliqué directement sans tween côté app — comportement couvert par le contrôleur (Task 4), rien de plus à coder.
