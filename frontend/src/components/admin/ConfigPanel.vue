<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import {
  useDonations,
  type AdminBrandingLocale,
  type AdminBrandingSettings,
  DEFAULT_ADMIN_BRANDING
} from '../../composables/useDonations';
import { useAdminI18n } from '../../composables/useAdminI18n';
import { useToast } from '../../composables/useToast';

const { t } = useAdminI18n();
const toast = useToast();

const { config, fetchConfig, updateConfig, formatAmount, isLoading, error } = useDonations();

// Local form state
const goalAmount = ref(0);
const presetAmounts = ref<number[]>([]);
const newPreset = ref('');
const segments = ref<{ id: string; thresholdPercent: number; order: number }[]>([]);
const newSegmentId = ref('');
const newSegmentThreshold = ref(0);
const brandingLocales: AdminBrandingLocale[] = ['fr', 'en', 'he'];

function cloneAdminBranding(source: AdminBrandingSettings): AdminBrandingSettings {
  return {
    fr: { ...source.fr },
    en: { ...source.en },
    he: { ...source.he }
  };
}

const adminBranding = ref<AdminBrandingSettings>(cloneAdminBranding(DEFAULT_ADMIN_BRANDING));

// Load config on mount
onMounted(async () => {
  await fetchConfig();
  syncFormWithConfig();
});

// Sync form with config changes
watch(() => config.value, () => {
  syncFormWithConfig();
}, { deep: true });

function syncFormWithConfig(): void {
  goalAmount.value = config.value.goalAmount / 100; // Convert agorot to shekels
  presetAmounts.value = [...config.value.presetAmounts];
  segments.value = [...config.value.menorahSegments];
  adminBranding.value = cloneAdminBranding(
    config.value.displaySettings.adminBranding ?? DEFAULT_ADMIN_BRANDING
  );
}

async function saveAdminBranding(): Promise<void> {
  const saved = await updateConfig({
    displaySettings: {
      ...config.value.displaySettings,
      adminBranding: cloneAdminBranding(adminBranding.value)
    }
  });
  if (saved) toast.success(t('toast.savedIdentity'));
  else toast.error(t('toast.saveFailed'));
}

// Save goal amount
async function saveGoalAmount(): Promise<void> {
  const saved = await updateConfig({
    goalAmount: Math.round(goalAmount.value * 100) // Convert shekels to agorot
  });
  if (saved) toast.success(t('toast.savedGoal'));
  else toast.error(t('toast.saveFailed'));
}

// Add preset amount
function addPreset(): void {
  const amount = parseFloat(newPreset.value);
  if (!isNaN(amount) && amount > 0) {
    const cents = Math.round(amount * 100);
    if (!presetAmounts.value.includes(cents)) {
      presetAmounts.value.push(cents);
      presetAmounts.value.sort((a, b) => a - b);
      newPreset.value = '';
    }
  }
}

// Remove preset amount
function removePreset(amount: number): void {
  presetAmounts.value = presetAmounts.value.filter(a => a !== amount);
}

// Save preset amounts
async function savePresets(): Promise<void> {
  const saved = await updateConfig({ presetAmounts: presetAmounts.value });
  if (saved) toast.success(t('toast.savedPresets'));
  else toast.error(t('toast.saveFailed'));
}

// Add segment
function addSegment(): void {
  if (!newSegmentId.value || newSegmentThreshold.value < 0 || newSegmentThreshold.value > 100) {
    return;
  }

  const nextOrder = segments.value.length > 0
    ? Math.max(...segments.value.map(s => s.order)) + 1
    : 1;

  segments.value.push({
    id: newSegmentId.value,
    thresholdPercent: newSegmentThreshold.value,
    order: nextOrder
  });

  newSegmentId.value = '';
  newSegmentThreshold.value = 0;
}

// Remove segment
function removeSegment(id: string): void {
  segments.value = segments.value.filter(s => s.id !== id);
}

// Save segments
async function saveSegments(): Promise<void> {
  const saved = await updateConfig({ menorahSegments: segments.value });
  if (saved) toast.success(t('toast.savedSegments'));
  else toast.error(t('toast.saveFailed'));
}
</script>

<template>
  <div class="config-panel">
    <h3>{{ t('config.title') }}</h3>

    <p v-if="error" class="error">{{ error }}</p>

    <!-- Administration identity -->
    <div class="config-section branding-section">
      <h4>{{ t('config.adminIdentity') }}</h4>
      <p class="hint branding-hint">{{ t('config.adminIdentityDescription') }}</p>

      <div class="branding-grid">
        <fieldset
          v-for="brandingLocale in brandingLocales"
          :key="brandingLocale"
          class="branding-card"
          :dir="brandingLocale === 'he' ? 'rtl' : 'ltr'"
        >
          <legend>{{ t(`language.${brandingLocale}`) }}</legend>

          <label class="branding-field">
            <span>{{ t('config.adminTitle') }}</span>
            <input
              v-model="adminBranding[brandingLocale].title"
              type="text"
              maxlength="80"
              dir="auto"
            />
          </label>

          <label class="branding-field">
            <span>{{ t('config.adminSubtitle') }}</span>
            <input
              v-model="adminBranding[brandingLocale].subtitle"
              type="text"
              maxlength="160"
              dir="auto"
            />
          </label>
        </fieldset>
      </div>

      <button @click="saveAdminBranding" :disabled="isLoading" class="save-btn">
        {{ isLoading ? t('common.saving') : t('config.saveAdminIdentity') }}
      </button>
    </div>

    <!-- Goal Amount -->
    <div class="config-section">
      <h4>{{ t('config.goal') }}</h4>
      <div class="input-group">
        <input
          type="number"
          v-model="goalAmount"
          min="1"
          step="100"
          :placeholder="t('config.goalPlaceholder')"
        />
        <span class="suffix">₪</span>
        <button @click="saveGoalAmount" :disabled="isLoading">
          {{ isLoading ? t('common.saving') : t('common.save') }}
        </button>
      </div>
      <p class="hint">{{ t('config.currentGoal', { amount: formatAmount(config.goalAmount) }) }}</p>
    </div>

    <!-- Preset Amounts -->
    <div class="config-section">
      <h4>{{ t('config.presets') }}</h4>
      <div class="preset-list">
        <span
          v-for="amount in presetAmounts"
          :key="amount"
          class="preset-tag"
        >
          {{ formatAmount(amount) }}
          <button @click="removePreset(amount)" class="remove-btn">×</button>
        </span>
      </div>
      <div class="input-group">
        <input
          type="number"
          v-model="newPreset"
          min="0.01"
          step="0.01"
          :placeholder="t('config.newPreset')"
          @keyup.enter="addPreset"
        />
        <button @click="addPreset">{{ t('common.add') }}</button>
      </div>
      <button @click="savePresets" :disabled="isLoading" class="save-btn">
        {{ t('config.savePresets') }}
      </button>
    </div>

    <!-- Menorah Segments -->
    <div class="config-section">
      <h4>{{ t('config.menorahSegments') }}</h4>
      <p class="hint">
        {{ t('config.segmentsHint') }}
      </p>

      <table v-if="segments.length > 0" class="segments-table">
        <thead>
          <tr>
            <th>{{ t('config.segmentId') }}</th>
            <th>{{ t('config.threshold') }}</th>
            <th>{{ t('config.order') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="segment in segments" :key="segment.id">
            <td>{{ segment.id }}</td>
            <td>{{ segment.thresholdPercent }}%</td>
            <td>{{ segment.order }}</td>
            <td>
              <button @click="removeSegment(segment.id)" class="remove-btn">×</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="segment-form">
        <input
          type="text"
          v-model="newSegmentId"
          :placeholder="t('config.segmentIdPlaceholder')"
        />
        <input
          type="number"
          v-model="newSegmentThreshold"
          min="0"
          max="100"
          :placeholder="t('config.thresholdPlaceholder')"
        />
        <button @click="addSegment">{{ t('common.add') }}</button>
      </div>
      <button @click="saveSegments" :disabled="isLoading" class="save-btn">
        {{ t('config.saveSegments') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.config-panel {
  background: var(--shell-card);
  /* Le panneau ne declarait aucun color : les cellules du tableau des segments
     heritaient de body { color: var(--gray-800) }, invisible sur navy. */
  color: var(--shell-text); /* 11.71 sur la carte */
  padding: 20px;
  /* L'ombre portee ne dessine plus rien sur du navy : la bordure fait le bord. */
  border: 1px solid var(--shell-border);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h3 {
  margin: 0 0 20px;
  color: var(--shell-text-strong); /* 15.03 sur la carte */
}

h4 {
  margin: 0 0 12px;
  color: var(--shell-text); /* 11.71 sur la carte */
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.config-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--shell-border);
}

.config-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.input-group {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.input-group input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--field-border);
  border-radius: 4px;
  /* Champ volontairement CLAIR, et declare explicitement : sans background ni
     color le rendu dependait du defaut du navigateur sur carte sombre. */
  background: var(--field-bg);
  color: var(--field-text); /* 15.87 sur le champ */
  font-size: 14px;
}

/* Tous les champs du panneau sont clairs : un seul placeholder mesure. */
.config-panel input::placeholder {
  color: var(--field-placeholder); /* 4.73 sur le champ */
}

.input-group .suffix {
  color: var(--shell-text); /* 11.71 sur la carte */
}

/* Aplat or plein : reserve aux quatre validations (identite, objectif,
   montants, segments). L'or en aplat porte du texte sombre, jamais blanc. */
.input-group button,
.save-btn {
  padding: 8px 16px;
  background: var(--shell-accent-flat);
  color: var(--shell-on-accent); /* 10.68 sur l'or */
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.input-group button:hover:not(:disabled),
.save-btn:hover:not(:disabled) {
  background: var(--shell-accent-flat-strong); /* or plus clair au survol, 10.58 avec on-accent */
}

.input-group button:disabled,
.save-btn:disabled {
  background: var(--shell-raised);
  /* --shell-on-accent sur --shell-raised serait deux fois du navy : illisible. */
  color: var(--shell-text-muted); /* 4.53 sur --shell-raised */
  /* Anneau INTERIEUR, pas une bordure : la regle de base pose border: none, et
     ces quatre boutons passent en :disabled a chaque sauvegarde. Sans anneau, la
     surface ne vaut que 1.15 contre la carte et le bouton pleine largeur se
     dissout : on lit « le bouton a disparu » au lieu de « le bouton travaille ».
     Un box-shadow inset ne fait pas grandir la boite, donc aucun saut de mise en
     page au changement d'etat. Compose #595E7D, 2.30 contre --shell-raised. */
  box-shadow: inset 0 0 0 1px var(--shell-border-strong);
  cursor: not-allowed;
}

/* Bouton SECONDAIRE : 'Ajouter' un montant ne concourt pas avec l'aplat or de
   la validation (un seul aplat or par panneau). Il descend en contour, sans
   changer ni sa largeur ni sa position. */
.preset-list + .input-group button {
  background: var(--shell-raised);
  border: 1px solid var(--shell-border-strong);
  color: var(--shell-accent); /* 8.19 sur --shell-raised */
}

.preset-list + .input-group button:hover:not(:disabled) {
  /* 0.20 et non 0.12, et la bordure change aussi. A 0.12 le survol composait
     #2F2F3F, soit 1.11 d'ecart avec le repos — moins que les 1.54 du bleu
     d'origine — et il tombait EXACTEMENT sur la couleur des pastilles de
     montant voisines : survoler le bouton le faisait ressembler a une etiquette.
     Le 0.12 n'etait contraint que par le rouge du « × » des pastilles, contrainte
     qui ne s'applique pas ici. A 0.20 : compose #3F3C42, or a 6.12, ecart 1.34 ;
     et la bordure passe de #595E7D a l'or franc, 3.57 d'ecart entre les etats. */
  background: rgba(228, 190, 99, 0.20);
  border-color: var(--shell-accent);
}

.save-btn {
  margin-top: 12px;
  width: 100%;
}

/* Ecart declare a la table de correspondances : #666 y vise --shell-text, mais
   une indication et un en-tete de colonne SONT des mentions secondaires, donc
   --shell-text-muted. La hierarchie perceptive d'origine est mieux conservee
   ainsi (#666 valait 5.74 sur blanc ; muted vaut 5.19 sur la carte). */
.hint {
  font-size: 12px;
  color: var(--shell-text-muted); /* 5.19 sur la carte */
  margin: 4px 0;
}

.branding-hint {
  margin-bottom: 16px;
}

.branding-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.branding-card {
  min-width: 0;
  margin: 0;
  padding: 14px;
  border: 1px solid var(--shell-border);
  border-radius: 10px;
  /* Creux dans la carte, comme --gray-50 l'etait dans le blanc. */
  background: var(--shell-page);
}

.branding-card legend {
  padding-inline: 6px;
  /* Texte or : ce n'est pas une action, donc pas d'aplat (arbitrage A). */
  color: var(--shell-accent); /* 10.68 sur le creux */
  font-size: 13px;
  font-weight: 700;
}

.branding-field {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
  color: var(--shell-text); /* 13.31 sur le creux */
  font-size: 12px;
  font-weight: 600;
  text-align: start;
}

.branding-field:last-child {
  margin-bottom: 0;
}

.branding-field input {
  width: 100%;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--field-border);
  border-radius: 6px;
  background: var(--field-bg);
  color: var(--field-text); /* 15.87 sur le champ */
  font: inherit;
  font-weight: 500;
  box-sizing: border-box;
}

.branding-field input:focus {
  border-color: var(--field-border-focus);
  /* Le halo est le vrai indicateur de focus : il doit atteindre 3.0 contre le
     creux. A 0.32 il ne mesurait que 2.09, a 0.55 il mesure 3.92. */
  outline: 3px solid rgba(228, 190, 99, 0.55); /* compose #827045 ; 3.92 sur le creux */
}

.error {
  color: var(--shell-error); /* 6.02 sur la carte */
  margin-bottom: 16px;
}

.preset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.preset-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  /* Voile or plutot qu'un aplat : la pastille est de l'information, pas une
     action. A 0.14 le survol rouge du '×' tombait a 4.50, sous le seuil ;
     a 0.12 il mesure 4.75 et la pastille se detache toujours (1.27). */
  background: rgba(228, 190, 99, 0.12); /* compose #2F2F3F */
  color: var(--shell-accent); /* 7.41 sur la pastille */
  border-radius: 16px;
  font-size: 13px;
}

.remove-btn {
  background: none;
  border: none;
  /* --shell-text-muted, l'equivalent de #999, ne mesure que 4.09 sur la
     pastille : le '×' monte donc a --shell-text. */
  color: var(--shell-text); /* 9.23 sur la pastille, 11.71 sur la carte */
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
  line-height: 1;
}

.remove-btn:hover {
  color: var(--shell-error); /* 4.75 sur la pastille, 6.02 sur la carte */
}

.segments-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
  font-size: 13px;
}

.segments-table th,
.segments-table td {
  padding: 8px;
  text-align: start;
  border-bottom: 1px solid var(--shell-border);
}

.segments-table th {
  color: var(--shell-text-muted); /* 5.19 sur la carte */
  font-weight: 500;
}

.segment-form {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.segment-form input {
  padding: 8px;
  border: 1px solid var(--field-border);
  border-radius: 4px;
  background: var(--field-bg);
  color: var(--field-text); /* 15.87 sur le champ */
  font-size: 13px;
}

.segment-form input:first-child {
  flex: 2;
}

.segment-form input:nth-child(2) {
  flex: 1;
  width: 80px;
}

/* Second bouton SECONDAIRE du panneau : 'Ajouter' un segment. Contour, pas
   d'aplat or, pour laisser la validation pleine largeur dominer. */
.segment-form button {
  padding: 8px 12px;
  background: var(--shell-raised);
  color: var(--shell-accent); /* 8.19 sur --shell-raised */
  border: 1px solid var(--shell-border-strong);
  border-radius: 4px;
  cursor: pointer;
}

.segment-form button:hover {
  /* Meme correction que le bouton « Ajouter un montant » : voir le commentaire
     de .preset-list + .input-group button:hover. */
  background: rgba(228, 190, 99, 0.20); /* compose #3F3C42 ; or a 6.12 */
  border-color: var(--shell-accent);
}

@media (max-width: 900px) {
  .branding-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .config-panel {
    padding: 16px;
  }

  .input-group,
  .segment-form {
    align-items: stretch;
    flex-direction: column;
  }

  .segment-form input:nth-child(2) {
    width: auto;
  }
}
</style>
