<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { useDonations, DEFAULT_DISPLAY_TEXTS } from '../../composables/useDonations';
import { getActiveThemePalette } from '../../theme/displayThemes';
import { animateValue, easeOutCubic } from './animations';

const { stats, config, formatAmount } = useDonations();

const displayTexts = computed(() => ({
  ...DEFAULT_DISPLAY_TEXTS,
  ...(config.value.displaySettings.texts ?? {})
}));
const textDirection = computed(() => config.value.displaySettings.textDirection ?? 'auto');

// Dynamic styles from config
const statsStyles = computed(() => {
  const settings = getActiveThemePalette(config.value.displaySettings);
  return {
    '--stats-text-color': settings.statsTextColor,
    '--chart-primary-color': settings.chartPrimaryColor,
    '--chart-secondary-color': settings.chartSecondaryColor
  };
});

const displayValue = ref(0);
const displayPercent = ref(0);
let cancelCounter: (() => void) | null = null;

// Comptage anime du total. Tween centralise dans animations.ts (easeOutCubic,
// 1000 ms) — meme courbe qu'avant, mais respecte desormais prefers-reduced-motion.
function animateCounter(target: number): void {
  cancelCounter?.();
  cancelCounter = animateValue({
    from: displayValue.value,
    to: target,
    duration: 1000,
    easing: easeOutCubic,
    onUpdate: (value) => { displayValue.value = value; }
  });
}

watch(() => stats.value.totalAmount, animateCounter, { immediate: true });
watch(() => stats.value.percentComplete, (v) => { displayPercent.value = v; }, { immediate: true });

onMounted(() => {
  displayValue.value = stats.value.totalAmount;
  displayPercent.value = stats.value.percentComplete;
});

onUnmounted(() => {
  cancelCounter?.();
});

function formatNumber(cents: number): string {
  return (cents / 100).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Barre remplie (D1, spec §3.2) : la donnee est une valeur unique, pas une serie
// temporelle — l'ancienne courbe de Bezier promettait un historique qui n'existe
// pas et restait illisible quelle que soit la geometrie (fleche <= 3 px pour une
// corde de 1200, mesure le 2026-07-27 avant remplacement, voir git log).
const normalizedProgress = computed(() => Math.max(0, Math.min(displayPercent.value, 100)) / 100);
const fillWidth = computed(() => `${(normalizedProgress.value * 100).toFixed(2)}%`);
const roundedPercent = computed(() => Math.round(displayPercent.value));
const barAriaLabel = computed(() => (
  `${displayPercent.value.toFixed(1)}% — ${displayTexts.value.goalLabel} ${formatAmount(config.value.goalAmount)}`
));
</script>

<template>
  <div
    class="stats-compact"
    :style="statsStyles"
    :dir="textDirection"
  >
    <!-- Main amount -->
    <div class="main-row">
      <div class="amount-block">
        <span class="currency">₪</span>
        <span class="amount">{{ formatNumber(displayValue) }}</span>
      </div>
      <div class="percent-block">
        <span class="percent">{{ displayPercent.toFixed(1) }}%</span>
      </div>
    </div>

    <!-- Barre d'objectif remplie (D1, spec §3.2) -->
    <div class="goal-bar">
      <div
        class="bar-track"
        role="progressbar"
        :aria-valuenow="roundedPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="barAriaLabel"
      >
        <div class="bar-fill" :style="{ width: fillWidth }"></div>
      </div>
      <div class="bar-labels">
        <span>0 ₪</span>
        <span :dir="textDirection">{{ displayTexts.goalLabel }} {{ formatAmount(config.goalAmount) }}</span>
      </div>
    </div>

    <!-- Info row -->
    <div class="info-row">
      <span class="info-item" :dir="textDirection">
        {{ stats.donationCount }} {{ stats.donationCount === 1 ? displayTexts.donationSingular : displayTexts.donationPlural }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.stats-compact {
  position: relative;
  overflow: hidden;
  background: var(--theme-surface, rgba(10, 10, 26, 0.72));
  border: 1px solid color-mix(in srgb, var(--chart-primary-color, #D4AF37) 25%, transparent);
  border-radius: var(--theme-radius, 14px);
  padding: 14px 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 16px 40px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(16px);
}

.stats-compact::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(110deg, color-mix(in srgb, var(--chart-primary-color) 8%, transparent), transparent 42%);
}

.main-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.amount-block {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.currency {
  font-size: 18px;
  font-weight: 600;
  color: color-mix(in srgb, var(--chart-primary-color, #D4AF37) 60%, transparent);
}

.amount {
  font-family: var(--theme-font-display, inherit);
  font-size: 34px;
  font-weight: 800;
  color: var(--chart-primary-color, #D4AF37);
  text-shadow: 0 0 18px color-mix(in srgb, var(--chart-primary-color, #D4AF37) 25%, transparent);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.percent-block {
  text-align: right;
}

.percent {
  font-family: var(--theme-font-display, inherit);
  font-size: 20px;
  font-weight: 700;
  color: var(--chart-primary-color, #D4AF37);
}

.goal-bar {
  position: relative;
  margin: 2px 0 7px;
}

.bar-track {
  position: relative;
  height: 16px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--stats-text-color) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--stats-text-color) 16%, transparent);
  overflow: hidden;
}

/* inset-inline-start : la barre part de la droite en RTL sans regle dediee. */
.bar-fill {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--chart-secondary-color), var(--chart-primary-color));
  box-shadow: 0 0 10px color-mix(in srgb, var(--chart-primary-color) 55%, transparent);
  transition: width 700ms cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  .bar-fill {
    transition: none;
  }
}

.bar-labels {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 5px;
  color: color-mix(in srgb, var(--stats-text-color) 58%, transparent);
  font-size: 11px;
  font-weight: 650;
}

.bar-labels span:last-child {
  color: color-mix(in srgb, var(--chart-primary-color) 82%, white 10%);
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  font-size: 12px;
  color: color-mix(in srgb, var(--stats-text-color, #FFFFFF) 50%, transparent);
}

.stats-compact[dir='rtl'] .info-row {
  justify-content: flex-end;
}

@media (max-height: 760px) {
  .stats-compact {
    padding-block: 10px;
  }

  .bar-track {
    height: 12px;
  }
}
</style>
