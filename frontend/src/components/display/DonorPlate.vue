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
  XL: 7200000,  // 72,000 ₪
  L: 3600000,   // 36,000 ₪
  M: 2600000,   // 26,000 ₪
};

// Déterminer la taille de la plaque selon le montant
const plaqueSize = computed(() => {
  const amount = props.donation.amount;
  if (amount >= THRESHOLDS.XL) return 'xl';
  if (amount >= THRESHOLDS.L) return 'l';
  if (amount >= THRESHOLDS.M) return 'm';
  return 's';
});

// Nom complet du donateur
const fullName = computed(() => {
  return `${props.donation.firstName} ${props.donation.lastName}`.toUpperCase();
});
</script>

<template>
  <div
    class="plaque"
    :class="[plaqueSize, { 'is-new': isNew }]"
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
/* Base plaque styles - Style doré fidèle à l'inspiration */
.plaque {
  position: relative;
  background: linear-gradient(145deg,
    #d4af37 0%,
    #f5d67b 15%,
    #c9a227 30%,
    #f5d67b 45%,
    #d4af37 60%,
    #b8960c 75%,
    #d4af37 90%,
    #f5d67b 100%);
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
  transform: translateY(-4px);
  box-shadow:
    0 8px 16px rgba(0, 0, 0, 0.4),
    0 16px 32px rgba(0, 0, 0, 0.3),
    inset 0 2px 4px rgba(255, 255, 255, 0.5),
    inset 0 -2px 4px rgba(0, 0, 0, 0.2),
    0 0 40px rgba(212, 175, 55, 0.25);
}

/* Bordure intérieure */
.plaque::before {
  content: '';
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  bottom: 8px;
  border: 2px solid rgba(139, 109, 26, 0.5);
  pointer-events: none;
}

.plaque-inner {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 10px;
}

.nom {
  font-family: 'Cinzel', serif;
  font-weight: 600;
  color: #3d2e06;
  letter-spacing: 2px;
  text-shadow:
    1px 1px 0 rgba(255, 255, 255, 0.3),
    -1px -1px 0 rgba(0, 0, 0, 0.1);
  margin-bottom: 4px;
  line-height: 1.2;
}

.montant {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  color: #4a3b10;
  line-height: 1.4;
}

/* ===================== */
/* TAILLE XL - Niveau 3  */
/* 72,000+ ₪            */
/* ===================== */
.plaque.xl {
  width: 100%;
  max-width: 550px;
  height: 140px;
  border-radius: 8px;
  padding: 24px 36px;
}

.plaque.xl::before {
  top: 14px;
  left: 14px;
  right: 14px;
  bottom: 14px;
  border-width: 3px;
  border-radius: 5px;
}

.plaque.xl .nom {
  font-size: 2rem;
  letter-spacing: 4px;
  margin-bottom: 10px;
}

.plaque.xl .montant {
  font-size: 1.4rem;
}

/* ===================== */
/* TAILLE L - Niveau 2   */
/* 36,000+ ₪            */
/* ===================== */
.plaque.l {
  width: 100%;
  max-width: 420px;
  height: 110px;
  border-radius: 6px;
  padding: 18px 28px;
}

.plaque.l::before {
  top: 12px;
  left: 12px;
  right: 12px;
  bottom: 12px;
  border-radius: 4px;
}

.plaque.l .nom {
  font-size: 1.5rem;
  letter-spacing: 3px;
  margin-bottom: 8px;
}

.plaque.l .montant {
  font-size: 1.2rem;
}

/* ===================== */
/* TAILLE M - Niveau 1   */
/* 26,000+ ₪            */
/* ===================== */
.plaque.m {
  width: 100%;
  max-width: 340px;
  height: 90px;
  border-radius: 5px;
  padding: 14px 24px;
}

.plaque.m::before {
  top: 10px;
  left: 10px;
  right: 10px;
  bottom: 10px;
  border-width: 2px;
  border-radius: 3px;
}

.plaque.m .nom {
  font-size: 1.25rem;
  letter-spacing: 2px;
  margin-bottom: 6px;
}

.plaque.m .montant {
  font-size: 1.05rem;
}

/* ===================== */
/* TAILLE S - Niveau 0   */
/* < 26,000 ₪           */
/* ===================== */
.plaque.s {
  width: 100%;
  max-width: 280px;
  height: 72px;
  border-radius: 4px;
  padding: 12px 18px;
}

.plaque.s::before {
  top: 8px;
  left: 8px;
  right: 8px;
  bottom: 8px;
  border-width: 1.5px;
  border-radius: 2px;
}

.plaque.s .nom {
  font-size: 1.1rem;
  letter-spacing: 1.5px;
  margin-bottom: 4px;
}

.plaque.s .montant {
  font-size: 0.95rem;
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
    rgba(255, 255, 255, 0.4) 50%,
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
  .plaque.xl {
    max-width: 100%;
    height: 100px;
  }

  .plaque.xl .nom {
    font-size: 1.2rem;
  }

  .plaque.l {
    max-width: 100%;
    height: 80px;
  }

  .plaque.m {
    max-width: 100%;
    height: 65px;
  }

  .plaque.s {
    max-width: 100%;
    height: 50px;
  }
}
</style>
