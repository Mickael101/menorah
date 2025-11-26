<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useSocket } from '../composables/useSocket';
import { useDonations } from '../composables/useDonations';
import MenorahDisplay from '../components/display/MenorahDisplay.vue';
import TotalCounter from '../components/display/TotalCounter.vue';
import ProgressBar from '../components/display/ProgressBar.vue';
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

// Load initial data and setup socket listeners
onMounted(async () => {
  await Promise.all([fetchDonations(), fetchConfig()]);

  // Listen for real-time events
  on('donation:new', (data: any) => {
    handleDonationNew(data.donation, data.stats);
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
    <!-- Animated Background -->
    <div class="bg-effects">
      <div class="bg-gradient"></div>
      <div class="bg-stars"></div>
      <div class="bg-glow"></div>
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
        <h1 class="title">
          <span class="title-icon">✡</span>
          Ohel Yeochoua
        </h1>
        <p class="subtitle">Campagne de dons</p>
      </header>

      <!-- Grid Layout -->
      <div class="display-grid">
        <!-- Left: Menorah -->
        <div class="menorah-section">
          <MenorahDisplay />
        </div>

        <!-- Right: Stats & Donors -->
        <div class="right-section">
          <div class="stats-section">
            <TotalCounter />
            <ProgressBar />
          </div>

          <div class="donors-section">
            <div class="section-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <span>Nos généreux donateurs</span>
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
  background: #0a0a1a;
  position: relative;
  overflow: hidden;
}

/* Background Effects */
.bg-effects {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
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
  left: 30%;
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

/* Display Content */
.display-content {
  position: relative;
  z-index: 10;
  padding: 30px 40px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header */
.display-header {
  text-align: center;
  margin-bottom: 30px;
}

.title {
  display: inline-flex;
  align-items: center;
  gap: 16px;
  font-size: 42px;
  font-weight: 700;
  color: white;
  margin: 0;
  text-shadow: 0 0 40px rgba(255, 215, 0, 0.3);
}

.title-icon {
  font-size: 48px;
  color: #ffd700;
  filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.5));
}

.subtitle {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.5);
  margin: 8px 0 0;
  font-weight: 400;
  letter-spacing: 2px;
  text-transform: uppercase;
}

/* Grid Layout */
.display-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
}

/* Menorah Section */
.menorah-section {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Right Section */
.right-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Stats Section */
.stats-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Donors Section */
.donors-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.section-header svg {
  width: 22px;
  height: 22px;
  color: #f472b6;
}

.section-header span {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  letter-spacing: 0.5px;
}

/* Fullscreen Mode */
.display-page.fullscreen .display-content {
  padding: 40px 60px;
}

.display-page.fullscreen .title {
  font-size: 52px;
}

/* Responsive */
@media (max-width: 1200px) {
  .display-grid {
    grid-template-columns: 1fr;
    gap: 30px;
  }

  .menorah-section {
    order: 1;
  }

  .right-section {
    order: 2;
  }
}

@media (max-width: 768px) {
  .display-content {
    padding: 20px;
  }

  .title {
    font-size: 28px;
  }

  .title-icon {
    font-size: 32px;
  }

  .subtitle {
    font-size: 14px;
  }
}
</style>
