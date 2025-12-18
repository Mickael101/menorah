<script setup lang="ts">
import { computed } from 'vue';
import { useDonations, type Donation } from '../../composables/useDonations';

const props = defineProps<{
  donation: Donation;
  isNew?: boolean;
}>();

const { config, formatAmount } = useDonations();

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
  return 'bronze';
});

// Dynamic plate styles from config
const plateStyles = computed(() => {
  const settings = config.value.displaySettings;
  return {
    '--plate-gold': settings.plateColorGold,
    '--plate-diamond': settings.plateColorDiamond,
    '--plate-bronze': settings.plateColorBronze,
    '--plate-text': settings.plateTextColor
  };
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
    :style="plateStyles"
  >
    <div class="plaque-inner">
      <div class="nom">{{ fullName }}</div>
      <div class="montant">{{ formatAmount(donation.amount) }}</div>
    </div>
    <div v-if="isNew" class="plaque-shine"></div>
  </div>
</template>

<style scoped>
/* ===================== */
/* PLAQUE - Optimisee ecran LED geant */
/* Pleine largeur, couleurs vives, police tres bold */
/* ===================== */
.plaque {
  position: relative;
  width: 100%;
  height: 90px;
  border-radius: 8px;
  padding: 15px 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* Layout horizontal: nom a gauche, montant a droite */
.plaque-inner {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.nom {
  font-family: 'Cinzel', 'Arial Black', sans-serif;
  font-weight: 900;
  font-size: 2.2rem;
  letter-spacing: 3px;
  line-height: 1.1;
  flex: 1;
  text-align: left;
}

.montant {
  font-family: 'Cinzel', 'Arial Black', sans-serif;
  font-weight: 900;
  font-size: 2rem;
  line-height: 1.1;
  text-align: right;
  margin-left: 30px;
  white-space: nowrap;
}

/* ===================== */
/* COULEUR OR - Niveau 3 */
/* 72,000+ ₪ - Fond or vif */
/* ===================== */
.plaque.gold {
  background: var(--plate-gold, #FFD700);
}

.plaque.gold .nom,
.plaque.gold .montant {
  color: var(--plate-text, #1a1400);
}

/* ===================== */
/* COULEUR DIAMANT - Niveau 2 */
/* 36,000+ ₪ - Fond argent brillant */
/* ===================== */
.plaque.diamond {
  background: var(--plate-diamond, #E8E8E8);
}

.plaque.diamond .nom,
.plaque.diamond .montant {
  color: var(--plate-text, #1a1a1a);
}

/* ===================== */
/* COULEUR BRONZE - Niveau 1 */
/* < 36,000 ₪ - Fond bronze vif */
/* ===================== */
.plaque.bronze {
  background: var(--plate-bronze, #CD7F32);
}

.plaque.bronze .nom,
.plaque.bronze .montant {
  color: var(--plate-text, #1a0d00);
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
    rgba(255, 255, 255, 0.6) 50%,
    transparent 70%
  );
  animation: shine 1.5s ease-out;
  pointer-events: none;
}

@keyframes plaque-entrance {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }
  50% {
    transform: scale(1.02);
  }
  100% {
    opacity: 1;
    transform: scale(1);
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

/* Ecrans moyens */
@media (max-width: 1200px) {
  .plaque {
    height: 80px;
    padding: 12px 25px;
  }

  .nom {
    font-size: 1.8rem;
  }

  .montant {
    font-size: 1.6rem;
  }
}

/* Ecrans LED geants (4K+) */
@media (min-width: 1920px) {
  .plaque {
    height: 110px;
    padding: 20px 40px;
  }

  .nom {
    font-size: 2.8rem;
    letter-spacing: 4px;
  }

  .montant {
    font-size: 2.5rem;
  }
}

/* Ecrans tres larges (8K) */
@media (min-width: 3840px) {
  .plaque {
    height: 150px;
    padding: 30px 60px;
  }

  .nom {
    font-size: 4rem;
    letter-spacing: 6px;
  }

  .montant {
    font-size: 3.5rem;
  }
}
</style>
