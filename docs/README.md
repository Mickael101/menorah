# Documentation menorah — point d'entrée unique

Vérifié le **2026-07-28** contre la branche `feat/celebrations-et-config-2026-07-28`
(sprint célébrations par palier, stop temps réel, refonte des onglets admin).

---

## Tu es un modèle ou un agent qui découvre ce projet ? Lis dans cet ordre

1. **`../CLAUDE.md`** — conventions et commandes du dépôt.
2. **Ce fichier** — la carte ci-dessous.
3. **`historique.md`** — ce que le projet a été, et pourquoi il est ce qu'il est.
4. **Le document du module que tu touches** (table suivante).
5. **`reste-a-faire.md`** — avant de proposer quoi que ce soit de nouveau.

### Règles absolues du projet

| Règle | Pourquoi |
|---|---|
| **Le code fait foi, pas cette doc.** Une divergence se corrige dans la doc. | Sept mois d'écart avaient rendu `CLAUDE.md` faux sur le driver de base de données. |
| **`git push` ne déploie RIEN.** Le service Railway `web` n'a aucune source GitHub. Seul `railway up` déploie. | `railway status --json` → `source: {image: null, repo: null}`. Une session a attendu un déploiement qui n'est jamais venu. |
| **Les tests se lancent depuis `backend/`**, jamais depuis la racine. | Ailleurs, `npx` résout un vitest étranger et l'isolation de base saute. Voir `tests.md`. |
| **Une suite verte ne prouve rien sans `ADMIN_TOKEN`.** | Hors production, `requireAdmin` laisse passer **par conception**. Un test de sécurité qui ne pose pas le jeton est vert sans rien vérifier. |
| **Ne jamais inventer de contenu éditorial.** Un texte affiché se rend configurable. | Décision du commanditaire, 2026-07-21 : une phrase hébraïque ajoutée d'initiative a dû être retirée. |

---

## Carte de la doc (fraîcheur)

| Document | Sujet | Vérifié le |
|---|---|---|
| [`architecture.md`](architecture.md) | Stack réelle, modules, points d'entrée, routage multi-soirées frontend, code mort | 2026-07-27 |
| [`api-et-socket.md`](api-et-socket.md) | Tous les endpoints HTTP et événements Socket.IO, avec leur garde | 2026-07-29 |
| [`donnees-et-migrations.md`](donnees-et-migrations.md) | Schéma des tables, migrations, sauvegardes | 2026-07-27 |
| [`deploiement.md`](deploiement.md) | Railway, `railway up`, variables d'environnement, volume | 2026-07-27 |
| [`tests.md`](tests.md) | Comment lancer le gate, et les pièges qui rendent le vert menteur | 2026-07-29 |
| [`historique.md`](historique.md) | Chronologie, décisions datées, changelog | 2026-07-29 |
| [`reste-a-faire.md`](reste-a-faire.md) | Backlog vérifié dans le code, par famille | 2026-07-29 |
| [`specs/2026-07-26-fondation-multi-evenements-design.md`](specs/2026-07-26-fondation-multi-evenements-design.md) | Design validé du virage multi-soirées + moteur de thèmes | 2026-07-27 |
| [`specs/2026-07-28-atelier-scenes-design.md`](specs/2026-07-28-atelier-scenes-design.md) | Design validé de l'Atelier Scènes (Rive, pipeline hors app, scène bâtiment) | 2026-07-28 |
| [`superpowers/plans/`](superpowers/plans/) | Plans de travail vivants (chantier en cours) | 2026-07-28 |
| [`verif/`](verif/) | 40 captures avant/après, preuves des tranches livrées (dont `2026-07-29-atelier-scenes/` : fallback scène + carte admin FR — la capture HE reste à faire, le toggle de locale a résisté à l'automatisation) | 2026-07-29 |
| [`archive/`](archive/) | Documents livrés ou remplacés, préfixés par date. Jamais supprimés. | — |

> Une date de plus d'un mois sur un module dont le code a bougé depuis = suspecter une dérive.

---

## Mémoire persistante

Décisions, causes racines et runbooks vivent souvent **uniquement** en mémoire — pas dans le code ni dans le git.

**Piège vérifié le 2026-07-27 : les souvenirs sont éclatés sur quatre clés, et la clé évidente est la minoritaire.**

| Système | Clés réelles | À savoir |
|---|---|---|
| engram | `menorah` **et** `menora` | Les observations les plus critiques (sécurité PII, Railway, spec multi-événements) sont sous **`menora`**. Chercher sur `menorah` seul rate toute la sécurité et tout le déploiement. |
| claude-mem | `Menora` (majuscule, ~1 098 obs) et `menorah` (~168) | Filtrer sur `menorah` en raterait 1 098. |
| engram | `analyse_strategique` | Une observation d'architecture y est classée. |

```
mem_search(query, project="menora",  match_mode="any")
mem_search(query, project="menorah", match_mode="any")
```

Le `match_mode` par défaut est `"all"` (FTS5 AND) : **toute requête multi-mots renvoie « No memories found » à tort**. Un résultat vide n'est une preuve d'absence qu'avec `match_mode:"any"`.

**Deux souvenirs sont périmés, ne pas s'y fier :**

| Souvenir | Réalité au 2026-07-27 |
|---|---|
| engram#3559 « l'auto-deploy GitHub ne s'est pas déclenché » (aléa ponctuel) | **Réfuté** le même jour par engram#3581 : le service n'a jamais eu de source GitHub. #3559 n'est pas marquée superseded. |
| « `saveDatabase()` écrit sans temp+rename, corruption possible » | **Corrigé** — l'écriture est atomique, `backend/src/db/init.ts:124-126`. |
| « `getPremiumWords()` fuit `donorName` cross-event » | **Corrigé** — la route est scopée, `backend/src/routes/donations.ts:34`. Elle renvoie toujours les noms, mais ils sont publics par nature (mur des plaques). |

Une observation datée du 2026-02-04 classée sous `menorah` décrit un **autre projet** (FastAPI + PostgreSQL + Redis), cinq mois avant le démarrage de Menora. À ignorer.

---

## Protocole de mise à jour

1. Le code change → **le document du module change dans le même commit**, et sa date passe dans la table ci-dessus.
2. Un comportement décrit ici disparaît → la section part dans `archive/AAAA-MM-JJ_<sujet>/`. **Jamais de suppression.**
3. Une décision prise en session → `mem_save` avec `project` explicite, **et** une ligne dans `historique.md` si elle change le produit.
4. Une passe complète → `/doc-vivante`, puis une ligne dans le changelog de `historique.md`.
5. Toute affirmation écrite ici doit être vérifiable dans le code, le git, ou la mémoire. En cas de doute : `⚠ à vérifier`, jamais une affirmation.

---

## Structure

```
docs/
  README.md              ← ce contrat
  architecture.md  api-et-socket.md  donnees-et-migrations.md
  deploiement.md   tests.md          historique.md          reste-a-faire.md
  specs/                 design validé, vivant
  superpowers/plans/     plans de travail du chantier en cours
  verif/                 captures avant/après (preuves)
  archive/               daté, jamais supprimé
```

Hors `docs/` et volontairement : `../CLAUDE.md` et `../README.md` (contrats d'outils et vitrine GitHub).

---

## Raccourcis

| Besoin | Document |
|---|---|
| « Quel endpoint fait quoi, et qui peut l'appeler ? » | `api-et-socket.md` |
| « Pourquoi ce champ existe / qui a décidé ça ? » | `historique.md`, puis la mémoire |
| « Comment je déploie ? » | `deploiement.md` |
| « Mes tests sont verts, est-ce que ça veut dire quelque chose ? » | `tests.md` |
| « Qu'est-ce qui reste ? » | `reste-a-faire.md` |
| « Où est passé le vieux document X ? » | `archive/` |

---

## Changelog

| Date | Passe |
|---|---|
| 2026-07-27 | **Consolidation initiale.** Création de ce contrat et de 7 documents dérivés du code (5 agents de récolte : inventaire, mémoire, git, code, étude graphify). `specs/` fondu dans `docs/`. 16 documents livrés ou remplacés archivés avec préfixe date. ≈20 Mo de binaires sans lecteur retirés du dépôt. Graphify évalué et écarté (voir `architecture.md`). `CLAUDE.md` corrigé — il annonçait un driver de base de données faux. |
