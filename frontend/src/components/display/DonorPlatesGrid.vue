<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useDonations, type Donation } from '../../composables/useDonations';
import { useSocket } from '../../composables/useSocket';
import DonorPlate from './DonorPlate.vue';

// Données gérées par le parent (DisplayPage) via useDonations
const { donations } = useDonations();
const { on } = useSocket();

const gridRef = ref<HTMLDivElement | null>(null);
const newDonationIds = ref<Set<number>>(new Set());
const isPaused = ref(false);
let animationFrameId: number | null = null;
let lastTime = 0;

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

// Rotate: move first element to end
function rotateFirst(): void {
  if (rotationOrder.value.length <= 1) return;
  const first = rotationOrder.value.shift()!;
  rotationOrder.value.push(first);
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
  const firstPlateHeight = firstPlate.offsetHeight + 10; // +10 for gap
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
  setTimeout(() => {
    isPaused.value = false;
  }, duration);
}

// Écoute les événements uniquement pour l'animation des nouveaux dons
onMounted(() => {
  on('donation:new', (data: any) => {
    newDonationIds.value.add(data.donation.id);

    // Pause scroll and go to top for new donation
    isPaused.value = true;
    if (gridRef.value) {
      gridRef.value.scrollTop = 0;
    }

    nextTick(() => {
      setTimeout(() => {
        newDonationIds.value.delete(data.donation.id);
        // Resume infinite scroll after showing new donation
        isPaused.value = false;
      }, 5000);
    });
  });

  // Start auto-scroll after a delay
  setTimeout(() => {
    startAutoScroll();
  }, 2000);
});

onUnmounted(() => {
  stopAutoScroll();
});

function isNewDonation(id: number): boolean {
  return newDonationIds.value.has(id);
}
</script>

<template>
  <div class="donor-wall-wrapper">
    <div ref="gridRef" class="donor-wall">
      <!-- Infinite rotating carousel -->
      <div v-if="displayDonations.length > 0" class="plates-grid">
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
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
  padding-bottom: 20px;
  max-height: 100%;
  min-height: 100px;
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
}
</style>
