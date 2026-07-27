<script setup lang="ts">
// Ecran de dons en direct — implementation UNIQUE des trois routes display (C3).
// Le comportement et le rendu divergents sont pilotes par le descripteur `variant`
// (voir displayVariants.ts et l'inventaire des divergences dans docs/verif/...).
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useSocket } from '../../composables/useSocket';
import { useEventContext, currentEventScope } from '../../composables/useEventContext';
import {
  useDonations,
  type Donation,
  DEFAULT_DISPLAY_TEXTS
} from '../../composables/useDonations';
import { getDisplayThemeStyles } from '../../theme/displayThemes';
import CampaignVisual from './CampaignVisual.vue';
import StatsCompact from './StatsCompact.vue';
import DonorPlatesGrid from './DonorPlatesGrid.vue';
import DonorPlateAnimation from './DonorPlateAnimation.vue';
import type { DisplayVariant } from './displayVariants';

const props = defineProps<{ variant: DisplayVariant }>();

const { on, isConnected, join } = useSocket();
const route = useRoute();
// Cablage slug->display (O2) : un ecran /e/:slug/display* montre SA soiree.
// Sans slug, portee nulle => soiree active, byte-identique a avant.
const eventContext = useEventContext();
const eventNotFound = eventContext.notFound;
const {
  config,
  stats,
  fetchDonations,
  fetchConfig,
  handleDonationNew,
  handleDonationUpdated,
  handleDonationDeleted,
  handleConfigUpdated
} = useDonations();

const displayStyles = computed(() => getDisplayThemeStyles(config.value.displaySettings));
const themeClass = computed(() => `theme-${config.value.displaySettings.theme}`);
const visualMode = computed(() => config.value.displaySettings.visualMode ?? 'none');
const customSvgUrl = computed(() => config.value.displaySettings.customSvgUrl ?? null);
const displayTexts = computed(() => ({
  ...DEFAULT_DISPLAY_TEXTS,
  ...(config.value.displaySettings.texts ?? {})
}));
const textDirection = computed(() => config.value.displaySettings.textDirection ?? 'auto');
const donationAnimation = computed(() => config.value.displaySettings.donationAnimation ?? 'prestige');
const hasCampaignVisual = computed(() =>
  visualMode.value === 'menorah'
  || (visualMode.value === 'custom' && Boolean(customSvgUrl.value))
);

// Classes de racine qui portent les axes de divergence (voir <style>).
const rootClasses = computed(() => [
  themeClass.value,
  `variant-${props.variant.name}`,
  props.variant.backgroundStyle === 'composite' ? 'bg-composite' : 'bg-flat',
  props.variant.starsIntensity === 'bright' ? 'stars-bright' : 'stars-soft',
  { 'has-theme-overlays': props.variant.themeOverlays, fullscreen: isFullscreen.value }
]);

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
  } catch (e) {
    console.log('Audio error:', e);
  }
}

function showDonationCelebration(donation: Donation): void {
  showDonationFlash.value = true;
  latestDonation.value = donation;
  showPlateAnimation.value = true;

  if (config.value.displaySettings.donationSound) {
    playAudio(config.value.displaySettings.donationSound);
  }

  if (flashTimeoutId !== null) window.clearTimeout(flashTimeoutId);
  flashTimeoutId = window.setTimeout(() => {
    showDonationFlash.value = false;
    flashTimeoutId = null;
  }, 2000);
}

// Avec file d'attente (main/light), chaque don a son moment complet a l'ecran.
// Sans file (hidden), un nouveau don interrompt et remplace l'animation en cours.
function triggerDonationCelebration(donation: Donation): void {
  if (props.variant.queueDonations && (showPlateAnimation.value || nextDonationTimeoutId !== null)) {
    donationQueue.value.push(donation);
    return;
  }
  showDonationCelebration(donation);
}

function handlePlateAnimationEnd(): void {
  showPlateAnimation.value = false;
  if (!props.variant.queueDonations) return;

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

  if (audioUrl) playAudio(audioUrl);

  if (gifTimeoutId !== null) window.clearTimeout(gifTimeoutId);
  gifTimeoutId = window.setTimeout(() => {
    showGifExplosion.value = false;
    gifTimeoutId = null;
  }, 4000);
}

// Resout la soiree courante (slug de route) AVANT tout fetch : pose la portee
// ambiante que useDonations lit pour choisir entre routes heritees et prefixees,
// rejoint la room, puis charge dons + config. Re-executable : le watch ci-dessous
// la rappelle quand le slug change sans que le composant soit remonte.
async function resolveAndLoad(): Promise<void> {
  const slugParam = route.params.slug;
  await eventContext.resolve(typeof slugParam === 'string' ? slugParam : null);
  if (eventContext.notFound.value) {
    // Slug inconnu : etat 404, JAMAIS les donnees d'une autre soiree.
    return;
  }
  // Rejoint la room de la soiree resolue (re-emise par useSocket a chaque
  // reconnexion). Portee nulle => auto-abonnement backend a la soiree active.
  join(currentEventScope());

  await Promise.all([fetchDonations(), fetchConfig()]);
}

onMounted(async () => {
  await resolveAndLoad();

  // Handlers socket enregistres UNE SEULE fois : useSocket.on empile les
  // callbacks, donc les re-enregistrer a chaque changement de slug doublerait
  // les celebrations. Ils operent sur l'etat reactif partage, donc restent
  // corrects apres une re-resolution (nouvelle room + nouveau fetch).
  on('donation:new', (data: any) => {
    handleDonationNew(data.donation, data.stats);
    triggerDonationCelebration(data.donation);
  });

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

  on('connect', async () => {
    console.log('Socket reconnected, reloading state...');
    await Promise.all([fetchDonations(), fetchConfig()]);
  });
});

// /display et /e/:slug/display partagent CE composant : une navigation SPA entre
// les deux familles (ou d'un slug a un autre) reutilise l'instance sans repasser
// par onMounted, si bien que l'ecran resterait sur la soiree precedente. On
// re-resout (et re-joint la room, re-fetch) a chaque changement de slug.
watch(() => route.params.slug, () => { void resolveAndLoad(); });

onUnmounted(() => {
  if (flashTimeoutId !== null) window.clearTimeout(flashTimeoutId);
  if (nextDonationTimeoutId !== null) window.clearTimeout(nextDonationTimeoutId);
  if (gifTimeoutId !== null) window.clearTimeout(gifTimeoutId);
  donationQueue.value = [];
  // Ne pas laisser fuiter la portee de soiree sur la page suivante.
  eventContext.clear();
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
  <!-- Slug inconnu : 404 sec, jamais les donnees d'une autre soiree (O2) -->
  <div v-if="eventNotFound" class="display-page event-not-found" dir="auto">
    <p class="event-not-found-message">404</p>
  </div>

  <div v-else class="display-page" :class="rootClasses" :style="displayStyles" :dir="textDirection">
    <!-- Fond etoile (main + hidden) -->
    <div v-if="variant.showStars" class="bg-effects">
      <div class="stars-layer stars-layer-1"></div>
      <div class="stars-layer stars-layer-2"></div>
      <div class="stars-layer stars-layer-3"></div>
    </div>

    <!-- Flash de don : riche (main/hidden) ou simple (light) -->
    <div
      class="donation-flash"
      :class="[
        { active: showDonationFlash },
        `flash-${variant.flashKind}`,
        `flash-anchor-${variant.flashAnchor}`,
        `flash-glow-${variant.flashGlowColor}`
      ]"
    >
      <template v-if="variant.flashKind === 'rich'">
        <div class="flash-rays"></div>
        <div class="flash-glow"></div>
        <div class="flash-particles">
          <span v-for="i in variant.flashParticleCount" :key="i" class="particle"></span>
        </div>
      </template>
    </div>

    <!-- Moment de la plaque du donateur -->
    <DonorPlateAnimation
      :donation="latestDonation"
      :show="showPlateAnimation"
      :animation-style="donationAnimation"
      :thank-you-title="displayTexts.thankYouTitle"
      :thank-you-message="displayTexts.thankYouMessage"
      :text-direction="textDirection"
      @animationEnd="handlePlateAnimationEnd"
    />

    <!-- Explosion GIF (declenchee admin) -->
    <Transition name="gif-explosion">
      <div
        v-if="showGifExplosion"
        class="gif-explosion-container"
        :class="[
          `gif-glow-${variant.gifGlowColor}`,
          `gif-particle-${variant.gifParticleColor}`,
          `gif-ring-${variant.gifRingSize}`,
          `gif-size-${variant.gifSize}`
        ]"
      >
        <div class="gif-explosion-content">
          <img :src="currentGif" alt="Celebration" class="explosion-gif" />
        </div>
        <div class="gif-explosion-particles">
          <span v-for="i in variant.gifParticleCount" :key="i" class="gif-particle"></span>
        </div>
        <div class="gif-explosion-rings">
          <div class="gif-ring gif-ring-1"></div>
          <div class="gif-ring gif-ring-2"></div>
          <div class="gif-ring gif-ring-3"></div>
        </div>
      </div>
    </Transition>

    <!-- Statut de connexion -->
    <div class="connection-status" :class="[{ connected: isConnected }, `status-${variant.statusStyle}`]">
      <span class="status-dot"></span>
      <span :dir="textDirection">{{ isConnected ? displayTexts.liveLabel : displayTexts.reconnectingLabel }}</span>
    </div>

    <!-- Bascule plein ecran -->
    <button
      class="fullscreen-btn"
      :class="`fs-${variant.fullscreenStyle}`"
      @click="toggleFullscreen"
      :title="isFullscreen ? 'Quitter le plein écran' : 'Plein écran'"
    >
      <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
      </svg>
    </button>

    <!-- Contenu principal -->
    <div class="display-content">
      <div class="display-grid" :class="{ 'without-visual': !hasCampaignVisual }">
        <!-- Visuel de campagne optionnel ; les donateurs restent la priorite visuelle. -->
        <div v-if="hasCampaignVisual" class="campaign-visual-section">
          <div v-if="variant.campaignFrame" class="campaign-visual-frame">
            <CampaignVisual :mode="visualMode" :custom-svg-url="customSvgUrl" />
          </div>
          <CampaignVisual v-else :mode="visualMode" :custom-svg-url="customSvgUrl" />
        </div>

        <!-- Scene principale des donateurs -->
        <div class="right-section">
          <div class="gala-header">
            <span class="gala-title" :dir="textDirection">{{ displayTexts.eventTitle }}</span>
            <span class="gala-org" :dir="textDirection">{{ displayTexts.organizationName }}</span>
          </div>

          <StatsCompact />

          <div class="donors-section">
            <div class="section-header">
              <div class="section-copy">
                <span v-if="variant.showBoardKicker" class="section-kicker" :dir="textDirection">{{ displayTexts.boardKicker }}</span>
                <span class="section-title" :dir="textDirection">{{ displayTexts.boardTitle }}</span>
              </div>
              <span v-if="variant.showDonorCount" class="donor-count" :dir="textDirection">
                {{ stats.donationCount }} {{ stats.donationCount === 1 ? displayTexts.donorSingular : displayTexts.donorPlural }}
              </span>
            </div>
            <DonorPlatesGrid spotlight />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Slug inconnu (O2) : etat neutre, aucune donnee d'une autre soiree */
.event-not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #070914;
}
.event-not-found-message {
  font-size: 3rem;
  color: #8b8fa3; /* 6.20:1 sur #070914, calcule (node, formule WCAG) */
  letter-spacing: 0.25em;
}

/* ============================================================
   BASE — structure commune aux trois variantes
   ============================================================ */
.display-page {
  min-height: 100vh;
  height: 100vh;
  position: relative;
  overflow: hidden;
  color: var(--stats-text-color);
  font-family: var(--theme-font-body);
}

.display-page.bg-composite {
  background-color: var(--bg-color, #070914);
  background-image:
    var(--bg-image, none),
    radial-gradient(circle at 22% 48%, color-mix(in srgb, var(--chart-primary-color) 7%, transparent), transparent 34%),
    linear-gradient(135deg, color-mix(in srgb, var(--bg-color) 90%, black), var(--bg-color));
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  isolation: isolate;
}

.display-page.bg-flat {
  background: var(--bg-image, none), var(--bg-color, #070914);
  background-size: cover;
}

/* Overlays de thème (main uniquement) */
.display-page.has-theme-overlays::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.32;
}

.display-page.has-theme-overlays.theme-premium::before {
  background: linear-gradient(115deg, rgba(255, 255, 255, 0.025), transparent 32%, rgba(255, 255, 255, 0.02));
}

.display-page.has-theme-overlays.theme-modern::before {
  opacity: 0.2;
  background-image:
    linear-gradient(color-mix(in srgb, var(--chart-primary-color) 14%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--chart-primary-color) 14%, transparent) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: linear-gradient(to bottom, black, transparent 78%);
}

.display-page.has-theme-overlays.theme-ceremonial::before {
  opacity: 0.26;
  background:
    radial-gradient(circle at center, transparent 35%, rgba(0, 0, 0, 0.48) 100%),
    repeating-linear-gradient(105deg, rgba(255, 255, 255, 0.018) 0 1px, transparent 1px 7px);
}

/* ============================================================
   ETOILES DE FOND
   ============================================================ */
.bg-effects {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.stars-soft .bg-effects { opacity: 0.36; }
.stars-bright .bg-effects { opacity: 1; }
.stars-soft.theme-modern .bg-effects { opacity: 0.24; }
.stars-soft.theme-ceremonial .bg-effects { opacity: 0.18; }

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
}

.stars-layer-3 {
  background-image:
    radial-gradient(1.5px 1.5px at 30px 100px, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(2px 2px at 120px 40px, rgba(255, 255, 255, 0.5), transparent),
    radial-gradient(1.5px 1.5px at 210px 130px, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(1px 1px at 300px 70px, rgba(255, 255, 255, 0.8), transparent);
  background-size: 350px 160px;
  animation: stars-float-3 100s linear infinite, stars-twinkle 8s ease-in-out infinite;
}

.stars-soft .stars-layer-1 { opacity: 0.62; }
.stars-soft .stars-layer-2 { opacity: 0.46; }
.stars-soft .stars-layer-3 { opacity: 0.5; }
.stars-bright .stars-layer-1 { opacity: 0.9; }
.stars-bright .stars-layer-2 { opacity: 0.7; }
.stars-bright .stars-layer-3 { opacity: 0.5; }

@keyframes stars-float-1 { from { transform: translate(0, 0); } to { transform: translate(-250px, -100px); } }
@keyframes stars-float-2 { from { transform: translate(0, 0); } to { transform: translate(200px, -90px); } }
@keyframes stars-float-3 { from { transform: translate(0, 0); } to { transform: translate(-175px, 80px); } }
@keyframes stars-twinkle { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.8; } }

/* ============================================================
   FLASH DE DON
   ============================================================ */
.donation-flash {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
}

.flash-anchor-center { --flash-x: 50%; }
.flash-anchor-left { --flash-x: 25%; }

/* Flash simple (light) */
.donation-flash.flash-simple {
  background: color-mix(in srgb, var(--chart-primary-color) 35%, transparent);
  opacity: 0;
}
.donation-flash.flash-simple.active { opacity: 1; animation: flash-pulse 2s ease-out; }
@keyframes flash-pulse { 0% { opacity: 0; } 10% { opacity: 1; } 100% { opacity: 0; } }

/* Flash riche (main/hidden) */
.donation-flash.flash-rich { opacity: 0; visibility: hidden; }
.donation-flash.flash-rich.active { visibility: visible; animation: flash-sequence 2s ease-out forwards; }
@keyframes flash-sequence { 0% { opacity: 0; } 5% { opacity: 1; } 30% { opacity: 1; } 100% { opacity: 0; } }

.flash-rays {
  position: absolute;
  top: 50%;
  left: var(--flash-x, 50%);
  width: 100px;
  height: 100px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
}

.flash-glow-theme .flash-rays {
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    color-mix(in srgb, var(--chart-primary-color) 45%, transparent) 10deg,
    transparent 20deg, transparent 30deg,
    rgba(255, 215, 0, 0.4) 40deg, transparent 50deg, transparent 60deg,
    rgba(255, 215, 0, 0.5) 70deg, transparent 80deg, transparent 90deg,
    rgba(255, 215, 0, 0.6) 100deg, transparent 110deg, transparent 120deg,
    rgba(255, 215, 0, 0.4) 130deg, transparent 140deg, transparent 150deg,
    rgba(255, 215, 0, 0.5) 160deg, transparent 170deg, transparent 180deg,
    rgba(255, 215, 0, 0.6) 190deg, transparent 200deg, transparent 210deg,
    rgba(255, 215, 0, 0.4) 220deg, transparent 230deg, transparent 240deg,
    rgba(255, 215, 0, 0.5) 250deg, transparent 260deg, transparent 270deg,
    rgba(255, 215, 0, 0.6) 280deg, transparent 290deg, transparent 300deg,
    rgba(255, 215, 0, 0.4) 310deg, transparent 320deg, transparent 330deg,
    rgba(255, 215, 0, 0.5) 340deg, transparent 350deg, transparent 360deg
  );
}

.flash-glow-gold .flash-rays {
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(255, 215, 0, 0.6) 10deg,
    transparent 20deg, transparent 30deg,
    rgba(255, 215, 0, 0.4) 40deg, transparent 50deg, transparent 60deg,
    rgba(255, 215, 0, 0.5) 70deg, transparent 80deg, transparent 90deg,
    rgba(255, 215, 0, 0.6) 100deg, transparent 110deg, transparent 120deg,
    rgba(255, 215, 0, 0.4) 130deg, transparent 140deg, transparent 150deg,
    rgba(255, 215, 0, 0.5) 160deg, transparent 170deg, transparent 180deg,
    rgba(255, 215, 0, 0.6) 190deg, transparent 200deg, transparent 210deg,
    rgba(255, 215, 0, 0.4) 220deg, transparent 230deg, transparent 240deg,
    rgba(255, 215, 0, 0.5) 250deg, transparent 260deg, transparent 270deg,
    rgba(255, 215, 0, 0.6) 280deg, transparent 290deg, transparent 300deg,
    rgba(255, 215, 0, 0.4) 310deg, transparent 320deg, transparent 330deg,
    rgba(255, 215, 0, 0.5) 340deg, transparent 350deg, transparent 360deg
  );
}

.donation-flash.flash-rich.active .flash-rays { animation: rays-expand 2s ease-out forwards; }
@keyframes rays-expand {
  0% { width: 100px; height: 100px; opacity: 0; }
  10% { opacity: 1; }
  100% { width: 300vw; height: 300vw; opacity: 0; transform: translate(-50%, -50%) rotate(180deg); }
}

.flash-glow {
  position: absolute;
  top: 50%;
  left: var(--flash-x, 50%);
  width: 200px;
  height: 200px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
}
.flash-glow-theme .flash-glow {
  background: radial-gradient(circle, color-mix(in srgb, var(--chart-primary-color) 32%, transparent) 0%, transparent 70%);
}
.flash-glow-gold .flash-glow {
  background: radial-gradient(circle, rgba(255, 215, 0, 0.8) 0%, rgba(255, 215, 0, 0) 70%);
}
.donation-flash.flash-rich.active .flash-glow { animation: glow-pulse 1.5s ease-out forwards; }
@keyframes glow-pulse {
  0% { width: 200px; height: 200px; opacity: 0; }
  20% { opacity: 1; }
  100% { width: 150vw; height: 150vw; opacity: 0; }
}

.flash-particles {
  position: absolute;
  top: 50%;
  left: var(--flash-x, 50%);
  width: 0;
  height: 0;
}

.particle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--chart-primary-color);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--chart-primary-color), 0 0 20px var(--chart-secondary-color);
}

.donation-flash.flash-rich.active .particle { animation: particle-burst 1.5s ease-out forwards; }

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
  0% { transform: translate(0, 0) scale(0); opacity: 1; }
  20% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% {
    transform: translate(calc(cos(var(--angle)) * var(--distance)), calc(sin(var(--angle)) * var(--distance))) scale(0);
    opacity: 0;
  }
}

/* ============================================================
   EXPLOSION GIF
   ============================================================ */
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
  animation: gif-content-entrance 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
@keyframes gif-content-entrance {
  0% { transform: scale(0) rotate(-10deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(5deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

.explosion-gif { border-radius: 20px; }
.gif-size-lg .explosion-gif { max-width: 60vw; max-height: 70vh; }
.gif-size-md .explosion-gif { max-width: 50vw; max-height: 60vh; }

.gif-glow-theme .explosion-gif {
  box-shadow: 0 0 60px color-mix(in srgb, var(--chart-primary-color) 70%, transparent), 0 0 120px color-mix(in srgb, var(--chart-secondary-color) 42%, transparent);
  animation: gif-glow-theme 1s ease-in-out infinite alternate;
}
@keyframes gif-glow-theme {
  0% { box-shadow: 0 0 60px color-mix(in srgb, var(--chart-primary-color) 70%, transparent), 0 0 120px color-mix(in srgb, var(--chart-secondary-color) 42%, transparent); }
  100% { box-shadow: 0 0 82px color-mix(in srgb, var(--chart-primary-color) 90%, transparent), 0 0 155px color-mix(in srgb, var(--chart-secondary-color) 60%, transparent); }
}

.gif-glow-gold .explosion-gif {
  box-shadow: 0 0 60px rgba(255, 215, 0, 0.8), 0 0 120px rgba(255, 165, 0, 0.5), 0 0 180px rgba(255, 100, 0, 0.3);
  animation: gif-glow-gold 1s ease-in-out infinite alternate;
}
@keyframes gif-glow-gold {
  0% { box-shadow: 0 0 60px rgba(255, 215, 0, 0.8), 0 0 120px rgba(255, 165, 0, 0.5), 0 0 180px rgba(255, 100, 0, 0.3); }
  100% { box-shadow: 0 0 80px rgba(255, 215, 0, 1), 0 0 150px rgba(255, 165, 0, 0.7), 0 0 220px rgba(255, 100, 0, 0.5); }
}

.gif-explosion-particles { position: absolute; top: 50%; left: 50%; }

.gif-particle {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  animation: gif-particle-explode 2s ease-out forwards;
}
.gif-particle-theme .gif-particle {
  background: linear-gradient(135deg, var(--chart-primary-color), var(--chart-secondary-color));
  box-shadow: 0 0 15px var(--chart-primary-color), 0 0 30px var(--chart-secondary-color);
}
.gif-particle-gold .gif-particle {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  box-shadow: 0 0 15px #FFD700, 0 0 30px #FFA500;
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

.gif-explosion-rings { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
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

/* Taille (et duree) des anneaux : viewport 150vw/2s (main/light) vs fixe 800px/1.5s (hidden) */
.gif-ring-viewport { --gif-ring-end: 150vw; }
.gif-ring-fixed { --gif-ring-end: 800px; }
.gif-ring-fixed .gif-ring { animation-duration: 1.5s; }
@keyframes gif-ring-expand {
  0% { width: 50px; height: 50px; opacity: 1; border-width: 4px; }
  100% { width: var(--gif-ring-end, 150vw); height: var(--gif-ring-end, 150vw); opacity: 0; border-width: 1px; }
}

.gif-explosion-enter-active { animation: gif-explosion-in 0.3s ease-out; }
.gif-explosion-leave-active { animation: gif-explosion-out 0.5s ease-in; }
@keyframes gif-explosion-in { 0% { opacity: 0; } 100% { opacity: 1; } }
@keyframes gif-explosion-out { 0% { opacity: 1; } 100% { opacity: 0; } }

/* ============================================================
   STATUT DE CONNEXION (3 styles)
   ============================================================ */
.connection-status {
  position: fixed;
  display: flex;
  align-items: center;
  z-index: 100;
}
.status-dot { border-radius: 50%; }
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }

.status-themed {
  top: 25px;
  left: 100px;
  gap: 8px;
  padding: 10px 15px;
  background: color-mix(in srgb, var(--theme-surface-strong) 92%, #5c1414);
  border: 1px solid rgba(255, 120, 120, 0.55);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
  color: #FFFFFF;
  letter-spacing: 1.3px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(14px);
}
.status-themed.connected {
  background: color-mix(in srgb, var(--theme-surface-strong) 86%, #0b5f3b);
  border-color: rgba(91, 236, 167, 0.58);
  color: #FFFFFF;
}
.status-themed .status-dot { width: 9px; height: 9px; background: #FFFFFF; animation: pulse 1.5s ease-in-out infinite; }

.status-led {
  top: 25px;
  left: 100px;
  gap: 10px;
  padding: 15px 25px;
  background: #CC0000;
  border: 3px solid #660000;
  border-radius: 50px;
  font-size: 20px;
  font-weight: 900;
  color: #FFFFFF;
  letter-spacing: 2px;
}
.status-led.connected { background: #008800; border-color: #004400; color: #FFFFFF; }
.status-led .status-dot { width: 16px; height: 16px; background: #FFFFFF; animation: pulse 1.5s ease-in-out infinite; }

.status-glass {
  top: 20px;
  right: 20px;
  gap: 8px;
  padding: 10px 18px;
  background: rgba(239, 68, 68, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 50px;
  font-size: 13px;
  font-weight: 500;
  color: #fca5a5;
  transition: all 0.3s ease;
}
.status-glass.connected { background: rgba(16, 185, 129, 0.2); border-color: rgba(16, 185, 129, 0.3); color: #6ee7b7; }
.status-glass .status-dot { width: 8px; height: 8px; background: currentColor; animation: pulse 2s ease-in-out infinite; }

/* ============================================================
   BOUTON PLEIN ECRAN (3 styles)
   ============================================================ */
.fullscreen-btn {
  position: fixed;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
}

.fs-themed {
  top: 25px;
  left: 25px;
  width: 52px;
  height: 52px;
  background: var(--theme-surface-strong);
  border: 1px solid color-mix(in srgb, var(--header-text-color) 55%, transparent);
  border-radius: calc(var(--theme-radius) * 0.7);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(14px);
  transition: transform 180ms ease, background 180ms ease;
}
.fs-themed svg { width: 24px; height: 24px; color: var(--header-text-color); stroke-width: 2.4; }
.fs-themed:hover { background: color-mix(in srgb, var(--theme-surface-strong) 80%, var(--header-text-color)); transform: translateY(-2px); }
.fs-themed:hover svg { color: white; }

.fs-led {
  top: 25px;
  left: 25px;
  width: 60px;
  height: 60px;
  background: var(--theme-surface-strong);
  border: 2px solid var(--header-text-color);
  border-radius: var(--theme-radius);
}
.fs-led svg { width: 30px; height: 30px; color: var(--header-text-color); stroke-width: 3; }
.fs-led:hover { background: var(--theme-surface); }

.fs-glass {
  top: 20px;
  left: 20px;
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  transition: all 0.3s ease;
}
.fs-glass svg { width: 20px; height: 20px; color: rgba(255, 255, 255, 0.7); stroke-width: 2; transition: color 0.3s ease; }
.fs-glass:hover { background: rgba(255, 255, 255, 0.2); }
.fs-glass:hover svg { color: white; }

/* ============================================================
   CONTENU, GRILLE ET SECTIONS
   ============================================================ */
.display-content {
  position: relative;
  z-index: 10;
  padding: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.display-grid {
  display: grid;
  grid-template-columns: minmax(240px, 28%) minmax(0, 72%);
  flex: 1;
  width: 100%;
  min-height: 0;
  box-sizing: border-box;
}
.display-grid.without-visual { grid-template-columns: minmax(0, 1fr); }

.variant-main .display-grid { gap: clamp(12px, 1.5vw, 26px); padding: clamp(14px, 1.8vw, 30px); }
.variant-main .display-grid.without-visual { padding-inline: clamp(34px, 6vw, 120px); }
.variant-light .display-grid,
.variant-hidden .display-grid { gap: 18px; padding: 18px; }
.variant-light .display-grid.without-visual,
.variant-hidden .display-grid.without-visual { padding-inline: clamp(28px, 6vw, 110px); }

.right-section {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
}
.variant-main .right-section { gap: clamp(8px, 1vh, 14px); }
.variant-main .without-visual .right-section { width: min(100%, 1720px); margin-inline: auto; }
.variant-light .right-section { gap: 1.5vh; padding: 0; }
.variant-hidden .right-section { gap: 1vh; padding: 1vh 0; }

.donors-section {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}
.variant-main .donors-section {
  padding: clamp(10px, 1.2vw, 20px);
  border: 1px solid color-mix(in srgb, var(--header-text-color) 15%, transparent);
  border-radius: calc(var(--theme-radius) * 1.15);
  background: linear-gradient(145deg, color-mix(in srgb, var(--theme-surface) 76%, transparent), color-mix(in srgb, var(--theme-surface-strong) 68%, transparent));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035), 0 22px 60px rgba(0, 0, 0, 0.16);
}
.variant-main .without-visual .donors-section {
  background:
    radial-gradient(circle at 50% 52%, color-mix(in srgb, var(--chart-primary-color) 7%, transparent), transparent 42%),
    linear-gradient(145deg, color-mix(in srgb, var(--theme-surface) 76%, transparent), color-mix(in srgb, var(--theme-surface-strong) 68%, transparent));
}

/* En-tête gala */
.gala-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.variant-main .gala-header { flex-shrink: 0; padding: 0.5vh 0 1vh; }
.variant-main .without-visual .gala-header { padding-top: 0; }
.variant-light .gala-header { padding: 2vh 0; }
.variant-hidden .gala-header { flex-shrink: 0; padding: 1vh 0; }

.variant-main .gala-title {
  color: color-mix(in srgb, var(--stats-text-color) 66%, transparent);
  font-family: var(--theme-font-body);
  font-size: clamp(12px, 1vw, 17px);
  font-weight: 750;
  letter-spacing: clamp(3px, 0.45vw, 7px);
  text-transform: uppercase;
}
.variant-main .gala-org {
  margin-top: 2px;
  color: var(--header-text-color);
  font-family: var(--theme-font-display);
  font-size: clamp(28px, 3vw, 48px);
  font-weight: 850;
  letter-spacing: clamp(2px, 0.45vw, 7px);
  line-height: 1.05;
  text-shadow: 0 0 28px color-mix(in srgb, var(--header-text-color) 28%, transparent);
}
.variant-main .without-visual .gala-org { font-size: clamp(34px, 3.6vw, 60px); }

.variant-light .gala-title {
  font-size: clamp(22px, 3vw, 42px);
  color: var(--stats-text-color);
  font-weight: 900;
  letter-spacing: 6px;
}
.variant-light .gala-org {
  font-family: var(--theme-font-display);
  font-size: clamp(34px, 4.5vw, 70px);
  color: var(--header-text-color);
  font-weight: 900;
  letter-spacing: 8px;
  margin-top: 10px;
}

.variant-hidden .gala-title {
  font-size: clamp(12px, 1.2vw, 18px);
  color: color-mix(in srgb, var(--stats-text-color) 55%, transparent);
  font-weight: 400;
  letter-spacing: 2px;
  text-transform: uppercase;
}
.variant-hidden .gala-org {
  font-size: clamp(16px, 2vw, 28px);
  color: var(--header-text-color);
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  text-shadow: 0 0 20px color-mix(in srgb, var(--header-text-color) 45%, transparent);
  margin-top: 4px;
}

/* Bloc tableau */
.section-copy { display: flex; min-width: 0; flex-direction: column; gap: 3px; }

.variant-main .section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin: 0 clamp(8px, 1vw, 16px) 0.8vh;
  padding: 0 0 1vh;
  border-bottom: 1px solid color-mix(in srgb, var(--header-text-color) 32%, transparent);
  flex-shrink: 0;
}
.variant-main .section-kicker {
  color: color-mix(in srgb, var(--stats-text-color) 52%, transparent);
  font-family: var(--theme-font-body);
  font-size: clamp(9px, 0.72vw, 12px);
  font-weight: 750;
  letter-spacing: 0.2em;
}
.variant-main .section-title {
  color: var(--header-text-color);
  font-family: var(--theme-font-display);
  font-size: clamp(20px, 2vw, 36px);
  font-weight: 800;
  letter-spacing: clamp(1px, 0.2vw, 3px);
  line-height: 1.05;
  text-shadow: 0 0 18px color-mix(in srgb, var(--header-text-color) 22%, transparent);
}
.variant-main .donor-count {
  flex-shrink: 0;
  padding: 7px 11px;
  border: 1px solid color-mix(in srgb, var(--chart-primary-color) 32%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--chart-primary-color) 8%, transparent);
  color: color-mix(in srgb, var(--stats-text-color) 78%, transparent);
  font-size: clamp(9px, 0.75vw, 12px);
  font-weight: 800;
  letter-spacing: 0.12em;
}

.variant-light .section-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2vh;
  padding-bottom: 1.5vh;
  border-bottom: 3px solid var(--header-text-color);
}
.variant-light .section-title {
  font-family: var(--theme-font-display);
  font-size: clamp(24px, 3vw, 48px);
  font-weight: 900;
  color: var(--header-text-color);
  letter-spacing: 5px;
}

.variant-hidden .section-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5vh;
  padding-bottom: 1vh;
  border-bottom: 1px solid color-mix(in srgb, var(--header-text-color) 24%, transparent);
  flex-shrink: 0;
}
.variant-hidden .section-title {
  font-size: clamp(14px, 1.2vw, 20px);
  font-weight: 600;
  color: var(--header-text-color);
  letter-spacing: 1px;
  text-transform: uppercase;
  text-shadow: 0 0 10px color-mix(in srgb, var(--header-text-color) 28%, transparent);
}

/* Visuel de campagne */
.variant-main .campaign-visual-section { display: flex; min-width: 0; min-height: 0; align-items: stretch; }
.campaign-visual-frame {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--header-text-color) 14%, transparent);
  border-radius: calc(var(--theme-radius) * 1.2);
  background: var(--theme-visual-backdrop), color-mix(in srgb, var(--theme-surface) 52%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 24px 70px rgba(0, 0, 0, 0.22);
}
.campaign-visual-frame::after {
  content: '';
  position: absolute;
  inset: 4%;
  border: 1px solid color-mix(in srgb, var(--header-text-color) 8%, transparent);
  border-radius: inherit;
  pointer-events: none;
}

.variant-light .campaign-visual-section {
  display: flex;
  min-width: 0;
  min-height: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 2px solid color-mix(in srgb, var(--header-text-color) 28%, transparent);
  border-radius: var(--theme-radius);
  background: var(--theme-visual-backdrop);
}

.variant-hidden .campaign-visual-section {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  padding: 2vh 1.5vw;
  box-sizing: border-box;
  overflow: hidden;
}
.variant-hidden .campaign-visual-section :deep(.menorah-display) { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.variant-hidden .campaign-visual-section :deep(.menorah-svg) { width: 90%; height: 90%; display: flex; align-items: center; justify-content: center; }
.variant-hidden .campaign-visual-section :deep(.menorah-svg svg) { width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; }

/* Plein écran */
.display-page.fullscreen .display-content { padding: 0; }
.display-page.fullscreen .right-section { padding: 0.5vh 1vw; }

/* ============================================================
   RTL — l'hébreu ne s'espace pas comme le latin ; on neutralise
   le tracking sur les libellés une fois la direction RESOLUE en rtl
   (:dir(rtl) matche aussi dir="auto" sur du contenu hébreu, qui est
   la configuration livrée par défaut). Invisible en latin.
   ============================================================ */
.gala-title:dir(rtl),
.gala-org:dir(rtl),
.section-kicker:dir(rtl),
.section-title:dir(rtl),
.donor-count:dir(rtl) {
  letter-spacing: normal;
}

/* ============================================================
   RESPONSIVE
   ============================================================ */
@media (max-width: 1200px) {
  .variant-main .display-grid:not(.without-visual) { grid-template-columns: 1fr; grid-template-rows: minmax(0, 27vh) minmax(0, 1fr); }
  .variant-main .display-grid.without-visual { padding-inline: clamp(18px, 4vw, 48px); }
  .variant-main .campaign-visual-frame { width: min(100%, 860px); margin-inline: auto; }
  .variant-main .gala-header { padding-block: 0; }
  .variant-main .gala-title { font-size: clamp(11px, 1.4vw, 15px); }
  .variant-main .gala-org,
  .variant-main .without-visual .gala-org { font-size: clamp(28px, 4vw, 44px); }

  .variant-light .display-grid:not(.without-visual) { grid-template-columns: 1fr; grid-template-rows: minmax(0, 27vh) minmax(0, 1fr); }
  .variant-light .right-section { gap: 0.5vh; }
  .variant-light .gala-header { padding: 0.5vh 0; }
  .variant-light .gala-title { font-size: clamp(16px, 2.8vw, 28px); letter-spacing: clamp(2px, 0.5vw, 5px); }
  .variant-light .gala-org { margin-top: 0; font-size: clamp(24px, 5vw, 48px); letter-spacing: clamp(3px, 0.8vw, 7px); }
  .variant-light .section-header { margin-bottom: 0.5vh; padding-bottom: 0.5vh; border-bottom-width: 3px; }
  .variant-light .section-title { font-size: clamp(18px, 3.2vw, 32px); letter-spacing: clamp(2px, 0.5vw, 4px); }

  .variant-hidden .display-grid:not(.without-visual) { grid-template-columns: 1fr; grid-template-rows: minmax(0, 27vh) minmax(0, 1fr); gap: 12px; }
  .variant-hidden .campaign-visual-section { order: 1; max-height: none; }
  .variant-hidden .campaign-visual-section :deep(.menorah-svg svg) { max-height: 100%; }
  .variant-hidden .right-section { order: 2; }
}

@media (max-width: 768px) {
  .variant-main .display-grid,
  .variant-main .display-grid.without-visual { gap: 8px; padding: 8px; }
  .variant-main .display-grid:not(.without-visual) { grid-template-rows: minmax(0, 23vh) minmax(0, 1fr); }
  .variant-main .donors-section { padding: 8px; }
  .variant-main .section-header { align-items: center; margin-inline: 4px; }
  .variant-main .section-kicker { display: none; }
  .variant-main .section-title { font-size: clamp(17px, 4.8vw, 24px); }
  .variant-main .donor-count { padding: 5px 8px; font-size: 8px; }
  .variant-main .gala-header,
  .variant-main .without-visual .gala-header { padding-top: 50px; }
  .variant-main .gala-title { font-size: 9px; letter-spacing: 2px; }
  .variant-main .gala-org,
  .variant-main .without-visual .gala-org { font-size: clamp(24px, 8vw, 31px); letter-spacing: 2px; }
  .variant-main .fullscreen-btn { top: 8px; left: 8px; width: 40px; height: 40px; border-radius: 10px; }
  .variant-main .fullscreen-btn svg { width: 22px; height: 22px; }
  .variant-main .connection-status { top: 8px; right: 8px; left: auto; padding: 8px 11px; border-width: 2px; font-size: 12px; letter-spacing: 1px; }
  .variant-main .status-dot { width: 10px; height: 10px; }

  .variant-light .display-grid,
  .variant-light .display-grid.without-visual { padding: 8px; gap: 8px; }
  .variant-light .display-grid:not(.without-visual) { grid-template-rows: minmax(0, 23vh) minmax(0, 1fr); }
  .variant-light .gala-header { padding-top: 50px; }
  .variant-light .gala-title { font-size: 10px; letter-spacing: 2px; }
  .variant-light .gala-org { font-size: clamp(24px, 8vw, 31px); letter-spacing: 2px; }
  .variant-light .fullscreen-btn { top: 12px; left: 12px; width: 44px; height: 44px; border-radius: 10px; }
  .variant-light .fullscreen-btn svg { width: 22px; height: 22px; }
  .variant-light .connection-status { top: 12px; right: 12px; left: auto; padding: 9px 13px; border-width: 2px; font-size: 12px; letter-spacing: 1px; }
  .variant-light .status-dot { width: 10px; height: 10px; }

  .variant-hidden .display-content { padding: 8px; }
  .variant-hidden .gala-header { padding-top: 50px; }
  .variant-hidden .gala-title { font-size: 9px; }
  .variant-hidden .gala-org { font-size: clamp(24px, 8vw, 31px); }
}

@media (min-width: 1920px) {
  .variant-main .display-content,
  .variant-hidden .display-content { padding: 0; }
}

@media (min-width: 2560px) {
  .variant-main .section-title { font-size: clamp(40px, 1.5vw, 56px); }
  .variant-hidden .section-title { font-size: 24px; }
}

/* ============================================================
   THEME — surcharges d'en-tête (main)
   ============================================================ */
.variant-main.theme-modern .gala-header { align-items: flex-start; text-align: left; }
.variant-main.theme-modern .gala-org { text-shadow: 0 0 30px color-mix(in srgb, var(--header-text-color) 42%, transparent); }
.variant-main.theme-modern .section-header { justify-content: space-between; }
.variant-main.theme-modern .campaign-visual-frame {
  box-shadow: inset 0 0 44px color-mix(in srgb, var(--chart-primary-color) 6%, transparent), 0 28px 75px rgba(0, 0, 0, 0.25);
}
.variant-main.theme-ceremonial .campaign-visual-frame { outline: 1px solid color-mix(in srgb, var(--header-text-color) 12%, transparent); outline-offset: -10px; }
.variant-main.theme-ceremonial .gala-title { font-style: italic; text-transform: none; }

/* ============================================================
   MOUVEMENT REDUIT — couvre les trois variantes (light/hidden
   gagnent la garde qu'elles n'avaient pas ; aucune régression)
   ============================================================ */
@media (prefers-reduced-motion: reduce) {
  .stars-layer,
  .status-dot,
  .donation-flash.flash-simple,
  .flash-rays,
  .flash-glow,
  .particle,
  .gif-explosion-content,
  .explosion-gif,
  .gif-particle,
  .gif-ring {
    animation: none !important;
  }

  .flash-particles,
  .gif-explosion-particles,
  .gif-explosion-rings {
    display: none;
  }
}
</style>
