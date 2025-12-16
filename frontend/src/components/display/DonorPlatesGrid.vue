<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue';
import { useDonations, type Donation } from '../../composables/useDonations';
import { useSocket } from '../../composables/useSocket';
import DonorPlate from './DonorPlate.vue';

// Données gérées par le parent (DisplayPage) via useDonations
const { donations } = useDonations();
const { on } = useSocket();

const gridRef = ref<HTMLDivElement | null>(null);
const newDonationIds = ref<Set<number>>(new Set());

// Seuils en centimes (shekels * 100)
const THRESHOLDS = {
  XL: 7200000,  // 72,000 ₪
  L: 3600000,   // 36,000 ₪
  M: 2600000,   // 26,000 ₪
};

// Sorted donations by amount (descending)
const sortedDonations = computed(() => {
  return [...donations.value].sort((a, b) => b.amount - a.amount);
});

// Get CSS class for plate size based on amount
function getPlateSize(amount: number): string {
  if (amount >= THRESHOLDS.XL) return 'plate-xl';
  if (amount >= THRESHOLDS.L) return 'plate-l';
  if (amount >= THRESHOLDS.M) return 'plate-m';
  return 'plate-s';
}

// Écoute les événements uniquement pour l'animation des nouveaux dons
onMounted(() => {
  on('donation:new', (data: any) => {
    newDonationIds.value.add(data.donation.id);

    nextTick(() => {
      scrollToTop();
      setTimeout(() => {
        newDonationIds.value.delete(data.donation.id);
      }, 2000);
    });
  });
});

function scrollToTop(): void {
  if (gridRef.value) {
    gridRef.value.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}

function isNewDonation(id: number): boolean {
  return newDonationIds.value.has(id);
}
</script>

<template>
  <div class="donor-wall-wrapper">
    <div ref="gridRef" class="donor-wall">
      <!-- Bento Grid - All donations in interlocking horizontal layout -->
      <div v-if="sortedDonations.length > 0" class="bento-grid">
        <TransitionGroup name="plate">
          <DonorPlate
            v-for="donation in sortedDonations"
            :key="donation.id"
            :donation="donation"
            :is-new="isNewDonation(donation.id)"
            :class="getPlateSize(donation.amount)"
          />
        </TransitionGroup>
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
  padding: 10px;
  padding-bottom: 40px;
  max-height: 100%;
  min-height: 200px;
}

/* Bento Grid - Interlocking horizontal layout */
.bento-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-start;
  align-items: flex-start;
}

/* Plate sizes for bento effect */
.bento-grid :deep(.plate-xl) {
  flex: 0 0 calc(100% - 6px);
  max-width: calc(100% - 6px);
}

.bento-grid :deep(.plate-l) {
  flex: 0 0 calc(50% - 6px);
  max-width: calc(50% - 6px);
}

.bento-grid :deep(.plate-m) {
  flex: 0 0 calc(33.333% - 6px);
  max-width: calc(33.333% - 6px);
}

.bento-grid :deep(.plate-s) {
  flex: 0 0 calc(25% - 6px);
  max-width: calc(25% - 6px);
}

/* Custom scrollbar */
.donor-wall::-webkit-scrollbar {
  width: 6px;
}

.donor-wall::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 3px;
}

.donor-wall::-webkit-scrollbar-thumb {
  background: rgba(212, 175, 55, 0.3);
  border-radius: 3px;
  transition: background 0.3s ease;
}

.donor-wall::-webkit-scrollbar-thumb:hover {
  background: rgba(212, 175, 55, 0.5);
}

/* Transition animations */
.plate-enter-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.plate-leave-active {
  transition: all 0.3s ease-out;
}

.plate-enter-from {
  opacity: 0;
  transform: scale(0.8) translateY(20px);
}

.plate-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.plate-move {
  transition: transform 0.3s ease;
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

/* Responsive */
@media (max-width: 800px) {
  .bento-grid :deep(.plate-xl) {
    flex: 0 0 100%;
    max-width: 100%;
  }

  .bento-grid :deep(.plate-l) {
    flex: 0 0 100%;
    max-width: 100%;
  }

  .bento-grid :deep(.plate-m) {
    flex: 0 0 calc(50% - 6px);
    max-width: calc(50% - 6px);
  }

  .bento-grid :deep(.plate-s) {
    flex: 0 0 calc(50% - 6px);
    max-width: calc(50% - 6px);
  }
}

@media (max-width: 500px) {
  .bento-grid :deep(.plate-m),
  .bento-grid :deep(.plate-s) {
    flex: 0 0 100%;
    max-width: 100%;
  }
}
</style>
