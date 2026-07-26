<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { gsap } from 'gsap';
import { useDonations } from '../../composables/useDonations';
import { useSocket } from '../../composables/useSocket';
import { getActiveThemePalette } from '../../theme/displayThemes';

const { donations, stats, config, fetchDonations, fetchConfig, handleDonationNew, handleDonationUpdated, handleDonationDeleted, handleConfigUpdated } = useDonations();
const { on } = useSocket();

const svgContainer = ref<HTMLDivElement | null>(null);
const svgContent = ref<string>('');
const breathingAnimations = ref<gsap.core.Timeline[]>([]);
const activePalette = computed(() => getActiveThemePalette(config.value.displaySettings));
// Couleur des segments de menorah encore eteints : elle doit rester lisible
// sur le fond du theme sans attirer l'oeil. « ivory » est le seul theme clair,
// d'ou une valeur nettement plus sombre.
const mutedColor = computed(() => ({
  premium: '#766F73',
  modern: '#416A73',
  ceremonial: '#755C60',
  royal: '#6E5F7A',
  emerald: '#4C6659',
  ivory: '#B7AB92',
  midnight: '#55555C'
})[config.value.displaySettings.theme] ?? '#766F73');

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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

  if (prefersReducedMotion()) {
    gsap.set(svg, { opacity: 1, scale: 1 });
    return;
  }

  gsap.fromTo(svg,
    { opacity: 0, scale: 0.9 },
    { opacity: 1, scale: 1, duration: 1, ease: 'power2.out' }
  );
}

function animateBounce(): void {
  if (!svgContainer.value) return;
  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  if (prefersReducedMotion()) return;

  const glowColor = activePalette.value.chartPrimaryColor;

  // Short visual acknowledgement; the full donor moment is handled separately.
  gsap.timeline()
    .to(svg, {
      scale: 1.025,
      filter: `drop-shadow(0 0 28px ${glowColor})`,
      duration: 0.2,
      ease: 'power2.out'
    })
    .to(svg, {
      scale: 1,
      filter: 'drop-shadow(0 0 0px transparent)',
      duration: 0.45,
      ease: 'power2.out'
    });
}

function updateMenorahLighting(): void {
  if (!svgContainer.value) return;
  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Stop all existing breathing animations
  breathingAnimations.value.forEach(anim => anim.kill());
  breathingAnimations.value = [];

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
  const lightColor = activePalette.value.chartPrimaryColor;
  const secondaryColor = activePalette.value.chartSecondaryColor;
  const isReduced = prefersReducedMotion();

  regularGroups.forEach((group, index) => {
    const paths = group.querySelectorAll('path');
    const shouldLight = index < groupsToLight;

    if (shouldLight) {
      // Couleur or vive et constante
      paths.forEach(path => {
        gsap.to(path, {
          fill: lightColor,
          duration: 0.5,
          ease: 'power2.out'
        });
      });

      if (isReduced) {
        gsap.set(group, { filter: `drop-shadow(0 0 7px ${lightColor})` });
        return;
      }

      // Theme-aware, restrained breathing glow.
      const breathingTl = gsap.timeline({ repeat: -1 });
      const randomOffset = Math.random() * 0.5;
      breathingTl
        .to(group, {
          filter: `drop-shadow(0 0 7px ${lightColor}) drop-shadow(0 0 13px ${secondaryColor})`,
          duration: 1.5 + randomOffset,
          ease: 'sine.inOut'
        })
        .to(group, {
          filter: `drop-shadow(0 0 3px ${lightColor}) drop-shadow(0 0 6px ${secondaryColor})`,
          duration: 1.3 + randomOffset,
          ease: 'sine.inOut'
        })
        .to(group, {
          filter: `drop-shadow(0 0 10px ${lightColor}) drop-shadow(0 0 17px ${secondaryColor})`,
          duration: 1.4 + randomOffset,
          ease: 'sine.inOut'
        })
        .to(group, {
          filter: `drop-shadow(0 0 5px ${lightColor}) drop-shadow(0 0 9px ${secondaryColor})`,
          duration: 1.2 + randomOffset,
          ease: 'sine.inOut'
        });

      breathingAnimations.value.push(breathingTl);
    } else {
      // Eteint - gris
      paths.forEach(path => {
        gsap.to(path, {
          fill: mutedColor.value,
          duration: 0.8,
          ease: 'power2.out'
        });
      });
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

      if (isLit) {
        // Couleur or tres vive pour les mots premium
        paths.forEach(path => {
          gsap.to(path, {
            fill: lightColor,
            duration: 0.5,
            ease: 'power2.out'
          });
        });

        if (isReduced) {
          gsap.set(group, { filter: `drop-shadow(0 0 10px ${lightColor})` });
          return;
        }

        // Premium words keep a stronger, but still theme-aware, glow.
        const breathingTl = gsap.timeline({ repeat: -1 });
        const randomOffset = Math.random() * 0.4;
        breathingTl
          .to(group, {
            filter: `drop-shadow(0 0 12px ${lightColor}) drop-shadow(0 0 22px ${secondaryColor})`,
            duration: 1.2 + randomOffset,
            ease: 'sine.inOut'
          })
          .to(group, {
            filter: `drop-shadow(0 0 7px ${lightColor}) drop-shadow(0 0 11px ${secondaryColor})`,
            duration: 1.0 + randomOffset,
            ease: 'sine.inOut'
          })
          .to(group, {
            filter: `drop-shadow(0 0 16px ${lightColor}) drop-shadow(0 0 27px ${secondaryColor})`,
            duration: 1.1 + randomOffset,
            ease: 'sine.inOut'
          })
          .to(group, {
            filter: `drop-shadow(0 0 9px ${lightColor}) drop-shadow(0 0 16px ${secondaryColor})`,
            duration: 1.0 + randomOffset,
            ease: 'sine.inOut'
          });

        breathingAnimations.value.push(breathingTl);
      } else {
        // Eteint - gris
        paths.forEach(path => {
          gsap.to(path, {
            fill: mutedColor.value,
            duration: 0.5,
            ease: 'power2.out'
          });
        });
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
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menorah-svg :deep(svg) {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
}

.menorah-svg :deep(path) {
  fill: #A79085;
  transition: fill 0.3s ease;
}

@media (max-width: 768px) {
  .menorah-svg {
    max-width: 100%;
  }
}
</style>
