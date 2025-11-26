<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';
import { useDonations } from '../../composables/useDonations';
import { useSocket } from '../../composables/useSocket';
import DonorPlate from './DonorPlate.vue';

const { donations, fetchDonations, fetchConfig, handleDonationNew, handleDonationUpdated, handleDonationDeleted, handleConfigUpdated } = useDonations();
const { on } = useSocket();

const gridRef = ref<HTMLDivElement | null>(null);
const newDonationIds = ref<Set<number>>(new Set());

// Load initial data and setup socket listeners
onMounted(async () => {
  await Promise.all([fetchDonations(), fetchConfig()]);

  on('donation:new', (data: any) => {
    // Mark as new for animation
    newDonationIds.value.add(data.donation.id);
    handleDonationNew(data.donation, data.stats);

    // Auto-scroll to show new donation
    nextTick(() => {
      scrollToTop();
      // Remove "new" flag after animation
      setTimeout(() => {
        newDonationIds.value.delete(data.donation.id);
      }, 2000);
    });
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
});

// Scroll to top of grid
function scrollToTop(): void {
  if (gridRef.value) {
    gridRef.value.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}

// Check if donation is new
function isNewDonation(id: number): boolean {
  return newDonationIds.value.has(id);
}
</script>

<template>
  <div class="donor-plates-wrapper">
    <div ref="gridRef" class="donor-plates-grid">
      <TransitionGroup name="plate">
        <DonorPlate
          v-for="donation in donations"
          :key="donation.id"
          :donation="donation"
          :is-new="isNewDonation(donation.id)"
        />
      </TransitionGroup>

      <!-- Empty State -->
      <div v-if="donations.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
        <p class="empty-text">En attente des premiers dons...</p>
        <div class="empty-pulse"></div>
      </div>
    </div>

    <!-- Gradient overlay at bottom -->
    <div class="scroll-fade"></div>
  </div>
</template>

<style scoped>
.donor-plates-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.donor-plates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
  overflow-y: auto;
  padding: 4px;
  padding-bottom: 40px;
  max-height: 100%;
  min-height: 200px;
}

/* Custom scrollbar */
.donor-plates-grid::-webkit-scrollbar {
  width: 6px;
}

.donor-plates-grid::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 3px;
}

.donor-plates-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  transition: background 0.3s ease;
}

.donor-plates-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
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
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  text-align: center;
  position: relative;
}

.empty-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.03);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  position: relative;
}

.empty-icon svg {
  width: 36px;
  height: 36px;
  color: rgba(244, 114, 182, 0.4);
}

.empty-text {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
  margin: 0;
}

.empty-pulse {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(244, 114, 182, 0.1) 0%, transparent 70%);
  animation: empty-pulse 3s ease-in-out infinite;
}

@keyframes empty-pulse {
  0%, 100% {
    opacity: 0.3;
    transform: translate(-50%, -50%) scale(0.8);
  }
  50% {
    opacity: 0.6;
    transform: translate(-50%, -50%) scale(1.2);
  }
}

/* Scroll fade overlay */
.scroll-fade {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(to top, rgba(10, 10, 26, 0.9) 0%, transparent 100%);
  pointer-events: none;
}

/* Responsive */
@media (max-width: 600px) {
  .donor-plates-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
