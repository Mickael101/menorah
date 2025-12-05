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

// Permanent subtle pulse - SLOWER AND SUBTLER
function startSubtlePulse(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  gsap.to(svg, {
    scale: 0.99,
    duration: 3,
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
      // Lit elements - SOBER BRIGHTNESS
      gsap.to(element, {
        opacity: 1,
        filter: 'brightness(1.25)',
        duration: 0.8,
        ease: 'power2.out'
      });
    } else {
      // Unlit elements - VERY VISIBLE
      gsap.to(element, {
        opacity: 0.45,
        filter: 'brightness(0.9)',
        duration: 0.8,
        ease: 'power2.in'
      });
    }
  });
}

// Animation when new donation arrives - ELEGANT FLASH
function animateNewDonation(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Elegant flash
  gsap.fromTo(svg,
    { filter: 'brightness(1.4)' },
    {
      filter: 'brightness(1)',
      duration: 1.2,
      ease: 'power2.out'
    }
  );

  // Very light shake
  gsap.from(svg, {
    x: -5,
    duration: 0.2,
    ease: 'power1.inOut',
    yoyo: true,
    repeat: 2
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
}

// Watch stats changes to update lighting
watch(() => stats.value.percentComplete, () => {
  updateLighting();
});

onUnmounted(() => {
  gsap.killTweensOf('*');
});
</script>

<template>
  <div class="menorah4">
    <!-- Pure black background with very subtle halo -->
    <div class="background">
      <div class="subtle-halo"></div>
    </div>

    <!-- Horizontal light line under menorah -->
    <div class="light-line"></div>

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
.menorah4 {
  min-height: 100vh;
  background: #000000;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Background with very subtle halo */
.background {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.subtle-halo {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 600px;
  background: radial-gradient(
    circle,
    rgba(255, 250, 240, 0.05) 0%,
    transparent 70%
  );
  animation: pulseHalo 4s ease-in-out infinite;
  filter: blur(80px);
  opacity: 0.08;
}

@keyframes pulseHalo {
  0%, 100% {
    opacity: 0.06;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.1;
    transform: translate(-50%, -50%) scale(1.1);
  }
}

/* Horizontal light line under menorah */
.light-line {
  position: absolute;
  bottom: 15vh;
  left: 50%;
  transform: translateX(-50%);
  width: 70%;
  height: 2px;
  background: linear-gradient(
    to right,
    transparent 0%,
    rgba(255, 250, 240, 0.15) 20%,
    rgba(255, 250, 240, 0.25) 50%,
    rgba(255, 250, 240, 0.15) 80%,
    transparent 100%
  );
  filter: blur(1px);
  z-index: 5;
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
  filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.6));
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
  transition: all 0.8s ease;
}

/* Groups with masks */
.menorah-container :deep(g[mask]) {
  transition: all 0.8s ease;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .menorah-container :deep(svg) {
    height: 70vh;
    max-height: 70vh;
  }

  .subtle-halo {
    width: 400px;
    height: 400px;
  }

  .light-line {
    bottom: 12vh;
  }
}

@media (min-width: 1200px) {
  .menorah-container :deep(svg) {
    height: 80vh;
    max-height: 80vh;
  }

  .subtle-halo {
    width: 800px;
    height: 800px;
  }
}

@media (min-width: 1600px) {
  .menorah-container :deep(svg) {
    height: 85vh;
    max-height: 85vh;
  }

  .subtle-halo {
    width: 1000px;
    height: 1000px;
  }
}
</style>
