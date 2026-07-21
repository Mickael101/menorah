<script setup lang="ts">
// Page 8 - Optimisee LED Geant - Blanc chaud, police XXL
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useSocket } from '../composables/useSocket';
import { useDonations, type Donation } from '../composables/useDonations';
import CampaignVisual from '../components/display/CampaignVisual.vue';
import StatsCompact from '../components/display/StatsCompact.vue';
import DonorPlatesGrid from '../components/display/DonorPlatesGrid.vue';
import DonorPlateAnimation from '../components/display/DonorPlateAnimation.vue';
import { getDisplayThemeStyles } from '../theme/displayThemes';

const { on, isConnected } = useSocket();
const { config, fetchDonations, fetchConfig, handleDonationNew, handleDonationUpdated, handleDonationDeleted, handleConfigUpdated } = useDonations();
const displayStyles = computed(() => getDisplayThemeStyles(config.value.displaySettings));
const themeClass = computed(() => `theme-${config.value.displaySettings.theme}`);
const visualMode = computed(() => config.value.displaySettings.visualMode ?? 'none');
const customSvgUrl = computed(() => config.value.displaySettings.customSvgUrl ?? null);
const hasCampaignVisual = computed(() => visualMode.value === 'menorah'
  || (visualMode.value === 'custom' && Boolean(customSvgUrl.value)));

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

function playAudio(url: string): void {
  try {
    const audio = new Audio(url);
    audio.volume = 1.0;
    audio.play().catch(err => console.log('Audio play failed:', err));
  } catch (e) { console.log('Audio error:', e); }
}

function showDonationCelebration(donation: Donation): void {
  showDonationFlash.value = true;
  latestDonation.value = donation;
  showPlateAnimation.value = true;
  if (config.value.displaySettings.donationSound) { playAudio(config.value.displaySettings.donationSound); }
  if (flashTimeoutId !== null) window.clearTimeout(flashTimeoutId);
  flashTimeoutId = window.setTimeout(() => {
    showDonationFlash.value = false;
    flashTimeoutId = null;
  }, 2000);
}

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

function triggerGifExplosion(gifUrl: string, audioUrl?: string): void {
  currentGif.value = gifUrl;
  showGifExplosion.value = true;
  if (audioUrl) { playAudio(audioUrl); }
  if (gifTimeoutId !== null) window.clearTimeout(gifTimeoutId);
  gifTimeoutId = window.setTimeout(() => {
    showGifExplosion.value = false;
    gifTimeoutId = null;
  }, 4000);
}

onMounted(async () => {
  await Promise.all([fetchDonations(), fetchConfig()]);
  on('donation:new', (data: any) => { handleDonationNew(data.donation, data.stats); triggerDonationCelebration(data.donation); });
  on('gif:trigger', (data: any) => { triggerGifExplosion(data.gifUrl, data.audioUrl); });
  on('donation:updated', (data: any) => { handleDonationUpdated(data.donation, data.stats); });
  on('donation:deleted', (data: any) => { handleDonationDeleted(data.donationId, data.stats); });
  on('config:updated', (data: any) => { handleConfigUpdated(data.config, data.stats); });
  on('connect', async () => { await Promise.all([fetchDonations(), fetchConfig()]); });
});

onUnmounted(() => {
  if (flashTimeoutId !== null) window.clearTimeout(flashTimeoutId);
  if (nextDonationTimeoutId !== null) window.clearTimeout(nextDonationTimeoutId);
  if (gifTimeoutId !== null) window.clearTimeout(gifTimeoutId);
  donationQueue.value = [];
});

function toggleFullscreen(): void {
  if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); isFullscreen.value = true; }
  else { document.exitFullscreen(); isFullscreen.value = false; }
}
</script>

<template>
  <div class="display-page" :class="[themeClass, { fullscreen: isFullscreen }]" :style="displayStyles">
    <div class="donation-flash" :class="{ active: showDonationFlash }"></div>
    <DonorPlateAnimation :donation="latestDonation" :show="showPlateAnimation" @animationEnd="handlePlateAnimationEnd" />
    <!-- GIF Explosion (Admin triggered) -->
    <Transition name="gif-explosion">
      <div v-if="showGifExplosion" class="gif-explosion-container">
        <div class="gif-explosion-content"><img :src="currentGif" alt="Celebration" class="explosion-gif" /></div>
        <div class="gif-explosion-particles"><span v-for="i in 30" :key="i" class="gif-particle"></span></div>
        <div class="gif-explosion-rings"><div class="gif-ring gif-ring-1"></div><div class="gif-ring gif-ring-2"></div><div class="gif-ring gif-ring-3"></div></div>
      </div>
    </Transition>
    <div class="connection-status" :class="{ connected: isConnected }">
      <span class="status-dot"></span>
      {{ isConnected ? 'EN DIRECT' : 'RECONNEXION...' }}
    </div>
    <button class="fullscreen-btn" @click="toggleFullscreen">
      <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
    </button>
    <div class="display-content">
      <div class="display-grid" :class="{ 'without-visual': !hasCampaignVisual }">
        <div v-if="hasCampaignVisual" class="campaign-visual-section">
          <CampaignVisual :mode="visualMode" :custom-svg-url="customSvgUrl" />
        </div>
        <div class="right-section">
          <div class="gala-header">
            <span class="gala-title">SOIRÉE DE GÉNÉROSITÉ</span>
            <span class="gala-org">OHEL YEHOSHUA</span>
          </div>
          <StatsCompact />
          <div class="donors-section">
            <div class="section-header"><span>MERCI À NOS DONATEURS</span></div>
            <DonorPlatesGrid spotlight />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Variante LED claire, désormais raccordée aux trois palettes configurables. */
.display-page { min-height: 100vh; height: 100vh; background: var(--bg-image, none), var(--bg-color); background-size: cover; position: relative; overflow: hidden; color: var(--stats-text-color); font-family: var(--theme-font-body); }
.donation-flash { position: fixed; inset: 0; background: color-mix(in srgb, var(--chart-primary-color) 35%, transparent); pointer-events: none; z-index: 1000; opacity: 0; }
.donation-flash.active { opacity: 1; animation: flash-pulse 2s ease-out; }
@keyframes flash-pulse { 0% { opacity: 0; } 10% { opacity: 1; } 100% { opacity: 0; } }

/* Status tres visible pour LED */
.connection-status { position: fixed; top: 25px; left: 100px; display: flex; align-items: center; gap: 10px; padding: 15px 25px; background: #CC0000; border: 3px solid #660000; border-radius: 50px; font-size: 20px; font-weight: 900; color: #FFFFFF; z-index: 100; letter-spacing: 2px; }
.connection-status.connected { background: #008800; border-color: #004400; color: #FFFFFF; }
.status-dot { width: 16px; height: 16px; border-radius: 50%; background: #FFFFFF; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }

/* Bouton fullscreen */
.fullscreen-btn { position: fixed; top: 25px; left: 25px; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; background: var(--theme-surface-strong); border: 2px solid var(--header-text-color); border-radius: var(--theme-radius); cursor: pointer; z-index: 100; }
.fullscreen-btn svg { width: 30px; height: 30px; color: var(--header-text-color); }
.fullscreen-btn:hover { background: var(--theme-surface); }

.display-content { position: relative; z-index: 10; height: 100vh; display: flex; flex-direction: column; }

/* Header XXL */
.gala-header { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 2vh 0; }
.gala-title { font-size: clamp(22px, 3vw, 42px); color: var(--stats-text-color); font-weight: 900; letter-spacing: 6px; }
.gala-org { font-family: var(--theme-font-display); font-size: clamp(34px, 4.5vw, 70px); color: var(--header-text-color); font-weight: 900; letter-spacing: 8px; margin-top: 10px; }

.display-grid { flex: 1; display: grid; grid-template-columns: minmax(240px, 28%) minmax(0, 72%); gap: 18px; width: 100%; min-height: 0; padding: 18px; box-sizing: border-box; }
.display-grid.without-visual { grid-template-columns: minmax(0, 1fr); padding-inline: clamp(28px, 6vw, 110px); }
.campaign-visual-section { display: flex; min-width: 0; min-height: 0; align-items: center; justify-content: center; overflow: hidden; border: 2px solid color-mix(in srgb, var(--header-text-color) 28%, transparent); border-radius: var(--theme-radius); background: var(--theme-visual-backdrop); }
.right-section { display: flex; flex-direction: column; gap: 1.5vh; width: 100%; min-width: 0; min-height: 0; padding: 0; box-sizing: border-box; }
.donors-section { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }

/* Header section XXL */
.section-header { display: flex; align-items: center; justify-content: center; margin-bottom: 2vh; padding-bottom: 1.5vh; border-bottom: 3px solid var(--header-text-color); }
.section-header span { font-family: var(--theme-font-display); font-size: clamp(24px, 3vw, 48px); font-weight: 900; color: var(--header-text-color); letter-spacing: 5px; }

@media (max-width: 1200px) {
  .display-grid:not(.without-visual) { grid-template-columns: 1fr; grid-template-rows: minmax(0, 27vh) minmax(0, 1fr); }
  .right-section { gap: 0.5vh; }
  .gala-header { padding: 0.5vh 0; }
  .gala-title { font-size: clamp(16px, 2.8vw, 28px); letter-spacing: clamp(2px, 0.5vw, 5px); }
  .gala-org { margin-top: 0; font-size: clamp(24px, 5vw, 48px); letter-spacing: clamp(3px, 0.8vw, 7px); }
  .section-header { margin-bottom: 0.5vh; padding-bottom: 0.5vh; border-bottom-width: 3px; }
  .section-header span { font-size: clamp(18px, 3.2vw, 32px); letter-spacing: clamp(2px, 0.5vw, 4px); }
}

@media (max-width: 768px) {
  .display-grid, .display-grid.without-visual { padding: 8px; gap: 8px; }
  .display-grid:not(.without-visual) { grid-template-rows: minmax(0, 23vh) minmax(0, 1fr); }
  .gala-header { padding-top: 50px; }
  .gala-title { font-size: 10px; letter-spacing: 2px; }
  .gala-org { font-size: clamp(24px, 8vw, 31px); letter-spacing: 2px; }
  .fullscreen-btn { top: 12px; left: 12px; width: 44px; height: 44px; border-radius: 10px; }
  .fullscreen-btn svg { width: 22px; height: 22px; }
  .connection-status { top: 12px; right: 12px; left: auto; padding: 9px 13px; border-width: 2px; font-size: 12px; letter-spacing: 1px; }
  .status-dot { width: 10px; height: 10px; }
}

/* GIF Explosion Effect */
.gif-explosion-container { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.gif-explosion-content { position: relative; z-index: 10; animation: gif-content-entrance 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
@keyframes gif-content-entrance { 0% { transform: scale(0) rotate(-10deg); opacity: 0; } 50% { transform: scale(1.2) rotate(5deg); } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
.explosion-gif { max-width: 60vw; max-height: 70vh; border-radius: 20px; box-shadow: 0 0 60px rgba(255, 215, 0, 0.8), 0 0 120px rgba(255, 165, 0, 0.5), 0 0 180px rgba(255, 100, 0, 0.3); animation: gif-glow-anim 1s ease-in-out infinite alternate; }
@keyframes gif-glow-anim { 0% { box-shadow: 0 0 60px rgba(255, 215, 0, 0.8), 0 0 120px rgba(255, 165, 0, 0.5), 0 0 180px rgba(255, 100, 0, 0.3); } 100% { box-shadow: 0 0 80px rgba(255, 215, 0, 1), 0 0 150px rgba(255, 165, 0, 0.7), 0 0 220px rgba(255, 100, 0, 0.5); } }
.gif-explosion-particles { position: absolute; top: 50%; left: 50%; }
.gif-particle { position: absolute; width: 12px; height: 12px; background: linear-gradient(135deg, #FFD700, #FFA500); border-radius: 50%; box-shadow: 0 0 15px #FFD700, 0 0 30px #FFA500; animation: gif-particle-explode 2s ease-out forwards; }
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
@keyframes gif-particle-explode { 0% { transform: translate(0, 0) scale(0); opacity: 1; } 30% { transform: translate(calc(cos(var(--angle)) * calc(var(--dist) * 0.3)), calc(sin(var(--angle)) * calc(var(--dist) * 0.3))) scale(1.5); opacity: 1; } 100% { transform: translate(calc(cos(var(--angle)) * var(--dist)), calc(sin(var(--angle)) * var(--dist))) scale(0); opacity: 0; } }
.gif-explosion-rings { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
.gif-ring { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border: 4px solid rgba(255, 215, 0, 0.8); border-radius: 50%; animation: gif-ring-expand 2s ease-out forwards; }
.gif-ring-1 { animation-delay: 0ms; }
.gif-ring-2 { animation-delay: 200ms; }
.gif-ring-3 { animation-delay: 400ms; }
@keyframes gif-ring-expand { 0% { width: 50px; height: 50px; opacity: 1; border-width: 4px; } 100% { width: 150vw; height: 150vw; opacity: 0; border-width: 1px; } }
.gif-explosion-enter-active { animation: gif-explosion-in 0.3s ease-out; }
.gif-explosion-leave-active { animation: gif-explosion-out 0.5s ease-in; }
@keyframes gif-explosion-in { 0% { opacity: 0; } 100% { opacity: 1; } }
@keyframes gif-explosion-out { 0% { opacity: 1; } 100% { opacity: 0; } }
</style>
