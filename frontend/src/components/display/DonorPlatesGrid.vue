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
const { on } = useSocket();

const gridRef = ref<HTMLDivElement | null>(null);
const newDonationIds = ref<Set<number>>(new Set());
const isPaused = ref(false);
let animationFrameId: number | null = null;
let resumeTimeoutId: number | null = null;
let lastTime = 0;
const newDonationTimers = new Map<number, number>();

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

// Infinite scroll with element rotation
function infiniteScroll(currentTime: number): void {
  if (!gridRef.value || isPaused.value) {
    lastTime = currentTime;
    animationFrameId = requestAnimationFrame(infiniteScroll);
    return;
  }

  const el = gridRef.value;
  const firstPlate = el.querySelector('.plaque') as HTMLElement;

  if (!firstPlate || displayDonations.value.length <= 1) {
    animationFrameId = requestAnimationFrame(infiniteScroll);
    return;
  }

  // Calculate time-based scroll
  const deltaTime = lastTime ? (currentTime - lastTime) / 1000 : 0;
  lastTime = currentTime;

  const scrollSpeed = 30; // pixels per second
  const scrollDelta = scrollSpeed * deltaTime;

  el.scrollTop += scrollDelta;

  // When first element is fully scrolled out, rotate it to end and reset scroll
  const grid = el.querySelector('.plates-grid') as HTMLElement | null;
  const rowGap = grid ? Number.parseFloat(getComputedStyle(grid).rowGap) || 10 : 10;
  const firstPlateHeight = firstPlate.offsetHeight + rowGap;
  if (el.scrollTop >= firstPlateHeight) {
    rotateFirst();
    el.scrollTop = el.scrollTop - firstPlateHeight;
  }

  animationFrameId = requestAnimationFrame(infiniteScroll);
}

function startAutoScroll(): void {
  if (animationFrameId) return;
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

// Écoute les événements uniquement pour l'animation des nouveaux dons
onMounted(() => {
  on('donation:new', (data: any) => {
    const donationId = data.donation.id as number;
    newDonationIds.value.add(donationId);

    // Keep the latest donation visible immediately before it joins the carousel.
    rotationOrder.value = [
      donationId,
      ...rotationOrder.value.filter(id => id !== donationId)
    ];

    // Pause scroll and go to top for new donation
    pauseScroll(5000);
    if (gridRef.value) {
      gridRef.value.scrollTop = 0;
    }

    const previousTimer = newDonationTimers.get(donationId);
    if (previousTimer !== undefined) {
      window.clearTimeout(previousTimer);
    }

    const timerId = window.setTimeout(() => {
      newDonationIds.value.delete(donationId);
      newDonationTimers.delete(donationId);
    }, 5000);
    newDonationTimers.set(donationId, timerId);
  });

  // Start auto-scroll after a delay
  setTimeout(() => {
    startAutoScroll();
  }, 2000);
});

onUnmounted(() => {
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
          single: props.spotlight && displayDonations.length === 1
        }"
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
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
  padding-bottom: 20px;
  max-height: 100%;
  min-height: 100px;
  box-sizing: border-box;
  /* Hide scrollbar for cleaner look with auto-scroll */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.donor-wall::-webkit-scrollbar {
  display: none;
}

/* Une plaque par ligne - pleine largeur */
.plates-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
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
