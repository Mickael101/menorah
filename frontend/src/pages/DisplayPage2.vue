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
    <!-- Elegant shimmer background effect -->
    <div class="bg-effects">
      <div class="shimmer-layer shimmer-1"></div>
      <div class="shimmer-layer shimmer-2"></div>
    </div>

    <!-- Donation Celebration Effect - Golden wave -->
    <div class="donation-flash" :class="{ active: showDonationFlash }">
      <div class="golden-wave"></div>
      <div class="sparkle-burst">
        <span v-for="i in 30" :key="i" class="sparkle"></span>
      </div>
    </div>

    <!-- Connection Status -->
    <div class="connection-status" :class="{ connected: isConnected }">
      <span class="status-dot"></span>
      {{ isConnected ? 'En direct' : 'Reconnexion...' }}
    </div>

    <!-- Fullscreen Toggle -->
    <button class="fullscreen-btn" @click="toggleFullscreen" :title="isFullscreen ? 'Quitter le plein ecran' : 'Plein ecran'">
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
/* Page 2 - Fond beige elegant */
.display-page {
  min-height: 100vh;
  height: 100vh;
  background: linear-gradient(135deg, #f5f0e6 0%, #e8dcc8 50%, #f0e6d3 100%);
  position: relative;
  overflow: hidden;
}

/* Background Effects - Subtle shimmer */
.bg-effects {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.shimmer-layer {
  position: absolute;
  width: 200%;
  height: 200%;
  top: -50%;
  left: -50%;
}

.shimmer-1 {
  background: linear-gradient(
    45deg,
    transparent 0%,
    rgba(212, 175, 55, 0.03) 25%,
    transparent 50%,
    rgba(212, 175, 55, 0.05) 75%,
    transparent 100%
  );
  background-size: 400px 400px;
  animation: shimmer-move 15s ease-in-out infinite;
}

.shimmer-2 {
  background: linear-gradient(
    -45deg,
    transparent 0%,
    rgba(255, 215, 0, 0.02) 25%,
    transparent 50%,
    rgba(255, 215, 0, 0.04) 75%,
    transparent 100%
  );
  background-size: 300px 300px;
  animation: shimmer-move 20s ease-in-out infinite reverse;
}

@keyframes shimmer-move {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(100px, 50px); }
}

/* Donation Celebration - Golden wave effect */
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

.golden-wave {
  position: absolute;
  top: 50%;
  left: 25%;
  width: 100px;
  height: 100px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(212, 175, 55, 0.6) 0%, rgba(255, 215, 0, 0.3) 40%, transparent 70%);
  border-radius: 50%;
}

.donation-flash.active .golden-wave {
  animation: wave-expand 2s ease-out forwards;
}

@keyframes wave-expand {
  0% {
    width: 100px;
    height: 100px;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    width: 200vw;
    height: 200vw;
    opacity: 0;
  }
}

.sparkle-burst {
  position: absolute;
  top: 50%;
  left: 25%;
}

.sparkle {
  position: absolute;
  width: 6px;
  height: 6px;
  background: #FFD700;
  border-radius: 50%;
  box-shadow: 0 0 8px #FFD700;
}

.donation-flash.active .sparkle {
  animation: sparkle-fly 1.8s ease-out forwards;
}

.sparkle:nth-child(1) { --angle: 0deg; --dist: 300px; }
.sparkle:nth-child(2) { --angle: 12deg; --dist: 280px; }
.sparkle:nth-child(3) { --angle: 24deg; --dist: 320px; }
.sparkle:nth-child(4) { --angle: 36deg; --dist: 260px; }
.sparkle:nth-child(5) { --angle: 48deg; --dist: 340px; }
.sparkle:nth-child(6) { --angle: 60deg; --dist: 290px; }
.sparkle:nth-child(7) { --angle: 72deg; --dist: 310px; }
.sparkle:nth-child(8) { --angle: 84deg; --dist: 270px; }
.sparkle:nth-child(9) { --angle: 96deg; --dist: 330px; }
.sparkle:nth-child(10) { --angle: 108deg; --dist: 285px; }
.sparkle:nth-child(11) { --angle: 120deg; --dist: 315px; }
.sparkle:nth-child(12) { --angle: 132deg; --dist: 265px; }
.sparkle:nth-child(13) { --angle: 144deg; --dist: 345px; }
.sparkle:nth-child(14) { --angle: 156deg; --dist: 295px; }
.sparkle:nth-child(15) { --angle: 168deg; --dist: 325px; }
.sparkle:nth-child(16) { --angle: 180deg; --dist: 275px; }
.sparkle:nth-child(17) { --angle: 192deg; --dist: 335px; }
.sparkle:nth-child(18) { --angle: 204deg; --dist: 255px; }
.sparkle:nth-child(19) { --angle: 216deg; --dist: 350px; }
.sparkle:nth-child(20) { --angle: 228deg; --dist: 305px; }
.sparkle:nth-child(21) { --angle: 240deg; --dist: 280px; }
.sparkle:nth-child(22) { --angle: 252deg; --dist: 320px; }
.sparkle:nth-child(23) { --angle: 264deg; --dist: 260px; }
.sparkle:nth-child(24) { --angle: 276deg; --dist: 340px; }
.sparkle:nth-child(25) { --angle: 288deg; --dist: 290px; }
.sparkle:nth-child(26) { --angle: 300deg; --dist: 310px; }
.sparkle:nth-child(27) { --angle: 312deg; --dist: 270px; }
.sparkle:nth-child(28) { --angle: 324deg; --dist: 330px; }
.sparkle:nth-child(29) { --angle: 336deg; --dist: 285px; }
.sparkle:nth-child(30) { --angle: 348deg; --dist: 315px; }

@keyframes sparkle-fly {
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
      calc(cos(var(--angle)) * var(--dist)),
      calc(sin(var(--angle)) * var(--dist))
    ) scale(0);
    opacity: 0;
  }
}

/* Connection Status - Dark text on light bg */
.connection-status {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: rgba(239, 68, 68, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 50px;
  font-size: 13px;
  font-weight: 500;
  color: #b91c1c;
  z-index: 100;
  transition: all 0.3s ease;
}

.connection-status.connected {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.3);
  color: #047857;
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

/* Fullscreen Button - Dark on light */
.fullscreen-btn {
  position: fixed;
  top: 20px;
  left: 20px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 12px;
  cursor: pointer;
  z-index: 100;
  transition: all 0.3s ease;
}

.fullscreen-btn svg {
  width: 20px;
  height: 20px;
  color: rgba(0, 0, 0, 0.5);
  transition: color 0.3s ease;
}

.fullscreen-btn:hover {
  background: rgba(0, 0, 0, 0.15);
}

.fullscreen-btn:hover svg {
  color: rgba(0, 0, 0, 0.8);
}

/* Display Content */
.display-content {
  position: relative;
  z-index: 10;
  padding: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* Gala header - Dark text */
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
  color: rgba(0, 0, 0, 0.5);
  font-weight: 400;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.gala-org {
  font-size: clamp(16px, 2vw, 28px);
  color: #8B6914;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  text-shadow: 0 2px 4px rgba(139, 105, 20, 0.2);
  margin-top: 4px;
}

/* Grid Layout */
.display-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 50% 50%;
  gap: 0;
  width: 100%;
  min-height: 0;
}

/* Menorah Section */
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

/* Right Section */
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

/* Donors Section */
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
  border-bottom: 1px solid rgba(139, 105, 20, 0.3);
  flex-shrink: 0;
}

.section-header span {
  font-size: clamp(14px, 1.2vw, 20px);
  font-weight: 600;
  color: #8B6914;
  letter-spacing: 1px;
  text-transform: uppercase;
}

/* Fullscreen Mode */
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
}
</style>
