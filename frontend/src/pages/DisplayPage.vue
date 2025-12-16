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
      <div class="bg-stars"></div>
      <div class="bg-stars bg-stars-2"></div>
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

.bg-stars {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1px 1px at 10px 15px, rgba(255, 255, 255, 0.9), transparent),
    radial-gradient(1.5px 1.5px at 35px 55px, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(1px 1px at 60px 25px, rgba(255, 255, 255, 0.8), transparent),
    radial-gradient(2px 2px at 95px 70px, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(1px 1px at 120px 40px, rgba(255, 255, 255, 0.9), transparent),
    radial-gradient(1.5px 1.5px at 150px 90px, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(1px 1px at 175px 20px, rgba(255, 255, 255, 0.8), transparent),
    radial-gradient(2px 2px at 210px 65px, rgba(255, 255, 255, 0.5), transparent),
    radial-gradient(1px 1px at 240px 100px, rgba(255, 255, 255, 0.9), transparent),
    radial-gradient(1.5px 1.5px at 270px 45px, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(1px 1px at 300px 80px, rgba(255, 255, 255, 0.8), transparent),
    radial-gradient(2px 2px at 330px 35px, rgba(255, 255, 255, 0.7), transparent);
  background-repeat: repeat;
  background-size: 350px 120px;
  animation: stars-drift 8s linear infinite;
}

.bg-stars-2 {
  background-image:
    radial-gradient(1px 1px at 15px 85px, rgba(255, 255, 255, 0.8), transparent),
    radial-gradient(1.5px 1.5px at 55px 30px, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(1px 1px at 85px 105px, rgba(255, 255, 255, 0.9), transparent),
    radial-gradient(2px 2px at 125px 50px, rgba(255, 255, 255, 0.5), transparent),
    radial-gradient(1px 1px at 165px 75px, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(1.5px 1.5px at 195px 15px, rgba(255, 255, 255, 0.8), transparent),
    radial-gradient(1px 1px at 235px 95px, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(2px 2px at 275px 60px, rgba(255, 255, 255, 0.9), transparent),
    radial-gradient(1px 1px at 315px 25px, rgba(255, 255, 255, 0.7), transparent);
  background-size: 320px 130px;
  animation: stars-twinkle 4s ease-in-out infinite alternate;
}

@keyframes stars-drift {
  0% { transform: translateY(0); }
  100% { transform: translateY(-10px); }
}

@keyframes stars-twinkle {
  0% { opacity: 0.5; }
  100% { opacity: 1; }
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
  font-size: 42px;
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
  margin: 12px 0 0;
}

.subtitle span {
  font-size: 18px;
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
  gap: 16px;
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
  justify-content: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
}

.section-header span {
  font-size: 16px;
  font-weight: 600;
  color: #D4AF37;
  letter-spacing: 1px;
  text-transform: uppercase;
  text-shadow: 0 0 10px rgba(212, 175, 55, 0.3);
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
