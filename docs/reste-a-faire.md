# Ce qui reste à faire

Vérifié le **2026-07-27** (fin de journée) contre master après le sprint de clôture du
backlog (plan : `superpowers/plans/2026-07-27-sprint-cloture-backlog.md`, journal avec SHAs).
**L'intégralité des familles A (sécurité), B (multi-événements), C (qualité) et E (contenu
admin) du backlog du matin est LIVRÉE, vérifiée au navigateur (24 captures
`verif/sprint-2026-07-27/verif-finale/`) et DÉPLOYÉE en production** (déploiement Railway
`3b8f0286`, jeton admin roté, prod vérifiée : 31 dons intacts, payload public dépouillé,
7 thèmes seedés, routes `/e/:slug` servies).

Ce qui suit est ce qui reste — rien d'autre.

---

## 🔵 D. Décisions de design — au commanditaire

| # | À trancher | Contexte |
|---|---|---|
| **D1** | Remplacer la courbe d'objectif par une **barre remplie** (§3.2 de la spec) | La courbe actuelle est honnête mais peu lisible (rapport de boîte 19:1, mesuré) — délibérément non truquée |
| **D2** | Confirmer le comportement de `/don` hérité quand **plusieurs soirées sont actives** | Implémenté selon le contrat : la plus récente gagne + en-tête `X-Multiple-Active-Events` + warning. À confirmer que c'est le comportement voulu (§4.3) |
| **D3** | Le **bandeau des écrans display** (« OHEL YEHOSHUA / SOIRÉE DE GÉNÉROSITÉ ») est un texte configuré, PARTAGÉ par défaut entre soirées | Doit-il refléter le nom de la soirée ? (constat de la passe navigateur, pas un bug) |
| **D4** | Contraste des thèmes : la spec §5.4 (appliquée) dit **avertir sans bloquer** | Un 422 refusant est une bascule d'une ligne (`routes/themes.ts`) si l'avis change |

## 🟡 Dette mineure assumée (sans échéance)

| Item | Détail |
|---|---|
| Rate-limit | En mémoire mono-instance ; `x-forwarded-for` non validé, pas de `trust proxy` (`middleware/rate-limit.ts`) |
| `GET /api/admin/backup.db` | Livre la base entière, toutes soirées — incompatible avec un futur multi-locataire (`routes/admin.ts:34`) |
| `nixpacks.toml [start]` | Doublon mort de `railway.json deploy.startCommand` — purgeable maintenant qu'un `railway up` a validé la chaîne dédupliquée |
| CSS orphelin | `.theme-grid`/`.theme-preview` dans `DisplaySettingsPanel.vue` (ancienne grille remplacée par la galerie) |
| E2 sous-titre fondateurs | FAIT par l'admin lui-même (vérifié en prod le 2026-07-27) — plus rien à faire |

## ⚫ F. Angles morts — rien n'existe, et personne ne l'a décidé

Inchangés depuis la passe du matin, toujours sans décision :

| Sujet | État |
|---|---|
| **Rétention / RGPD** des données donateurs | Aucune durée de conservation, aucun droit à l'effacement documenté |
| **CI** | Aucune. Les 161 tests + 2 builds ne tournent que lancés à la main. Le gate local inclut désormais `cd backend && npm run build` (tsc) — appris au premier deploy raté du sprint |
| **Monitoring / alerting** | Aucun. Pas de supervision du volume `/data`, pas de runbook |
| **Restauration de sauvegarde** | Jamais testée — inspecter les tables d'un fichier produit, pas seulement son existence |
| **Tests frontend** | Zéro test unitaire (le typecheck + la passe navigateur du sprint servent de garde-fous) |
| **Encaissement** | `/don` reste déclaratif (promesse). Aucun PSP, aucune décision |
| **Versionnement** | ~110 commits, 0 tag, aucune release |

## Dette hors dépôt (inchangée, décisions du 2026-07-27 matin)

`D:\Menora\artifacts\building-svg-poc\` (2,9 Mo), `D:\Menora\.tools\vtracer-0.6.15\`
(13,1 Mo), doublon JPEG à la racine `D:\Menora` — POC clos, laissés en place, à supprimer
quand le sujet sera définitivement abandonné.
