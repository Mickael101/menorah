<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useSocket } from '../composables/useSocket';
import { useDonations } from '../composables/useDonations';
import MenorahDisplay from '../components/display/MenorahDisplay.vue';
import StatsCompact from '../components/display/StatsCompact.vue';
import DonorPlatesGrid from '../components/display/DonorPlatesGrid.vue';

const { on, isConnected } = useSocket();
const {
  fetchDonations,
  fetchConfig,
  handleDonationNew,
  handleDonationUpdated,
  handleDonationDeleted,
  handleConfigUpdated
} = useDonations();

const isFullscreen = ref(false);
const showDonationFlash = ref(false);

// Trigger spectacular donation animation
function triggerDonationCelebration(): void {
  showDonationFlash.value = true;
  setTimeout(() => {
    showDonationFlash.value = false;
  }, 2000);
}

// Load initial data and setup socket listeners
onMounted(async () => {
  await Promise.all([fetchDonations(), fetchConfig()]);

  // Listen for real-time events
  on('donation:new', (data: any) => {
    handleDonationNew(data.donation, data.stats);
    triggerDonationCelebration();
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

    <!-- Donation Celebration Effect -->
    <div class="donation-flash" :class="{ active: showDonationFlash }">
      <div class="flash-rays"></div>
      <div class="flash-glow"></div>
      <div class="flash-particles">
        <span v-for="i in 20" :key="i" class="particle"></span>
      </div>
    </div>

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
      <!-- Title -->
      <header class="display-header">
        <h1 class="title">Ensemble, allumons la flamme</h1>
        <p class="subtitle">
          <span>Gala des fondateurs</span>
          <span>Ohel Yehoshua</span>
        </p>
      </header>

      <!-- Grid Layout -->
      <div class="display-grid">
        <!-- Left: Menorah -->
        <div class="menorah-section">
          <MenorahDisplay />
        </div>

        <!-- Right: Stats & Donors -->
        <div class="right-section">
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

/* Display Content - Optimized for large screens */
.display-content {
  position: relative;
  z-index: 10;
  padding: 2vh 3vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* Header - Compact for max content space */
.display-header {
  text-align: center;
  margin-bottom: 2vh;
  flex-shrink: 0;
}

.title {
  font-size: clamp(32px, 4vw, 60px);
  font-weight: 700;
  color: white;
  margin: 0;
  text-shadow: 0 0 40px rgba(255, 215, 0, 0.3);
}

.subtitle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin: 1vh 0 0;
}

.subtitle span {
  font-size: clamp(14px, 1.5vw, 22px);
  color: rgba(255, 255, 255, 0.5);
  font-weight: 400;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.subtitle span:last-child {
  color: #ffd700;
  font-weight: 600;
  text-shadow: 0 0 15px rgba(255, 215, 0, 0.4);
}

/* Grid Layout - Full viewport utilization */
.display-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3vw;
  width: 100%;
  min-height: 0;
}

/* Menorah Section - Full height */
.menorah-section {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.menorah-section :deep(.menorah-display) {
  width: 100%;
  height: 100%;
}

.menorah-section :deep(.menorah-svg) {
  max-width: none;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menorah-section :deep(.menorah-svg svg) {
  max-height: 85vh;
  width: auto;
  height: auto;
}

/* Right Section - Full height */
.right-section {
  display: flex;
  flex-direction: column;
  gap: 2vh;
  min-height: 0;
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

/* Fullscreen Mode - Even more space */
.display-page.fullscreen .display-content {
  padding: 1.5vh 2vw;
}

.display-page.fullscreen .title {
  font-size: clamp(36px, 5vw, 72px);
}

.display-page.fullscreen .menorah-section :deep(.menorah-svg svg) {
  max-height: 88vh;
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
    padding: 1.5vh 3vw;
  }

  .display-grid {
    gap: 3vw;
  }

  .menorah-section :deep(.menorah-svg svg) {
    max-height: 88vh;
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
