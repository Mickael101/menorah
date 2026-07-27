# Research: Système de Visualisation des Dons

**Date**: 2025-01-26
**Status**: Complete

## Technology Decisions

### Frontend Framework

**Decision**: Vue.js 3 avec Composition API

**Rationale**:
- Réactivité native parfaite pour les mises à jour temps réel
- Composition API permet des composables réutilisables (useSocket, useDonations)
- Plus léger que React, courbe d'apprentissage douce
- Excellent support SVG et animations CSS/JS

**Alternatives considered**:
- React: Plus verbeux, nécessite plus de boilerplate
- Vanilla JS: Manque de réactivité native, plus de code à maintenir
- Svelte: Moins de ressources/communauté disponibles

### Backend Framework

**Decision**: Express.js avec TypeScript

**Rationale**:
- Minimaliste et flexible (KISS)
- Socket.IO s'intègre nativement
- Même langage frontend/backend (TypeScript)
- Pas besoin de features complexes (pas NestJS, pas Fastify)

**Alternatives considered**:
- NestJS: Over-engineered pour ce projet (YAGNI)
- Fastify: Gains de performance non nécessaires pour ~100 dons
- Python/FastAPI: Ajouterait un 2ème langage au projet

### Real-Time Communication

**Decision**: Socket.IO

**Rationale**:
- Fallback automatique (WebSocket → polling)
- API simple et bien documentée
- Rooms pour séparer admin et displays
- Reconnexion automatique gérée

**Alternatives considered**:
- WebSocket natif: Pas de fallback, reconnexion à gérer manuellement
- Server-Sent Events: Unidirectionnel seulement
- Firebase Realtime: Dépendance externe, coût potentiel

### Database

**Decision**: SQLite avec better-sqlite3

**Rationale**:
- Zéro configuration (KISS)
- Fichier unique, backup simple
- Suffisant pour ~100 dons
- Synchrone avec better-sqlite3 (plus simple que async)

**Alternatives considered**:
- PostgreSQL: Nécessite un serveur, configuration (YAGNI)
- MongoDB: Overhead pour des données structurées simples
- JSON file: Pas de requêtes, risque de corruption

### SVG Animation

**Decision**: CSS animations + manipulation DOM directe

**Rationale**:
- CSS transitions pour les changements d'opacité/couleur
- JavaScript pour calculer quels segments illuminer
- 60fps garanti avec CSS hardware-accelerated
- Pas de librairie d'animation nécessaire (GSAP overkill)

**Alternatives considered**:
- GSAP: Puissant mais overhead pour des animations simples
- Anime.js: Librairie supplémentaire non nécessaire
- Lottie: Format différent, nécessite conversion

## Architecture Decisions

### Admin vs Display Separation

**Decision**: Routes séparées dans la même app Vue

**Rationale**:
- `/admin` → Panel administrateur
- `/display` → Page de visualisation (fullscreen)
- Partage du même store/composables
- Déploiement unique

### State Management

**Decision**: Composables Vue (pas de Pinia/Vuex)

**Rationale**:
- État simple: liste de dons, config, total
- Composables suffisants pour partager l'état
- Évite une dépendance supplémentaire (YAGNI)

### Menorah SVG Structure

**Decision**: SVG avec IDs sur chaque segment

**Rationale**:
- Segments nommés: `segment-1`, `segment-2`, etc. (du bas vers le haut)
- Classes CSS pour états: `.lit`, `.unlit`
- Configuration des seuils en JSON (quel % pour quel segment)

```svg
<svg id="menorah">
  <g id="segment-1" class="unlit">...</g>
  <g id="segment-2" class="unlit">...</g>
  ...
</svg>
```

## Performance Considerations

### Animation Performance

- Utiliser `transform` et `opacity` (GPU accelerated)
- Éviter `width`, `height`, `top`, `left` pour animations
- `will-change: opacity` sur segments Menorah
- `requestAnimationFrame` pour compteur numérique

### Real-Time Updates

- Événement unique `donation:new` avec toutes les données nécessaires
- Pas de requêtes HTTP après le WebSocket (données incluses)
- Debounce si dons simultanés (regrouper en 100ms)

## Security Considerations

- Panel admin protégé par mot de passe simple (basic auth ou token)
- Pas de données sensibles exposées sur /display
- Validation des montants côté serveur
- Sanitization des noms (XSS prevention)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| SVG non compatible | Fournir un template SVG de référence |
| Déconnexion WebSocket | Socket.IO reconnecte auto + état persisté en DB |
| Animations saccadées | Tests sur hardware cible, fallback à transitions simples |
| Dons simultanés | Debounce + recalcul du total depuis DB |
