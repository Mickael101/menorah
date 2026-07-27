# Données, migrations et sauvegardes

Vérifié le **2026-07-27** contre `099918c`.

## Tables

| Table | Colonnes clés | Contraintes notables | Source |
|---|---|---|---|
| `donations` | `id`, **`event_id`**, `first_name`, `last_name`, `amount`, `reference`, `premium_word_id`, `email`, `phone`, `created_at`, `updated_at` | `CHECK(amount > 0)` ; **`event_id` NULLABLE et SANS `REFERENCES`** — divergence assumée de la spec §4.1 ; `premium_word_id`/`email`/`phone` ajoutées par `ALTER` avalé en try/catch | `db/init.ts:34-66`, `db/migrations.ts:179-187` |
| `config` *(hérité, singleton)* | `id`, `goal_amount`, `preset_amounts`, `menorah_segments`, `display_settings`, `updated_at` | `CHECK(id = 1)` ; **plus rien ne l'écrit** depuis la migration, mais elle est **recréée à chaque démarrage** | `db/init.ts:74-93`, `config.service.ts:6-8` |
| `events` | `id`, `slug`, `name`, `status`, `admin_code_hash`, `logo_url`, `default_locale`, `currency`, `created_at`, `archived_at` | `slug UNIQUE NOT NULL`, `status DEFAULT 'draft'`, `default_locale DEFAULT 'he'`, `currency DEFAULT 'ILS'` ; `admin_code_hash` nullable à dessein | `db/migrations.ts:108-121` |
| `event_configs` | `event_id` (PK), `goal_amount`, `preset_amounts`, `premium_tiers`, `menorah_segments`, `display_settings`, `theme_id`, `updated_at` | `PK REFERENCES events(id)`, `theme_id REFERENCES themes(id)` — **source de vérité actuelle** | `db/migrations.ts:131-142` |
| `media` | `id`, `event_id`, `kind`, `filename`, `audio_filename`, `created_at` | `event_id NOT NULL REFERENCES events(id)` — **créée, jamais lue ni écrite** | `db/migrations.ts:149-158` |
| `themes` | `id`, `event_id` (NULL = preset livré), `name`, `tokens_json`, `created_at` | `event_id REFERENCES events(id)` — **créée, jamais lue ni écrite** | `db/migrations.ts:164-172` |

**Index** : `idx_donations_created_at` (`init.ts:70`), `idx_donations_event_created (event_id, created_at)` (`migrations.ts:381`).

**Clés étrangères** : `PRAGMA foreign_keys = ON` (`init.ts:31`) **et reposé après chaque
`export()`** (`init.ts:134`). Sans ce rappel elles n'étaient actives que pendant la migration
— corrigé le 2026-07-27 par `4828ae3`.

## Migrations

Aucun framework. Séquence en dur, **idempotente, rejouée à chaque démarrage** (`db/init.ts:97`).

| # | Fonction | Effet | Ligne |
|---|---|---|---|
| 1 | `createEventsTable` | table `events` | `migrations.ts:102` |
| 2 | `createEventConfigsTable` | table `event_configs` | `:124` |
| 3 | `createMediaTable` | table `media` | `:145` |
| 4 | `createThemesTable` | table `themes` | `:161` |
| 5 | `addEventIdToDonations` | `ALTER TABLE donations ADD COLUMN event_id` | `:175` |
| 6 | `seedFirstEvent` | crée la soirée 1 (`orot-netanel` si données héritées, sinon `EVENT_DEFAULT_SLUG`/`soiree-1`) + `attachOrphanDonations` (NULL **et** FK pendante) | `:215`, `:241` |
| 7 | `copyLegacyConfig` | recopie `config` → `event_configs(1)`, rafraîchie tant que l'ancienne table est plus récente (« la fenêtre », `:323-331`) | `:289` |
| 8 | `createEventIndexes` | index composite | `:373` |

**Pas de table de version de schéma.** L'idempotence repose sur des sondes : `hasColumn`
(`:22`), `tableExists` (`:31`), `migrationAlreadyApplied` (`:72`). Le schéma vivant est donc
dérivé du DDL et d'`ALTER` en try/catch — un `ALTER` qui échoue est avalé silencieusement.

## Sauvegardes

| Quoi | Détail | Source |
|---|---|---|
| Snapshot **pre-migration** | pris **avant** `initDatabase()` — l'ordre est le filet de sécurité de la migration | `index.ts:23-25` |
| Snapshot au démarrage | à chaque boot | `backup.service.ts` |
| Snapshot horaire | scheduler | `backup.service.ts:61-67` |
| Rotation | **60 fichiers max** | `backup.service.ts:5` |
| Emplacement | `$DATA_DIR/backups/` — en production le volume Railway | `config/storage.ts:4` |

En local : `backend/db/backups/` (19 dumps au 2026-07-27), **exclus du dépôt** (`.gitignore`)
**et du paquet de déploiement** (`.railwayignore:20`).

> **Aucune restauration n'a jamais été testée.** Les sauvegardes sont produites et tournées,
> mais rien ne prouve qu'un fichier produit est restaurable — inspecter les tables du fichier,
> pas seulement son existence. Voir `reste-a-faire.md`.

## Données personnelles

Les colonnes `email`, `phone` et `reference` de `donations` sont de la donnée personnelle.

| Voie | État |
|---|---|
| `GET /api/donations` | **dépouillée** par défaut (`toPublicDonation`) depuis le 2026-07-26 |
| `GET /api/donations/:id`, `?full=1`, `export.csv` | protégées par `requireAdmin` |
| **Socket.IO** | ⚠ **ouverte** — objet complet diffusé aux écrans publics. Voir `api-et-socket.md` |
| Export hors ligne | `D:\Menora\donnees-sensibles\` (hors dépôt) — 26 donateurs réels, voir le `LISEZ-MOI.md` de ce dossier |

**Aucune politique de rétention n'est définie** : ni durée de conservation, ni droit à
l'effacement, ni base légale documentée. Angle mort assumé — voir `reste-a-faire.md`.

## Volume de données observé

| Date | Environnement | Dons | Total |
|---|---|---|---|
| 2026-07-21 | production | 27 | 205 420 ₪ |
| 2026-07-26 | production | 30 | — |
| 2026-07-27 | dev local | 5 | — |

Un don de test (`id=88`, « TEST », 1 ₪) créé le 2026-07-21 est **toujours en base de
production** et supprimable depuis l'admin.
