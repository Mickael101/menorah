<script setup lang="ts">
import { computed } from 'vue';
import { useDonations, type Donation } from '../../composables/useDonations';
import { getActiveThemePalette } from '../../theme/displayThemes';

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
  const settings = getActiveThemePalette(config.value.displaySettings);
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

const nameSizeClass = computed(() => {
  if (fullName.value.length > 34) return 'extra-compact';
  if (fullName.value.length > 23) return 'compact';
  return '';
});
</script>

<template>
  <div
    class="plaque"
    :class="[plaqueColor, { 'is-new': isNew }]"
    :style="plateStyles"
  >
    <div class="plaque-inner">
      <div class="nom" :class="nameSizeClass">{{ fullName }}</div>
      <div class="montant">{{ formatAmount(donation.amount) }}</div>
    </div>
    <div v-if="isNew" class="plaque-shine"></div>
  </div>
</template>

<style scoped>
.plaque {
  --plate-accent: var(--plate-bronze, #B67846);
  position: relative;
  width: 100%;
  min-height: clamp(70px, 9.5vh, 106px);
  border: 1px solid var(--theme-plate-border, rgba(255, 255, 255, 0.12));
  border-left: clamp(4px, 0.4vw, 7px) solid var(--plate-accent);
  border-radius: var(--theme-radius, 16px);
  padding: clamp(12px, 1.5vh, 20px) clamp(18px, 2vw, 38px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  isolation: isolate;
  background: var(--theme-plate-surface, linear-gradient(135deg, #202333, #0c0e1c));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.055),
    0 10px 28px rgba(0, 0, 0, 0.2),
    0 0 26px color-mix(in srgb, var(--plate-accent) 7%, transparent);
  transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
}

.plaque::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    linear-gradient(105deg, color-mix(in srgb, var(--plate-accent) 9%, transparent), transparent 35%),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.035), transparent 42%);
}

.plaque::after {
  content: '';
  position: absolute;
  top: 18%;
  bottom: 18%;
  left: clamp(9px, 0.7vw, 14px);
  width: 1px;
  background: color-mix(in srgb, var(--plate-accent) 48%, transparent);
}

/* Layout horizontal: nom a gauche, montant a droite */
.plaque-inner {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: clamp(12px, 2vw, 32px);
}

.nom {
  font-family: var(--theme-font-display, 'Poppins', sans-serif);
  font-weight: 750;
  font-size: clamp(1.15rem, 2vw, 2.55rem);
  letter-spacing: clamp(0.5px, 0.12vw, 2px);
  line-height: 1.1;
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow: hidden;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.nom.compact {
  font-size: clamp(1.05rem, 1.85vw, 2.35rem);
}

.nom.extra-compact {
  font-size: clamp(0.95rem, 1.6vw, 2rem);
}

.montant {
  font-family: var(--theme-font-display, 'Poppins', sans-serif);
  font-weight: 800;
  font-size: clamp(1rem, 1.55vw, 2.15rem);
  line-height: 1.1;
  text-align: right;
  flex-shrink: 0;
  white-space: nowrap;
}

.plaque.gold {
  --plate-accent: var(--plate-gold, #E4BE63);
}

.plaque.diamond {
  --plate-accent: var(--plate-diamond, #C8D4E3);
}

.plaque.bronze {
  --plate-accent: var(--plate-bronze, #B67846);
}

.plaque .nom {
  color: var(--plate-text, #F8F3E8);
}

.plaque .montant {
  color: var(--plate-accent);
  text-shadow: 0 0 18px color-mix(in srgb, var(--plate-accent) 18%, transparent);
}

/* ===================== */
/* Animation nouveau don */
/* ===================== */
.plaque.is-new {
  animation: plaque-entrance 0.72s cubic-bezier(0.16, 1, 0.3, 1);
  border-color: color-mix(in srgb, var(--plate-accent) 58%, transparent);
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
    rgba(255, 255, 255, 0.38) 50%,
    transparent 70%
  );
  animation: shine 1.2s ease-out;
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
    min-height: clamp(64px, 8vh, 88px);
  }
}

/* Ecrans LED geants (4K+) */
@media (min-width: 1920px) {
  .plaque {
    min-height: 110px;
    padding: 20px 40px;
  }

  .nom {
    font-size: 2.8rem;
    letter-spacing: 4px;
  }

  .nom.compact { font-size: 2.35rem; }
  .nom.extra-compact { font-size: 2rem; }

  .montant {
    font-size: 2.5rem;
  }
}

/* Ecrans tres larges (8K) */
@media (min-width: 3840px) {
  .plaque {
    min-height: 150px;
    padding: 30px 60px;
  }

  .nom {
    font-size: 4rem;
    letter-spacing: 6px;
  }

  .nom.compact { font-size: 3.3rem; }
  .nom.extra-compact { font-size: 2.8rem; }

  .montant {
    font-size: 3.5rem;
  }
}
</style>
