<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { gsap } from 'gsap';
import { useDonations } from '../composables/useDonations';
import { useSocket } from '../composables/useSocket';
import { useSoundEffects } from '../composables/useSoundEffects';

const { stats, fetchDonations, fetchConfig, handleDonationNew, handleDonationUpdated, handleDonationDeleted, handleConfigUpdated } = useDonations();
const { on } = useSocket();
const { playEtincelle, playFlamme, playEmbrasement } = useSoundEffects();

// Computed: Determine current tier based on progress for sounds
const currentTier = computed(() => {
  const percent = stats.value.percentComplete;
  if (percent >= 75) return 3;
  if (percent >= 50) return 2;
  return 1;
});

const svgContainer = ref<HTMLDivElement | null>(null);
const svgContent = ref<string>('');
const isLoaded = ref(false);
const embers = ref<Array<{ id: number; x: number; y: number; sourceY: number }>>([]);
let emberInterval: number | null = null;
let nextEmberId = 0;
let litElements: SVGGraphicsElement[] = [];
let unlitElements: SVGGraphicsElement[] = [];
let respirationTimelines: gsap.core.Timeline[] = [];

// Load SVG content
onMounted(async () => {
  try {
    const response = await fetch('/assets/menorahshiviti2.svg');
    svgContent.value = await response.text();

    // Wait for DOM update then animate
    setTimeout(() => {
      isLoaded.value = true;
      animateEntrance();
      updateLighting();
      startIntelligentEmbers();
    }, 100);
  } catch (error) {
    console.error('Failed to load menorah SVG:', error);
  }

  // Load initial data
  await Promise.all([fetchDonations(), fetchConfig()]);

  // Listen for real-time events
  on('donation:new', (data: any) => {
    handleDonationNew(data.donation, data.stats);
    animateNeuralPropagation();
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

// Initial entrance animation
function animateEntrance(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Organic awakening from the depths
  gsap.fromTo(svg,
    { opacity: 0, y: 100, scale: 0.9, filter: 'blur(10px)' },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      duration: 4,
      ease: 'power3.out'
    }
  );
}

// A) Respiration Organique Différenciée
function startOrganicBreathing(): void {
  // Kill existing breathing timelines
  respirationTimelines.forEach(tl => tl.kill());
  respirationTimelines = [];

  // Lit elements breathe fast and deeply
  litElements.forEach((el, index) => {
    const duration = 2.5 + Math.random() * 1.5; // 2.5s - 4s
    const scaleAmount = 1 + (0.02 + Math.random() * 0.03); // 1.02 - 1.05
    const brightnessMin = 1.3;
    const brightnessMax = 1.5;
    const rotationAmount = -0.5 + Math.random() * 1; // -0.5° to +0.5°

    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(el, {
      scale: scaleAmount,
      filter: `brightness(${brightnessMax})`,
      rotation: rotationAmount,
      duration: duration,
      ease: 'sine.inOut',
      delay: Math.random() * 2 // Desynchronize
    });

    respirationTimelines.push(tl);
  });

  // Unlit elements have micro-breathing (sleeping)
  unlitElements.forEach((el, index) => {
    const duration = 3.5 + Math.random() * 2; // 3.5s - 5.5s (slower)
    const scaleAmount = 0.98 + Math.random() * 0.01; // 0.98 - 0.99 (tiny)
    const brightnessMin = 0.7;
    const brightnessMax = 0.75;

    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(el, {
      scale: scaleAmount,
      filter: `brightness(${brightnessMax})`,
      duration: duration,
      ease: 'sine.inOut',
      delay: Math.random() * 3
    });

    respirationTimelines.push(tl);
  });
}

// C) Micro-mouvements Organiques (for lit elements only)
function startOrganicMicroMovements(): void {
  litElements.forEach((el, index) => {
    // Random micro-rotation
    gsap.to(el, {
      rotation: () => -0.5 + Math.random() * 1,
      duration: () => 1 + Math.random() * 2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      delay: Math.random() * 2
    });

    // Random micro-translation
    gsap.to(el, {
      y: () => -1 + Math.random() * 2,
      x: () => -0.5 + Math.random() * 1,
      duration: () => 1.5 + Math.random() * 2.5,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      delay: Math.random() * 2
    });
  });
}

// Progressive lighting STRICTLY from bottom to top
function updateLighting(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Get all animated elements
  const elements = Array.from(svg.querySelectorAll('g[mask], svg > path')) as SVGGraphicsElement[];
  if (elements.length === 0) return;

  // Sort elements by Y position (bottom to top)
  const sortedElements = elements.sort((a, b) => {
    const getY = (el: SVGGraphicsElement) => {
      const maskAttr = el.getAttribute('mask');
      if (maskAttr) {
        const id = maskAttr.match(/#([^)]+)/)?.[1];
        const maskEl = id ? document.getElementById(id) : null;
        const y = maskEl?.getAttribute('y');
        if (y) return parseFloat(y);
      }
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

  // Separate lit and unlit elements
  litElements = sortedElements.slice(0, lightingLevel);
  unlitElements = sortedElements.slice(lightingLevel);

  // Apply base styles
  litElements.forEach((el) => {
    gsap.to(el, {
      opacity: 1,
      scale: 1,
      filter: 'brightness(1.4)',
      duration: 0.8,
      ease: 'power2.out'
    });
  });

  unlitElements.forEach((el) => {
    gsap.to(el, {
      opacity: 0.3,
      scale: 0.97,
      filter: 'brightness(0.7)',
      duration: 0.8,
      ease: 'power2.in'
    });
  });

  // Start differentiated breathing
  startOrganicBreathing();

  // Start micro-movements for lit elements
  startOrganicMicroMovements();
}

// B) Propagation Neuronale lors d'un Don
function animateNeuralPropagation(): void {
  // Play sound based on current tier
  if (currentTier.value >= 3) {
    playEmbrasement();
  } else if (currentTier.value >= 2) {
    playFlamme();
  } else {
    playEtincelle();
  }

  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Get sorted elements
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
  const newElementIndex = Math.floor((stats.value.percentComplete / 100) * totalElements) - 1;

  if (newElementIndex >= 0 && newElementIndex < totalElements) {
    const newElement = sortedElements[newElementIndex];
    const currentLitElements = sortedElements.slice(0, newElementIndex + 1);

    // 1. Newly lit element PULSES intensely (heart starting)
    gsap.fromTo(newElement,
      { scale: 0.8, filter: 'brightness(3)' },
      {
        scale: 1.2,
        filter: 'brightness(2)',
        duration: 0.4,
        ease: 'back.out(4)',
        onComplete: () => {
          gsap.to(newElement, {
            scale: 1,
            filter: 'brightness(1.4)',
            duration: 0.6,
            ease: 'elastic.out(1, 0.5)'
          });
        }
      }
    );

    // 2-3-4. Neural wave propagation through already lit elements
    const waveTimeline = gsap.timeline();

    // Upward wave
    currentLitElements.reverse().forEach((el, index) => {
      if (el === newElement) return;

      waveTimeline.to(el, {
        scale: 1.15,
        filter: 'brightness(2)',
        duration: 0.15,
        ease: 'power2.out'
      }, index * 0.08);

      waveTimeline.to(el, {
        scale: 1,
        filter: 'brightness(1.4)',
        duration: 0.2,
        ease: 'power2.in'
      }, index * 0.08 + 0.15);
    });

    // Downward ping-pong wave
    const reversedLitElements = [...currentLitElements].reverse();
    reversedLitElements.forEach((el, index) => {
      waveTimeline.to(el, {
        filter: 'brightness(1.8)',
        duration: 0.12,
        ease: 'power1.out'
      }, 1.2 + index * 0.06);

      waveTimeline.to(el, {
        filter: 'brightness(1.4)',
        duration: 0.15,
        ease: 'power1.in'
      }, 1.2 + index * 0.06 + 0.12);
    });

    // 5. Trigger ember burst from the newly lit element
    generateIntelligentEmberBurst(newElement);
  }

  // Refresh lighting after propagation
  setTimeout(() => updateLighting(), 2500);
}

// D) Braises Intelligentes
function startIntelligentEmbers(): void {
  emberInterval = window.setInterval(() => {
    if (litElements.length === 0) return;

    if (Math.random() < 0.3) { // 30% chance
      // Pick a random lit element (prefer higher ones)
      const weightedIndex = Math.floor(Math.pow(Math.random(), 0.7) * litElements.length);
      const sourceElement = litElements[weightedIndex];

      generateEmberFromElement(sourceElement);
    }
  }, 600);
}

function generateEmberFromElement(sourceElement: SVGGraphicsElement): void {
  try {
    const bbox = sourceElement.getBBox();
    const svgRect = svgContainer.value?.querySelector('svg')?.getBoundingClientRect();
    if (!svgRect) return;

    // Calculate relative position
    const relativeX = ((bbox.x + bbox.width / 2) / svgRect.width) * 100;
    const relativeY = ((bbox.y + bbox.height / 2) / svgRect.height) * 100;

    const ember = {
      id: nextEmberId++,
      x: relativeX + (Math.random() - 0.5) * 10,
      y: 100 - relativeY, // Invert Y for CSS positioning
      sourceY: 100 - relativeY
    };
    embers.value.push(ember);

    // Remove after animation
    setTimeout(() => {
      const index = embers.value.findIndex(e => e.id === ember.id);
      if (index !== -1) {
        embers.value.splice(index, 1);
      }
    }, 5000);
  } catch (e) {
    console.error('Failed to generate ember:', e);
  }
}

function generateIntelligentEmberBurst(sourceElement: SVGGraphicsElement): void {
  for (let i = 0; i < 12; i++) {
    setTimeout(() => {
      generateEmberFromElement(sourceElement);
    }, i * 100);
  }
}

// Watch stats changes to update lighting
watch(() => stats.value.percentComplete, () => {
  updateLighting();
});

onUnmounted(() => {
  gsap.killTweensOf('*');
  respirationTimelines.forEach(tl => tl.kill());
  if (emberInterval !== null) {
    clearInterval(emberInterval);
  }
});
</script>

<template>
  <div class="menorah-respiration">
    <!-- Deep blue background with organic pulsing halo - Style DisplayPage -->
    <div class="background">
      <div class="bg-gradient"></div>
      <div class="bg-stars"></div>
      <div class="bg-glow"></div>
      <div class="organic-halo"></div>
    </div>

    <!-- Intelligent embers rising from lit elements -->
    <div class="embers-container">
      <div
        v-for="ember in embers"
        :key="ember.id"
        class="ember"
        :class="{ curved: Math.random() > 0.5, bouncing: Math.random() > 0.7 }"
        :style="{
          left: `${ember.x}%`,
          bottom: `${ember.y}%`,
          '--source-y': ember.sourceY,
          '--random-x': Math.random() - 0.5,
          '--curve-strength': Math.random() * 0.5 + 0.5
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
.menorah-respiration {
  min-height: 100vh;
  background: #0a0a1a;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Background with organic pulsing halo - Style DisplayPage */
.background {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bg-gradient {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse 60% 40% at 80% 100%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
    radial-gradient(ellipse 60% 40% at 20% 100%, rgba(236, 72, 153, 0.08) 0%, transparent 50%),
    linear-gradient(180deg, #0a0a1a 0%, #111827 50%, #0f172a 100%);
}

.bg-stars {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(2px 2px at 20px 30px, rgba(255, 255, 255, 0.3), transparent),
    radial-gradient(2px 2px at 40px 70px, rgba(255, 255, 255, 0.2), transparent),
    radial-gradient(1px 1px at 90px 40px, rgba(255, 255, 255, 0.4), transparent),
    radial-gradient(2px 2px at 130px 80px, rgba(255, 255, 255, 0.2), transparent),
    radial-gradient(1px 1px at 160px 30px, rgba(255, 255, 255, 0.3), transparent);
  background-repeat: repeat;
  background-size: 200px 100px;
  animation: twinkle 4s ease-in-out infinite;
}

@keyframes twinkle {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.bg-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.08) 0%, transparent 70%);
  animation: pulse-glow 6s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.1); }
}

.organic-halo {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 1000px;
  height: 1000px;
  background: radial-gradient(
    circle,
    rgba(100, 181, 246, 0.12) 0%,
    rgba(63, 81, 181, 0.08) 30%,
    rgba(103, 58, 183, 0.04) 60%,
    transparent 80%
  );
  animation: organicPulse 7s ease-in-out infinite;
  filter: blur(60px);
}

@keyframes organicPulse {
  0% {
    opacity: 0.2;
    transform: translate(-50%, -50%) scale(0.95);
  }
  25% {
    opacity: 0.5;
    transform: translate(-50%, -50%) scale(1.05);
  }
  40% {
    opacity: 0.35;
    transform: translate(-50%, -50%) scale(1.02);
  }
  65% {
    opacity: 0.6;
    transform: translate(-50%, -50%) scale(1.1);
  }
  80% {
    opacity: 0.3;
    transform: translate(-50%, -50%) scale(0.98);
  }
  100% {
    opacity: 0.2;
    transform: translate(-50%, -50%) scale(0.95);
  }
}

/* Intelligent embers with curved trajectories */
.embers-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}

.ember {
  position: absolute;
  width: 5px;
  height: 5px;
  background: radial-gradient(circle, #FFF9C4 0%, #FFD54F 40%, #FFA726 100%);
  border-radius: 50%;
  box-shadow:
    0 0 10px #FFA726,
    0 0 20px rgba(255, 167, 38, 0.5),
    0 0 30px rgba(255, 167, 38, 0.2);
  animation: riseStraight 5s ease-out forwards;
}

.ember.curved {
  animation: riseCurved 5s ease-out forwards;
}

.ember.bouncing {
  animation: riseBouncing 5s ease-out forwards;
}

@keyframes riseStraight {
  0% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: 1;
    filter: blur(0);
  }
  20% {
    opacity: 0.95;
  }
  70% {
    opacity: 0.5;
    filter: blur(1px);
  }
  100% {
    transform: translateY(-80vh) translateX(calc(var(--random-x, 0) * 40px)) scale(0.2);
    opacity: 0;
    filter: blur(3px);
  }
}

@keyframes riseCurved {
  0% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: 1;
    filter: blur(0);
  }
  30% {
    transform: translateY(-25vh) translateX(calc(var(--random-x, 0) * 80px * var(--curve-strength, 1))) scale(0.9);
    opacity: 0.9;
  }
  60% {
    transform: translateY(-50vh) translateX(calc(var(--random-x, 0) * -60px * var(--curve-strength, 1))) scale(0.6);
    opacity: 0.6;
    filter: blur(1px);
  }
  100% {
    transform: translateY(-85vh) translateX(calc(var(--random-x, 0) * 30px)) scale(0.2);
    opacity: 0;
    filter: blur(3px);
  }
}

@keyframes riseBouncing {
  0% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: 1;
    filter: blur(0);
  }
  15% {
    transform: translateY(-15vh) translateX(calc(var(--random-x, 0) * 50px)) scale(0.95);
  }
  18% {
    transform: translateY(-14vh) translateX(calc(var(--random-x, 0) * 50px)) scale(0.9);
  }
  35% {
    transform: translateY(-35vh) translateX(calc(var(--random-x, 0) * -40px)) scale(0.8);
    opacity: 0.85;
  }
  38% {
    transform: translateY(-33vh) translateX(calc(var(--random-x, 0) * -40px)) scale(0.75);
  }
  70% {
    opacity: 0.4;
    filter: blur(1.5px);
  }
  100% {
    transform: translateY(-90vh) translateX(calc(var(--random-x, 0) * 20px)) scale(0.15);
    opacity: 0;
    filter: blur(4px);
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
  fill: #FFD700;
  transition: all 0.8s ease;
  transform-origin: center center;
}

/* Groups with masks */
.menorah-container :deep(g[mask]) {
  transition: all 0.8s ease;
  transform-origin: center center;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .menorah-container :deep(svg) {
    height: 70vh;
    max-height: 70vh;
  }

  .organic-halo {
    width: 600px;
    height: 600px;
  }
}

@media (min-width: 1200px) {
  .menorah-container :deep(svg) {
    height: 80vh;
    max-height: 80vh;
  }

  .organic-halo {
    width: 1200px;
    height: 1200px;
  }
}

@media (min-width: 1600px) {
  .menorah-container :deep(svg) {
    height: 85vh;
    max-height: 85vh;
  }
}
</style>
