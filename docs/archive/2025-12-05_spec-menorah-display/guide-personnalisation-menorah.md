# Guide de Personnalisation - Animation Menorah

## Fichier Principal
**`frontend/src/pages/MenorahAlt2.vue`**

Ce fichier contient toute la logique d'animation de la menorah. Pour créer des variantes, copiez ce fichier et modifiez les paramètres ci-dessous.

---

## PARAMÈTRES À MODIFIER

### 1. VISIBILITÉ DES PARTIES NON ÉCLAIRÉES (ligne ~124-130)

```javascript
// Unlit groups - MODIFIER CES VALEURS
gsap.to(group, {
  opacity: 0.35,        // ← VISIBILITÉ (0.2 = sombre, 0.5 = bien visible)
  scale: 0.98,          // ← TAILLE (0.95 = plus petit, 1 = normal)
  filter: 'brightness(0.8)',  // ← LUMINOSITÉ (0.5 = sombre, 1 = normal)
  duration: 0.6,        // ← DURÉE TRANSITION
  ease: 'power2.in'
});
```

### 2. PARTIES ÉCLAIRÉES (ligne ~115-121)

```javascript
// Lit groups - MODIFIER CES VALEURS
gsap.to(group, {
  opacity: 1,
  scale: 1,
  filter: 'brightness(1.4)',  // ← INTENSITÉ LUMIÈRE (1.2 = doux, 2 = intense)
  duration: 0.6,
  ease: 'power2.out'
});
```

### 3. BRAISES / PARTICULES (ligne ~200-218)

```javascript
// Dans startEmberGeneration()
emberInterval = window.setInterval(() => {
  if (Math.random() < 0.3) {  // ← FRÉQUENCE (0.1 = rare, 0.8 = beaucoup)
    const ember = {
      id: nextEmberId++,
      x: 45 + Math.random() * 10,  // ← POSITION X (40-60 = centré)
      y: 10                         // ← POSITION Y départ
    };
    // ...
  }
}, 500);  // ← INTERVALLE en ms (200 = rapide, 1000 = lent)
```

### 4. BURST DE BRAISES SUR DONATION (ligne ~221-240)

```javascript
function generateEmberBurst(): void {
  for (let i = 0; i < 8; i++) {  // ← NOMBRE DE BRAISES (5 = peu, 20 = beaucoup)
    setTimeout(() => {
      const ember = {
        x: 40 + Math.random() * 20,  // ← LARGEUR DISPERSION
        // ...
      };
    }, i * 80);  // ← DÉLAI ENTRE CHAQUE (50 = rapide, 150 = lent)
  }
}
```

### 5. HALO PULSANT (CSS ligne ~319-333)

```css
.pulsing-halo {
  width: 800px;       /* ← TAILLE DU HALO */
  height: 800px;
  background: radial-gradient(
    circle,
    rgba(255, 152, 0, 0.12) 0%,   /* ← COULEUR CENTRE (orange) */
    rgba(255, 87, 34, 0.08) 30%,  /* ← COULEUR MILIEU */
    transparent 70%
  );
  animation: pulseHalo 4s ease-in-out infinite;  /* ← DURÉE PULSE */
  filter: blur(60px);  /* ← FLOU */
}
```

### 6. ANIMATION DU HALO (CSS ligne ~335-344)

```css
@keyframes pulseHalo {
  0%, 100% {
    opacity: 0.4;      /* ← OPACITÉ MIN */
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.7;      /* ← OPACITÉ MAX */
    transform: translate(-50%, -50%) scale(1.15);  /* ← ÉCHELLE MAX */
  }
}
```

### 7. STYLE DES BRAISES (CSS ligne ~354-361)

```css
.ember {
  width: 3px;          /* ← TAILLE */
  height: 3px;
  background: radial-gradient(
    circle,
    #FFD54F 0%,        /* ← COULEUR CENTRE (jaune) */
    #FF9800 50%,       /* ← COULEUR MILIEU (orange) */
    #FF5722 100%       /* ← COULEUR BORD (rouge) */
  );
  box-shadow: 0 0 6px #FF9800, 0 0 12px rgba(255, 152, 0, 0.5);  /* ← LUEUR */
}
```

### 8. ANIMATION DES BRAISES (CSS ligne ~364-382)

```css
@keyframes riseEmber {
  100% {
    transform: translateY(-70vh) translateX(...) scale(0.3);  /* ← HAUTEUR MONTÉE */
    opacity: 0;
    filter: blur(2px);  /* ← FLOU FINAL */
  }
}
```

### 9. FOND CHAUD (CSS ligne ~307-316)

```css
.warm-glow {
  background: radial-gradient(
    ellipse 50% 50% at 50% 50%,
    rgba(255, 87, 34, 0.06) 0%,   /* ← INTENSITÉ CENTRE (0.06 = subtil, 0.2 = fort) */
    rgba(255, 152, 0, 0.03) 30%,  /* ← INTENSITÉ MILIEU */
    transparent 70%
  );
}
```

### 10. FLASH NOUVELLE DONATION (ligne ~143-150)

```javascript
gsap.fromTo(svg,
  { filter: 'brightness(2)' },  // ← INTENSITÉ FLASH (1.5 = doux, 3 = aveuglant)
  {
    filter: 'brightness(1)',
    duration: 0.8,              // ← DURÉE
    ease: 'power2.out'
  }
);
```

### 11. SHAKE NOUVELLE DONATION (ligne ~153-159)

```javascript
gsap.from(svg, {
  x: -10,              // ← AMPLITUDE (-5 = léger, -20 = fort)
  duration: 0.2,       // ← VITESSE
  yoyo: true,
  repeat: 3            // ← NOMBRE DE SECOUSSES
});
```

---

## CRÉER UNE NOUVELLE VARIANTE

1. **Copier le fichier**
   ```bash
   cp frontend/src/pages/MenorahAlt2.vue frontend/src/pages/MenorahVarianteX.vue
   ```

2. **Modifier le router** (`frontend/src/router.ts`)
   ```typescript
   import MenorahVarianteX from './pages/MenorahVarianteX.vue';

   // Dans routes:
   {
     path: '/menorah-x',
     name: 'menorah-x',
     component: MenorahVarianteX
   }
   ```

3. **Personnaliser les paramètres** selon le guide ci-dessus

---

## EXEMPLES DE THÈMES

### Thème "Braises Intenses"
- `opacity: 0.4` pour parties non éclairées
- `brightness(1.6)` pour parties éclairées
- Fréquence braises: `0.6` au lieu de `0.3`
- Nombre burst: `15` au lieu de `8`
- Couleurs: plus de rouge (`#FF5722`)

### Thème "Flamme Douce"
- `opacity: 0.35`
- `brightness(1.3)`
- Fréquence braises: `0.15`
- Durée pulse halo: `6s`
- Couleurs: dorées (`#D4AF37`, `#FFD700`)

### Thème "Lumière Vivante"
- Ajouter scintillement individuel par groupe allumé
- Braises avec trajectoires sinusoïdales
- Halo avec taille variable aléatoire

---

## COULEURS UTILES

| Usage | Couleur | Code |
|-------|---------|------|
| Or SVG original | Doré | `#EBD45C` |
| Or luxe | Or foncé | `#D4AF37` |
| Or vif | Jaune or | `#FFD700` |
| Flamme jaune | Jaune | `#FFD54F` |
| Flamme orange | Orange | `#FF9800` |
| Flamme rouge | Rouge orange | `#FF5722` |
| Braise rouge | Rouge | `#E64A19` |
