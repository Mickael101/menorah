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

  gsap.fromTo(svg,
    { opacity: 0 },
    {
      opacity: 1,
      duration: 1,
      ease: 'power2.out'
    }
  );
}

// Permanent subtle pulse
function startSubtlePulse(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  gsap.to(svg, {
    scale: 0.98,
    duration: 2,
    repeat: -1,
    yoyo: true,
    ease: 'power1.inOut'
  });
}

// Get Y position for any SVG element (g[mask] or path)
function getElementY(element: SVGElement, svg: SVGSVGElement): number {
  // For groups with mask, extract Y from the mask element
  if (element.tagName === 'g' && element.hasAttribute('mask')) {
    const maskAttr = element.getAttribute('mask');
    if (maskAttr) {
      const match = maskAttr.match(/url\(#([^)]+)\)/);
      if (match) {
        const maskId = match[1];
        const maskElement = svg.querySelector(`#${maskId}`);
        if (maskElement) {
          const yAttr = maskElement.getAttribute('y');
          if (yAttr) return parseFloat(yAttr);

          const rect = maskElement.querySelector('rect, path');
          if (rect) {
            const rectY = rect.getAttribute('y');
            if (rectY) return parseFloat(rectY);
          }
        }
      }
    }
  }

  // For paths and other elements, use getBBox()
  try {
    const bbox = (element as SVGGraphicsElement).getBBox();
    return bbox.y;
  } catch {
    return 0;
  }
}

// Progressive lighting STRICTLY from bottom to top
function updateLighting(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Get ALL visual elements: direct child paths AND groups with masks
  const elements = Array.from(svg.querySelectorAll(':scope > g[mask], :scope > path')) as SVGElement[];

  if (elements.length === 0) return;

  // Sort elements by Y position (higher Y = lower on page)
  const sortedElements = elements.sort((a, b) => {
    const yA = getElementY(a, svg);
    const yB = getElementY(b, svg);
    return yB - yA; // Descending: bottom first, top last
  });

  const totalElements = sortedElements.length;
  const lightingLevel = Math.floor((stats.value.percentComplete / 100) * totalElements);

  sortedElements.forEach((element, index) => {
    if (index < lightingLevel) {
      // Lit elements - softer brightness
      gsap.to(element, {
        opacity: 1,
        filter: 'brightness(1.3)',
        duration: 1,
        ease: 'power2.out'
      });
    } else {
      // Unlit elements - MORE VISIBLE than before
      gsap.to(element, {
        opacity: 0.35,
        filter: 'brightness(0.8)',
        duration: 1,
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

  // Softer flash
  gsap.fromTo(svg,
    { filter: 'brightness(1.6)' },
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
  const elements = Array.from(svg.querySelectorAll(':scope > g[mask], :scope > path')) as SVGElement[];
  const sortedElements = elements.sort((a, b) => {
    const yA = getElementY(a, svg);
    const yB = getElementY(b, svg);
    return yB - yA;
  });

  const totalElements = sortedElements.length;
  const newElementIndex = Math.floor((stats.value.percentComplete / 100) * totalElements) - 1;

  if (newElementIndex >= 0 && newElementIndex < totalElements) {
    const newElement = sortedElements[newElementIndex];

    // Animate new element with back.out easing
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

// Generate ember particles that rise from the base - REDUCED frequency
function startEmberGeneration(): void {
  emberInterval = window.setInterval(() => {
    if (Math.random() < 0.15) { // 15% chance per interval (reduced from 30%)
      const ember = {
        id: nextEmberId++,
        x: 45 + Math.random() * 10, // Center area
        y: 10 // Start from bottom
      };
      embers.value.push(ember);

      // Remove after animation completes (5s instead of 4s)
      setTimeout(() => {
        const index = embers.value.findIndex(e => e.id === ember.id);
        if (index !== -1) {
          embers.value.splice(index, 1);
        }
      }, 5000);
    }
  }, 1000); // 1000ms interval (slower than 500ms)
}

function generateEmberBurst(): void {
  // Generate fewer embers on donation (5 instead of 8)
  for (let i = 0; i < 5; i++) {
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
      }, 5000);
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
  <div class="menorah2">
    <!-- Deep black background with subtle golden glow -->
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
.menorah2 {
  min-height: 100vh;
  background: #030303;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Background with darker black and subtle golden glow */
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
    rgba(212, 175, 55, 0.04) 0%,
    rgba(255, 215, 0, 0.02) 30%,
    transparent 70%
  );
}

.pulsing-halo {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 800px;
  height: 800px;
  background: radial-gradient(
    circle,
    rgba(212, 175, 55, 0.1) 0%,
    rgba(255, 215, 0, 0.06) 30%,
    transparent 70%
  );
  animation: pulseHalo 5s ease-in-out infinite;
  filter: blur(60px);
}

@keyframes pulseHalo {
  0%, 100% {
    opacity: 0.4;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.7;
    transform: translate(-50%, -50%) scale(1.15);
  }
}

/* Embers/sparks rising continuously from base - GOLDEN colors */
.embers-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}

.ember {
  position: absolute;
  width: 3px;
  height: 3px;
  background: radial-gradient(circle, #FFD700 0%, #FFC107 50%, #D4AF37 100%);
  border-radius: 50%;
  box-shadow: 0 0 6px #FFD700, 0 0 12px rgba(255, 215, 0, 0.5);
  animation: riseEmber 5s ease-out forwards;
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
  transition: all 1s ease;
}

/* Groups with masks */
.menorah-container :deep(g[mask]) {
  transition: all 1s ease;
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
