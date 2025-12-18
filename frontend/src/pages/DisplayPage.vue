<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useSocket } from '../composables/useSocket';
import { useDonations, type Donation } from '../composables/useDonations';
import MenorahDisplay from '../components/display/MenorahDisplay.vue';
import StatsCompact from '../components/display/StatsCompact.vue';
import DonorPlatesGrid from '../components/display/DonorPlatesGrid.vue';
import DonorPlateAnimation from '../components/display/DonorPlateAnimation.vue';

const { on, isConnected } = useSocket();
const {
  config,
  fetchDonations,
  fetchConfig,
  handleDonationNew,
  handleDonationUpdated,
  handleDonationDeleted,
  handleConfigUpdated
} = useDonations();

// Dynamic styles from config
const displayStyles = computed(() => {
  const settings = config.value.displaySettings;
  return {
    '--bg-color': settings.backgroundColor,
    '--bg-image': settings.backgroundImage ? `url(${settings.backgroundImage})` : 'none',
    '--header-text-color': settings.headerTextColor,
    '--stats-text-color': settings.statsTextColor,
    '--chart-primary-color': settings.chartPrimaryColor,
    '--chart-secondary-color': settings.chartSecondaryColor,
    '--plate-gold': settings.plateColorGold,
    '--plate-diamond': settings.plateColorDiamond,
    '--plate-bronze': settings.plateColorBronze,
    '--plate-text': settings.plateTextColor
  };
});

const isFullscreen = ref(false);
const showDonationFlash = ref(false);
const showPlateAnimation = ref(false);
const latestDonation = ref<Donation | null>(null);
const showGifExplosion = ref(false);
const currentGif = ref('');

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

// Trigger spectacular donation animation with plate
function triggerDonationCelebration(donation: Donation): void {
  showDonationFlash.value = true;
  latestDonation.value = donation;
  showPlateAnimation.value = true;

  // Play donation sound if configured
  if (config.value.displaySettings.donationSound) {
    playAudio(config.value.displaySettings.donationSound);
  }

  setTimeout(() => {
    showDonationFlash.value = false;
  }, 2000);
}

function handlePlateAnimationEnd(): void {
  showPlateAnimation.value = false;
}

// Trigger GIF explosion (for admin triggered GIFs)
function triggerGifExplosion(gifUrl: string, audioUrl?: string): void {
  currentGif.value = gifUrl;
  showGifExplosion.value = true;

  // Play associated audio if provided
  if (audioUrl) {
    playAudio(audioUrl);
  }

  setTimeout(() => {
    showGifExplosion.value = false;
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
  <div class="display-page" :class="{ fullscreen: isFullscreen }" :style="displayStyles">
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
        <span v-for="i in 20" :key="i" class="particle"></span>
      </div>
    </div>

    <!-- Donor Plate Animation -->
    <DonorPlateAnimation
      :donation="latestDonation"
      :show="showPlateAnimation"
      @animationEnd="handlePlateAnimationEnd"
    />

    <!-- GIF Explosion Effect (Admin triggered) -->
    <Transition name="gif-explosion">
      <div v-if="showGifExplosion" class="gif-explosion-container">
        <div class="gif-explosion-overlay"></div>
        <div class="gif-explosion-content">
          <img :src="currentGif" alt="Celebration" class="explosion-gif" />
        </div>
        <div class="gif-explosion-particles">
          <span v-for="i in 30" :key="i" class="gif-particle"></span>
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
      {{ isConnected ? 'EN DIRECT' : 'RECONNEXION...' }}
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
      <div class="display-grid">
        <!-- Left: Menorah -->
        <div class="menorah-section">
          <MenorahDisplay />
        </div>

        <!-- Right: Gala info, Stats & Donors -->
        <div class="right-section">
          <div class="gala-header">
            <span class="gala-title">GALA DES FONDATEURS</span>
            <span class="gala-org">OHEL YEHOSHUA</span>
          </div>

          <StatsCompact />

          <div class="donors-section">
            <div class="section-header">
              <span>LE TABLEAU DES FONDATEURS</span>
            </div>
            <DonorPlatesGrid />
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
  background-color: var(--bg-color, #0a0a1a);
  background-image: var(--bg-image, none);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
  overflow: hidden;
}

/* Background Effects - Smooth continuous stars */
.bg-effects {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

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
  opacity: 0.9;
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
  opacity: 0.7;
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
  left: 25%;
  width: 100px;
  height: 100px;
  transform: translate(-50%, -50%);
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(255, 215, 0, 0.6) 10deg,
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
  left: 25%;
  width: 200px;
  height: 200px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(255, 215, 0, 0.8) 0%, rgba(255, 215, 0, 0) 70%);
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
  left: 25%;
  width: 0;
  height: 0;
}

.particle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #FFD700;
  border-radius: 50%;
  box-shadow: 0 0 10px #FFD700, 0 0 20px #FFA500;
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

/* Connection Status - LED optimise */
.connection-status {
  position: fixed;
  top: 25px;
  right: 25px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px 25px;
  background: rgba(255, 0, 0, 0.8);
  border: 3px solid #FF6666;
  border-radius: 50px;
  font-size: 20px;
  font-weight: 900;
  color: #FFFFFF;
  z-index: 100;
  letter-spacing: 2px;
}

.connection-status.connected {
  background: rgba(0, 170, 0, 0.8);
  border-color: #66FF66;
  color: #FFFFFF;
}

.status-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #FFFFFF;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

/* Fullscreen Button - LED optimise */
.fullscreen-btn {
  position: fixed;
  top: 25px;
  left: 25px;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 215, 0, 0.9);
  border: 3px solid #FFD700;
  border-radius: 15px;
  cursor: pointer;
  z-index: 100;
}

.fullscreen-btn svg {
  width: 30px;
  height: 30px;
  color: #000;
  stroke-width: 3;
}

.fullscreen-btn:hover {
  background: #FFD700;
}

.fullscreen-btn:hover svg {
  color: #000;
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

/* Gala header - LED optimise XXL */
.gala-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2vh 0;
  flex-shrink: 0;
}

.gala-title {
  font-size: clamp(20px, 2.5vw, 36px);
  color: var(--stats-text-color, rgba(255, 255, 255, 0.8));
  font-weight: 900;
  letter-spacing: 6px;
}

.gala-org {
  font-size: clamp(30px, 4vw, 60px);
  color: var(--header-text-color, #FFD700);
  font-weight: 900;
  letter-spacing: 8px;
  text-shadow: 0 0 30px currentColor;
  margin-top: 8px;
}

/* Grid Layout - Exact 50/50 split */
.display-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 50% 50%;
  gap: 0;
  width: 100%;
  min-height: 0;
}

/* Menorah Section - Full half screen, imposing */
.menorah-section {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50vw;
  height: 100vh;
  padding: 0;
  box-sizing: border-box;
}

.menorah-section :deep(.menorah-display) {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menorah-section :deep(.menorah-svg) {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menorah-section :deep(.menorah-svg svg) {
  height: 100vh;
  width: auto;
  max-height: 100vh;
}

/* Right Section - Exactly half the screen */
.right-section {
  display: flex;
  flex-direction: column;
  gap: 1vh;
  min-height: 0;
  width: 50vw;
  height: 100vh;
  padding: 1vh 1.5vw;
  box-sizing: border-box;
}

/* Donors Section - Takes remaining space */
.donors-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2vh;
  padding-bottom: 1.5vh;
  border-bottom: 4px solid var(--header-text-color, #FFD700);
  flex-shrink: 0;
}

.section-header span {
  font-size: clamp(22px, 2.5vw, 40px);
  font-weight: 900;
  color: var(--header-text-color, #FFD700);
  letter-spacing: 4px;
  text-shadow: 0 0 20px currentColor;
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
  .display-grid {
    grid-template-columns: 1fr;
    gap: 2vh;
  }

  .menorah-section {
    order: 1;
    max-height: 50vh;
  }

  .menorah-section :deep(.menorah-svg svg) {
    max-height: 45vh;
  }

  .right-section {
    order: 2;
  }
}

@media (max-width: 768px) {
  .display-content {
    padding: 15px;
  }

  .title {
    font-size: 28px;
  }

  .subtitle span {
    font-size: 14px;
  }
}

/* Large screen optimizations */
@media (min-width: 1920px) {
  .display-content {
    padding: 0;
  }
}

@media (min-width: 2560px) {
  .title {
    font-size: 80px;
  }

  .subtitle span {
    font-size: 28px;
  }

  .section-header span {
    font-size: 24px;
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

.gif-explosion-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(255, 215, 0, 0.3) 0%, rgba(0, 0, 0, 0.85) 70%);
  animation: gif-overlay-pulse 0.5s ease-out;
}

@keyframes gif-overlay-pulse {
  0% { opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; }
  100% { opacity: 0.9; }
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
  box-shadow: 0 0 60px rgba(255, 215, 0, 0.8), 0 0 120px rgba(255, 165, 0, 0.5), 0 0 180px rgba(255, 100, 0, 0.3);
  animation: gif-glow-anim 1s ease-in-out infinite alternate;
}

@keyframes gif-glow-anim {
  0% { box-shadow: 0 0 60px rgba(255, 215, 0, 0.8), 0 0 120px rgba(255, 165, 0, 0.5), 0 0 180px rgba(255, 100, 0, 0.3); }
  100% { box-shadow: 0 0 80px rgba(255, 215, 0, 1), 0 0 150px rgba(255, 165, 0, 0.7), 0 0 220px rgba(255, 100, 0, 0.5); }
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
  background: linear-gradient(135deg, #FFD700, #FFA500);
  border-radius: 50%;
  box-shadow: 0 0 15px #FFD700, 0 0 30px #FFA500;
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
</style>
