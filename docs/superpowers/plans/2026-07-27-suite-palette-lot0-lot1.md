# Suite : palette navy/or, résidus LOT 0, fondation multi-événements

## PROTOCOLE DE REPRISE

Si cette session est interrompue, reprendre ainsi :

1. Lire ce fichier en entier, puis « État courant » ci-dessous.
2. `git -C D:/Menora/menorah log --oneline -20` et `git status --short` : la vérité est dans git,
   pas dans ce fichier. Une case cochée sans SHA au Journal est une case à ne pas croire.
3. Ne recocher aucune case. Ne jamais écrire un SHA qui ne sort pas de `git log`.
4. Le gate de chaque commit : `cd backend && npm test` (16 tests) **et**
   `cd frontend && npx vue-tsc --noEmit` **et** `cd frontend && npm run build`.
   Le commit ne part que sur un gate vert, et **jamais dans le même appel shell que le gate**
   sauf chaîné par `&&`.
5. Serveurs de développement : backend `cd backend && npm run dev` (port 3000),
   frontend `cd frontend && npm run dev` (port 5173). Session playwright : `PLAYWRIGHT_CLI_SESSION=menora`.

## État courant

**Prochaine action** : (à renseigner à chaque étape)

## Contexte figé

- **Base** : branche `feat/admin-navy-or`, commit de départ `7f6cc45`
  (« feat(admin): coquille navy + or, palette validee par calcul »).
  `master` est à `aee6042`, suivi par `origin/master`.
- **Le push ne déploie rien.** Le service Railway `web` n'a aucune source GitHub : `git push`
  ne déclenche jamais de déploiement. La production se déploie explicitement via la CLI Railway.
  Conséquence : pousser est sans risque, mais ne vaut pas livraison.
- **Palette figée et prouvée par le calcul** : `frontend/src/assets/styles/global.css` l.86-137.
  Les ratios y sont consignés en commentaire. Toute valeur nouvelle exige un ratio **calculé**
  (`node <scratchpad>/contrast.js "#FG" --on "#BG"`), jamais estimé. Seuils : 4,5 texte / 3,0 objet.
- **Les champs de saisie restent clairs** (`--field-*`). Décision délibérée : taper longtemps dans
  un champ sombre fatigue, et un champ clair sur carte sombre s'identifie par sa surface (15,28).
- **Une couleur qui décrit l'écran public est une donnée, pas une peau.** Vignettes de thème,
  pastilles de palette, aperçus d'animation : intouchables. Les convertir ferait mentir l'aperçu.
- **Pas de framework de migration.** Le dépôt migre par `CREATE TABLE IF NOT EXISTS` +
  `ALTER TABLE` dans un `try/catch` (`backend/src/db/init.ts`). On suit cet idiome (KISS,
  constitution du projet), on n'introduit pas Knex ni Prisma.
- **`sql.js` réécrit le fichier entier à chaque écriture.** Documenté comme dette, hors périmètre.
- **Un dump précède toute migration de données** (`backup.service.ts` fournit le mécanisme, et un
  dump de démarrage est déjà pris automatiquement).
- **Décision de portée sur `GET /api/donations`** (voir tranche 6) : la route reste publique en
  projection dépouillée. Le critère §3.5 de la spec, écrit avant vérification, supposait que
  `/display` n'en dépendait pas — c'est faux : cinq écrans publics l'appellent. Les noms des
  donateurs sont par nature publics dans ce produit (ils s'affichent sur les plaques) ; l'email,
  le téléphone et la référence ne le sont pas et sont déjà fermés.

## Tranche 1 à 5 — Palette navy/or sur les cinq panneaux de contenu

Un fichier = un commit = une relecture. Les cinq fichiers sont à styles `scoped` et disjoints.

- [ ] 1. `ConfigPanel.vue` — 32 déclarations, 100 % hex bruts, aucun aperçu public
- [ ] 2. `DonationList.vue` — 35 déclarations ; avatar par teinte de donateur préservé
- [ ] 3. `GifManager.vue` — 42 déclarations ; l'aplat or plein va à « Déclencher », pas à « Importer »
- [ ] 4. `DonationForm.vue` — 100 déclarations ; deux signaux à ne pas perdre (premium, édition)
- [ ] 5. `DisplaySettingsPanel.vue` — 134 déclarations de peau, 31 d'aperçu à épargner, + bug latent
      du badge « Actif » (`color-mix` sur `--preview-primary` inexistant hors carte de thème)

## Tranche 6 — Acter la décision sur `GET /api/donations` dans la spec

- [x] 6. Corriger §3.1, §3.5 et §6 de `specs/2026-07-26-fondation-multi-evenements-design.md` :
      la projection publique est la décision, pas un manque. Corriger aussi la référence de ligne
      erronée du §3.2 (le point 2 visait `.curve-point-glow`, pas `.curve-area`).

## Tranche 7 à 9 — Résidus LOT 0 (vérifiés non faits, reproduits au navigateur)

- [ ] 7. Typographie et hébreu : retirer Cinzel et Cormorant Garamond (chargées, jamais
      référencées) ; remplacer l'`@import` bloquant de `global.css:2` par un `<link>` ;
      **charger Heebo** et déclarer `--font-he` (l'hébreu tombe aujourd'hui en repli système) ;
      neutraliser `letter-spacing` sur `[dir="rtl"]` et `:lang(he)` (5,76 px mesurés).
- [ ] 8. Défilement des plaques : `scrollTop` sature à `scrollHeight - clientHeight` (12 px
      mesurés), la rotation ne s'exécute jamais et la première plaque reste coupée de 4 px en
      permanence. Piloter un `translateY()` et ne défiler que si le contenu dépasse.
- [ ] 9. Lisibilité de la courbe d'objectif et grille de presets : `preserveAspectRatio="none"`
      écrase un viewBox 640×88 sur 1088×54 (2,8× d'écrasement vertical) ; l'aplat à
      `stop-opacity 0.28` est invisible. Et `.preset-grid` en `auto-fit minmax(90px, 1fr)` dans
      560 px produit mécaniquement un orphelin dès 6 montants.

## Tranche 10 à 15 — LOT 1, fondation multi-événements

- [ ] 10. Schéma et migration idempotente : `events`, `event_configs`, `media`, `themes`,
      `donations.event_id` + index `(event_id, created_at)`. Création de la soirée 1
      `orot-netanel`, rattachement des dons existants, recopie de `config(id=1)`. Dump avant.
- [ ] 11. `config.service` et `donation.service` prennent `eventId` en paramètre partout.
- [ ] 12. Isolation temps réel : chaque `emit` devient `io.to('event:' + eventId).emit(...)`,
      `eventId` en **premier paramètre obligatoire** pour que l'oubli soit une erreur de
      compilation et non une fuite silencieuse.
- [ ] 13. Authentification à deux niveaux : `ORGANIZER_TOKEN` global + code de soirée **haché**
      en base ; `requireEventAdmin(eventId)` accepte l'un ou l'autre. Test obligatoire : le code
      de la soirée A renvoie 403 sur les ressources de la soirée B.
- [ ] 14. Routes `/api/events/:eventId/...`, anciennes routes conservées et résolues sur la
      soirée active. Les QR codes déjà distribués vers `/don` doivent continuer de fonctionner.
- [ ] 15. Front : routes `/e/:slug/{admin,display,don}`, `/admin` devient sélecteur de soirée,
      `/display` et `/don` redirigent vers la soirée active. `window.prompt()` remplacé par un
      véritable écran de connexion avec message d'erreur explicite.

## Tranche 16 — Vérification navigateur, deux soirées simultanées

- [ ] 16. Deux soirées, deux onglets `/e/:slug/display` ouverts en même temps : un don saisi sur
      A ne produit **aucune** animation sur B. Les anciennes URL répondent. Les dons existants
      sont intacts et rattachés à `orot-netanel`. Captures dans `docs/verif/`.

## Journal

- `c01cd5b` — tranche 6. Spec corrigée : la projection publique de `GET /api/donations` est la
  décision (5 écrans publics en dépendent, vérifié), le risque §6 est marqué réalisé, la
  référence de ligne du §3.2 est corrigée. Plan et captures « avant » ajoutés. Aucun code touché.
