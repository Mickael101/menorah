# Fondation multi-événements, sécurité et moteur de thèmes

**Date** : 2026-07-26
**Statut** : design validé, à planifier
**Portée** : LOT 0 (réparations + sécurité), LOT 1 (multi-événements), LOT 2 (moteur de thèmes)
**Suite** : la refonte UI/UX (LOT 3 à 6) fait l'objet d'un second document, résumé en annexe A.

---

## 1. Contexte et objectif

L'application pilote aujourd'hui **une seule soirée de dons**. Le commanditaire veut :

1. Pouvoir **changer de thème visuel facilement** s'il n'aime pas le rendu, sans redéploiement.
2. Piloter **plusieurs soirées, y compris simultanément**, sans qu'elles interfèrent.
3. À terme, **proposer l'application à d'autres synagogues** (sans comptes utilisateurs pour l'instant).

### Ce qui l'empêche aujourd'hui

| Verrou | Emplacement |
|---|---|
| Table `config` singleton verrouillée par `CHECK(id = 1)` | `backend/src/db/init.ts:60` |
| Toutes les lectures/écritures ciblent `WHERE id = 1` | `backend/src/services/config.service.ts:9,68` |
| Socket.IO diffuse à tous les clients (`io.emit`), les rooms ne sont jamais utilisées à l'émission | `backend/src/services/socket.service.ts:33-71` |
| Un unique `ADMIN_TOKEN` partagé pour toute l'application | `backend/src/middleware/admin-auth.ts:6` |
| Médias (GIFs, sons, SVG) stockés à plat, sans rattachement | `backend/src/routes/gifs.ts` |
| Thèmes codés en dur en TypeScript | `frontend/src/theme/displayThemes.ts` |

### Faille de sécurité à corriger en priorité

`GET /api/donations` (`backend/src/routes/donations.ts:78`) et `GET /api/donations/export.csv`
(`backend/src/routes/donations.ts:44`) **ne sont pas protégés** — seuls `PUT` et `DELETE` le sont.
N'importe qui connaissant l'URL peut télécharger **les noms, téléphones et emails des donateurs**.

Vérifié en production le 2026-07-26 : `/admin` s'ouvre sans authentification et affiche la liste
complète des donateurs.

---

## 2. Décisions validées

| Sujet | Décision |
|---|---|
| Direction visuelle | Navy + or sur **toutes** les surfaces (admin, `/don`, `/display`) |
| Accès aux soirées | **Slug dans l'URL** : `/e/:slug/admin`, `/e/:slug/display`, `/e/:slug/don` |
| Rôles | **Deux niveaux** : organisateur (global) + admin de soirée (code par soirée). Pas de comptes utilisateurs. |
| Ambition | Produit destiné à d'autres synagogues → chaque soirée porte sa propre marque |
| Échéance | Aucune — priorité à la qualité structurelle |

### Tension assumée

« Produit vendable » + « pas de comptes utilisateurs » ne sont cohérents que si **l'opérateur du
service crée les soirées pour ses clients** et leur remet un code. Le modèle de données doit donc
permettre d'ajouter une couche `organizations` + comptes **sans réécriture**, mais rien de tout cela
n'est construit maintenant.

Concrètement : la table `events` reçoit ses champs de marque directement ; le jour où une couche
organisation devient nécessaire, `events` gagne une colonne `organization_id` nullable et les champs
de marque migrent vers la nouvelle table. Aucune donnée existante n'est invalidée par ce chemin.

---

## 3. LOT 0 — Réparations et sécurité

Indépendant du reste, livrable immédiatement. Aucun changement de modèle de données.

### 3.1 Sécurité

- Protéger `GET /api/donations/export.csv` par `requireAdmin`.
- `GET /api/donations` : **corrigé après vérification du 2026-07-27.** La rédaction initiale
  demandait `requireAdmin` sur la route entière en supposant que `/display` n'en dépendait pas.
  C'est faux : **cinq écrans publics l'appellent** (`DisplayPage.vue:132`, `DisplayPage8.vue:83`,
  `DisplayHiddenPage.vue:83`, `MenorahAscension.vue:155`, `MenorahDisplay.vue:79`). Fermer la
  route aurait cassé l'écran de la salle.
  La décision retenue est une **projection publique par défaut** : sans token, la route répond
  `id, firstName, lastName, amount, premiumWordId, createdAt` — et rien d'autre. Le payload
  complet (email, téléphone, référence) exige `?full=1` **et** un token admin.
  Le modèle est cohérent avec le produit : **le nom d'un donateur s'affiche sur une plaque devant
  toute la salle, il est public par nature** ; son email, son téléphone et sa référence de
  paiement ne le sont pas, et sont fermés.
- **`ADMIN_TOKEN` absent ne doit plus signifier « accès libre »** (`admin-auth.ts:8-11`). En
  production, l'absence de secret doit refuser l'accès et logger une erreur au démarrage ; le
  contournement reste autorisé uniquement quand `NODE_ENV !== 'production'`.
- La page `/don` continue de fonctionner sans authentification : elle n'utilise que
  `POST /api/donations` (déjà limité par `createLimiter`) et `GET /api/config`.
- `GET /api/stats` reste public : il n'expose que des agrégats, aucune donnée nominative.

### 3.2 Défauts de rendu

| Défaut | Cause identifiée |
|---|---|
| Donut de progression admin toujours vide | `AdminPanel.vue` |
| Première rangée de plaques coupée en deux en permanence | `DonorPlatesGrid.vue` (défilement infini mal calé) |
| Montants presets en 5 + 1 orphelin sur desktop | `DonorPledgePage.vue` |

#### Courbe d'objectif — décision de design, pas une réparation

La « barre » de l'écran public n'est pas cassée : `StatsCompact.vue:64-76` dessine **délibérément
une courbe d'objectif** (Bézier de `(14,70)` vers un point proportionnel à l'avancement, avec un
aplat sous la courbe). Le rendu correspond à l'intention du code.

Ce qui ne fonctionne pas relève du design :

1. `preserveAspectRatio="none"` (`StatsCompact.vue:100`) étire un `viewBox` de 640×88 sur toute la
   largeur du conteneur, aplatissant la courbe en un filet quasi rectiligne.
2. L'aplat sous la courbe est un dégradé à `stop-opacity` 0,28 → 0 (`StatsCompact.vue:109-112`
   et `:220-223`) — quasi invisible sur fond sombre. *(Correction du 2026-07-27 : la référence
   `:235` de la rédaction initiale visait `.curve-point-glow`, pas l'aplat.)*
3. **Une courbe promet un historique qui n'existe pas.** La donnée est une valeur unique
   (`percentComplete`), pas une série temporelle. Le spectateur ne peut pas lire « 60,1 % de
   l'objectif » dans une diagonale.

**Décision** : remplacer la courbe par une **barre de progression remplie** — la forme qui
communique une proportion sans ambiguïté — avec jalons visibles aux paliers et animation de
remplissage à chaque don entrant (LOT 4). Une véritable courbe temporelle reste envisageable plus
tard, mais elle exigerait d'agréger les dons dans le temps, ce qui n'existe pas aujourd'hui.

Le LOT 0 se limite à rendre la courbe existante lisible (aplat opacifié, `preserveAspectRatio`
corrigé) ; le remplacement par une barre appartient au LOT 4.

### 3.3 Variables CSS inexistantes

15 références à des variables jamais déclarées (`--error-500`, `--error-50`, `--error-100`,
`--success-500`, `--border`) rendent les retours visuels invisibles :

- `DisplaySettingsPanel.vue:840, 841, 1040, 1386, 1389, 1681, 1721, 1854, 1855`
- `GifManager.vue:334, 434, 463, 464, 536, 537`

Effets constatés : erreur d'upload non colorée, bouton « Envoyé ! » sans fond vert.

Ces variables seront déclarées par la couche de tokens du LOT 2 ; en attendant, le LOT 0 les
déclare avec les valeurs cibles pour que les retours redeviennent lisibles immédiatement.

### 3.4 Typographie et hébreu

- Supprimer **Cinzel** et **Cormorant Garamond** de `frontend/index.html:12` : chargées, jamais
  référencées dans `src/`.
- Remplacer le `@import` de `assets/styles/global.css:2` par `<link rel="preconnect">` +
  `<link rel="stylesheet">` dans `index.html` (un `@import` CSS bloque et sérialise le chargement).
- **Charger Heebo** : la valeur `'Heebo'` figure dans `DonorPledgePage.vue:342` mais la police
  n'est chargée nulle part — l'hébreu tombe en fallback système.
- Neutraliser `letter-spacing` sur `[dir="rtl"]` / `:lang(he)` : les 5 à 8px appliqués
  (`DisplayPage.vue:700,710`, `DisplayPage8.vue:168-169`) dégradent fortement l'hébreu.

### 3.5 Critères d'acceptation du LOT 0

- `GET /api/donations/export.csv` renvoie 401 sans token valide.
- `GET /api/donations` sans token n'expose **ni email, ni téléphone, ni référence** ; le payload
  complet exige `?full=1` et un token valide. (Critère réécrit le 2026-07-27, voir §3.1.)
- En `NODE_ENV=production` sans `ADMIN_TOKEN`, le serveur refuse les routes admin et logge l'erreur.
- La courbe d'objectif est lisible : aplat visible sur fond sombre, courbure non écrasée.
- Le donut admin affiche le pourcentage réel.
- Aucune plaque n'est tronquée verticalement au repos ni pendant le défilement.
- Les messages d'erreur et de succès de l'admin sont colorés.
- L'hébreu s'affiche en Heebo, sans `letter-spacing` parasite.

---

## 4. LOT 1 — Fondation multi-événements

### 4.1 Modèle de données

```
events
  id              INTEGER PK
  slug            TEXT UNIQUE NOT NULL      -- 'orot-netanel'
  name            TEXT NOT NULL
  status          TEXT NOT NULL             -- 'draft' | 'active' | 'archived'
  admin_code_hash TEXT NOT NULL             -- code admin de la soirée, haché
  -- marque (rend l'application revendable)
  logo_url        TEXT
  default_locale  TEXT NOT NULL DEFAULT 'he'
  currency        TEXT NOT NULL DEFAULT 'ILS'
  created_at      TEXT
  archived_at     TEXT

event_configs                                -- remplace le singleton `config`
  event_id        INTEGER PK REFERENCES events(id)
  goal_amount     INTEGER
  preset_amounts  TEXT                       -- JSON
  premium_tiers   TEXT                       -- JSON — aujourd'hui codé en dur
  menorah_segments TEXT                      -- JSON
  display_settings TEXT                      -- JSON
  theme_id        INTEGER REFERENCES themes(id)
  updated_at      TEXT

donations
  + event_id      INTEGER NOT NULL REFERENCES events(id)
  INDEX (event_id, created_at)

media                                        -- GIFs, sons, SVG
  id, event_id, kind, filename, audio_filename, created_at

themes                                       -- voir LOT 2
  id, event_id (NULL = preset livré), name, tokens_json, created_at
```

La contrainte `CHECK(id = 1)` disparaît. `config.service` prend un `eventId` en paramètre partout.

### 4.2 Migration des données existantes

Migration idempotente au démarrage :

1. Créer les nouvelles tables.
2. Créer l'événement n°1 : slug `orot-netanel`, nom repris de la configuration de marque
   existante, statut `active`.
3. `UPDATE donations SET event_id = 1 WHERE event_id IS NULL`.
4. Copier la ligne `config` (id=1) vers `event_configs` (event_id=1).
5. Rattacher tous les médias existants à l'événement 1.
6. Conserver la table `config` en lecture seule une version, puis la supprimer au LOT 6.

**Aucune perte de donnée.** Un dump de la base est pris avant migration
(`backup.service.ts` fournit déjà le mécanisme).

### 4.3 Routage

| Nouvelle route | Ancienne route | Comportement |
|---|---|---|
| `/e/:slug/admin` | `/admin` | `/admin` → sélecteur de soirée pour l'organisateur |
| `/e/:slug/display` | `/display` | `/display` → redirection vers la soirée `active` |
| `/e/:slug/don` | `/don` | `/don` → redirection vers la soirée `active` |

**Les anciennes URL doivent continuer de fonctionner** : des QR codes vers `/don` peuvent déjà être
imprimés ou distribués. Si plusieurs soirées sont `active`, `/don` redirige vers la plus récemment
créée et l'admin affiche un avertissement explicite.

API : les routes deviennent `/api/events/:eventId/donations`, `/api/events/:eventId/config`, etc.
Les anciennes routes `/api/donations` restent une version, résolues sur la soirée active, puis
sont retirées au LOT 6.

### 4.4 Isolation temps réel

C'est le cœur du « sans que ça gêne ». Aujourd'hui `socket.service.ts:33-71` émet en global : un
don sur la soirée A déclencherait les confettis sur l'écran de la soirée B.

- Chaque client rejoint la room `event:<id>` à la connexion (le handler `join` existe déjà,
  `socket.service.ts:20-23`).
- **Chaque `emit` devient `io.to("event:" + eventId).emit(...)`** — sans exception :
  `donation:new`, `donation:updated`, `donation:deleted`, `config:updated`, `gif:trigger`.
- La signature de chaque méthode du service reçoit `eventId` en premier paramètre, pour que
  l'oubli soit une erreur de compilation TypeScript plutôt qu'une fuite silencieuse.

### 4.5 Authentification à deux niveaux

| Rôle | Secret | Peut |
|---|---|---|
| **Organisateur** | `ORGANIZER_TOKEN` (variable d'environnement) | Créer, éditer, archiver les soirées ; accéder à toutes |
| **Admin de soirée** | Code propre à la soirée, haché en base | Saisir les dons, régler l'affichage et le thème **de sa soirée uniquement** |

- Le middleware devient `requireEventAdmin(eventId)` : accepte le token organisateur **ou** le code
  de la soirée ciblée.
- Un admin de la soirée A reçoit 403 sur les ressources de la soirée B — **à couvrir par un test**.
- Le code de soirée est stocké **haché**, jamais en clair.
- Remplacement de `window.prompt()` (`useAdminAuth.ts:27`) par un véritable écran de connexion,
  avec message d'erreur explicite en cas de code refusé.

### 4.6 Critères d'acceptation du LOT 1

- Deux soirées créées, chacune avec ses dons : chaque `/e/:slug/display` n'affiche **que** ses
  propres dons et ne réagit **qu'**à ses propres événements socket (vérification navigateur avec
  deux onglets ouverts simultanément).
- Un don saisi sur la soirée A ne produit aucune animation sur l'écran de la soirée B.
- Le code admin de la soirée A renvoie 403 sur `/api/events/<B>/donations`.
- `/don`, `/display` et `/admin` sans slug continuent de fonctionner.
- Après migration, les 30 dons existants sont intacts et rattachés à `orot-netanel`.

---

## 5. LOT 2 — Moteur de thèmes

### 5.1 Principe

**Un thème devient une donnée, plus du code.** Aujourd'hui les thèmes sont figés dans
`frontend/src/theme/displayThemes.ts` : en changer exige un redéploiement.

### 5.2 Couche de tokens

Un fichier `assets/styles/tokens.css` devient la source de vérité unique. Il remplace la palette
actuelle de `global.css:9-91`, dont la couleur primaire est un **bleu royal** — c'est précisément ce
qui produit l'admin « SaaS générique » sans rapport avec l'écran public.

```
surfaces    --surface-base --surface-1 --surface-2 --surface-3
or          --gold-100 … --gold-700
texte       --text-strong --text --text-muted --text-faint
sémantique  --success --danger --warning --info  (+ variantes -soft)
espace      --space-1 … --space-10          (base 4px — inexistant aujourd'hui)
radius      --radius-sm/md/lg/xl/full
ombres      --shadow-1/2/3 --glow-gold
typo        --text-xs … --text-5xl          (clamp)
motion      --dur-fast/base/slow --ease-out/spring --motion-intensity
polices     --font-sans --font-display --font-he
```

**Articulation avec le thème runtime existant** : les tokens statiques deviennent les *valeurs par
défaut* que le thème de la soirée surcharge — `--surface-1: var(--theme-bg, #0b1020)`. Toute la
personnalisation admin actuelle continue de fonctionner.

Le bloc `--success` / `--danger` **résout au passage les 15 variables fantômes** du LOT 0.

### 5.3 Fonctionnalités

- **Presets livrés** (Cérémoniel or, Nuit profonde, Moderne clair) + **thèmes personnalisés stockés
  en base, rattachés à une soirée**.
- **Galerie dans l'admin** : vignettes, **aperçu en direct sans enregistrer** — appliquer, regarder,
  garder ou annuler.
- **Dupliquer et modifier** : partir d'un preset, ajuster, sauvegarder sous un nouveau nom.
- **Le thème couvre tous les tokens**, pas seulement les 9 couleurs actuelles de
  `DEFAULT_THEME_PALETTES` : surfaces, dégradé d'or, textes, arrondis, polices, intensité des
  animations.
- **Export / import JSON** : réutiliser un thème d'une soirée à l'autre.
- **L'admin suit le thème de la soirée** (direction navy + or validée) : l'organisateur voit son
  thème pendant qu'il travaille.

### 5.4 Contraste

L'admin passant sur fond sombre, la saisie prolongée impose une exigence explicite : **tout texte de
saisie et tout libellé doit atteindre un contraste AA (4,5:1)**. Les valeurs actuelles du type
`rgba(255,255,255,0.4)` sur `#1a1a2e` (`DonationForm.vue:1006, 780`) ne passent pas et doivent être
relevées. Un thème personnalisé qui descendrait sous ce seuil déclenche un avertissement dans la
galerie — sans bloquer l'enregistrement.

### 5.5 Critères d'acceptation du LOT 2

- Changer de thème depuis l'admin modifie l'écran public **sans redéploiement**.
- L'aperçu peut être annulé sans avoir rien écrit en base.
- Un thème exporté puis importé sur une autre soirée produit un rendu identique.
- Deux soirées simultanées peuvent porter deux thèmes différents sans interférence.
- Tous les textes de saisie de l'admin atteignent 4,5:1, mesuré.

---

## 6. Risques

| Risque | Portée | Mitigation |
|---|---|---|
| Migration de données destructive | Élevée | Dump avant migration, migration idempotente, restauration testée avant déploiement |
| `emit` global oublié → fuite entre soirées | Élevée | `eventId` en paramètre obligatoire (erreur de compilation), test deux-soirées |
| QR codes `/don` déjà distribués cassés | Élevée | Anciennes routes conservées et redirigées ; testées explicitement |
| ~~Fermeture de `GET /api/donations` casse un usage légitime~~ **Risque réalisé** | Moyenne | Vérifié le 2026-07-27 : `/display` en dépend bel et bien (5 appels). Mitigé par la projection publique décrite en §3.1, pas par une fermeture. `/api/stats` reste public |
| `sql.js` réécrit le fichier entier à chaque écriture (`db/init.ts:88`) | Faible à ce volume | Documenté comme dette ; migration vers `better-sqlite3` hors périmètre |
| Admin sombre moins lisible en saisie longue | Moyenne | Exigence AA explicite, vérification au navigateur |

---

## 7. Hors périmètre (YAGNI)

- Comptes utilisateurs, inscription, réinitialisation de mot de passe, invitations par email.
- Couche `organizations`, facturation, onboarding client, marque blanche complète.
- Sous-domaines par soirée (DNS et certificat wildcard).
- Migration `sql.js` → `better-sqlite3`.

---

## Annexe A — Refonte UI/UX (LOT 3 à 6), décidée, à spécifier

Design validé avec le commanditaire le 2026-07-26, à détailler dans un second document une fois la
fondation livrée.

**LOT 3 — Kit UI et admin réorganisé.** Aucun composant partagé n'existe aujourd'hui : 42 boutons,
52 inputs, 44 labels stylés localement, 6 boutons « supprimer » différents, 3 apparences pour
« Enregistrer », 4 styles d'input incompatibles, 4 variantes du même « radio-card ».
Créer `components/ui/` : `UiButton`, `UiField`, `UiInput`, `UiNumberInput`, `UiColorInput`,
`UiCard`, `UiToggle`, `UiRadioCard`, `UiModal`, `UiToast` + `useToast()`, `UiEmptyState`, `UiTabs`
(avec `role="tablist"` et navigation clavier).

Nouvelle architecture d'information de l'admin, en cinq onglets : **Dons** (un seul bouton submit —
il y en a deux identiques aujourd'hui, `DonationForm.vue:317` et `:462`) · **Apparence**
(thème, scène, plaques, graphique — les couleurs sont éclatées sur 4 sections) · **Contenus**
(écran public, page `/don`, identité admin — regroupe toute la copie multilingue) ·
**Médias & sons** (l'audio est aujourd'hui coupé entre deux onglets) · **Campagne** (objectif,
presets, **paliers premium 26k/36k/72k rendus éditables** — codés en dur dans
`DonationForm.vue:36-40`).

Transversalement : sauvegarde par section avec barre sticky, **garde-fou contre la perte silencieuse
des modifications** (changement d'onglet et écrasement par événement socket, `AdminPanel.vue:320`
et `DisplaySettingsPanel.vue:57-59`), et `isLoading` / `error` passés de refs globales
(`useDonations.ts:265-266`) à un état par requête.

**LOT 4 — Écran public unifié.** Fusionner `/display`, `/display-light` et `/display-hidden`, qui
sont trois forks divergents : les deux derniers ont leurs textes codés en dur en français
(« SOIRÉE DE GÉNÉROSITÉ / OHEL YEHOSHUA » — l'ancien nom) et **aucun `dir="rtl"`**. Une seule page
pilotée par configuration (`density`, `showAmounts`). **Remplacement de la courbe d'objectif par une
barre de progression remplie** (voir §3.2), avec jalons aux paliers et animation de remplissage à
chaque don. Correction du défilement des plaques (`transform: translateY()` au lieu de
`scrollTop +=` par frame, `DonorPlatesGrid.vue:90`).

**LOT 5 — Animations et fluidité.** `useAnimatedNumber()` remplace **5 implémentations
`requestAnimationFrame` quasi identiques** (`DonorPlateAnimation.vue:68-85`, `TotalCounter.vue:29-40`,
`StatsCompact.vue:41-45`, `ProgressBar.vue:28-32`, `DonorPledgePage.vue:147-158`).
`useCelebration()` remplace le bloc « explosion GIF » copié **3 fois**.
Ajout de **`@formkit/auto-animate`** (~2 ko) sur les listes. **View Transitions** natives entre
onglets. Passage des animations en `transform`/`opacity` (aujourd'hui `width`/`height` animés
jusqu'à **300vw**, `DisplayPage.vue:492-538`). `prefers-reduced-motion` porté de ~30 % à 100 % de
couverture ; les 110 confettis en `infinite` (`DonorPledgePage.vue:627-634`) reçoivent une fin.

**Sur la bibliothèque d'animation.** GSAP est **déjà installé** (`gsap ^3.14.1`) et n'est utilisé que
dans 2 fichiers, dont un mort. Le manque n'est pas une bibliothèque, c'est son usage. Le chargement
par CDN façon Google Fonts est écarté : sur une application buildée par Vite, il supprime le
tree-shaking, ajoute un aller-retour réseau bloquant, casse le fonctionnement hors-ligne et laisse
la version dériver. Seul ajout retenu : `@formkit/auto-animate`.

**LOT 6 — Nettoyage.** `MenorahAscension.vue` (1062 lignes, jamais routé), `ProgressBar.vue` et
`TotalCounter.vue` (jamais importés), 6 `@keyframes` inutilisées (`global.css:123-167`), les deux
forks de display, la table `config` et les routes d'API héritées. Environ **2400 lignes supprimées**.

---

## Annexe B — Ordre de livraison

Chaque lot est déployable et vérifié au navigateur avant le suivant.

| Lot | Contenu | Dépend de |
|---|---|---|
| 0 | Réparations + sécurité | — |
| 1 | Fondation multi-événements | 0 |
| 2 | Moteur de thèmes | 1 |
| 3 | Kit UI + admin réorganisé | 2 |
| 4 | Écran public unifié | 2 |
| 5 | Animations et fluidité | 3, 4 |
| 6 | Nettoyage | 5 |

La refonte UI (3 à 6) vient **après** la fondation : l'inverse imposerait de retoucher chaque écran
une seconde fois pour y injecter la notion de soirée.
