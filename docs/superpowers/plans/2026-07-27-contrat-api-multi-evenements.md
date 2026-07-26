# Contrat d'API — fondation multi-événements (LOT 1)

**Statut** : figé le 2026-07-27, avant la première ligne de code du LOT 1.
**Raison d'être** : la reconnaissance frontend a identifié qu'attaquer le LOT 1 sans accord écrit
sur la forme des réponses transforme chaque étape suivante en réécriture. Ce document est cet
accord. Il est la référence unique pour le backend comme pour le frontend.

## Principe : addition, jamais substitution

Le LOT 1 **ajoute** les routes `/api/events/:eventId/...` et **conserve** toutes les routes
actuelles, qui résolvent désormais sur la soirée **active**. Rien n'est supprimé : des QR codes
vers `/don` peuvent déjà être imprimés, et cinq écrans publics appellent les anciennes routes.
Le retrait des routes héritées appartient au LOT 6.

« Soirée active » = la soirée de statut `active` la plus **récemment créée** s'il y en a plusieurs.
Ce cas déclenche un avertissement explicite dans l'administration : deux soirées actives
simultanées sont légitimes, mais l'ambiguïté d'une URL sans slug ne doit pas être silencieuse.

## Authentification

### Deux niveaux, un seul en-tête

| Rôle | Secret | Peut |
|---|---|---|
| Organisateur | `ORGANIZER_TOKEN` (variable d'environnement) | Tout, sur toutes les soirées |
| Admin de soirée | code propre à la soirée, **haché** en base | Sa soirée uniquement |

L'en-tête reste **`x-admin-token`** (et le repli `?token=` existant est conservé). Le middleware
compare la valeur reçue, dans cet ordre :

1. égale à `ORGANIZER_TOKEN` → accès organisateur ;
2. égale à `ADMIN_TOKEN` → accès organisateur. **Alias de compatibilité, non négociable** : la
   production a `ADMIN_TOKEN` configurée. Renommer le secret sans alias enfermerait
   le commanditaire dehors au premier déploiement ;
3. son empreinte correspond à `events.admin_code_hash` de la soirée **ciblée** → accès à cette
   soirée seulement ;
4. sinon → 401. Une valeur valide pour la soirée A sur une ressource de la soirée B → **403**,
   pas 401 : le secret est bon, c'est la portée qui est refusée. Distinction couverte par un test.

Le comportement « secret absent » du LOT 0 est conservé : en `NODE_ENV=production`, l'absence de
tout secret configuré renvoie 503 et logue une erreur ; hors production, le contournement de
développement reste autorisé.

### Hachage du code de soirée

`crypto.scryptSync` de la bibliothèque standard de Node — **aucune dépendance ajoutée**, ce qui
respecte la contrainte YAGNI du projet. Format stocké, auto-descriptif :

```
scrypt$<N>$<r>$<p>$<sel en base64>$<empreinte en base64>
```

Comparaison en temps constant (`crypto.timingSafeEqual`). Le code en clair n'est **jamais** écrit
en base, ni logué, ni renvoyé par une route. La création d'une soirée le renvoie **une seule
fois**, dans la réponse du POST, pour que l'organisateur puisse le transmettre.

## Routes

### Soirées

| Méthode | Chemin | Accès | Réponse |
|---|---|---|---|
| `GET` | `/api/events` | organisateur | `{ events: EventSummary[] }` |
| `POST` | `/api/events` | organisateur | `{ event: EventSummary, adminCode: string }` — le code en clair, une seule fois |
| `GET` | `/api/events/active` | **public** | `{ event: EventPublic \| null, multipleActive: boolean }` |
| `GET` | `/api/events/by-slug/:slug` | **public** | `{ event: EventPublic }` ou 404 |
| `PUT` | `/api/events/:eventId` | admin de la soirée | `{ event: EventSummary }` |
| `POST` | `/api/events/:eventId/admin-code` | organisateur | `{ adminCode: string }` — régénère |

`GET /api/events/by-slug/:slug` et `/api/events/active` sont **publics par nécessité** : le
frontend doit résoudre le slug en identifiant *avant* de pouvoir s'authentifier. Ils n'exposent
que ce qui est déjà affiché à l'écran de la salle.

```ts
EventPublic  = { id, slug, name, status, logoUrl, defaultLocale, currency }
EventSummary = EventPublic & { createdAt, archivedAt, donationCount, totalAmount }
```

`EventSummary` n'expose **jamais** `admin_code_hash`.

### Ressources d'une soirée

Chaque route héritée a exactement une contrepartie préfixée, **de forme de réponse identique** —
c'est la condition pour que le frontend migre sans réécrire ses composables.

| Nouvelle route | Route héritée équivalente | Accès |
|---|---|---|
| `GET /api/events/:eventId/config` | `GET /api/config` | public |
| `PUT /api/events/:eventId/config` | `PUT /api/config` | admin de la soirée |
| `GET /api/events/:eventId/donations` | `GET /api/donations` | public en projection ; `?full=1` exige un token |
| `POST /api/events/:eventId/donations` | `POST /api/donations` | public, limité par `createLimiter` |
| `GET /api/events/:eventId/donations/:id` | `GET /api/donations/:id` | admin de la soirée |
| `PUT /api/events/:eventId/donations/:id` | `PUT /api/donations/:id` | admin de la soirée |
| `DELETE /api/events/:eventId/donations/:id` | `DELETE /api/donations/:id` | admin de la soirée |
| `GET /api/events/:eventId/donations/export.csv` | `GET /api/donations/export.csv` | admin de la soirée |
| `GET /api/events/:eventId/stats` | `GET /api/stats` | public |
| `GET /api/events/:eventId/gifs` | `GET /api/gifs` | public |
| mutations `gifs` sous `/api/events/:eventId/gifs/...` | idem sous `/api/gifs/...` | admin de la soirée |
| `GET /api/donations/premium-words` | inchangé, sans soirée | public |

Formes de réponse, reprises **à l'identique** de l'existant :

```ts
GET .../config     -> { goalAmount, presetAmounts, menorahSegments, displaySettings }
GET .../donations  -> { donations: Donation[], stats: DonationStats }
GET .../stats      -> { totalAmount, donationCount, percentComplete, litSegments }
```

Un `:eventId` inexistant renvoie **404**, jamais un repli silencieux sur une autre soirée : un
repli ferait afficher les dons de la soirée A sur l'écran de la soirée B — exactement ce que le
LOT 1 existe pour empêcher.

## Temps réel

- Chaque client rejoint la room **`event:<id>`** dès que son identifiant de soirée est résolu
  (le handler `join` existe déjà, `socket.service.ts:20-23`).
- **Chaque `emit` devient `io.to('event:' + eventId).emit(...)`**, sans exception :
  `donation:new`, `donation:updated`, `donation:deleted`, `config:updated`, `gif:trigger`.
- `eventId` devient le **premier paramètre obligatoire** de chaque méthode du service. C'est le
  cœur du dispositif : un oubli devient une **erreur de compilation TypeScript** au lieu d'une
  fuite silencieuse d'une soirée vers l'autre.
- Un client qui n'a pas rejoint de room ne reçoit plus rien. C'est voulu : mieux vaut un écran qui
  ne s'animera pas qu'un écran qui s'anime pour la mauvaise soirée.

## Routage frontend

| Nouvelle route | Route héritée | Comportement de l'héritée |
|---|---|---|
| `/e/:slug/admin` | `/admin` | sélecteur de soirée pour l'organisateur |
| `/e/:slug/display` | `/display` | redirige vers la soirée active |
| `/e/:slug/don` | `/don`, `/donate` | redirige vers la soirée active |
| `/e/:slug/display-light` | `/display-light` | redirige vers la soirée active |
| `/e/:slug/display-hidden` | `/display-hidden` | redirige vers la soirée active |

Les six URL héritées sont **vérifiées explicitement au navigateur** : c'est le critère
d'acceptation le moins coûteux à valider et le plus coûteux à rattraper après distribution de
QR codes.

`window.prompt()` (`useAdminAuth.ts:27`) est remplacé par un véritable écran de connexion : champ
de code, message d'erreur explicite en cas de refus, et mention de la soirée concernée — un
opérateur qui saisit le code de la soirée A sur la soirée B doit comprendre *pourquoi* c'est
refusé.

## Ce que le LOT 1 ne fait pas

- Aucun compte utilisateur, aucune inscription, aucun mot de passe oublié.
- Aucune couche `organizations`, aucune facturation.
- La table `config` est **conservée en lecture** une version, puis supprimée au LOT 6.
- Aucune migration de `sql.js` vers `better-sqlite3`.
