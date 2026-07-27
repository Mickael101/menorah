# Implementation Plan: Système de Visualisation des Dons

**Branch**: `master` | **Date**: 2025-01-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/master/spec.md`

## Summary

Système de visualisation des dons en temps réel avec 3 animations synchronisées :
1. Menorah SVG s'illuminant progressivement selon le total collecté
2. Graphique/compteur animé du total
3. Plaques des donateurs avec animations d'entrée

Piloté par un panel administrateur pour la saisie des dons et la configuration.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + backend)
**Primary Dependencies**: Vue.js 3 (frontend), Express.js (backend), Socket.IO (temps réel)
**Storage**: SQLite (simplicité, pas de serveur externe requis)
**Testing**: Vitest (recommandé, tests manuels suffisants pour MVP)
**Target Platform**: Navigateurs modernes (Chrome, Firefox, Edge)
**Project Type**: Web application (admin + display)
**Performance Goals**: 60fps animations, <1s propagation temps réel
**Constraints**: Aucun serveur complexe, déploiement simple
**Scale/Scope**: ~100 dons, 1 admin, 1-3 écrans d'affichage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. KISS** | ✅ PASS | Stack simple (Vue+Express+SQLite), pas de microservices |
| **II. YAGNI** | ✅ PASS | Seulement les 5 user stories définies, pas de features extras |
| **III. Clean Code** | ✅ PASS | TypeScript pour typage, structure claire frontend/backend |

**Quality Gates Alignment**:
- Animations 60fps: prévu dans le design
- Updates <1s: Socket.IO assure la propagation instantanée
- Tests recommandés: focus sur calcul des seuils et logique métier

## Project Structure

### Documentation (this feature)

```text
specs/master/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API specs)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/          # Donation, Config entities
│   ├── services/        # DonationService, SocketService
│   ├── routes/          # API REST endpoints
│   └── index.ts         # Entry point + Socket.IO setup
├── db/
│   └── donations.db     # SQLite database
└── package.json

frontend/
├── src/
│   ├── components/
│   │   ├── admin/       # Panel admin (DonationForm, ConfigPanel)
│   │   └── display/     # Visualisations (Menorah, Chart, DonorPlates)
│   ├── composables/     # useSocket, useDonations
│   ├── App.vue
│   └── main.ts
├── public/
│   └── assets/
│       └── menorah.svg  # Fichier SVG segmenté
└── package.json
```

**Structure Decision**: Web application avec frontend Vue.js et backend Express.
Séparation claire entre admin (saisie/config) et display (visualisations).
SQLite en local pour simplicité maximale (pas de Docker/PostgreSQL nécessaire).

## Complexity Tracking

> No complexity violations. Design follows KISS/YAGNI principles.
