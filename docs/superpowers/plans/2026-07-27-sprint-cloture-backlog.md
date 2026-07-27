# Sprint : clôture du backlog `docs/reste-a-faire.md` (familles A, B, C, E)

## PROTOCOLE DE REPRISE

Si cette session est interrompue, reprendre ainsi :

1. Lire ce fichier en entier, puis « État courant » ci-dessous.
2. `git -C D:/Menora/menorah log --oneline -20`, `git branch -a` et `git worktree list` :
   la vérité est dans git, pas dans ce fichier. Une case cochée sans SHA au Journal est
   une case à ne pas croire.
3. Ne recocher aucune case. Ne jamais écrire un SHA qui ne sort pas de `git log`.
4. Gate de chaque commit : `cd backend && npm test` (**depuis `backend/`**, 63 tests au départ)
   **et** `cd frontend && npm run typecheck` **et** `cd frontend && npm run build`.
   Commit jamais dans le même appel shell que le gate sauf chaîné par `&&`. Jamais de pipe
   dans une chaîne `&&` (le pipe avale le code de sortie).
5. Les fronts parallèles travaillent dans des worktrees manuels `D:/Menora/wt-*`, branches
   `sprint/*`, base explicite = master au SHA noté au Journal. L'orchestrateur fusionne en
   ordre d'ARRIVÉE et rejoue le gate complet après CHAQUE merge.

## État courant

**Prochaine action** : vague 2 — fronts FE (B3), TH (C1), DD (C3/C4) sur worktrees recyclés,
base master `457d19c`. Couture FE/DD arbitrée : FE rend les composables event-aware en
RÉTRO-COMPATIBLE (défaut = soirée active, paramètre optionnel) ; DD refactorise contre l'API
ACTUELLE des composables ; le câblage slug→display unifié est une retouche post-merge
(orchestrateur ou FE). `router.ts` appartient à FE seul ; DD passe par l'orchestrateur.

## Contexte figé

- **Base** : `master` à `787cca8` (fast-forward de `chore/doc-unique` fait ce jour, gate vert
  63/63 + typecheck avant toute tranche).
- **Le push ne déploie rien** — service Railway `web` sans source GitHub. `railway up` est
  l'acte de livraison, exécuté UNE fois en fin de sprint (tranche L1), après la passe navigateur.
- **Référence unique API multi-événements** :
  `docs/superpowers/plans/2026-07-27-contrat-api-multi-evenements.md` (figé). Addition, jamais
  substitution : les routes héritées restent et résolvent sur la soirée active.
- **Les 3 tests tueurs de mutations (A3/A4) sont déjà spécifiés** dans
  `2026-07-27-suite-palette-lot0-lot1.md` § « Mutations survivantes à tuer » — les implémenter
  tels quels.
- **Correctif A1 (fuite socket) déjà arbitré** dans le même plan § « PRIORITÉ HAUTE » :
  émettre la projection publique (`toPublicDonation`) sur la room ; l'admin recharge par sa
  route authentifiée `?full=1` dans le handler qui fait déjà un aller-retour
  (`AdminPanel.vue:105-108`). Pas de room admin séparée à ce stade.
- **Migrations** : idiome du dépôt uniquement (`CREATE TABLE IF NOT EXISTS` + `ALTER` en
  try/catch, `backend/src/db/migrations.ts`). Pas de Knex/Prisma. Dump pré-migration déjà
  en place (`index.ts`, AVANT `initDatabase()`).
- **Hachage code de soirée** : `crypto.scryptSync`, format `scrypt$N$r$p$sel$empreinte`,
  `timingSafeEqual`. Aucune dépendance ajoutée.
- **CORS (C8)** : une seule variable `CORS_ORIGIN` (liste séparée par virgules) consommée par
  HTTP (`app.ts`) ET socket (`socket.service.ts`). Défaut = comportement actuel (pas de
  régression d'écran en prod).
- **Aucun contenu éditorial inventé** (décision commanditaire 2026-07-21). E2 (sous-titre
  fondateurs) est EXCLU du sprint : contenu inconnu. D1/D2 et famille F : décisions
  commanditaire, hors sprint, journalisées au récap.
- **Fichiers chauds inter-fronts** : `frontend/src/router.ts` appartient au front FE en
  vague 2 ; le front DD demande ses retouches de routes à l'orchestrateur. `app.ts` et
  `routes/*` appartiennent au front EB en vague 1 ; le front S n'y touche pas (la retouche
  C9 côté route — 1 ligne — est portée par EB sur spéc de S).
- **Doc et code dans le même commit** : chaque front met à jour la doc vivante touchée
  (`docs/api-et-socket.md`, `docs/architecture.md`, …) et la date de `docs/README.md`.

## Vague 1 — 3 fronts parallèles en worktrees

### Front S — sécurité (worktree `wt-securite`, branche `sprint/securite`)
Périmètre : `backend/src/services/socket.service.ts`, `backend/src/models/donation.ts`,
`backend/tests/**` (nouveaux fichiers ou fichiers sécurité existants),
`frontend/src/composables/useDonations.ts`, `frontend/src/pages/AdminPanel.vue`.
INTERDITS : `app.ts`, `routes/*`, `middleware/*` (front EB).

- [x] S1. A1 — la fuite PII socket est fermée (projection publique dans les émissions) ;
      A5 — un test socket le prouve (aucun email/téléphone/référence dans le payload reçu).
- [x] S2. A3+A4 — les 3 tests tueurs de mutations, tels que spécifiés.
- [x] S3. C9 — `validateUpdateRequest` sans `currentAmount` ne remet plus le mot sacré/montant
      à zéro (côté modèle ; la ligne d'appel `routes/donations.ts:158` est pour EB) ;
      C8 partie socket — CORS du socket lit `CORS_ORIGIN`.

### Front EB — multi-événements backend (worktree `wt-events`, branche `sprint/events`)
Périmètre : `backend/src/routes/**`, `backend/src/middleware/**`,
`backend/src/services/event.service.ts`, `backend/src/app.ts`, nouveaux services/modèles
événements, `backend/tests/**` (fichiers events/routes), `backend/src/db/migrations.ts`
(si nécessaire pour `media`). INTERDITS : `socket.service.ts`, `models/donation.ts`
(front S), `db/init.ts` (front CC).

- [x] E1. B2 — auth deux niveaux selon le contrat : `ORGANIZER_TOKEN` + alias `ADMIN_TOKEN`
      + code de soirée haché (`admin_code_hash`), 401 vs 403 testés (code de A sur ressource
      de B → 403).
- [x] E2. B1 — routes `/api/events` et `/api/events/:eventId/...` du contrat, formes de
      réponse identiques aux héritées ; `:eventId` inconnu → 404 (fin du 400 interne) ;
      `multipleActive` consommé (avertissement explicite) ; ordre des middlewares corrigé
      (le 503 ne masque plus le 401 sur l'export CSV) ; ligne C9 côté route appliquée.
- [x] E3. B4 — médias cloisonnés par soirée (table `media` enfin lue/écrite, `GET gifs`
      scopé) ; C10 — frontière de chemin réelle (`path.relative`, plus de préfixe de
      chaîne) ; B6 — rate-limit keyé IP+soirée ; C8 partie HTTP — `app.ts` lit `CORS_ORIGIN`.

### Front CC — nettoyage (worktree `wt-clean`, branche `sprint/nettoyage`)
Périmètre : `frontend/src/pages/MenorahAscension.vue`, `frontend/src/components/**` morts,
`frontend/src/composables/useSoundEffects.ts`, `frontend/package.json`,
`backend/src/db/init.ts` (bloc table `config` UNIQUEMENT), `railway.json`, `nixpacks.toml`,
`frontend/src/router.ts` (retrait de routes mortes UNIQUEMENT — le préfixe `/e/` arrive en
vague 2). INTERDITS : tout le reste.

- [x] N1. C5 — ~1 900 lignes mortes supprimées (MenorahAscension 1062, ProgressBar 286,
      TotalCounter 262, useSoundEffects 304 par transitivité, devDep `postcss`), chaque
      suppression re-prouvée par grep 0-importeur AVANT suppression.
- [x] N2. C6 — la table `config` n'est plus recréée à chaque démarrage (lecture de bascule
      conservée si la migration la lit encore — décision sur preuve) ; C7 — chaîne de build
      dédupliquée entre `railway.json` et `nixpacks.toml`.

## Vague 2 — 3 fronts parallèles (après merges vague 1, worktrees recréés sur master à jour)

### Front FE — frontend multi-soirées (worktree `wt-front`, branche `sprint/front-events`)
Périmètre : `frontend/src/router.ts`, `frontend/src/pages/**` (hors Display*),
`frontend/src/composables/**`, nouveaux composants de connexion/sélecteur.

- [ ] F1. B3 — routes `/e/:slug/{admin,display,don,display-light,display-hidden}` ; les six
      URL héritées redirigent/résolvent sur la soirée active ; `window.prompt` remplacé par
      un écran de connexion (erreur explicite, soirée nommée) ; `/admin` organisateur =
      sélecteur de soirée ; le socket `join` la room de la soirée résolue.

### Front TH — moteur de thèmes (worktree `wt-themes`, branche `sprint/themes`)
Périmètre : nouveaux fichiers backend thèmes (routes/service), table `themes`,
`frontend/src/theme/**`, `frontend/src/components/admin/DisplaySettingsPanel.vue`,
`frontend/src/assets/styles/` (tokens). INTERDITS : `AdminPanel.vue` (FE), Display* (DD).

- [ ] T1. C1 — thèmes en base (CRUD organisateur), application par soirée, aperçu avant
      application, export/import JSON, **contraste AA calculé et refusé sous seuil**
      (4,5 texte / 3,0 objet). C2 : constater l'existant (5 sous-onglets déjà livrés) et ne
      combler que le manque réel.

### Front DD — display unifié (worktree `wt-display`, branche `sprint/display`)
Périmètre : `frontend/src/pages/DisplayPage.vue`, `DisplayPage8.vue`, `DisplayHiddenPage.vue`,
`frontend/src/components/display/**`. Les retouches `router.ts` passent par l'orchestrateur.

- [ ] D1. C3 — les 3 forks (2 360 lignes) fusionnent en un composant + adaptateurs de
      variante, divergences inventoriées AVANT fusion et re-vérifiées variante par variante
      au navigateur ; C4 — animations centralisées (`@formkit/auto-animate` seulement si le
      gain est net, sinon composable maison — YAGNI).

## Vague 3 — vérification (orchestrateur)

- [ ] V1. B5 — deux soirées actives, deux CONTEXTES navigateur distincts (pas deux onglets) :
      un don sur A n'anime jamais B ; les six URL héritées répondent ; dons existants intacts
      sur `orot-netanel`. Passe navigateur complète (admin, /don, displays, RTL, 390px+1440px),
      captures `docs/verif/sprint-2026-07-27/` (vérifier `git check-ignore` sur le nouveau
      sous-dossier — piège du `!docs/verif/*.png` à une étoile).
- [ ] V2. Corrections issues de la passe, commit dédié.

## Livraison

- [ ] L1. A2 — rotation `ADMIN_TOKEN` (nouvelle valeur via `railway variables --set`, mise à
      jour `~/.menorah-admin-token.txt`) ; `railway up` ; vérification prod (health, /admin,
      /don, socket).
- [x] L2. FAIT PAR ANTICIPATION le 2026-07-27 (indépendant du code ; la migration reprendra
      ces données au déploiement). Constat contre la prod RÉELLE : **E1, E2 et E3 étaient
      déjà faits par l'admin lui-même** (kicker HE ≠ « קמפיין תרומות », sous-titre HE rempli,
      presets = [2000, 3000, 4000, 5280, 7200, 10800] ₪ sans trace de 1008000) — les
      souvenirs du 2026-07-26 étaient périmés. E4 exécuté : `DELETE /api/donations/88`
      (« TEST », 1 ₪) avec le jeton actuel, vérifié absent après coup, 30 dons restants,
      stats recalculées serveur.
- [ ] L3. `docs/reste-a-faire.md` réécrit sur l'état réel, date `docs/README.md`, push
      `master`, récap final.

## Journal

- `39a1c6b` — N1 (front CC). 1 914 lignes mortes supprimées (MenorahAscension 1062,
  ProgressBar 286, TotalCounter 262, useSoundEffects 304 par transitivité), chaque retrait
  re-prouvé par code de sortie de grep seul ; devDep `postcss` retirée. Aucune route morte
  dans `router.ts` (MenorahAscension n'y figurait pas).
- `db98e74` — N2 partiel (front CC) : C7 fait — `buildCommand` retiré de `railway.json`,
  `nixpacks.toml [phases.build]` devient l'unique source de vérité ; `startCommand` reste
  volontairement doublé (non divergent, à purger côté nixpacks après un `railway up` vérifié).
  **C6 LAISSÉ sur preuve** : la migration tolère l'absence de `config` (3 lectures gardées par
  `tableExists`), mais `legacy-routes.test.ts:104` fait un `SELECT ... FROM config` sur base
  neuve — fichier hors périmètre CC (propriété EB). Devient la tranche orchestrateur O1
  post-merge EB : retirer `init.ts:73-93` (CREATE+INSERT) en CONSERVANT l'ALTER
  `display_settings` sous try/catch, et adapter le test.
- `4c70aea` — merge `sprint/nettoyage` dans master. Gate rejoué sur master après merge :
  63/63 backend, typecheck et build frontend verts.
- `650d1f8` — S1 (front S). Fuite PII socket fermée : `toPublicDonation` dans les émissions,
  l'admin recharge par `?full=1`. Test `socket-pii.test.ts` écrit ROUGE d'abord, VERT après.
- `937994e` — S2. Les 3 tests tueurs de mutations (`mutations-survivantes.test.ts`),
  état partagé restauré en `finally`.
- `dbc8905` — S3. **Finding C9 requalifié par la mesure** : le mot sacré n'était PAS effacé
  (le service ignore une clé `undefined`) ; le défaut réel était un changement de mot
  silencieusement IGNORÉ quand `amount` est absent. Garde-fou modèle appliqué (sans
  régression) + test. CORS socket lit `CORS_ORIGIN` (défaut = comportement actuel), 5 cas testés.
- `1949fb1` — merge `sprint/securite` dans master. Gate rejoué : 76/76 backend
  (63 + 13 nouveaux), typecheck et build frontend verts.
- `59daa25` / `95c5d6f` / `d616ae9` — E1/E2/E3 (front EB). Auth deux niveaux (scrypt,
  timingSafeEqual, alias ADMIN_TOKEN conservé), routes du contrat en fabriques montées deux
  fois (hérité + préfixé, formes identiques), 404 sec, `multipleActive` consommé
  (`X-Multiple-Active-Events`), 401 avant 503 sur l'export CSV, médias cloisonnés via table
  `media` + migration d'inventaire, frontière de chemin réelle, rate-limit IP+soirée,
  CORS HTTP sur `CORS_ORIGIN`. Trois arbitrages EB VALIDÉS : fail-closed prod sur les seuls
  jetons d'env ; 401 avant 404 sur route admin à soirée inconnue sans jeton (ne pas révéler
  l'existence) ; gifs préfixés séquencés en E3 avec l'isolation.
  Restes assumés : rate-limit mémoire mono-instance + `x-forwarded-for` non validé (finding I),
  `backup.db` toutes-soirées (finding L).
- `f6f9572` — merge `sprint/events` dans master. Seul conflit : `docs/api-et-socket.md`
  (S et EB), résolu en fusionnant réfutation mesurée de C + corrections E2/E3. Gate rejoué :
  130/130 backend (23 fichiers), typecheck et build frontend verts — aucune couture cassée.
- `457d19c` — O1 (orchestrateur). C6 : la table `config` n'est plus créée ni semée au
  démarrage ; ALTER `display_settings` conservé sous try/catch ; `legacy-routes.test.ts`
  prouve « ni créée ni écrite » sur base neuve comme ancienne ; `config-handover.test.ts`
  fabrique désormais lui-même la base ancienne qu'il simule. Découverte de séquence : le
  gate a rougi PARCE QUE la table manquait au test de couture — exactement le filet attendu.
