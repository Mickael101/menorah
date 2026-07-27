# API HTTP et événements Socket.IO

Vérifié le **2026-07-27** contre `099918c`.

## Règle de montage

Les routes de **ressources** (`config`, `donations`, `stats`) sont montées **deux fois** à
partir du même corps (fabriques `createXxxRouter(ctx)`, `app.ts`) :

- **hérité** — `/api/config`, `/api/donations`, `/api/stats` → résolus sur la soirée
  **active** (`resolveActiveEvent`) → **503 si aucune soirée n'est `active`** ;
- **préfixé** — `/api/events/:eventId/...` → résolus sur la soirée **nommée**
  (`resolveParamEvent`) → **404 sec si l'`:eventId` est inconnu**, jamais de repli.

La forme de réponse est **identique** des deux côtés (condition de migration du frontend).

`/api/gifs` suit désormais le **même double montage** (E3) : les GIF, sons et associations
sont cloisonnés par soirée via la table `media`, le listing à plat du répertoire a disparu.

`/api/admin` est **volontairement exclu** de toute résolution de soirée : il sert le fichier
de base entier (toutes soirées) et reste au niveau organisateur.

**Ordre auth/résolution** : sur les routes de ressources protégées, `requireEventAdmin`
passe **avant** `resolveEvent`. Sans cet ordre, l'absence de soirée active faisait répondre
503 à une requête sans jeton qui mérite 401 (l'export CSV, notamment).

## Endpoints

### Soirées (`routes/events.ts`)

| Méthode + chemin | Accès | Rôle |
|---|---|---|
| GET `/api/events` | **organisateur** | `{ events: EventSummary[] }` (agrégats inclus, jamais `admin_code_hash`) |
| POST `/api/events` | **organisateur** | crée une soirée, renvoie `{ event: EventSummary, adminCode }` — code en clair **une seule fois** |
| GET `/api/events/active` | public | `{ event: EventPublic \| null, multipleActive }` ; en-tête `X-Multiple-Active-Events: true` + `console.warn` si ambiguïté |
| GET `/api/events/by-slug/:slug` | public | `{ event: EventPublic }` ou 404 |
| PUT `/api/events/:eventId` | **admin de la soirée** | met à jour, renvoie `{ event: EventSummary }` ; 404 si inconnue |
| POST `/api/events/:eventId/admin-code` | **organisateur** | régénère le code, renvoie `{ adminCode }` une seule fois |

### Ressources — hérité + préfixé

Chaque route ci-dessous existe **aussi** sous `/api/events/:eventId/...`, même forme de
réponse. « admin » = organisateur **ou** admin de la soirée résolue.

| Méthode + chemin (hérité) | Accès | Rôle |
|---|---|---|
| GET `/api/health` | public | healthcheck Railway |
| GET `/api/donations/premium-words` | public | mots premium, disponibilité, paliers. Renvoie `donorName` — noms publics par nature (mur des plaques) |
| GET `/api/donations/export.csv?lang=` | **admin** | export CSV UTF-8 BOM, anti-injection de formule. **Auth avant résolution** (401 sans jeton, jamais 503) |
| GET `/api/donations` | public | liste **dépouillée** via `toPublicDonation` + stats |
| GET `/api/donations?full=1` | **admin** | payload complet : email, téléphone, référence |
| GET `/api/donations/:id` | **admin** | un don complet |
| POST `/api/donations` | public + **rate-limit 10 / 10 min / IP (global, toutes soirées)** ; une **autorité admin réelle est exemptée** (vérifiée seulement au-delà du plafond, échecs bornés à 30/IP/fenêtre — l'opérateur en rafale et la salle sur un même wifi ne se bloquent plus) | création publique (`/don`) + saisie opérateur + diffusion socket |
| PUT `/api/donations/:id` | **admin** | modification (passe `currentAmount` à la validation, C9) + diffusion socket |
| DELETE `/api/donations/:id` | **admin** | suppression + diffusion socket |
| GET `/api/stats` | public | total, nombre, pourcentage, segments allumés |
| GET `/api/config` | public | config de la soirée résolue |
| PUT `/api/config` | **admin** | mise à jour + diffusion socket |
| GET `/api/gifs` | public | GIF **de la soirée** + son associé (table `media`, plus de listing à plat) |
| POST `/api/gifs/upload` | **admin** | image ≤ 50 Mo (gif/png/jpeg/webp), rattachée à la soirée |
| POST `/api/gifs/upload-svg` | **admin** | SVG ≤ 5 Mo + filtre `isSafeSvg` |
| POST `/api/gifs/upload-audio` | **admin** | audio ≤ 50 Mo, rattaché à la soirée |
| POST `/api/gifs/associate-audio` | **admin** | associe un son à un GIF **de la soirée** (média, plus de JSON global) |
| POST `/api/gifs/trigger` | **admin** | déclenche GIF + son sur les écrans de la soirée |
| GET `/api/gifs/audio` | public | audios **de la soirée** |
| DELETE `/api/gifs/audio/:filename` | **admin** | supprime un audio de la soirée + ses associations (frontière `path.relative`, C10) |
| DELETE `/api/gifs/:filename` | **admin** | supprime un GIF de la soirée (frontière `path.relative`, C10) |
| GET `/api/admin/backups` | `routes/admin.ts:13` | **admin** (`router.use` `:10`) | liste des sauvegardes |
| POST `/api/admin/backups` | `routes/admin.ts:23` | **admin** | snapshot immédiat |
| GET `/api/admin/backup.db` | `routes/admin.ts:34` | **admin** | télécharge la base vivante — **toutes soirées confondues** |
| GET `/api/admin/backups/:name` | `routes/admin.ts:44` | **admin** | télécharge une sauvegarde |
| GET `/uploads/*` | `app.ts:26` | public | médias statiques |
| GET `*` | `app.ts:42` | public | fallback SPA |

### Thèmes (`routes/themes.ts`, C1)

Un thème est une **donnée**, plus du code : l'admin choisit, duplique et modifie un thème
d'affichage sans redéploiement. Un thème = une **famille structurelle** (`base`, l'une des sept
livrées, dont le moteur de rendu tire surfaces/polices/arrondis) **+ les dix couleurs de
palette**. `event_id NULL` = preset **intégré** (livré, partagé, non supprimable, duplicable) ;
`event_id` renseigné = thème **personnalisé** d'une soirée.

| Méthode + chemin | Accès | Rôle |
|---|---|---|
| GET `/api/themes?eventId=` | **admin de la soirée** (avec `eventId`) sinon **organisateur** | `{ themes: ThemeRecord[] }` — intégrés + personnalisés de la soirée |
| POST `/api/themes` | **organisateur** | crée un thème personnalisé rattaché à `eventId`. `{ theme }` (201) |
| PUT `/api/themes/:id` | **organisateur** | édite un personnalisé. Intégré → **409** (se duplique, ne se modifie pas) |
| DELETE `/api/themes/:id` | **organisateur** | supprime un personnalisé (204). Intégré → **409** |
| GET `/api/events/:eventId/theme` | **public** | `{ theme: ThemeRecord \| null }` — thème appliqué (lecture offline-safe pour l'écran) |
| PUT `/api/events/:eventId/theme` | **admin de la soirée** | applique `{ themeId }` (pose `event_configs.theme_id`). Thème d'une autre soirée → **403** |

**Contraste AA AVERTISSANT à la création et à l'édition** (`models/theme.ts`, spec §5.4 —
décision commanditaire : « avertissement dans la galerie, sans bloquer l'enregistrement ») :
la luminance relative WCAG des paires déclarées est calculée ; texte (`headerTextColor`,
`statsTextColor`, `plateTextColor` vs `backgroundColor`) sous **4,5** ou objet graphique
(`chartPrimaryColor` vs `backgroundColor`) sous **3,0** → le thème est **enregistré** et la
réponse porte `warnings[]` avec le détail des paires ; la galerie affiche le badge ⚠ sur la
vignette. Frontière inclusive : 4,5 sans avertissement, 4,49 averti.
`chartSecondaryColor` est **exclu** (compagnon de dégradé décoratif, non essentiel au sens
WCAG 1.4.11 — cinq des sept presets le posent volontairement sous 3,0). Les sept intégrés
passent le contrôle (min mesuré : ivoire header 4,90 / courbe 3,04).

Seed additif idempotent par la migration (`db/migrations.ts` `seedBuiltinThemes`), construit
depuis `DEFAULT_THEME_PALETTES` (même source que le moteur de rendu — zéro couleur recopiée).

```ts
ThemeRecord = { id, eventId: number|null, name, builtin: boolean, tokens: ThemeTokens, createdAt }
ThemeTokens = { base: DisplayThemeId } & DisplayThemePalette   // base + 10 couleurs
```

**`/api/events` existe** (E2, `routes/events.ts`) et les ressources sont montées en double
(hérité + `/api/events/:eventId/...`). Le routage **frontend** `/e/:slug` est livré (F1) et
les écrans display consomment leur slug (O2). Contrat de référence :
`superpowers/plans/2026-07-27-contrat-api-multi-evenements.md`.

## Authentification

Deux niveaux d'accès, un seul en-tête (`middleware/admin-auth.ts`). Le jeton arrive
par header `x-admin-token` **ou** par le repli `?token=`.

| Rôle | Secret | Portée |
|---|---|---|
| Organisateur | `ORGANIZER_TOKEN` (env) | toutes les soirées |
| Organisateur (alias) | `ADMIN_TOKEN` (env) | toutes les soirées — **alias de compatibilité, la prod en dépend** |
| Admin de soirée | code propre à la soirée, haché dans `events.admin_code_hash` | sa soirée uniquement |

- **`requireAdmin`** — niveau organisateur uniquement (liste/création de soirées,
  sauvegardes globales). Accepte `ORGANIZER_TOKEN` puis l'alias `ADMIN_TOKEN`.
- **`requireEventAdmin(cible)`** — organisateur **ou** admin de la soirée ciblée. Un code
  valide pour la soirée A sur une ressource de B renvoie **403** (secret bon, portée
  refusée), un code inconnu **401**. Monté **avant** la résolution de soirée (E2), pour que
  l'absence de soirée active ne masque pas un 401 par un 503.

Hachage : `crypto.scryptSync` (bibliothèque standard, **aucune dépendance ajoutée**),
format auto-descriptif `scrypt$N$r$p$sel_b64$empreinte_b64`, comparaison `timingSafeEqual`
(`middleware/admin-code.ts`). Le code en clair n'est jamais stocké, ni logué, ni renvoyé
par une route — sauf **une seule fois** par le POST de création (E2).

| Secret d'environnement | `NODE_ENV=production` | Comportement |
|---|---|---|
| aucun (`ORGANIZER_TOKEN` et `ADMIN_TOKEN` absents) | oui | **503 sur toutes les routes admin** (fail-closed, hérité du LOT 0) |
| aucun | non | **routes ouvertes** — contournement de dev, voir l'avertissement de `tests.md` |
| au moins un présent | — | jeton exigé et comparé selon l'ordre du contrat |

## Événements Socket.IO

Cloisonnement par room `event:<id>` (`socket.service.ts:9`), diffusion via `io.to(eventRoom(id))`.

**CORS du socket** : une seule variable `CORS_ORIGIN` (liste d'origines séparées par des
virgules), partagée avec le HTTP. Non définie, le comportement reste **exactement** celui
d'avant — `http://localhost:5173` et `http://localhost:3000` — donc aucune régression d'écran
en production (même origine). `CORS_ORIGIN=*` autorise toutes les origines
(`socket.service.ts:socketCorsOrigin`).

| Sens | Nom | Serveur | Consommé par |
|---|---|---|---|
| reçu | `connection` + **auto-join** de la soirée active | `socket.service.ts:58,70` | — |
| reçu | `join {room}` + ack, motif `^event:\d+$`, quitte les autres rooms avant | `socket.service.ts:72-108` | **aucun émetteur frontend** |
| reçu | `disconnect` | `socket.service.ts:110` | `useSocket.ts:21` |
| émis | `donation:new` (**projection publique**, sans email/téléphone/référence) | `socket.service.ts:125` ← `routes/donations.ts:136` | `DisplayPage:135`, `DisplayPage8:84`, `DisplayHiddenPage:86`, `AdminPanel:105`, `DonorPlatesGrid:237`, `MenorahDisplay:81` |
| émis | `donation:updated` (**projection publique**) | `socket.service.ts:134` ← `routes/donations.ts:168` | idem, 5 écrans |
| émis | `donation:deleted` | `socket.service.ts:143` ← `routes/donations.ts:198` | idem, 5 écrans |
| émis | `config:updated` | `socket.service.ts:152` ← `routes/config.ts:31` | idem, 5 écrans |
| émis | `gif:trigger` | `socket.service.ts:161` ← `routes/gifs.ts:297` | `DisplayPage:141`, `DisplayPage8:85`, `DisplayHiddenPage:92` |

> **`join` n'est émis par aucun client** (0 occurrence dans `frontend/src`). Le « filet de
> compatibilité » qu'est l'auto-join de la soirée active est en pratique le **seul**
> mécanisme d'abonnement.

## Fuite PII par le socket — FERMÉE le 2026-07-27

`emitDonationNew` et `emitDonationUpdated` diffusaient l'objet `donation` **complet** — email,
téléphone, référence — vers la room, donc vers les **six pages publiques** qui écoutent
`donation:new`. La même donnée était déjà dépouillée en HTTP par `toPublicDonation` ; la voie
temps réel était restée ouverte depuis le LOT 0a.

Les deux émissions diffusent désormais `toPublicDonation(donation)` (`socket.service.ts:125-146`) :
nom et montant (publics par nature, projetés sur le mur), jamais email, téléphone ni référence.
L'administration, qui a besoin du payload complet, ne lit plus le payload socket : ses handlers
`donation:new`/`donation:updated` rechargent la liste par la route authentifiée
`GET /api/donations?full=1` (`AdminPanel.vue`), dans le handler qui faisait déjà un aller-retour.

Prouvé par `tests/security/socket-pii.test.ts` : un vrai serveur, un vrai client, les deux
événements reçus, aucune trace d'email/téléphone/référence dans le payload livré.

## Autres écarts relevés

| # | Constat | Source |
|---|---|---|
| C | **REQUALIFIÉ puis CORRIGÉ des deux côtés** — le mot sacré n'était **pas** effacé (mesuré : le service ignore une clé `undefined`) ; le `\|\| 0` faisait **taire** un changement de mot quand `amount` était absent. Garde-fou côté modèle (`??` + skip si montant inconnu, test `services/premium-word-update.test.ts`) ET `PUT /api/donations/:id` passe désormais `currentAmount` (E2) | `models/donation.ts:154`, `routes/donations.ts` |
| D | **CORRIGÉ (E3, C10)** — frontière de chemin réelle (`path.relative`, `middleware/path-boundary.ts`) sur les suppressions GIF/audio, plus de préfixe de chaîne | `routes/gifs.ts` |
| G | **CORRIGÉ (E3, B4)** — GIF, audio, SVG et associations cloisonnés par soirée via la table `media` ; inventaire des fichiers existants par migration | `services/media.service.ts`, `db/migrations.ts` |
| H | **CORRIGÉ des deux côtés (C8)** — HTTP (`app.ts`, défaut `'*'`) et socket (`socket.service.ts`, défaut localhost inchangé) lisent la MÊME variable `CORS_ORIGIN` (liste séparée par virgules) | `app.ts`, `socket.service.ts` |
| I | **RE-CORRIGÉ (revue 2026-07-28)** — la clé IP+soirée (B6) multipliait le plafond par le nombre de soirées atteignables : retour à la clé **IP seule, globale**. En compensation, **exemption d'autorité différée** : au-delà du plafond seulement, un jeton organisateur ou un code de la soirée ciblée passe sans consommer le quota ; les jetons refusés sont bornés à 30 scrypt/IP/fenêtre (anti-amplification). Reste en mémoire mono-instance et `x-forwarded-for` non validé, aucun `trust proxy` Express (résidu assumé — une IP usurpée obtient quota et budget d'échecs neufs) | `middleware/rate-limit.ts`, `routes/donations.ts` |
| L | `GET /api/admin/backup.db` livre la base **entière, toutes soirées** — incompatible avec un futur multi-locataire | `routes/admin.ts:34` |
