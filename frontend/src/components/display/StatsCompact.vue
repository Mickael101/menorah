<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { useDonations } from '../../composables/useDonations';

const { stats, config, formatAmount } = useDonations();

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

const progressWidth = computed(() => `${Math.min(displayPercent.value, 100)}%`);
</script>

<template>
  <div class="stats-compact">
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

    <!-- Progress bar -->
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: progressWidth }"></div>
    </div>

    <!-- Info row -->
    <div class="info-row">
      <span class="info-item">{{ stats.donationCount }} don{{ stats.donationCount > 1 ? 's' : '' }}</span>
      <span class="separator">•</span>
      <span class="info-item goal">Objectif {{ formatAmount(config.goalAmount) }}</span>
    </div>
  </div>
</template>

<style scoped>
.stats-compact {
  background: rgba(10, 10, 26, 0.6);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 12px;
  padding: 12px 16px;
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
  color: rgba(212, 175, 55, 0.6);
}

.amount {
  font-size: 32px;
  font-weight: 800;
  color: #D4AF37;
  text-shadow: 0 0 15px rgba(212, 175, 55, 0.4);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.percent-block {
  text-align: right;
}

.percent {
  font-size: 20px;
  font-weight: 700;
  color: #D4AF37;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #a67c00, #D4AF37, #ffd700);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.separator {
  color: rgba(212, 175, 55, 0.3);
}

.info-item.goal {
  color: rgba(212, 175, 55, 0.7);
}
</style>
