# Archive

Documents **livrés ou remplacés**. Rien n'est jamais supprimé d'ici : chaque dossier est
préfixé par la date du contenu qu'il fige.

Un document ici **ne décrit plus le comportement actuel**. Pour l'état courant, voir
[`../README.md`](../README.md).

| Dossier | Date du contenu | Ce que c'est | Remplacé par |
|---|---|---|---|
| `2025-11-26_specs-master-initiales/` | 2025-11-26 | Les specs d'origine du projet sous le nom **OHEL YEOCHOUA** : `spec.md` (5 user stories), `plan.md`, `tasks.md`, `tasks-menorah-mask.md`, `data-model.md`, `quickstart.md`, `research.md`, et les contrats `contracts/api.yaml` (OpenAPI v1) + `contracts/socket-events.md` | `../architecture.md`, `../api-et-socket.md`, `../donnees-et-migrations.md` |
| `2025-12-05_spec-menorah-display/` | 2025-12-05 | La spec du SVG menorah et de sa découpe en pages d'affichage, plus le guide de personnalisation GSAP | `../architecture.md` ; le design vivant est `../specs/2026-07-26-fondation-multi-evenements-design.md` |
| `2025-12-17_maquette-et-fragments-svg/` | 2025-12-17 | La maquette autonome des plaques donateurs (Cinzel / Cormorant) et trois brouillons de découpe SVG des montants 26000 / 36000 / 72000 | `DonorPlatesGrid.vue` |
| `2026-07-26_lot0a-securite-donateurs/` | 2026-07-26 | Le plan du LOT 0a — fermeture de la fuite PII sur les routes HTTP. **Livré** (les tests `backend/tests/security/` en sont la preuve) | `../reste-a-faire.md` §A pour ce qui reste ouvert |

## Deux pièges de lecture

**`research.md` reste pertinent.** Il justifie les choix Vue 3 / Socket.IO / SQLite, qui sont
toujours ceux du projet. Il est archivé avec le reste de sa spec pour ne pas éparpiller le
lot, mais son raisonnement n'est pas périmé — il est résumé dans `../architecture.md`.

**Le guide de personnalisation menorah est cassé.** Il pointe deux fois vers
`frontend/src/pages/MenorahAlt2.vue`, fichier qui **n'existe plus**. Conservé pour l'histoire,
inutilisable tel quel.

## Ce qui n'est PAS ici

≈20 Mo de binaires sans lecteur ont été **retirés du dépôt** le 2026-07-27 plutôt qu'archivés
— l'historique git les conserve, un archivage les aurait gardés dans chaque clone :

| Retiré | Poids | Pourquoi |
|---|---|---|
| `gif/` (6 GIF + 1 mp4) | 13,9 Mo | doublon exact de `frontend/public/gif/`, la seule copie servie |
| `adminer.tar` | 3,1 Mo | binaire tiers, hors chaîne de build |
| `frontend/public/assets/menorahshiviti.svg` | 2,2 Mo | variante abandonnée, **0 référence vérifiée** |
| `frontend/public/assets/menorahshiviti2.svg` | 238 Ko | variante abandonnée, **0 référence vérifiée** |
| `asset/menorah.svg` | 1,1 Mo | orphelin (le favicon servi est `frontend/public/assets/menorah.svg`) |
| `menorahshiviti3.svg` (racine) | 238 Ko | doublon du seul fichier réellement chargé au runtime |

Pour en récupérer un : `git checkout 099918c -- <chemin>`.
