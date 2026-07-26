<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useAudioPreview } from '../../composables/useAudioPreview';
import { useToast } from '../../composables/useToast';
import {
  useDonations,
  type DisplaySettings,
  type DisplayThemeId,
  type DisplayVisualMode,
  type DonationAnimationStyle,
  type DisplayTextDirection,
  DEFAULT_DISPLAY_SETTINGS
} from '../../composables/useDonations';
import {
  DISPLAY_THEMES,
  cloneDisplaySettings,
  resetThemePalette
} from '../../theme/displayThemes';
import { useAdminI18n } from '../../composables/useAdminI18n';
import { adminFetch } from '../../composables/useAdminAuth';

const { t } = useAdminI18n();

const { config, fetchConfig, updateConfig, isLoading, error } = useDonations();
const API_BASE = import.meta.env.VITE_API_URL || '';

// Local form state
const settings = ref<DisplaySettings>(cloneDisplaySettings(DEFAULT_DISPLAY_SETTINGS));
const isUploading = ref(false);
const uploadError = ref('');
const isUploadingVisual = ref(false);
const visualUploadError = ref('');
const activePalette = computed(() => settings.value.themePalettes[settings.value.theme]);

const directionOptions = computed<{ id: DisplayTextDirection; label: string; description: string }[]>(() => [
  { id: 'auto', label: t('display.direction.auto.name'), description: t('display.direction.auto.description') },
  { id: 'ltr', label: t('display.direction.ltr.name'), description: t('display.direction.ltr.description') },
  { id: 'rtl', label: t('display.direction.rtl.name'), description: t('display.direction.rtl.description') }
]);

const animationOptions = computed<{ id: DonationAnimationStyle; label: string; description: string }[]>(() => [
  { id: 'prestige', label: t('display.animation.prestige.name'), description: t('display.animation.prestige.description') },
  { id: 'confetti', label: t('display.animation.confetti.name'), description: t('display.animation.confetti.description') },
  { id: 'ribbons', label: t('display.animation.ribbons.name'), description: t('display.animation.ribbons.description') },
  { id: 'minimal', label: t('display.animation.minimal.name'), description: t('display.animation.minimal.description') }
]);

function themeText(themeId: DisplayThemeId, field: 'name' | 'short' | 'description' | 'mood'): string {
  return t(`display.theme.${themeId}.${field}`);
}

// Load settings on mount
onMounted(async () => {
  await fetchConfig();
  syncSettings();
});

const toast = useToast();

// Empreinte du dernier etat enregistre, pour savoir si la saisie en cours
// differe de ce qui est reellement en base.
const savedSnapshot = ref('');

// Vrai si des modifications sont en attente d'enregistrement.
const isDirty = computed(() => JSON.stringify(settings.value) !== savedSnapshot.value);

// Vrai si la config a change ailleurs (autre onglet, autre poste) pendant
// qu'on editait : on ne recharge pas de force, on propose.
const hasRemoteChange = ref(false);

// Sync with config changes
watch(() => config.value.displaySettings, () => {
  // Avant, un evenement socket ecrasait silencieusement la saisie en cours.
  if (isDirty.value) {
    hasRemoteChange.value = true;
    return;
  }
  syncSettings();
}, { deep: true });

function syncSettings(): void {
  if (config.value.displaySettings) {
    settings.value = cloneDisplaySettings(config.value.displaySettings);
    savedSnapshot.value = JSON.stringify(settings.value);
    hasRemoteChange.value = false;
  }
}

// Abandonne les modifications locales et reprend l'etat enregistre.
function discardChanges(): void {
  syncSettings();
}

// Save all settings
async function saveSettings(): Promise<void> {
  settings.value = {
    ...settings.value,
    ...activePalette.value
  };
  const saved = await updateConfig({ displaySettings: settings.value });

  if (saved) {
    savedSnapshot.value = JSON.stringify(settings.value);
    hasRemoteChange.value = false;
    toast.success(t('toast.savedDisplay'));
  } else {
    toast.error(t('toast.saveFailed'));
  }
}

// Reset to defaults
function resetDefaults(): void {
  // Ce bouton efface TOUT : textes, couleurs, sons, page /don. Il etait
  // juste a cote de « Restaurer ce theme », qui a une portee bien plus
  // etroite — d'ou la confirmation explicite.
  if (!confirm(t('display.resetConfirm'))) return;
  settings.value = cloneDisplaySettings(DEFAULT_DISPLAY_SETTINGS);
}

function selectTheme(themeId: DisplayThemeId): void {
  settings.value.theme = themeId;
}

function resetActiveTheme(): void {
  settings.value = resetThemePalette(settings.value, settings.value.theme);
}

function selectVisualMode(mode: DisplayVisualMode): void {
  settings.value.visualMode = mode;
}

function selectTextDirection(direction: DisplayTextDirection): void {
  settings.value.textDirection = direction;
}

function selectDonationAnimation(animation: DonationAnimationStyle): void {
  settings.value.donationAnimation = animation;
}

// Locale being edited in the public pledge page section
const pledgeLocale = ref<'fr' | 'en' | 'he'>('fr');
const PLEDGE_LOCALE_TABS = [
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
  { id: 'he', label: 'עברית' }
] as const;

// Toggles: which /don fields are required. The amount is always required and is
// therefore not listed here.
const PLEDGE_FIELD_TOGGLES = [
  { id: 'firstName', labelKey: 'pledge.fieldFirstName' },
  { id: 'lastName', labelKey: 'pledge.fieldLastName' },
  { id: 'phone', labelKey: 'pledge.fieldPhone' },
  { id: 'email', labelKey: 'pledge.fieldEmail' }
] as const;

async function uploadCustomSvg(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

  isUploadingVisual.value = true;
  visualUploadError.value = '';

  const formData = new FormData();
  formData.append('visual', input.files[0]);

  try {
    const response = await adminFetch(`${API_BASE}/api/gifs/upload-svg`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || t('display.visual.svgUploadFailed'));
    }

    settings.value.customSvgUrl = result.url;
    settings.value.visualMode = 'custom';
    input.value = '';
  } catch (uploadFailure) {
    visualUploadError.value = uploadFailure instanceof Error
      ? uploadFailure.message
      : t('display.visual.svgUploadFailed');
  } finally {
    isUploadingVisual.value = false;
  }
}

function removeCustomSvg(): void {
  settings.value.customSvgUrl = null;
  settings.value.visualMode = 'none';
}

function themePreviewStyle(themeId: DisplayThemeId): Record<string, string> {
  const palette = settings.value.themePalettes[themeId];
  return {
    '--preview-bg': palette.backgroundColor,
    '--preview-primary': palette.chartPrimaryColor,
    '--preview-secondary': palette.chartSecondaryColor,
    '--preview-text': palette.statsTextColor,
    '--preview-plate': palette.plateColorBronze
  };
}

// Upload background image
async function uploadBackgroundImage(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

  isUploading.value = true;
  uploadError.value = '';

  const formData = new FormData();
  formData.append('gif', input.files[0]);

  try {
    const response = await adminFetch(`${API_BASE}/api/gifs/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || t('display.background.uploadFailed'));
    }

    const result = await response.json();
    activePalette.value.backgroundImage = result.url;
    input.value = '';
  } catch (error: any) {
    uploadError.value = error.message || t('display.background.uploadFailed');
  } finally {
    isUploading.value = false;
  }
}

// Remove background image
function removeBackgroundImage(): void {
  activePalette.value.backgroundImage = null;
}

// Upload donation sound
const isUploadingSound = ref(false);
const soundUploadError = ref('');

async function uploadDonationSound(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

  isUploadingSound.value = true;
  soundUploadError.value = '';

  const formData = new FormData();
  formData.append('audio', input.files[0]);

  try {
    const response = await adminFetch(`${API_BASE}/api/gifs/upload-audio`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || t('display.sound.uploadFailed'));
    }

    const result = await response.json();
    settings.value.donationSound = result.url;
    input.value = '';
  } catch (error: any) {
    soundUploadError.value = error.message || t('display.sound.uploadFailed');
  } finally {
    isUploadingSound.value = false;
  }
}

// Remove donation sound
function removeDonationSound(): void {
  settings.value.donationSound = null;
}

// Lecture partagee avec le reste du panel : un seul son a la fois,
// re-cliquer arrete. Voir composables/useAudioPreview.ts.
const { toggle: toggleAudio, stop: stopAudio, isPlaying } = useAudioPreview();

// Sans ceci, quitter l'onglet laissait le son tourner indefiniment.
onUnmounted(stopAudio);
</script>

<template>
  <div class="display-settings-panel">
    <div class="card">
      <h2 class="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        {{ t('display.title') }}
      </h2>

      <p v-if="error" class="error-msg">{{ error }}</p>

      <!-- Scene composition -->
      <section class="settings-section visual-section">
        <div class="section-heading-row">
          <div>
            <h3>{{ t('display.visual.title') }}</h3>
            <p class="section-description visual-description">
              {{ t('display.visual.description') }}
            </p>
          </div>
        </div>

        <div class="visual-mode-grid" role="radiogroup" :aria-label="t('display.visual.aria')">
          <button
            type="button"
            class="visual-mode-card"
            :class="{ selected: settings.visualMode === 'none' }"
            :aria-pressed="settings.visualMode === 'none'"
            @click="selectVisualMode('none')"
          >
            <span class="visual-mode-preview donor-only-preview" aria-hidden="true">
              <span></span><span></span><span></span><span></span>
            </span>
            <span class="visual-mode-copy">
              <strong>{{ t('display.visual.none.name') }}</strong>
              <small>{{ t('display.visual.none.description') }}</small>
            </span>
            <span v-if="settings.visualMode === 'none'" class="selected-badge">{{ t('common.active') }}</span>
          </button>

          <button
            type="button"
            class="visual-mode-card"
            :class="{ selected: settings.visualMode === 'menorah' }"
            :aria-pressed="settings.visualMode === 'menorah'"
            @click="selectVisualMode('menorah')"
          >
            <span class="visual-mode-preview menorah-preview" aria-hidden="true">
              <span class="menorah-stem"></span>
              <span class="menorah-arm arm-one"></span>
              <span class="menorah-arm arm-two"></span>
              <span class="menorah-arm arm-three"></span>
            </span>
            <span class="visual-mode-copy">
              <strong>{{ t('display.visual.menorah.name') }}</strong>
              <small>{{ t('display.visual.menorah.description') }}</small>
            </span>
            <span v-if="settings.visualMode === 'menorah'" class="selected-badge">{{ t('common.active') }}</span>
          </button>

          <button
            type="button"
            class="visual-mode-card"
            :class="{ selected: settings.visualMode === 'custom' }"
            :aria-pressed="settings.visualMode === 'custom'"
            @click="selectVisualMode('custom')"
          >
            <span class="visual-mode-preview custom-preview" aria-hidden="true">
              <img v-if="settings.customSvgUrl" :src="settings.customSvgUrl" alt="" />
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M7 15l3-3 2.5 2.5L15 12l3 3" />
                <circle cx="9" cy="8" r="1.5" />
              </svg>
            </span>
            <span class="visual-mode-copy">
              <strong>{{ t('display.visual.custom.name') }}</strong>
              <small>{{ t('display.visual.custom.description') }}</small>
            </span>
            <span v-if="settings.visualMode === 'custom'" class="selected-badge">{{ t('common.active') }}</span>
          </button>
        </div>

        <div v-if="settings.visualMode === 'custom'" class="custom-svg-panel">
          <div v-if="settings.customSvgUrl" class="custom-svg-current">
            <img :src="settings.customSvgUrl" :alt="t('display.visual.svgAlt')" />
            <div>
              <strong>{{ t('display.visual.svgReady') }}</strong>
              <button type="button" class="remove-svg-btn" @click="removeCustomSvg">{{ t('common.remove') }}</button>
            </div>
          </div>

          <label class="upload-btn" :class="{ uploading: isUploadingVisual }">
            <input
              type="file"
              accept="image/svg+xml,.svg"
              :disabled="isUploadingVisual"
              @change="uploadCustomSvg"
            />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {{ isUploadingVisual ? t('common.uploading') : (settings.customSvgUrl ? t('display.visual.replaceSvg') : t('display.visual.chooseSvg')) }}
          </label>
          <p class="svg-help">{{ t('display.visual.svgHelp') }}</p>
          <p v-if="visualUploadError" class="upload-error">{{ visualUploadError }}</p>
        </div>
      </section>

      <!-- Customizable copy and language direction -->
      <section class="settings-section content-settings-section">
        <div class="section-heading-row">
          <div>
            <h3>{{ t('display.content.title') }}</h3>
            <p class="section-description content-description">
              {{ t('display.content.description') }}
            </p>
          </div>
        </div>

        <div class="direction-grid" role="radiogroup" :aria-label="t('display.direction.aria')">
          <button
            v-for="option in directionOptions"
            :key="option.id"
            type="button"
            class="direction-card"
            :class="{ selected: settings.textDirection === option.id }"
            :aria-pressed="settings.textDirection === option.id"
            @click="selectTextDirection(option.id)"
          >
            <strong :dir="option.id === 'rtl' ? 'rtl' : 'ltr'">{{ option.label }}</strong>
            <small>{{ option.description }}</small>
          </button>
        </div>

        <div class="copy-group">
          <h4>{{ t('display.copy.headerGroup') }}</h4>
          <div class="copy-grid">
            <label class="copy-field">
              <span>{{ t('display.copy.eventTitle') }}</span>
              <input v-model="settings.texts.eventTitle" type="text" maxlength="100" dir="auto" />
            </label>
            <label class="copy-field">
              <span>{{ t('display.copy.organizationName') }}</span>
              <input v-model="settings.texts.organizationName" type="text" maxlength="100" dir="auto" />
            </label>
            <label class="copy-field">
              <span>{{ t('display.copy.browserTitle') }}</span>
              <input v-model="settings.texts.browserTitle" type="text" maxlength="100" dir="auto" />
            </label>
            <label class="copy-field">
              <span>{{ t('display.copy.boardKicker') }}</span>
              <input v-model="settings.texts.boardKicker" type="text" maxlength="100" dir="auto" />
            </label>
            <label class="copy-field">
              <span>{{ t('display.copy.boardTitle') }}</span>
              <input v-model="settings.texts.boardTitle" type="text" maxlength="100" dir="auto" />
            </label>
          </div>
        </div>

        <div class="copy-group">
          <h4>{{ t('display.copy.liveGroup') }}</h4>
          <div class="copy-grid three-columns">
            <label class="copy-field">
              <span>{{ t('display.copy.liveLabel') }}</span>
              <input v-model="settings.texts.liveLabel" type="text" maxlength="100" dir="auto" />
            </label>
            <label class="copy-field">
              <span>{{ t('display.copy.reconnectingLabel') }}</span>
              <input v-model="settings.texts.reconnectingLabel" type="text" maxlength="100" dir="auto" />
            </label>
            <label class="copy-field">
              <span>{{ t('display.copy.goalLabel') }}</span>
              <input v-model="settings.texts.goalLabel" type="text" maxlength="100" dir="auto" />
            </label>
            <label class="copy-field">
              <span>{{ t('display.copy.donorSingular') }}</span>
              <input v-model="settings.texts.donorSingular" type="text" maxlength="100" dir="auto" />
            </label>
            <label class="copy-field">
              <span>{{ t('display.copy.donorPlural') }}</span>
              <input v-model="settings.texts.donorPlural" type="text" maxlength="100" dir="auto" />
            </label>
            <label class="copy-field">
              <span>{{ t('display.copy.donationSingular') }}</span>
              <input v-model="settings.texts.donationSingular" type="text" maxlength="100" dir="auto" />
            </label>
            <label class="copy-field">
              <span>{{ t('display.copy.donationPlural') }}</span>
              <input v-model="settings.texts.donationPlural" type="text" maxlength="100" dir="auto" />
            </label>
          </div>
        </div>

        <div class="copy-group thanks-copy-group">
          <h4>{{ t('display.copy.thanksGroup') }}</h4>
          <div class="copy-grid">
            <label class="copy-field">
              <span>{{ t('display.copy.thankYouTitle') }}</span>
              <input v-model="settings.texts.thankYouTitle" type="text" maxlength="100" dir="auto" />
            </label>
            <label class="copy-field wide">
              <span>{{ t('display.copy.thankYouMessage') }}</span>
              <textarea v-model="settings.texts.thankYouMessage" maxlength="240" rows="3" dir="auto"></textarea>
            </label>
          </div>
        </div>
      </section>

      <!-- Public pledge page (/don) texts -->
      <section class="settings-section">
        <div class="section-heading-row">
          <div>
            <h3>{{ t('pledge.sectionTitle') }}</h3>
            <p class="section-description content-description">
              {{ t('pledge.sectionDescription') }}
            </p>
          </div>
          <a
            v-if="!isDirty"
            class="pledge-open-link"
            href="/don"
            target="_blank"
            rel="noopener"
          >
            {{ t('pledge.openPage') }} ↗
          </a>
          <span v-else class="pledge-open-link disabled" :title="t('display.saveBeforePreview')">
            {{ t('display.saveBeforePreview') }}
          </span>
        </div>

        <div class="copy-group">
          <h4>{{ t('pledge.langLabel') }}</h4>
          <div class="pledge-locale-tabs" role="tablist">
            <button
              v-for="tab in PLEDGE_LOCALE_TABS"
              :key="tab.id"
              type="button"
              class="pledge-locale-tab"
              :class="{ selected: pledgeLocale === tab.id }"
              :aria-pressed="pledgeLocale === tab.id"
              @click="pledgeLocale = tab.id"
            >
              {{ tab.label }}
            </button>
          </div>

          <div class="copy-grid" :key="pledgeLocale">
            <label class="copy-field">
              <span>{{ t('pledge.kicker') }}</span>
              <input v-model="settings.pledgeTexts[pledgeLocale].kicker" type="text" maxlength="120" dir="auto" />
            </label>
            <label class="copy-field">
              <span>{{ t('pledge.title') }}</span>
              <input v-model="settings.pledgeTexts[pledgeLocale].title" type="text" maxlength="120" dir="auto" />
            </label>
            <label class="copy-field wide">
              <span>{{ t('pledge.subtitle') }}</span>
              <textarea v-model="settings.pledgeTexts[pledgeLocale].subtitle" maxlength="300" rows="3" dir="auto"></textarea>
            </label>
            <label class="copy-field">
              <span>{{ t('pledge.thankTitle') }}</span>
              <input v-model="settings.pledgeTexts[pledgeLocale].thankTitle" type="text" maxlength="120" dir="auto" />
            </label>
            <label class="copy-field wide">
              <span>{{ t('pledge.thankMessage') }}</span>
              <textarea v-model="settings.pledgeTexts[pledgeLocale].thankMessage" maxlength="300" rows="3" dir="auto"></textarea>
            </label>
          </div>
        </div>

        <div class="copy-group">
          <h4>{{ t('pledge.fieldsTitle') }}</h4>
          <p class="section-description content-description">{{ t('pledge.fieldsDescription') }}</p>
          <div class="pledge-fields-grid">
            <label
              v-for="field in PLEDGE_FIELD_TOGGLES"
              :key="field.id"
              class="pledge-field-toggle"
            >
              <input type="checkbox" v-model="settings.pledgeRequiredFields[field.id]" />
              <span class="pledge-field-name">{{ t(field.labelKey) }}</span>
              <span class="pledge-field-state">
                {{ settings.pledgeRequiredFields[field.id] ? t('pledge.fieldRequired') : t('pledge.fieldOptional') }}
              </span>
            </label>
          </div>
        </div>
      </section>

      <!-- Donation animation selection -->
      <section class="settings-section animation-settings-section">
        <div class="section-heading-row">
          <div>
            <h3>{{ t('display.animation.title') }}</h3>
            <p class="section-description content-description">
              {{ t('display.animation.description') }}
            </p>
          </div>
        </div>

        <div class="animation-grid" role="radiogroup" :aria-label="t('display.animation.aria')">
          <button
            v-for="option in animationOptions"
            :key="option.id"
            type="button"
            class="animation-card"
            :class="[{ selected: settings.donationAnimation === option.id }, `animation-${option.id}`]"
            :aria-pressed="settings.donationAnimation === option.id"
            @click="selectDonationAnimation(option.id)"
          >
            <span class="animation-preview" aria-hidden="true">
              <i v-for="i in 8" :key="i"></i>
              <b></b>
            </span>
            <span class="animation-card-copy">
              <strong>{{ option.label }}</strong>
              <small>{{ option.description }}</small>
            </span>
            <span v-if="settings.donationAnimation === option.id" class="selected-badge">{{ t('common.active') }}</span>
          </button>
        </div>
      </section>

      <!-- Theme selection -->
      <section class="settings-section theme-section">
        <div class="section-heading-row">
          <div>
            <h3>{{ t('display.theme.title') }}</h3>
            <p class="section-description theme-description">
              {{ t('display.theme.description') }}
            </p>
          </div>
          <a
            v-if="!isDirty"
            href="/display"
            target="_blank"
            rel="noopener"
            class="preview-link"
          >{{ t('display.theme.preview') }}</a>
          <span v-else class="preview-link disabled" :title="t('display.saveBeforePreview')">
            {{ t('display.saveBeforePreview') }}
          </span>
        </div>

        <div class="theme-grid" role="radiogroup" :aria-label="t('display.theme.aria')">
          <button
            v-for="theme in DISPLAY_THEMES"
            :key="theme.id"
            type="button"
            class="theme-card"
            :class="{ selected: settings.theme === theme.id }"
            :aria-pressed="settings.theme === theme.id"
            :style="themePreviewStyle(theme.id)"
            @click="selectTheme(theme.id)"
          >
            <span class="theme-preview" aria-hidden="true">
              <span class="preview-orb"></span>
              <span class="preview-content">
                <span class="preview-title"></span>
                <span class="preview-progress"></span>
                <span class="preview-plate"></span>
                <span class="preview-plate short"></span>
              </span>
            </span>
            <span class="theme-card-copy">
              <span class="theme-card-title">
                {{ themeText(theme.id, 'name') }}
                <span v-if="settings.theme === theme.id" class="selected-badge">{{ t('common.active') }}</span>
              </span>
              <span class="theme-card-description">{{ themeText(theme.id, 'description') }}</span>
              <span class="theme-mood">{{ themeText(theme.id, 'mood') }}</span>
            </span>
          </button>
        </div>

        <div class="active-theme-bar">
          <span>{{ t('display.theme.customizing', { theme: themeText(settings.theme, 'name') }) }}</span>
          <button type="button" class="reset-theme-btn" @click="resetActiveTheme">
            {{ t('display.theme.restore') }}
          </button>
        </div>
      </section>

      <!-- Background Section -->
      <section class="settings-section">
        <h3>{{ t('display.background.title', { theme: themeText(settings.theme, 'short') }) }}</h3>

        <div class="color-row">
          <label>{{ t('display.background.color') }}</label>
          <div class="color-input-group">
            <input type="color" v-model="activePalette.backgroundColor" />
            <input type="text" v-model="activePalette.backgroundColor" class="hex-input" />
          </div>
        </div>

        <div class="image-upload-row">
          <label>{{ t('display.background.image') }}</label>
          <div class="image-preview" v-if="activePalette.backgroundImage">
            <img :src="activePalette.backgroundImage" :alt="t('display.background.previewAlt')" />
            <button class="remove-image-btn" :aria-label="t('common.remove')" @click="removeBackgroundImage">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <label class="upload-btn" :class="{ uploading: isUploading }">
            <input type="file" accept="image/*" @change="uploadBackgroundImage" :disabled="isUploading" />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {{ isUploading ? t('common.uploading') : t('display.background.choose') }}
          </label>
          <p v-if="uploadError" class="upload-error">{{ uploadError }}</p>
        </div>
      </section>

      <!-- Plate Colors Section -->
      <section class="settings-section">
        <h3>{{ t('display.plates.title') }}</h3>

        <div class="color-row">
          <label>
            <span class="color-badge" :style="{ background: activePalette.plateColorGold }"></span>
            {{ t('display.plates.gold') }}
          </label>
          <div class="color-input-group">
            <input type="color" v-model="activePalette.plateColorGold" />
            <input type="text" v-model="activePalette.plateColorGold" class="hex-input" />
          </div>
        </div>

        <div class="color-row">
          <label>
            <span class="color-badge" :style="{ background: activePalette.plateColorDiamond }"></span>
            {{ t('display.plates.diamond') }}
          </label>
          <div class="color-input-group">
            <input type="color" v-model="activePalette.plateColorDiamond" />
            <input type="text" v-model="activePalette.plateColorDiamond" class="hex-input" />
          </div>
        </div>

        <div class="color-row">
          <label>
            <span class="color-badge" :style="{ background: activePalette.plateColorBronze }"></span>
            {{ t('display.plates.bronze') }}
          </label>
          <div class="color-input-group">
            <input type="color" v-model="activePalette.plateColorBronze" />
            <input type="text" v-model="activePalette.plateColorBronze" class="hex-input" />
          </div>
        </div>

        <div class="color-row">
          <label>{{ t('display.plates.text') }}</label>
          <div class="color-input-group">
            <input type="color" v-model="activePalette.plateTextColor" />
            <input type="text" v-model="activePalette.plateTextColor" class="hex-input" />
          </div>
        </div>
      </section>

      <!-- Text Colors Section -->
      <section class="settings-section">
        <h3>{{ t('display.textColors.title') }}</h3>

        <div class="color-row">
          <label>{{ t('display.textColors.header') }}</label>
          <div class="color-input-group">
            <input type="color" v-model="activePalette.headerTextColor" />
            <input type="text" v-model="activePalette.headerTextColor" class="hex-input" />
          </div>
        </div>

        <div class="color-row">
          <label>{{ t('display.textColors.stats') }}</label>
          <div class="color-input-group">
            <input type="color" v-model="activePalette.statsTextColor" />
            <input type="text" v-model="activePalette.statsTextColor" class="hex-input" />
          </div>
        </div>
      </section>

      <!-- Chart Colors Section -->
      <section class="settings-section">
        <h3>{{ t('display.chart.title') }}</h3>

        <div class="color-row">
          <label>{{ t('display.chart.primary') }}</label>
          <div class="color-input-group">
            <input type="color" v-model="activePalette.chartPrimaryColor" />
            <input type="text" v-model="activePalette.chartPrimaryColor" class="hex-input" />
          </div>
        </div>

        <div class="color-row">
          <label>{{ t('display.chart.secondary') }}</label>
          <div class="color-input-group">
            <input type="color" v-model="activePalette.chartSecondaryColor" />
            <input type="text" v-model="activePalette.chartSecondaryColor" class="hex-input" />
          </div>
        </div>
      </section>

      <!-- Audio Section -->
      <section class="settings-section">
        <h3>{{ t('display.sound.title') }}</h3>
        <p class="section-description">{{ t('display.sound.description') }}</p>

        <div class="audio-upload-row">
          <div v-if="settings.donationSound" class="audio-preview">
            <div class="audio-info">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
              <span>{{ t('display.sound.configured') }}</span>
            </div>
            <div class="audio-actions">
              <button
                class="play-btn"
                :class="{ playing: isPlaying(settings.donationSound) }"
                :title="isPlaying(settings.donationSound) ? t('common.stop') : t('common.play')"
                :aria-label="isPlaying(settings.donationSound) ? t('common.stop') : t('common.play')"
                @click="toggleAudio(settings.donationSound)"
                type="button"
              >
                <svg v-if="isPlaying(settings.donationSound)" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </button>
              <button class="remove-audio-btn" :aria-label="t('common.remove')" @click="removeDonationSound" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
          <label class="upload-btn" :class="{ uploading: isUploadingSound }">
            <input type="file" accept="audio/*" @change="uploadDonationSound" :disabled="isUploadingSound" />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {{ isUploadingSound ? t('common.uploading') : t('display.sound.choose') }}
          </label>
          <p v-if="soundUploadError" class="upload-error">{{ soundUploadError }}</p>
        </div>
      </section>

      <!-- Barre de sauvegarde collante.
           Avant, l'unique bouton Enregistrer etait tout en bas des 10
           sections : on modifiait, on ne voyait aucune confirmation, et les
           liens d'apercu affichaient l'ancienne version. -->
      <Transition name="savebar">
        <div v-if="isDirty" class="save-bar">
          <div class="save-bar-text">
            <strong>{{ t('display.unsaved') }}</strong>
            <span>{{ hasRemoteChange ? t('display.remoteChanged') : t('display.unsavedHint') }}</span>
          </div>
          <div class="save-bar-actions">
            <button type="button" class="save-bar-discard" @click="discardChanges">
              {{ t('display.discard') }}
            </button>
            <button type="button" class="save-bar-save" :disabled="isLoading" @click="saveSettings">
              {{ isLoading ? t('common.saving') : t('common.save') }}
            </button>
          </div>
        </div>
      </Transition>

      <!-- Actions -->
      <div class="actions">
        <button class="reset-btn" @click="resetDefaults">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          {{ t('display.reset') }}
        </button>
        <button class="save-btn" @click="saveSettings" :disabled="isLoading">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          {{ isLoading ? t('common.saving') : t('common.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Barre de sauvegarde collante en bas de l'ecran. */
.save-bar {
  position: sticky;
  bottom: 12px;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 20px;
  padding: 14px 18px;
  border: 1px solid var(--gold-500);
  border-radius: var(--radius-md);
  background: var(--gray-900);
  box-shadow: var(--shadow-xl);
}

.save-bar-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.save-bar-text strong {
  color: var(--gold-300);
  font-size: 14px;
}

.save-bar-text span {
  color: rgba(255, 255, 255, 0.75);
  font-size: 12.5px;
  line-height: 1.4;
}

.save-bar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.save-bar-discard,
.save-bar-save {
  min-height: 40px;
  padding: 9px 16px;
  border-radius: var(--radius);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.save-bar-discard {
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: transparent;
  color: rgba(255, 255, 255, 0.82);
}

.save-bar-discard:hover {
  border-color: rgba(255, 255, 255, 0.5);
  color: white;
}

.save-bar-save {
  border: 0;
  background: linear-gradient(135deg, var(--gold-400), var(--gold-600));
  color: var(--gray-900);
}

.save-bar-save:hover:not(:disabled) {
  filter: brightness(1.06);
}

.save-bar-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.savebar-enter-active,
.savebar-leave-active {
  transition: opacity var(--transition), transform var(--transition);
}

.savebar-enter-from,
.savebar-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* Apercu neutralise tant que des modifications ne sont pas enregistrees :
   sinon le lien affiche l'ancienne version et laisse croire a une panne. */
.preview-link.disabled,
.pledge-open-link.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  text-decoration: none;
  font-style: italic;
}

@media (prefers-reduced-motion: reduce) {
  .savebar-enter-active,
  .savebar-leave-active {
    transition: opacity var(--transition-fast);
  }

  .savebar-enter-from,
  .savebar-leave-to {
    transform: none;
  }
}

.display-settings-panel {
  width: 100%;
}

.card {
  background: white;
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-md);
}

.card-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 600;
  color: var(--gray-800);
  margin: 0 0 24px;
}

.card-title svg {
  width: 24px;
  height: 24px;
  color: var(--gold-500);
}

.error-msg {
  color: var(--error-500);
  background: var(--error-50);
  padding: 12px;
  border-radius: var(--radius);
  margin-bottom: 16px;
}

.settings-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--gray-200);
}

.settings-section:last-of-type {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.settings-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--gray-600);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 16px;
}

.section-heading-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.section-heading-row h3 {
  margin-bottom: 8px;
}

.theme-description {
  margin: 0;
}

.preview-link {
  flex-shrink: 0;
  padding: 8px 12px;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius);
  color: var(--primary-600);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: var(--transition);
}

.preview-link:hover {
  border-color: var(--primary-300);
  background: var(--primary-50);
}

.visual-description {
  margin: 0;
}

.content-description {
  margin: 0;
  max-width: 720px;
}

.direction-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 22px;
}

.direction-card {
  display: flex;
  min-height: 82px;
  flex-direction: column;
  gap: 6px;
  padding: 13px;
  border: 2px solid var(--gray-200);
  border-radius: 12px;
  background: white;
  color: inherit;
  cursor: pointer;
  text-align: start;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.direction-card:hover,
.animation-card:hover {
  transform: translateY(-2px);
  border-color: var(--gray-300);
  box-shadow: var(--shadow-md);
}

.direction-card.selected,
.animation-card.selected {
  border-color: var(--gold-500);
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.14);
}

.direction-card strong {
  color: var(--gray-900);
  font-size: 14px;
}

.direction-card small,
.animation-card small {
  color: var(--gray-500);
  font-size: 11px;
  line-height: 1.45;
}

.copy-group {
  margin-top: 18px;
  padding: 16px;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  background: var(--gray-50);
}

.copy-group h4 {
  margin: 0 0 13px;
  color: var(--gray-700);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.copy-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 13px;
}

.copy-grid.three-columns {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.pledge-locale-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.pledge-locale-tab {
  padding: 8px 16px;
  border: 1.5px solid var(--gray-200);
  border-radius: var(--radius);
  background: white;
  color: var(--gray-600);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.pledge-locale-tab:hover {
  border-color: var(--primary-300);
}

.pledge-locale-tab.selected {
  border-color: var(--primary-500);
  background: var(--primary-50);
  color: var(--primary-700);
}

.pledge-open-link {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-600);
  text-decoration: none;
  padding: 8px 14px;
  border: 1px solid var(--primary-200);
  border-radius: var(--radius);
  transition: var(--transition);
}

.pledge-open-link:hover {
  background: var(--primary-50);
}

.pledge-fields-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.pledge-field-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: var(--transition);
}

.pledge-field-toggle:hover {
  border-color: var(--primary-300);
  background: var(--primary-50);
}

.pledge-field-toggle input {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  accent-color: var(--primary-600);
  cursor: pointer;
}

.pledge-field-name {
  font-weight: 600;
  font-size: 14px;
}

.pledge-field-state {
  margin-inline-start: auto;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-700);
  white-space: nowrap;
}

.copy-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.copy-field.wide {
  grid-column: 1 / -1;
}

.copy-field > span {
  color: var(--gray-600);
  font-size: 12px;
  font-weight: 600;
}

.copy-field input,
.copy-field textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--gray-300);
  border-radius: 9px;
  background: white;
  color: var(--gray-900);
  font: inherit;
  font-size: 14px;
  line-height: 1.45;
}

.copy-field textarea {
  min-height: 78px;
  resize: vertical;
}

.copy-field input:focus,
.copy-field textarea:focus {
  border-color: var(--gold-500);
  outline: 3px solid rgba(212, 175, 55, 0.13);
}

.animation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.animation-card {
  position: relative;
  display: grid;
  grid-template-columns: 108px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  min-height: 108px;
  padding: 12px;
  border: 2px solid var(--gray-200);
  border-radius: 14px;
  background: white;
  color: inherit;
  cursor: pointer;
  text-align: start;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.animation-card > .selected-badge {
  position: absolute;
  top: 8px;
  inset-inline-end: 8px;
}

.animation-card-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 7px;
}

.animation-card-copy strong {
  color: var(--gray-900);
  font-size: 14px;
}

.animation-preview {
  position: relative;
  display: grid;
  width: 108px;
  height: 72px;
  place-items: center;
  overflow: hidden;
  border-radius: 10px;
  background: #0b1020;
}

.animation-preview b {
  z-index: 2;
  display: block;
  width: 70px;
  height: 26px;
  border: 1px solid #e4be63;
  border-radius: 5px;
  background: linear-gradient(135deg, #272c40, #111526);
  box-shadow: 0 0 16px rgba(228, 190, 99, 0.24);
}

.animation-preview i {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #e4be63;
}

.animation-preview i:nth-child(1) { top: 13px; left: 18px; }
.animation-preview i:nth-child(2) { top: 9px; right: 24px; }
.animation-preview i:nth-child(3) { bottom: 12px; left: 28px; }
.animation-preview i:nth-child(4) { right: 14px; bottom: 18px; }
.animation-preview i:nth-child(5) { top: 32px; left: 8px; }
.animation-preview i:nth-child(6) { top: 24px; right: 7px; }
.animation-preview i:nth-child(7) { bottom: 6px; left: 52px; }
.animation-preview i:nth-child(8) { top: 5px; left: 52px; }

.animation-confetti .animation-preview i {
  width: 5px;
  height: 8px;
  border-radius: 1px;
}

.animation-confetti .animation-preview i:nth-child(3n) { background: #70e7ff; }
.animation-confetti .animation-preview i:nth-child(3n + 1) { background: #ff9b62; }

.animation-ribbons .animation-preview::before,
.animation-ribbons .animation-preview::after {
  content: '';
  position: absolute;
  width: 94px;
  height: 38px;
  border: 2px solid rgba(112, 231, 255, 0.55);
  border-radius: 50%;
  transform: rotate(-13deg);
}

.animation-ribbons .animation-preview::after {
  width: 74px;
  height: 54px;
  border-color: rgba(228, 190, 99, 0.55);
  transform: rotate(28deg);
}

.animation-minimal .animation-preview i {
  display: none;
}

.animation-minimal .animation-preview b {
  border-color: rgba(255, 255, 255, 0.28);
  box-shadow: none;
}

.visual-mode-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.visual-mode-card {
  position: relative;
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  min-width: 0;
  min-height: 126px;
  padding: 14px;
  border: 2px solid var(--gray-200);
  border-radius: 14px;
  background: white;
  color: inherit;
  cursor: pointer;
  text-align: start;
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.visual-mode-card:hover {
  transform: translateY(-2px);
  border-color: var(--gray-300);
  box-shadow: var(--shadow-md);
}

.visual-mode-card.selected {
  border-color: var(--gold-500);
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.14);
}

.visual-mode-card > .selected-badge {
  position: absolute;
  top: 8px;
  inset-inline-end: 8px;
  background: var(--gold-100);
  color: var(--gold-700);
}

.visual-mode-preview {
  position: relative;
  display: grid;
  width: 92px;
  height: 76px;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: #0b1020;
  color: #e4be63;
}

.donor-only-preview {
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 10px;
  box-sizing: border-box;
}

.donor-only-preview span {
  width: 100%;
  height: 21px;
  border: 1px solid rgba(228, 190, 99, 0.48);
  border-left-width: 3px;
  border-radius: 4px;
  background: linear-gradient(135deg, #242839, #111526);
}

.menorah-preview span {
  position: absolute;
  left: 50%;
  bottom: 12px;
  width: 2px;
  height: 49px;
  background: currentColor;
  transform: translateX(-50%);
}

.menorah-preview .menorah-arm {
  bottom: 26px;
  height: 25px;
  border: 2px solid currentColor;
  border-top: 0;
  border-radius: 0 0 20px 20px;
  background: transparent;
}

.menorah-preview .arm-one { width: 28px; }
.menorah-preview .arm-two { width: 46px; bottom: 22px; }
.menorah-preview .arm-three { width: 64px; bottom: 18px; }

.custom-preview svg,
.custom-preview img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.visual-mode-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 7px;
}

.visual-mode-copy strong {
  color: var(--gray-900);
  font-size: 14px;
}

.visual-mode-copy small {
  color: var(--gray-500);
  font-size: 11px;
  line-height: 1.45;
}

.custom-svg-panel {
  margin-top: 14px;
  padding: 16px;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  background: var(--gray-50);
}

.custom-svg-current {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
}

.custom-svg-current img {
  width: 86px;
  height: 72px;
  padding: 8px;
  border: 1px solid var(--gray-200);
  border-radius: 10px;
  background: white;
  object-fit: contain;
}

.custom-svg-current > div {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  color: var(--gray-800);
  font-size: 13px;
}

.remove-svg-btn {
  padding: 5px 9px;
  border: 1px solid var(--error-100);
  border-radius: 7px;
  background: white;
  color: var(--error-500);
  cursor: pointer;
}

.svg-help {
  margin: 8px 0 0;
  color: var(--gray-500);
  font-size: 12px;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.theme-card {
  min-width: 0;
  padding: 0;
  border: 2px solid var(--gray-200);
  border-radius: 14px;
  background: white;
  color: inherit;
  cursor: pointer;
  overflow: hidden;
  text-align: start;
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.theme-card:hover {
  transform: translateY(-2px);
  border-color: var(--gray-300);
  box-shadow: var(--shadow-md);
}

.theme-card.selected {
  border-color: var(--preview-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--preview-primary) 18%, transparent);
}

.theme-preview {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 92px;
  padding: 12px;
  background:
    radial-gradient(circle at 18% 30%, color-mix(in srgb, var(--preview-primary) 18%, transparent), transparent 38%),
    var(--preview-bg);
  overflow: hidden;
}

.theme-preview::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.25;
  background: linear-gradient(120deg, transparent, color-mix(in srgb, var(--preview-secondary) 20%, transparent), transparent);
}

.preview-orb {
  width: 44px;
  height: 60px;
  border: 2px solid color-mix(in srgb, var(--preview-primary) 55%, transparent);
  border-radius: 50% 50% 38% 38%;
  box-shadow: 0 0 18px color-mix(in srgb, var(--preview-primary) 35%, transparent);
}

.preview-content {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.preview-title,
.preview-progress,
.preview-plate {
  display: block;
  border-radius: 999px;
}

.preview-title {
  width: 68%;
  height: 6px;
  background: var(--preview-text);
}

.preview-progress {
  width: 88%;
  height: 4px;
  background: linear-gradient(90deg, var(--preview-primary) 58%, rgba(255, 255, 255, 0.12) 58%);
}

.preview-plate {
  width: 100%;
  height: 14px;
  border: 1px solid color-mix(in srgb, var(--preview-plate) 55%, transparent);
  background: color-mix(in srgb, var(--preview-bg) 76%, white 8%);
}

.preview-plate.short {
  width: 82%;
}

.theme-card-copy {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px;
}

.theme-card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--gray-900);
  font-size: 13px;
  font-weight: 700;
}

.selected-badge,
.theme-mood {
  width: fit-content;
  padding: 3px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
}

.selected-badge {
  background: color-mix(in srgb, var(--preview-primary) 18%, white);
  color: color-mix(in srgb, var(--preview-primary) 72%, black);
}

.theme-card-description {
  min-height: 48px;
  color: var(--gray-500);
  font-size: 11px;
  line-height: 1.45;
}

.theme-mood {
  background: var(--gray-100);
  color: var(--gray-600);
}

.active-theme-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding: 11px 13px;
  border-radius: var(--radius);
  background: var(--gray-50);
  color: var(--gray-600);
  font-size: 13px;
}

.active-theme-bar strong {
  color: var(--gray-900);
}

.reset-theme-btn {
  padding: 7px 10px;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius);
  background: white;
  color: var(--gray-600);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.reset-theme-btn:hover {
  color: var(--primary-600);
  border-color: var(--primary-300);
}

.color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
}

.color-row label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--gray-700);
}

.color-badge {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid rgba(0,0,0,0.1);
}

.color-badge.gold { background: #FFD700; }
.color-badge.diamond { background: #E8E8E8; }
.color-badge.bronze { background: #CD7F32; }

.color-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-input-group input[type="color"] {
  width: 40px;
  height: 40px;
  padding: 0;
  border: 2px solid var(--gray-200);
  border-radius: var(--radius);
  cursor: pointer;
  background: transparent;
}

.color-input-group input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-input-group input[type="color"]::-webkit-color-swatch {
  border-radius: 4px;
  border: none;
}

.hex-input {
  width: 90px;
  padding: 8px 12px;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius);
  font-family: monospace;
  font-size: 13px;
  text-transform: uppercase;
}

/* Image Upload */
.image-upload-row {
  padding: 12px 0;
}

.image-upload-row label:first-child {
  display: block;
  font-size: 14px;
  color: var(--gray-700);
  margin-bottom: 12px;
}

.image-preview {
  position: relative;
  width: 100%;
  max-width: 300px;
  aspect-ratio: 16/9;
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: 12px;
  border: 2px solid var(--gray-200);
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-image-btn {
  position: absolute;
  top: 8px;
  inset-inline-end: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.7);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s;
}

.remove-image-btn:hover {
  background: var(--error-500);
}

.remove-image-btn svg {
  width: 16px;
  height: 16px;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--gray-100);
  color: var(--gray-700);
  border-radius: var(--radius);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-btn:hover {
  background: var(--gray-200);
}

.upload-btn.uploading {
  opacity: 0.6;
  cursor: wait;
}

.upload-btn input {
  display: none;
}

.upload-btn svg {
  width: 18px;
  height: 18px;
}

.upload-error {
  color: var(--error-500);
  font-size: 13px;
  margin-top: 8px;
}

/* Actions */
.actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--gray-200);
}

.reset-btn, .save-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn {
  background: var(--gray-100);
  color: var(--gray-700);
}

.reset-btn:hover {
  background: var(--gray-200);
}

.save-btn {
  flex: 1;
  justify-content: center;
  background: linear-gradient(135deg, var(--gold-500), var(--gold-600));
  color: white;
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
}

.save-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(212, 175, 55, 0.4);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.reset-btn svg, .save-btn svg {
  width: 18px;
  height: 18px;
}

/* Audio Upload */
.section-description {
  font-size: 13px;
  color: var(--gray-500);
  margin: -8px 0 16px;
}

.audio-upload-row {
  padding: 12px 0;
}

.audio-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--gray-50);
  border: 2px solid var(--gold-300);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
}

.audio-info {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--gray-700);
  font-weight: 500;
}

.audio-info svg {
  width: 24px;
  height: 24px;
  color: var(--gold-500);
}

.audio-actions {
  display: flex;
  gap: 8px;
}

.play-btn, .remove-audio-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
}

.play-btn {
  background: var(--gold-100);
  color: var(--gold-600);
}

.play-btn:hover {
  background: var(--gold-200);
}

/* Etat "en lecture" : le bouton doit dire clairement qu'un second clic arrete. */
.play-btn.playing {
  background: var(--gold-600);
  color: #fff;
  animation: audio-playing-pulse 1.4s ease-in-out infinite;
}

.play-btn.playing:hover {
  background: var(--gold-700);
}

@keyframes audio-playing-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(212, 161, 6, 0.5); }
  50% { box-shadow: 0 0 0 5px rgba(212, 161, 6, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .play-btn.playing {
    animation: none;
  }
}

.play-btn svg {
  width: 16px;
  height: 16px;
}

.remove-audio-btn {
  background: var(--gray-100);
  color: var(--gray-600);
}

.remove-audio-btn:hover {
  background: var(--error-100);
  color: var(--error-500);
}

.remove-audio-btn svg {
  width: 16px;
  height: 16px;
}

@media (max-width: 700px) {
  .card {
    padding: 18px;
  }

  .theme-grid {
    grid-template-columns: 1fr;
  }

  .visual-mode-grid {
    grid-template-columns: 1fr;
  }

  .direction-grid,
  .copy-grid,
  .copy-grid.three-columns,
  .animation-grid {
    grid-template-columns: 1fr;
  }

  .visual-mode-card {
    min-height: 104px;
  }

  .theme-card {
    display: grid;
    grid-template-columns: 150px 1fr;
  }

  .theme-preview {
    height: 100%;
    min-height: 112px;
  }

  .theme-card-description {
    min-height: 0;
  }
}

@media (max-width: 480px) {
  .section-heading-row,
  .active-theme-bar,
  .color-row,
  .actions {
    align-items: stretch;
    flex-direction: column;
  }

  .preview-link {
    text-align: center;
  }

  .theme-card {
    grid-template-columns: 118px minmax(0, 1fr);
  }

  .visual-mode-card {
    grid-template-columns: 76px minmax(0, 1fr);
    gap: 10px;
    padding: 10px;
  }

  .animation-card {
    grid-template-columns: 82px minmax(0, 1fr);
    gap: 10px;
  }

  .animation-preview {
    width: 82px;
  }

  .visual-mode-preview {
    width: 76px;
    height: 68px;
  }

  .theme-preview {
    min-height: 132px;
    padding: 8px;
    gap: 7px;
  }

  .preview-orb {
    width: 32px;
    height: 50px;
  }

  .theme-card-copy {
    padding: 10px;
  }

  .color-input-group {
    width: 100%;
  }

  .hex-input {
    flex: 1;
    width: auto;
  }
}
</style>
