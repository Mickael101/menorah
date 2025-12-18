<script setup lang="ts">
// Page 7 - Optimisee LED Geant - Blanc brillant maximum contraste
import { onMounted, ref } from 'vue';
import { useSocket } from '../composables/useSocket';
import { useDonations } from '../composables/useDonations';
import MenorahDisplay from '../components/display/MenorahDisplay.vue';
import StatsCompact from '../components/display/StatsCompact.vue';
import DonorPlatesGrid from '../components/display/DonorPlatesGrid.vue';

const { on, isConnected } = useSocket();
const { fetchDonations, fetchConfig, handleDonationNew, handleDonationUpdated, handleDonationDeleted, handleConfigUpdated } = useDonations();

const isFullscreen = ref(false);
const showDonationFlash = ref(false);

function triggerDonationCelebration(): void {
  showDonationFlash.value = true;
  setTimeout(() => { showDonationFlash.value = false; }, 2000);
}

onMounted(async () => {
  await Promise.all([fetchDonations(), fetchConfig()]);
  on('donation:new', (data: any) => { handleDonationNew(data.donation, data.stats); triggerDonationCelebration(); });
  on('donation:updated', (data: any) => { handleDonationUpdated(data.donation, data.stats); });
  on('donation:deleted', (data: any) => { handleDonationDeleted(data.donationId, data.stats); });
  on('config:updated', (data: any) => { handleConfigUpdated(data.config, data.stats); });
  on('connect', async () => { await Promise.all([fetchDonations(), fetchConfig()]); });
});

function toggleFullscreen(): void {
  if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); isFullscreen.value = true; }
  else { document.exitFullscreen(); isFullscreen.value = false; }
}
</script>

<template>
  <div class="display-page" :class="{ fullscreen: isFullscreen }">
    <div class="donation-flash" :class="{ active: showDonationFlash }"></div>
    <div class="connection-status" :class="{ connected: isConnected }">
      <span class="status-dot"></span>
      {{ isConnected ? 'EN DIRECT' : 'RECONNEXION...' }}
    </div>
    <button class="fullscreen-btn" @click="toggleFullscreen">
      <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
    </button>
    <div class="display-content">
      <div class="display-grid">
        <div class="menorah-section"><MenorahDisplay /></div>
        <div class="right-section">
          <div class="gala-header">
            <span class="gala-title">GALA DES FONDATEURS</span>
            <span class="gala-org">OHEL YEHOSHUA</span>
          </div>
          <StatsCompact />
          <div class="donors-section">
            <div class="section-header"><span>LE TABLEAU DES FONDATEURS</span></div>
            <DonorPlatesGrid />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Page 7 - LED OPTIMISE - Blanc brillant, contraste maximum */
.display-page { min-height: 100vh; height: 100vh; background: #FFFFFF; position: relative; overflow: hidden; }
.donation-flash { position: fixed; inset: 0; background: rgba(255, 200, 0, 0.5); pointer-events: none; z-index: 1000; opacity: 0; }
.donation-flash.active { opacity: 1; animation: flash-pulse 2s ease-out; }
@keyframes flash-pulse { 0% { opacity: 0; } 10% { opacity: 1; } 100% { opacity: 0; } }

/* Status tres visible pour LED */
.connection-status { position: fixed; top: 25px; right: 25px; display: flex; align-items: center; gap: 10px; padding: 15px 25px; background: #FF0000; border: 3px solid #000; border-radius: 50px; font-size: 20px; font-weight: 900; color: #FFFFFF; z-index: 100; letter-spacing: 2px; }
.connection-status.connected { background: #00AA00; border-color: #000; color: #FFFFFF; }
.status-dot { width: 16px; height: 16px; border-radius: 50%; background: #FFFFFF; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }

/* Bouton fullscreen visible */
.fullscreen-btn { position: fixed; top: 25px; left: 25px; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; background: #FFD700; border: 3px solid #000; border-radius: 15px; cursor: pointer; z-index: 100; }
.fullscreen-btn svg { width: 30px; height: 30px; color: #000; }
.fullscreen-btn:hover { background: #FFC000; }

.display-content { position: relative; z-index: 10; height: 100vh; display: flex; flex-direction: column; }

/* Header ultra visible */
.gala-header { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 2vh 0; }
.gala-title { font-size: clamp(20px, 2.5vw, 36px); color: #000000; font-weight: 900; letter-spacing: 6px; }
.gala-org { font-size: clamp(30px, 4vw, 60px); color: #B8860B; font-weight: 900; letter-spacing: 8px; margin-top: 8px; text-shadow: 2px 2px 0 #000; -webkit-text-stroke: 1px #000; }

.display-grid { flex: 1; display: grid; grid-template-columns: 50% 50%; width: 100%; min-height: 0; }
.menorah-section { display: flex; align-items: center; justify-content: center; width: 50vw; height: 100vh; }
.menorah-section :deep(.menorah-svg svg) { height: 100vh; width: auto; max-height: 100vh; }
.right-section { display: flex; flex-direction: column; gap: 1.5vh; width: 50vw; height: 100vh; padding: 1vh 2vw; box-sizing: border-box; }
.donors-section { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }

/* Header section ultra visible */
.section-header { display: flex; align-items: center; justify-content: center; margin-bottom: 2vh; padding-bottom: 1.5vh; border-bottom: 5px solid #B8860B; }
.section-header span { font-size: clamp(22px, 2.5vw, 40px); font-weight: 900; color: #000; letter-spacing: 4px; text-shadow: 1px 1px 0 #B8860B; }

@media (max-width: 1200px) { .display-grid { grid-template-columns: 1fr; } .menorah-section { max-height: 50vh; } }
</style>
