<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useDonations, type Donation, type PremiumWord } from '../../composables/useDonations';

const props = defineProps<{
  donation?: Donation | null;
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
  (e: 'cancel'): void;
}>();

const { config, premiumWords, premiumTiers, createDonation, updateDonation, fetchPremiumWords, formatAmount, isLoading, error } = useDonations();

const firstName = ref(props.donation?.firstName || '');
const lastName = ref(props.donation?.lastName || '');
const email = ref(props.donation?.email || '');
const phone = ref(props.donation?.phone || '');
const amount = ref(props.donation?.amount || 0);
const reference = ref(props.donation?.reference || '');
const selectedWordId = ref<string | null>(props.donation?.premiumWordId || null);
const customAmount = ref('');
const showSuccess = ref(false);

const isEditing = computed(() => !!props.donation);

// Premium amounts for reserved word groups (in agorot)
const PREMIUM_AMOUNTS = [
  { amount: 2600000, label: '26,000', words: 7, tier: 'Niveau 1', level: 1 },
  { amount: 3600000, label: '36,000', words: 3, tier: 'Niveau 2', level: 2 },
  { amount: 7200000, label: '72,000', words: 1, tier: 'Niveau 3', level: 3 }
];

// Check if selected amount is premium
const selectedPremium = computed(() => {
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

// Fetch premium words on mount
onMounted(async () => {
  await fetchPremiumWords();
});

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
  if (!firstName.value.trim() || !lastName.value.trim() || amount.value <= 0) {
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
          <h3>{{ isEditing ? 'Modifier le don' : 'Nouveau don' }}</h3>
          <p class="form-subtitle">{{ isEditing ? 'Modifiez les informations du don' : 'Enregistrez une nouvelle contribution' }}</p>
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
            Prénom
          </label>
          <input
            id="firstName"
            v-model="firstName"
            type="text"
            required
            placeholder="Entrez le prénom"
            class="input"
          />
        </div>

        <div class="form-group">
          <label for="lastName">Nom</label>
          <input
            id="lastName"
            v-model="lastName"
            type="text"
            required
            placeholder="Entrez le nom"
            class="input"
          />
        </div>
      </div>

      <!-- Email Field -->
      <div class="form-group">
        <label for="email">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Email <span class="optional">(optionnel)</span>
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
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          Téléphone <span class="optional">(optionnel)</span>
        </label>
        <input
          id="phone"
          v-model="phone"
          type="tel"
          placeholder="05X XXX XXXX"
          class="input"
        />
      </div>

      <!-- Amount Selection -->
      <div class="form-group">
        <label>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v12M8 10h8M8 14h8"/>
          </svg>
          Montant du don
        </label>

        <!-- Premium amounts section -->
        <div class="premium-section">
          <div class="premium-header">
            <span class="premium-badge">&#10017; Mots Premium</span>
            <span class="premium-subtitle">Illuminez un mot sacré de la Menorah</span>
          </div>
          <div class="premium-grid">
            <button
              v-for="premium in PREMIUM_AMOUNTS"
              :key="premium.amount"
              type="button"
              :class="['premium-btn', { selected: amount === premium.amount }]"
              @click="selectPreset(premium.amount)"
            >
              <span class="premium-tier">{{ premium.tier }}</span>
              <span class="premium-amount">{{ premium.label }} &#8362;</span>
              <span class="premium-words">{{ premium.words }} mot{{ premium.words > 1 ? 's' : '' }}</span>
            </button>
          </div>
        </div>

        <!-- Regular presets -->
        <div class="regular-section">
          <span class="regular-label">Autres montants</span>
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

        <div class="custom-amount-wrapper">
          <span class="currency-symbol">&#8362;</span>
          <input
            type="number"
            v-model="customAmount"
            @input="updateCustomAmount(($event.target as HTMLInputElement).value)"
            placeholder="Autre montant"
            min="0.01"
            step="0.01"
            class="input custom-input"
          />
        </div>

        <!-- Premium Word Selector -->
        <div v-if="selectedPremium && availableWordsForTier.length > 0" class="word-selector">
          <label class="word-selector-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Choisissez votre mot sacré
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
            Montant Premium: <strong>{{ formatAmount(amount) }}</strong>
            <span v-if="selectedWordId" class="premium-info"> - {{ availableWordsForTier.find(w => w.id === selectedWordId)?.label }}</span>
          </span>
          <span v-else>
            Montant sélectionné: <strong>{{ formatAmount(amount) }}</strong>
          </span>
        </div>
      </div>

      <!-- Reference Field -->
      <div class="form-group">
        <label for="reference">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          Référence <span class="optional">(optionnel)</span>
        </label>
        <input
          id="reference"
          v-model="reference"
          type="text"
          placeholder="N° de transaction, chèque..."
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
        Don enregistré avec succès !
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
          {{ isLoading ? 'Enregistrement...' : (isEditing ? 'Mettre à jour' : 'Enregistrer le don') }}
        </button>

        <button v-if="isEditing" type="button" class="btn btn-secondary" @click="cancel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Annuler
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
  background: white;
  border-radius: var(--radius-lg);
  padding: 28px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--gray-100);
}

/* Header */
.form-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--gray-100);
}

.form-icon {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(26, 115, 232, 0.3);
}

.form-icon.editing {
  background: linear-gradient(135deg, var(--gold-500) 0%, var(--gold-600) 100%);
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
}

.form-icon svg {
  width: 26px;
  height: 26px;
  color: white;
}

h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 4px;
}

.form-subtitle {
  font-size: 13px;
  color: var(--gray-500);
  margin: 0;
}

/* Form Groups */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 500;
  font-size: 14px;
  color: var(--gray-700);
}

label svg {
  width: 16px;
  height: 16px;
  color: var(--gray-400);
}

.optional {
  font-weight: 400;
  color: var(--gray-400);
  font-size: 12px;
}

/* Input Styles */
.input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--gray-200);
  border-radius: var(--radius);
  font-size: 14px;
  color: var(--gray-900);
  background: var(--gray-50);
  transition: var(--transition);
}

.input::placeholder {
  color: var(--gray-400);
}

.input:hover {
  border-color: var(--gray-300);
}

.input:focus {
  outline: none;
  border-color: var(--primary-500);
  background: white;
  box-shadow: 0 0 0 4px rgba(26, 115, 232, 0.1);
}

/* Premium Section */
.premium-section {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid rgba(212, 175, 55, 0.3);
}

.premium-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
}

.premium-badge {
  color: #D4AF37;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 1px;
}

.premium-subtitle {
  color: rgba(255, 255, 255, 0.6);
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
  border: 2px solid rgba(212, 175, 55, 0.3);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
}

.premium-btn:hover {
  border-color: #D4AF37;
  background: rgba(212, 175, 55, 0.1);
  transform: translateY(-2px);
}

.premium-btn.selected {
  border-color: #FFD700;
  background: rgba(212, 175, 55, 0.2);
  box-shadow: 0 0 20px rgba(212, 175, 55, 0.3);
}

.premium-tier {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 6px;
}

.premium-btn .premium-amount {
  font-size: 18px;
  font-weight: 700;
  color: #D4AF37;
  margin-bottom: 4px;
}

.premium-btn.selected .premium-amount {
  color: #FFD700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.premium-words {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

/* Regular Section */
.regular-section {
  margin-bottom: 16px;
}

.regular-label {
  display: block;
  font-size: 12px;
  color: var(--gray-500);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Preset Amounts */
.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.preset-btn {
  padding: 14px 12px;
  border: 2px solid var(--gray-200);
  border-radius: var(--radius);
  background: white;
  cursor: pointer;
  transition: var(--transition);
  text-align: center;
}

.preset-btn:hover {
  border-color: var(--primary-300);
  background: var(--primary-50);
}

.preset-btn.selected {
  border-color: var(--primary-500);
  background: var(--primary-50);
  box-shadow: 0 0 0 4px rgba(26, 115, 232, 0.1);
}

.preset-amount {
  font-size: 15px;
  font-weight: 600;
  color: var(--gray-800);
}

.preset-btn.selected .preset-amount {
  color: var(--primary-600);
}

/* Custom Amount */
.custom-amount-wrapper {
  position: relative;
}

.currency-symbol {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  font-weight: 600;
  color: var(--gray-400);
}

.custom-input {
  padding-left: 36px;
}

/* Selected Amount */
.selected-amount {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 12px 16px;
  background: var(--success-light);
  border-radius: var(--radius);
  color: var(--success);
  font-size: 14px;
}

.selected-amount.premium {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(212, 175, 55, 0.3);
  color: #D4AF37;
}

.selected-amount.premium strong {
  color: #FFD700;
}

.selected-amount.premium .premium-info {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  margin-left: 4px;
}

.selected-amount svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.selected-amount strong {
  color: #047857;
}

/* Word Selector */
.word-selector {
  background: linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%);
  border-radius: var(--radius);
  padding: 16px;
  margin-top: 16px;
  border: 1px solid rgba(212, 175, 55, 0.3);
}

.word-selector-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #D4AF37;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}

.word-selector-label svg {
  width: 18px;
  height: 18px;
  color: #FFD700;
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
  border: 2px solid rgba(212, 175, 55, 0.3);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.word-option:hover:not(.unavailable) {
  border-color: #D4AF37;
  background: rgba(212, 175, 55, 0.1);
}

.word-option.selected {
  border-color: #FFD700;
  background: rgba(212, 175, 55, 0.2);
  box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);
}

.word-option.unavailable {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: rgba(255, 255, 255, 0.1);
}

.word-star {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 4px;
}

.word-option.selected .word-star {
  color: #FFD700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.word-name {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.word-option.selected .word-name {
  color: #FFD700;
}

.word-taken {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.word-check {
  font-size: 14px;
  color: #4ade80;
  margin-top: 4px;
}

/* Messages */
.error-message {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--error-light);
  border-radius: var(--radius);
  color: var(--error);
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
  background: var(--success-light);
  border-radius: var(--radius);
  color: var(--success);
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

.btn-primary {
  flex: 1;
  background: linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(26, 115, 232, 0.3);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--primary-600) 0%, var(--primary-700) 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(26, 115, 232, 0.4);
}

.btn-primary:disabled {
  background: var(--gray-300);
  box-shadow: none;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
}

.btn-secondary:hover {
  background: var(--gray-200);
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
    grid-template-columns: repeat(2, 1fr);
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
