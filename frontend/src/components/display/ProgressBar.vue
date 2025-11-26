<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useDonations } from '../../composables/useDonations';

const { stats, config, formatAmount } = useDonations();

const displayPercent = ref(0);

const progressWidth = computed(() => {
  return `${Math.min(displayPercent.value, 100)}%`;
});

// Animate progress changes
watch(() => stats.value.percentComplete, (newValue, oldValue) => {
  const start = displayPercent.value;
  const end = newValue;
  const duration = 1000;
  const startTime = performance.now();

  function animate(currentTime: number): void {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    displayPercent.value = start + (end - start) * easeProgress;

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}, { immediate: true });

// Get milestone markers
const milestones = computed(() => [25, 50, 75, 100]);
</script>

<template>
  <div class="progress-container">
    <!-- Progress Info -->
    <div class="progress-info">
      <div class="progress-percent">
        <span class="percent-value">{{ displayPercent.toFixed(1) }}</span>
        <span class="percent-sign">%</span>
      </div>
      <div class="progress-label">de l'objectif atteint</div>
    </div>

    <!-- Progress Track -->
    <div class="progress-track">
      <!-- Milestones -->
      <div class="milestones">
        <div
          v-for="milestone in milestones"
          :key="milestone"
          class="milestone"
          :class="{ reached: displayPercent >= milestone }"
          :style="{ left: `${milestone}%` }"
        >
          <div class="milestone-line"></div>
          <span class="milestone-label">{{ milestone }}%</span>
        </div>
      </div>

      <!-- Fill -->
      <div class="progress-fill" :style="{ width: progressWidth }">
        <div class="fill-glow"></div>
        <div class="fill-shimmer"></div>
      </div>

      <!-- Indicator -->
      <div class="progress-indicator" :style="{ left: progressWidth }">
        <div class="indicator-dot"></div>
      </div>
    </div>

    <!-- Goal Display -->
    <div class="goal-info">
      <span class="current-amount">{{ formatAmount(stats.totalAmount) }}</span>
      <span class="goal-separator">/</span>
      <span class="goal-amount">{{ formatAmount(config.goalAmount) }}</span>
    </div>
  </div>
</template>

<style scoped>
.progress-container {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.02) 100%);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: 20px;
  padding: 24px 28px;
}

/* Progress Info */
.progress-info {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 20px;
}

.progress-percent {
  display: flex;
  align-items: baseline;
}

.percent-value {
  font-size: 36px;
  font-weight: 800;
  font-family: var(--font-display);
  color: #a78bfa;
  text-shadow: 0 0 20px rgba(167, 139, 250, 0.4);
  font-variant-numeric: tabular-nums;
}

.percent-sign {
  font-size: 20px;
  font-weight: 600;
  color: rgba(167, 139, 250, 0.6);
  margin-left: 2px;
}

.progress-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}

/* Progress Track */
.progress-track {
  position: relative;
  height: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  overflow: visible;
}

/* Milestones */
.milestones {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.milestone {
  position: absolute;
  top: 100%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.milestone-line {
  width: 1px;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  transition: background 0.3s ease;
}

.milestone.reached .milestone-line {
  background: rgba(167, 139, 250, 0.5);
}

.milestone-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 4px;
  transition: color 0.3s ease;
}

.milestone.reached .milestone-label {
  color: rgba(167, 139, 250, 0.8);
}

/* Progress Fill */
.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #8b5cf6 0%, #a78bfa 50%, #c4b5fd 100%);
  border-radius: 8px;
  transition: width 0.3s ease-out;
  overflow: hidden;
  min-width: 0;
}

.fill-glow {
  position: absolute;
  top: 0;
  right: 0;
  width: 60px;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4));
  animation: glow-pulse 2s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

.fill-shimmer {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.2) 50%,
    transparent 100%
  );
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}

/* Progress Indicator */
.progress-indicator {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  transition: left 0.3s ease-out;
  z-index: 10;
}

.indicator-dot {
  width: 24px;
  height: 24px;
  background: white;
  border-radius: 50%;
  box-shadow:
    0 0 0 4px rgba(139, 92, 246, 0.3),
    0 0 20px rgba(139, 92, 246, 0.5);
}

/* Goal Info */
.goal-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.current-amount {
  font-size: 16px;
  font-weight: 700;
  color: #a78bfa;
}

.goal-separator {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.3);
}

.goal-amount {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
}

/* Responsive */
@media (max-width: 600px) {
  .progress-container {
    padding: 20px;
  }

  .percent-value {
    font-size: 28px;
  }

  .milestone-label {
    display: none;
  }
}
</style>
