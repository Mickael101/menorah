<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useSocket } from '../composables/useSocket';
import { useDonations, type Donation } from '../composables/useDonations';
import DonationForm from '../components/admin/DonationForm.vue';
import DonationList from '../components/admin/DonationList.vue';
import ConfigPanel from '../components/admin/ConfigPanel.vue';

const { on } = useSocket();
const {
  donations,
  stats,
  fetchDonations,
  fetchConfig,
  formatAmount,
  handleDonationNew,
  handleDonationUpdated,
  handleDonationDeleted,
  handleConfigUpdated
} = useDonations();

// Premium words configuration (amounts in agorot)
const PREMIUM_TIERS = [
  { level: 1, amount: 2600000, label: '26,000 ₪', wordCount: 7, words: ['Mot 1', 'Mot 2', 'Mot 3', 'Mot 4', 'Mot 5', 'Mot 6', 'Mot 7'] },
  { level: 2, amount: 3600000, label: '36,000 ₪', wordCount: 3, words: ['Mot 1', 'Mot 2', 'Mot 3'] },
  { level: 3, amount: 7200000, label: '72,000 ₪', wordCount: 1, words: ['Mot 1'] }
];

// Get lit status for each premium tier
const premiumWordsStatus = computed(() => {
  return PREMIUM_TIERS.map(tier => {
    const matchingDonations = donations.value.filter(d => d.amount === tier.amount);
    const litCount = matchingDonations.length;
    return {
      ...tier,
      litCount,
      words: tier.words.map((word, index) => ({
        label: word,
        isLit: index < litCount,
        donor: matchingDonations[index] || null
      }))
    };
  });
});

const editingDonation = ref<Donation | null>(null);
const activeTab = ref<'donations' | 'config'>('donations');

// Load initial data
onMounted(async () => {
  await Promise.all([fetchDonations(), fetchConfig()]);

  // Listen for real-time events
  on('donation:new', (data: any) => {
    handleDonationNew(data.donation, data.stats);
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

function handleEdit(donation: Donation): void {
  editingDonation.value = donation;
}

function handleSaved(): void {
  editingDonation.value = null;
}

function handleCancel(): void {
  editingDonation.value = null;
}
</script>

<template>
  <div class="admin-panel">
    <!-- Header with gradient -->
    <header class="header">
      <div class="header-content">
        <div class="header-title">
          <div class="logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <h1>Ohel Yeochoua</h1>
            <p class="subtitle">Panel d'administration des dons</p>
          </div>
        </div>

        <a href="/display" target="_blank" class="display-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4"/>
          </svg>
          Affichage
        </a>
      </div>

      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card stat-total">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Total collecté</span>
            <span class="stat-value">{{ formatAmount(stats.totalAmount) }}</span>
          </div>
        </div>

        <div class="stat-card stat-count">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Nombre de dons</span>
            <span class="stat-value">{{ stats.donationCount }}</span>
          </div>
        </div>

        <div class="stat-card stat-progress">
          <div class="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-label">Progression</span>
            <span class="stat-value">{{ stats.percentComplete.toFixed(1) }}%</span>
          </div>
          <div class="progress-ring">
            <svg viewBox="0 0 36 36">
              <path
                class="progress-bg"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                class="progress-fill"
                :stroke-dasharray="`${Math.min(stats.percentComplete, 100)}, 100`"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>
      </div>

      <!-- Premium Words Section -->
      <div class="premium-words-section">
        <h3 class="premium-title">Mots Sacrés de la Menorah</h3>
        <div class="premium-tiers">
          <div v-for="tier in premiumWordsStatus" :key="tier.level" class="premium-tier-card">
            <div class="tier-header">
              <span class="tier-level">Niveau {{ tier.level }}</span>
              <span class="tier-amount">{{ tier.label }}</span>
              <span class="tier-count">{{ tier.litCount }}/{{ tier.wordCount }}</span>
            </div>
            <div class="tier-words">
              <div
                v-for="(word, idx) in tier.words"
                :key="idx"
                class="word-item"
                :class="{ lit: word.isLit }"
              >
                <span class="word-icon">&#10017;</span>
                <div class="word-info">
                  <span class="word-label">{{ word.label }}</span>
                  <span v-if="word.donor" class="word-donor">
                    {{ word.donor.firstName }} {{ word.donor.lastName }}
                  </span>
                  <span v-else class="word-available">Disponible</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Navigation Tabs -->
    <nav class="tabs-container">
      <div class="tabs">
        <button
          :class="['tab', { active: activeTab === 'donations' }]"
          @click="activeTab = 'donations'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          Gestion des dons
        </button>
        <button
          :class="['tab', { active: activeTab === 'config' }]"
          @click="activeTab = 'config'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Configuration
        </button>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="main-content">
      <div v-if="activeTab === 'donations'" class="donations-layout animate-fade-in">
        <aside class="form-section">
          <DonationForm
            :donation="editingDonation"
            @saved="handleSaved"
            @cancel="handleCancel"
          />
        </aside>

        <section class="list-section">
          <DonationList @edit="handleEdit" />
        </section>
      </div>

      <div v-else class="config-layout animate-fade-in">
        <ConfigPanel />
      </div>
    </main>
  </div>
</template>

<style scoped>
.admin-panel {
  min-height: 100vh;
  background: var(--gray-50);
}

/* Header */
.header {
  background: linear-gradient(135deg, var(--primary-600) 0%, var(--primary-800) 100%);
  padding: 24px 32px 80px;
  position: relative;
}

.header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: var(--gray-50);
  border-radius: 30px 30px 0 0;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1400px;
  margin: 0 auto;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.logo svg {
  width: 28px;
  height: 28px;
  color: var(--gold-400);
}

h1 {
  font-size: 24px;
  color: white;
  margin: 0;
}

.subtitle {
  font-size: 14px;
  color: var(--primary-200);
  margin: 4px 0 0;
}

.display-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius);
  color: white;
  text-decoration: none;
  font-weight: 500;
  font-size: 14px;
  transition: var(--transition);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.display-link:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.display-link svg {
  width: 18px;
  height: 18px;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  max-width: 1400px;
  margin: 24px auto 0;
  position: relative;
  z-index: 10;
}

.stat-card {
  background: white;
  border-radius: var(--radius-lg);
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--shadow-lg);
  position: relative;
  overflow: hidden;
  transition: var(--transition);
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
}

.stat-total::before { background: var(--gold-500); }
.stat-count::before { background: var(--primary-500); }
.stat-progress::before { background: var(--accent-500); }

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-total .stat-icon {
  background: var(--gold-100);
  color: var(--gold-600);
}

.stat-count .stat-icon {
  background: var(--primary-100);
  color: var(--primary-600);
}

.stat-progress .stat-icon {
  background: var(--accent-100);
  color: var(--accent-600);
}

.stat-icon svg {
  width: 24px;
  height: 24px;
}

.stat-content {
  flex: 1;
}

.stat-label {
  display: block;
  font-size: 13px;
  color: var(--gray-500);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--gray-900);
}

/* Progress Ring */
.progress-ring {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
}

.progress-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-bg {
  fill: none;
  stroke: var(--gray-200);
  stroke-width: 3;
}

.progress-fill {
  fill: none;
  stroke: var(--accent-500);
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dasharray 0.5s ease;
}

/* Premium Words Section */
.premium-words-section {
  max-width: 1400px;
  margin: 24px auto 0;
  position: relative;
  z-index: 10;
}

.premium-title {
  color: var(--gold-400);
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.premium-tiers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.premium-tier-card {
  background: white;
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-md);
}

.tier-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--gold-200);
}

.tier-level {
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-600);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.tier-amount {
  font-size: 16px;
  font-weight: 700;
  color: var(--gold-600);
}

.tier-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-500);
  background: var(--gray-100);
  padding: 4px 8px;
  border-radius: 12px;
}

.tier-words {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.word-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--gray-50);
  border-radius: var(--radius);
  transition: all 0.2s ease;
}

.word-item.lit {
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(255, 215, 0, 0.1) 100%);
  border: 1px solid var(--gold-300);
}

.word-icon {
  font-size: 18px;
  color: var(--gray-400);
  transition: all 0.2s ease;
}

.word-item.lit .word-icon {
  color: var(--gold-500);
  text-shadow: 0 0 8px rgba(212, 175, 55, 0.5);
}

.word-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.word-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--gray-700);
}

.word-donor {
  font-size: 11px;
  color: var(--gold-600);
  font-weight: 500;
}

.word-available {
  font-size: 11px;
  color: var(--gray-400);
  font-style: italic;
}

@media (max-width: 1200px) {
  .premium-tiers {
    grid-template-columns: 1fr;
  }
}

/* Tabs */
.tabs-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 32px;
}

.tabs {
  display: inline-flex;
  background: white;
  border-radius: var(--radius-md);
  padding: 6px;
  box-shadow: var(--shadow);
  gap: 4px;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  background: transparent;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--gray-600);
  transition: var(--transition);
}

.tab svg {
  width: 18px;
  height: 18px;
}

.tab:hover {
  color: var(--gray-900);
  background: var(--gray-100);
}

.tab.active {
  background: var(--primary-500);
  color: white;
  box-shadow: var(--shadow-md);
}

/* Main Content */
.main-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 32px 48px;
}

.donations-layout {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 24px;
  align-items: start;
}

.config-layout {
  max-width: 700px;
}

/* Responsive */
@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .stat-progress {
    grid-column: span 2;
    max-width: 50%;
    margin: 0 auto;
  }
}

@media (max-width: 900px) {
  .header {
    padding: 20px 20px 70px;
  }

  .header-content {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  .header-title {
    flex-direction: column;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    padding: 0 20px;
  }

  .stat-progress {
    grid-column: span 1;
    max-width: 100%;
  }

  .tabs-container {
    padding: 0 20px;
  }

  .main-content {
    padding: 20px;
  }

  .donations-layout {
    grid-template-columns: 1fr;
  }
}
</style>
