<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { useDonations, DEFAULT_DISPLAY_TEXTS } from '../../composables/useDonations';
import { getActiveThemePalette } from '../../theme/displayThemes';

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
let animationFrame: number | null = null;

// Animate counter
function animateCounter(target: number): void {
  const start = displayValue.value;
  const diff = target - start;
  const duration = 1000;
  const startTime = performance.now();

  function update(currentTime: number): void {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    displayValue.value = Math.round(start + diff * ease);
    if (progress < 1) {
      animationFrame = requestAnimationFrame(update);
    }
  }
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(update);
}

watch(() => stats.value.totalAmount, animateCounter, { immediate: true });
watch(() => stats.value.percentComplete, (v) => { displayPercent.value = v; }, { immediate: true });

onMounted(() => {
  displayValue.value = stats.value.totalAmount;
  displayPercent.value = stats.value.percentComplete;
});

onUnmounted(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
});

function formatNumber(cents: number): string {
  return (cents / 100).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const normalizedProgress = computed(() => Math.max(0, Math.min(displayPercent.value, 100)) / 100);
const curveEnd = computed(() => {
  const progress = normalizedProgress.value;
  return {
    x: 14 + (612 * progress),
    y: 70 - (52 * progress)
  };
});
const curvePath = computed(() => {
  const delta = curveEnd.value.x - 14;
  return `M 14 70 C ${14 + delta * 0.28} 66, ${14 + delta * 0.66} ${curveEnd.value.y + 10}, ${curveEnd.value.x} ${curveEnd.value.y}`;
});
const curveAreaPath = computed(() => `${curvePath.value} L ${curveEnd.value.x} 76 L 14 76 Z`);
const curveAriaLabel = computed(() => (
  `${displayPercent.value.toFixed(1)}% — ${displayTexts.value.goalLabel} ${formatAmount(config.value.goalAmount)}`
));
</script>

<template>
  <div class="stats-compact" :style="statsStyles" :dir="textDirection">
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

    <!-- Goal curve -->
    <div class="goal-curve">
      <svg
        class="curve-chart"
        viewBox="0 0 640 88"
        preserveAspectRatio="none"
        role="img"
        :aria-label="curveAriaLabel"
      >
        <defs>
          <linearGradient id="goalCurveLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="var(--chart-secondary-color)" />
            <stop offset="1" stop-color="var(--chart-primary-color)" />
          </linearGradient>
          <linearGradient id="goalCurveArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--chart-primary-color)" stop-opacity="0.28" />
            <stop offset="1" stop-color="var(--chart-primary-color)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path class="curve-guide" d="M 14 70 H 626" />
        <path class="curve-guide curve-guide-mid" d="M 14 44 H 626" />
        <path class="curve-area" :d="curveAreaPath" />
        <path class="curve-line" :d="curvePath" />
        <circle class="curve-point-glow" :cx="curveEnd.x" :cy="curveEnd.y" r="8" />
        <circle class="curve-point" :cx="curveEnd.x" :cy="curveEnd.y" r="4" />
        <line class="goal-marker" x1="626" y1="12" x2="626" y2="76" />
      </svg>
      <div class="curve-labels">
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

.goal-curve {
  position: relative;
  margin: -2px 0 7px;
}

.curve-chart {
  display: block;
  width: 100%;
  height: clamp(62px, 7.2vh, 86px);
  overflow: visible;
}

.curve-guide {
  fill: none;
  stroke: color-mix(in srgb, var(--stats-text-color) 13%, transparent);
  stroke-width: 1;
  stroke-dasharray: 4 8;
}

.curve-guide-mid {
  opacity: 0.55;
}

.curve-area {
  fill: url(#goalCurveArea);
  transition: d 700ms cubic-bezier(0.16, 1, 0.3, 1);
}

.curve-line {
  fill: none;
  stroke: url(#goalCurveLine);
  stroke-width: 4;
  stroke-linecap: round;
  filter: drop-shadow(0 0 7px color-mix(in srgb, var(--chart-primary-color) 60%, transparent));
  transition: d 700ms cubic-bezier(0.16, 1, 0.3, 1);
}

.curve-point-glow {
  fill: color-mix(in srgb, var(--chart-primary-color) 20%, transparent);
  transition: cx 700ms cubic-bezier(0.16, 1, 0.3, 1), cy 700ms cubic-bezier(0.16, 1, 0.3, 1);
}

.curve-point {
  fill: var(--chart-primary-color);
  stroke: var(--stats-text-color);
  stroke-width: 1.5;
  transition: cx 700ms cubic-bezier(0.16, 1, 0.3, 1), cy 700ms cubic-bezier(0.16, 1, 0.3, 1);
}

.goal-marker {
  stroke: color-mix(in srgb, var(--chart-primary-color) 48%, transparent);
  stroke-width: 2;
  stroke-dasharray: 3 5;
}

.curve-labels {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: -5px;
  color: color-mix(in srgb, var(--stats-text-color) 58%, transparent);
  font-size: 11px;
  font-weight: 650;
}

.curve-labels span:last-child {
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

  .curve-chart {
    height: 54px;
  }
}
</style>
