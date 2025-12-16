<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { gsap } from 'gsap';
import { useDonations } from '../../composables/useDonations';
import { useSocket } from '../../composables/useSocket';

const { donations, stats, fetchDonations, fetchConfig, handleDonationNew, handleDonationUpdated, handleDonationDeleted, handleConfigUpdated } = useDonations();
const { on } = useSocket();

const svgContainer = ref<HTMLDivElement | null>(null);
const svgContent = ref<string>('');

// Premium donation amounts mapping (mask IDs for each premium tier)
// Amounts are in agorot (100 agorot = 1 shekel)
const PREMIUM_MASKS: Record<number, string[]> = {
  2600000: ['mask4_0_1', 'mask59_0_1', 'mask5_0_1', 'mask6_0_1', 'mask7_0_1', 'mask8_0_1', 'mask9_0_1'],
  3600000: ['mask2_0_1', 'mask3_0_1', 'mask0_0_1'],
  7200000: ['mask1_0_1']
};

// All premium mask IDs (reserved for specific donations)
const ALL_PREMIUM_MASKS = Object.values(PREMIUM_MASKS).flat();

// Check if a donation has a premium amount
function isPremiumAmount(amount: number): number | null {
  const premiumAmounts = [2600000, 3600000, 7200000];
  return premiumAmounts.find(p => p === amount) || null;
}

// Get masks that should be lit based on premium donations
const litPremiumMasks = computed(() => {
  const lit: string[] = [];
  donations.value.forEach(donation => {
    const premiumAmount = isPremiumAmount(donation.amount);
    if (premiumAmount && PREMIUM_MASKS[premiumAmount]) {
      lit.push(...PREMIUM_MASKS[premiumAmount]);
    }
  });
  return [...new Set(lit)];
});

// Load SVG content
onMounted(async () => {
  try {
    const response = await fetch('/assets/menorahshiviti3.svg');
    svgContent.value = await response.text();

    setTimeout(() => {
      animateEntrance();
      updateMenorahLighting();
    }, 100);
  } catch (error) {
    console.error('Failed to load menorah SVG:', error);
  }

  await Promise.all([fetchDonations(), fetchConfig()]);

  on('donation:new', (data: any) => {
    handleDonationNew(data.donation, data.stats);
    animatePulse();
    updateMenorahLighting();
  });

  on('donation:updated', (data: any) => {
    handleDonationUpdated(data.donation, data.stats);
    updateMenorahLighting();
  });

  on('donation:deleted', (data: any) => {
    handleDonationDeleted(data.donationId, data.stats);
    updateMenorahLighting();
  });

  on('config:updated', (data: any) => {
    handleConfigUpdated(data.config, data.stats);
    updateMenorahLighting();
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

function updateMenorahLighting(): void {
  if (!svgContainer.value) return;
  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  const groups = Array.from(svg.querySelectorAll(':scope > g[mask]')) as SVGGElement[];

  const regularGroups = groups.filter(g => {
    const maskAttr = g.getAttribute('mask');
    if (!maskAttr) return true;
    const maskId = maskAttr.replace('url(#', '').replace(')', '');
    return !ALL_PREMIUM_MASKS.includes(maskId);
  });

  regularGroups.sort((a, b) => {
    const rectA = a.getBoundingClientRect();
    const rectB = b.getBoundingClientRect();
    return rectB.top - rectA.top;
  });

  const percent = stats.value.percentComplete;
  const groupsToLight = Math.floor((percent / 100) * regularGroups.length);

  regularGroups.forEach((group, index) => {
    const paths = group.querySelectorAll('path');
    const shouldLight = index < groupsToLight;

    paths.forEach(path => {
      gsap.to(path, {
        fill: shouldLight ? '#EBD45C' : '#A79085',
        duration: 0.8,
        ease: 'power2.out'
      });
    });

    if (shouldLight) {
      gsap.to(group, {
        filter: 'drop-shadow(0 0 8px rgba(235, 212, 92, 0.6))',
        duration: 0.8
      });
    } else {
      gsap.to(group, {
        filter: 'none',
        duration: 0.5
      });
    }
  });

  groups.forEach(group => {
    const maskAttr = group.getAttribute('mask');
    if (!maskAttr) return;
    const maskId = maskAttr.replace('url(#', '').replace(')', '');

    if (ALL_PREMIUM_MASKS.includes(maskId)) {
      const isLit = litPremiumMasks.value.includes(maskId);
      const paths = group.querySelectorAll('path');

      paths.forEach(path => {
        gsap.to(path, {
          fill: isLit ? '#FFD700' : '#A79085',
          duration: 1,
          ease: 'power2.out'
        });
      });

      if (isLit) {
        gsap.to(group, {
          filter: 'drop-shadow(0 0 15px rgba(255, 215, 0, 0.8))',
          duration: 1
        });
        gsap.fromTo(group,
          { scale: 1 },
          { scale: 1.02, duration: 0.5, yoyo: true, repeat: 1, ease: 'power2.inOut' }
        );
      } else {
        gsap.to(group, {
          filter: 'none',
          duration: 0.5
        });
      }
    }
  });
}

watch(() => stats.value.percentComplete, () => {
  updateMenorahLighting();
}, { immediate: true });

watch(() => donations.value, () => {
  updateMenorahLighting();
}, { deep: true });
</script>

<template>
  <div class="menorah-display">
    <div
      ref="svgContainer"
      class="menorah-svg"
      v-html="svgContent"
    ></div>
  </div>
</template>

<style scoped>
.menorah-display {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.menorah-svg {
  width: 100%;
  max-width: 600px;
  height: auto;
}

.menorah-svg :deep(svg) {
  width: 100%;
  height: auto;
}

.menorah-svg :deep(path) {
  fill: #A79085;
  transition: fill 0.5s ease;
}

@media (max-width: 768px) {
  .menorah-svg {
    max-width: 95%;
  }
}
</style>
