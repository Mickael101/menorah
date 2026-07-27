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
  cloneDisplaySettings,
  resetThemePalette
} from '../../theme/displayThemes';
import { useAdminI18n } from '../../composables/useAdminI18n';
import { adminFetch } from '../../composables/useAdminAuth';
import ThemeGallery from './ThemeGallery.vue';
import { resolveActiveEventId, applyTheme } from '../../theme/themesApi';

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

// Soiree ciblee par la galerie de themes (soiree active tant que le routage
// /e/:slug — front FE — n'est pas cable). null = non resolue : la galerie
// retombe alors sur ses themes hors-ligne.
const eventId = ref<number | null>(null);
// Identifiant du theme (en base) actuellement selectionne dans la galerie, pour
// l'enregistrer comme theme applique a la soiree lors de la sauvegarde.
const selectedThemeId = ref<number | null>(null);

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
  // Resolution best-effort : un echec laisse eventId a null, la galerie bascule
  // en mode hors-ligne (lecture seule) plutot que de casser le panneau.
  eventId.value = await resolveActiveEventId();
});

const toast = useToast();

// Sous-onglets. Les 10 sections tenaient dans un seul scroll de 38 champs,
// avec l'unique bouton Enregistrer tout en bas : impossible de s'y retrouver.
// L'ordre suit l'usage reel, et « Thème et couleurs » vient en premier parce
// que le theme conditionne toutes les couleurs des sections suivantes.
type ScreenTab = 'appearance' | 'texts' | 'composition' | 'donation' | 'pledge';

const SCREEN_TABS: { id: ScreenTab; labelKey: string }[] = [
  { id: 'appearance', labelKey: 'screenTabs.appearance' },
  { id: 'texts', labelKey: 'screenTabs.texts' },
  { id: 'composition', labelKey: 'screenTabs.composition' },
  { id: 'donation', labelKey: 'screenTabs.donation' },
  { id: 'pledge', labelKey: 'screenTabs.pledge' }
];

const SCREEN_TAB_KEY = 'menorah_admin_screen_tab';

function readStoredTab(): ScreenTab {
  const stored = localStorage.getItem(SCREEN_TAB_KEY) as ScreenTab | null;
  return SCREEN_TABS.some(tab => tab.id === stored) ? (stored as ScreenTab) : 'appearance';
}

const screenTab = ref<ScreenTab>(readStoredTab());

function selectScreenTab(next: ScreenTab): void {
  screenTab.value = next;
  localStorage.setItem(SCREEN_TAB_KEY, next);
}

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
    // Enregistre le theme applique a la soiree (pointeur theme_id). Les
    // displaySettings, deja enregistres ci-dessus, pilotent le rendu : cet appel
    // est un complement, et son echec ne doit pas faire croire a un echec de
    // sauvegarde. Un identifiant negatif est un theme hors-ligne, non persistable.
    if (selectedThemeId.value !== null && selectedThemeId.value > 0 && eventId.value !== null) {
      try {
        await applyTheme(eventId.value, selectedThemeId.value);
      } catch {
        // Complement non bloquant : voir ci-dessus.
      }
    }
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

      <!-- Sous-onglets : les 10 sections tenaient dans un seul scroll. -->
      <nav class="screen-tabs" role="tablist" :aria-label="t('display.title')">
        <button
          v-for="tab in SCREEN_TABS"
          :key="tab.id"
          type="button"
          role="tab"
          class="screen-tab"
          :class="{ active: screenTab === tab.id }"
          :aria-selected="screenTab === tab.id"
          @click="selectScreenTab(tab.id)"
        >
          {{ t(tab.labelKey) }}
        </button>
      </nav>

      <!-- Scene composition -->
      <section v-show="screenTab === 'composition'" class="settings-section visual-section">
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
      <section v-show="screenTab === 'texts'" class="settings-section content-settings-section">
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
      <section v-show="screenTab === 'pledge'" class="settings-section">
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
      <section v-show="screenTab === 'donation'" class="settings-section animation-settings-section">
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
      <section v-show="screenTab === 'appearance'" class="settings-section theme-section">
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

        <ThemeGallery
          v-model="settings"
          v-model:selectedThemeId="selectedThemeId"
          :event-id="eventId"
        />

        <div class="active-theme-bar">
          <span>{{ t('display.theme.customizing', { theme: themeText(settings.theme, 'name') }) }}</span>
          <button type="button" class="reset-theme-btn" @click="resetActiveTheme">
            {{ t('display.theme.restore') }}
          </button>
        </div>
      </section>

      <!-- Background Section -->
      <section v-show="screenTab === 'appearance'" class="settings-section">
        <h3>{{ t('display.background.title', { theme: themeText(settings.theme, 'short') }) }}</h3>
        <p class="section-description theme-scope-hint">
          {{ t('display.themeScopedHint', { theme: themeText(settings.theme, 'short') }) }}
        </p>

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
      <section v-show="screenTab === 'appearance'" class="settings-section">
        <h3>{{ t('display.plates.title', { theme: themeText(settings.theme, 'short') }) }}</h3>
        <p class="section-description theme-scope-hint">
          {{ t('display.themeScopedHint', { theme: themeText(settings.theme, 'short') }) }}
        </p>

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
      <section v-show="screenTab === 'appearance'" class="settings-section">
        <h3>{{ t('display.textColors.title', { theme: themeText(settings.theme, 'short') }) }}</h3>
        <p class="section-description theme-scope-hint">
          {{ t('display.themeScopedHint', { theme: themeText(settings.theme, 'short') }) }}
        </p>

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
      <section v-show="screenTab === 'appearance'" class="settings-section">
        <h3>{{ t('display.chart.title', { theme: themeText(settings.theme, 'short') }) }}</h3>
        <p class="section-description theme-scope-hint">
          {{ t('display.themeScopedHint', { theme: themeText(settings.theme, 'short') }) }}
        </p>

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
      <section v-show="screenTab === 'donation'" class="settings-section">
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
/* Rappel de portee sous chaque bloc de couleurs. */
.theme-scope-hint {
  margin: -6px 0 14px;
  color: var(--shell-text-muted);
  font-size: 12.5px;
  line-height: 1.45;
}

/* Sous-onglets de la personnalisation. */
.screen-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 22px;
  padding: 4px;
  border: 1px solid var(--shell-border);
  border-radius: var(--radius-md);
  /* Creux DANS la carte : la piste doit descendre sous --shell-card,
     l'onglet actif remonte ensuite a --shell-raised (1.30 contre la piste). */
  background: var(--shell-page);
}

.screen-tab {
  flex: 1 1 auto;
  min-height: 40px;
  padding: 9px 14px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--shell-text);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: var(--transition-fast);
}

.screen-tab:hover {
  color: var(--shell-text-strong);
  background: var(--shell-raised);
}

/* L'aplat or plein est deja pris par l'onglet principal de l'admin
   (AdminPanel .tab.active) : ici l'etat actif se porte par le TEXTE or,
   sinon deux aplats or se concurrencent dans le meme ecran. */
.screen-tab.active {
  color: var(--shell-accent-strong);
  background: var(--shell-raised);
  /* Anneau or au lieu de l'ombre noire, qui ne se voit pas sur navy. Sans lui,
     l'onglet actif et l'onglet survole partageaient EXACTEMENT la meme surface
     (--shell-raised, ratio 1.00) et ne se distinguaient que par une nuance or
     contre creme mesuree a 1.39 : au moindre passage du pointeur, deux onglets
     paraissaient ouverts. #C8922A = 5.26 contre --shell-raised, et un anneau
     interieur ne decale pas la mise en page. */
  box-shadow: inset 0 0 0 1px var(--shell-accent-deep);
}

@media (max-width: 700px) {
  .screen-tab {
    flex: 1 1 45%;
    font-size: 12.5px;
    padding-inline: 8px;
  }
}

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
  /* --gray-900 (#0f172a) etait a un cheveu de --shell-card (#161C3A) :
     deux navys aussi proches se lisent comme un bug. La barre descend a
     la surface la plus profonde, ce qui la fait lire comme flottant
     AU-DESSUS de l'espace de travail. */
  /* Contour COMPLET, pas seulement un trait superieur : la barre est un enfant
     de .card, et --shell-page ne vaut que 1.14 contre --shell-card. Son ombre
     portee est du noir alpha, donc invisible sur navy. Avec un seul border-top,
     trois de ses quatre aretes n'existaient pas et le border-radius laissait
     deux coins bas arrondis flotter sans contour : la barre se lisait comme un
     trou dans la carte. box-sizing: border-box est global, donc le contour
     complet ne decale rien. #C8922A : 6.03 contre la carte, 6.85 contre la page. */
  border: 1px solid var(--shell-accent-deep);
  border-radius: var(--radius-md);
  background: var(--shell-page);
  box-shadow: var(--shadow-xl);
}

.save-bar-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.save-bar-text strong {
  color: var(--shell-accent-strong);
  font-size: 14px;
}

.save-bar-text span {
  color: var(--shell-text);
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
  border: 1px solid var(--shell-border-strong);
  background: transparent;
  color: var(--shell-text);
}

.save-bar-discard:hover {
  border-color: var(--shell-accent);
  color: var(--shell-text-strong);
}

/* Action DOMINANTE de la barre : le seul aplat or plein de la barre,
   texte sombre (10.68 sur l'or). 'Annuler' reste en contour. */
.save-bar-save {
  border: 0;
  background: var(--shell-accent);
  color: var(--shell-on-accent);
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
  background: var(--shell-card);
  /* L'ombre portee ne se voit pas sur du navy (carte contre page = 1.14) :
     c'est la bordure claire qui dessine desormais le bord. */
  border: 1px solid var(--shell-border);
  /* body pose color: var(--gray-800) : sans couleur explicite ici, tout le
     texte herite (libelles, .pledge-field-name, cartes en color: inherit)
     resterait sombre sur sombre. */
  color: var(--shell-text);
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
  color: var(--shell-text-strong);
  margin: 0 0 24px;
}

.card-title svg {
  width: 24px;
  height: 24px;
  color: var(--shell-accent);
}

.error-msg {
  color: var(--shell-error);
  /* --error-50 (#fef2f2) etait un aplat CLAIR : il ne survit pas sur carte
     sombre. Voile rouge calcule : fond rendu #362842, #F87171 dessus = 4.95. */
  background: rgba(248, 113, 113, 0.14);
  padding: 12px;
  border-radius: var(--radius);
  margin-bottom: 16px;
}

.settings-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--shell-border);
}

.settings-section:last-of-type {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.settings-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--shell-text);
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

/* Bouton SECONDAIRE : contour + texte or, jamais d'aplat plein. */
.preview-link {
  flex-shrink: 0;
  padding: 8px 12px;
  border: 1px solid var(--shell-border);
  border-radius: var(--radius);
  color: var(--shell-accent);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: var(--transition);
}

.preview-link:hover {
  border-color: var(--shell-accent);
  background: rgba(228, 190, 99, 0.14);
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
  border: 2px solid var(--shell-border);
  border-radius: 12px;
  background: var(--shell-card);
  color: inherit;
  cursor: pointer;
  text-align: start;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.direction-card:hover,
.animation-card:hover {
  transform: translateY(-2px);
  border-color: var(--shell-border-strong);
  box-shadow: var(--shadow-md);
}

.direction-card.selected,
.animation-card.selected {
  border-color: var(--shell-accent);
  box-shadow: 0 0 0 3px rgba(228, 190, 99, 0.14);
}

.direction-card strong {
  color: var(--shell-text-strong);
  font-size: 14px;
}

.direction-card small,
.animation-card small {
  color: var(--shell-text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.copy-group {
  margin-top: 18px;
  padding: 16px;
  border: 1px solid var(--shell-border);
  border-radius: var(--radius-md);
  background: var(--shell-page);
}

.copy-group h4 {
  margin: 0 0 13px;
  color: var(--shell-text);
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
  border: 1.5px solid var(--shell-border);
  border-radius: var(--radius);
  background: var(--shell-card);
  color: var(--shell-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.pledge-locale-tab:hover {
  border-color: var(--shell-border-strong);
}

/* L'etat selectionne etait porte par le bleu contre le blanc : il devient
   voile or + contour or + texte or (7.07 au pire des fonds calcules),
   pour rester distinct du survol qui, lui, ne bouge que la bordure. */
.pledge-locale-tab.selected {
  border-color: var(--shell-accent);
  background: rgba(228, 190, 99, 0.14);
  color: var(--shell-accent-strong);
}

/* Bouton SECONDAIRE : contour, jamais d'aplat plein. */
.pledge-open-link {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--shell-accent);
  text-decoration: none;
  padding: 8px 14px;
  border: 1px solid var(--shell-border);
  border-radius: var(--radius);
  transition: var(--transition);
}

.pledge-open-link:hover {
  background: rgba(228, 190, 99, 0.14);
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
  border: 1px solid var(--shell-border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: var(--transition);
}

.pledge-field-toggle:hover {
  border-color: var(--shell-accent);
  background: rgba(228, 190, 99, 0.14);
}

.pledge-field-toggle input {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  accent-color: var(--shell-accent);
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
  color: var(--shell-accent);
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
  color: var(--shell-text);
  font-size: 12px;
  font-weight: 600;
}

/* Les champs restent volontairement CLAIRS : taper longtemps dans un champ
   sombre fatigue, et un champ clair s'identifie par sa surface (15.28
   contre la carte). background ET color sont declares : s'en remettre au
   defaut du navigateur ne passait que par chance sur carte blanche. */
.copy-field input,
.copy-field textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--field-border);
  border-radius: 9px;
  background: var(--field-bg);
  color: var(--field-text);
  font: inherit;
  font-size: 14px;
  line-height: 1.45;
}

.copy-field input::placeholder,
.copy-field textarea::placeholder {
  color: var(--field-placeholder);
}

.copy-field textarea {
  min-height: 78px;
  resize: vertical;
}

.copy-field input:focus,
.copy-field textarea:focus {
  border-color: var(--field-border-focus);
  /* L'ancien halo a 0.13 disparaissait sur navy. Voile or calcule :
     trait rendu #827045, 3.92 contre la page, 3.73 contre la carte —
     un indicateur de focus doit atteindre 3.0. */
  outline: 3px solid rgba(228, 190, 99, 0.55);
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
  border: 2px solid var(--shell-border);
  border-radius: 14px;
  background: var(--shell-card);
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
  color: var(--shell-text-strong);
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
  border: 2px solid var(--shell-border);
  border-radius: 14px;
  background: var(--shell-card);
  color: inherit;
  cursor: pointer;
  text-align: start;
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.visual-mode-card:hover {
  transform: translateY(-2px);
  border-color: var(--shell-border-strong);
  box-shadow: var(--shadow-md);
}

.visual-mode-card.selected {
  border-color: var(--shell-accent);
  box-shadow: 0 0 0 3px rgba(228, 190, 99, 0.14);
}

/* --gold-100/-700 etait un aplat CLAIR : il ne survit pas sur carte sombre.
   La pastille reprend le voile or par defaut de .selected-badge. */
.visual-mode-card > .selected-badge {
  position: absolute;
  top: 8px;
  inset-inline-end: 8px;
  background: rgba(228, 190, 99, 0.14);
  color: var(--shell-accent-strong);
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
  color: var(--shell-text-strong);
  font-size: 14px;
}

.visual-mode-copy small {
  color: var(--shell-text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.custom-svg-panel {
  margin-top: 14px;
  padding: 16px;
  border: 1px solid var(--shell-border);
  border-radius: var(--radius-md);
  background: var(--shell-page);
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
  border: 1px solid var(--shell-border);
  border-radius: 10px;
  /* PLAQUE DE VERIFICATION D'UN FICHIER CLIENT — regle commune a tous les
     apercus de media de l'administration (voir aussi .gif-preview dans
     GifManager). Une plaque sombre serait un pari sur le theme public : le
     theme livre « Ivoire clair » a un fond #F6F1E6 et un texte #221C10, donc
     un SVG a traits sombres est un televersement parfaitement legitime — et il
     disparaissait (1.02 contre --shell-card, contre 16.91 sur la plaque claire
     d'avant). Un damier clair montre a la fois les traits sombres et la
     transparence, sans pretendre deviner le theme choisi. */
  background-color: var(--field-bg);
  background-image:
    linear-gradient(45deg, rgba(26, 26, 34, 0.07) 25%, transparent 25%, transparent 75%, rgba(26, 26, 34, 0.07) 75%),
    linear-gradient(45deg, rgba(26, 26, 34, 0.07) 25%, transparent 25%, transparent 75%, rgba(26, 26, 34, 0.07) 75%);
  background-size: 14px 14px;
  background-position: 0 0, 7px 7px;
  object-fit: contain;
}

.custom-svg-current > div {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  color: var(--shell-text);
  font-size: 13px;
}

.remove-svg-btn {
  padding: 5px 9px;
  /* --error-100 (#fee2e2) etait un trait CLAIR ; un voile rouge a 0.32 ne
     mesure que 1.69, sous le seuil de 3.0 pour un objet graphique.
     Le trait plein passe : #F87171 = 6.02 sur la carte, 6.84 sur la page. */
  border: 1px solid var(--shell-error);
  border-radius: 7px;
  background: var(--shell-card);
  color: var(--shell-error);
  cursor: pointer;
}

.svg-help {
  margin: 8px 0 0;
  color: var(--shell-text-muted);
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
  border: 2px solid var(--shell-border);
  border-radius: 14px;
  background: var(--shell-card);
  color: inherit;
  cursor: pointer;
  overflow: hidden;
  text-align: start;
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.theme-card:hover {
  transform: translateY(-2px);
  border-color: var(--shell-border-strong);
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
  color: var(--shell-text-strong);
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

/* BUG CORRIGE : la pastille « Actif » est aussi rendue sur les cartes
   d'animation et de composition, ou --preview-primary n'existe pas — les
   deux color-mix() y etaient invalides et la pastille se retrouvait sans
   fond, avec une couleur heritee. Le fond par defaut est donc de la PEAU,
   et la variante liee a la donnee est restreinte aux cartes de theme, les
   seules a porter le style inline --preview-* (l.694). */
.selected-badge {
  background: rgba(228, 190, 99, 0.14);
  color: var(--shell-accent-strong);
}

.theme-card .selected-badge {
  background: color-mix(in srgb, var(--preview-primary) 18%, white);
  color: color-mix(in srgb, var(--preview-primary) 72%, black);
}

.theme-card-description {
  min-height: 48px;
  color: var(--shell-text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.theme-mood {
  background: var(--shell-raised);
  color: var(--shell-text);
}

.active-theme-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding: 11px 13px;
  /* Les quatre autres creux en --shell-page de ce panneau (.screen-tabs,
     .copy-group, .custom-svg-panel, .audio-preview) portent tous une bordure ;
     celui-ci l'avait oubliee et se dissolvait dans la carte a 1.14, son libelle
     et son bouton « Restaurer » flottant sans conteneur. */
  border: 1px solid var(--shell-border);
  border-radius: var(--radius);
  background: var(--shell-page);
  color: var(--shell-text);
  font-size: 13px;
}

.active-theme-bar strong {
  color: var(--shell-text-strong);
}

.reset-theme-btn {
  padding: 7px 10px;
  border: 1px solid var(--shell-border);
  border-radius: var(--radius);
  background: var(--shell-card);
  color: var(--shell-text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.reset-theme-btn:hover {
  color: var(--shell-accent);
  border-color: var(--shell-accent);
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
  color: var(--shell-text);
}

/* Le REMPLISSAGE vient de la config du client (style inline) : seule cette
   bordure est de la peau. Un noir a 10 % etait invisible sur navy.
   --field-border et non --shell-border-strong : ce trait est le SEUL delimiteur
   d'une pastille dont le remplissage peut etre n'importe quelle couleur, y
   compris une couleur sombre qui se confondrait avec la carte. Il doit donc
   tenir tout seul : #C9C3B4 = 9.47 contre la carte, contre 2.34 avant. */
.color-badge {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid var(--field-border);
}

.color-badge.gold { background: #FFD700; }
.color-badge.diamond { background: #E8E8E8; }
.color-badge.bronze { background: #CD7F32; }

.color-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Le cadre est de la peau, le remplissage est la valeur du client.
   background ET color sont declares : 'transparent' laissait le rendu au
   defaut du navigateur, ce qui ne passait que par chance sur carte blanche
   et devient illisible chez une partie des utilisateurs sur carte sombre. */
.color-input-group input[type="color"] {
  width: 40px;
  height: 40px;
  padding: 0;
  border: 2px solid var(--shell-border);
  border-radius: var(--radius);
  cursor: pointer;
  background: var(--field-bg);
  color: var(--field-text);
}

.color-input-group input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-input-group input[type="color"]::-webkit-color-swatch {
  border-radius: 4px;
  border: none;
}

/* La saisie hexadecimale doit rester lisible independamment du navigateur
   et du theme de l'OS : elle ne se contente plus d'une bordure. */
.hex-input {
  width: 90px;
  padding: 8px 12px;
  border: 1px solid var(--field-border);
  border-radius: var(--radius);
  background: var(--field-bg);
  color: var(--field-text);
  font-family: monospace;
  font-size: 13px;
  text-transform: uppercase;
}

.hex-input::placeholder {
  color: var(--field-placeholder);
}

.hex-input:focus {
  border-color: var(--field-border-focus);
  outline: 3px solid rgba(228, 190, 99, 0.55); /* trait rendu #827045, 3.92 sur la page */
}

/* Image Upload */
.image-upload-row {
  padding: 12px 0;
}

.image-upload-row label:first-child {
  display: block;
  font-size: 14px;
  color: var(--shell-text);
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
  border: 2px solid var(--shell-border);
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

/* L'etat de repos garde son voile noir et son glyphe blanc : il se pose sur
   l'IMAGE du client, pas sur du navy. Au survol, l'aplat rouge devient
   clair, donc le glyphe passe en sombre (#0B1020 sur #F87171 = 6.84). */
.remove-image-btn:hover {
  background: var(--shell-error);
  color: var(--shell-on-accent);
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
  background: var(--shell-raised);
  color: var(--shell-text);
  border-radius: var(--radius);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

/* Il n'existe que trois navys : le survol ne peut pas monter d'un cran de
   plus, il se signale par un voile or (fond rendu #333340, texte 8.78).
   Le voile SEUL ne suffit pas : sa valeur rendue depend du parent, et
   .upload-btn existe a trois endroits. Dans .custom-svg-panel (parent
   --shell-page) le voile compose #292829, soit 1.01 contre le repos — aucun
   retour de survol du tout. Le changement de COULEUR DE TEXTE, lui, ne depend
   d'aucun parent : #F2CC72 mesure 9.55 sur #292829 et 8.09 sur #333340. */
.upload-btn:hover {
  background: rgba(228, 190, 99, 0.14);
  color: var(--shell-accent-strong);
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
  color: var(--shell-error);
  font-size: 13px;
  margin-top: 8px;
}

/* Actions */
.actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--shell-border);
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
  background: var(--shell-raised);
  color: var(--shell-text);
}

.reset-btn:hover {
  /* Meme raison que .upload-btn:hover : le voile seul ne donnait que 1.17. */
  background: rgba(228, 190, 99, 0.14);
  color: var(--shell-accent-strong);
}

/* ARBITRAGE : deux boutons or pleins portaient la MEME action « Enregistrer »
   a vingt pixels l'un de l'autre — celui de la barre collante et celui-ci — et
   rien ne disait lequel etait le bouton canonique. La barre collante l'emporte :
   elle est la seule atteignable a tout moment du defilement, et c'est le motif
   deja retenu pour la sauvegarde par section. Celui-ci descend donc en contour.
   Ses ombres or sont supprimees : du noir ou de l'or diffus ne se voit pas sur
   navy, elles ne dessinaient rien. */
.save-btn {
  flex: 1;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--shell-accent);
  color: var(--shell-accent); /* 9.39 sur la carte */
}

.save-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  background: rgba(228, 190, 99, 0.14); /* compose #333340 ; or a 8.78 */
  color: var(--shell-accent-strong);
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
  color: var(--shell-text-muted);
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
  background: var(--shell-page);
  /* Ce cadre or dit « un son est configure » : le signal doit survivre.
     Un voile or a 0.32 ne mesure que 2.10, sous le seuil de 3.0 pour un
     objet graphique ; le trait plein passe (#C8922A = 6.03 sur la carte). */
  border: 2px solid var(--shell-accent-deep);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
}

.audio-info {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--shell-text);
  font-weight: 500;
}

.audio-info svg {
  width: 24px;
  height: 24px;
  color: var(--shell-accent);
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

/* Pastille d'icone : voile or, glyphe or. */
.play-btn {
  background: rgba(228, 190, 99, 0.14);
  color: var(--shell-accent);
}

.play-btn:hover {
  background: rgba(228, 190, 99, 0.22);
}

/* Etat "en lecture" : le bouton doit dire clairement qu'un second clic
   arrete. Le contraste repos/lecture etait voile-clair contre or-fonce ; il
   devient voile contre APLAT or profond, ce qui garde deux etats distincts
   sans concurrencer l'aplat or de l'action dominante. #fff sur de l'or est
   l'echec que --shell-on-accent corrige (6.85 sur l'or profond). */
.play-btn.playing {
  background: var(--shell-accent-deep);
  color: var(--shell-on-accent);
  animation: audio-playing-pulse 1.4s ease-in-out infinite;
}

.play-btn.playing:hover {
  background: var(--shell-accent);
}

@keyframes audio-playing-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(228, 190, 99, 0.5); }
  50% { box-shadow: 0 0 0 5px rgba(228, 190, 99, 0); }
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
  background: var(--shell-raised);
  color: var(--shell-text);
}

/* --error-100 (#fee2e2) etait un aplat CLAIR : voile rouge calcule, fond
   rendu #36212F, glyphe #F87171 dessus = 5.35. */
.remove-audio-btn:hover {
  background: rgba(248, 113, 113, 0.18);
  color: var(--shell-error);
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
