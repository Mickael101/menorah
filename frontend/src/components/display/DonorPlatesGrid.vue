<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useDonations, type Donation } from '../../composables/useDonations';
import { useSocket } from '../../composables/useSocket';
import DonorPlate from './DonorPlate.vue';

const props = withDefaults(defineProps<{
  spotlight?: boolean;
}>(), {
  spotlight: false
});

// Données gérées par le parent (DisplayPage) via useDonations
const { donations } = useDonations();
const { on, off } = useSocket();

const SCROLL_SPEED_PX_PER_SECOND = 30;
const SHUTTLE_PAUSE_SECONDS = 2;

const gridRef = ref<HTMLDivElement | null>(null);
const newDonationIds = ref<Set<number>>(new Set());
const isPaused = ref(false);
// Décalage vertical du carrousel, en pixels. Piloté par transform (non borné,
// composé sur le GPU) et non par scrollTop, qui sature à scrollHeight - clientHeight.
const scrollOffset = ref(0);
let animationFrameId: number | null = null;
let resumeTimeoutId: number | null = null;
// Le démarrage différé doit être annulable : sans cela, démonter le composant dans
// les deux secondes (navigation entre /display, /display-light et /display-hidden,
// qui montent tous trois ce composant) laisse le timeout survivre a
// stopAutoScroll(), relancer la boucle, et plus rien ne peut l'annuler.
let startTimeoutId: number | null = null;
let lastTime = 0;
// Sens et pause de la navette utilisee quand le contenu depasse de moins d'une rangee.
let shuttleDirection: 1 | -1 = 1;
let shuttlePauseRemaining = 0;
const newDonationTimers = new Map<number, number>();

const platesTransform = computed(() => `translateY(${-scrollOffset.value}px)`);

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Rotation order - IDs in display order (first element shown first)
const rotationOrder = ref<number[]>([]);

// Initialize rotation order when donations change
watch(() => donations.value, (newDonations) => {
  const sortedIds = [...newDonations]
    .sort((a, b) => b.amount - a.amount)
    .map(d => d.id);

  // Only reset if we have new donations not in the current order
  const currentSet = new Set(rotationOrder.value);
  const hasNewDonations = sortedIds.some(id => !currentSet.has(id));

  if (hasNewDonations || rotationOrder.value.length === 0) {
    rotationOrder.value = sortedIds;
  }
}, { immediate: true });

// Get donations in rotation order
const displayDonations = computed(() => {
  const donationMap = new Map(donations.value.map(d => [d.id, d]));
  return rotationOrder.value
    .map(id => donationMap.get(id))
    .filter((d): d is Donation => d !== undefined);
});

function getVisibleColumnCount(): number {
  if (!props.spotlight || !gridRef.value) return 1;
  const platesGrid = gridRef.value.querySelector('.plates-grid');
  if (!platesGrid) return 1;
  const columns = getComputedStyle(platesGrid).gridTemplateColumns;
  return Math.max(1, columns.split(' ').filter(Boolean).length);
}

// Rotate a full row so two-column donor walls never jump by half a row.
function rotateFirst(): void {
  if (rotationOrder.value.length <= 1) return;
  const columnCount = Math.min(getVisibleColumnCount(), rotationOrder.value.length);
  const firstRow = rotationOrder.value.splice(0, columnCount);
  rotationOrder.value.push(...firstRow);
}

// Hauteur réellement visible du mur : sa boîte de contenu, padding exclu.
function getVisibleHeight(wall: HTMLElement): number {
  const style = getComputedStyle(wall);
  const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
  return wall.clientHeight - padding;
}

// Hauteur d'une rangée : une plaque plus sa gouttière (une rangée = 2 plaques en spotlight).
function getRowHeight(grid: HTMLElement, firstPlate: HTMLElement): number {
  const rowGap = Number.parseFloat(getComputedStyle(grid).rowGap) || 0;
  return firstPlate.offsetHeight + rowGap;
}

// Infinite scroll with element rotation
function infiniteScroll(currentTime: number): void {
  animationFrameId = requestAnimationFrame(infiniteScroll);

  const deltaTime = lastTime ? (currentTime - lastTime) / 1000 : 0;
  lastTime = currentTime;

  const wall = gridRef.value;
  const grid = wall?.querySelector('.plates-grid') as HTMLElement | null;
  const firstPlate = grid?.querySelector('.plaque') as HTMLElement | null;

  // Plus rien à faire tourner : le décalage doit REVENIR à zéro, pas rester figé.
  // Contrairement à scrollTop, que le navigateur re-borne quand le contenu rétrécit,
  // un transform garde sa valeur : sans cette remise à zéro, supprimer des dons en
  // fin de soirée laisserait l'unique plaque restante translatée vers le haut et
  // rognée, avec un vide équivalent en bas, sans autocorrection.
  if (!wall || !grid || !firstPlate || displayDonations.value.length <= 1) {
    scrollOffset.value = 0;
    return;
  }

  // La pause, elle, doit CONSERVER le décalage : on reprend où on s'était arrêté.
  if (isPaused.value) return;

  const rowHeight = getRowHeight(grid, firstPlate);
  // offsetHeight ignore le transform : c'est bien la hauteur de mise en page du contenu.
  const hiddenHeight = grid.offsetHeight - getVisibleHeight(wall);

  // Tout tient à l'écran : rien ne bouge, rien n'est rogné.
  if (hiddenHeight <= 0) {
    scrollOffset.value = 0;
    return;
  }

  // BANDE MARGINALE : le contenu dépasse, mais de moins d'une rangée entière.
  // Ne rien faire ici recréerait le défaut même que cette tranche corrige, déplacé
  // de la première plaque vers la DERNIÈRE — mesuré à 13,5 px de rognage permanent
  // en 1440x720 avec cinq dons, et jusqu'à 39,6 px en une colonne. Et faire tourner
  // la rotation découvrirait un vide en bas.
  // La navette résout les deux : le décalage oscille entre 0 et hiddenHeight, donc il
  // n'expose jamais de vide, ne fait sortir aucune rangée (aucune rotation nécessaire),
  // et chaque plaque redevient périodiquement entièrement visible.
  if (hiddenHeight < rowHeight) {
    shuttleScroll(hiddenHeight, deltaTime);
    return;
  }

  shuttleDirection = 1;
  shuttlePauseRemaining = 0;
  scrollOffset.value += SCROLL_SPEED_PX_PER_SECOND * deltaTime;

  // Première rangée entièrement sortie par le haut : elle repart à la fin et le
  // décalage revient à zéro dans le même frame, donc sans saut visible.
  if (scrollOffset.value >= rowHeight) {
    rotateFirst();
    scrollOffset.value -= rowHeight;
  }
}

// Va-et-vient entre 0 et `travel`, avec une pause à chaque extrémité pour laisser
// le temps de lire les noms des deux bouts.
function shuttleScroll(travel: number, deltaTime: number): void {
  if (shuttlePauseRemaining > 0) {
    shuttlePauseRemaining -= deltaTime;
    return;
  }

  scrollOffset.value += SCROLL_SPEED_PX_PER_SECOND * deltaTime * shuttleDirection;

  if (scrollOffset.value >= travel) {
    scrollOffset.value = travel;
    shuttleDirection = -1;
    shuttlePauseRemaining = SHUTTLE_PAUSE_SECONDS;
  } else if (scrollOffset.value <= 0) {
    scrollOffset.value = 0;
    shuttleDirection = 1;
    shuttlePauseRemaining = SHUTTLE_PAUSE_SECONDS;
  }
}

function startAutoScroll(): void {
  if (animationFrameId || prefersReducedMotion()) return;
  lastTime = 0;
  animationFrameId = requestAnimationFrame(infiniteScroll);
}

function stopAutoScroll(): void {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function pauseScroll(duration: number): void {
  isPaused.value = true;

  if (resumeTimeoutId !== null) {
    window.clearTimeout(resumeTimeoutId);
  }

  resumeTimeoutId = window.setTimeout(() => {
    isPaused.value = false;
    resumeTimeoutId = null;
  }, duration);
}

// Handler nomme pour pouvoir le retirer au demontage : sans cela il s'accumule a
// chaque remontage du composant, et un affichage kiosque qui enchaine les vues
// pendant des heures finit avec autant de handlers que de navigations.
function handleNewDonation(data: any): void {
  const donationId = data.donation.id as number;
  newDonationIds.value.add(donationId);

  // Keep the latest donation visible immediately before it joins the carousel.
  rotationOrder.value = [
    donationId,
    ...rotationOrder.value.filter(id => id !== donationId)
  ];

  // Pause scroll and go to top for new donation
  pauseScroll(5000);
  scrollOffset.value = 0;

  const previousTimer = newDonationTimers.get(donationId);
  if (previousTimer !== undefined) {
    window.clearTimeout(previousTimer);
  }

  const timerId = window.setTimeout(() => {
    newDonationIds.value.delete(donationId);
    newDonationTimers.delete(donationId);
  }, 5000);
  newDonationTimers.set(donationId, timerId);
}

// Écoute les événements uniquement pour l'animation des nouveaux dons
onMounted(() => {
  on('donation:new', handleNewDonation);

  // Start auto-scroll after a delay
  startTimeoutId = window.setTimeout(() => {
    startTimeoutId = null;
    startAutoScroll();
  }, 2000);
});

onUnmounted(() => {
  off('donation:new', handleNewDonation);
  if (startTimeoutId !== null) {
    window.clearTimeout(startTimeoutId);
    startTimeoutId = null;
  }
  stopAutoScroll();
  if (resumeTimeoutId !== null) {
    window.clearTimeout(resumeTimeoutId);
  }
  for (const timerId of newDonationTimers.values()) {
    window.clearTimeout(timerId);
  }
  newDonationTimers.clear();
});

function isNewDonation(id: number): boolean {
  return newDonationIds.value.has(id);
}
</script>

<template>
  <div class="donor-wall-wrapper">
    <div ref="gridRef" class="donor-wall">
      <!-- Infinite rotating carousel -->
      <div
        v-if="displayDonations.length > 0"
        class="plates-grid"
        :class="{
          spotlight: props.spotlight,
          few: props.spotlight && displayDonations.length <= 4,
          single: props.spotlight && displayDonations.length === 1,
          'is-scrolling': scrollOffset > 0
        }"
        :style="{ transform: platesTransform }"
      >
        <DonorPlate
          v-for="donation in displayDonations"
          :key="donation.id"
          :donation="donation"
          :is-new="isNewDonation(donation.id)"
        />
      </div>

      <!-- Empty State -->
      <div v-if="donations.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
        <p class="empty-text">En attente des premiers dons...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.donor-wall-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.donor-wall {
  height: 100%;
  /* Le défilement est piloté par transform sur .plates-grid : le mur ne fait que rogner. */
  overflow: hidden;
  padding: 8px;
  padding-bottom: 20px;
  max-height: 100%;
  min-height: 100px;
  box-sizing: border-box;
}

/* Une plaque par ligne - pleine largeur */
.plates-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

/* will-change n'est pose que pendant le mouvement. En permanence, il reserve une
   couche de composition et de la memoire GPU meme sur les affichages ou le
   carrousel ne bougera jamais — le cas majoritaire, puisque cinq dons tiennent a
   l'ecran a toutes les resolutions TV usuelles. */
.plates-grid.is-scrolling {
  will-change: transform;
}

/* Mouvement reduit demande : le defilement automatique s'arrete, il faut donc
   rendre le defilement MANUEL. Sans cela, les plaques hors champ deviennent
   definitivement inaccessibles — mesure : 1153 px de contenu invisible sur 1466.
   Aucun conflit avec le transform : dans ce mode le decalage reste nul par
   construction, startAutoScroll() sortant avant le premier frame. */
@media (prefers-reduced-motion: reduce) {
  .donor-wall {
    overflow-y: auto;
  }
}

.plates-grid :deep(.plaque) {
  width: 100%;
}

.plates-grid.spotlight {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(10px, 1.4vw, 18px);
}

.plates-grid.spotlight :deep(.plaque) {
  min-height: clamp(94px, 12vh, 132px);
}

.plates-grid.spotlight :deep(.nom) {
  font-size: clamp(1.2rem, 1.75vw, 2.25rem);
}

.plates-grid.spotlight :deep(.nom.compact) {
  font-size: clamp(1.08rem, 1.5vw, 1.95rem);
}

.plates-grid.spotlight :deep(.nom.extra-compact) {
  font-size: clamp(1rem, 1.3vw, 1.7rem);
}

.plates-grid.spotlight :deep(.montant) {
  font-size: clamp(1.05rem, 1.35vw, 1.75rem);
}

.plates-grid.spotlight.few {
  min-height: 100%;
  align-content: center;
}

.plates-grid.spotlight.few :deep(.plaque) {
  min-height: clamp(138px, 19vh, 190px);
}

.plates-grid.spotlight.few :deep(.nom) {
  font-size: clamp(1.55rem, 2.25vw, 2.8rem);
}

.plates-grid.spotlight.few :deep(.montant) {
  font-size: clamp(1.25rem, 1.65vw, 2.1rem);
}

.plates-grid.spotlight.single {
  grid-template-columns: minmax(0, 760px);
  justify-content: center;
}



/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(212, 175, 55, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.empty-icon svg {
  width: 36px;
  height: 36px;
  color: rgba(212, 175, 55, 0.4);
}

.empty-text {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
  margin: 0;
}

/* Responsive - toujours pleine largeur */
@media (max-width: 800px) {
  .plates-grid {
    gap: 8px;
  }

  .plates-grid.spotlight {
    grid-template-columns: 1fr;
  }
}
</style>
