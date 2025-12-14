<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
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
const embers = ref<Array<{ id: number; x: number; y: number; size: number }>>([]);
const confetti = ref<Array<{ id: number; x: number; y: number }>>([]);
const lightRays = ref<Array<{ id: number; delay: number }>>([]);
let emberInterval: number | null = null;
let nextEmberId = 0;
let nextConfettiId = 0;
let finalAnimationPlayed = ref(false);

// Computed: Determine current tier based on progress
const currentTier = computed(() => {
  const percent = stats.value.percentComplete;
  if (percent === 100) return 5;
  if (percent >= 75) return 4;
  if (percent >= 50) return 3;
  if (percent >= 25) return 2;
  return 1;
});

// Computed: Tier configuration
const tierConfig = computed(() => {
  switch (currentTier.value) {
    case 1: // 0-25%: L'Éveil
      return {
        name: 'L\'Éveil',
        background: '#020202',
        haloSize: 400,
        haloPulseSpeed: 4,
        haloOpacity: 0.15,
        emberFrequency: 0.2,
        emberSize: { min: 1, max: 2 },
        brightness: 1.2,
        extraEffects: false
      };
    case 2: // 25-50%: La Montée
      return {
        name: 'La Montée',
        background: 'radial-gradient(ellipse at center, rgba(139, 69, 19, 0.15) 0%, #020202 60%)',
        haloSize: 600,
        haloPulseSpeed: 3,
        haloOpacity: 0.25,
        emberFrequency: 0.4,
        emberSize: { min: 1.5, max: 3 },
        brightness: 1.35,
        extraEffects: true,
        showLightLines: true
      };
    case 3: // 50-75%: L'Embrasement
      return {
        name: 'L\'Embrasement',
        background: 'radial-gradient(ellipse at 50% 80%, rgba(139, 69, 19, 0.3) 0%, rgba(101, 67, 33, 0.2) 30%, #020202 70%)',
        haloSize: 900,
        haloPulseSpeed: 2,
        haloOpacity: 0.4,
        emberFrequency: 0.7,
        emberSize: { min: 2, max: 8 },
        brightness: 1.5,
        extraEffects: true,
        showLightLines: true,
        showHeartbeat: true,
        glowEffect: 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.4))'
      };
    case 4: // 75-100%: L'Apothéose
      return {
        name: 'L\'Apothéose',
        background: 'radial-gradient(ellipse at 50% 100%, rgba(255, 215, 0, 0.25) 0%, rgba(255, 255, 255, 0.15) 20%, rgba(139, 69, 19, 0.2) 40%, #020202 70%)',
        haloSize: 1200,
        haloPulseSpeed: 4,
        haloOpacity: 0.6,
        emberFrequency: 0.95,
        emberSize: { min: 3, max: 10 },
        brightness: 1.7,
        extraEffects: true,
        showLightLines: true,
        showHeartbeat: true,
        showLightRays: true,
        glowEffect: 'drop-shadow(0 0 40px rgba(255, 215, 0, 0.8)) drop-shadow(0 0 80px rgba(255, 215, 0, 0.4))'
      };
    case 5: // 100%: L'Accomplissement
      return {
        name: 'L\'Accomplissement',
        background: 'radial-gradient(ellipse at 50% 100%, rgba(255, 255, 255, 0.3) 0%, rgba(255, 215, 0, 0.25) 30%, rgba(139, 69, 19, 0.15) 50%, #020202 80%)',
        haloSize: 1400,
        haloPulseSpeed: 3,
        haloOpacity: 0.8,
        emberFrequency: 1,
        emberSize: { min: 3, max: 12 },
        brightness: 2,
        extraEffects: true,
        showLightLines: true,
        showHeartbeat: true,
        showLightRays: true,
        showVictoryMode: true,
        glowEffect: 'drop-shadow(0 0 60px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 120px rgba(255, 215, 0, 0.6))'
      };
    default:
      return tierConfig.value;
  }
});

// Previous tier tracking for transitions
const previousTier = ref(1);

// Load SVG content
onMounted(async () => {
  try {
    const response = await fetch('/assets/menorahshiviti3.svg');
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

  // Initialize light rays for tier 4+
  initializeLightRays();
});

// Initialize light rays
function initializeLightRays(): void {
  for (let i = 0; i < 8; i++) {
    lightRays.value.push({
      id: i,
      delay: i * 0.5
    });
  }
}

// Initial entrance animation
function animateEntrance(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  gsap.fromTo(svg,
    { opacity: 0, y: 60, scale: 0.8 },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 2.5,
      ease: 'power3.out'
    }
  );
}

// Permanent subtle pulse
function startSubtlePulse(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  gsap.to(svg, {
    scale: 0.97,
    duration: tierConfig.value.haloPulseSpeed,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut'
  });
}

// Progressive lighting from bottom to top, group by group (each word)
function updateLighting(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Get only direct child groups with mask (each represents a word/group)
  const elements = Array.from(svg.querySelectorAll(':scope > g[mask]')) as SVGGraphicsElement[];

  if (elements.length === 0) return;

  // Sort elements by Y position (bottom to top)
  const sortedElements = elements.sort((a, b) => {
    const getY = (el: SVGGraphicsElement) => {
      const maskAttr = el.getAttribute('mask');
      if (maskAttr) {
        const id = maskAttr.match(/#([^)]+)/)?.[1];
        const maskEl = id ? svg.querySelector(`#${id}`) : null;
        if (maskEl) {
          const rect = maskEl.querySelector('path, rect');
          if (rect) {
            try { return rect.getBBox().y; } catch (e) { return 0; }
          }
        }
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
        filter: `brightness(${tierConfig.value.brightness}) ${tierConfig.value.glowEffect || ''}`,
        duration: 0.8,
        ease: 'power2.out'
      });
    } else {
      gsap.to(el, {
        opacity: 0.3,
        scale: 0.97,
        filter: 'brightness(0.7)',
        duration: 0.8,
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

  const tier = currentTier.value;

  // Base flash intensity based on tier
  const flashIntensity = 1.5 + (tier * 0.3);
  gsap.fromTo(svg,
    { filter: `brightness(${flashIntensity})` },
    {
      filter: `brightness(${tierConfig.value.brightness})`,
      duration: 0.6,
      ease: 'power2.out'
    }
  );

  // Shake effect (more intense at higher tiers)
  if (tier >= 2) {
    const shakeAmount = tier * 3;
    gsap.from(svg, {
      x: -shakeAmount,
      duration: 0.15,
      ease: 'power1.inOut',
      yoyo: true,
      repeat: tier + 1
    });
  }

  // Light lines effect (tier 2+)
  if (tier >= 2 && tierConfig.value.showLightLines) {
    createLightLine();
  }

  // Confetti effect (tier 3+)
  if (tier >= 3) {
    generateConfettiBurst();
  }

  // Heartbeat effect (tier 3+)
  if (tier >= 3 && tierConfig.value.showHeartbeat) {
    createHeartbeat();
  }

  // Circular wave effect (tier 4+)
  if (tier >= 4) {
    createCircularWave();
  }

  // Trigger progressive lighting update
  updateLighting();

  // Ember burst
  generateEmberBurst();
}

// Create horizontal light line
function createLightLine(): void {
  const line = document.createElement('div');
  line.className = 'light-line';
  line.style.top = `${20 + Math.random() * 60}%`;
  document.querySelector('.effects-container')?.appendChild(line);

  gsap.fromTo(line,
    { left: '-100%', opacity: 0 },
    {
      left: '100%',
      opacity: 1,
      duration: 1.2,
      ease: 'power2.inOut',
      onComplete: () => line.remove()
    }
  );
}

// Create heartbeat screen pulse
function createHeartbeat(): void {
  const overlay = document.querySelector('.heartbeat-overlay') as HTMLElement;
  if (!overlay) return;

  gsap.fromTo(overlay,
    { opacity: 0.3 },
    {
      opacity: 0,
      duration: 0.8,
      ease: 'power2.out'
    }
  );
}

// Create circular wave
function createCircularWave(): void {
  const wave = document.createElement('div');
  wave.className = 'circular-wave';
  document.querySelector('.effects-container')?.appendChild(wave);

  gsap.fromTo(wave,
    { scale: 0, opacity: 0.8 },
    {
      scale: 3,
      opacity: 0,
      duration: 2,
      ease: 'power2.out',
      onComplete: () => wave.remove()
    }
  );
}

// Generate ember particles
function startEmberGeneration(): void {
  emberInterval = window.setInterval(() => {
    const frequency = tierConfig.value.emberFrequency;
    if (Math.random() < frequency) {
      const sizeConfig = tierConfig.value.emberSize;
      const ember = {
        id: nextEmberId++,
        x: 35 + Math.random() * 30,
        y: 5,
        size: sizeConfig.min + Math.random() * (sizeConfig.max - sizeConfig.min)
      };
      embers.value.push(ember);

      setTimeout(() => {
        const index = embers.value.findIndex(e => e.id === ember.id);
        if (index !== -1) {
          embers.value.splice(index, 1);
        }
      }, 5000);
    }
  }, 200);
}

// Generate ember burst on donation
function generateEmberBurst(): void {
  const burstCount = 10 + (currentTier.value * 5);
  for (let i = 0; i < burstCount; i++) {
    setTimeout(() => {
      const sizeConfig = tierConfig.value.emberSize;
      const ember = {
        id: nextEmberId++,
        x: 40 + Math.random() * 20,
        y: 10,
        size: sizeConfig.min + Math.random() * (sizeConfig.max - sizeConfig.min)
      };
      embers.value.push(ember);

      setTimeout(() => {
        const index = embers.value.findIndex(e => e.id === ember.id);
        if (index !== -1) {
          embers.value.splice(index, 1);
        }
      }, 4000);
    }, i * 60);
  }
}

// Generate confetti burst
function generateConfettiBurst(): void {
  const confettiCount = 20 + (currentTier.value * 10);
  for (let i = 0; i < confettiCount; i++) {
    setTimeout(() => {
      const confettiPiece = {
        id: nextConfettiId++,
        x: 45 + Math.random() * 10,
        y: 50
      };
      confetti.value.push(confettiPiece);

      setTimeout(() => {
        const index = confetti.value.findIndex(c => c.id === confettiPiece.id);
        if (index !== -1) {
          confetti.value.splice(index, 1);
        }
      }, 3000);
    }, i * 40);
  }
}

// Play final animation when reaching 100%
function playFinalAnimation(): void {
  if (finalAnimationPlayed.value) return;
  finalAnimationPlayed.value = true;

  const body = document.body;

  // 1. White flash
  const flash = document.createElement('div');
  flash.className = 'final-flash';
  body.appendChild(flash);

  gsap.fromTo(flash,
    { opacity: 1 },
    {
      opacity: 0,
      duration: 0.3,
      onComplete: () => flash.remove()
    }
  );

  // 2. Zoom out
  if (svgContainer.value) {
    const svg = svgContainer.value.querySelector('svg');
    if (svg) {
      gsap.to(svg, {
        scale: 0.85,
        duration: 2,
        ease: 'power2.inOut'
      });
    }
  }

  // 3. Exploding halo rings
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const ring = document.createElement('div');
      ring.className = 'exploding-ring';
      document.querySelector('.effects-container')?.appendChild(ring);

      gsap.fromTo(ring,
        { scale: 0, opacity: 0.8 },
        {
          scale: 4,
          opacity: 0,
          duration: 2.5,
          ease: 'power2.out',
          onComplete: () => ring.remove()
        }
      );
    }, i * 300);
  }

  // 4. Golden particle rain
  for (let i = 0; i < 100; i++) {
    setTimeout(() => {
      const particle = document.createElement('div');
      particle.className = 'golden-particle';
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animationDelay = `${Math.random() * 2}s`;
      document.querySelector('.effects-container')?.appendChild(particle);

      setTimeout(() => particle.remove(), 4000);
    }, i * 20);
  }
}

// Tier transition animation
function animateTierTransition(newTier: number): void {
  console.log(`Transitioning to tier ${newTier}: ${tierConfig.value.name}`);

  // Play tier transition sound
  playTierTransition(previousTier.value, newTier);

  // Light wave from bottom to top
  const wave = document.createElement('div');
  wave.className = 'tier-transition-wave';
  document.querySelector('.effects-container')?.appendChild(wave);

  gsap.fromTo(wave,
    { bottom: '0%', opacity: 0.8 },
    {
      bottom: '100%',
      opacity: 0,
      duration: 2,
      ease: 'power2.inOut',
      onComplete: () => wave.remove()
    }
  );

  // Update halo progressively
  const halo = document.querySelector('.pulsing-halo') as HTMLElement;
  if (halo) {
    gsap.to(halo, {
      width: `${tierConfig.value.haloSize}px`,
      height: `${tierConfig.value.haloSize}px`,
      opacity: tierConfig.value.haloOpacity,
      duration: 2,
      ease: 'power2.inOut'
    });
  }

  // Burst of embers
  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const sizeConfig = tierConfig.value.emberSize;
      const ember = {
        id: nextEmberId++,
        x: 30 + Math.random() * 40,
        y: 5,
        size: sizeConfig.min + Math.random() * (sizeConfig.max - sizeConfig.min)
      };
      embers.value.push(ember);

      setTimeout(() => {
        const index = embers.value.findIndex(e => e.id === ember.id);
        if (index !== -1) {
          embers.value.splice(index, 1);
        }
      }, 5000);
    }, i * 50);
  }
}

// Watch for tier changes
watch(currentTier, (newTier, oldTier) => {
  if (newTier !== oldTier) {
    previousTier.value = oldTier;
    animateTierTransition(newTier);

    // Play final animation only once when reaching 100%
    if (newTier === 5) {
      playAccomplissement();
      setTimeout(() => playFinalAnimation(), 500);
    }
  }
});

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
  <div class="menorah-ascension">
    <!-- Dynamic background based on tier -->
    <div class="background" :style="{ background: tierConfig.background }">
      <div class="bg-gradient"></div>
      <div class="bg-stars"></div>
      <div class="bg-glow"></div>
      <div class="pulsing-halo"></div>
    </div>

    <!-- Heartbeat overlay (tier 3+) -->
    <div v-if="tierConfig.showHeartbeat" class="heartbeat-overlay"></div>

    <!-- Light rays from top (tier 4+) -->
    <div v-if="tierConfig.showLightRays" class="light-rays-container">
      <div
        v-for="ray in lightRays"
        :key="ray.id"
        class="light-ray"
        :style="{ animationDelay: `${ray.delay}s` }"
      ></div>
    </div>

    <!-- Effects container for dynamic elements -->
    <div class="effects-container"></div>

    <!-- Embers rising from base -->
    <div class="embers-container">
      <div
        v-for="ember in embers"
        :key="ember.id"
        class="ember"
        :style="{
          left: `${ember.x}%`,
          bottom: `${ember.y}%`,
          width: `${ember.size}px`,
          height: `${ember.size}px`
        }"
      ></div>
    </div>

    <!-- Confetti particles (tier 3+) -->
    <div class="confetti-container">
      <div
        v-for="piece in confetti"
        :key="piece.id"
        class="confetti"
        :style="{
          left: `${piece.x}%`,
          top: `${piece.y}%`
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

    <!-- Tier indicator (optional, for debugging) -->
    <div class="tier-indicator">
      {{ tierConfig.name }} - {{ Math.round(stats.percentComplete) }}%
    </div>
  </div>
</template>

<style scoped>
.menorah-ascension {
  min-height: 100vh;
  background: #0a0a1a;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Background with dynamic gradient - Style DisplayPage */
.background {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transition: background 2s ease;
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

.pulsing-halo {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  height: 400px;
  background: radial-gradient(
    circle,
    rgba(255, 215, 0, 0.15) 0%,
    rgba(255, 255, 255, 0.1) 30%,
    transparent 70%
  );
  animation: pulseHalo 4s ease-in-out infinite;
  filter: blur(80px);
  transition: width 2s ease, height 2s ease, opacity 2s ease;
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

/* Heartbeat overlay */
.heartbeat-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(255, 215, 0, 0.1) 0%, transparent 60%);
  opacity: 0;
  pointer-events: none;
  z-index: 3;
}

/* Light rays from top */
.light-rays-container {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}

.light-ray {
  position: absolute;
  top: -10%;
  left: 50%;
  width: 2px;
  height: 60%;
  background: linear-gradient(to bottom, rgba(255, 215, 0, 0.6), transparent);
  transform-origin: top center;
  animation: rotateRay 8s linear infinite;
  filter: blur(2px);
}

.light-ray:nth-child(1) { transform: translateX(-50%) rotate(-30deg); }
.light-ray:nth-child(2) { transform: translateX(-50%) rotate(-15deg); }
.light-ray:nth-child(3) { transform: translateX(-50%) rotate(0deg); }
.light-ray:nth-child(4) { transform: translateX(-50%) rotate(15deg); }
.light-ray:nth-child(5) { transform: translateX(-50%) rotate(30deg); }
.light-ray:nth-child(6) { transform: translateX(-50%) rotate(45deg); }
.light-ray:nth-child(7) { transform: translateX(-50%) rotate(-45deg); }
.light-ray:nth-child(8) { transform: translateX(-50%) rotate(60deg); }

@keyframes rotateRay {
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.7;
  }
}

/* Effects container for dynamic elements */
.effects-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 15;
}

/* Embers rising from base */
.embers-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}

.ember {
  position: absolute;
  background: #FFD700;
  border-radius: 50%;
  box-shadow: 0 0 8px #FFD700, 0 0 16px rgba(255, 215, 0, 0.6);
  animation: riseEmber 5s linear forwards;
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
    transform: translateY(-80vh) translateX(calc(-40px + 80px * var(--random, 0.5))) scale(0.2);
    opacity: 0;
    filter: blur(3px);
  }
}

/* Confetti particles */
.confetti-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}

.confetti {
  position: absolute;
  width: 6px;
  height: 12px;
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  animation: fallConfetti 3s ease-out forwards;
}

@keyframes fallConfetti {
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(60vh) rotate(720deg) scale(0.3);
    opacity: 0;
  }
}

/* Light line effect */
.effects-container :deep(.light-line) {
  position: absolute;
  width: 100%;
  height: 2px;
  background: linear-gradient(to right, transparent, rgba(255, 215, 0, 0.8), transparent);
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.6);
}

/* Circular wave effect */
.effects-container :deep(.circular-wave) {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 300px;
  height: 300px;
  border: 3px solid rgba(255, 215, 0, 0.6);
  border-radius: 50%;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
}

/* Tier transition wave */
.effects-container :deep(.tier-transition-wave) {
  position: absolute;
  left: 0;
  right: 0;
  height: 100%;
  background: linear-gradient(to top, rgba(255, 215, 0, 0.4), transparent);
  filter: blur(40px);
}

/* Final animation elements */
.final-flash {
  position: fixed;
  inset: 0;
  background: white;
  z-index: 9999;
}

.effects-container :deep(.exploding-ring) {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  height: 400px;
  border: 4px solid rgba(255, 215, 0, 0.8);
  border-radius: 50%;
  box-shadow: 0 0 40px rgba(255, 215, 0, 0.6), inset 0 0 40px rgba(255, 215, 0, 0.4);
}

.effects-container :deep(.golden-particle) {
  position: absolute;
  top: 0;
  width: 4px;
  height: 4px;
  background: #FFD700;
  border-radius: 50%;
  box-shadow: 0 0 10px #FFD700;
  animation: fallGoldenParticle 4s linear forwards;
}

@keyframes fallGoldenParticle {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(360deg);
    opacity: 0;
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
  filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.3));
  transition: filter 1s ease;
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

/* Tier indicator */
.tier-indicator {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 24px;
  background: rgba(0, 0, 0, 0.7);
  color: #FFD700;
  font-size: 18px;
  font-weight: bold;
  border-radius: 8px;
  border: 2px solid rgba(255, 215, 0, 0.3);
  z-index: 100;
  backdrop-filter: blur(10px);
  font-family: system-ui, -apple-system, sans-serif;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .menorah-container :deep(svg) {
    height: 70vh;
    max-height: 70vh;
  }

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
