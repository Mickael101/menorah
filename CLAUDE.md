# menorah

Écran de dons en direct pour une soirée de collecte. Un opérateur saisit chaque don ; tous
les écrans de la salle réagissent ensemble. Une page publique `/don` permet aux absents de
s'engager eux-mêmes. **Le serveur est la seule source de vérité** : il recalcule tout et
diffuse un instantané complet — l'admin ne calcule rien de visuel.

📖 **Documentation complète : [`docs/README.md`](docs/README.md)** — point d'entrée unique,
carte de fraîcheur, protocole de mise à jour. Commence par là avant de toucher un module.

## Stack

TypeScript · Vue 3 (Composition API) + Vite · Express + Socket.IO · **`sql.js`** (SQLite WASM)
· vitest + supertest · Node 18 · Railway.

⚠️ **Pas `better-sqlite3`** — ni déclaré, ni installé, ni importé. `sql.js` charge la base en
mémoire et **réécrit le fichier entier à chaque sauvegarde**, d'où l'écriture atomique
tmp+rename et le `PRAGMA foreign_keys` reposé après chaque `export()` (`backend/src/db/init.ts`).
Ne pas retirer ces deux protections : chacune corrige un incident réel.

## Arborescence

```text
backend/src/
  index.ts       démarrage — le snapshot est pris AVANT la migration
  app.ts         createApp() sans effet de bord (pour Supertest)
  config/        chemins dérivés de DATA_DIR
  db/            init.ts (base, pragma, sauvegarde atomique) + migrations.ts
  middleware/    admin-auth · rate-limit · resolve-event
  models/  routes/  services/  tests/
frontend/src/
  pages/         AdminPanel · DonorPledgePage · DisplayPage(+8, Hidden)
  components/    admin/ · display/ · ui/
  composables/   useDonations · useSocket · useAdminAuth · useAdminI18n
  theme/  router.ts  assets/styles/global.css
docs/            documentation vivante — voir docs/README.md
```

## Commandes

```bash
# Tests — DEPUIS backend/, jamais depuis la racine
cd backend && npm test

# Développement
cd backend && npm run dev        # tsx watch, port 3000
cd frontend && npm run dev       # Vite, port 5173
cd frontend && npm run typecheck # vue-tsc — seul garde-fou du frontend

# Déploiement
railway up                       # LE seul moyen — voir docs/deploiement.md
```

Le `package.json` racine est une coquille vide : **rien ne se lance depuis la racine**.

## Pièges vérifiés

| Piège | À faire à la place |
|---|---|
| `git push` ne déploie **rien** — le service Railway n'a aucune source GitHub | `railway up` |
| `npx vitest` depuis la racine résout un vitest étranger et casse l'isolation de base | lancer depuis `backend/` |
| Hors production, `requireAdmin` **laisse passer par conception** — un test de sécurité sans jeton est vert et ne prouve rien | poser `ADMIN_TOKEN` et tester les deux cas |
| `git status` ne voit pas une base modifiée (`*.db` est ignoré) | comparer le mtime |
| `grep \| sort` renvoie toujours 0 — tout verdict bâti dessus est « vert » | tester le code de sortie du `grep` |
| Les souvenirs sont éclatés sur `menora`, `menorah`, `Menora` — chercher sur une seule clé rate la sécurité et le déploiement | interroger les deux, avec `match_mode:"any"` |

## Conventions

- **Ne jamais inventer de contenu éditorial.** Un texte affiché se rend configurable par l'admin.
  *(Décision du commanditaire, 2026-07-21 : une phrase ajoutée d'initiative a dû être retirée.)*
- **Doc et code dans le même commit**, avec la date mise à jour dans `docs/README.md`.
- Une décision prise en session → `mem_save` avec `project` explicite.
- KISS · YAGNI — voir `.specify/memory/constitution.md`.
- Style et lint : délégués à `tsc`/`vue-tsc`, pas de règles de formatage ici.

## État au 2026-07-29 (nuit)

Atelier Scènes v1 LIVRÉ sur `feat/atelier-scenes-2026-07-28` (branche poussée, **NON mergée,
pas de `railway up`**) : bibliothèque de scènes Rive (`/api/scenes`, upload organisateur,
magic bytes, 400 contractuels), 4e mode visuel `scene` par soirée (`sceneId`/`sceneUrl`
résolus SERVEUR, self-healing au DELETE), `SceneDisplay.vue` (runtime `@rive-app/canvas`
lazy en chunk séparé, `progress` ← `percentComplete`, fallback `none` sans crash — prouvé),
carte + sélecteur admin (i18n fr/en/he), **premier harnais vitest frontend** (6 tests).
Atelier hors app : `D:\Menora\atelier-scenes\` (runbook, dépôt git dédié). Spec :
`docs/specs/2026-07-28-atelier-scenes-design.md`. 217 tests backend + 6 frontend + 2 builds
verts, preuves `docs/verif/2026-07-29-atelier-scenes/`. Reste HUMAIN : fabriquer
`building.riv` dans Rive Editor (runbook) puis preuve visuelle avec la vraie scène.
⚠ Piège relevé : sur `/e/:slug/admin`, le login au CODE DE SOIRÉE est éjecté au montage
(401 by-design thèmes/events → `authExpired`) — PRÉEXISTANT, voir `docs/reste-a-faire.md`.

Sprint célébrations LIVRÉ sur `feat/celebrations-et-config-2026-07-28` (mergé master, **pas
de `railway up`** — la mise en prod attend le commanditaire, deux lots sont en attente) :
paliers montant→GIF+son (`displaySettings.celebrations`, résolution côté client synchrone
avec la file d'animations), arrêt d'urgence temps réel (`POST /api/gifs/stop` →
`celebration:stop`), célébration sur `/don`, audio des écrans stoppable, recherche dans la
liste des dons, admin refondu en 5 onglets par page cible (Dons · Écran de salle · Page de
don · Médias et célébrations · Soirée — une seule instance de panneau, une seule barre
d'enregistrement), identité admin par onglets de langue. 199 tests + 2 builds verts,
vérification navigateur complète (`docs/verif/2026-07-28/`).
⚠ Le gate inclut `cd backend && npm run build` (tsc) — `npm test` seul ne voit pas les
erreurs de types, Railway si.
⚠ Vitest : le pool forks par défaut crashe aléatoirement sur cette machine Windows
(préexistant, prouvé sur master) — en cas de « Worker exited unexpectedly », rejouer, ou
`npx vitest run --pool=threads` (29/29 stable). Voir `docs/reste-a-faire.md`.

👉 `docs/reste-a-faire.md` (dette mineure + angles morts F)
