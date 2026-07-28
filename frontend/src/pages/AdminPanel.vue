<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useSocket } from '../composables/useSocket';
import { useEventContext, currentEventScope } from '../composables/useEventContext';
import {
  useDonations,
  type Donation,
  DEFAULT_ADMIN_BRANDING
} from '../composables/useDonations';
import DonationForm from '../components/admin/DonationForm.vue';
import DonationList from '../components/admin/DonationList.vue';
import ConfigPanel from '../components/admin/ConfigPanel.vue';
import DisplaySettingsPanel from '../components/admin/DisplaySettingsPanel.vue';
import UiToast from '../components/ui/UiToast.vue';
import { useAdminI18n, type AdminLocale } from '../composables/useAdminI18n';
import { useAdminTheme } from '../composables/useAdminTheme';

const { locale, direction, setLocale, t } = useAdminI18n();
const { theme: adminTheme, init: initAdminTheme, toggle: toggleAdminTheme } = useAdminTheme();
const availableLocales: AdminLocale[] = ['fr', 'en', 'he'];

// Selecteur de langue compact : les 3 langues etaient affichees en permanence
// dans l'en-tete, ce qui encombrait sans servir (on change de langue rarement).
const langMenuOpen = ref(false);
const langMenuRef = ref<HTMLElement | null>(null);

function selectLanguage(next: AdminLocale): void {
  setLocale(next);
  langMenuOpen.value = false;
}

function closeLangMenuOnOutsideClick(event: MouseEvent): void {
  if (!langMenuOpen.value) return;
  if (langMenuRef.value && !langMenuRef.value.contains(event.target as Node)) {
    langMenuOpen.value = false;
  }
}

function closeLangMenuOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') langMenuOpen.value = false;
}

onMounted(() => {
  initAdminTheme();
  document.addEventListener('click', closeLangMenuOnOutsideClick);
  document.addEventListener('keydown', closeLangMenuOnEscape);
});

onUnmounted(() => {
  document.removeEventListener('click', closeLangMenuOnOutsideClick);
  document.removeEventListener('keydown', closeLangMenuOnEscape);
});

const { on, join } = useSocket();
// Slug de la soiree en portee (pose par AdminEntry via useEventContext) : sert
// a pointer « Voir l'ecran » vers l'ecran de CETTE soiree. Vide en herite.
const { slug } = useEventContext();
const displayHref = computed(() => (slug.value ? `/e/${slug.value}/display` : '/display'));
const {
  stats,
  config,
  premiumWords,
  fetchDonations,
  fetchConfig,
  fetchPremiumWords,
  formatAmount,
  handleDonationDeleted,
  handleConfigUpdated
} = useDonations();

// Get premium words status grouped by tier
const premiumWordsStatus = computed(() => {
  const tiers = [
    { level: 1, amount: 2600000, label: '26,000 ₪' },
    { level: 2, amount: 3600000, label: '36,000 ₪' },
    { level: 3, amount: 7200000, label: '72,000 ₪' }
  ];

  return tiers.map(tier => {
    const wordsForTier = premiumWords.value.filter(w => w.level === tier.level);
    const litCount = wordsForTier.filter(w => !w.available).length;

    return {
      ...tier,
      wordCount: wordsForTier.length,
      litCount,
      words: wordsForTier.map(word => ({
        label: word.label,
        isLit: !word.available,
        donorName: word.donorName || null
      }))
    };
  });
});

const editingDonation = ref<Donation | null>(null);

// Onglets par PAGE CIBLE : chaque onglet nomme ce qu'il configure (l'ecran de
// la salle, la page /don, les medias partages, la soiree). L'ancienne partition
// technique (Personnalisation / Images / Campagne) obligeait a savoir OU
// vivait chaque reglage. L'onglet actif est memorise.
type AdminTab = 'donations' | 'screen' | 'pledge' | 'media' | 'event';
const ADMIN_TAB_KEY = 'menorah_admin_main_tab';
const ADMIN_TABS: AdminTab[] = ['donations', 'screen', 'pledge', 'media', 'event'];

function readStoredAdminTab(): AdminTab {
  const stored = localStorage.getItem(ADMIN_TAB_KEY) as AdminTab | null;
  return stored !== null && ADMIN_TABS.includes(stored) ? stored : 'donations';
}

const activeTab = ref<AdminTab>(readStoredAdminTab());

function selectTab(next: AdminTab): void {
  activeTab.value = next;
  localStorage.setItem(ADMIN_TAB_KEY, next);
}

// Les trois onglets ecran / page de don / medias partagent UNE instance de
// DisplaySettingsPanel (v-show, jamais v-if) : un seul etat local, une seule
// barre d'enregistrement, pas de fragments concurrents sur displaySettings.
const settingsView = computed<'screen' | 'pledge' | 'media'>(() =>
  activeTab.value === 'pledge' ? 'pledge' : activeTab.value === 'media' ? 'media' : 'screen'
);
const showSettingsPanel = computed(() =>
  activeTab.value === 'screen' || activeTab.value === 'pledge' || activeTab.value === 'media'
);
const showPremiumOverview = ref(false);
const usesMenorahVisual = computed(() => config.value.displaySettings.visualMode === 'menorah');
const activeAdminBranding = computed(() => ({
  ...DEFAULT_ADMIN_BRANDING[locale.value],
  ...(config.value.displaySettings.adminBranding?.[locale.value] ?? {})
}));

// Load initial data
onMounted(async () => {
  // Rejoint la room temps reel de la soiree en portee. En herite (portee
  // nulle), l'auto-abonnement backend a la soiree active suffit.
  join(currentEventScope());

  await Promise.all([fetchDonations({ full: true }), fetchConfig(), fetchPremiumWords()]);

  // Listen for real-time events.
  //
  // La room diffuse desormais la projection PUBLIQUE (sans email, telephone ni
  // reference) : le payload socket ne suffit plus a l'administration. On
  // recharge donc la liste complete par la route authentifiee ?full=1 — le
  // handler faisait deja un aller-retour juste apres (fetchPremiumWords), la
  // seule difference visible est que les coordonnees d'un don tout juste arrive
  // apparaissent au rechargement plutot qu'a l'instant meme.
  on('donation:new', async (_data: any) => {
    await fetchDonations({ full: true });
    await fetchPremiumWords(); // Refresh premium words availability
  });

  on('donation:updated', async (_data: any) => {
    await fetchDonations({ full: true });
    await fetchPremiumWords(); // Refresh premium words availability
  });

  on('donation:deleted', async (data: any) => {
    handleDonationDeleted(data.donationId, data.stats);
    await fetchPremiumWords(); // Refresh premium words availability
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
  <div class="admin-panel" :dir="direction" :lang="locale">
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
            <h1 v-if="activeAdminBranding.title" dir="auto">{{ activeAdminBranding.title }}</h1>
            <p v-if="activeAdminBranding.subtitle" class="subtitle" dir="auto">{{ activeAdminBranding.subtitle }}</p>
          </div>
        </div>

        <div class="header-actions">
          <button
            type="button"
            class="language-trigger theme-toggle"
            :aria-label="adminTheme === 'light' ? t('uiTheme.toDark') : t('uiTheme.toLight')"
            :aria-pressed="adminTheme === 'light'"
            @click="toggleAdminTheme"
          >
            <svg v-if="adminTheme === 'light'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
          </button>
          <div class="language-menu" ref="langMenuRef">
            <button
              type="button"
              class="language-trigger"
              :aria-label="t('language.label')"
              :aria-expanded="langMenuOpen"
              aria-haspopup="listbox"
              @click="langMenuOpen = !langMenuOpen"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M2 12h20"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span class="language-current">{{ t(`language.short.${locale}`) }}</span>
            </button>

            <div v-if="langMenuOpen" class="language-dropdown" role="listbox">
              <button
                v-for="language in availableLocales"
                :key="language"
                type="button"
                role="option"
                class="language-option"
                :class="{ active: locale === language }"
                :aria-selected="locale === language"
                @click="selectLanguage(language)"
              >
                <span>{{ t(`language.${language}`) }}</span>
                <svg v-if="locale === language" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </button>
            </div>
          </div>

          <a :href="displayHref" target="_blank" class="display-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
            {{ t('admin.openDisplay') }}
          </a>
        </div>
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
            <span class="stat-label">{{ t('admin.totalCollected') }}</span>
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
            <span class="stat-label">{{ t('admin.donationCount') }}</span>
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
            <span class="stat-label">{{ t('admin.progress') }}</span>
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
      <div v-if="usesMenorahVisual" class="premium-words-section">
        <button
          type="button"
          class="premium-overview-toggle"
          :aria-expanded="showPremiumOverview"
          @click="showPremiumOverview = !showPremiumOverview"
        >
          <span class="premium-toggle-title">
            <span class="premium-toggle-icon">&#10017;</span>
            {{ t('admin.sacredWords') }}
          </span>
          <span class="premium-toggle-summary">
            <span v-for="tier in premiumWordsStatus" :key="tier.level" class="premium-summary-chip">
              {{ t('admin.levelShort', { level: tier.level }) }} : {{ tier.litCount }}/{{ tier.wordCount }}
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ open: showPremiumOverview }">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </span>
        </button>
        <div v-if="showPremiumOverview" class="premium-tiers">
          <div v-for="tier in premiumWordsStatus" :key="tier.level" class="premium-tier-card">
            <div class="tier-header">
              <span class="tier-level">{{ t('admin.level', { level: tier.level }) }}</span>
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
                  <span v-if="word.donorName" class="word-donor">
                    {{ word.donorName }}
                  </span>
                  <span v-else class="word-available">{{ t('common.available') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Navigation Tabs — un onglet par page cible. -->
    <nav class="tabs-container">
      <div class="tabs">
        <button
          :class="['tab', { active: activeTab === 'donations' }]"
          @click="selectTab('donations')"
        >
          <!-- Main qui offre un coeur : signifie "don" sans supposer de devise.
               L'ancienne icone etait un glyphe dollar, alors que la campagne
               est en shekels. -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"/>
            <path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/>
            <path d="m2 15 6 6"/>
            <path d="M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 4a2.78 2.78 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12Z"/>
          </svg>
          {{ t('admin.tabs.donations') }}
        </button>
        <button
          :class="['tab', { active: activeTab === 'screen' }]"
          @click="selectTab('screen')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4"/>
          </svg>
          {{ t('admin.tabs.screen') }}
        </button>
        <button
          :class="['tab', { active: activeTab === 'pledge' }]"
          @click="selectTab('pledge')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="5" y="2" width="14" height="20" rx="2"/>
            <path d="M12 18h.01"/>
          </svg>
          {{ t('admin.tabs.pledge') }}
        </button>
        <button
          :class="['tab', { active: activeTab === 'media' }]"
          @click="selectTab('media')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="m21 15-5-5L5 21"/>
          </svg>
          {{ t('admin.tabs.media') }}
        </button>
        <button
          :class="['tab', { active: activeTab === 'event' }]"
          @click="selectTab('event')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          {{ t('admin.tabs.event') }}
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

      <!-- v-show, PAS v-if : l'instance (et sa saisie en cours) survit au
           passage d'un onglet a l'autre, et la barre « modifications non
           enregistrees » reste visible sur les trois vues. -->
      <div v-show="showSettingsPanel" class="display-layout animate-fade-in">
        <DisplaySettingsPanel :view="settingsView" />
      </div>

      <div v-if="activeTab === 'event'" class="config-layout animate-fade-in">
        <ConfigPanel />
      </div>
    </main>

    <!-- Retours utilisateur : monte une seule fois, s'affiche par Teleport. -->
    <UiToast />
  </div>
</template>

<style scoped>
.admin-panel {
  min-height: 100vh;
  background: var(--shell-page);
}

/* Header */
.header {
  /* Banniere de marque : un cran au-dessus de la page (carte -> page), qui
     ADAPTE au mode. L'ancien depart navy fige (#182042) restait sombre en
     clair et cassait le degrade (navy -> creme). --shell-card en depart reste
     visuellement identique en sombre (#1C2347 ~ #182042) et devient une
     banniere creme legere en clair. */
  background: linear-gradient(135deg, var(--shell-card) 0%, var(--shell-page) 100%);
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
  background: var(--shell-page);
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
  /* Verre blanc -> surface tokenisee : sur banniere creme (mode clair) un
     blanc translucide etait invisible. */
  background: var(--shell-raised);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo svg {
  width: 28px;
  height: 28px;
  /* --gold-400 (#ffcc1a, fige) illisible sur surface claire ; l'accent adapte
     (or en sombre, bronze en clair). */
  color: var(--shell-accent);
}

h1 {
  font-size: 24px;
  color: var(--shell-text-strong);
  margin: 0;
}

.subtitle {
  font-size: 14px;
  color: var(--shell-text-muted);
  margin: 4px 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Selecteur de langue compact.
   Auparavant les 3 langues occupaient l'en-tete en permanence ; on change de
   langue rarement, donc une seule pastille suffit et le reste se deroule. */
.language-menu {
  position: relative;
}

.language-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 8px 12px;
  /* Puce d'en-tete : verres blancs -> surface + bordure tokenisees, sinon
     invisibles sur banniere creme en mode clair. */
  border: 1px solid var(--shell-border-strong);
  border-radius: var(--radius);
  background: var(--shell-raised);
  color: var(--shell-text);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition);
}

.language-trigger:hover,
.language-trigger[aria-expanded='true'] {
  /* Voile or au lieu d'un blanc plus opaque : adapte aux deux modes. */
  background: color-mix(in srgb, var(--shell-accent) 14%, var(--shell-raised));
  color: var(--shell-text-strong);
}

.language-trigger svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.language-current {
  line-height: 1;
}

.language-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  inset-inline-end: 0;
  z-index: 40;
  min-width: 168px;
  padding: 6px;
  border: 1px solid var(--shell-border);
  border-radius: var(--radius-md);
  background: var(--shell-card);
  box-shadow: var(--shadow-xl);
  animation: fadeInScale 120ms ease-out;
}

.language-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--shell-text);
  font: inherit;
  font-size: 14px;
  text-align: start;
  cursor: pointer;
  transition: var(--transition-fast);
}

.language-option:hover {
  background: var(--shell-raised);
  color: var(--shell-text-strong);
}

.language-option.active {
  color: var(--shell-accent);
  font-weight: 600;
}

.language-option svg {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .language-dropdown {
    animation: none;
  }
}

.display-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  /* Verres blancs -> surface + bordure tokenisees (cf. .language-trigger). */
  background: var(--shell-raised);
  border-radius: var(--radius);
  color: var(--shell-text-strong);
  text-decoration: none;
  font-weight: 500;
  font-size: 14px;
  transition: var(--transition);
  border: 1px solid var(--shell-border-strong);
}

.display-link:hover {
  background: color-mix(in srgb, var(--shell-accent) 14%, var(--shell-raised));
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
  background: var(--shell-card);
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
  inset-inline-start: 0;
  width: 4px;
  height: 100%;
}

.stat-total::before { background: var(--shell-accent-flat-strong); }
.stat-count::before { background: var(--shell-accent-flat); }
.stat-progress::before { background: var(--shell-accent-flat-deep); }

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
  /* Les deux autres pastilles utilisent deja un voile or translucide (qui
     compose sur la carte adaptative) ; celle-ci restait sur --gold-100/-600
     figes (jaune pale opaque + moutarde), non adaptatifs. Voile un cran plus
     appuye que les soeurs pour garder la stat « total » en tete. */
  background: rgba(228, 190, 99, 0.20);
  color: var(--shell-accent-strong);
}

.stat-count .stat-icon {
  background: rgba(228, 190, 99, 0.14);
  color: var(--shell-accent);
}

.stat-progress .stat-icon {
  background: rgba(200, 146, 42, 0.18);
  color: var(--shell-accent-strong);
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
  color: var(--shell-text-muted);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--shell-text-strong);
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
  stroke: var(--shell-border-strong);
  stroke-width: 3;
}

.progress-fill {
  fill: none;
  stroke: var(--shell-accent);
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dasharray 0.5s ease;
}

/* Premium Words Section */
.premium-words-section {
  max-width: 1400px;
  margin: 18px auto 0;
  position: relative;
  z-index: 10;
}

.premium-overview-toggle {
  width: 100%;
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 18px;
  /* Verre blanc -> carte tokenisee : invisible sur banniere creme en clair. */
  border: 1px solid var(--shell-border);
  border-radius: var(--radius-md);
  background: var(--shell-card);
  color: var(--shell-text-strong);
  cursor: pointer;
  transition: var(--transition);
}

.premium-overview-toggle:hover {
  background: var(--shell-raised);
}

.premium-toggle-title,
.premium-toggle-summary {
  display: flex;
  align-items: center;
  gap: 10px;
}

.premium-toggle-title {
  color: var(--shell-accent);
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

.premium-toggle-icon {
  font-size: 20px;
}

.premium-summary-chip {
  padding: 4px 9px;
  border-radius: var(--radius-full);
  /* Puce d'info neutre. --shell-on-accent (navy) etait un texte SOMBRE pose sur
     verre blanc ; sur --shell-raised sombre il aurait disparu. Surface + texte
     tokenises, tous deux adaptatifs. */
  background: var(--shell-raised);
  color: var(--shell-text);
  font-size: 12px;
  font-weight: 600;
}

.premium-toggle-summary svg {
  width: 20px;
  height: 20px;
  transition: transform var(--transition);
}

.premium-toggle-summary svg.open {
  transform: rotate(180deg);
}

.premium-tiers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 14px;
}

.premium-tier-card {
  background: var(--shell-card);
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
  /* Filet or de la section prestige. --gold-200 (jaune pale fige) -> voile
     d'accent translucide qui garde la touche doree ET adapte (or/bronze). */
  border-bottom: 2px solid color-mix(in srgb, var(--shell-accent) 35%, transparent);
}

.tier-level {
  font-size: 12px;
  font-weight: 600;
  color: var(--shell-text);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.tier-amount {
  font-size: 16px;
  font-weight: 700;
  color: var(--shell-accent);
}

.tier-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--shell-text-muted);
  background: var(--shell-raised);
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
  background: var(--shell-page);
  border-radius: var(--radius);
  transition: all 0.2s ease;
}

.word-item.lit {
  /* Mot sacre « allume » : le degrade or reste translucide (il compose sur la
     carte adaptative, donc valide dans les deux modes). Seule la bordure etait
     figee (--gold-300, jaune vif) : passee a l'or profond adaptatif. */
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(255, 215, 0, 0.1) 100%);
  border: 1px solid var(--shell-accent-deep);
}

.word-icon {
  font-size: 18px;
  color: var(--shell-text-muted);
  transition: all 0.2s ease;
}

.word-item.lit .word-icon {
  color: var(--shell-accent);
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
  color: var(--shell-text);
}

.word-donor {
  font-size: 11px;
  color: var(--shell-accent);
  font-weight: 500;
}

.word-available {
  font-size: 11px;
  color: var(--shell-text-muted);
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
  display: flex;
  width: max-content;
  max-width: 100%;
  background: var(--shell-card);
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
  color: var(--shell-text);
  transition: var(--transition);
}

.tab svg {
  width: 18px;
  height: 18px;
}

.tab:hover {
  color: var(--shell-text-strong);
  background: var(--shell-raised);
}

.tab.active {
  background: var(--shell-accent-flat);
  color: var(--shell-on-accent);
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

.display-layout {
  max-width: 980px;
  margin: 0 auto;
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

  .header-actions {
    flex-wrap: wrap;
    justify-content: center;
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

  .premium-overview-toggle {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .premium-toggle-summary {
    width: 100%;
    flex-wrap: wrap;
  }

  .premium-toggle-summary svg {
    margin-inline-start: auto;
  }
}

@media (max-width: 600px) {
  .header {
    padding-inline: 16px;
  }

  .header-actions {
    width: 100%;
  }

  /* Sur mobile le declencheur reste compact et le lien ecran prend la place. */
  .language-trigger {
    justify-content: center;
  }

  .display-link {
    flex: 1;
    justify-content: center;
  }

  .stats-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    padding: 0;
  }

  .stat-card {
    min-width: 0;
    padding: 12px 8px;
    gap: 0;
  }

  .stat-icon,
  .progress-ring {
    display: none;
  }

  .stat-progress {
    grid-column: auto;
    max-width: none;
    margin: 0;
  }

  .stat-label {
    font-size: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .stat-value {
    font-size: 17px;
  }

  .tabs-container {
    padding: 0 16px;
  }

  .tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
  }

  .tab {
    justify-content: center;
    min-width: 0;
    padding: 10px 8px;
    font-size: 12px;
  }

  .tab svg {
    width: 16px;
    height: 16px;
  }

  .main-content {
    padding: 16px;
  }
}
</style>
