<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useSocket } from '../composables/useSocket';
import { useDonations, type Donation } from '../composables/useDonations';
import MenorahDisplay from '../components/display/MenorahDisplay.vue';
import StatsCompact from '../components/display/StatsCompact.vue';
import DonorPlatesGrid from '../components/display/DonorPlatesGrid.vue';
import DonorPlateAnimation from '../components/display/DonorPlateAnimation.vue';

const { on, isConnected } = useSocket();
const {
  fetchDonations,
  fetchConfig,
  config,
  handleDonationNew,
  handleDonationUpdated,
  handleDonationDeleted,
  handleConfigUpdated
} = useDonations();

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

const isFullscreen = ref(false);
const showDonationFlash = ref(false);
const showPlateAnimation = ref(false);
const latestDonation = ref<Donation | null>(null);
const showGifExplosion = ref(false);
const currentGif = ref('');

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

  // Listen for admin-triggered GIF explosions
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
  <div class="display-page" :class="{ fullscreen: isFullscreen }">
    <!-- Animated Background - Stars -->
    <div class="bg-effects">
      <div class="stars-layer stars-layer-1"></div>
      <div class="stars-layer stars-layer-2"></div>
      <div class="stars-layer stars-layer-3"></div>
    </div>

    <!-- GIF Explosion Effect -->
    <Transition name="gif-explosion">
      <div v-if="showGifExplosion" class="gif-explosion-container">
        <div class="gif-explosion-content">
          <img :src="currentGif" alt="Celebration" class="explosion-gif" />
        </div>
        <div class="explosion-particles">
          <span v-for="i in 30" :key="i" class="explosion-particle"></span>
        </div>
        <div class="explosion-rings">
          <div class="ring ring-1"></div>
          <div class="ring ring-2"></div>
          <div class="ring ring-3"></div>
        </div>
      </div>
    </Transition>

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

    <!-- Connection Status -->
    <div class="connection-status" :class="{ connected: isConnected }">
      <span class="status-dot"></span>
      {{ isConnected ? 'En direct' : 'Reconnexion...' }}
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
            <span class="gala-title">Gala des fondateurs</span>
            <span class="gala-org">Ohel Yehoshua</span>
          </div>

          <StatsCompact />

          <div class="donors-section">
            <div class="section-header">
              <span>Le tableau des fondateurs</span>
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
  background: #0a0a1a;
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
  animation: gif-entrance 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes gif-entrance {
  0% {
    transform: scale(0) rotate(-10deg);
    opacity: 0;
  }
  50% {
    transform: scale(1.2) rotate(5deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

.explosion-gif {
  max-width: 50vw;
  max-height: 60vh;
  border-radius: 20px;
  box-shadow:
    0 0 60px rgba(255, 215, 0, 0.8),
    0 0 120px rgba(255, 165, 0, 0.5),
    0 0 180px rgba(255, 100, 0, 0.3);
  animation: gif-glow 1s ease-in-out infinite alternate;
}

@keyframes gif-glow {
  0% {
    box-shadow:
      0 0 60px rgba(255, 215, 0, 0.8),
      0 0 120px rgba(255, 165, 0, 0.5),
      0 0 180px rgba(255, 100, 0, 0.3);
  }
  100% {
    box-shadow:
      0 0 80px rgba(255, 215, 0, 1),
      0 0 150px rgba(255, 165, 0, 0.7),
      0 0 220px rgba(255, 100, 0, 0.5);
  }
}

/* Explosion Particles */
.explosion-particles {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
}

.explosion-particle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: linear-gradient(135deg, #FFD700, #FFA500);
  border-radius: 50%;
  box-shadow: 0 0 15px #FFD700, 0 0 30px #FFA500;
  animation: particle-explode 2s ease-out forwards;
}

.explosion-particle:nth-child(1) { --angle: 0deg; --distance: 300px; animation-delay: 0ms; }
.explosion-particle:nth-child(2) { --angle: 12deg; --distance: 350px; animation-delay: 30ms; }
.explosion-particle:nth-child(3) { --angle: 24deg; --distance: 280px; animation-delay: 60ms; }
.explosion-particle:nth-child(4) { --angle: 36deg; --distance: 320px; animation-delay: 90ms; }
.explosion-particle:nth-child(5) { --angle: 48deg; --distance: 380px; animation-delay: 120ms; }
.explosion-particle:nth-child(6) { --angle: 60deg; --distance: 290px; animation-delay: 150ms; }
.explosion-particle:nth-child(7) { --angle: 72deg; --distance: 340px; animation-delay: 180ms; }
.explosion-particle:nth-child(8) { --angle: 84deg; --distance: 310px; animation-delay: 210ms; }
.explosion-particle:nth-child(9) { --angle: 96deg; --distance: 360px; animation-delay: 240ms; }
.explosion-particle:nth-child(10) { --angle: 108deg; --distance: 285px; animation-delay: 270ms; }
.explosion-particle:nth-child(11) { --angle: 120deg; --distance: 345px; animation-delay: 300ms; }
.explosion-particle:nth-child(12) { --angle: 132deg; --distance: 305px; animation-delay: 330ms; }
.explosion-particle:nth-child(13) { --angle: 144deg; --distance: 370px; animation-delay: 360ms; }
.explosion-particle:nth-child(14) { --angle: 156deg; --distance: 295px; animation-delay: 390ms; }
.explosion-particle:nth-child(15) { --angle: 168deg; --distance: 335px; animation-delay: 420ms; }
.explosion-particle:nth-child(16) { --angle: 180deg; --distance: 315px; animation-delay: 450ms; }
.explosion-particle:nth-child(17) { --angle: 192deg; --distance: 355px; animation-delay: 480ms; }
.explosion-particle:nth-child(18) { --angle: 204deg; --distance: 275px; animation-delay: 510ms; }
.explosion-particle:nth-child(19) { --angle: 216deg; --distance: 365px; animation-delay: 540ms; }
.explosion-particle:nth-child(20) { --angle: 228deg; --distance: 325px; animation-delay: 570ms; }
.explosion-particle:nth-child(21) { --angle: 240deg; --distance: 385px; animation-delay: 600ms; }
.explosion-particle:nth-child(22) { --angle: 252deg; --distance: 298px; animation-delay: 630ms; }
.explosion-particle:nth-child(23) { --angle: 264deg; --distance: 342px; animation-delay: 660ms; }
.explosion-particle:nth-child(24) { --angle: 276deg; --distance: 308px; animation-delay: 690ms; }
.explosion-particle:nth-child(25) { --angle: 288deg; --distance: 358px; animation-delay: 720ms; }
.explosion-particle:nth-child(26) { --angle: 300deg; --distance: 288px; animation-delay: 750ms; }
.explosion-particle:nth-child(27) { --angle: 312deg; --distance: 348px; animation-delay: 780ms; }
.explosion-particle:nth-child(28) { --angle: 324deg; --distance: 318px; animation-delay: 810ms; }
.explosion-particle:nth-child(29) { --angle: 336deg; --distance: 368px; animation-delay: 840ms; }
.explosion-particle:nth-child(30) { --angle: 348deg; --distance: 328px; animation-delay: 870ms; }

@keyframes particle-explode {
  0% {
    transform: translate(0, 0) scale(0);
    opacity: 1;
  }
  30% {
    transform: translate(
      calc(cos(var(--angle)) * calc(var(--distance) * 0.3)),
      calc(sin(var(--angle)) * calc(var(--distance) * 0.3))
    ) scale(1.5);
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

/* Explosion Rings */
.explosion-rings {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 4px solid rgba(255, 215, 0, 0.8);
  border-radius: 50%;
  animation: ring-expand 1.5s ease-out forwards;
}

.ring-1 { animation-delay: 0ms; }
.ring-2 { animation-delay: 200ms; }
.ring-3 { animation-delay: 400ms; }

@keyframes ring-expand {
  0% {
    width: 50px;
    height: 50px;
    opacity: 1;
    border-width: 4px;
  }
  100% {
    width: 800px;
    height: 800px;
    opacity: 0;
    border-width: 1px;
  }
}

/* GIF Explosion Transitions */
.gif-explosion-enter-active {
  animation: explosion-in 0.3s ease-out;
}

.gif-explosion-leave-active {
  animation: explosion-out 0.5s ease-in;
}

@keyframes explosion-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes explosion-out {
  0% { opacity: 1; }
  100% { opacity: 0; }
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

/* Connection Status */
.connection-status {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: rgba(239, 68, 68, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 50px;
  font-size: 13px;
  font-weight: 500;
  color: #fca5a5;
  z-index: 100;
  transition: all 0.3s ease;
}

.connection-status.connected {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.3);
  color: #6ee7b7;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

/* Fullscreen Button */
.fullscreen-btn {
  position: fixed;
  top: 20px;
  left: 20px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  cursor: pointer;
  z-index: 100;
  transition: all 0.3s ease;
}

.fullscreen-btn svg {
  width: 20px;
  height: 20px;
  color: rgba(255, 255, 255, 0.7);
  transition: color 0.3s ease;
}

.fullscreen-btn:hover {
  background: rgba(255, 255, 255, 0.2);
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

/* Gala header on right side */
.gala-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1vh 0;
  flex-shrink: 0;
}

.gala-title {
  font-size: clamp(12px, 1.2vw, 18px);
  color: rgba(255, 255, 255, 0.5);
  font-weight: 400;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.gala-org {
  font-size: clamp(16px, 2vw, 28px);
  color: #FFD700;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
  margin-top: 4px;
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

/* Menorah Section - Centered on left half */
.menorah-section {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50vw;
  height: 100vh;
  padding: 2vh 3vw;
  box-sizing: border-box;
  overflow: hidden;
}

.menorah-section :deep(.menorah-display) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menorah-section :deep(.menorah-svg) {
  width: 90%;
  height: 90%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menorah-section :deep(.menorah-svg svg) {
  width: 100%;
  height: 100%;
  max-width: 45vw;
  max-height: 90vh;
  object-fit: contain;
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
  margin-bottom: 1.5vh;
  padding-bottom: 1vh;
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
  flex-shrink: 0;
}

.section-header span {
  font-size: clamp(14px, 1.2vw, 20px);
  font-weight: 600;
  color: #D4AF37;
  letter-spacing: 1px;
  text-transform: uppercase;
  text-shadow: 0 0 10px rgba(212, 175, 55, 0.3);
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
</style>
