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
  const shekels = cents / 100;
  return shekels.toLocaleString('he-IL', {
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
        <span class="currency">₪</span>
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
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(212, 175, 55, 0.02) 100%);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 16px;
  padding: 16px 20px;
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
  filter: blur(40px);
}

.glow-1 {
  width: 120px;
  height: 120px;
  top: -30px;
  right: -30px;
  background: rgba(212, 175, 55, 0.15);
}

.glow-2 {
  width: 80px;
  height: 80px;
  bottom: -20px;
  left: -20px;
  background: rgba(212, 175, 55, 0.1);
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
  gap: 8px;
  margin-bottom: 8px;
}

.label-row svg {
  width: 16px;
  height: 16px;
  color: rgba(212, 175, 55, 0.6);
}

.label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(212, 175, 55, 0.8);
  text-transform: uppercase;
  letter-spacing: 2px;
}

.amount-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
}

.currency {
  font-size: 24px;
  font-weight: 600;
  color: rgba(212, 175, 55, 0.5);
  align-self: flex-start;
  margin-top: 4px;
}

.amount {
  font-size: 40px;
  font-weight: 800;
  font-family: var(--font-display);
  color: #D4AF37;
  text-shadow:
    0 0 15px rgba(212, 175, 55, 0.4),
    0 0 30px rgba(212, 175, 55, 0.2);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

/* Stats Row */
.stats-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(212, 175, 55, 0.15);
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.stat-value {
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.stat-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-divider {
  width: 1px;
  height: 24px;
  background: rgba(212, 175, 55, 0.2);
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
    padding: 14px 18px;
  }

  .amount {
    font-size: 32px;
  }

  .currency {
    font-size: 20px;
  }
}
</style>
