<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useDonations, type Donation } from '../../composables/useDonations';
import { useAdminI18n } from '../../composables/useAdminI18n';

const { t } = useAdminI18n();

const props = defineProps<{
  donation?: Donation | null;
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
  (e: 'cancel'): void;
}>();

const { config, premiumWords, createDonation, updateDonation, fetchPremiumWords, formatAmount, isLoading, error } = useDonations();

const firstName = ref(props.donation?.firstName || '');
const lastName = ref(props.donation?.lastName || '');
const email = ref(props.donation?.email || '');
const phone = ref(props.donation?.phone || '');
const amount = ref(props.donation?.amount || 0);
const reference = ref(props.donation?.reference || '');
const selectedWordId = ref<string | null>(props.donation?.premiumWordId || null);
const customAmount = ref('');
const showSuccess = ref(false);
const showOptionalFields = ref(Boolean(
  props.donation?.email || props.donation?.phone || props.donation?.reference
));

const isEditing = computed(() => !!props.donation);
const usesMenorahVisual = computed(() => config.value.displaySettings.visualMode === 'menorah');

// Premium amounts for reserved word groups (in agorot)
const PREMIUM_AMOUNTS = [
  { amount: 2600000, label: '26,000', words: 7, level: 1 },
  { amount: 3600000, label: '36,000', words: 3, level: 2 },
  { amount: 7200000, label: '72,000', words: 1, level: 3 }
];

const showPremiumAmounts = ref(Boolean(
  props.donation && PREMIUM_AMOUNTS.some(preset => preset.amount === props.donation!.amount)
));

// Check if selected amount is premium
const selectedPremium = computed(() => {
  if (!usesMenorahVisual.value) return undefined;
  return PREMIUM_AMOUNTS.find(p => p.amount === amount.value);
});

// Get available words for the selected premium tier
const availableWordsForTier = computed(() => {
  if (!selectedPremium.value) return [];
  return premiumWords.value.filter(w => w.level === selectedPremium.value!.level);
});

// Auto-select word if only one available for Level 3
watch(() => selectedPremium.value, (premium) => {
  if (premium?.level === 3) {
    const lvl3Word = premiumWords.value.find(w => w.level === 3 && w.available);
    selectedWordId.value = lvl3Word?.id || null;
  } else if (!premium) {
    selectedWordId.value = null;
  }
});

watch(usesMenorahVisual, async (enabled) => {
  if (enabled) {
    await fetchPremiumWords();
  } else {
    selectedWordId.value = null;
    showPremiumAmounts.value = false;
  }
}, { immediate: true });

// Watch for donation prop changes (when editing)
watch(() => props.donation, (newDonation) => {
  if (newDonation) {
    firstName.value = newDonation.firstName;
    lastName.value = newDonation.lastName;
    email.value = newDonation.email || '';
    phone.value = newDonation.phone || '';
    amount.value = newDonation.amount;
    reference.value = newDonation.reference || '';
    selectedWordId.value = newDonation.premiumWordId || null;
    customAmount.value = '';
    showPremiumAmounts.value = PREMIUM_AMOUNTS.some(preset => preset.amount === newDonation.amount);
    showOptionalFields.value = Boolean(newDonation.email || newDonation.phone || newDonation.reference);
  } else {
    firstName.value = '';
    lastName.value = '';
    email.value = '';
    phone.value = '';
    amount.value = 0;
    reference.value = '';
    selectedWordId.value = null;
    customAmount.value = '';
    showPremiumAmounts.value = false;
    showOptionalFields.value = false;
  }
}, { immediate: true });

// Select preset amount
function selectPreset(preset: number): void {
  amount.value = preset;
  customAmount.value = '';
  // Reset word selection when amount changes (unless it's level 3 which auto-selects)
  const premium = PREMIUM_AMOUNTS.find(p => p.amount === preset);
  if (!premium || premium.level !== 3) {
    selectedWordId.value = null;
  }
}

// Handle custom amount input
function updateCustomAmount(value: string): void {
  customAmount.value = value;
  const parsed = parseFloat(value);
  if (!isNaN(parsed) && parsed > 0) {
    // Convert shekels to agorot
    amount.value = Math.round(parsed * 100);
  }
}

// Submit form
async function submit(): Promise<void> {
  if (!firstName.value.trim() || amount.value <= 0) {
    return;
  }

  // Validate that a word is selected for premium amounts
  if (selectedPremium.value && !selectedWordId.value) {
    return;
  }

  const data = {
    firstName: firstName.value.trim(),
    lastName: lastName.value.trim(),
    email: email.value.trim() || undefined,
    phone: phone.value.trim() || undefined,
    amount: amount.value,
    reference: reference.value.trim() || undefined,
    premiumWordId: selectedWordId.value || undefined
  };

  let result;
  if (isEditing.value && props.donation) {
    result = await updateDonation(props.donation.id, data);
  } else {
    result = await createDonation(data);
  }

  if (result) {
    // Show success animation
    showSuccess.value = true;
    setTimeout(() => {
      showSuccess.value = false;
    }, 2000);

    // Refresh premium words to update availability
    await fetchPremiumWords();

    // Reset form
    firstName.value = '';
    lastName.value = '';
    email.value = '';
    phone.value = '';
    amount.value = 0;
    reference.value = '';
    selectedWordId.value = null;
    customAmount.value = '';
    showPremiumAmounts.value = false;
    showOptionalFields.value = false;
    emit('saved');
  }
}

function cancel(): void {
  emit('cancel');
}
</script>

<template>
  <div class="donation-form-wrapper">
    <form @submit.prevent="submit" class="donation-form">
      <!-- Header -->
      <div class="form-header">
        <div class="form-icon" :class="{ editing: isEditing }">
          <svg v-if="!isEditing" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </div>
        <div>
          <h3>{{ isEditing ? t('donation.editTitle') : t('donation.newTitle') }}</h3>
          <p class="form-subtitle">{{ isEditing ? t('donation.editSubtitle') : t('donation.newSubtitle') }}</p>
        </div>
      </div>

      <!-- Donor Name Fields -->
      <div class="form-row">
        <div class="form-group">
          <label for="firstName">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            {{ t('donation.firstName') }}
          </label>
          <input
            id="firstName"
            v-model="firstName"
            type="text"
            required
            :placeholder="t('donation.firstNamePlaceholder')"
            class="input"
          />
        </div>

        <div class="form-group">
          <label for="lastName">
            {{ t('donation.lastName') }}
            <span class="optional">({{ t('donation.optional') }})</span>
          </label>
          <input
            id="lastName"
            v-model="lastName"
            type="text"
            :placeholder="t('donation.lastNamePlaceholder')"
            class="input"
          />
        </div>
      </div>

      <button
        type="button"
        class="optional-toggle"
        :aria-expanded="showOptionalFields"
        @click="showOptionalFields = !showOptionalFields"
      >
        <span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06M4.27 4.27l15.46 15.46M12 2v2M12 20v2M2 12h2M20 12h2"/>
          </svg>
          {{ t('donation.optionalFields') }}
          <span class="optional">({{ t('donation.optional') }})</span>
        </span>
        <svg class="optional-chevron" :class="{ open: showOptionalFields }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      <div v-if="showOptionalFields" class="optional-fields">
        <!-- Email Field -->
        <div class="form-group">
          <label for="email">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            {{ t('donation.email') }} <span class="optional">({{ t('donation.optional') }})</span>
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="exemple@email.com"
            class="input"
          />
        </div>

        <!-- Phone Field -->
        <div class="form-group">
          <label for="phone">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 1 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            {{ t('donation.phone') }} <span class="optional">({{ t('donation.optional') }})</span>
          </label>
          <input
            id="phone"
            v-model="phone"
            type="tel"
            placeholder="05X XXX XXXX"
            class="input"
          />
        </div>
      </div>

      <!-- Amount Selection -->
      <div class="form-group">
        <label>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v12M8 10h8M8 14h8"/>
          </svg>
          {{ t('donation.amount') }}
        </label>

        <div class="custom-amount-wrapper quick-amount-wrapper">
          <span class="currency-symbol">&#8362;</span>
          <input
            type="number"
            v-model="customAmount"
            @input="updateCustomAmount(($event.target as HTMLInputElement).value)"
            :placeholder="t('donation.amountPlaceholder')"
            min="0.01"
            step="0.01"
            class="input custom-input"
          />
        </div>

        <button type="submit" class="btn btn-primary quick-save-btn" :disabled="isLoading || amount <= 0">
          <svg v-if="isLoading" class="spinner" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="32" stroke-linecap="round"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M13 6l6 6-6 6"/>
          </svg>
          {{ isLoading ? t('common.saving') : (isEditing ? t('donation.update') : t('donation.saveAndDisplay')) }}
        </button>

        <div class="amount-separator"><span>{{ t('donation.chooseAmount') }}</span></div>

        <button
          v-if="usesMenorahVisual"
          type="button"
          class="premium-options-toggle"
          :aria-expanded="showPremiumAmounts"
          @click="showPremiumAmounts = !showPremiumAmounts"
        >
          <span><span class="premium-star">&#10017;</span> {{ t('donation.premiumTiers') }} 26 000 / 36 000 / 72 000 ₪</span>
          <svg :class="{ open: showPremiumAmounts }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>

        <!-- Premium amounts section -->
        <div v-if="usesMenorahVisual && showPremiumAmounts" class="premium-section">
          <div class="premium-header">
            <span class="premium-badge">&#10017; {{ t('donation.premiumWords') }}</span>
            <span class="premium-subtitle">{{ t('donation.premiumDescription') }}</span>
          </div>
          <div class="premium-grid">
            <button
              v-for="premium in PREMIUM_AMOUNTS"
              :key="premium.amount"
              type="button"
              :class="['premium-btn', { selected: amount === premium.amount }]"
              @click="selectPreset(premium.amount)"
            >
              <span class="premium-tier">{{ t('donation.tier', { level: premium.level }) }}</span>
              <span class="premium-amount">{{ premium.label }} &#8362;</span>
              <span class="premium-words">{{ t(premium.words === 1 ? 'donation.wordCount' : 'donation.wordsCount', { count: premium.words }) }}</span>
            </button>
          </div>
        </div>

        <!-- Regular presets -->
        <div class="regular-section">
          <span class="regular-label">{{ t('donation.otherAmounts') }}</span>
          <div class="preset-grid">
            <button
              v-for="preset in config.presetAmounts"
              :key="preset"
              type="button"
              :class="['preset-btn', { selected: amount === preset && !customAmount }]"
              @click="selectPreset(preset)"
            >
              <span class="preset-amount">{{ formatAmount(preset) }}</span>
            </button>
          </div>
        </div>

        <!-- Premium Word Selector -->
        <div v-if="selectedPremium && availableWordsForTier.length > 0" class="word-selector">
          <label class="word-selector-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {{ t('donation.chooseSacredWord') }}
          </label>
          <div class="word-options">
            <button
              v-for="word in availableWordsForTier"
              :key="word.id"
              type="button"
              :class="['word-option', { selected: selectedWordId === word.id, unavailable: !word.available }]"
              :disabled="!word.available && selectedWordId !== word.id"
              @click="word.available || selectedWordId === word.id ? selectedWordId = word.id : null"
            >
              <span class="word-star">&#10017;</span>
              <span class="word-name">{{ word.label }}</span>
              <span v-if="!word.available && selectedWordId !== word.id" class="word-taken">
                {{ word.donorName }}
              </span>
              <span v-else-if="selectedWordId === word.id" class="word-check">&#10003;</span>
            </button>
          </div>
        </div>

        <div v-if="amount > 0" class="selected-amount" :class="{ premium: selectedPremium }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <span v-if="selectedPremium">
            {{ t('donation.premiumAmount') }} : <strong>{{ formatAmount(amount) }}</strong>
            <span v-if="selectedWordId" class="premium-info"> - {{ availableWordsForTier.find(w => w.id === selectedWordId)?.label }}</span>
          </span>
          <span v-else>
            {{ t('donation.selectedAmount') }} : <strong>{{ formatAmount(amount) }}</strong>
          </span>
        </div>
      </div>

      <!-- Reference Field -->
      <div v-if="showOptionalFields" class="form-group optional-reference">
        <label for="reference">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          {{ t('donation.reference') }} <span class="optional">({{ t('donation.optional') }})</span>
        </label>
        <input
          id="reference"
          v-model="reference"
          type="text"
          :placeholder="t('donation.referencePlaceholder')"
          class="input"
        />
      </div>

      <!-- Error Message -->
      <div v-if="error" class="error-message">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {{ error }}
      </div>

      <!-- Success Message -->
      <div v-if="showSuccess" class="success-message">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        {{ t('donation.success') }}
      </div>

      <!-- Form Actions -->
      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="isLoading || amount <= 0">
          <svg v-if="isLoading" class="spinner" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="32" stroke-linecap="round"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          {{ isLoading ? t('common.saving') : (isEditing ? t('donation.update') : t('donation.saveAndDisplay')) }}
        </button>

        <button v-if="isEditing" type="button" class="btn btn-secondary" @click="cancel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          {{ t('common.cancel') }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.donation-form-wrapper {
  position: sticky;
  top: 24px;
}

.donation-form {
  background: var(--shell-card);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--shell-border);
}

/* Header */
.form-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--shell-border);
}

/* Signal creation / edition : la CREATION est neutre, l'EDITION garde l'or en
   aplat plein. Dans une admin devenue doree, l'or ne signale plus rien s'il
   habille les deux etats. */
.form-icon {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  background: var(--shell-raised);
  color: var(--shell-text-strong); /* glyphe 15.03 sur la carte, 13.12 sur --shell-raised */
  border: 1px solid var(--shell-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: none; /* l'ancienne lueur bleue rgba(26,115,232,.3) ne se voit pas sur navy */
}

/* ARBITRAGE : la pastille indique, elle n'agit pas. En mode edition, trois
   aplats or pleins coexistaient — cette pastille et les DEUX boutons de
   validation — ce qui aplatit la hierarchie : un ornement d'en-tete criait
   aussi fort que l'action de sauvegarde. L'or plein reste donc aux boutons ;
   l'edition se signale par un CONTOUR or plus un glyphe or, ce qui conserve
   le signal creation-contre-edition sans le mettre en concurrence. */
.form-icon.editing {
  background: rgba(228, 190, 99, 0.14); /* compose #333340 sur la carte */
  color: var(--shell-accent); /* glyphe 7.02 sur #333340 */
  border-color: var(--shell-accent);
  box-shadow: 0 0 0 3px rgba(228, 190, 99, 0.18);
}

.form-icon svg {
  width: 26px;
  height: 26px;
  color: inherit;
}

h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--shell-text-strong);
  margin: 0 0 4px;
}

.form-subtitle {
  font-size: 13px;
  color: var(--shell-text-muted);
  margin: 0;
}

/* Form Groups */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  margin-bottom: 16px;
}

label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 500;
  font-size: 14px;
  color: var(--shell-text);
}

label svg {
  width: 16px;
  height: 16px;
  color: var(--shell-text-muted);
}

.optional {
  font-weight: 400;
  color: var(--shell-text-muted);
  font-size: 12px;
}

.optional-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -2px 0 16px;
  padding: 11px 14px;
  border: 1px dashed var(--shell-border);
  border-radius: var(--radius);
  background: var(--shell-page); /* creux dans la carte */
  color: var(--shell-text); /* 13.31 sur #0B1020 */
  cursor: pointer;
  transition: var(--transition);
}

.optional-toggle:hover {
  border-color: rgba(228, 190, 99, 0.32);
  /* FIGE EN OPAQUE, et ce n'est pas un detail. Un voile translucide ne s'AJOUTE
     pas au fond du repos : il le REMPLACE et se compose sur le PARENT (la carte
     #161C3A), pas sur --shell-page. Il rendait #2B2C3E, ou la mention
     « (optionnel) » tombait a 4.27 — un echec cree par le survol lui-meme.
     #212127 est le compose voulu (voile or 0.10 sur --shell-page) fige. */
  background: #212127;
  color: var(--shell-accent); /* 9.03 sur #212127 ; la mention secondaire y tient 4.99 */
}

.optional-toggle > span {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
}

.optional-toggle svg {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
}

.optional-chevron {
  transition: transform var(--transition);
}

.optional-chevron.open {
  transform: rotate(180deg);
}

.optional-fields {
  animation: fadeInUp 0.2s ease;
}

.optional-reference {
  animation: fadeInUp 0.2s ease;
}

/* Input Styles — les champs restent volontairement CLAIRS (voir global.css l.123-131).
   background ET color sont declares explicitement : sans eux, un champ sur carte
   sombre s'en remet au defaut du navigateur et devient illisible chez certains. */
.input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--field-border);
  border-radius: var(--radius);
  font-size: 14px;
  color: var(--field-text); /* 15.87 sur le champ */
  background: var(--field-bg);
  transition: var(--transition);
}

.input::placeholder {
  color: var(--field-placeholder); /* 4.73 sur le champ */
}

/* Pas de couleur de bordure au survol : elle valait exactement celle du focus,
   si bien qu'a la souris le champ paraissait deja focalise avant tout focus, et
   que l'ecart mesure entre non-focus et focus tombait a 1.57. La bordure or est
   desormais EXCLUSIVE au focus, ce qui est la seule facon de rendre le
   deplacement au clavier lisible sur un formulaire de six champs. */
.input:focus {
  outline: none;
  /* Indicateur de focus porte par la bordure 2px #C8922A : 6.03 contre la carte
     navy qui borde le champ. L'anneau le renforce, et il doit lui-meme franchir
     le seuil de 3.0 d'un objet graphique : a 0.30 il composait #544D46 = 1.99,
     un halo sous le seuil. A 0.47 il compose #77684D = 3.07. */
  border-color: var(--field-border-focus);
  background: var(--field-bg);
  box-shadow: 0 0 0 4px rgba(228, 190, 99, 0.47);
}

/* Premium Section */
.premium-options-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 11px 13px;
  /* 0.47 et non 0.45 : c'est ce trait, pas la surface (1.27 contre la carte),
     qui dessine le bouton. A 0.45 il composait #73654C = 2.92, sous le seuil de
     3.0 d'un objet graphique — un echec, pas un arrondi. A 0.47 : #77684D = 3.07. */
  border: 1px solid rgba(228, 190, 99, 0.47);
  border-radius: var(--radius);
  /* l'aplat creme #fffaf0 devient un voile or : compose #2F2F3F sur la carte */
  background: rgba(228, 190, 99, 0.12);
  color: var(--shell-accent); /* 7.41 sur #2F2F3F */
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  text-align: start;
}

.premium-options-toggle > span {
  display: flex;
  align-items: center;
  gap: 7px;
}

.premium-options-toggle svg {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  transition: transform var(--transition);
}

.premium-options-toggle svg.open {
  transform: rotate(180deg);
}

.premium-star {
  color: var(--shell-accent); /* 7.41 sur #2F2F3F */
  font-size: 16px;
}

/* Ce bloc n'est PAS un apercu : il stylе de vrais controles admin. Les navys en
   dur #1a1a2e/#16213e se re-expriment dans l'echelle. Il est POSE sur une carte
   --shell-card, donc il doit etre plus CLAIR qu'elle, pas plus sombre. */
.premium-section {
  background: var(--shell-raised);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid var(--shell-border-strong);
}

.premium-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
}

.premium-badge {
  color: var(--shell-accent); /* 8.19 sur --shell-raised */
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 1px;
}

.premium-subtitle {
  color: var(--shell-text); /* 10.22 sur --shell-raised */
  font-size: 12px;
  margin-top: 4px;
}

.premium-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.premium-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 12px;
  border: 2px solid rgba(228, 190, 99, 0.32);
  border-radius: var(--radius);
  /* voile blanc conserve tel quel : le bouton reste plus clair que son bloc.
     Compose #293158 sur --shell-raised. */
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
}

.premium-btn:hover {
  border-color: var(--shell-accent);
  background: rgba(228, 190, 99, 0.10); /* compose #323551 */
  transform: translateY(-2px);
}

.premium-btn.selected {
  border-color: var(--shell-accent-strong);
  background: rgba(228, 190, 99, 0.20); /* compose #464453 */
  box-shadow: 0 0 20px rgba(228, 190, 99, 0.30);
}

/* rgba(255,255,255,0.5) mesure 3.78 sur #16213e : ECHEC. --shell-text-muted ne
   sauve pas la regle ici (3.91 sur #293158, 3.71 au survol, 2.96 en selection,
   tous sous 4.5) car le bouton porte un voile eclaircissant. Retenu
   --shell-text : 8.82 au repos, 8.37 au survol, 6.68 en selection. */
.premium-tier {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--shell-text);
  margin-bottom: 6px;
}

.premium-btn .premium-amount {
  font-size: 18px;
  font-weight: 700;
  color: var(--shell-accent); /* 7.07 sur #293158 */
  margin-bottom: 4px;
}

.premium-btn.selected .premium-amount {
  color: var(--shell-accent-strong); /* 6.17 sur #464453 */
  text-shadow: 0 0 10px rgba(242, 204, 114, 0.45);
}

/* rgba(255,255,255,0.4) = 3.78 sur #16213e : ECHEC. Meme arbitrage que
   .premium-tier ci-dessus. */
.premium-words {
  font-size: 11px;
  color: var(--shell-text);
}

/* Regular Section */
.regular-section {
  margin-bottom: 16px;
}

.regular-label {
  display: block;
  font-size: 12px;
  color: var(--shell-text-muted);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Preset Amounts */
/* Meme defaut d'orphelin que la grille de la page /don, et meme correctif : le
   nombre de montants est editable par l'admin, donc inconnu ici. Tout compte
   valant « colonnes + 1 » laissait un montant seul sur sa ligne (6 sur 5
   colonnes, 4 sur 3 en mobile). La regle :last-child fait occuper toute la
   ligne au dernier montant s'il s'y retrouve seul, quel que soit leur nombre. */
.preset-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
  margin-bottom: 16px;
}

.preset-grid > .preset-btn:last-child:nth-child(5n + 1) {
  grid-column: 1 / -1;
}

.preset-btn {
  padding: 11px 5px;
  border: 2px solid var(--shell-border);
  border-radius: var(--radius);
  /* pose SUR la carte : il doit etre plus clair qu'elle, pas egal a elle */
  background: var(--shell-raised);
  cursor: pointer;
  transition: var(--transition);
  text-align: center;
}

.preset-btn:hover {
  border-color: rgba(228, 190, 99, 0.32);
  /* Fige le compose du voile or 0.10 pose sur --shell-raised, le fond du repos.
     Laisse translucide, il se composait sur la CARTE et non sur le repos :
     l'ecart survol/repos tombait a 1.06, autrement dit invisible sur une grille
     de six cellules cote a cote. Fige a #323551, l'ecart remonte a 1.22. */
  background: #323551;
}

.preset-btn.selected {
  border-color: var(--shell-accent);
  background: rgba(228, 190, 99, 0.14); /* compose #333340 sur la carte */
  box-shadow: 0 0 0 4px rgba(228, 190, 99, 0.22);
}

.preset-amount {
  font-size: 12px;
  font-weight: 600;
  color: var(--shell-text-strong); /* 13.12 sur --shell-raised */
}

.preset-btn.selected .preset-amount {
  color: var(--shell-accent); /* 7.02 sur #333340 */
}

/* Custom Amount */
.custom-amount-wrapper {
  position: relative;
}

.currency-symbol {
  position: absolute;
  inset-inline-start: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  font-weight: 600;
  /* ce symbole est POSE DANS le champ clair (padding-inline-start: 36px), pas sur
     la carte sombre : il suit l'echelle --field-*, pas l'echelle --shell-*. */
  color: var(--field-placeholder); /* 4.73 sur --field-bg */
}

.custom-input {
  padding-inline-start: 36px;
}

.quick-amount-wrapper {
  margin-bottom: 10px;
}

.quick-save-btn {
  width: 100%;
  margin-bottom: 14px;
}

.amount-separator {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 2px 0 12px;
  color: var(--shell-text-muted); /* 5.19 sur la carte */
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.amount-separator::before,
.amount-separator::after {
  content: '';
  height: 1px;
  flex: 1;
  background: var(--shell-border);
}

/* Selected Amount — SIGNAL don ordinaire contre don premium. C'est ainsi que
   l'operateur voit qu'il a selectionne un palier premium : si tout devenait
   navy/or, le signal mourrait. Le montant ORDINAIRE garde donc une identite
   VERTE sur fond sombre, le PREMIUM garde l'identite OR. */
.selected-amount {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 12px 16px;
  /* --success-light est un aplat clair : il ne survit pas sur carte sombre.
     Voile vert a la place, compose #1A3245 sur la carte. */
  background: rgba(52, 211, 153, 0.12);
  border: 1px solid rgba(52, 211, 153, 0.32); /* une ombre ne se voit pas sur navy */
  border-radius: var(--radius);
  color: var(--shell-success); /* 6.89 sur #1A3245 */
  font-size: 14px;
}

.selected-amount.premium {
  background: rgba(228, 190, 99, 0.12); /* compose #2F2F3F sur la carte */
  border: 1px solid rgba(228, 190, 99, 0.32);
  color: var(--shell-accent); /* 7.41 sur #2F2F3F */
}

.selected-amount.premium strong {
  color: var(--shell-accent-strong); /* 8.54 sur #2F2F3F */
}

.selected-amount.premium .premium-info {
  color: var(--shell-text); /* 9.23 sur #2F2F3F */
  font-size: 12px;
  margin-inline-start: 4px;
}

.selected-amount svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* #047857 est illisible sur navy (aplat vert fonce prevu pour du blanc) */
.selected-amount strong {
  color: var(--shell-success); /* 6.89 sur #1A3245 */
}

/* Word Selector — comme .premium-section, ce n'est PAS un apercu : ce sont de
   vrais controles admin. Les navys en dur rgba(26,26,46,.95)/rgba(22,33,62,.95)
   se re-expriment dans l'echelle, plus clairs que la carte qui les porte. */
.word-selector {
  background: var(--shell-raised);
  border-radius: var(--radius);
  padding: 16px;
  margin-top: 16px;
  border: 1px solid var(--shell-border-strong);
}

.word-selector-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--shell-accent); /* 8.19 sur --shell-raised */
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}

.word-selector-label svg {
  width: 18px;
  height: 18px;
  color: var(--shell-accent-strong); /* 9.45 sur --shell-raised */
}

.word-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}

.word-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  border: 2px solid rgba(228, 190, 99, 0.32);
  border-radius: var(--radius);
  /* voile blanc conserve : compose #293158 sur --shell-raised */
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

/* :not(:disabled) et non :not(.unavailable) : le mot deja detenu par le don en
   cours d'edition porte la classe .unavailable tout en restant cliquable — il
   doit donc recevoir le retour de survol comme n'importe quel bouton actif. */
.word-option:hover:not(:disabled) {
  border-color: var(--shell-accent);
  background: rgba(228, 190, 99, 0.10); /* compose #323551 */
}

.word-option.selected {
  border-color: var(--shell-accent-strong);
  background: rgba(228, 190, 99, 0.20); /* compose #464453 */
  box-shadow: 0 0 15px rgba(228, 190, 99, 0.30);
}

/* :disabled et non .unavailable seul — correction d'un defaut pre-existant.
   Le template pose la classe des que le mot est pris, mais ne desactive le
   bouton que si ce n'est pas LE mot deja detenu par le don en cours d'edition.
   En reprise d'un don premium, la case du mot qu'il detient etait donc la seule
   cliquable du selecteur ET la moins lisible : opacity 0.5 ecrasait son nom a
   2.81 et sa coche a 2.43, et cette bordure blanche, a specificite egale et
   declaree apres, effacait la bordure or de l'etat selectionne. */
.word-option.unavailable:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  /* voile blanc 0.1 conserve tel quel (deja pose sur du navy) */
  border-color: rgba(255, 255, 255, 0.1);
}

/* rgba(255,255,255,0.4) = 3.78 sur #16213e : ECHEC. --shell-text-muted echoue
   aussi ici (3.91 sur #293158, 2.96 en selection). Retenu --shell-text : 8.82. */
.word-star {
  font-size: 20px;
  color: var(--shell-text);
  margin-bottom: 4px;
}

.word-option.selected .word-star {
  color: var(--shell-accent-strong); /* 6.17 sur #464453 */
  text-shadow: 0 0 10px rgba(242, 204, 114, 0.45);
}

.word-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--shell-text-strong); /* 11.32 sur #293158 */
}

.word-option.selected .word-name {
  color: var(--shell-accent-strong); /* 6.17 sur #464453 */
}

/* rgba(255,255,255,0.4) : meme arbitrage que .word-star. Ce libelle n'apparait
   que sur .word-option.unavailable, un controle desactive (exempt WCAG 1.4.3),
   mais --shell-text lui donne la meilleure lisibilite disponible. */
.word-taken {
  font-size: 10px;
  color: var(--shell-text);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.word-check {
  font-size: 14px;
  color: var(--shell-success); /* 4.94 sur #464453, l'option selectionnee */
  margin-top: 4px;
}

/* Messages */
.error-message {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  /* --error-light est un aplat clair : il ne survit pas sur carte sombre. Voile
     rouge a la place, compose #312641. --error #ef4444 echoue a 4.20 sur navy. */
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.32);
  border-radius: var(--radius);
  color: var(--shell-error); /* 5.12 sur #312641 */
  font-size: 14px;
  margin-bottom: 16px;
  animation: fadeInUp 0.3s ease;
}

.error-message svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.success-message {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(52, 211, 153, 0.12); /* compose #1A3245 */
  border: 1px solid rgba(52, 211, 153, 0.32);
  border-radius: var(--radius);
  color: var(--shell-success); /* 6.89 sur #1A3245 */
  font-size: 14px;
  margin-bottom: 16px;
  animation: fadeInUp 0.3s ease;
}

.success-message svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* Form Actions */
.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 24px;
  border: none;
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.btn svg {
  width: 18px;
  height: 18px;
}

/* Les DEUX submit de ce formulaire (raccourci sous le champ montant et action de
   pied de formulaire) portent cette meme classe : ils restent identiques. */
.btn-primary {
  flex: 1;
  background: var(--shell-accent);
  color: var(--shell-on-accent); /* 10.68 sur l'or — jamais 'white' sur un aplat or */
  box-shadow: 0 4px 12px rgba(228, 190, 99, 0.28);
}

.btn-primary:hover:not(:disabled) {
  background: var(--shell-accent-strong);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(228, 190, 99, 0.35);
}

.btn-primary:disabled {
  background: var(--shell-raised);
  /* sans ce color, le --shell-on-accent herite serait du sombre sur du sombre */
  color: var(--shell-text-muted); /* 4.53 sur --shell-raised */
  box-shadow: none;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--shell-raised);
  color: var(--shell-text); /* 10.22 sur --shell-raised */
  /* inset plutot qu'une bordure : --shell-raised contre la carte ne fait que
     1.16, et un inset ne decale pas le bouton d'un pixel face au submit. */
  box-shadow: inset 0 0 0 1px var(--shell-border);
}

.btn-secondary:hover {
  background: var(--shell-border); /* voile blanc .16, rendu #3B405A ; texte a 7.15 */
}

/* Spinner */
.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 600px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .preset-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .preset-grid > .preset-btn:last-child:nth-child(5n + 1) {
    grid-column: auto;
  }

  .preset-grid > .preset-btn:last-child:nth-child(3n + 1) {
    grid-column: 1 / -1;
  }

  .premium-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .premium-btn {
    flex-direction: row;
    justify-content: space-between;
    padding: 12px 16px;
  }

  .premium-tier {
    margin-bottom: 0;
  }

  .premium-btn .premium-amount {
    margin-bottom: 0;
  }
}
</style>
