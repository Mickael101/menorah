<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useDonations } from '../../composables/useDonations';

const { stats, config, formatAmount } = useDonations();

const displayValue = ref(0);
const isAnimating = ref(false);
let animationFrame: number | null = null;

// Animate counter from current to target value
function animateCounter(target: number): void {
  const start = displayValue.value;
  const diff = target - start;
  const duration = 1200;
  const startTime = performance.now();
  isAnimating.value = true;

  function update(currentTime: number): void {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease-out-quart)
    const easeProgress = 1 - Math.pow(1 - progress, 4);

    displayValue.value = Math.round(start + diff * easeProgress);

    if (progress < 1) {
      animationFrame = requestAnimationFrame(update);
    } else {
      displayValue.value = target;
      isAnimating.value = false;
    }
  }

  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }

  animationFrame = requestAnimationFrame(update);
}

// Watch for changes in total amount
watch(() => stats.value.totalAmount, (newValue) => {
  animateCounter(newValue);
}, { immediate: true });

onMounted(() => {
  displayValue.value = stats.value.totalAmount;
});

onUnmounted(() => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }
});

function formatNumber(cents: number): string {
  const euros = cents / 100;
  return euros.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}
</script>

<template>
  <div class="total-counter" :class="{ animating: isAnimating }">
    <!-- Decorative elements -->
    <div class="counter-bg">
      <div class="glow-orb glow-1"></div>
      <div class="glow-orb glow-2"></div>
    </div>

    <div class="counter-content">
      <div class="label-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <span class="label">Total collecté</span>
      </div>

      <div class="amount-row">
        <span class="currency">€</span>
        <span class="amount">{{ formatNumber(displayValue) }}</span>
      </div>

      <div class="stats-row">
        <div class="stat">
          <span class="stat-value">{{ stats.donationCount }}</span>
          <span class="stat-label">don{{ stats.donationCount > 1 ? 's' : '' }}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat">
          <span class="stat-value">{{ formatAmount(config.goalAmount) }}</span>
          <span class="stat-label">objectif</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.total-counter {
  position: relative;
  background: linear-gradient(135deg, rgba(100, 255, 218, 0.08) 0%, rgba(100, 255, 218, 0.02) 100%);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(100, 255, 218, 0.15);
  border-radius: 24px;
  padding: 28px 32px;
  overflow: hidden;
}

/* Background Effects */
.counter-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
}

.glow-1 {
  width: 200px;
  height: 200px;
  top: -50px;
  right: -50px;
  background: rgba(100, 255, 218, 0.15);
}

.glow-2 {
  width: 150px;
  height: 150px;
  bottom: -30px;
  left: -30px;
  background: rgba(139, 92, 246, 0.1);
}

/* Content */
.counter-content {
  position: relative;
  z-index: 10;
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 16px;
}

.label-row svg {
  width: 20px;
  height: 20px;
  color: rgba(100, 255, 218, 0.6);
}

.label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(100, 255, 218, 0.8);
  text-transform: uppercase;
  letter-spacing: 3px;
}

.amount-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
}

.currency {
  font-size: 32px;
  font-weight: 600;
  color: rgba(100, 255, 218, 0.5);
  align-self: flex-start;
  margin-top: 8px;
}

.amount {
  font-size: 56px;
  font-weight: 800;
  font-family: var(--font-display);
  color: #64ffda;
  text-shadow:
    0 0 20px rgba(100, 255, 218, 0.4),
    0 0 40px rgba(100, 255, 218, 0.2);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

/* Stats Row */
.stats-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-divider {
  width: 1px;
  height: 30px;
  background: rgba(255, 255, 255, 0.1);
}

/* Animation State */
.total-counter.animating .amount {
  animation: value-pulse 0.6s ease-out;
}

@keyframes value-pulse {
  0% { transform: scale(1); }
  30% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

/* Responsive */
@media (max-width: 600px) {
  .total-counter {
    padding: 20px 24px;
  }

  .amount {
    font-size: 42px;
  }

  .currency {
    font-size: 24px;
  }
}
</style>
