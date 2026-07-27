# Spécification: Affichage Menorah & Pages de Donation

## 1. Contexte

### État actuel
- **SVG actuel**: Fichier placeholder (`frontend/public/assets/menorah.svg`) avec formes géométriques simples
- **SVG source**: `1 744726056.svg` - Menorah détaillée avec caractères hébraïques dorés (#EBD45C), utilisant des masks et des groupes complexes
- **Pages existantes**:
  - `/admin` - Panel d'administration
  - `/display` - Page unique affichant menorah + donateurs + stats

### Problème
- Le SVG de la menorah n'est pas le bon (placeholder)
- Tout est affiché sur une seule page `/display`
- Besoin de 3 pages séparées pour affichage dédié (écrans multiples)
- Besoin d'animations GSAP pour rendre l'affichage plus attractif

---

## 2. Objectifs

### 2.1 Remplacer le SVG de la Menorah
- Intégrer le vrai SVG `1 744726056.svg`
- Baliser le SVG en segments animables pour GSAP
- Conserver le style doré (#EBD45C / gold) sur fond blanc

### 2.2 Créer 3 Pages d'Affichage Distinctes
1. **`/donors`** - Tableau des donateurs
2. **`/menorah`** - Menorah seule sur fond blanc avec caractères dorés
3. **`/chart`** - Courbe de progression des donations

### 2.3 Animations GSAP
- Animation d'entrée de la menorah
- Effet de "glow" progressif selon le pourcentage de dons
- Animation des flammes/branches qui s'allument
- Transitions fluides sur les changements de données

---

## 3. Spécifications Techniques

### 3.1 Structure du nouveau SVG Menorah

Le SVG source contient:
- Dimensions: 303x435 viewBox
- Couleur principale: `#EBD45C` (doré)
- ~47 masks définis pour les différentes parties
- Groupes `<g>` avec masks pour chaque section (branches, base, texte hébraïque)

**Segmentation proposée pour GSAP:**
```svg
<svg id="menorah-main" viewBox="0 0 303 435">
  <!-- Groupe: Base de la Menorah -->
  <g id="menorah-base" class="menorah-segment" data-segment="1">
    <!-- Paths de la base -->
  </g>

  <!-- Groupe: Tige centrale -->
  <g id="menorah-stem" class="menorah-segment" data-segment="2">
    <!-- Paths de la tige -->
  </g>

  <!-- Groupe: Branches gauches (3) -->
  <g id="menorah-branch-left-1" class="menorah-segment" data-segment="3">...</g>
  <g id="menorah-branch-left-2" class="menorah-segment" data-segment="4">...</g>
  <g id="menorah-branch-left-3" class="menorah-segment" data-segment="5">...</g>

  <!-- Groupe: Branches droites (3) -->
  <g id="menorah-branch-right-1" class="menorah-segment" data-segment="6">...</g>
  <g id="menorah-branch-right-2" class="menorah-segment" data-segment="7">...</g>
  <g id="menorah-branch-right-3" class="menorah-segment" data-segment="8">...</g>

  <!-- Groupe: Shamash (branche centrale) -->
  <g id="menorah-shamash" class="menorah-segment" data-segment="9">...</g>

  <!-- Groupe: Texte hébraïque -->
  <g id="menorah-text-hebrew" class="menorah-text">
    <!-- Caractères hébraïques dorés -->
  </g>

  <!-- Groupe: Flammes (ajout pour animation) -->
  <g id="menorah-flames" class="menorah-flames">
    <g id="flame-1" class="flame" data-branch="1">...</g>
    <!-- ... 7 flammes au total -->
  </g>
</svg>
```

### 3.2 Page `/menorah` - Affichage Menorah

**Design:**
- Fond: Blanc pur (`#FFFFFF`)
- Menorah centrée verticalement et horizontalement
- Couleur SVG: Or (`#EBD45C` / `#D4AF37` pour variation)
- Taille: 80% de la hauteur viewport, max 800px

**Animations GSAP:**
```typescript
// Animation d'entrée
gsap.timeline()
  .from('#menorah-base', { opacity: 0, y: 50, duration: 0.8 })
  .from('#menorah-stem', { opacity: 0, scaleY: 0, transformOrigin: 'bottom', duration: 0.6 })
  .from('.menorah-branch', { opacity: 0, scaleX: 0, stagger: 0.2, duration: 0.5 })
  .from('#menorah-text-hebrew', { opacity: 0, y: -20, duration: 0.6 });

// Animation des flammes selon progression
function updateFlames(litCount: number) {
  gsap.to('.flame', {
    opacity: (i) => i < litCount ? 1 : 0.2,
    filter: (i) => i < litCount ? 'drop-shadow(0 0 10px #ffd700)' : 'none',
    duration: 0.5
  });
}

// Animation de glow sur progression
gsap.to('#menorah-main', {
  filter: `drop-shadow(0 0 ${progressPercent * 0.3}px #D4AF37)`,
  duration: 1
});
```

**Composant Vue:**
```vue
<template>
  <div class="menorah-page">
    <div class="menorah-container" ref="menorahRef">
      <MenorahSVG />
    </div>
    <div class="progress-indicator">
      <span class="percent">{{ stats.percentComplete.toFixed(0) }}%</span>
    </div>
  </div>
</template>
```

### 3.3 Page `/donors` - Tableau des Donateurs

**Design:**
- Fond: Dégradé sombre (`#0a0a1a` vers `#111827`)
- Grille de cartes de donateurs
- Animation d'apparition des nouvelles donations
- Scroll infini ou pagination

**Structure:**
```vue
<template>
  <div class="donors-page">
    <header class="donors-header">
      <h1>Nos Généreux Donateurs</h1>
      <div class="donation-count">{{ stats.donationCount }} dons</div>
    </header>

    <div class="donors-grid">
      <TransitionGroup name="donor-card">
        <DonorCard
          v-for="donor in sortedDonors"
          :key="donor.id"
          :donor="donor"
          :is-new="isNewDonation(donor.id)"
        />
      </TransitionGroup>
    </div>

    <footer class="donors-footer">
      <TotalAmount :amount="stats.totalAmount" />
    </footer>
  </div>
</template>
```

**Animations GSAP pour nouvelles donations:**
```typescript
// Animation d'entrée pour nouveau donateur
gsap.from(newDonorCard, {
  scale: 0,
  rotation: -10,
  duration: 0.6,
  ease: 'back.out(1.7)'
});

// Animation de confetti optionnelle
```

### 3.4 Page `/chart` - Courbe de Progression

**Design:**
- Fond: Dégradé sombre
- Graphique linéaire animé montrant la progression
- Objectif affiché avec ligne horizontale
- Compteur animé du total

**Structure:**
```vue
<template>
  <div class="chart-page">
    <header class="chart-header">
      <h1>Progression de la Campagne</h1>
    </header>

    <div class="chart-main">
      <ProgressChart :data="chartData" :goal="config.goalAmount" />
    </div>

    <footer class="chart-footer">
      <div class="stats-grid">
        <StatCard label="Total" :value="formatAmount(stats.totalAmount)" icon="euro" />
        <StatCard label="Objectif" :value="formatAmount(config.goalAmount)" icon="target" />
        <StatCard label="Progression" :value="`${stats.percentComplete.toFixed(1)}%`" icon="chart" />
        <StatCard label="Donateurs" :value="stats.donationCount" icon="users" />
      </div>
    </footer>
  </div>
</template>
```

**Animations GSAP pour le graphique:**
```typescript
// Animation de dessin de la courbe
gsap.from('.chart-line', {
  strokeDashoffset: totalLength,
  duration: 2,
  ease: 'power2.out'
});

// Animation des points de données
gsap.from('.data-point', {
  scale: 0,
  stagger: 0.1,
  duration: 0.4,
  ease: 'back.out(2)'
});

// Animation de la ligne d'objectif
gsap.from('.goal-line', {
  scaleX: 0,
  transformOrigin: 'left',
  duration: 1,
  delay: 1.5
});
```

---

## 4. Modifications du Router

```typescript
// frontend/src/router.ts
const routes = [
  { path: '/', redirect: '/admin' },
  { path: '/admin', name: 'admin', component: AdminPanel },
  { path: '/display', name: 'display', component: DisplayPage }, // Gardé pour compatibilité
  { path: '/menorah', name: 'menorah', component: MenorahPage },
  { path: '/donors', name: 'donors', component: DonorsPage },
  { path: '/chart', name: 'chart', component: ChartPage }
];
```

---

## 5. Dépendances à Ajouter

```json
{
  "dependencies": {
    "gsap": "^3.12.5"
  }
}
```

---

## 6. Structure des Fichiers à Créer/Modifier

### Fichiers à créer:
```
frontend/src/
├── pages/
│   ├── MenorahPage.vue       # Page menorah seule
│   ├── DonorsPage.vue        # Page tableau donateurs
│   └── ChartPage.vue         # Page courbe progression
├── components/
│   └── display/
│       ├── MenorahSVG.vue    # Composant SVG balisé
│       ├── ProgressChart.vue # Graphique de progression
│       └── StatCard.vue      # Carte de statistique
└── composables/
    └── useGsap.ts            # Composable pour animations GSAP

frontend/public/assets/
└── menorah.svg               # Nouveau SVG balisé (remplace l'ancien)
```

### Fichiers à modifier:
- `frontend/src/router.ts` - Ajouter les nouvelles routes
- `frontend/src/components/display/MenorahDisplay.vue` - Mise à jour pour GSAP

---

## 7. Charte Graphique

### Page Menorah
| Élément | Couleur | Notes |
|---------|---------|-------|
| Fond | `#FFFFFF` | Blanc pur |
| Menorah | `#EBD45C` | Or principal du SVG |
| Flammes allumées | `#FFD700` | Or vif + glow |
| Flammes éteintes | `#D4AF37` | Or mat, 20% opacité |
| Texte pourcentage | `#D4AF37` | Or |

### Pages Donors & Chart
| Élément | Couleur | Notes |
|---------|---------|-------|
| Fond | `#0a0a1a` → `#111827` | Dégradé |
| Texte principal | `#FFFFFF` 90% | Blanc |
| Accent | `#64ffda` | Turquoise |
| Accent secondaire | `#a78bfa` | Violet |
| Montants | `#ffd700` | Or |

---

## 8. Responsive Design

### Breakpoints
- **Desktop**: > 1200px - Layout complet
- **Tablet**: 768px - 1200px - Layout adapté
- **Mobile**: < 768px - Layout empilé

### Page Menorah
- Desktop: Menorah 80vh
- Mobile: Menorah 70vh, stats en bas

### Page Donors
- Desktop: Grille 4 colonnes
- Tablet: Grille 3 colonnes
- Mobile: Grille 1-2 colonnes

### Page Chart
- Desktop: Graphique pleine largeur
- Mobile: Graphique simplifié, stats empilées

---

## 9. Performance

### Optimisations SVG
- Simplifier les paths si possible
- Utiliser `will-change` pour les éléments animés
- Lazy loading pour les flammes

### Optimisations GSAP
- Utiliser `gsap.ticker` pour synchroniser avec le RAF
- Éviter les animations continues (utiliser des triggers)
- Cleanup des animations au démontage

---

## 10. Tests & Validation

### Critères d'acceptation
- [ ] SVG menorah s'affiche correctement sur fond blanc
- [ ] Caractères hébraïques lisibles et dorés
- [ ] 3 pages accessibles et fonctionnelles
- [ ] Animations GSAP fluides (60fps)
- [ ] Mise à jour en temps réel via Socket.IO
- [ ] Responsive sur tous les écrans
- [ ] Pas de régression sur `/admin`

---

## 11. Plan d'Implémentation

1. **Phase 1**: Baliser le SVG source en segments
2. **Phase 2**: Installer GSAP et créer composables
3. **Phase 3**: Créer `MenorahPage.vue`
4. **Phase 4**: Créer `DonorsPage.vue`
5. **Phase 5**: Créer `ChartPage.vue`
6. **Phase 6**: Mettre à jour le router
7. **Phase 7**: Tests et ajustements
