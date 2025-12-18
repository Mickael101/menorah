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
  }, 2500);
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
    <!-- Subtle floating orbs background -->
    <div class="bg-effects">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <!-- Donation Celebration Effect - Radiant glow -->
    <div class="donation-flash" :class="{ active: showDonationFlash }">
      <div class="radiant-glow"></div>
      <div class="light-rings">
        <span v-for="i in 5" :key="i" class="ring"></span>
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
/* Page 3 - Fond blanc casse pur */
.display-page {
  min-height: 100vh;
  height: 100vh;
  background: linear-gradient(180deg, #fefefe 0%, #f8f6f2 50%, #faf9f5 100%);
  position: relative;
  overflow: hidden;
}

/* Background Effects - Floating orbs */
.bg-effects {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.3;
}

.orb-1 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(212, 175, 55, 0.4) 0%, transparent 70%);
  top: 10%;
  left: 5%;
  animation: orb-float 25s ease-in-out infinite;
}

.orb-2 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%);
  bottom: 20%;
  right: 10%;
  animation: orb-float 30s ease-in-out infinite reverse;
}

.orb-3 {
  width: 250px;
  height: 250px;
  background: radial-gradient(circle, rgba(184, 150, 12, 0.3) 0%, transparent 70%);
  top: 50%;
  left: 60%;
  animation: orb-float 35s ease-in-out infinite;
  animation-delay: -10s;
}

@keyframes orb-float {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(30px, -20px) scale(1.1);
  }
  50% {
    transform: translate(-20px, 30px) scale(0.9);
  }
  75% {
    transform: translate(-30px, -10px) scale(1.05);
  }
}

/* Donation Celebration - Radiant glow effect */
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
  animation: flash-sequence 2.5s ease-out forwards;
}

@keyframes flash-sequence {
  0% { opacity: 0; }
  5% { opacity: 1; }
  40% { opacity: 1; }
  100% { opacity: 0; }
}

.radiant-glow {
  position: absolute;
  top: 50%;
  left: 25%;
  width: 50px;
  height: 50px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle,
    rgba(255, 223, 0, 0.9) 0%,
    rgba(255, 215, 0, 0.6) 30%,
    rgba(212, 175, 55, 0.3) 60%,
    transparent 80%
  );
  border-radius: 50%;
}

.donation-flash.active .radiant-glow {
  animation: glow-breathe 2.5s ease-out forwards;
}

@keyframes glow-breathe {
  0% {
    width: 50px;
    height: 50px;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  50% {
    width: 120vw;
    height: 120vw;
    opacity: 0.8;
  }
  100% {
    width: 150vw;
    height: 150vw;
    opacity: 0;
  }
}

.light-rings {
  position: absolute;
  top: 50%;
  left: 25%;
  transform: translate(-50%, -50%);
}

.ring {
  position: absolute;
  border: 3px solid rgba(255, 215, 0, 0.6);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.donation-flash.active .ring {
  animation: ring-expand 2s ease-out forwards;
}

.ring:nth-child(1) { animation-delay: 0ms; }
.ring:nth-child(2) { animation-delay: 150ms; }
.ring:nth-child(3) { animation-delay: 300ms; }
.ring:nth-child(4) { animation-delay: 450ms; }
.ring:nth-child(5) { animation-delay: 600ms; }

@keyframes ring-expand {
  0% {
    width: 20px;
    height: 20px;
    opacity: 1;
    border-width: 4px;
  }
  100% {
    width: 120vw;
    height: 120vw;
    opacity: 0;
    border-width: 1px;
  }
}

/* Connection Status - Dark on white */
.connection-status {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: rgba(239, 68, 68, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 50px;
  font-size: 13px;
  font-weight: 500;
  color: #dc2626;
  z-index: 100;
  transition: all 0.3s ease;
}

.connection-status.connected {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.25);
  color: #059669;
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
  background: rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  cursor: pointer;
  z-index: 100;
  transition: all 0.3s ease;
}

.fullscreen-btn svg {
  width: 20px;
  height: 20px;
  color: rgba(0, 0, 0, 0.4);
  transition: color 0.3s ease;
}

.fullscreen-btn:hover {
  background: rgba(0, 0, 0, 0.1);
}

.fullscreen-btn:hover svg {
  color: rgba(0, 0, 0, 0.7);
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

/* Gala header - Elegant dark text */
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
  color: rgba(0, 0, 0, 0.4);
  font-weight: 400;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.gala-org {
  font-size: clamp(16px, 2vw, 28px);
  color: #9A7B0A;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  text-shadow: 0 1px 2px rgba(154, 123, 10, 0.15);
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
  border-bottom: 1px solid rgba(154, 123, 10, 0.25);
  flex-shrink: 0;
}

.section-header span {
  font-size: clamp(14px, 1.2vw, 20px);
  font-weight: 600;
  color: #9A7B0A;
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
