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

## 🔵 D. Décisions de design — TOUTES TRANCHÉES le 2026-07-27 (fin de journée)

| # | Décision du commanditaire | État |
|---|---|---|
| **D1** | **Barre remplie** à la place de la courbe (§3.2) | **LIVRÉ** — `StatsCompact.vue`, vérifié au navigateur sur les 3 variantes (captures `verif/sprint-2026-07-27/d1-barre-*.png`) |
| **D2** | `/don` multi-actives : **statu quo** — la plus récente gagne + avertissement | Rien à faire (déjà le comportement du contrat) |
| **D3** | Bandeau display : **statu quo** — texte configuré, personnalisable par soirée, rien d'automatique | Rien à faire |
| **D4** | Contraste des thèmes : **avertir sans bloquer** (conforme spec §5.4) | Rien à faire (déjà appliqué) |

## 🟡 Dette mineure assumée (sans échéance)

| Item | Détail |
|---|---|
| Rate-limit | En mémoire mono-instance (résidu assumé — un redémarrage Railway remet quota et budget d'échecs à zéro). ✅ **`x-forwarded-for` validé le 2026-07-28** : `app.set('trust proxy', 1)` + clé `req.ip` — l'IP n'est plus falsifiable par en-tête client (`app.ts`, `middleware/rate-limit.ts`) |
| `GET /api/admin/backup.db` | Livre la base entière, toutes soirées — incompatible avec un futur multi-locataire (`routes/admin.ts:34`) |
| `nixpacks.toml [start]` | Doublon mort de `railway.json deploy.startCommand` — purgeable maintenant qu'un `railway up` a validé la chaîne dédupliquée |
| CSS orphelin | `.theme-grid`/`.theme-preview` dans `DisplaySettingsPanel.vue` (ancienne grille remplacée par la galerie) |
| E2 sous-titre fondateurs | FAIT par l'admin lui-même (vérifié en prod le 2026-07-27) — plus rien à faire |
| Vitest : pool `forks` instable sous Windows | Le pool par défaut (tinypool, processus fils) meurt aléatoirement (« Worker exited unexpectedly », souvent sur `rate-limit.test.ts`) sur la machine de dev — **prouvé préexistant sur master `14e3d4f`**, PAS lié au code. `npx vitest run --pool=threads` est passé 27/27 (199 tests) deux fois de suite pendant que forks crashait. À trancher : épingler `pool: 'threads'` dans `backend/vitest.config` (vérifier d'abord que l'isolation par fichier tient sur CI/Linux) |
| Association son↔GIF changée sans « Enregistrer » | L'écran ne rafraîchit son index gif→son que sur `config:updated` (donc à chaque enregistrement du panneau), au montage et à la reconnexion — une association changée SANS toucher aux réglages n'atteint les écrans déjà ouverts qu'au prochain de ces trois moments. Assumé (rare, se répare seul) |

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
