# Architecture

Vérifié le **2026-07-27** contre `099918c`. Chaque affirmation porte sa source `fichier:ligne`.

## Ce que fait l'application

Un écran de dons en direct pour une soirée de collecte. Un opérateur saisit chaque don ;
tous les écrans de la salle réagissent ensemble — une menorah s'allume par paliers, une
plaque au nom du donateur entre, le compteur monte, un GIF et un son marquent le moment.
Depuis le 2026-07-21, une page publique `/don` permet aussi aux absents de s'engager eux-mêmes.

**Le serveur est la seule source de vérité.** L'admin ne calcule rien de visuel : à chaque
création, modification ou suppression, le backend recalcule tout et diffuse un instantané
complet. Un écran qui vient de se connecter, ou qui a perdu le Wi-Fi, affiche l'état correct
sans aucune comptabilité côté client.

## Stack réelle

| Élément | Valeur | Source |
|---|---|---|
| Runtime | Node **18** | `nixpacks.toml:3` |
| Backend | Express **4.18**, Socket.IO **4.7**, multer 1.4.5-lts, cors 2.8 | `backend/package.json:12-17` |
| **Base de données** | **`sql.js` 1.10 (installé 1.13.0)** — SQLite compilé en WASM | `backend/package.json:16` |
| Frontend | Vue **3.3** (Composition API), vue-router 4.2, GSAP 3.14, socket.io-client 4.8 | `frontend/package.json:9-13` |
| Bundler | Vite **5.0** côté front ; **tsc** côté back (commonjs, ES2022) | `frontend/vite.config.ts`, `backend/tsconfig.json:3-5` |
| TypeScript | back `^5.3.2` ; front épinglé `5.3.3` + vue-tsc 1.8.27 | `backend/package.json:29`, `frontend/package.json:19-21` |
| Tests | **vitest 2.1.9** + supertest 7.2.2 — **backend uniquement** | `backend/package.json:26-31` |

> **`better-sqlite3` n'est pas utilisé.** Il n'est ni déclaré, ni installé, ni importé
> (0 occurrence dans `backend/src` et `backend/tests`). `CLAUDE.md` l'affirmait à tort
> jusqu'au 2026-07-27.

**Conséquence non triviale de `sql.js`** : la base vit en mémoire et **le fichier entier est
réécrit à chaque sauvegarde** (`db/init.ts:110-126`). D'où deux protections qu'il ne faut pas
retirer par mégarde :

1. **Écriture atomique** tmp + rename (`init.ts:124-126`) — un `writeFileSync` direct interrompu laissait un fichier tronqué, c'est-à-dire la perte de tous les dons.
2. **`PRAGMA foreign_keys = ON` reposé après chaque `export()`** (`init.ts:134`) — `db.export()` remet le pragma à 0 sur la connexion vivante. Sans ce rappel, les clés étrangères n'étaient actives *que* pendant la migration, et décoratives ensuite.

## Points d'entrée

| Process | Fichier | Ce qu'il fait |
|---|---|---|
| Production | `backend/src/index.ts` → `dist/index.js` | snapshot **pre-migration** → `initDatabase()` → garde `ADMIN_TOKEN` → scheduler de sauvegardes → `listen(PORT)` |
| Tests (Supertest) | `backend/src/app.ts:13` `createApp()` | app Express **sans effet de bord** — ni base, ni `listen` |
| Frontend | `frontend/index.html:35` → `src/main.ts` | monte Vue + router sur `#app` |

En production, le frontend compilé est copié dans `backend/public/` : **un seul process Node**
sert l'admin, les écrans, l'API REST et le websocket.

## Modules

### `backend/src/`

| Chemin | Rôle |
|---|---|
| `index.ts` | Démarrage et **ordonnancement** — le snapshot est pris AVANT la migration (`:23-25`) |
| `app.ts` | CORS, statique `/uploads` et `public/`, montage des 5 routeurs, health, fallback SPA |
| `config/storage.ts` | Résout 3 chemins depuis `DATA_DIR` (base, uploads, associations son↔GIF) |
| `db/init.ts` | Ouverture/création de la base, pragma FK, tables héritées, `runMigrations`, sauvegarde atomique |
| `db/migrations.ts` | Schéma multi-événements idempotent |
| `middleware/admin-auth.ts` | `requireAdmin` — **503 si pas de jeton en production, ouvert hors production** |
| `middleware/rate-limit.ts` | Limiteur en mémoire par IP (mono-instance) |
| `middleware/resolve-event.ts` | Résout la soirée active pour les routes héritées, 503 sinon |
| `models/` | Types, conversions ligne↔API, validations. `types.ts` = 392 lignes de contrats et de valeurs par défaut |
| `routes/` | `donations`, `stats`, `config`, `gifs`, `admin` |
| `services/` | `donation`, `config`, `event` (lecture seule), `socket`, `backup` |
| `tests/` | 10 fichiers vitest + 3 helpers |

### `frontend/src/`

| Chemin | Rôle |
|---|---|
| `pages/` | 6 vues — **5 routées, 1 orpheline** |
| `components/admin/` | `DisplaySettingsPanel` (2439 l.), `DonationForm` (1253), `GifManager` (665), `ConfigPanel` (600), `DonationList` (565) |
| `components/display/` | `DisplayScreen` (écran générique unique, C3) + `displayVariants.ts` (3 adaptateurs) + `animations.ts` (tween rAF partagé, C4) ; `MenorahDisplay`, `DonorPlate`/`DonorPlatesGrid`/`DonorPlateAnimation`, `CampaignVisual`, `StatsCompact` |
| `components/ui/` | `UiToast` |
| `composables/` | `useDonations` (état + client API), `useSocket` (+ `join(eventId)`), `useAdminAuth` (jeton par soirée), `useEventContext` (résolution slug/active + portée ambiante), `useAdminI18n`, `useToast`, `useAudioPreview` |
| `theme/displayThemes.ts` | Variables CSS dérivées de `displaySettings` |
| `assets/styles/global.css` | Base + doctrine RTL/typographie documentée (l. 210-241) |

### Pages et routes

Deux familles (contrat § Routage frontend) : les routes **héritées** résolvent sur la
soirée **active** (comportement conservé) ; les routes **préfixées** `/e/:slug/…` résolvent
sur la soirée nommée. Chaque route héritée a sa jumelle préfixée.

| Route héritée | Route préfixée | Composant | Accès | Rôle |
|---|---|---|---|---|
| `/` → `/admin` | — | redirection | — | — |
| `/admin` | `/e/:slug/admin` | `AdminEntry.vue` → `AdminPanel.vue` | **admin** | contexte + connexion + (organisateur) sélecteur, puis les 4 onglets |
| `/don` | `/e/:slug/don` | `DonorPledgePage.vue` | public | engagement libre-service, 3 langues |
| `/donate` → `/don` | — | redirection | public | compatibilité des QR codes déjà imprimés |
| `/display` | `/e/:slug/display` | `DisplayPage.vue` | public | écran principal |
| `/display-light` | `/e/:slug/display-light` | `DisplayPage8.vue` | public | variante LED géant |
| `/display-hidden` | `/e/:slug/display-hidden` | `DisplayHiddenPage.vue` | public | variante sans file d'attente |

> **Trois forks fusionnés (C3, 2026-07-27).** Les trois `DisplayPage*.vue` (2 360 l. cumulées,
> largement redondantes) sont désormais des **enveloppes minces** qui montent l'unique
> `components/display/DisplayScreen.vue` avec l'un des trois descripteurs de
> `displayVariants.ts`. Chaque contrôle divergent a SON drapeau (jamais un booléen pour une
> paire) ; l'inventaire ligne-à-ligne et la preuve d'équivalence navigateur (avant/après,
> 1440×900 + 390px) sont dans `docs/verif/sprint-2026-07-27/display-fusion/`. Seule
> convergence visible : les variantes light/hidden lisent maintenant `config.texts` (source
> unique) — la pastille de statut de hidden passe de « En direct » à la valeur configurée.

**Résolution du contexte** (`useEventContext`) : `/e/:slug/…` appelle
`GET /api/events/by-slug/:slug` (public) ; les routes héritées appellent `GET /api/events/active`.
Un slug inconnu affiche un **404 propre**, jamais un repli silencieux sur une autre soirée. La
résolution pose une **portée ambiante** (`scopedEventId`) que `useDonations` et `adminFetch`
lisent : portée nulle ⇒ routes héritées (soirée active, byte-identique à avant) ; portée posée
⇒ routes préfixées `/api/events/:id/…`. C'est la couture rétro-compatible avec les pages
Display (elles n'appellent pas `resolve()`, restent donc sur la soirée active jusqu'au câblage
slug→display post-merge).

**Connexion admin** : le `window.prompt` a été remplacé par un **écran de connexion**
(`AdminLogin.vue`) — champ code, soirée nommée, distinction **401** (code refusé) vs **403**
(code valide mais pas pour cette soirée). Le jeton est stocké **par soirée**
(`menorah_admin_token:<id>`), la clé historique `menorah_admin_token` restant le repli
organisateur / soirée active. Sur `/admin` hérité, un organisateur (détecté via
`GET /api/events`) obtient un **sélecteur de soirée** (`EventSelector.vue`) qui renvoie vers
`/e/:slug/admin`.

**Temps réel** : `useSocket.join(eventId)` fait rejoindre la room `event:<id>` (re-émise à
chaque reconnexion). Une page en portée nulle ne force aucune room : l'auto-abonnement backend
à la soirée active suffit.

> **Aucune garde de route côté routeur.** La protection reste côté API ; l'écran de connexion
> pose le jeton avant que `AdminPanel` ne s'affiche. `/display-hidden` n'est pas protégé malgré
> son nom.

## Internationalisation

| Aspect | Réalité | Source |
|---|---|---|
| Locales | **3** : `fr`, `en`, `he` | `useAdminI18n.ts:3` |
| Dictionnaire admin | ~260 clés plates par locale, **en dur dans le composable**, repli `locale → fr → clé` | `useAdminI18n.ts:9-793, 809` |
| **2ᵉ dictionnaire** | `DonorPledgePage.vue` embarque son **propre** `MESSAGES`, indépendant, défaut `he` | `DonorPledgePage.vue:14-73` |
| **3ᵉ source** | textes éditables par l'admin, stockés en base par locale | `models/types.ts:100,141` |
| Textes d'écran | `DisplayTextSettings` : **chaîne unique, NON localisée** (français en dur par défaut) | `types.ts:165-197` |
| RTL | `:dir` + `:lang` sur l'admin et `/don` ; réglage `textDirection` (`auto\|ltr\|rtl`) sur les écrans | `AdminPanel.vue:139`, `types.ts:87` |

**Doctrine typographique** (`global.css:210-241`) : refus explicite d'un `[dir=rtl] *` global.
L'hébreu passe par **repli de glyphe** (police `Heebo`, `index.html:19`) et un `:dir(rtl)` ciblé
— qui matche la directionnalité *résolue*, donc aussi `dir="auto"`. Un sélecteur `[dir='rtl']`
ne matcherait pas `dir="auto"` : piège vérifié le 2026-07-27.

## Code mort — supprime le 2026-07-27 (C5)

1 914 lignes frontend inatteignables ont ete retirees, chaque suppression re-prouvee par
grep 0-importeur avant retrait :

| Fichier | Lignes | Preuve avant suppression |
|---|---|---|
| `pages/MenorahAscension.vue` | 1062 | absent de `router.ts`, aucun import |
| `components/display/ProgressBar.vue` | 286 | aucun import |
| `components/display/TotalCounter.vue` | 262 | aucun import |
| `composables/useSoundEffects.ts` | 304 | importe uniquement par `MenorahAscension.vue` → mort par transitivite |

Le devDep frontend `postcss` (aucun `postcss.config.*`, aucune config Vite/Tailwind ne le
reference) a ete retire de `package.json` ; il subsiste dans `package-lock.json` comme simple
dependance transitive de Vite.

## Graphify : évalué le 2026-07-27, écarté

Un graphe de connaissance qualifié (pipeline `D:\graphify-qualify-starter`) **n'est pas
nécessaire sur ce projet**, et le forcer produirait une fausse preuve architecturale.

| Critère | Seuil justifiant un graphe | Menora | |
|---|---|---|---|
| Fichiers source hors tests | > 150 | 58 | ✗ |
| Nœuds AST projetés | > 500 | ~250-350 | ✗ |
| Arêtes d'import internes | > 400 | 133 (55 back + 78 front) | ✗ |
| Modules ≥ 5 nœuds | ≥ n-4 sur n | **7/12** | ✗ échec de gate |
| Déployables distincts | ≥ 3 | 2 | ✗ |
| Hubs à identifier | > 5 non triviaux | 2 (`useDonations`, `socket.service`) | ✗ |

Deux raisons décisives :

1. Le gate `communities_matched` **échouerait structurellement** — 5 des 12 modules sont sous le seuil de 5 nœuds (`config/`, `components/ui/`, `theme/`, `db/`, `middleware/`). Un `OVERALL: PASS` ne serait atteignable qu'en fusionnant artificiellement des modules, donc en mentant sur l'architecture.
2. Vue/Vite est marqué **non validé** dans le starter. Il faudrait 2-3 itérations de `.graphifyignore` avant un graphe non cassé, sur une stack cobaye.

Les 19 000 lignes sont trompeuses : les gros `.vue` sont à 75-87 % template et CSS
(`DisplaySettingsPanel.vue` = 2439 lignes dont **317** de `<script>`).

**Ce qui remplace, gratuitement :** `npx madge --circular frontend/src backend/src` pour les
cycles ; un grep d'imports pour la carte de couplage à la demande.

**Reconsidérer si** : > 150 fichiers source hors tests, ou un 3ᵉ déployable, ou un découpage
par domaine métier (`modules/<domaine>/`) avec profondeur > 6, ou un cycle non trivial
remonté par madge.
