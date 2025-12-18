<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { useDonations, type Donation } from '../../composables/useDonations';
import { useSocket } from '../../composables/useSocket';
import DonorPlate from './DonorPlate.vue';

// Données gérées par le parent (DisplayPage) via useDonations
const { donations } = useDonations();
const { on } = useSocket();

const gridRef = ref<HTMLDivElement | null>(null);
const newDonationIds = ref<Set<number>>(new Set());
const isPaused = ref(false);
let scrollInterval: number | null = null;
let scrollPosition = ref(0);

// Sorted donations by amount (descending)
const sortedDonations = computed(() => {
  return [...donations.value].sort((a, b) => b.amount - a.amount);
});

// Infinite scroll - continuous loop
function infiniteScroll(): void {
  if (!gridRef.value || isPaused.value) return;

  const el = gridRef.value;
  const contentHeight = el.scrollHeight / 2; // Half because we duplicate content

  if (contentHeight <= el.clientHeight) return; // Nothing to scroll

  const scrollSpeed = 0.8; // pixels per frame

  scrollPosition.value += scrollSpeed;

  // When we've scrolled through the first set, reset to beginning
  if (scrollPosition.value >= contentHeight) {
    scrollPosition.value = 0;
  }

  el.scrollTop = scrollPosition.value;
}

function startAutoScroll(): void {
  if (scrollInterval) return;
  scrollInterval = window.setInterval(infiniteScroll, 16); // ~60fps
}

function stopAutoScroll(): void {
  if (scrollInterval) {
    clearInterval(scrollInterval);
    scrollInterval = null;
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
    scrollPosition.value = 0;
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
      <!-- Infinite scroll grid - donations duplicated for seamless loop -->
      <div v-if="sortedDonations.length > 0" class="plates-grid">
        <!-- First set of donations -->
        <DonorPlate
          v-for="donation in sortedDonations"
          :key="`a-${donation.id}`"
          :donation="donation"
          :is-new="isNewDonation(donation.id)"
        />
        <!-- Duplicate set for seamless infinite scroll -->
        <DonorPlate
          v-for="donation in sortedDonations"
          :key="`b-${donation.id}`"
          :donation="donation"
          :is-new="false"
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
