<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { gsap } from 'gsap';
import { useDonations } from '../composables/useDonations';
import { useSocket } from '../composables/useSocket';
import { useSoundEffects } from '../composables/useSoundEffects';

const { stats, fetchDonations, fetchConfig, handleDonationNew, handleDonationUpdated, handleDonationDeleted, handleConfigUpdated } = useDonations();
const { on } = useSocket();
const { playTierTransition, playAccomplissement } = useSoundEffects();

const svgContainer = ref<HTMLDivElement | null>(null);
const svgContent = ref<string>('');
const isLoaded = ref(false);

// Halo glow elements tracking
const glowingElements = ref<Array<{
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
  pulsePhase: number;
}>>([]);

// Particle embers for incandescent effect
const incandescents = ref<Array<{
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  delay: number;
}>>([]);

let nextGlowId = 0;
let nextIncandescentId = 0;
let glowAnimationFrame: number | null = null;
let litElements: SVGGraphicsElement[] = [];

// Computed: Determine current tier based on progress
const currentTier = computed(() => {
  const percent = stats.value.percentComplete;
  if (percent === 100) return 5;
  if (percent >= 75) return 4;
  if (percent >= 50) return 3;
  if (percent >= 25) return 2;
  return 1;
});

// Previous tier tracking for transitions
const previousTier = ref(1);

// Tier-based glow configuration
const glowConfig = computed(() => {
  switch (currentTier.value) {
    case 1:
      return {
        baseGlow: 15,
        pulseAmplitude: 5,
        pulseSpeed: 3,
        haloLayers: 2,
        innerColor: 'rgba(255, 215, 0, 0.8)',
        midColor: 'rgba(255, 180, 0, 0.4)',
        outerColor: 'rgba(255, 140, 0, 0.1)',
        edgeBlur: 10,
        incandescentCount: 5
      };
    case 2:
      return {
        baseGlow: 25,
        pulseAmplitude: 8,
        pulseSpeed: 2.5,
        haloLayers: 3,
        innerColor: 'rgba(255, 220, 50, 0.9)',
        midColor: 'rgba(255, 190, 30, 0.5)',
        outerColor: 'rgba(255, 150, 0, 0.2)',
        edgeBlur: 15,
        incandescentCount: 10
      };
    case 3:
      return {
        baseGlow: 40,
        pulseAmplitude: 12,
        pulseSpeed: 2,
        haloLayers: 4,
        innerColor: 'rgba(255, 240, 100, 1)',
        midColor: 'rgba(255, 200, 50, 0.6)',
        outerColor: 'rgba(255, 160, 20, 0.3)',
        edgeBlur: 20,
        incandescentCount: 20
      };
    case 4:
      return {
        baseGlow: 60,
        pulseAmplitude: 18,
        pulseSpeed: 1.5,
        haloLayers: 5,
        innerColor: 'rgba(255, 255, 150, 1)',
        midColor: 'rgba(255, 230, 80, 0.7)',
        outerColor: 'rgba(255, 200, 50, 0.4)',
        edgeBlur: 30,
        incandescentCount: 35
      };
    case 5:
      return {
        baseGlow: 80,
        pulseAmplitude: 25,
        pulseSpeed: 1,
        haloLayers: 6,
        innerColor: 'rgba(255, 255, 200, 1)',
        midColor: 'rgba(255, 250, 150, 0.8)',
        outerColor: 'rgba(255, 220, 100, 0.5)',
        edgeBlur: 40,
        incandescentCount: 50
      };
    default:
      return glowConfig.value;
  }
});

// Load SVG and setup
onMounted(async () => {
  try {
    const response = await fetch('/assets/menorah.svg');
    svgContent.value = await response.text();

    await nextTick();

    setTimeout(() => {
      isLoaded.value = true;
      injectSVGFilters();
      animateEntrance();
      updateLighting();
      startGlowAnimation();
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

// Inject SVG filters for advanced glow effects
function injectSVGFilters(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Create defs element if not exists
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }

  // Incandescent glow filter - multi-layered
  const filterHtml = `
    <filter id="incandescentGlow" x="-100%" y="-100%" width="300%" height="300%">
      <!-- Layer 1: Tight inner glow -->
      <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur1"/>
      <feFlood flood-color="#FFFDE7" flood-opacity="1" result="color1"/>
      <feComposite in="color1" in2="blur1" operator="in" result="glow1"/>

      <!-- Layer 2: Medium glow -->
      <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur2"/>
      <feFlood flood-color="#FFD54F" flood-opacity="0.8" result="color2"/>
      <feComposite in="color2" in2="blur2" operator="in" result="glow2"/>

      <!-- Layer 3: Wide outer glow -->
      <feGaussianBlur in="SourceAlpha" stdDeviation="20" result="blur3"/>
      <feFlood flood-color="#FF8F00" flood-opacity="0.5" result="color3"/>
      <feComposite in="color3" in2="blur3" operator="in" result="glow3"/>

      <!-- Layer 4: Very wide ambient glow -->
      <feGaussianBlur in="SourceAlpha" stdDeviation="40" result="blur4"/>
      <feFlood flood-color="#FF6F00" flood-opacity="0.3" result="color4"/>
      <feComposite in="color4" in2="blur4" operator="in" result="glow4"/>

      <!-- Combine all layers -->
      <feMerge>
        <feMergeNode in="glow4"/>
        <feMergeNode in="glow3"/>
        <feMergeNode in="glow2"/>
        <feMergeNode in="glow1"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Edge highlight filter -->
    <filter id="edgeGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="dilated"/>
      <feGaussianBlur in="dilated" stdDeviation="4" result="blurred"/>
      <feFlood flood-color="#FFFFFF" flood-opacity="0.9" result="white"/>
      <feComposite in="white" in2="blurred" operator="in" result="edgeGlow"/>
      <feMerge>
        <feMergeNode in="edgeGlow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Pulsing halo filter -->
    <filter id="pulsingHalo" x="-150%" y="-150%" width="400%" height="400%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="15" result="blur"/>
      <feFlood flood-color="#FFF59D" flood-opacity="0.6" result="color"/>
      <feComposite in="color" in2="blur" operator="in" result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Dormant elements filter -->
    <filter id="dormantGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur"/>
      <feFlood flood-color="#5D4037" flood-opacity="0.3" result="color"/>
      <feComposite in="color" in2="blur" operator="in" result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  `;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = filterHtml;

  Array.from(tempDiv.children).forEach(filter => {
    const svgFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    svgFilter.innerHTML = filter.innerHTML;
    Array.from(filter.attributes).forEach(attr => {
      svgFilter.setAttribute(attr.name, attr.value);
    });
    defs!.appendChild(svgFilter);
  });
}

// Entrance animation
function animateEntrance(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  gsap.fromTo(svg,
    {
      opacity: 0,
      y: 80,
      scale: 0.85,
      filter: 'blur(20px) brightness(0.5)'
    },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px) brightness(1)',
      duration: 3,
      ease: 'power3.out'
    }
  );
}

// Start continuous glow animation
function startGlowAnimation(): void {
  let time = 0;

  function animate() {
    time += 0.016; // ~60fps

    // Update glow intensities for each lit element
    glowingElements.value.forEach((glow, index) => {
      const config = glowConfig.value;
      const phase = glow.pulsePhase + time * config.pulseSpeed;
      glow.intensity = config.baseGlow + Math.sin(phase) * config.pulseAmplitude;
    });

    // Apply CSS variable updates for halos
    updateHaloCSS();

    glowAnimationFrame = requestAnimationFrame(animate);
  }

  animate();
}

// Update CSS custom properties for halo effects
function updateHaloCSS(): void {
  if (!svgContainer.value) return;

  const container = svgContainer.value;
  const config = glowConfig.value;

  container.style.setProperty('--glow-base', `${config.baseGlow}px`);
  container.style.setProperty('--glow-inner', config.innerColor);
  container.style.setProperty('--glow-mid', config.midColor);
  container.style.setProperty('--glow-outer', config.outerColor);
}

// Progressive lighting from bottom to top with incandescent halos
function updateLighting(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  const elements = Array.from(svg.querySelectorAll('g[mask], svg > path')) as SVGGraphicsElement[];
  if (elements.length === 0) return;

  // Sort by Y (bottom to top)
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

  litElements = sortedElements.slice(0, lightingLevel);
  const unlitElements = sortedElements.slice(lightingLevel);

  // Clear and rebuild glow tracking
  glowingElements.value = [];

  // Light up elements with incandescent glow
  litElements.forEach((el, index) => {
    // Apply incandescent filter
    el.setAttribute('filter', 'url(#incandescentGlow)');

    gsap.to(el, {
      opacity: 1,
      scale: 1,
      duration: 0.8,
      ease: 'power2.out'
    });

    // Track for glow animation
    try {
      const bbox = el.getBBox();
      glowingElements.value.push({
        id: nextGlowId++,
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height / 2,
        width: bbox.width,
        height: bbox.height,
        intensity: glowConfig.value.baseGlow,
        pulsePhase: Math.random() * Math.PI * 2
      });
    } catch (e) {
      // Ignore bbox errors
    }
  });

  // Unlit elements with dormant filter
  unlitElements.forEach((el) => {
    el.setAttribute('filter', 'url(#dormantGlow)');

    gsap.to(el, {
      opacity: 0.25,
      scale: 0.97,
      duration: 0.8,
      ease: 'power2.in'
    });
  });

  // Generate incandescent particles around lit zone
  generateIncandescentParticles();

  // Start breathing animation
  startIncandescentBreathing();
}

// Generate floating incandescent particles near lit elements
function generateIncandescentParticles(): void {
  incandescents.value = [];

  const count = glowConfig.value.incandescentCount;

  for (let i = 0; i < count; i++) {
    incandescents.value.push({
      id: nextIncandescentId++,
      x: 30 + Math.random() * 40,
      y: 20 + Math.random() * 60,
      size: 2 + Math.random() * 6,
      opacity: 0.3 + Math.random() * 0.7,
      delay: Math.random() * 5
    });
  }
}

// Breathing animation for lit elements
function startIncandescentBreathing(): void {
  litElements.forEach((el, index) => {
    const duration = 2 + Math.random() * 2;
    const delay = Math.random() * 2;

    // Scale breathing
    gsap.to(el, {
      scale: 1.02,
      duration: duration,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      delay: delay
    });
  });
}

// Animation when new donation arrives
function animateNewDonation(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Flash effect
  gsap.fromTo(svg,
    { filter: 'brightness(3) blur(5px)' },
    {
      filter: 'brightness(1) blur(0px)',
      duration: 0.8,
      ease: 'power2.out'
    }
  );

  // Pulse wave through lit elements
  litElements.forEach((el, index) => {
    gsap.fromTo(el,
      { scale: 1.3 },
      {
        scale: 1,
        duration: 0.5,
        delay: index * 0.05,
        ease: 'elastic.out(1, 0.5)'
      }
    );
  });

  // Burst of incandescent particles
  const burstCount = 20 + currentTier.value * 10;
  for (let i = 0; i < burstCount; i++) {
    setTimeout(() => {
      incandescents.value.push({
        id: nextIncandescentId++,
        x: 40 + Math.random() * 20,
        y: 30 + Math.random() * 40,
        size: 3 + Math.random() * 8,
        opacity: 0.8 + Math.random() * 0.2,
        delay: 0
      });

      // Remove after animation
      setTimeout(() => {
        incandescents.value.shift();
      }, 4000);
    }, i * 30);
  }

  // Update lighting
  updateLighting();
}

// Tier transition
function animateTierTransition(newTier: number): void {
  console.log(`Transitioning to tier ${newTier}`);

  playTierTransition(previousTier.value, newTier);

  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Intense flash
  gsap.fromTo(svg,
    { filter: 'brightness(4) saturate(2)' },
    {
      filter: 'brightness(1) saturate(1)',
      duration: 1.5,
      ease: 'power2.out'
    }
  );

  // Scale pulse
  gsap.fromTo(svg,
    { scale: 1.1 },
    {
      scale: 1,
      duration: 1,
      ease: 'elastic.out(1, 0.5)'
    }
  );
}

// Watch for tier changes
watch(currentTier, (newTier, oldTier) => {
  if (newTier !== oldTier) {
    previousTier.value = oldTier;
    animateTierTransition(newTier);

    if (newTier === 5) {
      playAccomplissement();
    }
  }
});

// Watch stats changes
watch(() => stats.value.percentComplete, () => {
  updateLighting();
});

onUnmounted(() => {
  gsap.killTweensOf('*');
  if (glowAnimationFrame !== null) {
    cancelAnimationFrame(glowAnimationFrame);
  }
});
</script>

<template>
  <div class="menorah-incandescent">
    <!-- Deep background -->
    <div class="background">
      <div class="bg-base"></div>
      <div class="bg-ambient-glow"></div>
      <div class="bg-radial-heat"></div>
    </div>

    <!-- Floating incandescent particles -->
    <div class="incandescent-container">
      <div
        v-for="particle in incandescents"
        :key="particle.id"
        class="incandescent-particle"
        :style="{
          left: `${particle.x}%`,
          top: `${particle.y}%`,
          width: `${particle.size}px`,
          height: `${particle.size}px`,
          opacity: particle.opacity,
          animationDelay: `${particle.delay}s`
        }"
      ></div>
    </div>

    <!-- Edge glow layer - follows lit elements -->
    <div class="edge-glow-layer">
      <div
        v-for="glow in glowingElements"
        :key="glow.id"
        class="edge-glow"
        :style="{
          left: `${(glow.x / 800) * 100}%`,
          top: `${(glow.y / 600) * 100}%`,
          width: `${glow.width + glow.intensity}px`,
          height: `${glow.height + glow.intensity}px`,
          '--glow-size': `${glow.intensity}px`
        }"
      ></div>
    </div>

    <!-- Main menorah SVG -->
    <div class="menorah-wrapper">
      <div
        ref="svgContainer"
        class="menorah-container"
        :class="{ loaded: isLoaded, [`tier-${currentTier}`]: true }"
        v-html="svgContent"
      ></div>
    </div>

    <!-- Halo rings around lit zone -->
    <div class="halo-rings" :class="{ active: litElements.length > 0 }">
      <div class="halo-ring ring-1"></div>
      <div class="halo-ring ring-2"></div>
      <div class="halo-ring ring-3"></div>
      <div v-if="currentTier >= 3" class="halo-ring ring-4"></div>
      <div v-if="currentTier >= 4" class="halo-ring ring-5"></div>
      <div v-if="currentTier >= 5" class="halo-ring ring-6"></div>
    </div>

    <!-- Tier indicator -->
    <div class="tier-indicator">
      Tier {{ currentTier }} - {{ Math.round(stats.percentComplete) }}%
    </div>
  </div>
</template>

<style scoped>
.menorah-incandescent {
  min-height: 100vh;
  background: #030303;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Background layers */
.background {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bg-base {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 80%, #1a0a00 0%, #030303 60%);
}

.bg-ambient-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 100% 80% at 50% 100%,
    rgba(255, 140, 0, 0.08) 0%,
    rgba(255, 100, 0, 0.04) 30%,
    transparent 60%
  );
  animation: ambientPulse 8s ease-in-out infinite;
}

@keyframes ambientPulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.bg-radial-heat {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -30%);
  width: 150vmax;
  height: 150vmax;
  background: radial-gradient(
    circle,
    rgba(255, 200, 100, 0.05) 0%,
    rgba(255, 150, 50, 0.03) 20%,
    transparent 50%
  );
  animation: heatPulse 6s ease-in-out infinite;
}

@keyframes heatPulse {
  0%, 100% {
    transform: translate(-50%, -30%) scale(1);
    opacity: 0.6;
  }
  50% {
    transform: translate(-50%, -30%) scale(1.1);
    opacity: 1;
  }
}

/* Incandescent floating particles */
.incandescent-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 15;
}

.incandescent-particle {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 200, 1) 0%,
    rgba(255, 220, 100, 0.8) 30%,
    rgba(255, 180, 50, 0.4) 60%,
    transparent 100%
  );
  box-shadow:
    0 0 10px rgba(255, 220, 100, 0.8),
    0 0 20px rgba(255, 180, 50, 0.5),
    0 0 40px rgba(255, 140, 0, 0.3);
  animation: floatIncandescent 5s ease-in-out infinite;
  filter: blur(1px);
}

@keyframes floatIncandescent {
  0%, 100% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: var(--base-opacity, 0.6);
  }
  25% {
    transform: translateY(-20px) translateX(10px) scale(1.1);
    opacity: calc(var(--base-opacity, 0.6) * 1.2);
  }
  50% {
    transform: translateY(-10px) translateX(-15px) scale(0.9);
    opacity: var(--base-opacity, 0.6);
  }
  75% {
    transform: translateY(-30px) translateX(5px) scale(1.15);
    opacity: calc(var(--base-opacity, 0.6) * 1.3);
  }
}

/* Edge glow layer */
.edge-glow-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}

.edge-glow {
  position: absolute;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: radial-gradient(
    circle,
    var(--glow-inner, rgba(255, 255, 200, 0.3)) 0%,
    var(--glow-mid, rgba(255, 200, 100, 0.15)) 40%,
    var(--glow-outer, rgba(255, 150, 50, 0.05)) 70%,
    transparent 100%
  );
  filter: blur(var(--glow-size, 20px));
  animation: edgePulse 3s ease-in-out infinite;
}

@keyframes edgePulse {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.7;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.15);
    opacity: 1;
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
  transition: opacity 0.5s ease;
  --glow-base: 15px;
  --glow-inner: rgba(255, 215, 0, 0.8);
  --glow-mid: rgba(255, 180, 0, 0.4);
  --glow-outer: rgba(255, 140, 0, 0.1);
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

/* Base path styles */
.menorah-container :deep(path) {
  fill: #D4A017;
  transition: all 0.8s ease;
  transform-origin: center center;
}

/* Groups with masks */
.menorah-container :deep(g[mask]) {
  transition: all 0.8s ease;
  transform-origin: center center;
}

/* Tier-specific container effects */
.menorah-container.tier-1 :deep(svg) {
  filter: drop-shadow(0 0 15px rgba(255, 200, 100, 0.3));
}

.menorah-container.tier-2 :deep(svg) {
  filter: drop-shadow(0 0 25px rgba(255, 200, 100, 0.4))
          drop-shadow(0 0 50px rgba(255, 150, 50, 0.2));
}

.menorah-container.tier-3 :deep(svg) {
  filter: drop-shadow(0 0 30px rgba(255, 220, 100, 0.5))
          drop-shadow(0 0 60px rgba(255, 180, 50, 0.3))
          drop-shadow(0 0 100px rgba(255, 140, 0, 0.15));
}

.menorah-container.tier-4 :deep(svg) {
  filter: drop-shadow(0 0 40px rgba(255, 240, 150, 0.6))
          drop-shadow(0 0 80px rgba(255, 200, 80, 0.4))
          drop-shadow(0 0 120px rgba(255, 160, 30, 0.2));
}

.menorah-container.tier-5 :deep(svg) {
  filter: drop-shadow(0 0 50px rgba(255, 255, 200, 0.8))
          drop-shadow(0 0 100px rgba(255, 240, 150, 0.5))
          drop-shadow(0 0 150px rgba(255, 200, 100, 0.3))
          drop-shadow(0 0 200px rgba(255, 180, 50, 0.15));
}

/* Halo rings around the lit zone */
.halo-rings {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 1;
  opacity: 0;
  transition: opacity 1s ease;
}

.halo-rings.active {
  opacity: 1;
}

.halo-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 2px solid transparent;
}

.ring-1 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, transparent 60%, rgba(255, 220, 100, 0.15) 100%);
  animation: ringPulse1 4s ease-in-out infinite;
}

.ring-2 {
  width: 450px;
  height: 450px;
  background: radial-gradient(circle, transparent 70%, rgba(255, 200, 80, 0.1) 100%);
  animation: ringPulse2 5s ease-in-out infinite;
}

.ring-3 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, transparent 75%, rgba(255, 180, 60, 0.08) 100%);
  animation: ringPulse3 6s ease-in-out infinite;
}

.ring-4 {
  width: 800px;
  height: 800px;
  background: radial-gradient(circle, transparent 80%, rgba(255, 160, 40, 0.06) 100%);
  animation: ringPulse4 7s ease-in-out infinite;
}

.ring-5 {
  width: 1000px;
  height: 1000px;
  background: radial-gradient(circle, transparent 82%, rgba(255, 140, 20, 0.04) 100%);
  animation: ringPulse5 8s ease-in-out infinite;
}

.ring-6 {
  width: 1200px;
  height: 1200px;
  background: radial-gradient(circle, transparent 85%, rgba(255, 255, 200, 0.05) 100%);
  animation: ringPulse6 9s ease-in-out infinite;
}

@keyframes ringPulse1 {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
  50% { transform: translate(-50%, -50%) scale(1.05); opacity: 1; }
}

@keyframes ringPulse2 {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
  50% { transform: translate(-50%, -50%) scale(1.08); opacity: 0.9; }
}

@keyframes ringPulse3 {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
  50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.8; }
}

@keyframes ringPulse4 {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
  50% { transform: translate(-50%, -50%) scale(1.12); opacity: 0.7; }
}

@keyframes ringPulse5 {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
  50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.6; }
}

@keyframes ringPulse6 {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
  50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.5; }
}

/* Tier indicator */
.tier-indicator {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 24px;
  background: rgba(0, 0, 0, 0.8);
  color: #FFD54F;
  font-size: 16px;
  font-weight: bold;
  border-radius: 8px;
  border: 2px solid rgba(255, 200, 80, 0.4);
  z-index: 100;
  backdrop-filter: blur(10px);
  font-family: system-ui, -apple-system, sans-serif;
  box-shadow: 0 0 20px rgba(255, 180, 50, 0.2);
}

/* Responsive */
@media (max-width: 768px) {
  .menorah-container :deep(svg) {
    height: 70vh;
    max-height: 70vh;
  }

  .ring-1 { width: 200px; height: 200px; }
  .ring-2 { width: 300px; height: 300px; }
  .ring-3 { width: 400px; height: 400px; }
  .ring-4 { width: 500px; height: 500px; }
  .ring-5 { width: 600px; height: 600px; }
  .ring-6 { width: 700px; height: 700px; }

  .tier-indicator {
    font-size: 14px;
    padding: 8px 16px;
    top: 10px;
    right: 10px;
  }
}

@media (min-width: 1200px) {
  .menorah-container :deep(svg) {
    height: 80vh;
    max-height: 80vh;
  }
}

@media (min-width: 1600px) {
  .menorah-container :deep(svg) {
    height: 85vh;
    max-height: 85vh;
  }
}
</style>
