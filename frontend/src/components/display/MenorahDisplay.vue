<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useDonations } from '../../composables/useDonations';
import { useSocket } from '../../composables/useSocket';

const { stats, fetchDonations, fetchConfig, handleDonationNew, handleDonationUpdated, handleDonationDeleted, handleConfigUpdated } = useDonations();
const { on } = useSocket();

const svgContainer = ref<HTMLDivElement | null>(null);
const svgContent = ref<string>('');

// Load SVG content
onMounted(async () => {
  try {
    const response = await fetch('/assets/menorah.svg');
    svgContent.value = await response.text();
  } catch (error) {
    console.error('Failed to load menorah SVG:', error);
  }

  // Load initial data
  await Promise.all([fetchDonations(), fetchConfig()]);

  // Listen for real-time events
  on('donation:new', (data: any) => {
    handleDonationNew(data.donation, data.stats);
  });

  on('donation:updated', (data: any) => {
    handleDonationUpdated(data.donation, data.stats);
  });

  on('donation:deleted', (data: any) => {
    handleDonationDeleted(data.donationId, data.stats);
  });

  on('config:updated', (data: any) => {
    handleConfigUpdated(data.config, data.stats);
  });
});

// Update segment illumination when stats change
watch(() => stats.value.litSegments, (litSegments) => {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Get all segments
  const segments = svg.querySelectorAll('.menorah-segment');

  segments.forEach((segment) => {
    const id = segment.getAttribute('id');
    if (id && litSegments.includes(id)) {
      segment.classList.add('lit');
      segment.classList.remove('unlit');
    } else {
      segment.classList.add('unlit');
      segment.classList.remove('lit');
    }
  });
}, { immediate: true });
</script>

<template>
  <div class="menorah-display">
    <div
      ref="svgContainer"
      class="menorah-svg"
      v-html="svgContent"
    ></div>
    <div class="menorah-info">
      <span class="percent">{{ stats.percentComplete.toFixed(0) }}%</span>
    </div>
  </div>
</template>

<style scoped>
.menorah-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.menorah-svg {
  width: 100%;
  max-width: 500px;
  height: auto;
}

.menorah-svg :deep(svg) {
  width: 100%;
  height: auto;
}

/* Unlit segments - dark gray */
.menorah-svg :deep(.menorah-segment) {
  color: #3a3a3a;
  transition: color 1s ease-out, filter 1s ease-out;
  will-change: color, filter;
}

.menorah-svg :deep(.menorah-segment.unlit) {
  color: #3a3a3a;
  filter: none;
}

/* Lit segments - golden glow */
.menorah-svg :deep(.menorah-segment.lit) {
  color: #ffd700;
  filter: drop-shadow(0 0 10px #ffd700) drop-shadow(0 0 20px #ff8c00);
}

.menorah-info {
  margin-top: 20px;
  text-align: center;
}

.percent {
  font-size: 48px;
  font-weight: bold;
  color: #ffd700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}
</style>
