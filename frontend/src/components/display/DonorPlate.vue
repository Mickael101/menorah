<script setup lang="ts">
import { computed } from 'vue';
import { useDonations, type Donation } from '../../composables/useDonations';

const props = defineProps<{
  donation: Donation;
  isNew?: boolean;
}>();

const { formatAmount } = useDonations();

// Seuils en centimes (shekels * 100)
const THRESHOLDS = {
  GOLD: 7200000,     // 72,000 ₪ - Or
  DIAMOND: 3600000,  // 36,000 ₪ - Diamant
  BRONZE: 2600000,   // 26,000 ₪ - Bronze
};

// Déterminer la couleur de la plaque selon le montant (3 niveaux)
const plaqueColor = computed(() => {
  const amount = props.donation.amount;
  if (amount >= THRESHOLDS.GOLD) return 'gold';
  if (amount >= THRESHOLDS.DIAMOND) return 'diamond';
  if (amount >= THRESHOLDS.BRONZE) return 'bronze';
  return 'bronze'; // Default to bronze for smaller donations
});

// Nom complet du donateur
const fullName = computed(() => {
  return `${props.donation.firstName} ${props.donation.lastName}`.toUpperCase();
});
</script>

<template>
  <div
    class="plaque"
    :class="[plaqueColor, { 'is-new': isNew }]"
  >
    <div class="plaque-inner">
      <div class="nom">{{ fullName }}</div>
      <div class="montant">{{ formatAmount(donation.amount) }}</div>
    </div>
    <!-- Effet de brillance pour les nouveaux dons -->
    <div v-if="isNew" class="plaque-shine"></div>
  </div>
</template>

<style scoped>
/* ===================== */
/* Base plaque - Taille unique */
/* ===================== */
.plaque {
  position: relative;
  width: 100%;
  max-width: 320px;
  height: 70px;
  border-radius: 6px;
  padding: 12px 20px;
  box-shadow:
    0 4px 8px rgba(0, 0, 0, 0.4),
    0 8px 16px rgba(0, 0, 0, 0.3),
    inset 0 2px 4px rgba(255, 255, 255, 0.4),
    inset 0 -2px 4px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.plaque:hover {
  transform: translateY(-3px);
  box-shadow:
    0 8px 16px rgba(0, 0, 0, 0.4),
    0 16px 32px rgba(0, 0, 0, 0.3),
    inset 0 2px 4px rgba(255, 255, 255, 0.5),
    inset 0 -2px 4px rgba(0, 0, 0, 0.2);
}

/* Bordure intérieure */
.plaque::before {
  content: '';
  position: absolute;
  top: 6px;
  left: 6px;
  right: 6px;
  bottom: 6px;
  border: 2px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  pointer-events: none;
}

/* Layout horizontal: nom à gauche, montant à droite */
.plaque-inner {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 8px;
}

.nom {
  font-family: 'Cinzel', serif;
  font-weight: 800;
  font-size: 1.3rem;
  letter-spacing: 1.5px;
  text-shadow:
    1px 1px 0 rgba(255, 255, 255, 0.3),
    -1px -1px 0 rgba(0, 0, 0, 0.1);
  line-height: 1.2;
  flex: 1;
  text-align: left;
}

.montant {
  font-family: 'Cinzel', serif;
  font-weight: 800;
  font-size: 1.2rem;
  line-height: 1.4;
  text-align: right;
  margin-left: 15px;
  white-space: nowrap;
}

/* ===================== */
/* COULEUR OR - Niveau 3 */
/* 72,000+ ₪             */
/* ===================== */
.plaque.gold {
  background: linear-gradient(145deg,
    #d4af37 0%,
    #f5d67b 15%,
    #c9a227 30%,
    #f5d67b 45%,
    #d4af37 60%,
    #b8960c 75%,
    #d4af37 90%,
    #f5d67b 100%);
}

.plaque.gold::before {
  border-color: rgba(139, 109, 26, 0.5);
}

.plaque.gold .nom,
.plaque.gold .montant {
  color: #3d2e06;
}

.plaque.gold:hover {
  box-shadow:
    0 8px 16px rgba(0, 0, 0, 0.4),
    0 16px 32px rgba(0, 0, 0, 0.3),
    inset 0 2px 4px rgba(255, 255, 255, 0.5),
    inset 0 -2px 4px rgba(0, 0, 0, 0.2),
    0 0 40px rgba(212, 175, 55, 0.3);
}

/* ===================== */
/* COULEUR DIAMANT - Niveau 2 */
/* 36,000+ ₪             */
/* ===================== */
.plaque.diamond {
  background: linear-gradient(145deg,
    #e8e8e8 0%,
    #ffffff 15%,
    #d0d0d0 30%,
    #ffffff 45%,
    #e8e8e8 60%,
    #c0c0c0 75%,
    #e8e8e8 90%,
    #ffffff 100%);
}

.plaque.diamond::before {
  border-color: rgba(150, 150, 150, 0.5);
}

.plaque.diamond .nom,
.plaque.diamond .montant {
  color: #2a2a2a;
}

.plaque.diamond:hover {
  box-shadow:
    0 8px 16px rgba(0, 0, 0, 0.4),
    0 16px 32px rgba(0, 0, 0, 0.3),
    inset 0 2px 4px rgba(255, 255, 255, 0.8),
    inset 0 -2px 4px rgba(0, 0, 0, 0.2),
    0 0 40px rgba(200, 200, 255, 0.4);
}

/* ===================== */
/* COULEUR BRONZE - Niveau 1 */
/* < 36,000 ₪            */
/* ===================== */
.plaque.bronze {
  background: linear-gradient(145deg,
    #cd7f32 0%,
    #e6a855 15%,
    #b87333 30%,
    #e6a855 45%,
    #cd7f32 60%,
    #8b5a2b 75%,
    #cd7f32 90%,
    #e6a855 100%);
}

.plaque.bronze::before {
  border-color: rgba(100, 60, 30, 0.5);
}

.plaque.bronze .nom,
.plaque.bronze .montant {
  color: #3d2810;
}

.plaque.bronze:hover {
  box-shadow:
    0 8px 16px rgba(0, 0, 0, 0.4),
    0 16px 32px rgba(0, 0, 0, 0.3),
    inset 0 2px 4px rgba(255, 255, 255, 0.5),
    inset 0 -2px 4px rgba(0, 0, 0, 0.2),
    0 0 40px rgba(205, 127, 50, 0.3);
}

/* ===================== */
/* Animation nouveau don */
/* ===================== */
.plaque.is-new {
  animation: plaque-entrance 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.plaque-shine {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    45deg,
    transparent 30%,
    rgba(255, 255, 255, 0.5) 50%,
    transparent 70%
  );
  animation: shine 1.5s ease-out;
  pointer-events: none;
}

@keyframes plaque-entrance {
  0% {
    opacity: 0;
    transform: scale(0.8) rotateX(-15deg);
  }
  50% {
    transform: scale(1.05) rotateX(5deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotateX(0);
  }
}

@keyframes shine {
  0% {
    transform: translateX(-100%) rotate(45deg);
  }
  100% {
    transform: translateX(100%) rotate(45deg);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .plaque {
    max-width: 100%;
    height: 60px;
  }

  .nom {
    font-size: 1.1rem;
  }

  .montant {
    font-size: 1rem;
  }
}

/* Large screens */
@media (min-width: 1920px) {
  .plaque {
    max-width: 380px;
    height: 80px;
  }

  .nom {
    font-size: 1.5rem;
  }

  .montant {
    font-size: 1.4rem;
  }
}
</style>
