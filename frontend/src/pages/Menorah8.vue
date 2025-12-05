<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { gsap } from 'gsap';
import { useDonations } from '../composables/useDonations';
import { useSocket } from '../composables/useSocket';

const { stats, fetchDonations, fetchConfig, handleDonationNew, handleDonationUpdated, handleDonationDeleted, handleConfigUpdated } = useDonations();
const { on } = useSocket();

const svgContainer = ref<HTMLDivElement | null>(null);
const svgContent = ref<string>('');
const isLoaded = ref(false);
const embers = ref<Array<{ id: number; x: number; y: number }>>([]);
let emberInterval: number | null = null;
let nextEmberId = 0;

// Load SVG content
onMounted(async () => {
  try {
    const response = await fetch('/assets/menorah.svg');
    svgContent.value = await response.text();

    // Wait for DOM update then animate
    setTimeout(() => {
      isLoaded.value = true;
      animateEntrance();
      startSubtlePulse();
      startEmberGeneration();
      updateLighting();
    }, 100);
  } catch (error) {
    console.error('Failed to load menorah SVG:', error);
  }

  // Load initial data
  await Promise.all([fetchDonations(), fetchConfig()]);

  // Listen for real-time events
  on('donation:new', (data: any) => {
    handleDonationNew(data.donation, data.stats);
    animateNewDonation();
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

// Initial entrance animation - fade in from 0 to 1
function animateEntrance(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Fiery burst from below
  gsap.fromTo(svg,
    { opacity: 0, y: 100, scale: 0.8 },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.8, // Fast and energetic
      ease: 'back.out(1.2)'
    }
  );
}

// Permanent subtle pulse - RAPID AND INTENSE
function startSubtlePulse(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  gsap.to(svg, {
    scale: 0.97,
    duration: 1, // Fast pulse
    repeat: -1,
    yoyo: true,
    ease: 'power2.inOut'
  });
}

// Progressive lighting STRICTLY from bottom to top
function updateLighting(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Get all mask groups from the SVG
  const groups = Array.from(svg.querySelectorAll('g[mask]')) as SVGGElement[];

  if (groups.length === 0) return;

  // Get all animated elements: masked groups AND direct paths
  const elements = Array.from(svg.querySelectorAll('g[mask], svg > path')) as SVGGraphicsElement[];

  if (elements.length === 0) return;

  // Sort elements by Y position
  const sortedElements = elements.sort((a, b) => {
    const getY = (el: SVGGraphicsElement) => {
      const maskAttr = el.getAttribute('mask');
      if (maskAttr) {
        const id = maskAttr.match(/#([^)]+)/)?.[1];
        const maskEl = id ? document.getElementById(id) : null;
        const y = maskEl?.getAttribute('y');
        if (y) return parseFloat(y);
      }
      try { return el.getBBox().y; } catch (e) { return 0; }
    };
    return getY(b) - getY(a);
  });

  const totalElements = sortedElements.length;
  const lightingLevel = Math.floor((stats.value.percentComplete / 100) * totalElements);

  sortedElements.forEach((el, index) => {
    if (index < lightingLevel) {
      gsap.to(el, {
        opacity: 1,
        scale: 1,
        filter: 'brightness(1.4)',
        duration: 0.6,
        ease: 'power2.out'
      });
    } else {
      gsap.to(el, {
        opacity: 0.35,
        scale: 0.98,
        filter: 'brightness(0.8)',
        duration: 0.6,
        ease: 'power2.in'
      });
    }
  });
}

// Animation when new donation arrives
function animateNewDonation(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Intense flash
  gsap.fromTo(svg,
    { filter: 'brightness(2)' },
    {
      filter: 'brightness(1)',
      duration: 0.8,
      ease: 'power2.out'
    }
  );

  // Shake effect
  gsap.from(svg, {
    x: -10,
    duration: 0.2,
    ease: 'power1.inOut',
    yoyo: true,
    repeat: 3
  });

  // Get sorted elements and find the newly lit one
  const elements = Array.from(svg.querySelectorAll('g[mask], svg > path')) as SVGGraphicsElement[];
  const sortedElements = elements.sort((a, b) => {
    const getY = (el: SVGGraphicsElement) => {
      const maskAttr = el.getAttribute('mask');
      if (maskAttr) {
        const id = maskAttr.match(/#([^)]+)/)?.[1];
        const maskEl = id ? document.getElementById(id) : null;
        const y = maskEl?.getAttribute('y');
        if (y) return parseFloat(y);
      }
      try { return el.getBBox().y; } catch (e) { return 0; }
    };
    return getY(b) - getY(a);
  });

  const totalElements = sortedElements.length;
  const newGroupIndex = Math.floor((stats.value.percentComplete / 100) * totalElements) - 1;

  if (newGroupIndex >= 0 && newGroupIndex < totalElements) {
    const newElement = sortedElements[newGroupIndex];

    // Animate new element
    gsap.fromTo(newElement,
      { opacity: 0, scale: 0.5 },
      {
        opacity: 1,
        scale: 1.2,
        duration: 0.5,
        ease: 'back.out(3)',
        onComplete: () => {
          // Settle to normal lit state
          gsap.to(newElement, {
            scale: 1,
            duration: 0.3,
            ease: 'power2.out'
          });
        }
      }
    );
  }

  // Trigger ember burst
  generateEmberBurst();
}

// Generate ember particles that rise from the base - FREQUENT AND FAST
function startEmberGeneration(): void {
  emberInterval = window.setInterval(() => {
    if (Math.random() < 0.6) { // 60% chance (very frequent)
      const ember = {
        id: nextEmberId++,
        x: 45 + Math.random() * 10,
        y: 8
      };
      embers.value.push(ember);

      setTimeout(() => {
        const index = embers.value.findIndex(e => e.id === ember.id);
        if (index !== -1) {
          embers.value.splice(index, 1);
        }
      }, 3000); // Shorter life
    }
  }, 200); // Fast interval
}

function generateEmberBurst(): void {
  // Generate multiple embers on donation
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      const ember = {
        id: nextEmberId++,
        x: 40 + Math.random() * 20,
        y: 10
      };
      embers.value.push(ember);

      setTimeout(() => {
        const index = embers.value.findIndex(e => e.id === ember.id);
        if (index !== -1) {
          embers.value.splice(index, 1);
        }
      }, 4000);
    }, i * 80);
  }
}

// Watch stats changes to update lighting
watch(() => stats.value.percentComplete, () => {
  updateLighting();
});

onUnmounted(() => {
  gsap.killTweensOf('*');
  if (emberInterval !== null) {
    clearInterval(emberInterval);
  }
});
</script>

<template>
  <div class="menorah-alt2">
    <!-- Deep black background with warm glow -->
    <div class="background">
      <div class="warm-glow"></div>
      <div class="pulsing-halo"></div>
    </div>

    <!-- Embers/sparks rising from base -->
    <div class="embers-container">
      <div
        v-for="ember in embers"
        :key="ember.id"
        class="ember"
        :style="{
          left: `${ember.x}%`,
          bottom: `${ember.y}%`
        }"
      ></div>
    </div>

    <!-- Menorah SVG centered large -->
    <div class="menorah-wrapper">
      <div
        ref="svgContainer"
        class="menorah-container"
        :class="{ loaded: isLoaded }"
        v-html="svgContent"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.menorah-alt2 {
  min-height: 100vh;
  background: #050505;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Background with deep black and warm glow */
.background {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.warm-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 50% 50% at 50% 50%,
    rgba(255, 34, 34, 0.2) 0%,
    rgba(255, 87, 34, 0.1) 40%,
    transparent 80%
  );
}

.pulsing-halo {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 750px;
  height: 750px;
  background: radial-gradient(
    circle,
    rgba(255, 61, 0, 0.2) 0%,
    rgba(213, 0, 0, 0.15) 40%,
    transparent 70%
  );
  animation: pulseHalo 2s ease-in-out infinite; /* Fast halo */
  filter: blur(40px);
}

@keyframes pulseHalo {
  0%, 100% {
    opacity: 0.5;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.9;
    transform: translate(-50%, -50%) scale(1.2);
  }
}

/* Embers/sparks rising continuously from base */
.embers-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}

.ember {
  position: absolute;
  width: 4px;
  height: 4px;
  background: radial-gradient(circle, #FFFF00 0%, #FF5252 50%, #B71C1C 100%);
  border-radius: 50%;
  box-shadow: 0 0 10px #FF3D00, 0 0 20px rgba(255, 61, 0, 0.6);
  animation: riseEmber 3s ease-out forwards; /* Faster rise */
}

@keyframes riseEmber {
  0% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: 1;
    filter: blur(0);
  }
  20% {
    opacity: 0.9;
  }
  60% {
    opacity: 0.6;
    filter: blur(1px);
  }
  100% {
    transform: translateY(-70vh) translateX(calc(-30px + 60px * var(--random, 0.5))) scale(0.3);
    opacity: 0;
    filter: blur(2px);
  }
}

/* Menorah container */
.menorah-wrapper {
  position: relative;
  z-index: 10;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.menorah-container {
  width: 100%;
  max-width: 90vw;
  height: auto;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.menorah-container.loaded {
  opacity: 1;
}

.menorah-container :deep(svg) {
  width: 100%;
  height: 75vh;
  max-height: 75vh;
  display: block;
  margin: 0 auto;
}

/* Paths in base state */
.menorah-container :deep(path) {
  fill: #EBD45C;
  transition: all 0.6s ease;
}

/* Groups with masks */
.menorah-container :deep(g[mask]) {
  transition: all 0.6s ease;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .menorah-container :deep(svg) {
    height: 70vh;
    max-height: 70vh;
  }

  .pulsing-halo {
    width: 500px;
    height: 500px;
  }
}

@media (min-width: 1200px) {
  .menorah-container :deep(svg) {
    height: 80vh;
    max-height: 80vh;
  }

  .pulsing-halo {
    width: 1000px;
    height: 1000px;
  }
}

@media (min-width: 1600px) {
  .menorah-container :deep(svg) {
    height: 85vh;
    max-height: 85vh;
  }
}
</style>

