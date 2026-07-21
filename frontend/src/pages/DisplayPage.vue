<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useSocket } from '../composables/useSocket';
import {
  useDonations,
  type Donation,
  DEFAULT_DISPLAY_TEXTS
} from '../composables/useDonations';
import CampaignVisual from '../components/display/CampaignVisual.vue';
import StatsCompact from '../components/display/StatsCompact.vue';
import DonorPlatesGrid from '../components/display/DonorPlatesGrid.vue';
import DonorPlateAnimation from '../components/display/DonorPlateAnimation.vue';
import { getDisplayThemeStyles } from '../theme/displayThemes';

const { on, isConnected } = useSocket();
const {
  config,
  stats,
  fetchDonations,
  fetchConfig,
  handleDonationNew,
  handleDonationUpdated,
  handleDonationDeleted,
  handleConfigUpdated
} = useDonations();

// Dynamic styles from config
const displayStyles = computed(() => {
  return getDisplayThemeStyles(config.value.displaySettings);
});

const themeClass = computed(() => `theme-${config.value.displaySettings.theme}`);
const visualMode = computed(() => config.value.displaySettings.visualMode ?? 'none');
const customSvgUrl = computed(() => config.value.displaySettings.customSvgUrl ?? null);
const displayTexts = computed(() => ({
  ...DEFAULT_DISPLAY_TEXTS,
  ...(config.value.displaySettings.texts ?? {})
}));
const textDirection = computed(() => config.value.displaySettings.textDirection ?? 'auto');
const donationAnimation = computed(() => config.value.displaySettings.donationAnimation ?? 'prestige');
const hasCampaignVisual = computed(() => {
  return visualMode.value === 'menorah'
    || (visualMode.value === 'custom' && Boolean(customSvgUrl.value));
});

const isFullscreen = ref(false);
const showDonationFlash = ref(false);
const showPlateAnimation = ref(false);
const latestDonation = ref<Donation | null>(null);
const donationQueue = ref<Donation[]>([]);
const showGifExplosion = ref(false);
const currentGif = ref('');
let flashTimeoutId: number | null = null;
let nextDonationTimeoutId: number | null = null;
let gifTimeoutId: number | null = null;

// Play audio helper
function playAudio(url: string): void {
  try {
    const audio = new Audio(url);
    audio.volume = 1.0;
    audio.play().catch(err => console.log('Audio play failed:', err));
  } catch (e) {
    console.log('Audio error:', e);
  }
}

function showDonationCelebration(donation: Donation): void {
  showDonationFlash.value = true;
  latestDonation.value = donation;
  showPlateAnimation.value = true;

  // Play donation sound if configured
  if (config.value.displaySettings.donationSound) {
    playAudio(config.value.displaySettings.donationSound);
  }

  if (flashTimeoutId !== null) {
    window.clearTimeout(flashTimeoutId);
  }

  flashTimeoutId = window.setTimeout(() => {
    showDonationFlash.value = false;
    flashTimeoutId = null;
  }, 2000);
}

// Queue donations so every contribution gets its full moment on screen.
function triggerDonationCelebration(donation: Donation): void {
  if (showPlateAnimation.value || nextDonationTimeoutId !== null) {
    donationQueue.value.push(donation);
    return;
  }

  showDonationCelebration(donation);
}

function handlePlateAnimationEnd(): void {
  showPlateAnimation.value = false;

  const nextDonation = donationQueue.value.shift();
  if (nextDonation) {
    nextDonationTimeoutId = window.setTimeout(() => {
      nextDonationTimeoutId = null;
      showDonationCelebration(nextDonation);
    }, 250);
  }
}

// Trigger GIF explosion (for admin triggered GIFs)
function triggerGifExplosion(gifUrl: string, audioUrl?: string): void {
  currentGif.value = gifUrl;
  showGifExplosion.value = true;

  // Play associated audio if provided
  if (audioUrl) {
    playAudio(audioUrl);
  }

  if (gifTimeoutId !== null) {
    window.clearTimeout(gifTimeoutId);
  }

  gifTimeoutId = window.setTimeout(() => {
    showGifExplosion.value = false;
    gifTimeoutId = null;
  }, 4000);
}

// Load initial data and setup socket listeners
onMounted(async () => {
  await Promise.all([fetchDonations(), fetchConfig()]);

  // Listen for real-time events
  on('donation:new', (data: any) => {
    handleDonationNew(data.donation, data.stats);
    triggerDonationCelebration(data.donation);
  });

  // Listen for admin-triggered GIF explosions (with optional audio)
  on('gif:trigger', (data: any) => {
    triggerGifExplosion(data.gifUrl, data.audioUrl);
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

  // Handle reconnection - reload state
  on('connect', async () => {
    console.log('Socket reconnected, reloading state...');
    await Promise.all([fetchDonations(), fetchConfig()]);
  });
});

onUnmounted(() => {
  if (flashTimeoutId !== null) window.clearTimeout(flashTimeoutId);
  if (nextDonationTimeoutId !== null) window.clearTimeout(nextDonationTimeoutId);
  if (gifTimeoutId !== null) window.clearTimeout(gifTimeoutId);
  donationQueue.value = [];
});

function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    isFullscreen.value = true;
  } else {
    document.exitFullscreen();
    isFullscreen.value = false;
  }
}
</script>

<template>
  <div
    class="display-page"
    :class="[themeClass, { fullscreen: isFullscreen }]"
    :style="displayStyles"
    :dir="textDirection"
  >
    <!-- Animated Background - Stars -->
    <div class="bg-effects">
      <div class="stars-layer stars-layer-1"></div>
      <div class="stars-layer stars-layer-2"></div>
      <div class="stars-layer stars-layer-3"></div>
    </div>

    <!-- Donation Celebration Effect -->
    <div class="donation-flash" :class="{ active: showDonationFlash }">
      <div class="flash-rays"></div>
      <div class="flash-glow"></div>
      <div class="flash-particles">
        <span v-for="i in 12" :key="i" class="particle"></span>
      </div>
    </div>

    <!-- Donor Plate Animation -->
    <DonorPlateAnimation
      :donation="latestDonation"
      :show="showPlateAnimation"
      :animation-style="donationAnimation"
      :thank-you-title="displayTexts.thankYouTitle"
      :thank-you-message="displayTexts.thankYouMessage"
      :text-direction="textDirection"
      @animationEnd="handlePlateAnimationEnd"
    />

    <!-- GIF Explosion Effect (Admin triggered) -->
    <Transition name="gif-explosion">
      <div v-if="showGifExplosion" class="gif-explosion-container">
        <div class="gif-explosion-content">
          <img :src="currentGif" alt="Celebration" class="explosion-gif" />
        </div>
        <div class="gif-explosion-particles">
          <span v-for="i in 18" :key="i" class="gif-particle"></span>
        </div>
        <div class="gif-explosion-rings">
          <div class="gif-ring gif-ring-1"></div>
          <div class="gif-ring gif-ring-2"></div>
          <div class="gif-ring gif-ring-3"></div>
        </div>
      </div>
    </Transition>

    <!-- Connection Status - LED optimise -->
    <div class="connection-status" :class="{ connected: isConnected }">
      <span class="status-dot"></span>
      <span :dir="textDirection">{{ isConnected ? displayTexts.liveLabel : displayTexts.reconnectingLabel }}</span>
    </div>

    <!-- Fullscreen Toggle -->
    <button class="fullscreen-btn" @click="toggleFullscreen" :title="isFullscreen ? 'Quitter le plein écran' : 'Plein écran'">
      <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
      </svg>
    </button>

    <!-- Main Content -->
    <div class="display-content">
      <!-- Grid Layout - Full screen -->
      <div class="display-grid" :class="{ 'without-visual': !hasCampaignVisual }">
        <!-- Optional campaign visual. Donors remain the visual priority. -->
        <div v-if="hasCampaignVisual" class="campaign-visual-section">
          <div class="campaign-visual-frame">
            <CampaignVisual :mode="visualMode" :custom-svg-url="customSvgUrl" />
          </div>
        </div>

        <!-- Main donor stage -->
        <div class="right-section">
          <div class="gala-header">
            <span class="gala-title" :dir="textDirection">{{ displayTexts.eventTitle }}</span>
            <span class="gala-org" :dir="textDirection">{{ displayTexts.organizationName }}</span>
          </div>

          <StatsCompact />

          <div class="donors-section">
            <div class="section-header">
              <div class="section-copy">
                <span class="section-kicker" :dir="textDirection">{{ displayTexts.boardKicker }}</span>
                <span class="section-title" :dir="textDirection">{{ displayTexts.boardTitle }}</span>
              </div>
              <span class="donor-count" :dir="textDirection">
                {{ stats.donationCount }} {{ stats.donationCount === 1 ? displayTexts.donorSingular : displayTexts.donorPlural }}
              </span>
            </div>
            <DonorPlatesGrid spotlight />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.display-page {
  min-height: 100vh;
  height: 100vh;
  background-color: var(--bg-color, #070914);
  background-image:
    var(--bg-image, none),
    radial-gradient(circle at 22% 48%, color-mix(in srgb, var(--chart-primary-color) 7%, transparent), transparent 34%),
    linear-gradient(135deg, color-mix(in srgb, var(--bg-color) 90%, black), var(--bg-color));
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  color: var(--stats-text-color);
  font-family: var(--theme-font-body);
}

.display-page::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.32;
}

.display-page.theme-premium::before {
  background: linear-gradient(115deg, rgba(255, 255, 255, 0.025), transparent 32%, rgba(255, 255, 255, 0.02));
}

.display-page.theme-modern::before {
  opacity: 0.2;
  background-image:
    linear-gradient(color-mix(in srgb, var(--chart-primary-color) 14%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--chart-primary-color) 14%, transparent) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: linear-gradient(to bottom, black, transparent 78%);
}

.display-page.theme-ceremonial::before {
  opacity: 0.26;
  background:
    radial-gradient(circle at center, transparent 35%, rgba(0, 0, 0, 0.48) 100%),
    repeating-linear-gradient(105deg, rgba(255, 255, 255, 0.018) 0 1px, transparent 1px 7px);
}

/* Background Effects - Smooth continuous stars */
.bg-effects {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  opacity: 0.36;
}

.theme-modern .bg-effects { opacity: 0.24; }
.theme-ceremonial .bg-effects { opacity: 0.18; }

.stars-layer {
  position: absolute;
  width: 200%;
  height: 200%;
  top: -50%;
  left: -50%;
  background-repeat: repeat;
  will-change: transform;
}

.stars-layer-1 {
  background-image:
    radial-gradient(1px 1px at 20px 30px, rgba(255, 255, 255, 0.9), transparent),
    radial-gradient(1.5px 1.5px at 70px 90px, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(1px 1px at 130px 50px, rgba(255, 255, 255, 0.8), transparent),
    radial-gradient(2px 2px at 190px 120px, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(1px 1px at 250px 70px, rgba(255, 255, 255, 0.9), transparent),
    radial-gradient(1.5px 1.5px at 310px 150px, rgba(255, 255, 255, 0.5), transparent),
    radial-gradient(1px 1px at 370px 40px, rgba(255, 255, 255, 0.8), transparent),
    radial-gradient(2px 2px at 430px 100px, rgba(255, 255, 255, 0.7), transparent);
  background-size: 500px 200px;
  animation: stars-float-1 60s linear infinite;
  opacity: 0.62;
}

.stars-layer-2 {
  background-image:
    radial-gradient(1px 1px at 40px 80px, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(1.5px 1.5px at 100px 20px, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(1px 1px at 160px 140px, rgba(255, 255, 255, 0.8), transparent),
    radial-gradient(2px 2px at 220px 60px, rgba(255, 255, 255, 0.5), transparent),
    radial-gradient(1px 1px at 280px 110px, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(1.5px 1.5px at 340px 30px, rgba(255, 255, 255, 0.9), transparent);
  background-size: 400px 180px;
  animation: stars-float-2 80s linear infinite;
  opacity: 0.46;
}

.stars-layer-3 {
  background-image:
    radial-gradient(1.5px 1.5px at 30px 100px, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(2px 2px at 120px 40px, rgba(255, 255, 255, 0.5), transparent),
    radial-gradient(1.5px 1.5px at 210px 130px, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(1px 1px at 300px 70px, rgba(255, 255, 255, 0.8), transparent);
  background-size: 350px 160px;
  animation: stars-float-3 100s linear infinite, stars-twinkle 8s ease-in-out infinite;
  opacity: 0.5;
}

@keyframes stars-float-1 {
  from { transform: translate(0, 0); }
  to { transform: translate(-250px, -100px); }
}

@keyframes stars-float-2 {
  from { transform: translate(0, 0); }
  to { transform: translate(200px, -90px); }
}

@keyframes stars-float-3 {
  from { transform: translate(0, 0); }
  to { transform: translate(-175px, 80px); }
}

@keyframes stars-twinkle {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.8; }
}

/* Donation Celebration Effect */
.donation-flash {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
  opacity: 0;
  visibility: hidden;
}

.donation-flash.active {
  visibility: visible;
  animation: flash-sequence 2s ease-out forwards;
}

@keyframes flash-sequence {
  0% { opacity: 0; }
  5% { opacity: 1; }
  30% { opacity: 1; }
  100% { opacity: 0; }
}

.flash-rays {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100px;
  height: 100px;
  transform: translate(-50%, -50%);
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    color-mix(in srgb, var(--chart-primary-color) 45%, transparent) 10deg,
    transparent 20deg,
    transparent 30deg,
    rgba(255, 215, 0, 0.4) 40deg,
    transparent 50deg,
    transparent 60deg,
    rgba(255, 215, 0, 0.5) 70deg,
    transparent 80deg,
    transparent 90deg,
    rgba(255, 215, 0, 0.6) 100deg,
    transparent 110deg,
    transparent 120deg,
    rgba(255, 215, 0, 0.4) 130deg,
    transparent 140deg,
    transparent 150deg,
    rgba(255, 215, 0, 0.5) 160deg,
    transparent 170deg,
    transparent 180deg,
    rgba(255, 215, 0, 0.6) 190deg,
    transparent 200deg,
    transparent 210deg,
    rgba(255, 215, 0, 0.4) 220deg,
    transparent 230deg,
    transparent 240deg,
    rgba(255, 215, 0, 0.5) 250deg,
    transparent 260deg,
    transparent 270deg,
    rgba(255, 215, 0, 0.6) 280deg,
    transparent 290deg,
    transparent 300deg,
    rgba(255, 215, 0, 0.4) 310deg,
    transparent 320deg,
    transparent 330deg,
    rgba(255, 215, 0, 0.5) 340deg,
    transparent 350deg,
    transparent 360deg
  );
  border-radius: 50%;
}

.donation-flash.active .flash-rays {
  animation: rays-expand 2s ease-out forwards;
}

@keyframes rays-expand {
  0% {
    width: 100px;
    height: 100px;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    width: 300vw;
    height: 300vw;
    opacity: 0;
    transform: translate(-50%, -50%) rotate(180deg);
  }
}

.flash-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200px;
  height: 200px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, color-mix(in srgb, var(--chart-primary-color) 32%, transparent) 0%, transparent 70%);
  border-radius: 50%;
}

.donation-flash.active .flash-glow {
  animation: glow-pulse 1.5s ease-out forwards;
}

@keyframes glow-pulse {
  0% {
    width: 200px;
    height: 200px;
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    width: 150vw;
    height: 150vw;
    opacity: 0;
  }
}

.flash-particles {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
}

.particle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--chart-primary-color);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--chart-primary-color), 0 0 20px var(--chart-secondary-color);
}

.donation-flash.active .particle {
  animation: particle-burst 1.5s ease-out forwards;
}

.particle:nth-child(1) { --angle: 0deg; --distance: 400px; animation-delay: 0ms; }
.particle:nth-child(2) { --angle: 18deg; --distance: 350px; animation-delay: 20ms; }
.particle:nth-child(3) { --angle: 36deg; --distance: 420px; animation-delay: 40ms; }
.particle:nth-child(4) { --angle: 54deg; --distance: 380px; animation-delay: 60ms; }
.particle:nth-child(5) { --angle: 72deg; --distance: 450px; animation-delay: 80ms; }
.particle:nth-child(6) { --angle: 90deg; --distance: 370px; animation-delay: 100ms; }
.particle:nth-child(7) { --angle: 108deg; --distance: 410px; animation-delay: 120ms; }
.particle:nth-child(8) { --angle: 126deg; --distance: 360px; animation-delay: 140ms; }
.particle:nth-child(9) { --angle: 144deg; --distance: 430px; animation-delay: 160ms; }
.particle:nth-child(10) { --angle: 162deg; --distance: 390px; animation-delay: 180ms; }
.particle:nth-child(11) { --angle: 180deg; --distance: 440px; animation-delay: 200ms; }
.particle:nth-child(12) { --angle: 198deg; --distance: 355px; animation-delay: 220ms; }
.particle:nth-child(13) { --angle: 216deg; --distance: 425px; animation-delay: 240ms; }
.particle:nth-child(14) { --angle: 234deg; --distance: 375px; animation-delay: 260ms; }
.particle:nth-child(15) { --angle: 252deg; --distance: 460px; animation-delay: 280ms; }
.particle:nth-child(16) { --angle: 270deg; --distance: 385px; animation-delay: 300ms; }
.particle:nth-child(17) { --angle: 288deg; --distance: 415px; animation-delay: 320ms; }
.particle:nth-child(18) { --angle: 306deg; --distance: 365px; animation-delay: 340ms; }
.particle:nth-child(19) { --angle: 324deg; --distance: 445px; animation-delay: 360ms; }
.particle:nth-child(20) { --angle: 342deg; --distance: 395px; animation-delay: 380ms; }

@keyframes particle-burst {
  0% {
    transform: translate(0, 0) scale(0);
    opacity: 1;
  }
  20% {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(
      calc(cos(var(--angle)) * var(--distance)),
      calc(sin(var(--angle)) * var(--distance))
    ) scale(0);
    opacity: 0;
  }
}

/* Discreet technical controls, kept readable without competing with the show. */
.connection-status {
  position: fixed;
  top: 25px;
  left: 100px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 15px;
  background: color-mix(in srgb, var(--theme-surface-strong) 92%, #5c1414);
  border: 1px solid rgba(255, 120, 120, 0.55);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
  color: #FFFFFF;
  z-index: 100;
  letter-spacing: 1.3px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(14px);
}

.connection-status.connected {
  background: color-mix(in srgb, var(--theme-surface-strong) 86%, #0b5f3b);
  border-color: rgba(91, 236, 167, 0.58);
  color: #FFFFFF;
}

.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #FFFFFF;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.fullscreen-btn {
  position: fixed;
  top: 25px;
  left: 25px;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-surface-strong);
  border: 1px solid color-mix(in srgb, var(--header-text-color) 55%, transparent);
  border-radius: calc(var(--theme-radius) * 0.7);
  cursor: pointer;
  z-index: 100;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(14px);
  transition: transform 180ms ease, background 180ms ease;
}

.fullscreen-btn svg {
  width: 24px;
  height: 24px;
  color: var(--header-text-color);
  stroke-width: 2.4;
}

.fullscreen-btn:hover {
  background: color-mix(in srgb, var(--theme-surface-strong) 80%, var(--header-text-color));
  transform: translateY(-2px);
}

.fullscreen-btn:hover svg {
  color: white;
}

/* Display Content - Maximum space */
.display-content {
  position: relative;
  z-index: 10;
  padding: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.gala-header {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  padding: 0.5vh 0 1vh;
  text-align: center;
}

.gala-title {
  color: color-mix(in srgb, var(--stats-text-color) 66%, transparent);
  font-family: var(--theme-font-body);
  font-size: clamp(12px, 1vw, 17px);
  font-weight: 750;
  letter-spacing: clamp(3px, 0.45vw, 7px);
  text-transform: uppercase;
}

.gala-org {
  margin-top: 2px;
  color: var(--header-text-color);
  font-family: var(--theme-font-display);
  font-size: clamp(28px, 3vw, 48px);
  font-weight: 850;
  letter-spacing: clamp(2px, 0.45vw, 7px);
  line-height: 1.05;
  text-shadow: 0 0 28px color-mix(in srgb, var(--header-text-color) 28%, transparent);
}

/* The campaign visual is optional and deliberately secondary. */
.display-grid {
  display: grid;
  grid-template-columns: minmax(240px, 28%) minmax(0, 72%);
  flex: 1;
  gap: clamp(12px, 1.5vw, 26px);
  width: 100%;
  min-height: 0;
  padding: clamp(14px, 1.8vw, 30px);
  box-sizing: border-box;
}

.display-grid.without-visual {
  grid-template-columns: minmax(0, 1fr);
  padding-inline: clamp(34px, 6vw, 120px);
}

.campaign-visual-section {
  display: flex;
  min-width: 0;
  min-height: 0;
  align-items: stretch;
}

.campaign-visual-frame {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--header-text-color) 14%, transparent);
  border-radius: calc(var(--theme-radius) * 1.2);
  background: var(--theme-visual-backdrop), color-mix(in srgb, var(--theme-surface) 52%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 24px 70px rgba(0, 0, 0, 0.22);
}

.campaign-visual-frame::after {
  content: '';
  position: absolute;
  inset: 4%;
  border: 1px solid color-mix(in srgb, var(--header-text-color) 8%, transparent);
  border-radius: inherit;
  pointer-events: none;
}

.right-section {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: clamp(8px, 1vh, 14px);
}

.without-visual .right-section {
  width: min(100%, 1720px);
  margin-inline: auto;
}

.without-visual .donors-section {
  background:
    radial-gradient(circle at 50% 52%, color-mix(in srgb, var(--chart-primary-color) 7%, transparent), transparent 42%),
    linear-gradient(145deg, color-mix(in srgb, var(--theme-surface) 76%, transparent), color-mix(in srgb, var(--theme-surface-strong) 68%, transparent));
}

.without-visual .gala-header {
  padding-top: 0;
}

.without-visual .gala-org {
  font-size: clamp(34px, 3.6vw, 60px);
}

.donors-section {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  padding: clamp(10px, 1.2vw, 20px);
  border: 1px solid color-mix(in srgb, var(--header-text-color) 15%, transparent);
  border-radius: calc(var(--theme-radius) * 1.15);
  background: linear-gradient(145deg, color-mix(in srgb, var(--theme-surface) 76%, transparent), color-mix(in srgb, var(--theme-surface-strong) 68%, transparent));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035), 0 22px 60px rgba(0, 0, 0, 0.16);
}

.section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin: 0 clamp(8px, 1vw, 16px) 0.8vh;
  padding: 0 0 1vh;
  border-bottom: 1px solid color-mix(in srgb, var(--header-text-color) 32%, transparent);
  flex-shrink: 0;
}

.section-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.section-kicker {
  color: color-mix(in srgb, var(--stats-text-color) 52%, transparent);
  font-family: var(--theme-font-body);
  font-size: clamp(9px, 0.72vw, 12px);
  font-weight: 750;
  letter-spacing: 0.2em;
}

.section-title {
  color: var(--header-text-color);
  font-family: var(--theme-font-display);
  font-size: clamp(20px, 2vw, 36px);
  font-weight: 800;
  letter-spacing: clamp(1px, 0.2vw, 3px);
  line-height: 1.05;
  text-shadow: 0 0 18px color-mix(in srgb, var(--header-text-color) 22%, transparent);
}

.donor-count {
  flex-shrink: 0;
  padding: 7px 11px;
  border: 1px solid color-mix(in srgb, var(--chart-primary-color) 32%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--chart-primary-color) 8%, transparent);
  color: color-mix(in srgb, var(--stats-text-color) 78%, transparent);
  font-size: clamp(9px, 0.75vw, 12px);
  font-weight: 800;
  letter-spacing: 0.12em;
}

/* Fullscreen Mode - Maximum space */
.display-page.fullscreen .display-content {
  padding: 0;
}

.display-page.fullscreen .right-section {
  padding: 0.5vh 1vw;
}

/* Responsive */
@media (max-width: 1200px) {
  .display-grid:not(.without-visual) {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 27vh) minmax(0, 1fr);
  }

  .display-grid.without-visual {
    padding-inline: clamp(18px, 4vw, 48px);
  }

  .campaign-visual-frame {
    width: min(100%, 860px);
    margin-inline: auto;
  }

  .gala-header {
    padding-block: 0;
  }

  .gala-title {
    font-size: clamp(11px, 1.4vw, 15px);
  }

  .gala-org,
  .without-visual .gala-org {
    font-size: clamp(28px, 4vw, 44px);
  }
}

@media (max-width: 768px) {
  .display-grid,
  .display-grid.without-visual {
    gap: 8px;
    padding: 8px;
  }

  .display-grid:not(.without-visual) {
    grid-template-rows: minmax(0, 23vh) minmax(0, 1fr);
  }

  .donors-section {
    padding: 8px;
  }

  .section-header {
    align-items: center;
    margin-inline: 4px;
  }

  .section-kicker {
    display: none;
  }

  .section-title {
    font-size: clamp(17px, 4.8vw, 24px);
  }

  .donor-count {
    padding: 5px 8px;
    font-size: 8px;
  }

  .gala-header,
  .without-visual .gala-header {
    padding-top: 50px;
  }

  .gala-title {
    font-size: 9px;
    letter-spacing: 2px;
  }

  .gala-org,
  .without-visual .gala-org {
    font-size: clamp(24px, 8vw, 31px);
    letter-spacing: 2px;
  }

  .fullscreen-btn {
    top: 8px;
    left: 8px;
    width: 40px;
    height: 40px;
    border-radius: 10px;
  }

  .fullscreen-btn svg {
    width: 22px;
    height: 22px;
  }

  .connection-status {
    top: 8px;
    right: 8px;
    left: auto;
    padding: 8px 11px;
    border-width: 2px;
    font-size: 12px;
    letter-spacing: 1px;
  }

  .status-dot {
    width: 10px;
    height: 10px;
  }
}

/* Large screen optimizations */
@media (min-width: 1920px) {
  .display-content {
    padding: 0;
  }
}

@media (min-width: 2560px) {
  .section-title {
    font-size: clamp(40px, 1.5vw, 56px);
  }
}

/* GIF Explosion Effect */
.gif-explosion-container {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.gif-explosion-content {
  position: relative;
  z-index: 10;
  animation: gif-content-entrance 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes gif-content-entrance {
  0% { transform: scale(0) rotate(-10deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(5deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

.explosion-gif {
  max-width: 60vw;
  max-height: 70vh;
  border-radius: 20px;
  box-shadow: 0 0 60px color-mix(in srgb, var(--chart-primary-color) 70%, transparent), 0 0 120px color-mix(in srgb, var(--chart-secondary-color) 42%, transparent);
  animation: gif-glow-anim 1s ease-in-out infinite alternate;
}

@keyframes gif-glow-anim {
  0% { box-shadow: 0 0 60px color-mix(in srgb, var(--chart-primary-color) 70%, transparent), 0 0 120px color-mix(in srgb, var(--chart-secondary-color) 42%, transparent); }
  100% { box-shadow: 0 0 82px color-mix(in srgb, var(--chart-primary-color) 90%, transparent), 0 0 155px color-mix(in srgb, var(--chart-secondary-color) 60%, transparent); }
}

.gif-explosion-particles {
  position: absolute;
  top: 50%;
  left: 50%;
}

.gif-particle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: linear-gradient(135deg, var(--chart-primary-color), var(--chart-secondary-color));
  border-radius: 50%;
  box-shadow: 0 0 15px var(--chart-primary-color), 0 0 30px var(--chart-secondary-color);
  animation: gif-particle-explode 2s ease-out forwards;
}

.gif-particle:nth-child(1) { --angle: 0deg; --dist: 350px; animation-delay: 0ms; }
.gif-particle:nth-child(2) { --angle: 12deg; --dist: 400px; animation-delay: 30ms; }
.gif-particle:nth-child(3) { --angle: 24deg; --dist: 320px; animation-delay: 60ms; }
.gif-particle:nth-child(4) { --angle: 36deg; --dist: 380px; animation-delay: 90ms; }
.gif-particle:nth-child(5) { --angle: 48deg; --dist: 420px; animation-delay: 120ms; }
.gif-particle:nth-child(6) { --angle: 60deg; --dist: 340px; animation-delay: 150ms; }
.gif-particle:nth-child(7) { --angle: 72deg; --dist: 390px; animation-delay: 180ms; }
.gif-particle:nth-child(8) { --angle: 84deg; --dist: 360px; animation-delay: 210ms; }
.gif-particle:nth-child(9) { --angle: 96deg; --dist: 410px; animation-delay: 240ms; }
.gif-particle:nth-child(10) { --angle: 108deg; --dist: 330px; animation-delay: 270ms; }
.gif-particle:nth-child(11) { --angle: 120deg; --dist: 400px; animation-delay: 300ms; }
.gif-particle:nth-child(12) { --angle: 132deg; --dist: 350px; animation-delay: 330ms; }
.gif-particle:nth-child(13) { --angle: 144deg; --dist: 420px; animation-delay: 360ms; }
.gif-particle:nth-child(14) { --angle: 156deg; --dist: 340px; animation-delay: 390ms; }
.gif-particle:nth-child(15) { --angle: 168deg; --dist: 380px; animation-delay: 420ms; }
.gif-particle:nth-child(16) { --angle: 180deg; --dist: 360px; animation-delay: 450ms; }
.gif-particle:nth-child(17) { --angle: 192deg; --dist: 400px; animation-delay: 480ms; }
.gif-particle:nth-child(18) { --angle: 204deg; --dist: 320px; animation-delay: 510ms; }
.gif-particle:nth-child(19) { --angle: 216deg; --dist: 410px; animation-delay: 540ms; }
.gif-particle:nth-child(20) { --angle: 228deg; --dist: 370px; animation-delay: 570ms; }
.gif-particle:nth-child(21) { --angle: 240deg; --dist: 430px; animation-delay: 600ms; }
.gif-particle:nth-child(22) { --angle: 252deg; --dist: 345px; animation-delay: 630ms; }
.gif-particle:nth-child(23) { --angle: 264deg; --dist: 395px; animation-delay: 660ms; }
.gif-particle:nth-child(24) { --angle: 276deg; --dist: 355px; animation-delay: 690ms; }
.gif-particle:nth-child(25) { --angle: 288deg; --dist: 405px; animation-delay: 720ms; }
.gif-particle:nth-child(26) { --angle: 300deg; --dist: 335px; animation-delay: 750ms; }
.gif-particle:nth-child(27) { --angle: 312deg; --dist: 395px; animation-delay: 780ms; }
.gif-particle:nth-child(28) { --angle: 324deg; --dist: 365px; animation-delay: 810ms; }
.gif-particle:nth-child(29) { --angle: 336deg; --dist: 415px; animation-delay: 840ms; }
.gif-particle:nth-child(30) { --angle: 348deg; --dist: 375px; animation-delay: 870ms; }

@keyframes gif-particle-explode {
  0% { transform: translate(0, 0) scale(0); opacity: 1; }
  30% { transform: translate(calc(cos(var(--angle)) * calc(var(--dist) * 0.3)), calc(sin(var(--angle)) * calc(var(--dist) * 0.3))) scale(1.5); opacity: 1; }
  100% { transform: translate(calc(cos(var(--angle)) * var(--dist)), calc(sin(var(--angle)) * var(--dist))) scale(0); opacity: 0; }
}

.gif-explosion-rings {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.gif-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 4px solid rgba(255, 215, 0, 0.8);
  border-radius: 50%;
  animation: gif-ring-expand 2s ease-out forwards;
}

.gif-ring-1 { animation-delay: 0ms; }
.gif-ring-2 { animation-delay: 200ms; }
.gif-ring-3 { animation-delay: 400ms; }

@keyframes gif-ring-expand {
  0% { width: 50px; height: 50px; opacity: 1; border-width: 4px; }
  100% { width: 150vw; height: 150vw; opacity: 0; border-width: 1px; }
}

.gif-explosion-enter-active { animation: gif-explosion-in 0.3s ease-out; }
.gif-explosion-leave-active { animation: gif-explosion-out 0.5s ease-in; }
@keyframes gif-explosion-in { 0% { opacity: 0; } 100% { opacity: 1; } }
@keyframes gif-explosion-out { 0% { opacity: 1; } 100% { opacity: 0; } }

.theme-modern .gala-header {
  align-items: flex-start;
  text-align: left;
}

.theme-modern .gala-org {
  text-shadow: 0 0 30px color-mix(in srgb, var(--header-text-color) 42%, transparent);
}

.theme-modern .section-header {
  justify-content: space-between;
}

.theme-modern .campaign-visual-frame {
  box-shadow:
    inset 0 0 44px color-mix(in srgb, var(--chart-primary-color) 6%, transparent),
    0 28px 75px rgba(0, 0, 0, 0.25);
}

.theme-ceremonial .campaign-visual-frame {
  outline: 1px solid color-mix(in srgb, var(--header-text-color) 12%, transparent);
  outline-offset: -10px;
}

.theme-ceremonial .gala-title {
  font-style: italic;
  text-transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .stars-layer,
  .status-dot,
  .flash-rays,
  .flash-glow,
  .particle,
  .gif-explosion-content,
  .explosion-gif,
  .gif-particle,
  .gif-ring {
    animation: none !important;
  }

  .flash-particles,
  .gif-explosion-particles,
  .gif-explosion-rings {
    display: none;
  }
}
</style>
