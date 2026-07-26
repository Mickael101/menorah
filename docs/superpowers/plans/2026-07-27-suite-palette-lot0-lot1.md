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
- **Un dump précède toute migration de données — et cette ligne a d'abord été FAUSSE.**
  Elle disait « un dump de démarrage est déjà pris automatiquement », ce qui était vrai à la
  lettre et trompeur en pratique : l'instantané `startup` s'exécutait **après** `initDatabase()`,
  donc après la migration. C'est cette phrase, tenue pour acquise, qui explique que personne
  n'ait ajouté de dump explicite — l'exigence était écrite à trois endroits et honorée à zéro.
  Depuis `b786a87`, `index.ts` prend un instantané `pre-migration` **avant** `initDatabase()`.
  Vérification, à faire à chaque migration future : démarrer sur une base à l'ancien schéma et
  **inspecter les tables du fichier de sauvegarde produit**, pas seulement son existence.
- **Décision de portée sur `GET /api/donations`** (voir tranche 6) : la route reste publique en
  projection dépouillée. Le critère §3.5 de la spec, écrit avant vérification, supposait que
  `/display` n'en dépendait pas — c'est faux : cinq écrans publics l'appellent. Les noms des
  donateurs sont par nature publics dans ce produit (ils s'affichent sur les plaques) ; l'email,
  le téléphone et la référence ne le sont pas et sont déjà fermés.

## Tranche 1 à 5 — Palette navy/or sur les cinq panneaux de contenu

Un fichier = un commit = une relecture. Les cinq fichiers sont à styles `scoped` et disjoints.

- [x] 1. `ConfigPanel.vue` — 32 déclarations, 100 % hex bruts, aucun aperçu public
- [x] 2. `DonationList.vue` — 35 déclarations ; avatar par teinte de donateur préservé
- [x] 3. `GifManager.vue` — 42 déclarations ; l'aplat or plein va à « Déclencher », pas à « Importer »
- [x] 4. `DonationForm.vue` — 100 déclarations ; deux signaux à ne pas perdre (premium, édition)
- [x] 5. `DisplaySettingsPanel.vue` — 134 déclarations de peau, 31 d'aperçu à épargner, + bug latent
      du badge « Actif » (`color-mix` sur `--preview-primary` inexistant hors carte de thème)

### Ce que la relecture a appris, et qui vaut au-delà de cette tranche

**Un fond translucide de survol ne s'ajoute pas au fond du repos : il le REMPLACE et se
compose sur le PARENT.** Tous les ratios de survol du lot étaient donc calculés sur la mauvaise
base, et deux survols étaient devenus invisibles (1.01 et 1.06 d'écart). Un survol posé sur un
repos opaque doit être figé en opaque, ou mesuré contre le vrai parent.

**Une bordure `rgba` se compose sur le background de SON PROPRE élément**, peint sous elle par
`background-clip: border-box` — jamais sur celui du parent, sauf si ce background est transparent.

**Un ratio faux dans un commentaire est pire que pas de ratio** : il autorise une modification
future qui casse le seuil en croyant avoir de la marge. Quatre ont été corrigés, dont le pire
des quatre fonds sombres pour `--shell-text-muted`, qui est 4.53 sur `--shell-raised` et non 4.93.

## Tranche 6 — Acter la décision sur `GET /api/donations` dans la spec

- [x] 6. Corriger §3.1, §3.5 et §6 de `specs/2026-07-26-fondation-multi-evenements-design.md` :
      la projection publique est la décision, pas un manque. Corriger aussi la référence de ligne
      erronée du §3.2 (le point 2 visait `.curve-point-glow`, pas `.curve-area`).

## Tranche 7 à 9 — Résidus LOT 0 (vérifiés non faits, reproduits au navigateur)

- [x] 7. Typographie et hébreu : retirer Cinzel et Cormorant Garamond (chargées, jamais
      référencées) ; remplacer l'`@import` bloquant de `global.css:2` par un `<link>` ;
      **charger Heebo** et déclarer `--font-he` (l'hébreu tombe aujourd'hui en repli système) ;
      neutraliser `letter-spacing` sur `[dir="rtl"]` et `:lang(he)` (5,76 px mesurés).
- [x] 8. Défilement des plaques : `scrollTop` sature à `scrollHeight - clientHeight` (12 px
      mesurés), la rotation ne s'exécute jamais et la première plaque reste coupée de 4 px en
      permanence. Piloter un `translateY()` et ne défiler que si le contenu dépasse.
### Arbitrage rendu sur la courbe d'objectif (tranche 9)

La relecture a prouvé, par échantillonnage de pixels sur le thème **réellement actif**, que
supprimer l'écrasement anisotrope ne corrige pas le symptôme : à l'avancement réel de 23,7 %, la
flèche de la courbe passe de 1,81 px à 2,23 px pour une corde de 285 px. La cause n'est pas
l'anisotropie mais le rapport de boîte, d'environ 19:1.

**Décision : on ne truque pas la courbure.** Ouvrir l'amplitude des points de contrôle rendrait
un mensonge plus lisible — la donnée est une valeur unique, pas une série temporelle, et la spec
a déjà tranché que la forme juste est une barre remplie. La tranche corrige donc ce qui est
réellement corrigible (ancrage du dégradé, marqueur, transitions, robustesse de la mesure) et
**ne prétend pas** que la courbure est devenue lisible. Le remplacement par une barre reste
nécessaire, et cette tranche ne le remplace pas.

- [x] 9. Lisibilité de la courbe d'objectif et grille de presets : `preserveAspectRatio="none"`
      écrase un viewBox 640×88 sur 1088×54 (2,8× d'écrasement vertical) ; l'aplat à
      `stop-opacity 0.28` est invisible. Et `.preset-grid` en `auto-fit minmax(90px, 1fr)` dans
      560 px produit mécaniquement un orphelin dès 6 montants.

## Tranche 10 à 15 — LOT 1, fondation multi-événements

- [x] 10. Schéma et migration idempotente : `events`, `event_configs`, `media`, `themes`,
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

### Divergences avec la spec, assumées — à ne pas perdre

- **§4.2 point 5, « rattacher tous les médias existants » : non fait.** Les GIF, sons et SVG sont
  stockés à plat sur le disque et ne sont pas encore inventoriés en base. La table `media` existe,
  elle est vide. Le rattachement appartient à la tranche qui portera les routes de médias.
- **§4.1, `donations.event_id NOT NULL REFERENCES events(id)` : la colonne est nullable et sans
  contrainte.** SQLite refuse `ADD COLUMN NOT NULL` sans défaut et ne sait pas ajouter une clé
  étrangère à une table existante ; les deux exigeraient de recréer la table et d'y recopier des
  dons réels. L'intégrité est tenue par le rattachement des orphelins, qui traite les deux cas :
  `NULL` et référence pendante.
- **§4.1, `status` ∈ `draft|active|archived` : aucun `CHECK`.** À ajouter le jour où une route
  écrit ce champ — aujourd'hui aucune ne le fait.
- **§4.2 point 6, « conserver `config` en lecture seule » : pas encore vrai.** `config` reste la
  table écrite jusqu'à la bascule des écritures vers `event_configs`. C'est précisément ce qui
  justifie le rafraîchissement conditionnel introduit en `b786a87`.

### PRIORITÉ HAUTE, découverte le 2026-07-27 — fuite de données donateurs par le socket

Le LOT 0a a fermé la fuite d'email, de téléphone et de référence **côté HTTP**. Elle reste
ouverte **côté temps réel** : `emitDonationNew` et `emitDonationUpdated` transportent l'objet
`Donation` complet, et **cinq pages publiques** écoutent `donation:new`. N'importe qui ouvrant
l'écran public reçoit donc en direct les coordonnées de chaque donateur.

Vérifié directement, pas sur rapport : `emitDonationNew` passe l'objet `donation` entier, et
`grep -rl "donation:new" frontend/src/` renvoie **six fichiers d'affichage public** en plus de
l'administration (`DisplayPage`, `DisplayPage8`, `DisplayHiddenPage`, `MenorahAscension`,
`MenorahDisplay`, `DonorPlatesGrid`).

Pré-existant, non introduit par le chantier en cours, mais de la même nature exactement que ce
que le LOT 0a existait pour corriger.

**Ce qui rend le correctif bon marché**, également vérifié : l'administration insère le payload
du socket **directement** dans sa liste (`handleDonationNew`, `useDonations.ts:484-490`) — mais
son handler effectue *déjà* un appel asynchrone juste après (`fetchPremiumWords()`,
`AdminPanel.vue:105-108`). Émettre la projection publique sur la room et faire recharger
l'administration par sa route authentifiée `?full=1` tient donc en quelques lignes, dans un
handler qui fait déjà un aller-retour. La seule dégradation est que les coordonnées d'un don
tout juste arrivé apparaissent au rechargement plutôt qu'à l'instant même.

L'alternative — deux payloads, public sur `event:<id>` et complet sur une room
d'administration — est plus propre mais suppose l'authentification de la tranche 13, donc
elle reporte la fermeture de la fuite. Ce n'est pas le bon arbitrage pour une fuite de
données personnelles déjà en production.

### Bloquant identifié sur les tranches 11-12 — le direct serait coupé

Les cinq émissions passent désormais par `io.to('event:<id>')`, mais **aucun code frontend
n'appelle `join`** et la connexion ne fait aucun abonnement d'office. Les écrans déjà déployés
resteraient muets : les dons cesseraient d'apparaître en direct, sans qu'aucun test ni aucune
compilation ne bronche. Backend et frontend doivent donc entrer dans le même commit, ou la
connexion doit abonner d'office à la soirée active — la règle que suivent déjà `/display` et
`/don` sans slug. Dans ce second cas, une jonction explicite ultérieure doit QUITTER la room par
défaut, sinon un client reçoit deux soirées et l'isolation tombe.

## Tranche 16 — Vérification navigateur, deux soirées simultanées

- [ ] 16. Deux soirées, deux onglets `/e/:slug/display` ouverts en même temps : un don saisi sur
      A ne produit **aucune** animation sur B. Les anciennes URL répondent. Les dons existants
      sont intacts et rattachés à `orot-netanel`. Captures dans `docs/verif/`.

## Journal

- `8b05ca5` — tranche 1. `ConfigPanel` en navy/or. Quatre valeurs réfutées par le calcul ; deux
  défauts corrigés au passage (tableau des segments héritant d'une couleur claire de `body` ;
  boutons désactivés perdant tout bord à chaque sauvegarde).
- `71420ba` — tranche 2. `DonationList`. Hiérarchie de l'or (montant en aplat, compteur en voile)
  et survol destructif en remplissage plein — un voile rouge ne donnait que 1.05 d'écart.
- `4c2e6e4` — tranche 3. `GifManager`. L'aplat or va à « Déclencher » ; l'état « en diffusion »
  ne s'éteint plus ; damier clair pour les aperçus de fichier client.
- `e639c90` — tranche 4. `DonationForm`. Deux signaux préservés (premium, édition) ; focus des
  champs rendu percevable ; un défaut pré-existant du sélecteur de mot sacré corrigé.
- `d84adf5` — tranche 5. `DisplaySettingsPanel`. 31 aperçus épargnés, plaque de vérification du
  SVG remise en clair (le thème public actif est *clair*), bug latent du badge « Actif » corrigé.
- `1fb1d83` — tranche 8. Le mur des donateurs ne coupe plus aucune plaque. `translateY()` au lieu
  de `scrollTop` (borné par construction), plus une navette pour la bande où le contenu dépasse
  de moins d'une rangée — sans elle, le rognage se déplaçait simplement de la première plaque
  vers la dernière. Quatre défauts de cycle de vie corrigés au passage.
- `ee524eb` — tranche 7. L'hébreu est rendu en Heebo. La relecture a réfuté la première version :
  `[dir='rtl']` ne matche pas `dir="auto"`, la valeur livrée — la règle ne s'appliquait donc
  jamais. Corrigé par les **piles de polices** (repli glyphe par glyphe), et le `letter-spacing`
  traité à la source avec `:dir(rtl)`. Mesuré en configuration par défaut : 2 faces Heebo
  réellement peintes, contre 0 avant.
- `4628410` — tranche 9. Courbe d'objectif honnête : l'écrasement 2,8× est supprimé, mais le
  commit **ne prétend pas** que la courbure est lisible — flèche mesurée sur toute la plage, la
  cause est un rapport de boîte de 19:1. **Ma consigne d'ancrer le dégradé sur la boîte était
  fausse** : mesurée au pixel avec témoin exact, elle pâlissait l'aplat (1,46:1 → 1,18:1),
  revenue en arrière. Élastique au redimensionnement supprimé, mouvement réduit couvert,
  robustesse de la mesure doublée. Grilles de montants : plus aucun orphelin, des deux côtés.
- `4828ae3` — correction de `b786a87` : **les clés étrangères n'étaient actives que pendant la
  migration**. `db.export()` remet `foreign_keys` à 0, et la première sauvegarde a lieu dès la fin
  de l'initialisation. Reproduit, corrigé, vérifié.
- `169aa61` — correction du plan lui-même : sa section « Contexte figé » déclarait satisfaite
  l'exigence de dump pré-migration, ce qui est précisément pourquoi personne ne l'avait ajouté.
- `b786a87` — tranche 10 bis, après revue adversariale de `8976f67`. **La sauvegarde
  « pré-déploiement » était prise APRÈS la migration** — le mécanisme existait, il était appelé du
  mauvais côté, et tant qu'il l'était chaque autre défaut devenait irréversible au premier
  démarrage. Corrigé et vérifié au démarrage réel (`pre-migration` puis `startup`).
  La revue a aussi montré que **10 mutations sur 10 survivaient** aux cinq tests, dont une qui
  réassignait tous les dons de toutes les soirées à chaque redémarrage : sept tests ajoutés.
  Trois défauts de données corrigés (rattachement en dur vers l'id 1, résurrection d'une soirée
  supprimée, installation neuve nommée d'après le premier client), la fenêtre de perte de
  configuration fermée, `PRAGMA foreign_keys` activé et écriture disque rendue atomique.
- `8976f67` — tranche 10. Schéma multi-événements et migration idempotente, vérifiée sur la base
  réelle : 5 dons rattachés, somme inchangée, configuration recopiée, API toujours debout.
- `c01cd5b` — tranche 6. Spec corrigée : la projection publique de `GET /api/donations` est la
  décision (5 écrans publics en dépendent, vérifié), le risque §6 est marqué réalisé, la
  référence de ligne du §3.2 est corrigée. Plan et captures « avant » ajoutés. Aucun code touché.
