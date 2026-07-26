# LOT 0a — Sécurité des données donateurs : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fermer l'exposition publique des noms, téléphones et emails des donateurs, sans casser l'écran public qui dépend de la même route.

**Architecture:** La donnée publique et la donnée personnelle sont séparées au niveau de la réponse HTTP, pas au niveau de la route. `GET /api/donations` renvoie par défaut une **projection publique** (nom, montant) — le dépouillement est le comportement par défaut, donc un oubli de garde échoue *fermé*. Le payload complet exige `?full=1` + token admin. L'export CSV et `GET /:id`, qui n'ont aucun usage public, sont fermés sèchement. Le middleware d'auth cesse de laisser passer quand le secret est absent en production.

**Tech Stack:** TypeScript 5.3, Express 4, sql.js, Vue 3 + Vite. Tests : **Vitest + Supertest** (à amorcer — aucune infrastructure de test n'existe aujourd'hui).

## Global Constraints

- **Aucune régression sur `/display`, `/display-light`, `/display-hidden` ni `/don`** : ces pages appellent `/api/donations` sans token et doivent continuer de fonctionner à l'identique.
- **`ADMIN_TOKEN` doit être positionné sur Railway AVANT le déploiement de la Task 5**, sinon l'admin se verrouille lui-même. Voir la section « Pré-requis de déploiement ».
- Projection publique = exactement `id, firstName, lastName, amount, premiumWordId, createdAt`. Jamais `email`, `phone`, `reference`, `updatedAt`.
- Les tests ne doivent **jamais** toucher `backend/db/donations.db`. Isolation par `DATA_DIR`.
- TypeScript strict, types de retour explicites, `const` par défaut (convention `CLAUDE.md`).
- Commits fréquents, un par task.

## Pré-requis de déploiement — VÉRIFIÉ, aucun blocage

La Task 5 rend le middleware « fail-closed » : sans `ADMIN_TOKEN`, les routes admin renvoient 503 en production. Si la variable n'était pas positionnée, l'admin deviendrait inaccessible dès le déploiement.

**Vérifié le 2026-07-26 par sonde non destructive sur la production** :

```
PUT /api/donations/999999  (id inexistant, aucune mutation possible)  → 401
GET /api/donations/export.csv                                        → 200
```

- [x] `ADMIN_TOKEN` **est** positionné sur Railway — le 401 sur `PUT` le prouve. La Task 5 ne verrouillera personne.
- [x] La fuite est confirmée active : `export.csv` renvoie 200 sans aucun token.

### Précision sur la cause réelle

`/admin` affiche les donateurs en production **non pas** parce que l'authentification serait désactivée — elle fonctionne, comme le montre le 401 sur `PUT`. La cause est uniquement l'**absence de garde sur les routes `GET`** (`donations.ts:44`, `:78`, `:91`).

Le fail-open de `admin-auth.ts:8-11` est donc un **défaut latent** (il s'activerait si la variable disparaissait d'un environnement), pas la cause de la fuite actuelle. La Task 5 reste nécessaire à ce titre, mais ce sont les Tasks 2 à 4 qui referment la fuite.

> Rappel du dépôt : l'auto-deploy GitHub de ce service a déjà échoué à se déclencher sur un `git push`. Vérifier que le déploiement part réellement, ou le déclencher manuellement.

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `backend/src/app.ts` | **Créé.** Construit et retourne l'app Express, sans écouter ni initialiser la base. Rend le backend attaquable par Supertest. |
| `backend/src/index.ts` | **Modifié.** Devient le seul point d'entrée : init base, scheduler, `listen`. |
| `backend/vitest.config.ts` | **Créé.** Runner + `DATA_DIR` isolé. |
| `backend/tests/helpers/app.ts` | **Créé.** Fabrique app + base initialisée pour les tests. |
| `backend/tests/security/donations-pii.test.ts` | **Créé.** Verrouille la non-exposition des données personnelles. |
| `backend/tests/security/admin-auth.test.ts` | **Créé.** Verrouille le comportement fail-closed. |
| `backend/src/models/donation.ts` | **Modifié.** Ajout de `PublicDonation` + `toPublicDonation()`. |
| `backend/src/routes/donations.ts` | **Modifié.** Projection par défaut, garde sur `?full=1`, `export.csv` et `/:id` fermés. |
| `backend/src/middleware/admin-auth.ts` | **Modifié.** Fail-closed en production. |
| `frontend/src/composables/useDonations.ts` | **Modifié.** `fetchDonations({ full })`. |
| `frontend/src/pages/AdminPanel.vue` | **Modifié.** Seul appelant qui demande le payload complet. |
| `frontend/src/components/admin/DonationList.vue` | **Modifié.** Export CSV via `adminFetch` + blob, pour que le flux prompt-sur-401 fonctionne. |

---

## Task 1: Harnais de test et app Express testable

Sans app exportable, aucun test HTTP n'est possible : `index.ts` démarre le serveur à l'import. Cette task extrait la construction de l'app et amorce Vitest.

**Files:**
- Create: `backend/src/app.ts`
- Create: `backend/vitest.config.ts`
- Create: `backend/tests/helpers/app.ts`
- Create: `backend/tests/smoke.test.ts`
- Modify: `backend/src/index.ts` (remplacement complet)
- Modify: `backend/package.json` (scripts + devDependencies)

**Interfaces:**
- Consumes: rien.
- Produces:
  - `createApp(): express.Express` depuis `src/app.ts`
  - `createTestApp(): Promise<express.Express>` depuis `tests/helpers/app.ts`

- [ ] **Step 1: Installer Vitest et Supertest**

```bash
cd backend
npm install --save-dev vitest@^2.1.8 supertest@^7.0.0 @types/supertest@^6.0.2
```

- [ ] **Step 2: Ajouter les scripts de test**

Dans `backend/package.json`, section `scripts`, ajouter :

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Créer la configuration Vitest avec base isolée**

`storage.ts:4` lit `process.env.DATA_DIR` **au chargement du module**. La variable doit donc être posée avant l'évaluation des imports — c'est exactement ce que fait le champ `env` de Vitest.

Créer `backend/vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Base de test isolée : ne doit JAMAIS pointer vers backend/db/
    env: {
      DATA_DIR: path.resolve(__dirname, '.tmp-test-data'),
      NODE_ENV: 'test'
    },
    // sql.js charge un wasm : laisser de la marge au premier démarrage
    testTimeout: 20000,
    hookTimeout: 20000
  }
});
```

- [ ] **Step 4: Ignorer le dossier de données de test**

Ajouter à `backend/.gitignore` (créer le fichier s'il n'existe pas) :

```
.tmp-test-data/
```

- [ ] **Step 5: Extraire `createApp()`**

Créer `backend/src/app.ts` :

```ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import donationsRouter from './routes/donations';
import statsRouter from './routes/stats';
import configRouter from './routes/config';
import gifsRouter from './routes/gifs';
import adminRouter from './routes/admin';
import { uploadsRoot } from './config/storage';

// Construit l'app Express sans effet de bord : ni base de donnees, ni listen.
// Permet a Supertest de l'attaquer directement.
export function createApp(): express.Express {
  const app = express();

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }));

  app.use(express.json());

  const publicPath = path.join(__dirname, '../public');
  app.use('/uploads', express.static(uploadsRoot));
  app.use(express.static(publicPath));

  app.use('/api/donations', donationsRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/config', configRouter);
  app.use('/api/gifs', gifsRouter);
  app.use('/api/admin', adminRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  return app;
}
```

- [ ] **Step 6: Réduire `index.ts` au démarrage**

Remplacer **tout** le contenu de `backend/src/index.ts` par :

```ts
import { createServer } from 'http';
import { createApp } from './app';
import { initDatabase } from './db/init';
import { socketService } from './services/socket.service';
import { startBackupScheduler } from './services/backup.service';

const app = createApp();
const server = createServer(app);

socketService.init(server);

const PORT = process.env.PORT || 3000;

async function start(): Promise<void> {
  await initDatabase();
  startBackupScheduler();
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
```

> Note : `socketService.init(server)` reste dans `index.ts`. Les tests n'ont pas besoin de Socket.IO, et l'y inclure ouvrirait des handles qui empêcheraient Vitest de se terminer.

- [ ] **Step 7: Créer le helper de test**

Créer `backend/tests/helpers/app.ts` :

```ts
import type express from 'express';
import { createApp } from '../../src/app';
import { initDatabase } from '../../src/db/init';

let cached: express.Express | null = null;

// Initialise la base de test une seule fois puis reutilise l'app.
// La base vit dans DATA_DIR (voir vitest.config.ts), jamais dans backend/db/.
export async function createTestApp(): Promise<express.Express> {
  if (!cached) {
    await initDatabase();
    cached = createApp();
  }
  return cached;
}
```

- [ ] **Step 8: Écrire le test de fumée**

Créer `backend/tests/smoke.test.ts` :

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from './helpers/app';

describe('harnais de test', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('repond sur /api/health', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it("n'ecrit pas dans la base de production", () => {
    expect(process.env.DATA_DIR).toBeTruthy();
    expect(process.env.DATA_DIR).toContain('.tmp-test-data');
  });
});
```

- [ ] **Step 9: Lancer les tests**

Run: `cd backend && npm test`
Expected: 2 tests PASS. Un dossier `backend/.tmp-test-data/` apparaît avec `donations.db`.

- [ ] **Step 10: Vérifier que la base de production est intacte**

Run: `cd backend && git status --short db/`
Expected: **aucune sortie** — `db/donations.db` n'a pas été modifié par les tests.

- [ ] **Step 11: Vérifier que le serveur démarre toujours**

Run: `cd backend && npm run build`
Expected: compilation sans erreur.

- [ ] **Step 12: Commit**

```bash
git add backend/src/app.ts backend/src/index.ts backend/vitest.config.ts backend/tests backend/package.json backend/package-lock.json backend/.gitignore
git commit -m "test(backend): amorce Vitest + Supertest et extrait createApp()

index.ts demarrait le serveur a l'import, rendant tout test HTTP
impossible. La construction de l'app passe dans src/app.ts ; index.ts
ne garde que l'initialisation et le listen.

La base de test est isolee via DATA_DIR pour ne jamais toucher
backend/db/donations.db.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Fermer l'export CSV

C'est la fuite la plus grave : le CSV contient email **et** téléphone de tous les donateurs (`routes/donations.ts:50-61`).

**Files:**
- Create: `backend/tests/security/donations-pii.test.ts`
- Modify: `backend/src/routes/donations.ts:44`

**Interfaces:**
- Consumes: `createTestApp()` de la Task 1.
- Produces: rien de nouveau.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `backend/tests/security/donations-pii.test.ts` :

```ts
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../helpers/app';

const ADMIN_TOKEN = 'test-admin-token';

describe('protection des donnees donateurs', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterEach(() => {
    delete process.env.ADMIN_TOKEN;
  });

  describe('GET /api/donations/export.csv', () => {
    it('refuse sans token admin', async () => {
      process.env.ADMIN_TOKEN = ADMIN_TOKEN;

      const response = await request(app).get('/api/donations/export.csv');

      expect(response.status).toBe(401);
    });

    it('accepte avec le token en en-tete', async () => {
      process.env.ADMIN_TOKEN = ADMIN_TOKEN;

      const response = await request(app)
        .get('/api/donations/export.csv')
        .set('x-admin-token', ADMIN_TOKEN);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('accepte avec le token en query (telechargement par lien)', async () => {
      process.env.ADMIN_TOKEN = ADMIN_TOKEN;

      const response = await request(app)
        .get(`/api/donations/export.csv?token=${ADMIN_TOKEN}`);

      expect(response.status).toBe(200);
    });
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd backend && npx vitest run tests/security/donations-pii.test.ts -t "refuse sans token admin"`
Expected: FAIL — reçu 200 au lieu de 401.

- [ ] **Step 3: Ajouter la garde**

Dans `backend/src/routes/donations.ts`, ligne 44, remplacer :

```ts
router.get('/export.csv', (req: Request, res: Response) => {
```

par :

```ts
router.get('/export.csv', requireAdmin, (req: Request, res: Response) => {
```

`requireAdmin` est déjà importé (`donations.ts:6`) et accepte déjà le token en query (`admin-auth.ts:16`), ce qui couvre le téléchargement par lien.

- [ ] **Step 4: Lancer les tests**

Run: `cd backend && npx vitest run tests/security/donations-pii.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/donations.ts backend/tests/security/donations-pii.test.ts
git commit -m "fix(security): protege l'export CSV des donnees donateurs

GET /api/donations/export.csv renvoyait noms, emails et telephones de
tous les donateurs a qui connaissait l'URL. La route exige desormais le
token admin, accepte en en-tete ou en query pour le telechargement par
lien.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Projection publique sur la liste des dons

`GET /api/donations` ne peut pas être fermée : `useDonations.ts:275` l'appelle sans token depuis `/display`, `/display-light`, `/display-hidden`. La réponse est donc dépouillée **par défaut**, et le payload complet devient une demande explicite et gardée.

**Files:**
- Modify: `backend/src/models/donation.ts`
- Modify: `backend/src/routes/donations.ts:78-88`
- Modify: `backend/tests/security/donations-pii.test.ts`

**Interfaces:**
- Consumes: `Donation` (déjà défini dans `models/donation.ts`).
- Produces:
  - `type PublicDonation = Pick<Donation, 'id' | 'firstName' | 'lastName' | 'amount' | 'premiumWordId' | 'createdAt'>`
  - `function toPublicDonation(donation: Donation): PublicDonation`

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `backend/tests/security/donations-pii.test.ts`, ajouter **avant** la dernière accolade fermante du `describe` principal :

```ts
  describe('GET /api/donations', () => {
    it('reste ouvert : l ecran public en depend', async () => {
      const response = await request(app).get('/api/donations');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.donations)).toBe(true);
      expect(response.body.stats).toBeDefined();
    });

    it('n expose ni email, ni telephone, ni reference', async () => {
      await request(app)
        .post('/api/donations')
        .send({
          firstName: 'Test',
          lastName: 'Projection',
          amount: 500000,
          email: 'fuite@example.com',
          phone: '0500000000',
          reference: 'REF-SECRETE'
        });

      const response = await request(app).get('/api/donations');

      expect(response.status).toBe(200);
      expect(response.body.donations.length).toBeGreaterThan(0);

      for (const donation of response.body.donations) {
        expect(donation).not.toHaveProperty('email');
        expect(donation).not.toHaveProperty('phone');
        expect(donation).not.toHaveProperty('reference');
      }

      // Le corps entier ne doit contenir aucune trace des valeurs sensibles
      const raw = JSON.stringify(response.body);
      expect(raw).not.toContain('fuite@example.com');
      expect(raw).not.toContain('0500000000');
      expect(raw).not.toContain('REF-SECRETE');
    });

    it('conserve ce dont l ecran public a besoin', async () => {
      const response = await request(app).get('/api/donations');
      const donation = response.body.donations[0];

      expect(donation).toHaveProperty('id');
      expect(donation).toHaveProperty('firstName');
      expect(donation).toHaveProperty('lastName');
      expect(donation).toHaveProperty('amount');
      expect(donation).toHaveProperty('createdAt');
    });

    it('refuse ?full=1 sans token admin', async () => {
      process.env.ADMIN_TOKEN = ADMIN_TOKEN;

      const response = await request(app).get('/api/donations?full=1');

      expect(response.status).toBe(401);
    });

    it('renvoie le payload complet avec ?full=1 et token', async () => {
      process.env.ADMIN_TOKEN = ADMIN_TOKEN;

      const response = await request(app)
        .get('/api/donations?full=1')
        .set('x-admin-token', ADMIN_TOKEN);

      expect(response.status).toBe(200);
      const donation = response.body.donations[0];
      expect(donation).toHaveProperty('email');
      expect(donation).toHaveProperty('phone');
      expect(donation).toHaveProperty('reference');
    });
  });
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd backend && npx vitest run tests/security/donations-pii.test.ts -t "n expose ni email"`
Expected: FAIL — la propriété `email` est présente.

- [ ] **Step 3: Ajouter la projection au modèle**

Dans `backend/src/models/donation.ts`, ajouter à la fin du fichier :

```ts
// Projection publique : ce que l'ecran de la salle et la page /don peuvent voir.
// Nom et montant sont publics par nature (projetes sur un mur) ;
// email, telephone et reference ne le sont jamais.
export type PublicDonation = Pick<
  Donation,
  'id' | 'firstName' | 'lastName' | 'amount' | 'premiumWordId' | 'createdAt'
>;

export function toPublicDonation(donation: Donation): PublicDonation {
  return {
    id: donation.id,
    firstName: donation.firstName,
    lastName: donation.lastName,
    amount: donation.amount,
    premiumWordId: donation.premiumWordId,
    createdAt: donation.createdAt
  };
}
```

> Aucun import à ajouter : `Donation` est déjà importé depuis `./types` en tête de `models/donation.ts` (ligne 1).

- [ ] **Step 4: Appliquer la projection dans la route**

Dans `backend/src/routes/donations.ts`, ajouter à l'import de la ligne 4 :

```ts
import { validateCreateRequest, validateUpdateRequest, toPublicDonation } from '../models/donation';
```

Puis remplacer **tout** le bloc des lignes 77-88 :

```ts
// GET /api/donations - List all donations
router.get('/', (_req: Request, res: Response) => {
  try {
    const donations = donationService.getAll();
    const stats = donationService.getStats();

    res.json({ donations, stats });
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

par :

```ts
// Le payload complet (email, telephone, reference) est une demande explicite.
const wantsFullPayload = (req: Request): boolean => req.query.full === '1';

// GET /api/donations - liste depouillee par defaut (l'ecran public en depend).
// GET /api/donations?full=1 - payload complet, reserve a l'admin.
// Le depouillement etant le comportement par defaut, un oubli de garde
// echoue ferme : on n'expose jamais de donnee personnelle par accident.
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  if (wantsFullPayload(req)) {
    requireAdmin(req, res, next);
    return;
  }
  next();
}, (req: Request, res: Response) => {
  try {
    const donations = donationService.getAll();
    const stats = donationService.getStats();

    res.json({
      donations: wantsFullPayload(req) ? donations : donations.map(toPublicDonation),
      stats
    });
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

Ajouter `NextFunction` à l'import Express de la ligne 1 :

```ts
import { Router, Request, Response, NextFunction } from 'express';
```

- [ ] **Step 5: Lancer les tests**

Run: `cd backend && npx vitest run tests/security/donations-pii.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 6: Vérifier la compilation**

Run: `cd backend && npm run build`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add backend/src/models/donation.ts backend/src/routes/donations.ts backend/tests/security/donations-pii.test.ts
git commit -m "fix(security): projection publique par defaut sur la liste des dons

GET /api/donations exposait email, telephone et reference de chaque
donateur. La route ne pouvait pas etre fermee : les pages /display
l'appellent sans token.

La reponse est desormais depouillee par defaut ; le payload complet
exige ?full=1 plus le token admin. Le depouillement etant le
comportement par defaut, un oubli de garde echoue ferme.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Fermer `GET /api/donations/:id`

Cette route renvoie une donation complète, données personnelles incluses (`routes/donations.ts:91-108`). Aucun code frontend ne l'appelle — vérifié par `grep -rn "api/donations" frontend/src`. Elle peut être fermée sèchement.

**Files:**
- Modify: `backend/src/routes/donations.ts:91`
- Modify: `backend/tests/security/donations-pii.test.ts`

**Interfaces:**
- Consumes: `createTestApp()`.
- Produces: rien.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `backend/tests/security/donations-pii.test.ts`, ajouter avant la dernière accolade fermante du `describe` principal :

```ts
  describe('GET /api/donations/:id', () => {
    it('refuse sans token admin', async () => {
      process.env.ADMIN_TOKEN = ADMIN_TOKEN;

      const response = await request(app).get('/api/donations/1');

      expect(response.status).toBe(401);
    });

    it('accepte avec le token admin', async () => {
      process.env.ADMIN_TOKEN = ADMIN_TOKEN;

      const response = await request(app)
        .get('/api/donations/1')
        .set('x-admin-token', ADMIN_TOKEN);

      expect([200, 404]).toContain(response.status);
    });
  });
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd backend && npx vitest run tests/security/donations-pii.test.ts -t "GET /api/donations/:id"`
Expected: FAIL — reçu 200 au lieu de 401.

- [ ] **Step 3: Ajouter la garde**

Dans `backend/src/routes/donations.ts`, remplacer :

```ts
router.get('/:id', (req: Request, res: Response) => {
```

par :

```ts
router.get('/:id', requireAdmin, (req: Request, res: Response) => {
```

- [ ] **Step 4: Lancer toute la suite**

Run: `cd backend && npm test`
Expected: 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/donations.ts backend/tests/security/donations-pii.test.ts
git commit -m "fix(security): protege GET /api/donations/:id

La route renvoyait une donation complete, donnees personnelles
incluses. Aucun code frontend ne l'appelle : fermeture seche.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Le middleware cesse de laisser passer sans secret

`admin-auth.ts:8-11` appelle `next()` quand `ADMIN_TOKEN` est absent. C'est ce qui rend `/admin` ouvert en production aujourd'hui. Le contournement doit rester possible en développement local, mais jamais en production.

> **Avant d'exécuter cette task, la section « Pré-requis de déploiement » doit être cochée.** Sans `ADMIN_TOKEN` sur Railway, le déploiement verrouille l'admin.

**Files:**
- Create: `backend/tests/security/admin-auth.test.ts`
- Modify: `backend/src/middleware/admin-auth.ts` (remplacement complet)
- Modify: `backend/src/index.ts` (avertissement au démarrage)

**Interfaces:**
- Consumes: `createTestApp()`.
- Produces: `requireAdmin` conserve exactement sa signature `(req, res, next) => void`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `backend/tests/security/admin-auth.test.ts` :

```ts
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../helpers/app';

describe('requireAdmin sans secret configure', () => {
  let app: express.Express;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.ADMIN_TOKEN;
  });

  it('refuse en production quand ADMIN_TOKEN est absent', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_TOKEN;

    const response = await request(app).get('/api/donations/export.csv');

    expect(response.status).toBe(503);
    expect(response.body.error).toContain('not configured');
  });

  it('refuse en production quand ADMIN_TOKEN est vide', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_TOKEN = '   ';

    const response = await request(app).get('/api/donations/export.csv');

    expect(response.status).toBe(503);
  });

  it('laisse passer en developpement local pour ne pas gener le dev', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ADMIN_TOKEN;

    const response = await request(app).get('/api/donations/export.csv');

    expect(response.status).toBe(200);
  });

  it('refuse un mauvais token meme en developpement', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ADMIN_TOKEN = 'le-bon-token';

    const response = await request(app)
      .get('/api/donations/export.csv')
      .set('x-admin-token', 'le-mauvais-token');

    expect(response.status).toBe(401);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd backend && npx vitest run tests/security/admin-auth.test.ts`
Expected: les 2 premiers tests FAIL — reçu 200 au lieu de 503.

- [ ] **Step 3: Rendre le middleware fail-closed**

Remplacer **tout** le contenu de `backend/src/middleware/admin-auth.ts` par :

```ts
import { Request, Response, NextFunction } from 'express';

// Protege les routes admin et les routes exposant des donnees personnelles.
//
// Sans ADMIN_TOKEN configure :
//   - en production, la requete est REFUSEE (503). Laisser passer reviendrait
//     a publier les donnees des donateurs a qui connait l'URL.
//   - hors production, la requete passe, pour ne pas gener le developpement local.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = process.env.ADMIN_TOKEN?.trim();

  if (!token) {
    if (process.env.NODE_ENV === 'production') {
      console.error('SECURITY: ADMIN_TOKEN absent — requete admin refusee');
      res.status(503).json({ error: 'Admin authentication is not configured' });
      return;
    }
    next();
    return;
  }

  const provided = req.header('x-admin-token')
    || (typeof req.query.token === 'string' ? req.query.token : '');

  if (provided === token) {
    next();
    return;
  }

  res.status(401).json({ error: 'Unauthorized: admin token required' });
}
```

- [ ] **Step 4: Avertir au démarrage**

Dans `backend/src/index.ts`, insérer dans `start()`, juste après `await initDatabase();` :

```ts
  if (!process.env.ADMIN_TOKEN?.trim()) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        'SECURITY: ADMIN_TOKEN absent en production — toutes les routes admin renverront 503. Configurez la variable.'
      );
    } else {
      console.warn('ADMIN_TOKEN absent : routes admin ouvertes (mode developpement).');
    }
  }
```

- [ ] **Step 5: Lancer toute la suite**

Run: `cd backend && npm test`
Expected: 16 tests PASS.

- [ ] **Step 6: Vérifier la compilation**

Run: `cd backend && npm run build`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add backend/src/middleware/admin-auth.ts backend/src/index.ts backend/tests/security/admin-auth.test.ts
git commit -m "fix(security): l'absence d'ADMIN_TOKEN ne vaut plus acces libre

Le middleware appelait next() quand le secret n'etait pas configure,
ce qui laissait /admin et les donnees donateurs ouverts en production.

Desormais : 503 en production, passage tolere hors production pour ne
pas gener le developpement local. Avertissement explicite au demarrage.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Adapter le frontend au payload dépouillé

Le backend étant verrouillé, l'admin doit maintenant demander explicitement le payload complet — il a besoin de `reference` dans la liste (`DonationList.vue:101-106`) et de `phone`/`email` dans le formulaire d'édition (`DonationForm.vue:21-24`).

**Files:**
- Modify: `frontend/src/composables/useDonations.ts:270-287`
- Modify: `frontend/src/pages/AdminPanel.vue:70`
- Modify: `frontend/src/components/admin/DonationList.vue:13` et `:56`

**Interfaces:**
- Consumes: `adminFetch()` de `composables/useAdminAuth.ts` (existant).
- Produces: `fetchDonations(options?: { full?: boolean }): Promise<void>`

- [ ] **Step 1: Rendre `fetchDonations` capable de demander le payload complet**

Dans `frontend/src/composables/useDonations.ts`, remplacer le bloc des lignes 270-287 :

```ts
  async function fetchDonations(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/donations');
      if (!response.ok) throw new Error('Failed to fetch donations');

      const data = await response.json();
      donations.value = data.donations;
      stats.value = data.stats;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      isLoading.value = false;
    }
  }
```

par :

```ts
  // full: true demande le payload complet (email, telephone, reference).
  // Reserve a l'admin ; les ecrans publics appellent sans argument et
  // recoivent une projection depouillee.
  async function fetchDonations(options: { full?: boolean } = {}): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = options.full
        ? await adminFetch('/api/donations?full=1')
        : await fetch('/api/donations');
      if (!response.ok) throw new Error('Failed to fetch donations');

      const data = await response.json();
      donations.value = data.donations;
      stats.value = data.stats;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      isLoading.value = false;
    }
  }
```

Aucun import à ajouter : `adminFetch` est déjà importé en tête de `useDonations.ts` (ligne 2).

- [ ] **Step 2: Faire demander le payload complet par l'admin**

Dans `frontend/src/pages/AdminPanel.vue`, ligne 70, remplacer :

```ts
  await Promise.all([fetchDonations(), fetchConfig(), fetchPremiumWords()]);
```

par :

```ts
  await Promise.all([fetchDonations({ full: true }), fetchConfig(), fetchPremiumWords()]);
```

> Ne toucher **aucun** autre site d'appel. `MenorahDisplay.vue:72`, `DisplayHiddenPage.vue:83,111`, `DisplayPage.vue:132,160`, `DisplayPage8.vue:83,89` et `MenorahAscension.vue:155` doivent rester sans argument : ce sont des écrans publics.

- [ ] **Step 3: Faire passer l'export CSV par `adminFetch`**

Un `<a href>` ne peut pas porter d'en-tête, et le flux « prompt sur 401 » d'`adminFetch` ne s'applique pas à un clic de lien. On récupère donc le fichier en mémoire puis on déclenche le téléchargement.

Dans `frontend/src/components/admin/DonationList.vue`, remplacer la ligne 13 :

```ts
const exportUrl = computed(() => `/api/donations/export.csv?lang=${locale.value}`);
```

par :

```ts
const isExporting = ref(false);

// L'export exige le token admin. adminFetch l'injecte et redemande le code
// sur 401, ce qu'un simple <a href> ne permet pas.
async function handleExport(): Promise<void> {
  isExporting.value = true;
  try {
    const response = await adminFetch(`/api/donations/export.csv?lang=${locale.value}`);
    if (!response.ok) throw new Error(`Export failed: ${response.status}`);

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `donations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('CSV export failed:', e);
  } finally {
    isExporting.value = false;
  }
}
```

Adapter les imports en tête du fichier :

```ts
import { computed, ref } from 'vue';
import { useDonations, type Donation } from '../../composables/useDonations';
import { useAdminI18n } from '../../composables/useAdminI18n';
import { adminFetch } from '../../composables/useAdminAuth';
```

- [ ] **Step 4: Remplacer le lien par un bouton**

Dans le même fichier, remplacer la ligne 56 :

```html
      <a :href="exportUrl" class="export-btn" download>
```

par :

```html
      <button type="button" class="export-btn" :disabled="isExporting" @click="handleExport">
```

Et la balise fermante `</a>` correspondante (juste après `{{ t('donation.exportCsv') }}`) par `</button>`.

- [ ] **Step 5: Vérifier le typage**

Run: `cd frontend && npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 6: Vérifier le build**

Run: `cd frontend && npm run build`
Expected: build réussi.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/composables/useDonations.ts frontend/src/pages/AdminPanel.vue frontend/src/components/admin/DonationList.vue
git commit -m "fix(admin): demande explicite du payload complet cote admin

Le backend depouille desormais /api/donations par defaut. L'admin
passe full: true (seul site d'appel concerne : AdminPanel), les ecrans
publics restent inchanges.

L'export CSV passe par adminFetch plutot qu'un <a href>, pour que le
token soit injecte et que le code admin soit redemande sur 401.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Vérification de bout en bout au navigateur

Les tests couvrent le backend. Cette task prouve que l'écran public et l'admin fonctionnent réellement, et qu'aucune donnée personnelle ne circule plus vers les pages publiques.

**Files:** aucun (vérification).

- [ ] **Step 1: Démarrer le backend**

```bash
cd backend && ADMIN_TOKEN=dev-token npm run dev
```

- [ ] **Step 2: Démarrer le frontend**

```bash
cd frontend && npm run dev
```

- [ ] **Step 3: Vérifier que l'écran public fonctionne toujours**

```bash
export PLAYWRIGHT_CLI_SESSION=menora-lot0a
playwright-cli open "http://localhost:5173/display"
playwright-cli screenshot --filename display-apres.png
```

Expected: les plaques donateurs s'affichent avec noms et montants, exactement comme avant.

- [ ] **Step 4: Vérifier qu'aucune donnée personnelle ne circule**

Lister les requêtes, repérer le numéro de celle qui vise `/api/donations`, puis inspecter sa réponse complète :

```bash
playwright-cli requests
playwright-cli request <numero-de-la-requete-api-donations>
```

Expected: le corps de la réponse ne contient ni `email`, ni `phone`, ni `reference`.

- [ ] **Step 5: Vérifier que la page /don fonctionne toujours**

```bash
playwright-cli open "http://localhost:5173/don"
playwright-cli screenshot --filename don-apres.png
```

Expected: formulaire complet, montants presets affichés.

- [ ] **Step 6: Vérifier l'admin et l'export**

```bash
playwright-cli open "http://localhost:5173/admin"
playwright-cli snapshot
```

Expected: la liste des dons s'affiche ; les références sont visibles ; le bouton d'export déclenche un téléchargement.

- [ ] **Step 7: Vérifier la fermeture réelle des routes**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/donations/export.csv"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/donations?full=1"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/donations/1"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/donations"
```

Expected: `401`, `401`, `401`, `200`.

- [ ] **Step 8: Arrêter les serveurs de développement**

Interrompre les deux processus `npm run dev`. Les captures produites restent dans le répertoire de travail et **ne sont pas commitées** : ce sont des artefacts de vérification, pas du code.

Si l'un des Steps 3 à 7 échoue, **ne pas déployer** : rouvrir la task correspondante.

---

## Critères d'acceptation du LOT 0a

- `GET /api/donations/export.csv` renvoie 401 sans token.
- `GET /api/donations` renvoie 200 sans token, **sans** `email` / `phone` / `reference`.
- `GET /api/donations?full=1` renvoie 401 sans token, le payload complet avec.
- `GET /api/donations/:id` renvoie 401 sans token.
- En `NODE_ENV=production` sans `ADMIN_TOKEN` : 503 et message d'erreur au démarrage.
- `/display`, `/display-light`, `/display-hidden` et `/don` fonctionnent à l'identique, vérifié au navigateur.
- L'admin affiche les références et exporte le CSV.
- `npm test` (backend) : 16 tests verts. `npm run typecheck` et `npm run build` (frontend) : sans erreur.
- `backend/db/donations.db` n'a pas été modifié par les tests.

## Suite

- **LOT 0b** — réparations visuelles : donut admin, plaques tronquées, variables CSS fantômes, Heebo et RTL, lisibilité de la courbe d'objectif.
- **LOT 1** — fondation multi-événements (spec §4).
