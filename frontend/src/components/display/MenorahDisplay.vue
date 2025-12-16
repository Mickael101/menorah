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
    <div class="bg-gradient"></div>
    <div class="bg-stars"></div>
    <div class="bg-glow"></div>

    <div class="content">
      <div
        ref="svgContainer"
        class="menorah-svg"
        v-html="svgContent"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.menorah-display {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  overflow: hidden;
}

.bg-gradient {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, #0a1628 0%, #1a237e 50%, #0d47a1 100%);
  z-index: -3;
}

.bg-stars {
  position: fixed;
  inset: 0;
  background-image:
    radial-gradient(2px 2px at 20px 30px, white, transparent),
    radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
    radial-gradient(1px 1px at 90px 40px, white, transparent),
    radial-gradient(2px 2px at 130px 80px, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 160px 120px, white, transparent),
    radial-gradient(2px 2px at 200px 50px, rgba(255,255,255,0.7), transparent),
    radial-gradient(1px 1px at 250px 160px, white, transparent),
    radial-gradient(2px 2px at 300px 100px, rgba(255,255,255,0.8), transparent);
  background-size: 350px 200px;
  animation: twinkle 8s ease-in-out infinite;
  z-index: -2;
}

.bg-glow {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 120vmax;
  height: 120vmax;
  background: radial-gradient(ellipse at center,
    rgba(212, 175, 55, 0.08) 0%,
    rgba(212, 175, 55, 0.03) 30%,
    transparent 70%);
  animation: glow-pulse 6s ease-in-out infinite;
  z-index: -1;
}

@keyframes twinkle {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
}

.content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.menorah-svg {
  width: 100%;
  max-width: 700px;
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

.menorah-info {
  margin-top: 30px;
  text-align: center;
}

.percent {
  font-size: 64px;
  font-weight: bold;
  color: #D4AF37;
  text-shadow: 0 0 20px rgba(212, 175, 55, 0.6);
  display: block;
}

.subtitle {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 8px;
}

.premium-legend {
  margin-top: 40px;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 20px 30px;
  border: 1px solid rgba(212, 175, 55, 0.2);
}

.premium-legend h4 {
  color: #D4AF37;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-bottom: 16px;
  text-align: center;
}

.premium-tier {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 8px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
}

.premium-tier:last-child {
  margin-bottom: 0;
}

.premium-tier.lit {
  background: rgba(212, 175, 55, 0.2);
  box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);
}

.tier-icon {
  font-size: 20px;
  color: #A79085;
  transition: color 0.3s ease;
}

.premium-tier.lit .tier-icon {
  color: #FFD700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.tier-amount {
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.tier-count {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin-left: auto;
}

@media (max-width: 768px) {
  .menorah-svg {
    max-width: 95%;
  }

  .percent {
    font-size: 48px;
  }

  .premium-legend {
    padding: 16px 20px;
  }
}
</style>
