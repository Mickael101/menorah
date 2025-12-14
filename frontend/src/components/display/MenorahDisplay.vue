<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { gsap } from 'gsap';
import { useDonations } from '../../composables/useDonations';
import { useSocket } from '../../composables/useSocket';

const { stats, fetchDonations, fetchConfig, handleDonationNew, handleDonationUpdated, handleDonationDeleted, handleConfigUpdated } = useDonations();
const { on } = useSocket();

const svgContainer = ref<HTMLDivElement | null>(null);
const svgContent = ref<string>('');

// Load SVG content
onMounted(async () => {
  try {
    const response = await fetch('/assets/menorahshiviti.svg');
    svgContent.value = await response.text();

    // Animation d'entrée après chargement
    setTimeout(() => {
      animateEntrance();
    }, 100);
  } catch (error) {
    console.error('Failed to load menorah SVG:', error);
  }

  // Load initial data
  await Promise.all([fetchDonations(), fetchConfig()]);

  // Listen for real-time events
  on('donation:new', (data: any) => {
    handleDonationNew(data.donation, data.stats);
    animatePulse();
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

function animateEntrance(): void {
  if (!svgContainer.value) return;
  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  gsap.fromTo(svg,
    { opacity: 0, scale: 0.9 },
    { opacity: 1, scale: 1, duration: 1, ease: 'power2.out' }
  );
}

function animatePulse(): void {
  if (!svgContainer.value) return;
  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  gsap.to(svg, {
    filter: 'drop-shadow(0 0 30px #FFD700)',
    duration: 0.3,
    yoyo: true,
    repeat: 2,
    ease: 'power2.inOut'
  });
}

// Glow effect based on progress
watch(() => stats.value.percentComplete, (percent) => {
  if (!svgContainer.value) return;
  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  const glowIntensity = Math.min(percent * 0.3, 30);
  gsap.to(svg, {
    filter: `drop-shadow(0 0 ${glowIntensity}px #D4AF37)`,
    duration: 1
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

/* Golden color for all paths */
.menorah-svg :deep(path) {
  fill: #EBD45C;
  transition: fill 0.5s ease;
}

.menorah-info {
  margin-top: 20px;
  text-align: center;
}

.percent {
  font-size: 48px;
  font-weight: bold;
  color: #D4AF37;
  text-shadow: 0 0 15px rgba(212, 175, 55, 0.5);
}
</style>
