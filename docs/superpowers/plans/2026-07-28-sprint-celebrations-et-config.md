# Sprint 2026-07-28 — Célébrations par palier, stop temps réel, refonte des onglets admin

## PROTOCOLE DE REPRISE

En cas de reprise (crash, /clear, nouvelle session) :

1. Lire ce fichier EN ENTIER avant d'agir.
2. `git log --oneline -15` + `git status --short` sur la branche
   `feat/celebrations-et-config-2026-07-28` : établir ce qui a réellement atterri.
3. Ne JAMAIS cocher une case sans SHA copié depuis la sortie réelle de `git log`.
4. Reprendre à la première case non cochée, dans l'ordre.
5. « État courant » (en bas) nomme la prochaine action.

## Contexte figé

- **Base** : master `14e3d4f` (fix: retirer la marque « Ohel Yeochoua » des valeurs par défaut).
- **Branche de travail** : `feat/celebrations-et-config-2026-07-28`. Merge dans master en fin
  de sprint après vérification navigateur. **`railway up` N'EST PAS lancé** — la mise en prod
  reste un acte du commanditaire (le déploiement précédent est déjà en attente de son feu vert).
- **Gate par commit** (les 4, chaînés `&&`, jamais `;`, jamais de pipe sur commande faillible) :
  `cd backend && npm test && npm run build` puis `cd frontend && npm run typecheck && npm run build`.
  Rappel : `vite build` ne type-vérifie PAS ; seul `vue-tsc` garde le front. Le build Railway
  (nixpacks) = `vite build` + `tsc` backend.
- Staging par chemins explicites, jamais `git add -A`. Doc et code dans le même commit.
- Un texte affiché ne s'invente pas : tout libellé public vient de la config ou des dictionnaires
  admin existants ; les nouveaux libellés admin sont des clés i18n fr/en/he (parité stricte).
- sql.js : ne pas toucher à l'écriture atomique ni au PRAGMA FK (backend/src/db/init.ts).
- Tests backend depuis `backend/` uniquement (jamais la racine).

## Demande du commanditaire (verbatim condensé)

1. Galerie de GIF : selon un montant défini, déclencher un certain GIF + son.
2. Pouvoir arrêter un son/animation déjà lancé sur l'écran des dons.
3. Galerie son+GIF valable aussi pour la page de don, pas seulement l'affichage principal.
4. Barre de recherche dans la liste des dons.
5. Config de l'affichage principal plus amicale : ce qui concerne l'écran principal et la page
   de don n'est pas au même endroit, on ne voit pas à quoi chaque réglage fait référence.
6. Textes par langue : ne pas afficher toutes les langues à la fois (fold/onglets par langue).
7. L'onglet images/GIF et la section animations (GIF+son) sont redondants → centraliser.

## Décisions de conception (prises en autonomie, à défaut du commanditaire joignable)

- **Modèle** : `displaySettings.celebrations: CelebrationRule[]` avec
  `{ id, minAmount (agorot), gifUrl, playOnDisplay, playOnPledge }`. Une règle par GIF
  (imposé par l'UI). La règle gagnante = plus haut `minAmount <= montant du don`.
  Le SON d'un palier = le son déjà associé au GIF dans la galerie (pas de doublon de donnée),
  à défaut le son par défaut « quand un don arrive ».
- **Résolution côté client** (écran + /don), pas côté serveur : l'écran principal synchronise
  le GIF avec l'animation de plaque et sa file d'attente (un déclenchement serveur arriverait
  pendant la plaque du don PRÉCÉDENT en mode file). L'écran garde un index gifUrl→audioUrl
  rafraîchi au montage, à la reconnexion et à chaque `config:updated`.
- **Une règle dont le GIF n'existe plus dans la galerie est ignorée à l'affichage**
  (auto-guérison : pas besoin de purge serveur).
- **Stop** : `POST /api/gifs/stop` (admin de la soirée) → socket `celebration:stop` → l'écran
  coupe GIF, plaque, file d'attente, flash et audio. L'audio de l'écran devient UNIQUE et
  stoppable (le `new Audio` jeté actuel est inarrêtable et empilable — même défaut que
  corrigé côté admin par useAudioPreview).
- **Page /don** : après soumission réussie, si une règle `playOnPledge` correspond → GIF en
  overlay sur l'écran de remerciement + son (geste utilisateur → autoplay permis). Coupé au
  reset et à l'unmount.
- **Onglets admin par page cible** (réponse au « on ne sait pas à quoi ça correspond ») :
  `Dons · Écran de salle · Page de don · Médias et célébrations · Soirée`.
  DisplaySettingsPanel reste UNE instance (v-show) avec une prop `view` — un seul état, une
  seule barre d'enregistrement, zéro fragment concurrent. Aucun déplacement massif de markup :
  on re-route les `v-show` des sections existantes (technique éprouvée du panneau).
- **Langues en onglets** : l'identité de l'administration (ConfigPanel) passe des 3 fieldsets
  côte à côte au même motif d'onglets de langue que la page de don (déjà en place et validé).
- **Montants saisis en ₪, stockés en agorot** (comme goalAmount).

## Tranches (une case = un commit mergeable, gate vert)

- [x] **S0 — Plan committé** (ce fichier).
- [x] **S1 — Recherche dans la liste des dons.** `DonationList.vue` : champ (nom, référence,
  montant), insensible casse/accents, compteur « filtrés/total », état « aucun résultat »,
  clés i18n fr/en/he.
- [ ] **S2 — Modèle celebrations.** Backend : `types.ts` (interface + défaut), `config.ts`
  (normalisation : tableau ≤ 50, minAmount entier > 0, gifUrl `/uploads/gifs/…`, booléens,
  id régénéré si absent, entrées invalides éliminées), tests dédiés
  (`backend/tests/services/` ou `routes/config`). Frontend : miroir types + défauts dans
  `useDonations.ts`, clonage profond dans `cloneDisplaySettings`, util partagée
  `matchCelebrationRule(amount, rules, scope)`.
- [ ] **S3 — Écran : palier + stop.** Backend : `emitCelebrationStop` + route
  `POST /gifs/stop` (admin) + tests (route + réception socket, isolation par soirée).
  Frontend `DisplayScreen.vue` : index gifs (fetch public au montage/reconnexion/config),
  matching dans `showDonationCelebration` (GIF du palier + son associé sinon son par défaut,
  jamais deux audios superposés), audio unique stoppable, handler `celebration:stop` qui coupe
  tout (GIF, plaque, file, flash, audio).
- [ ] **S4 — /don : célébration par palier.** `DonorPledgePage.vue` : fetch gifs public,
  matching `playOnPledge` à la soumission réussie, overlay GIF + son, nettoyage
  reset/unmount.
- [ ] **S5 — Refonte des onglets admin.** `AdminPanel.vue` : 5 onglets persistés,
  `DisplaySettingsPanel` prop `view` (screen : thème/textes/composition ; pledge : page de
  don ; media : animation + son par défaut + galerie), `ConfigPanel` : identité par onglets
  de langue, renommage i18n des onglets (fr/en/he). Aucune fonctionnalité nouvelle.
- [ ] **S6 — Galerie pilotée par paliers + stop admin.** `GifManager.vue` intégré à la vue
  media : par GIF, champ « déclencher à partir de X ₪ » + portées (écran //don), édition via
  l'état parent (barre d'enregistrement partagée, isDirty), purge de la règle à la
  suppression du GIF, bouton « Arrêter le son et l'animation à l'écran » → POST /gifs/stop.
- [ ] **S7 — Vérification navigateur + docs + merge.** Passe playwright-cli : admin (5
  onglets, seuils, stop), écran (palier déclenché par un vrai don, stop en direct), /don
  (fr + he, mobile 390px + desktop, célébration palier), captures `docs/verif/2026-07-28/`,
  correctifs éventuels, mise à jour `docs/README.md` (carte de fraîcheur), `CLAUDE.md`
  (état), `docs/reste-a-faire.md`, `docs/api-et-socket.md` (nouvel événement + route),
  merge fast-forward ou merge commit dans master. Pas de `railway up`.

## Journal

- S0 `cc451c1` — plan committé.
- S1 `a237ddc` — recherche liste des dons (gate 188 tests + 2 builds + vue-tsc verts).

## État courant

S2 (modèle celebrations) prêt : ce commit le porte. Prochaine action : S3.
