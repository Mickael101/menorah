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

`/api/gifs` reste sur `resolveActiveEvent` seul (montage hérité) ; sa contrepartie préfixée
et le cloisonnement des médias arrivent en **E3**.

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
| POST `/api/donations` | public + **rate-limit 10 / 10 min / IP** | création publique (`/don`) + diffusion socket |
| PUT `/api/donations/:id` | **admin** | modification (passe `currentAmount` à la validation, C9) + diffusion socket |
| DELETE `/api/donations/:id` | **admin** | suppression + diffusion socket |
| GET `/api/stats` | public | total, nombre, pourcentage, segments allumés |
| GET `/api/config` | public | config de la soirée résolue |
| PUT `/api/config` | **admin** | mise à jour + diffusion socket |
| GET `/api/gifs` | public (GET exempté `:13-19`) | liste des GIF + audio associé — **pas encore préfixé/cloisonné, voir E3** |
| POST `/api/gifs/upload` | `routes/gifs.ts:191` | **admin** | image ≤ 50 Mo (gif/png/jpeg/webp) |
| POST `/api/gifs/upload-svg` | `routes/gifs.ts:212` | **admin** | SVG ≤ 5 Mo + filtre `isSafeSvg` (`:119`) |
| POST `/api/gifs/upload-audio` | `routes/gifs.ts:239` | **admin** | audio ≤ 50 Mo |
| POST `/api/gifs/associate-audio` | `routes/gifs.ts:259` | **admin** | associe un son à un GIF (JSON sur disque) |
| POST `/api/gifs/trigger` | `routes/gifs.ts:284` | **admin** | déclenche GIF + son sur les écrans de la soirée active |
| GET `/api/gifs/audio` | `routes/gifs.ts:307` | public | liste des audios |
| DELETE `/api/gifs/audio/:filename` | `routes/gifs.ts:331` | **admin** | supprime un audio + ses associations |
| DELETE `/api/gifs/:filename` | `routes/gifs.ts:366` | **admin** | supprime un GIF |
| GET `/api/admin/backups` | `routes/admin.ts:13` | **admin** (`router.use` `:10`) | liste des sauvegardes |
| POST `/api/admin/backups` | `routes/admin.ts:23` | **admin** | snapshot immédiat |
| GET `/api/admin/backup.db` | `routes/admin.ts:34` | **admin** | télécharge la base vivante — **toutes soirées confondues** |
| GET `/api/admin/backups/:name` | `routes/admin.ts:44` | **admin** | télécharge une sauvegarde |
| GET `/uploads/*` | `app.ts:26` | public | médias statiques |
| GET `*` | `app.ts:42` | public | fallback SPA |

**`/api/events` existe** (E2, `routes/events.ts`) et les ressources sont montées en double
(hérité + `/api/events/:eventId/...`). Le routage **frontend** `/e/:slug` reste à faire
(vague 2, front FE). Contrat de référence :
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

| Sens | Nom | Serveur | Consommé par |
|---|---|---|---|
| reçu | `connection` + **auto-join** de la soirée active | `socket.service.ts:58,70` | — |
| reçu | `join {room}` + ack, motif `^event:\d+$`, quitte les autres rooms avant | `socket.service.ts:72-108` | **aucun émetteur frontend** |
| reçu | `disconnect` | `socket.service.ts:110` | `useSocket.ts:21` |
| émis | `donation:new` | `socket.service.ts:125` ← `routes/donations.ts:136` | `DisplayPage:135`, `DisplayPage8:84`, `DisplayHiddenPage:86`, `AdminPanel:105`, `DonorPlatesGrid:237`, `MenorahDisplay:81` |
| émis | `donation:updated` | `socket.service.ts:134` ← `routes/donations.ts:168` | idem, 5 écrans |
| émis | `donation:deleted` | `socket.service.ts:143` ← `routes/donations.ts:198` | idem, 5 écrans |
| émis | `config:updated` | `socket.service.ts:152` ← `routes/config.ts:31` | idem, 5 écrans |
| émis | `gif:trigger` | `socket.service.ts:161` ← `routes/gifs.ts:297` | `DisplayPage:141`, `DisplayPage8:85`, `DisplayHiddenPage:92` |

> **`join` n'est émis par aucun client** (0 occurrence dans `frontend/src`). Le « filet de
> compatibilité » qu'est l'auto-join de la soirée active est en pratique le **seul**
> mécanisme d'abonnement.

## ⚠ Défaut ouvert : la PII passe encore par le socket

`emitDonationNew` et `emitDonationUpdated` diffusent l'objet `donation` **complet** — email,
téléphone, référence — vers la room, donc vers **tous les écrans publics**
(`routes/donations.ts:136,168` vs `:98` ; `socket.service.ts:125-140`).

La même donnée est dépouillée en HTTP : `toPublicDonation` n'a **qu'un seul appelant**.
Le LOT 0a a fermé les routes HTTP le 2026-07-26 ; **la voie temps réel est restée ouverte**.

`tests/security/donations-pii.test.ts` ne couvre que HTTP (0 occurrence de `socket`).
Le message de commit `774aba9` annonce la fuite « vérifiée et son correctif bon marché » —
**le correctif n'est pas dans le code**.

C'est la priorité n°1 de `reste-a-faire.md`.

## Autres écarts relevés

| # | Constat | Source |
|---|---|---|
| C | **CORRIGÉ (E2)** — `PUT /api/donations/:id` passe désormais `currentAmount` (le montant du don existant) à `validateUpdateRequest` : modifier `premiumWordId` sans renvoyer `amount` n'efface plus le mot sacré | `routes/donations.ts` |
| D | Contrôle de traversée de chemin par **préfixe de chaîne**, pas par frontière : `path.join(dir,'../audio-evil/x')` passe le `startsWith`. Routes admin seulement → impact limité. **À corriger en E3 (C10)** | `routes/gifs.ts:336,371` |
| G | **Médias non cloisonnés par soirée** : GIF, audio et SVG à plat dans `uploads/`, associations dans un `gif-audio.json` global. **À corriger en E3 (B4)** | `routes/gifs.ts:22-24,130` |
| H | CORS incohérent : HTTP `origin:'*'`, socket restreint à `localhost:5173\|3000`. **À corriger en E3 (C8) via `CORS_ORIGIN`** | `app.ts`, `socket.service.ts:52-55` |
| I | Rate-limit **en mémoire, mono-instance**, basé sur un `x-forwarded-for` non validé, clé IP seule. **À corriger en E3 (B6) : clé IP+soirée** | `middleware/rate-limit.ts:7,23` |
| L | `GET /api/admin/backup.db` livre la base **entière, toutes soirées** — incompatible avec un futur multi-locataire | `routes/admin.ts:34` |
