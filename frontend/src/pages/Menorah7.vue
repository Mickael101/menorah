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

  // Mystical slow rise from the depths
  gsap.fromTo(svg,
    { opacity: 0, y: 60, scale: 0.95 },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 3, // Very slow and calm
      ease: 'power2.out'
    }
  );
}

// Permanent subtle pulse - SLOW AND CALM
function startSubtlePulse(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  gsap.to(svg, {
    scale: 0.99,
    duration: 4, // Very slow breath
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut'
  });
}

// Progressive lighting STRICTLY from bottom to top
function updateLighting(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Get all animated elements: masked groups AND direct paths
  // Many paths are direct children of SVG and were missed before
  const elements = Array.from(svg.querySelectorAll('g[mask], svg > path')) as SVGGraphicsElement[];

  if (elements.length === 0) return;

  // Sort elements by Y position
  // Hybrid approach: use mask Y for groups, BBox Y for paths
  const sortedElements = elements.sort((a, b) => {
    const getY = (el: SVGGraphicsElement) => {
      // Strategy 1: If it has a mask, use the mask's Y (most reliable for those groups)
      const maskAttr = el.getAttribute('mask');
      if (maskAttr) {
        const id = maskAttr.match(/#([^)]+)/)?.[1];
        const maskEl = id ? document.getElementById(id) : null;
        const y = maskEl?.getAttribute('y');
        if (y) return parseFloat(y);
      }
      
      // Strategy 2: Fallback to BBox for paths or if mask check fails
      try {
        return el.getBBox().y;
      } catch (e) {
        return 0;
      }
    };
    
    return getY(b) - getY(a); // Descending: Bottom first
  });

  const totalElements = sortedElements.length;
  const lightingLevel = Math.floor((stats.value.percentComplete / 100) * totalElements);

  sortedElements.forEach((el, index) => {
    if (index < lightingLevel) {
      // Lit elements
      gsap.to(el, {
        opacity: 1,
        scale: 1,
        filter: 'brightness(1.4)',
        duration: 0.6,
        ease: 'power2.out'
      });
    } else {
      // Unlit elements
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

  // Get sorted elements (groups + paths) and find the newly lit one
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

// Generate ember particles that rise from the base - RARE AND FLOATING
function startEmberGeneration(): void {
  emberInterval = window.setInterval(() => {
    if (Math.random() < 0.2) { // 20% chance (less frequent)
      const ember = {
        id: nextEmberId++,
        x: 40 + Math.random() * 20, // Wider spread
        y: 5
      };
      embers.value.push(ember);

      // Remove after animation completes
      setTimeout(() => {
        const index = embers.value.findIndex(e => e.id === ember.id);
        if (index !== -1) {
          embers.value.splice(index, 1);
        }
      }, 6000); // Longer life
    }
  }, 800); // Slower interval
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
    rgba(63, 81, 181, 0.15) 0%,
    rgba(103, 58, 183, 0.08) 40%,
    transparent 80%
  );
}

.pulsing-halo {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 900px;
  height: 900px;
  background: radial-gradient(
    circle,
    rgba(100, 181, 246, 0.1) 0%,
    rgba(49, 27, 146, 0.1) 40%,
    transparent 70%
  );
  animation: pulseHalo 8s ease-in-out infinite;
  filter: blur(50px);
}

@keyframes pulseHalo {
  0%, 100% {
    opacity: 0.3;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.6;
    transform: translate(-50%, -50%) scale(1.1);
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
  background: radial-gradient(circle, #E1F5FE 0%, #81D4FA 50%, #29B6F6 100%);
  border-radius: 50%;
  box-shadow: 0 0 8px #29B6F6, 0 0 15px rgba(41, 182, 246, 0.4);
  animation: riseEmber 6s ease-out forwards;
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

