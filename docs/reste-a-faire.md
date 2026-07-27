# Ce qui reste à faire

Vérifié le **2026-07-27** contre `099918c`. **Chaque item ci-dessous a été re-grepé dans le
code** — ce ne sont pas des reprises de plan, ce sont des absences constatées aujourd'hui.

Les familles sont distinctes : elles n'ont ni le même propriétaire, ni le même horizon.

---

## 🔴 A. Sécurité — à traiter avant toute autre chose

| # | À faire | Preuve d'aujourd'hui |
|---|---|---|
| **A1** | **Fermer la fuite PII par Socket.IO.** `emitDonationNew` et `emitDonationUpdated` diffusent l'objet `donation` **complet** (email, téléphone, référence) à la room, donc à tous les écrans publics. | `socket.service.ts:125-140` — vérifié : `emit('donation:new', { donation, stats })`, aucune projection. `toPublicDonation` n'a qu'un seul appelant, côté HTTP. |
| **A2** | **Roter l'`ADMIN_TOKEN`.** Sa valeur de production a été écrite en clair dans un transcript de session le 2026-07-26, et traîne dans `~/.menorah-admin-token.txt`. | Fichier confirmé présent, 24 octets, daté 2026-07-21. Rotation proposée le 2026-07-26, **jamais demandée**. |
| **A3** | **Tester l'export CSV sur son contenu**, pas seulement sur le statut et le MIME. C'est la seule route qui expose email et téléphone en clair, et sa mutation a survécu. | Mutation testing du 2026-07-27 : 25 rejouées, 17 tuées, celle-ci survivante. Test correctif **déjà rédigé et validé**, non appliqué. |
| **A4** | Tuer les 2 autres mutations survivantes : config de B comparée aux seuls défauts (un `UPDATE` sans `WHERE` passerait) ; résolution de soirée active comparée à `1`, la valeur semée (assertion tautologique). | Idem — tests correctifs déjà rédigés. |
| **A5** | Ajouter un test qui couvre A1. `donations-pii.test.ts` ne teste que HTTP. | 0 occurrence de `socket` dans le fichier. |

> Le message de commit `774aba9` annonce la fuite socket « vérifiée et son correctif bon
> marché ». **Le correctif n'est pas dans le code** — seule la documentation a été écrite.

---

## 🟠 B. Le multi-événements est à moitié livré

La base sait gérer N soirées. **Rien au-dessus ne le sait.**

| # | À faire | Preuve d'aujourd'hui |
|---|---|---|
| **B1** | Créer les routes `/api/events/:eventId/...` | `grep "api/events" backend/src frontend/src` → **0 résultat**. Contrat déjà figé : `superpowers/plans/2026-07-27-contrat-api-multi-evenements.md` |
| **B2** | Authentification à deux niveaux : `ORGANIZER_TOKEN` en env + code admin par soirée haché | `admin_code_hash` existe en base, jamais exploité |
| **B3** | Routage `/e/:slug` côté frontend + écran de connexion remplaçant `window.prompt` | `grep "eventId" frontend/src` → **0 fichier**. Le frontend ignore totalement la notion de soirée |
| **B4** | Cloisonner les médias par soirée | `GET /api/gifs` lit `gifUploadDir` à plat (`routes/gifs.ts:166-172`) ; associations dans un `gif-audio.json` global. Tables `media` et `themes` **créées et jamais lues ni écrites** |
| **B5** | Vérifier au navigateur avec **deux soirées ouvertes simultanément** — en deux *contextes* distincts, pas deux onglets (`localStorage` partagé) | La clé `menorah_admin_token` est unique : un login soirée B écrase soirée A |
| **B6** | Rate-limit keyé par IP seule → deux soirées derrière un même NAT se volent le quota | `middleware/rate-limit.ts:7,23` |

### Findings mineurs du même chantier

| Constat | Preuve |
|---|---|
| `multipleActive` est **calculé puis jeté** alors que le contrat exige un avertissement | `event.service.ts:56` l'assigne, aucun lecteur dans tout `backend/src` |
| `UnknownEventError` sort en **400 avec un message interne** au lieu d'un 404 | `event.service.ts:16-21`, aucune correspondance HTTP dans les routes |
| L'ordre des middlewares fait qu'un **503 masque un 401** sur l'export CSV | — |

---

## 🟡 C. Qualité et dette — LOT 2 → 6

| # | À faire | Détail |
|---|---|---|
| **C1** | Moteur de thèmes : `tokens.css`, thèmes en base, galerie, aperçu live annulable, export/import JSON, **exigence de contraste AA** | table `themes` déjà créée |
| **C2** | Kit UI + admin réorganisé | 5 onglets |
| **C3** | Display unifié — **fusionner les 3 forks** (`DisplayPage`, `DisplayPage8`, `DisplayHiddenPage`) | 2 360 lignes cumulées, largement redondantes |
| **C4** | Animations centralisées + `@formkit/auto-animate` | — |
| **C5** | **Supprimer ≈1 900 lignes de code mort** | Vérifié aujourd'hui, 0 importeur : `MenorahAscension.vue` (1062), `ProgressBar.vue` (286), `TotalCounter.vue` (262). `useSoundEffects.ts` (304) n'est importé que par `MenorahAscension` → mort par transitivité. Aussi : devDep `postcss` sans `postcss.config.*` |
| **C6** | Supprimer la table `config` héritée, recréée à chaque démarrage alors que plus rien ne l'écrit | `db/init.ts:74-93` vs `config.service.ts:6-8`. Le commentaire annonce sa suppression au LOT 6 |
| **C7** | Dédupliquer la chaîne de build entre `railway.json:5` et `nixpacks.toml:8-16` | Une divergence ne se verrait qu'au déploiement |
| **C8** | Rendre CORS configurable — HTTP est `origin:'*'`, le socket est figé sur `localhost` | `app.ts:17-20` vs `socket.service.ts:52-55` |
| **C9** | Corriger l'effacement silencieux du mot sacré : `validateUpdateRequest` appelée sans `currentAmount` fait retomber le montant à `0` | `models/donation.ts:105,155` vs `routes/donations.ts:158` |
| **C10** | Remplacer le contrôle de traversée par préfixe de chaîne par une vraie frontière de chemin | `routes/gifs.ts:336,371` — routes admin seulement, impact limité |

---

## 🔵 D. Design en suspens

| # | À faire | Source |
|---|---|---|
| **D1** | Remplacer la courbe d'objectif par une barre remplie (§3.2 de la spec) | Décision de design, pas un bug — la courbe de Bézier actuelle est délibérée |
| **D2** | Définir le comportement de `/don` quand **plusieurs soirées sont actives** | §4.3 de la spec, non tranché |

---

## ⚪ E. À faire par l'admin lui-même (pas de code, effet immédiat)

Ces retouches se font dans `/admin`, sans déploiement. Signalées le 2026-07-26, **non faites**.

| # | À faire |
|---|---|
| **E1** | Vider le kicker hébreu « קמפיין תרומות » (l'utilisateur dit « ערב תרומות ») |
| **E2** | Poser le sous-titre fondateurs |
| **E3** | Corriger le preset `1008000` agorot (₪10 080) → `1080000` (₪10 800) |
| **E4** | Supprimer le don de test `id=88` (« TEST », 1 ₪), toujours en base de production |

---

## ⚫ F. Angles morts — rien n'existe, et personne ne l'a décidé

Ce ne sont pas des tâches en retard : ce sont des sujets sur lesquels **aucune décision n'a
jamais été prise**. Vérifié : aucune trace en mémoire, aucune trace dans le code.

| Sujet | État |
|---|---|
| **Rétention / RGPD** des données donateurs | Aucune durée de conservation, aucun droit à l'effacement, aucune base légale — alors que la PII est le fil rouge des 3 dernières sessions |
| **CI** | Aucune. Les 63 tests ne tournent que si quelqu'un les lance à la main, depuis le bon répertoire. Cohérent avec un service Railway sans source GitHub, mais aucun gate n'est automatisé |
| **Monitoring / alerting** | Aucun. Aucune supervision du volume `/data`, aucun runbook d'incident |
| **Restauration de sauvegarde** | Les sauvegardes sont produites et tournées (rotation 60), mais **aucune restauration n'a jamais été testée** — inspecter les tables du fichier produit, pas seulement son existence |
| **Tests frontend** | Zéro. Seul garde-fou : `npm run typecheck` |
| **Encaissement** | `/don` semble purement déclaratif (promesse de don). Aucun PSP, aucune trace de décision sur le sujet. ⚠ à confirmer avec le commanditaire |
| **Versionnement** | 84 commits, **0 tag**, aucune release, pour un projet déjà en production |

---

## Dette hors périmètre de la passe du 2026-07-27

| Item | Décision |
|---|---|
| `D:\Menora\artifacts\building-svg-poc\` (2,9 Mo) | POC de vectorisation clos, sans suite. Hors dépôt. **Laissé en place** — à supprimer quand le sujet sera définitivement abandonné |
| `D:\Menora\.tools\vtracer-0.6.15\` (13,1 Mo, 873 fichiers) | venv Python jetable du même POC. Hors dépôt. **Laissé en place** |
| `D:\Menora\WhatsApp Image 2026-07-19...jpeg` | Doublon binaire exact de `artifacts/building-svg-poc/source.jpeg`. **Laissé en place** |
| Branche `feat/admin-navy-or` | Poussée le 2026-07-27. **Ni mergée dans `master`, ni déployée** — c'est volontaire, la décision de merge appartient au commanditaire |
| `.claude/settings.local.json` | Dé-versionné le 2026-07-27 (il fuitait `C:\Users\Mickael\...`). Ajouté au `.gitignore` |
