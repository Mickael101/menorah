# Historique et décisions

Vérifié le **2026-07-27**. Sources : `git log` (84 commits), mémoire persistante engram + claude-mem.

## Repères

| Champ | Valeur |
|---|---|
| Premier commit | `555758b` — 2025-11-26 — *Initial commit from Specify template* (Mickael Lechan) |
| Dernier commit | `099918c` — 2026-07-27 |
| Commits | 84 · **aucun tag, aucune release** |
| Branche de travail | `feat/admin-navy-or` — 18 commits d'avance sur `master`, poussée le 2026-07-27 |
| Auteurs | Jarvis (80), Mickael Lechan (3), Avi (1) |

## Chronologie

| Période | Thème | Jalons |
|---|---|---|
| **2025-11-26** | Amorçage | template Specify, puis squelette complet backend Express+sql.js / frontend Vue 3 |
| **2025-12-05 → 12-11** | Animations + Railway | animations GSAP et éclairage progressif, sons, `railway.json` + `nixpacks.toml` |
| **2025-12-14 → 12-16** | Identité « shiviti » | trois itérations du SVG menorah, dons premium à mots réservés, plaques dorées à 4 niveaux |
| **2025-12-17** | Réglage fin du gala | **13 commits en un jour**, dont 9 d'ajustement du cadrage SVG. Champ email ajouté au schéma |
| **2025-12-18** | Multi-écrans | 8 variantes de DisplayPage, système audio, GIFs, défilement infini, champ téléphone |
| **⛔ 12-18 → 07-19** | **Trou de 7 mois** | Le gala de décembre n'a laissé aucune trace dans le dépôt |
| **2026-07-19 → 07-22** | Page publique | **page `/don`** + sécurisation API + sauvegardes automatiques (43 fichiers d'un coup), textes et champs configurables |
| **2026-07-26** | Sécurité PII + thèmes | amorce Vitest/Supertest, **4 correctifs de sécurité**, spec multi-événements, 4 nouveaux thèmes |
| **2026-07-27** | Multi-soirées + navy/or | schéma multi-événements migré, repalettage des 5 panneaux admin, `eventId` obligatoire, isolation temps réel par room |

## Décisions produit datées

Le commanditaire est **Mickael**.

| Date | Décision | Source |
|---|---|---|
| 2026-07-16 | **Généralisation du produit** : 3 thèmes coexistants, **menorah rendue optionnelle** (`none`/`menorah`/`custom`), admin trilingue FR/EN/HE avec RTL. L'app cesse d'être « l'app menorah » pour devenir une plateforme événementielle configurable | engram#2797, #2792, #2804, #2892 |
| 2026-07-19 | `lastName` rendu **facultatif** | engram#3239 |
| 2026-07-20 | Le POC visuel n'interprète **aucun** motif comme une menorah — 22 zones architecturales. « Le nom historique du projet ne doit pas influencer le sens d'un nouveau visuel » | engram#3299 *(supersède #3296)* |
| 2026-07-21 | Page publique **`/don`** pour les donateurs absents. Puis, sur retour utilisateur, les textes deviennent configurables : une phrase hébraïque ajoutée d'initiative est **retirée** → règle « ne pas inventer de contenu éditorial, le rendre configurable » | engram#3430, #3436 |
| 2026-07-22 | Sur retour « rien d'imposé » : le caractère obligatoire de **chaque** champ d'identité devient admin-configurable ; `/don` bascule en **hébreu par défaut** | engram#3456 |
| 2026-07-26 | **Virage structurel** (spec `ec7c85b`) : de la soirée unique à **N soirées simultanées** + moteur de thèmes en base | engram#3566 |
| 2026-07-26 | La fuite PII est fermée par **projection au niveau de la réponse**, pas par fermeture de route — parce que le dépouillement par défaut fait échouer **fermé** un oubli de garde | engram#3578 |

### Les quatre arbitrages du virage multi-événements (2026-07-26)

| Sujet | Décision |
|---|---|
| Direction visuelle | **navy + or partout**, admin inclus |
| Accès | par **slug** `/e/:slug/{admin,display,don}` ; anciennes routes conservées et redirigées — des QR codes vers `/don` peuvent déjà être imprimés |
| Rôles | **2 niveaux sans comptes utilisateurs** : organisateur (`ORGANIZER_TOKEN` en env) + code admin par soirée, haché en base |
| Ambition | produit **revendable à d'autres synagogues** — chaque soirée porte sa marque. Couche `organizations` laissée possible mais non construite (YAGNI) |

**Aucune échéance → priorité explicite à la qualité structurelle.** Ordre imposé LOT 0→6 :
la refonte UI vient **après** la fondation, sinon chaque écran serait retouché deux fois.

## Correctifs de sécurité notables

| Commit | Date | Portée |
|---|---|---|
| `558f0e2` | 07-21 | Durcissement initial — `admin-auth`, `rate-limit`, `backup.service` introduits **en même temps** que la page `/don`. 43 fichiers, sécurité et feature mêlées : ni cherry-pickable ni révocable partiellement |
| `331d146` | 07-26 | Extraction de `createApp()`, amorce Vitest+Supertest — sans quoi aucun correctif suivant n'aurait de preuve |
| `36435a1` | 07-26 | **PII** — export CSV protégé |
| `aeb08ad` | 07-26 | **PII** — projection publique par défaut sur `GET /api/donations` |
| `86f603c` | 07-26 | **PII** — `GET /api/donations/:id` protégé |
| `d9aae2d` | 07-26 | **Auth** — l'absence d'`ADMIN_TOKEN` ne vaut plus accès libre (fail-closed) |
| `8976f67` | 07-27 | **Migration** — schéma multi-événements idempotent, dump avant, vérifié sur la vraie base |
| `b786a87` | 07-27 | **Rollback** — migration réellement réversible + tests qui le prouvent |
| `4828ae3` | 07-27 | **DB** — les FK n'étaient actives *que* pendant la migration |
| `e6c32f3` | 07-27 | **Isolation** — `eventId` en premier paramètre obligatoire (l'oubli devient erreur de compilation) ; `io.emit` global → `io.to('event:<id>')` |

## Auto-corrections à retenir

| Croyance | Réalité |
|---|---|
| « La barre de progression de `/display` est cassée » | **Faux** — `StatsCompact.vue:64-76` dessine une courbe de Bézier délibérée. Les vrais défauts étaient de design |
| « L'auto-deploy GitHub ne s'est pas déclenché » (aléa) | **Faux** — le service n'a jamais eu de source GitHub. Structurel, pas ponctuel |
| « `saveDatabase()` corrompt la base si crash » | **Corrigé** — écriture atomique tmp+rename |
| « `getPremiumWords()` fuit cross-event » | **Corrigé** — route scopée |

## Trois identités, un seul projet

| Nom | Où |
|---|---|
| **OHEL YEOCHOUA** | ancien `CLAUDE.md`, specs de 2025-11 archivées, `api.yaml` |
| **OROT NETANEL** | `frontend/index.html`, branding admin, slug de la soirée 1 |
| **menorah** | `README.md`, `package.json`, dépôt GitHub |

Aucun document ne trace le renommage. `browserTitle` est devenu configurable le 2026-07-21
précisément parce que le `<title>` était « OHEL YEOCHOUA » en dur — reliquat d'un autre tenant.

## Changelog

| Date | Passe |
|---|---|
| **2026-07-28** | **Sprint célébrations et refonte admin** (branche `feat/celebrations-et-config-2026-07-28`, 8 commits). Paliers montant→GIF+son configurables dans la galerie (`displaySettings.celebrations`, une règle par GIF, résolution côté client synchrone avec la file d'animations), arrêt d'urgence temps réel (`POST /api/gifs/stop` → socket `celebration:stop`, coupe GIF+plaque+file+audio), célébration GIF+son sur `/don`, audio des écrans refactoré en instance unique stoppable, recherche dans la liste des dons (nom/référence/montant, insensible aux accents), admin refondu en **5 onglets par page cible** (une seule instance de panneau, une seule barre d'enregistrement), identité admin par onglets de langue. 199 tests, vérification navigateur complète (9 captures `docs/verif/2026-07-28/`). Diagnostic au passage : pool vitest forks instable sous Windows (préexistant, `--pool=threads` stable). |
| **2026-07-27** | **Consolidation doc initiale** (`/doc-vivante`, mode INIT). 5 agents de récolte en parallèle. Création de `docs/README.md` (contrat) + 7 documents. `specs/` fondu dans `docs/`. 16 documents archivés avec préfixe date. ≈20 Mo de binaires sans lecteur retirés du dépôt. `.claude/settings.local.json` dé-versionné (fuitait un chemin utilisateur tiers). `.railwayignore` et `.gitignore` mis à jour. `CLAUDE.md` corrigé : il annonçait `better-sqlite3` alors que le projet utilise `sql.js`. Graphify évalué et **écarté** (6 critères sur 6 sous le seuil). Branche `feat/admin-navy-or` poussée sur `origin` — ses 18 commits n'existaient que sur un disque. |
