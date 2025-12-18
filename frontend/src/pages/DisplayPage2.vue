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

function triggerDonationCelebration(): void {
  showDonationFlash.value = true;
  setTimeout(() => {
    showDonationFlash.value = false;
  }, 2000);
}

onMounted(async () => {
  await Promise.all([fetchDonations(), fetchConfig()]);

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

  on('connect', async () => {
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
    <!-- Donation Flash -->
    <div class="donation-flash" :class="{ active: showDonationFlash }"></div>

    <!-- Connection Status -->
    <div class="connection-status" :class="{ connected: isConnected }">
      <span class="status-dot"></span>
      {{ isConnected ? 'En direct' : 'Reconnexion...' }}
    </div>

    <!-- Fullscreen Toggle -->
    <button class="fullscreen-btn" @click="toggleFullscreen">
      <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
      </svg>
    </button>

    <!-- Main Content -->
    <div class="display-content">
      <div class="display-grid">
        <div class="menorah-section">
          <MenorahDisplay />
        </div>

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
/* Page 2 - Fond blanc pur */
.display-page {
  min-height: 100vh;
  height: 100vh;
  background: #FFFFFF;
  position: relative;
  overflow: hidden;
}

/* Flash donation */
.donation-flash {
  position: fixed;
  inset: 0;
  background: rgba(255, 215, 0, 0.3);
  pointer-events: none;
  z-index: 1000;
  opacity: 0;
  transition: opacity 0.3s;
}

.donation-flash.active {
  opacity: 1;
  animation: flash-pulse 2s ease-out;
}

@keyframes flash-pulse {
  0% { opacity: 0; }
  10% { opacity: 1; }
  100% { opacity: 0; }
}

/* Connection Status */
.connection-status {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: #FEE2E2;
  border: 2px solid #EF4444;
  border-radius: 50px;
  font-size: 16px;
  font-weight: 700;
  color: #DC2626;
  z-index: 100;
}

.connection-status.connected {
  background: #D1FAE5;
  border-color: #10B981;
  color: #059669;
}

.status-dot {
  width: 12px;
  height: 12px;
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
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F3F4F6;
  border: 2px solid #D1D5DB;
  border-radius: 12px;
  cursor: pointer;
  z-index: 100;
}

.fullscreen-btn svg {
  width: 24px;
  height: 24px;
  color: #374151;
}

.fullscreen-btn:hover {
  background: #E5E7EB;
}

/* Display Content */
.display-content {
  position: relative;
  z-index: 10;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Gala header */
.gala-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5vh 0;
}

.gala-title {
  font-size: clamp(16px, 2vw, 28px);
  color: #6B7280;
  font-weight: 700;
  letter-spacing: 4px;
}

.gala-org {
  font-size: clamp(24px, 3vw, 44px);
  color: #B8860B;
  font-weight: 900;
  letter-spacing: 5px;
  margin-top: 5px;
}

/* Grid Layout */
.display-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 50% 50%;
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
  width: 50vw;
  height: 100vh;
  padding: 1vh 2vw;
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
  border-bottom: 3px solid #B8860B;
}

.section-header span {
  font-size: clamp(18px, 2vw, 32px);
  font-weight: 900;
  color: #B8860B;
  letter-spacing: 3px;
}

/* Responsive */
@media (max-width: 1200px) {
  .display-grid {
    grid-template-columns: 1fr;
  }
  .menorah-section {
    max-height: 50vh;
  }
}
</style>
