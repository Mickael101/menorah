# Tests — et pourquoi le vert peut mentir

Vérifié le **2026-07-29** contre `feat/atelier-scenes-2026-07-28`.

## Lancer le gate

```bash
cd D:\Menora\menorah\backend
npm test                      # vitest run — 29 fichiers, 217 tests (--pool=threads si crash forks)
npm run build                 # tsc — npm test seul ne voit pas les erreurs de types

cd ..\frontend
npm run typecheck             # vue-tsc — garde-fou des composants
npm test                      # vitest node-env — contrôleur de scène (6 tests)
npm run build                 # vite — seul à prouver le bundling (chunk Rive séparé)
```

> **Depuis `backend/`, jamais depuis la racine.** Le `package.json` racine est une coquille
> vide (`"scripts": {}`) : rien ne se lance de là. Pire, `npx vitest` depuis la racine a déjà
> résolu un **vitest 4.1.10 étranger** au lieu du 2.1.9 installé dans `backend/node_modules`,
> et l'isolation de base a sauté (2026-07-26).

Un garde-fou explicite jette maintenant si le cwd est mauvais (`tests/helpers/app.ts:22-39`).

## Ce qui existe

| Aspect | Réalité |
|---|---|
| Emplacement | `backend/tests/` — 29 fichiers `.test.ts` + helpers ; `frontend/src/scene/` — 1 fichier |
| Volume | **217** assertions backend + **6** frontend (comptées le 2026-07-29, gate complet vert) |
| Runner | vitest **2.1.9** + supertest 7.2.2 (backend) ; vitest **2.1.9** env `node` (frontend) |
| Config | `backend/vitest.config.ts` (DATA_DIR isolé) + `frontend/vitest.config.ts` (env `node`, `src/**/*.test.ts`) |
| Isolation | `DATA_DIR = backend/.tmp-test-data` posé par `vitest.config.ts:14-17` ; `globalSetup` efface le dossier (`tests/helpers/global-setup.ts:11`) |
| **Frontend** | **1 fichier** : `src/scene/sceneRuntime.test.ts` (6 tests, runtime Rive injecté — pas de jsdom). Les composants restent couverts par `npm run typecheck` (vue-tsc) + vérification navigateur |
| Vérification visuelle | captures playwright-cli figées dans `docs/verif/`, **non automatisées** |

### Réglages non négociables de `vitest.config.ts`

| Réglage | Raison |
|---|---|
| `fileParallelism: false` | les tests de sécurité mutent `process.env` |
| `pool: 'forks'` | les workers tinypool perdaient **un fichier de tests entier** avec un résumé qui se lisait **vert** (`:24-32`) |
| `testTimeout: 20000` | sql.js est du WASM, l'initialisation est lente |

## Les pièges qui rendent le vert menteur

### 1. Sans `ADMIN_TOKEN`, les tests de sécurité ne prouvent rien

Hors production, `requireAdmin` **laisse passer par conception**. Un test qui vérifie qu'une
route admin répond 200 **sans poser le jeton** est vert et n'a rien vérifié.

Tout test de garde doit poser explicitement le jeton et vérifier **les deux** cas : avec, et sans.

### 2. `git status` ne détecte pas une base modifiée

`*.db` est dans `.gitignore` : une base modifiée par un test n'apparaît jamais dans
`git status`. Pour savoir si un fichier de base a bougé, **comparer son mtime**.

### 3. `grep | sort` renvoie toujours 0

Un pipeline `grep ... | sort` a le code de sortie de `sort`, donc **toujours 0**. Un verdict
bâti dessus est toujours « vert ». Vérifier le code de sortie du `grep` lui-même.

### 4. Cinq pièges vérifiés le 2026-07-27 où le vert ne voulait rien dire

| Piège | Ce qui se passait |
|---|---|
| Sauvegarde prise **après** la migration | le filet de sécurité ne contenait déjà plus l'état d'avant |
| `db.export()` remet `PRAGMA foreign_keys` à 0 | les FK n'étaient actives que pendant la migration |
| `[dir='rtl']` ne matche pas `dir="auto"` | le test RTL passait à côté de la vraie configuration |
| Survol translucide composé sur le parent | la couleur testée n'était pas celle rendue |
| Les rooms socket coupent le direct | l'isolation testée cassait la diffusion réelle |

### 5. Le mutation testing a survécu 3 fois

25 mutations rejouées le 2026-07-27, **17 tuées**. Trois survivantes, tests correctifs déjà
rédigés et validés mais **non appliqués** :

| Mutation survivante | Ce qu'elle révèle |
|---|---|
| Config de B comparée aux seuls défauts | un `UPDATE` sans `WHERE` passerait le test |
| Résolution de soirée active comparée à `1`, la valeur semée | assertion tautologique |
| **Export CSV vérifié sur statut + MIME, jamais sur le contenu** | c'est **la seule route qui expose email et téléphone en clair** |

Voir `reste-a-faire.md`, priorité 2.

## Ce qui n'est couvert par aucun test

- **La fuite PII par Socket.IO** — `donations-pii.test.ts` ne teste que HTTP (0 occurrence de `socket`).
- **Tout le frontend** — 0 test.
- **La restauration d'une sauvegarde** — jamais éprouvée.
- **L'isolation entre deux soirées ouvertes simultanément côté navigateur** — exige deux
  **contextes** navigateur distincts, pas deux onglets (le `localStorage` est partagé entre onglets).
