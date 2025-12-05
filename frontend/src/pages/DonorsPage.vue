<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { gsap } from 'gsap';
import { useDonations } from '../composables/useDonations';
import { useSocket } from '../composables/useSocket';

const { donations, stats, config, formatAmount, fetchDonations, fetchConfig, handleDonationNew, handleDonationUpdated, handleDonationDeleted, handleConfigUpdated } = useDonations();
const { on, isConnected } = useSocket();

const gridRef = ref<HTMLDivElement | null>(null);
const newDonationIds = ref<Set<number>>(new Set());

// Trier les donations par date (plus récent en premier)
const sortedDonations = computed(() => {
  return [...donations.value].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
});

// Load initial data and setup socket listeners
onMounted(async () => {
  await Promise.all([fetchDonations(), fetchConfig()]);

  // Animation d'entrée
  animateEntrance();

  on('donation:new', (data: any) => {
    newDonationIds.value.add(data.donation.id);
    handleDonationNew(data.donation, data.stats);

    nextTick(() => {
      animateNewDonation(data.donation.id);
      scrollToTop();

      setTimeout(() => {
        newDonationIds.value.delete(data.donation.id);
      }, 3000);
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

function animateEntrance(): void {
  gsap.from('.donors-header', {
    y: -50,
    opacity: 0,
    duration: 0.8,
    ease: 'power2.out'
  });

  gsap.from('.donor-card', {
    scale: 0.8,
    opacity: 0,
    duration: 0.5,
    stagger: 0.05,
    ease: 'back.out(1.7)',
    delay: 0.3
  });

  gsap.from('.stats-footer', {
    y: 50,
    opacity: 0,
    duration: 0.8,
    ease: 'power2.out',
    delay: 0.5
  });
}

function animateNewDonation(donationId: number): void {
  const card = document.querySelector(`[data-donation-id="${donationId}"]`);
  if (!card) return;

  gsap.fromTo(card,
    {
      scale: 0,
      rotation: -15,
      opacity: 0
    },
    {
      scale: 1,
      rotation: 0,
      opacity: 1,
      duration: 0.8,
      ease: 'elastic.out(1, 0.5)'
    }
  );

  // Effet de brillance
  gsap.fromTo(card,
    { boxShadow: '0 0 0 rgba(255, 215, 0, 0)' },
    {
      boxShadow: '0 0 30px rgba(255, 215, 0, 0.8)',
      duration: 0.5,
      yoyo: true,
      repeat: 2,
      ease: 'power2.inOut'
    }
  );
}

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

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getAvatarHue(id: number): number {
  return (id * 47) % 360;
}
</script>

<template>
  <div class="donors-page">
    <!-- Fond animé -->
    <div class="bg-effects">
      <div class="bg-gradient"></div>
      <div class="bg-particles"></div>
    </div>

    <!-- Status connexion -->
    <div class="connection-status" :class="{ connected: isConnected }">
      <span class="status-dot"></span>
      {{ isConnected ? 'En direct' : 'Reconnexion...' }}
    </div>

    <!-- Header -->
    <header class="donors-header">
      <h1 class="title">Nos Généreux Donateurs</h1>
      <p class="subtitle">{{ stats.donationCount }} don{{ stats.donationCount > 1 ? 's' : '' }} reçus</p>
    </header>

    <!-- Grille des donateurs -->
    <div ref="gridRef" class="donors-grid-container">
      <div class="donors-grid">
        <div
          v-for="donation in sortedDonations"
          :key="donation.id"
          :data-donation-id="donation.id"
          class="donor-card"
          :class="{ 'is-new': isNewDonation(donation.id) }"
        >
          <div class="card-glow"></div>
          <div class="card-content">
            <div
              class="card-avatar"
              :style="{ '--hue': getAvatarHue(donation.id) }"
            >
              {{ getInitials(donation.firstName, donation.lastName) }}
            </div>
            <div class="card-info">
              <div class="card-name">{{ donation.firstName }} {{ donation.lastName }}</div>
              <div class="card-amount">{{ formatAmount(donation.amount) }}</div>
            </div>
          </div>
          <div class="card-border"></div>
        </div>

        <!-- État vide -->
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

    <!-- Footer Stats -->
    <footer class="stats-footer">
      <div class="stat-card">
        <span class="stat-value">{{ formatAmount(stats.totalAmount) }}</span>
        <span class="stat-label">Total collecté</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-card">
        <span class="stat-value">{{ formatAmount(config.goalAmount) }}</span>
        <span class="stat-label">Objectif</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-card">
        <span class="stat-value highlight">{{ stats.percentComplete.toFixed(1) }}%</span>
        <span class="stat-label">Progression</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.donors-page {
  min-height: 100vh;
  background: #0a0a1a;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Background */
.bg-effects {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bg-gradient {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(212, 175, 55, 0.1) 0%, transparent 50%),
    radial-gradient(ellipse 60% 40% at 80% 100%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
    linear-gradient(180deg, #0a0a1a 0%, #111827 50%, #0f172a 100%);
}

.bg-particles {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(2px 2px at 20px 30px, rgba(212, 175, 55, 0.3), transparent),
    radial-gradient(2px 2px at 40px 70px, rgba(212, 175, 55, 0.2), transparent),
    radial-gradient(1px 1px at 90px 40px, rgba(255, 255, 255, 0.3), transparent);
  background-repeat: repeat;
  background-size: 200px 100px;
  animation: twinkle 4s ease-in-out infinite;
}

@keyframes twinkle {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
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

/* Header */
.donors-header {
  position: relative;
  z-index: 10;
  text-align: center;
  padding: 40px 20px 30px;
}

.title {
  font-size: 42px;
  font-weight: 700;
  color: #D4AF37;
  margin: 0;
  text-shadow: 0 0 30px rgba(212, 175, 55, 0.4);
}

.subtitle {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.6);
  margin: 10px 0 0;
  font-weight: 400;
}

/* Grid Container */
.donors-grid-container {
  flex: 1;
  overflow-y: auto;
  padding: 0 40px 20px;
  position: relative;
  z-index: 10;
}

.donors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  max-width: 1600px;
  margin: 0 auto;
}

/* Donor Card */
.donor-card {
  position: relative;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 20px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.donor-card:hover {
  transform: translateY(-4px);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%);
}

.card-border {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  padding: 1px;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.3) 0%, transparent 50%, rgba(212, 175, 55, 0.1) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

.card-glow {
  position: absolute;
  inset: -50%;
  background: radial-gradient(circle at center, rgba(212, 175, 55, 0.15) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.donor-card:hover .card-glow {
  opacity: 1;
}

.donor-card.is-new .card-glow {
  opacity: 1;
  animation: glow-pulse 1s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.card-content {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 16px;
}

.card-avatar {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, hsl(var(--hue, 45), 70%, 50%) 0%, hsl(calc(var(--hue, 45) + 30), 70%, 40%) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 4px 15px hsla(var(--hue, 45), 70%, 50%, 0.3);
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-name {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 6px;
}

.card-amount {
  font-size: 20px;
  font-weight: 700;
  color: #D4AF37;
  text-shadow: 0 0 10px rgba(212, 175, 55, 0.4);
}

/* Empty State */
.empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 40px;
  text-align: center;
}

.empty-icon {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: rgba(212, 175, 55, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.empty-icon svg {
  width: 48px;
  height: 48px;
  color: rgba(212, 175, 55, 0.5);
}

.empty-text {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
}

/* Footer Stats */
.stats-footer {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40px;
  padding: 30px 40px;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.stat-value.highlight {
  color: #D4AF37;
  text-shadow: 0 0 20px rgba(212, 175, 55, 0.5);
}

.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: rgba(255, 255, 255, 0.1);
}

/* Responsive */
@media (max-width: 768px) {
  .donors-header {
    padding: 30px 20px 20px;
  }

  .title {
    font-size: 28px;
  }

  .donors-grid-container {
    padding: 0 20px 20px;
  }

  .donors-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .stats-footer {
    gap: 20px;
    padding: 20px;
    flex-wrap: wrap;
  }

  .stat-value {
    font-size: 22px;
  }

  .stat-divider {
    display: none;
  }
}

/* Scrollbar */
.donors-grid-container::-webkit-scrollbar {
  width: 6px;
}

.donors-grid-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
}

.donors-grid-container::-webkit-scrollbar-thumb {
  background: rgba(212, 175, 55, 0.3);
  border-radius: 3px;
}

.donors-grid-container::-webkit-scrollbar-thumb:hover {
  background: rgba(212, 175, 55, 0.5);
}
</style>
