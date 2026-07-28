<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDonations, type Donation } from '../../composables/useDonations';
import { useAdminI18n } from '../../composables/useAdminI18n';
import { adminFetch } from '../../composables/useAdminAuth';

const { locale, t } = useAdminI18n();

const emit = defineEmits<{
  (e: 'edit', donation: Donation): void;
}>();

const { donations, deleteDonation, formatAmount, isLoading } = useDonations();
// Repli de la liste : sur une soiree chargee elle devient tres longue et
// repousse le formulaire de saisie hors de l'ecran. L'etat est memorise.
const COLLAPSE_KEY = 'menorah_admin_donations_collapsed';
const isCollapsed = ref(localStorage.getItem(COLLAPSE_KEY) === '1');

function toggleCollapsed(): void {
  isCollapsed.value = !isCollapsed.value;
  localStorage.setItem(COLLAPSE_KEY, isCollapsed.value ? '1' : '0');
}

// Recherche locale : la liste admin est deja chargee en entier, on filtre sur
// place. Insensible a la casse et aux accents (« remi » trouve « Rémi »).
const searchQuery = ref('');

function normalizeForSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const filteredDonations = computed(() => {
  const query = normalizeForSearch(searchQuery.value.trim());
  if (!query) return donations.value;
  return donations.value.filter((donation) => {
    // Montant cherchable en shekels, entier (« 180 ») comme decimal (« 180.50 »).
    const shekels = donation.amount / 100;
    const haystack = normalizeForSearch(
      `${donation.firstName} ${donation.lastName} ${donation.reference ?? ''} ${shekels.toFixed(0)} ${shekels.toFixed(2)}`
    );
    return haystack.includes(query);
  });
});

const isExporting = ref(false);

// L'export exige le token admin. adminFetch l'injecte et redemande le code
// sur 401, ce qu'un simple <a href> ne permet pas.
async function handleExport(): Promise<void> {
  isExporting.value = true;
  try {
    const response = await adminFetch(`/api/donations/export.csv?lang=${locale.value}`);
    if (!response.ok) throw new Error(`Export failed: ${response.status}`);

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `donations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('CSV export failed:', e);
  } finally {
    isExporting.value = false;
  }
}

async function handleDelete(donation: Donation): Promise<void> {
  if (confirm(t('donation.deleteConfirm', { name: `${donation.firstName} ${donation.lastName}` }))) {
    await deleteDonation(donation.id);
  }
}

function handleEdit(donation: Donation): void {
  emit('edit', donation);
}

function formatDate(dateStr: string): string {
  const dateLocale = locale.value === 'he' ? 'he-IL' : locale.value === 'en' ? 'en-US' : 'fr-FR';
  return new Date(dateStr).toLocaleDateString(dateLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
</script>

<template>
  <div class="donation-list">
    <!-- Header -->
    <div class="list-header">
      <button
        type="button"
        class="header-info"
        :aria-expanded="!isCollapsed"
        aria-controls="donations-body"
        :title="isCollapsed ? t('donation.expandList') : t('donation.collapseList')"
        @click="toggleCollapsed"
      >
        <svg class="collapse-chevron" :class="{ collapsed: isCollapsed }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="m6 9 6 6 6-6"/>
        </svg>
        <h3>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          {{ t('donation.listTitle') }}
        </h3>
        <span class="count-badge">{{ donations.length }}</span>
      </button>
      <button type="button" class="export-btn" :disabled="isExporting" @click="handleExport">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3v12"/>
          <path d="m7 10 5 5 5-5"/>
          <path d="M5 21h14"/>
        </svg>
        {{ t('donation.exportCsv') }}
      </button>
    </div>

    <!-- Recherche : filtre local sur nom, référence et montant. -->
    <div v-if="donations.length > 0 && !isCollapsed" class="search-row">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.3-4.3"/>
      </svg>
      <input
        v-model="searchQuery"
        type="search"
        class="search-input"
        dir="auto"
        :placeholder="t('donation.searchPlaceholder')"
        :aria-label="t('donation.searchPlaceholder')"
      />
      <span v-if="searchQuery" class="search-count">
        {{ filteredDonations.length }}/{{ donations.length }}
      </span>
      <button
        v-if="searchQuery"
        type="button"
        class="clear-search-btn"
        :aria-label="t('common.clear')"
        @click="searchQuery = ''"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="donations.length === 0 && !isCollapsed" class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
        </svg>
      </div>
      <h4>{{ t('donation.emptyTitle') }}</h4>
      <p>{{ t('donation.emptyDescription') }}</p>
    </div>

    <!-- Donations List -->
    <div v-else-if="donations.length > 0 && !isCollapsed" id="donations-body" class="donations-container">
      <p v-if="filteredDonations.length === 0" class="search-no-results">
        {{ t('donation.searchNoResults', { query: searchQuery }) }}
      </p>
      <div
        v-for="donation in filteredDonations"
        :key="donation.id"
        class="donation-card"
      >
        <div class="card-main">
          <div class="donor-avatar" :style="{ '--hue': (donation.id * 37) % 360 }">
            {{ getInitials(donation.firstName, donation.lastName) }}
          </div>

          <div class="donor-info">
            <div class="donor-name">{{ donation.firstName }} {{ donation.lastName }}</div>
            <div class="donor-meta">
              <span class="meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {{ formatDate(donation.createdAt) }}
              </span>
              <span v-if="donation.reference" class="meta-item reference">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                {{ donation.reference }}
              </span>
            </div>
          </div>

          <div class="donation-amount">
            {{ formatAmount(donation.amount) }}
          </div>
        </div>

        <div class="card-actions">
          <button
            class="action-btn edit-btn"
            @click="handleEdit(donation)"
            :disabled="isLoading"
            :title="t('common.edit')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {{ t('common.edit') }}
          </button>
          <button
            class="action-btn delete-btn"
            @click="handleDelete(donation)"
            :disabled="isLoading"
            :title="t('common.delete')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
            {{ t('common.delete') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.donation-list {
  background: var(--shell-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  /* L'ombre ne se voit pas sur du navy : c'est cette bordure qui dessine
     le bord de la liste (carte contre page = 1.14). */
  border: 1px solid var(--shell-border);
  overflow: hidden;
}

/* Header */
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--shell-border);
  background: var(--shell-page);
}

.export-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  padding: 8px 12px;
  /* Bouton SECONDAIRE : contour + texte or, jamais d'aplat or plein.
     L'aplat or est reserve au montant du don (.donation-amount).
     Contour gold rgba(228,190,99,0.32) ecarte : il se compose sur le fond
     PROPRE du bouton (--shell-card, peint sous la bordure par background-clip
     border-box), pas sur celui du parent — soit #585047, 2.10 contre
     l'interieur du bouton, sous le seuil 3.0 d'un objet graphique.
     Regle a retenir : une bordure rgba se compose toujours sur le background de
     SON element, jamais sur celui du parent, sauf si ce background est
     transparent. Le contour neutre retenu compose #53576D, soit 2.34. */
  border: 1px solid var(--shell-border-strong);
  border-radius: var(--radius);
  background: var(--shell-card);
  color: var(--shell-accent); /* 10.68 sur --shell-page, 9.39 sur --shell-card */
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  transition: var(--transition);
}

.export-btn:hover {
  border-color: var(--shell-accent);
  /* Voile or : rendu #292829 sur --shell-page, le texte or y mesure 8.28 */
  background: rgba(228, 190, 99, 0.14);
}

.export-btn svg {
  width: 16px;
  height: 16px;
}

/* L'en-tete est devenu un bouton : cliquer replie la liste. */
.header-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 8px;
  margin-inline-start: -8px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: var(--transition-fast);
}

.header-info:hover {
  background: var(--shell-raised);
}

.collapse-chevron {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--shell-text-muted);
  transition: transform var(--transition);
}

.collapse-chevron.collapsed {
  transform: rotate(-90deg);
}

[dir='rtl'] .collapse-chevron.collapsed {
  transform: rotate(90deg);
}

@media (prefers-reduced-motion: reduce) {
  .collapse-chevron {
    transition: none;
  }
}

h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--shell-text-strong);
  margin: 0;
}

h3 svg {
  width: 20px;
  height: 20px;
  color: var(--shell-text-muted);
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 10px;
  /* Compteur DECORATIF : voile or, pas aplat or plein. L'aplat plein est
     reserve au montant du don, l'information dominante de la ligne.
     Deux etats a mesurer, pas un : le badge vit dans .header-info, dont le
     survol pose --shell-raised. Voile rendu #2E2C2B sur --shell-page (texte or
     7.84) et #3E3E52 quand l'en-tete est survole (5.88). Les deux passent. */
  background: rgba(228, 190, 99, 0.16);
  color: var(--shell-accent);
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 600;
}

/* Recherche */
.search-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 24px;
  border-bottom: 1px solid var(--shell-border);
  background: var(--shell-card);
}

.search-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--shell-text-muted);
}

.search-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--shell-text-strong);
  font: inherit;
  font-size: 14px;
  padding: 6px 0;
  outline: none;
}

.search-input::placeholder {
  color: var(--shell-text-muted);
}

/* Le natif ajoute sa propre croix : on la masque, la nôtre est stylée. */
.search-input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}

.search-count {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: rgba(228, 190, 99, 0.16);
  color: var(--shell-accent);
  font-size: 12px;
  font-weight: 600;
}

.clear-search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: 0;
  border-radius: 50%;
  background: var(--shell-raised);
  color: var(--shell-text-muted);
  cursor: pointer;
  transition: var(--transition-fast);
}

.clear-search-btn:hover {
  color: var(--shell-text-strong);
}

.clear-search-btn svg {
  width: 13px;
  height: 13px;
}

.search-no-results {
  margin: 0;
  padding: 28px 24px;
  text-align: center;
  color: var(--shell-text-muted);
  font-size: 14px;
}

/* Empty State */
.empty-state {
  padding: 60px 40px;
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 20px;
  background: var(--shell-raised);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon svg {
  width: 40px;
  height: 40px;
  color: var(--shell-text-muted);
}

.empty-state h4 {
  font-size: 18px;
  font-weight: 600;
  color: var(--shell-text-strong);
  margin: 0 0 8px;
}

.empty-state p {
  font-size: 14px;
  color: var(--shell-text-muted);
  margin: 0;
}

/* Donations Container */
.donations-container {
  max-height: 600px;
  overflow-y: auto;
}

/* Donation Card */
.donation-card {
  padding: 16px 24px;
  border-bottom: 1px solid var(--shell-border);
  transition: var(--transition);
  animation: fadeInUp 0.3s ease;
}

.donation-card:last-child {
  border-bottom: none;
}

.donation-card:hover {
  /* La ligne survolee se CREUSE (--shell-page) au lieu de se lever.
     Choix arithmetique, pas esthetique : survoler la ligne survole aussi
     le bouton Supprimer, et son voile rouge translucide mesure 5.72 sur
     --shell-page contre 4.30 sur --shell-raised, sous le seuil de 4.5. */
  background: var(--shell-page);
}

.card-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* Avatar */
.donor-avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg,
    hsl(var(--hue, 220), 70%, 60%) 0%,
    hsl(calc(var(--hue, 220) + 30), 70%, 50%) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 4px 12px hsla(var(--hue, 220), 70%, 50%, 0.3);
}

/* Donor Info */
.donor-info {
  flex: 1;
  min-width: 0;
}

.donor-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--shell-text-strong);
  margin-bottom: 4px;
}

.donor-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--shell-text-muted);
}

.meta-item svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.meta-item.reference {
  /* Voile or + texte or, pas d'aplat : la reference est une mention
     secondaire. Voile rendu #333340 sur la carte (texte or 7.02) et
     #292829 sur la ligne survolee (8.28). */
  color: var(--shell-accent);
  background: rgba(228, 190, 99, 0.14);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

/* Amount */
.donation-amount {
  font-size: 18px;
  font-weight: 700;
  /* SEUL aplat or plein du panneau : le montant est l'information
     dominante de la ligne. Texte sombre sur l'or, jamais blanc (10.68). */
  color: var(--shell-on-accent);
  white-space: nowrap;
  padding: 8px 16px;
  background: var(--shell-accent-flat);
  border-radius: var(--radius);
}

/* Actions */
.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-inline-start: 64px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--shell-border);
  border-radius: var(--radius);
  background: var(--shell-card);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
}

.action-btn svg {
  width: 15px;
  height: 15px;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.edit-btn {
  color: var(--shell-text);
}

.edit-btn:hover:not(:disabled) {
  /* Le bouton se LEVE quand la ligne se creuse : les deux etats restent
     distincts. --shell-border-strong, sinon le changement de bordure
     serait un non-evenement (--shell-border -> --shell-border). */
  background: var(--shell-raised);
  border-color: var(--shell-border-strong);
}

.delete-btn {
  /* --error #ef4444 echoue a 4.20 sur navy ; --shell-error #F87171 = 6.02 */
  color: var(--shell-error);
  border-color: var(--shell-error);
}

.delete-btn:hover:not(:disabled) {
  /* INVERSION SEMANTIQUE, et non un voile. Un voile rouge translucide sur du
     quasi-noir ne donne que 1.05 d'ecart de luminance avec le repos : sur la
     SEULE action irreversible du panneau, l'operateur ne voyait pas s'il etait
     sur « Modifier » ou sur « Supprimer » avant de cliquer — et le bouton le
     moins dangereux avait le survol le mieux marque. Monter l'alpha ne pouvait
     pas depasser 1.21 sans manger le texte rouge pose dessus.
     Le remplissage plein leve toute ambiguite : --shell-on-accent y mesure 6.84.
     Cela n'enfreint pas la hierarchie de l'or, qui ne porte que sur les aplats or. */
  background: var(--shell-error);
  border-color: var(--shell-error);
  color: var(--shell-on-accent); /* 6.84 sur #F87171 */
}

/* Responsive */
@media (max-width: 600px) {
  .list-header {
    align-items: stretch;
    flex-direction: column;
  }

  .export-btn {
    width: 100%;
    box-sizing: border-box;
  }

  .card-main {
    flex-wrap: wrap;
  }

  .donation-amount {
    width: 100%;
    text-align: center;
    margin-top: 12px;
  }

  .card-actions {
    padding-inline-start: 0;
    justify-content: center;
  }
}
</style>
