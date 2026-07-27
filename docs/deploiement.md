# Déploiement

Vérifié le **2026-07-27** contre `099918c`.

## ⚠ La règle qui a déjà coûté une session

> **`git push` ne déploie RIEN.**

Le service Railway `web` n'a **aucune source GitHub** : `railway status --json` renvoie
`source: {image: null, repo: null}` (`.railwayignore:1-4`). Il n'y a pas d'auto-deploy à
réparer, ni de webhook à reconnecter — le service est alimenté par **upload CLI** et rien
d'autre.

Le 2026-07-26, une session a diagnostiqué l'absence de déploiement comme un aléa ponctuel de
Railway et attendu un déploiement qui n'est jamais venu (engram#3559, **réfuté** le même jour
par engram#3581 mais toujours non marquée superseded).

```bash
railway up          # LE seul moyen de déployer
```

## Coordonnées du service

| Champ | Valeur |
|---|---|
| Projet Railway | `menorah` — `5f9081b4-4223-472d-9434-7c1296986cf3` |
| Service | `web` — `15aa8a24-1001-4ff3-9154-3fe1307ed1a4` |
| Production | `https://web-production-975f6.up.railway.app` |
| Dépôt | `https://github.com/Mickael101/menorah.git` (miroir de code, **pas** source de déploiement) |
| Builder | NIXPACKS, région `europe-west4-drams3a`, **1 replica** |
| Healthcheck | `/api/health`, 120 s |

Sources : `railway.json:3-24`, `.railwayignore:1-4`.

## Chaîne de build

```bash
cd frontend && npm install && npm run build
mkdir -p ../backend/public && cp -R dist/* ../backend/public
cd ../backend && npm install && npm run build && npm start
```

> Cette séquence est **dupliquée à l'identique** dans `railway.json:5` et
> `nixpacks.toml:8-16`. Une divergence future ne se verrait qu'au déploiement.
> Voir `reste-a-faire.md`.

En production, un **seul process Node** sert l'admin, les écrans, l'API et le websocket.

## Le paquet uploadé — `.railwayignore`

`railway up` a renvoyé un **500 à l'upload** quand le paquet dépassait ~90 Mo hors
`node_modules` (2026-07-26). `.railwayignore` est donc obligatoire, pas cosmétique.

| Exclu | Raison |
|---|---|
| `node_modules/` | réinstallé par le build |
| `frontend/dist/`, `backend/public/` | régénérés par le `buildCommand` |
| **`backend/db/`** | base locale + ses sauvegardes. **La production lit le volume `DATA_DIR=/data`** : les envoyer serait inutile et écraserait les dons |
| `backend/.tmp-test-data/` | artefacts de la suite de tests |
| `.git/`, `/docs/`, `/assets/` | inutiles au build |

> **Piège de syntaxe documenté dans le fichier** : les motifs sont **ancrés par le slash
> initial**. Sans lui, la syntaxe gitignore matche le nom à n'importe quel niveau — `assets/`
> exclurait aussi `frontend/src/assets/` (qui contient `global.css`, importé par `main.ts`)
> et `frontend/public/assets/`, ce qui **casse le build et le runtime**.

**Avant tout `railway up` : vérifier que `DATA_DIR` est bien positionné en production.**

## Variables d'environnement

| Variable | Lue dans | Rôle | Défaut |
|---|---|---|---|
| `PORT` | `index.ts:12` | port d'écoute | `3000` |
| **`ADMIN_TOKEN`** | `middleware/admin-auth.ts:10`, `index.ts:29` | jeton organisateur — header `x-admin-token` **ou** `?token=` | *aucun* → **production : 503 sur toutes les routes admin** ; hors production : **routes ouvertes** |
| `NODE_ENV` | `admin-auth.ts:13`, `index.ts:30` | bascule le comportement ci-dessus | non défini |
| `DATA_DIR` | `config/storage.ts:4` | racine du volume persistant (base, uploads, associations son↔GIF) | `backend/db/`, `backend/public/uploads/`, `backend/data/` |
| `EVENT_DEFAULT_SLUG` | `db/migrations.ts:277` | slug de la soirée créée sur installation neuve | `soiree-1` |
| `EVENT_DEFAULT_NAME` | `db/migrations.ts:281` | nom idem | `Soiree 1` |
| `VITE_API_URL` | `GifManager.vue:18`, `DisplaySettingsPanel.vue:25` | préfixe API **au build** — utilisé par ces 2 composants seulement, tous les autres appels sont relatifs | `''` |

Aucun `.env` n'est versionné (`.gitignore:19-21`). Aucune valeur de secret n'apparaît dans le code.

## Volume persistant

`DATA_DIR=/data` → volume Railway **5 Go** contenant :

```
/data/donations.db          base vivante
/data/backups/              rotation 60 fichiers
/data/uploads/              GIF, audio, SVG téléversés
/data/gif-audio.json        associations son ↔ GIF
```

## ⚠ Rotation de l'ADMIN_TOKEN — non faite

La valeur de production a été récupérée via Railway CLI et **écrite en clair dans le
transcript de la session du 2026-07-26**. Elle traîne aussi en clair dans
`~/.menorah-admin-token.txt` (présent, 24 octets, 2026-07-21).

La rotation a été proposée le 2026-07-26 et **jamais demandée**. Voir `reste-a-faire.md`.

## Angles morts

Aucune CI, aucun monitoring, aucune alerte, aucune supervision du volume `/data`, aucun
runbook d'incident. Cohérent avec un service sans source GitHub — mais cela signifie
qu'**aucun gate n'est automatisé** : les 63 tests ne tournent que si quelqu'un les lance
à la main, depuis le bon répertoire.
