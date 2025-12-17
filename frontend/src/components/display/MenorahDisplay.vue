<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { gsap } from 'gsap';
import { useDonations } from '../../composables/useDonations';
import { useSocket } from '../../composables/useSocket';

const { donations, stats, fetchDonations, fetchConfig, handleDonationNew, handleDonationUpdated, handleDonationDeleted, handleConfigUpdated } = useDonations();
const { on } = useSocket();

const svgContainer = ref<HTMLDivElement | null>(null);
const svgContent = ref<string>('');
const breathingAnimations = ref<gsap.core.Timeline[]>([]);

// Premium word ID to mask ID mapping (each word lights independently)
const PREMIUM_WORD_TO_MASK: Record<string, string> = {
  // Level 1 - 26,000 ₪ (7 words)
  'L1_W1': 'mask4_0_1',
  'L1_W2': 'mask59_0_1',
  'L1_W3': 'mask5_0_1',
  'L1_W4': 'mask6_0_1',
  'L1_W5': 'mask7_0_1',
  'L1_W6': 'mask8_0_1',
  'L1_W7': 'mask9_0_1',
  // Level 2 - 36,000 ₪ (3 words)
  'L2_W1': 'mask2_0_1',
  'L2_W2': 'mask3_0_1',
  'L2_W3': 'mask0_0_1',
  // Level 3 - 72,000 ₪ (1 word)
  'L3_W1': 'mask1_0_1'
};

// All premium mask IDs (reserved for specific donations)
const ALL_PREMIUM_MASKS = Object.values(PREMIUM_WORD_TO_MASK);

// Get masks that should be lit based on individual premium word assignments
const litPremiumMasks = computed(() => {
  const lit: string[] = [];
  donations.value.forEach(donation => {
    // Only light the specific word assigned to this donation
    if (donation.premiumWordId && PREMIUM_WORD_TO_MASK[donation.premiumWordId]) {
      lit.push(PREMIUM_WORD_TO_MASK[donation.premiumWordId]);
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
    animateBounce();
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

function animateBounce(): void {
  if (!svgContainer.value) return;
  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Bouncing animation with glow
  gsap.timeline()
    .to(svg, {
      scale: 1.05,
      filter: 'drop-shadow(0 0 40px #FFD700)',
      duration: 0.2,
      ease: 'power2.out'
    })
    .to(svg, {
      scale: 0.98,
      duration: 0.15,
      ease: 'power2.in'
    })
    .to(svg, {
      scale: 1.03,
      duration: 0.12,
      ease: 'power2.out'
    })
    .to(svg, {
      scale: 0.99,
      duration: 0.1,
      ease: 'power2.in'
    })
    .to(svg, {
      scale: 1,
      filter: 'drop-shadow(0 0 0px transparent)',
      duration: 0.15,
      ease: 'power2.out'
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

    // Use vivid gold matching donor plates
    paths.forEach(path => {
      gsap.to(path, {
        fill: shouldLight ? '#f5d67b' : '#A79085',
        duration: 0.8,
        ease: 'power2.out'
      });
    });

    if (shouldLight) {
      gsap.to(group, {
        filter: 'drop-shadow(0 0 12px rgba(212, 175, 55, 0.8)) drop-shadow(0 0 25px rgba(245, 214, 123, 0.5))',
        duration: 0.8
      });
    } else {
      gsap.to(group, {
        filter: 'none',
        duration: 0.5
      });
    }
  });

  // Stop all existing breathing animations
  breathingAnimations.value.forEach(anim => anim.kill());
  breathingAnimations.value = [];

  groups.forEach(group => {
    const maskAttr = group.getAttribute('mask');
    if (!maskAttr) return;
    const maskId = maskAttr.replace('url(#', '').replace(')', '');

    if (ALL_PREMIUM_MASKS.includes(maskId)) {
      const isLit = litPremiumMasks.value.includes(maskId);
      const paths = group.querySelectorAll('path');

      // Use vivid gold colors matching donor plates
      paths.forEach(path => {
        gsap.to(path, {
          fill: isLit ? '#f5d67b' : '#A79085',
          duration: 1,
          ease: 'power2.out'
        });
      });

      if (isLit) {
        // Initial glow
        gsap.to(group, {
          filter: 'drop-shadow(0 0 20px rgba(212, 175, 55, 1)) drop-shadow(0 0 40px rgba(245, 214, 123, 0.8))',
          duration: 1
        });

        // Breathing candle animation - continuous
        const breathingTl = gsap.timeline({ repeat: -1 });
        breathingTl
          .to(paths, {
            fill: '#ffe066',
            duration: 1.5 + Math.random() * 0.5,
            ease: 'sine.inOut'
          })
          .to(paths, {
            fill: '#d4af37',
            duration: 1.2 + Math.random() * 0.5,
            ease: 'sine.inOut'
          })
          .to(paths, {
            fill: '#f5d67b',
            duration: 1.3 + Math.random() * 0.5,
            ease: 'sine.inOut'
          });

        // Glow breathing effect
        const glowTl = gsap.timeline({ repeat: -1 });
        glowTl
          .to(group, {
            filter: 'drop-shadow(0 0 25px rgba(255, 224, 102, 1)) drop-shadow(0 0 50px rgba(212, 175, 55, 0.9))',
            duration: 1.8 + Math.random() * 0.4,
            ease: 'sine.inOut'
          })
          .to(group, {
            filter: 'drop-shadow(0 0 15px rgba(212, 175, 55, 0.8)) drop-shadow(0 0 30px rgba(245, 214, 123, 0.6))',
            duration: 1.4 + Math.random() * 0.4,
            ease: 'sine.inOut'
          })
          .to(group, {
            filter: 'drop-shadow(0 0 22px rgba(245, 214, 123, 1)) drop-shadow(0 0 45px rgba(212, 175, 55, 0.85))',
            duration: 1.6 + Math.random() * 0.4,
            ease: 'sine.inOut'
          });

        breathingAnimations.value.push(breathingTl, glowTl);
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
