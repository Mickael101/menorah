# API HTTP et événements Socket.IO

Vérifié le **2026-07-27** contre `099918c`.

## Règle de montage

`/api/donations`, `/api/stats`, `/api/config` et `/api/gifs` passent **tous** par
`resolveActiveEvent` (`app.ts:32-36`) → **503 si aucune soirée n'est `active`**
(`resolve-event.ts:26`).

`/api/admin` en est **volontairement exclu** (`app.ts:30-31`) : les sauvegardes doivent
rester accessibles même sans soirée active.

## Endpoints

| Méthode + chemin | Fichier:ligne | Accès | Rôle |
|---|---|---|---|
| GET `/api/health` | `app.ts:38` | public | healthcheck Railway |
| GET `/api/donations/premium-words` | `routes/donations.ts:33` | public | mots premium, disponibilité, paliers. Renvoie `donorName` — noms publics par nature (mur des plaques) |
| GET `/api/donations/export.csv?lang=` | `routes/donations.ts:45` | **admin** | export CSV UTF-8 BOM, anti-injection de formule (`:25`) |
| GET `/api/donations` | `routes/donations.ts:85` | public | liste **dépouillée** via `toPublicDonation` + stats |
| GET `/api/donations?full=1` | `routes/donations.ts:85-90` | **admin** | payload complet : email, téléphone, référence |
| GET `/api/donations/:id` | `routes/donations.ts:108` | **admin** | un don complet |
| POST `/api/donations` | `routes/donations.ts:128` | public + **rate-limit 10 / 10 min / IP** (`:13`) | création publique (`/don`) + diffusion socket |
| PUT `/api/donations/:id` | `routes/donations.ts:150` | **admin** | modification + diffusion socket |
| DELETE `/api/donations/:id` | `routes/donations.ts:182` | **admin** | suppression + diffusion socket |
| GET `/api/stats` | `routes/stats.ts:8` | public | total, nombre, pourcentage, segments allumés |
| GET `/api/config` | `routes/config.ts:12` | public | config de la soirée active |
| PUT `/api/config` | `routes/config.ts:23` | **admin** | mise à jour + diffusion socket |
| GET `/api/gifs` | `routes/gifs.ts:166` | public (GET exempté `:13-19`) | liste des GIF + audio associé |
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

**`/api/events` et `/e/:slug` n'existent pas** (grep sur `backend/src` : 0 résultat), alors
que le schéma multi-événements est en base. Contrat figé prêt à implémenter :
`superpowers/plans/2026-07-27-contrat-api-multi-evenements.md`.

## Authentification

`requireAdmin` (`middleware/admin-auth.ts`) accepte le jeton par header `x-admin-token`
**ou** par `?token=` (`:22-23`).

| `ADMIN_TOKEN` | `NODE_ENV=production` | Comportement |
|---|---|---|
| absent | oui | **503 sur toutes les routes admin** (fail-closed, corrigé le 2026-07-26 par `d9aae2d`) |
| absent | non | **routes ouvertes** — voir l'avertissement de `tests.md` |
| présent | — | jeton exigé et comparé |

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
| C | `validateUpdateRequest` sans `currentAmount` : le mot sacré n'était **pas** effacé (mesuré — le service ignore une clé `undefined`, le mot stocké survit) ; le `\|\| 0` faisait seulement **taire** un changement de mot quand `amount` était absent. Garde-fou posé côté modèle (`??` + skip si montant inconnu) : un montant absent ne peut jamais valider un mot contre zéro. Test `services/premium-word-update.test.ts` | `models/donation.ts:154` |
| D | Contrôle de traversée de chemin par **préfixe de chaîne**, pas par frontière : `path.join(dir,'../audio-evil/x')` passe le `startsWith`. Routes admin seulement → impact limité | `routes/gifs.ts:336,371` |
| G | **Médias non cloisonnés par soirée** : GIF, audio et SVG à plat dans `uploads/`, associations dans un `gif-audio.json` global, alors que les routes passent par `resolveActiveEvent` | `routes/gifs.ts:22-24,130` |
| H | CORS du socket **désormais configurable** via `CORS_ORIGIN` (défaut = `localhost:5173\|3000`, inchangé). Le HTTP (`app.ts`) doit lire la **même** variable — porté par le front backend | `socket.service.ts:socketCorsOrigin` |
| I | Rate-limit **en mémoire, mono-instance**, basé sur un `x-forwarded-for` non validé, posé sur `POST /api/donations` seulement. Aucun `trust proxy` Express | `middleware/rate-limit.ts:7,23` |
| L | `GET /api/admin/backup.db` livre la base **entière, toutes soirées** — incompatible avec un futur multi-locataire | `routes/admin.ts:34` |
