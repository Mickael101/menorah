<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { gsap } from 'gsap';
import { useDonations, type Donation, type DonationStats } from '../composables/useDonations';
import { useSocket } from '../composables/useSocket';
import { useSoundEffects } from '../composables/useSoundEffects';

const { stats, fetchDonations, fetchConfig, handleDonationNew, handleDonationUpdated, handleDonationDeleted, handleConfigUpdated } = useDonations();
const { on } = useSocket();
const { playDonationSound, playStreakActivation, playTierTransition } = useSoundEffects();

const svgContainer = ref<HTMLDivElement | null>(null);
const svgContent = ref<string>('');
const isLoaded = ref(false);
const embers = ref<Array<{ id: number; x: number; y: number; tier: string }>>([]);
const lightRays = ref<Array<{ id: number; angle: number }>>([]);
const goldenRain = ref<Array<{ id: number; x: number; delay: number }>>([]);
let emberInterval: number | null = null;
let nextEmberId = 0;
let nextRayId = 0;
let nextRainId = 0;

// Donation tracking for accumulation and streaks
interface DonationEvent {
  amount: number;
  timestamp: number;
}

const recentDonations = ref<DonationEvent[]>([]);
const streakActive = ref(false);
const screenFlash = ref(false);

// Constants for tiers (in agorot, 100 agorot = 1 shekel)
const TIER_PETIT = 5000; // 50 shekels
const TIER_MOYEN = 20000; // 200 shekels
const TIER_GRAND = 50000; // 500 shekels

// Determine donation tier
function getDonationTier(amount: number): 'petit' | 'moyen' | 'grand' | 'exceptionnel' {
  if (amount >= TIER_GRAND) return 'exceptionnel';
  if (amount >= TIER_MOYEN) return 'grand';
  if (amount >= TIER_PETIT) return 'moyen';
  return 'petit';
}

// Load SVG content
onMounted(async () => {
  try {
    const response = await fetch('/assets/menorahshiviti2.svg');
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
    const donation = data.donation as Donation;
    const newStats = data.stats as DonationStats;

    handleDonationNew(donation, newStats);

    // Track donation for accumulation/streak
    trackDonation(donation.amount);

    // Trigger tier-based animation
    animateDonationByTier(donation.amount);
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

// Track donations for accumulation and streak detection
function trackDonation(amount: number): void {
  const now = Date.now();

  // Add to recent donations
  recentDonations.value.push({ amount, timestamp: now });

  // Clean up old donations (older than 30 seconds)
  recentDonations.value = recentDonations.value.filter(
    d => now - d.timestamp < 30000
  );

  // Check for streak (3+ donations in 30 seconds)
  if (recentDonations.value.length >= 3) {
    activateStreak();
  }
}

// Check if we have rapid accumulation (multiple donations in 5 seconds)
function hasRapidAccumulation(): boolean {
  const now = Date.now();
  const recent = recentDonations.value.filter(d => now - d.timestamp < 5000);
  return recent.length >= 2;
}

// Activate streak visual effects
function activateStreak(): void {
  if (streakActive.value) return;

  streakActive.value = true;

  // Play streak activation sound
  playStreakActivation();

  // Deactivate after 30 seconds
  setTimeout(() => {
    streakActive.value = false;
  }, 30000);
}

// Initial entrance animation
function animateEntrance(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  gsap.fromTo(svg,
    { opacity: 0, y: 40 },
    {
      opacity: 1,
      y: 0,
      duration: 2,
      ease: 'power3.out'
    }
  );
}

// Permanent subtle pulse
function startSubtlePulse(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  const baseScale = streakActive.value ? 0.97 : 0.98;
  const duration = streakActive.value ? 2 : 3;

  gsap.to(svg, {
    scale: baseScale,
    duration: duration,
    repeat: -1,
    yoyo: true,
    ease: 'power1.inOut'
  });
}

// Watch streak state to update pulse
watch(streakActive, () => {
  startSubtlePulse();
});

// Progressive lighting from bottom to top
function updateLighting(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

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

// Main animation dispatcher based on donation tier
function animateDonationByTier(amount: number): void {
  const tier = getDonationTier(amount);
  const isRapid = hasRapidAccumulation();

  // Play sound effect for the tier
  playDonationSound(tier);

  switch (tier) {
    case 'petit':
      animateEtincelle(isRapid);
      break;
    case 'moyen':
      animateFlamme(isRapid);
      break;
    case 'grand':
      animateEmbrasement(isRapid);
      break;
    case 'exceptionnel':
      animateRevelation(isRapid);
      break;
  }
}

// TIER 1: L'Étincelle (< 50 shekels)
function animateEtincelle(isRapid: boolean): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  const intensity = isRapid ? 1.5 : 1.3;
  const emberCount = isRapid ? 7 : 3;

  // Flash doux
  gsap.fromTo(svg,
    { filter: `brightness(${intensity})` },
    {
      filter: 'brightness(1)',
      duration: 0.8,
      ease: 'power2.out'
    }
  );

  // Micro-shake
  gsap.from(svg, {
    x: -3,
    duration: 0.15,
    ease: 'power1.inOut',
    yoyo: true,
    repeat: 3
  });

  // Pop effect on newly lit element
  const newElement = getNewlyLitElement();
  if (newElement) {
    gsap.fromTo(newElement,
      { scale: 0.8 },
      {
        scale: 1.1,
        duration: 0.4,
        ease: 'back.out(2)',
        onComplete: () => {
          gsap.to(newElement, { scale: 1, duration: 0.4 });
        }
      }
    );
  }

  // Generate embers
  generateEmberBurst(emberCount, 'petit');
}

// TIER 2: La Flamme (50-200 shekels)
function animateFlamme(isRapid: boolean): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  const intensity = isRapid ? 1.8 : 1.6;
  const emberCount = isRapid ? 15 : 10;

  // Flash moyen
  gsap.fromTo(svg,
    { filter: `brightness(${intensity})` },
    {
      filter: 'brightness(1)',
      duration: 1.0,
      ease: 'power2.out'
    }
  );

  // Shake marqué
  gsap.from(svg, {
    x: -6,
    duration: 0.18,
    ease: 'power1.inOut',
    yoyo: true,
    repeat: 5
  });

  // Bounce élaboré on newly lit element
  const newElement = getNewlyLitElement();
  if (newElement) {
    gsap.fromTo(newElement,
      { scale: 0.5 },
      {
        scale: 1.3,
        duration: 0.3,
        ease: 'back.out(3)',
        onComplete: () => {
          gsap.to(newElement, {
            scale: 0.95,
            duration: 0.2,
            onComplete: () => {
              gsap.to(newElement, {
                scale: 1.05,
                duration: 0.2,
                onComplete: () => {
                  gsap.to(newElement, { scale: 1, duration: 0.3 });
                }
              });
            }
          });
        }
      }
    );

    // Onde de chaleur vers éléments adjacents
    heatWaveToAdjacent(newElement);

    // Cercle lumineux expansif
    createExpandingCircle(newElement);
  }

  // Generate embers
  generateEmberBurst(emberCount, 'moyen');
}

// TIER 3: L'Embrasement (200-500 shekels)
function animateEmbrasement(isRapid: boolean): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  const intensity = isRapid ? 2.3 : 2.0;
  const emberCount = isRapid ? 30 : 22;

  // Flash intense
  gsap.fromTo(svg,
    { filter: `brightness(${intensity})` },
    {
      filter: 'brightness(1)',
      duration: 1.2,
      ease: 'power2.out'
    }
  );

  // Shake puissant
  gsap.from(svg, {
    x: -10,
    duration: 0.2,
    ease: 'power1.inOut',
    yoyo: true,
    repeat: 7
  });

  // Rotation effect on newly lit element
  const newElement = getNewlyLitElement();
  if (newElement) {
    gsap.fromTo(newElement,
      { scale: 0.3, rotationY: -180 },
      {
        scale: 1.4,
        rotationY: 0,
        duration: 0.6,
        ease: 'back.out(2.5)',
        onComplete: () => {
          gsap.to(newElement, { scale: 1, duration: 0.5 });
        }
      }
    );

    // Onde de chaleur sur TOUS les éléments allumés
    heatWaveToAll();

    // Traînée lumineuse
    createLightTrail();
  }

  // Generate embers explosion
  generateEmberBurst(emberCount, 'grand');

  // Golden rain
  generateGoldenRain(20, 2000);
}

// TIER 4: La Révélation (> 500 shekels)
function animateRevelation(isRapid: boolean): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  const emberCount = isRapid ? 70 : 50;

  // 1. FREEZE momentané
  gsap.killTweensOf(svg);

  setTimeout(() => {
    // 2. Flash BLANC sur tout l'écran
    triggerScreenFlash();

    // 3. La Menorah "explose"
    gsap.fromTo(svg,
      { scale: 1, filter: 'brightness(3)' },
      {
        scale: 1.3,
        filter: 'brightness(1)',
        duration: 0.5,
        ease: 'power2.out',
        onComplete: () => {
          gsap.to(svg, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)' });
        }
      }
    );

    // 4. Embers en fontaine
    generateEmberBurst(emberCount, 'exceptionnel');

    // 5. Halo qui pulse 3 fois rapidement
    pulseHaloRapid();

    // 6. Ola lumineuse
    olaLumineuse();

    // 7. Rayons de lumière
    generateLightRays();

    // 8. Golden rain prolongée
    generateGoldenRain(60, 4000);

  }, 300); // Freeze duration
}

// Get the newly lit element based on current progress
function getNewlyLitElement(): SVGGraphicsElement | null {
  if (!svgContainer.value) return null;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return null;

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
    return sortedElements[newGroupIndex];
  }

  return null;
}

// Heat wave to adjacent elements
function heatWaveToAdjacent(element: SVGGraphicsElement): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  const elements = Array.from(svg.querySelectorAll('g[mask], svg > path')) as SVGGraphicsElement[];
  const index = elements.indexOf(element);

  // Adjacent elements (prev and next)
  const adjacent = [elements[index - 1], elements[index + 1]].filter(Boolean);

  adjacent.forEach((el, i) => {
    setTimeout(() => {
      gsap.fromTo(el,
        { filter: 'brightness(1.8)' },
        { filter: 'brightness(1.4)', duration: 0.5, ease: 'power2.out' }
      );
    }, i * 100);
  });
}

// Heat wave to ALL lit elements
function heatWaveToAll(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

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
  const lightingLevel = Math.floor((stats.value.percentComplete / 100) * totalElements);

  sortedElements.slice(0, lightingLevel).forEach((el, i) => {
    setTimeout(() => {
      gsap.fromTo(el,
        { filter: 'brightness(2)' },
        { filter: 'brightness(1.4)', duration: 0.6, ease: 'power2.out' }
      );
    }, i * 50);
  });
}

// Create expanding circle effect
function createExpandingCircle(element: SVGGraphicsElement): void {
  // This would ideally use a CSS/SVG overlay, simplified here
  gsap.fromTo(element,
    { boxShadow: '0 0 20px 5px rgba(255, 215, 0, 0.8)' },
    {
      boxShadow: '0 0 80px 30px rgba(255, 215, 0, 0)',
      duration: 1.0,
      ease: 'power2.out'
    }
  );
}

// Create light trail effect
function createLightTrail(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

  // Animate SVG filter/glow
  gsap.fromTo(svg,
    { filter: 'drop-shadow(0 0 30px rgba(255, 215, 0, 1))' },
    {
      filter: 'drop-shadow(0 0 0px rgba(255, 215, 0, 0))',
      duration: 1.5,
      ease: 'power2.out'
    }
  );
}

// Screen flash effect
function triggerScreenFlash(): void {
  screenFlash.value = true;
  setTimeout(() => {
    screenFlash.value = false;
  }, 400);
}

// Pulse halo rapidly
function pulseHaloRapid(): void {
  const halo = document.querySelector('.pulsing-halo') as HTMLElement;
  if (!halo) return;

  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      gsap.fromTo(halo,
        { opacity: 1, scale: 1.2 },
        { opacity: 0.5, scale: 1, duration: 0.3, ease: 'power2.inOut' }
      );
    }, i * 400);
  }
}

// Ola lumineuse - cascade brightness effect
function olaLumineuse(): void {
  if (!svgContainer.value) return;

  const svg = svgContainer.value.querySelector('svg');
  if (!svg) return;

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

  sortedElements.forEach((el, i) => {
    setTimeout(() => {
      gsap.fromTo(el,
        { filter: 'brightness(2.5)' },
        { filter: 'brightness(1.4)', duration: 0.4, ease: 'power2.out' }
      );
    }, i * 80);
  });
}

// Generate light rays in 8 directions
function generateLightRays(): void {
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];

  angles.forEach((angle, i) => {
    setTimeout(() => {
      const ray = { id: nextRayId++, angle };
      lightRays.value.push(ray);

      setTimeout(() => {
        const index = lightRays.value.findIndex(r => r.id === ray.id);
        if (index !== -1) {
          lightRays.value.splice(index, 1);
        }
      }, 2000);
    }, i * 50);
  });
}

// Generate ember particles
function startEmberGeneration(): void {
  emberInterval = window.setInterval(() => {
    const probability = streakActive.value ? 0.6 : 0.4;
    if (Math.random() < probability) {
      const ember = {
        id: nextEmberId++,
        x: 35 + Math.random() * 30,
        y: 5,
        tier: 'ambient'
      };
      embers.value.push(ember);

      setTimeout(() => {
        const index = embers.value.findIndex(e => e.id === ember.id);
        if (index !== -1) {
          embers.value.splice(index, 1);
        }
      }, 5000);
    }
  }, 300);
}

function generateEmberBurst(count: number, tier: string): void {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const spread = tier === 'exceptionnel' ? 40 : tier === 'grand' ? 30 : 20;
      const ember = {
        id: nextEmberId++,
        x: (50 - spread / 2) + Math.random() * spread,
        y: 10,
        tier
      };
      embers.value.push(ember);

      setTimeout(() => {
        const index = embers.value.findIndex(e => e.id === ember.id);
        if (index !== -1) {
          embers.value.splice(index, 1);
        }
      }, 4000);
    }, i * (tier === 'exceptionnel' ? 40 : 80));
  }
}

// Generate golden rain particles
function generateGoldenRain(count: number, duration: number): void {
  for (let i = 0; i < count; i++) {
    const rain = {
      id: nextRainId++,
      x: Math.random() * 100,
      delay: Math.random() * 500
    };
    goldenRain.value.push(rain);

    setTimeout(() => {
      const index = goldenRain.value.findIndex(r => r.id === rain.id);
      if (index !== -1) {
        goldenRain.value.splice(index, 1);
      }
    }, duration + rain.delay);
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
  <div class="menorah-symphonie">
    <!-- Background - Style DisplayPage -->
    <div class="background">
      <div class="bg-gradient"></div>
      <div class="bg-stars"></div>
      <div class="bg-glow-blue"></div>
      <div class="warm-glow"></div>
      <div class="pulsing-halo" :class="{ 'breathing-fast': streakActive }"></div>
      <div v-if="streakActive" class="streak-border"></div>
    </div>

    <!-- Screen flash for exceptional donations -->
    <div v-if="screenFlash" class="screen-flash"></div>

    <!-- Light rays for exceptional donations -->
    <div class="light-rays-container">
      <div
        v-for="ray in lightRays"
        :key="ray.id"
        class="light-ray"
        :style="{
          transform: `rotate(${ray.angle}deg)`
        }"
      ></div>
    </div>

    <!-- Golden rain particles -->
    <div class="golden-rain-container">
      <div
        v-for="rain in goldenRain"
        :key="rain.id"
        class="golden-particle"
        :style="{
          left: `${rain.x}%`,
          animationDelay: `${rain.delay}ms`
        }"
      ></div>
    </div>

    <!-- Embers/sparks rising -->
    <div class="embers-container">
      <div
        v-for="ember in embers"
        :key="ember.id"
        class="ember"
        :class="`ember-${ember.tier}`"
        :style="{
          left: `${ember.x}%`,
          bottom: `${ember.y}%`
        }"
      ></div>
    </div>

    <!-- Menorah SVG -->
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
.menorah-symphonie {
  min-height: 100vh;
  background: #0a0a1a;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Background - Style DisplayPage */
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

.bg-glow-blue {
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

.warm-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 50% 50% at 50% 50%,
    rgba(255, 215, 0, 0.12) 0%,
    rgba(255, 236, 179, 0.05) 40%,
    transparent 80%
  );
}

.pulsing-halo {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 1100px;
  height: 1100px;
  background: radial-gradient(
    circle,
    rgba(255, 215, 0, 0.1) 0%,
    rgba(255, 255, 255, 0.08) 30%,
    transparent 70%
  );
  animation: pulseHalo 5s ease-in-out infinite;
  filter: blur(70px);
}

.pulsing-halo.breathing-fast {
  animation: pulseHaloFast 2s ease-in-out infinite;
}

@keyframes pulseHalo {
  0%, 100% {
    opacity: 0.5;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.8;
    transform: translate(-50%, -50%) scale(1.1);
  }
}

@keyframes pulseHaloFast {
  0%, 100% {
    opacity: 0.6;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.15);
  }
}

/* Streak border effect */
.streak-border {
  position: absolute;
  inset: 0;
  border: 3px solid rgba(255, 215, 0, 0.5);
  box-shadow:
    inset 0 0 30px rgba(255, 215, 0, 0.3),
    0 0 30px rgba(255, 215, 0, 0.3);
  animation: streakPulse 1s ease-in-out infinite;
  pointer-events: none;
}

@keyframes streakPulse {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

/* Screen flash */
.screen-flash {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.95);
  animation: flashFade 0.4s ease-out forwards;
  z-index: 100;
  pointer-events: none;
}

@keyframes flashFade {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

/* Light rays */
.light-rays-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 8;
}

.light-ray {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 0;
  background: linear-gradient(
    to bottom,
    rgba(255, 215, 0, 0.8),
    rgba(255, 215, 0, 0)
  );
  transform-origin: top center;
  animation: rayExpand 2s ease-out forwards;
  filter: blur(2px);
}

@keyframes rayExpand {
  0% {
    height: 0;
    opacity: 1;
  }
  100% {
    height: 120vh;
    opacity: 0;
  }
}

/* Golden rain */
.golden-rain-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 9;
}

.golden-particle {
  position: absolute;
  top: -10px;
  width: 3px;
  height: 3px;
  background: #FFD700;
  border-radius: 50%;
  box-shadow: 0 0 10px #FFD700;
  animation: goldenFall 3s linear forwards;
}

@keyframes goldenFall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(110vh) rotate(360deg);
    opacity: 0;
  }
}

/* Embers */
.embers-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}

.ember {
  position: absolute;
  width: 2px;
  height: 2px;
  background: #FFD700;
  border-radius: 50%;
  box-shadow: 0 0 8px #FFD700, 0 0 16px rgba(255, 215, 0, 0.6);
  animation: riseEmber 5s linear forwards;
}

.ember-petit {
  width: 2px;
  height: 2px;
  animation: riseEmberSmall 3s linear forwards;
}

.ember-moyen {
  width: 3px;
  height: 3px;
  box-shadow: 0 0 12px #FFD700, 0 0 20px rgba(255, 215, 0, 0.7);
  animation: riseEmberMedium 4s linear forwards;
}

.ember-grand {
  width: 4px;
  height: 4px;
  box-shadow: 0 0 16px #FFD700, 0 0 24px rgba(255, 215, 0, 0.8);
  animation: riseEmberLarge 4.5s linear forwards;
}

.ember-exceptionnel {
  width: 5px;
  height: 5px;
  box-shadow: 0 0 20px #FFD700, 0 0 30px rgba(255, 215, 0, 0.9);
  animation: riseEmberExceptional 5s linear forwards;
}

@keyframes riseEmber {
  0% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(-70vh) translateX(calc(-30px + 60px * var(--random, 0.5))) scale(0.3);
    opacity: 0;
  }
}

@keyframes riseEmberSmall {
  0% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(-50vh) translateX(calc(-20px + 40px * var(--random, 0.5))) scale(0.2);
    opacity: 0;
  }
}

@keyframes riseEmberMedium {
  0% {
    transform: translateY(0) scale(1) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(-65vh) translateX(calc(-25px + 50px * var(--random, 0.5))) scale(0.25) rotate(180deg);
    opacity: 0;
  }
}

@keyframes riseEmberLarge {
  0% {
    transform: translateY(0) scale(1) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(-75vh) translateX(calc(-35px + 70px * var(--random, 0.5))) scale(0.3) rotate(360deg);
    opacity: 0;
  }
}

@keyframes riseEmberExceptional {
  0% {
    transform: translateY(0) scale(1.2) rotate(0deg);
    opacity: 1;
    filter: brightness(1.5);
  }
  50% {
    opacity: 0.9;
  }
  100% {
    transform: translateY(-85vh) translateX(calc(-40px + 80px * var(--random, 0.5))) scale(0.2) rotate(720deg);
    opacity: 0;
    filter: brightness(0.5);
  }
}

/* Menorah */
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

.menorah-container :deep(path) {
  fill: #EBD45C;
  transition: all 0.6s ease;
}

.menorah-container :deep(g[mask]) {
  transition: all 0.6s ease;
}

/* Responsive */
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
}

@media (min-width: 1600px) {
  .menorah-container :deep(svg) {
    height: 85vh;
    max-height: 85vh;
  }
}
</style>
