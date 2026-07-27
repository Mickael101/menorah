<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  DEFAULT_THEME_PALETTES,
  DISPLAY_THEME_IDS,
  type DisplaySettings
} from '../../composables/useDonations';
import { DISPLAY_THEMES, cloneDisplaySettings } from '../../theme/displayThemes';
import { useAdminI18n } from '../../composables/useAdminI18n';
import { useToast } from '../../composables/useToast';
import { galleryText } from '../../theme/themeGalleryI18n';
import {
  fetchThemes,
  fetchAppliedTheme,
  createTheme,
  updateTheme,
  deleteTheme,
  validateThemeTokens,
  checkThemeContrast,
  tokensToPalette,
  paletteToTokens,
  ThemeApiError,
  type ThemeRecord,
  type ThemeTokens
} from '../../theme/themesApi';

// Galerie de themes (C1). Les themes viennent de l'API ; si elle est
// injoignable, on retombe sur les themes livres en dur (displayThemes.ts) en
// LECTURE SEULE : un ecran de salle ne doit jamais casser pour une erreur
// d'admin. Les vignettes affichent la palette PROPRE de chaque theme (des
// donnees), jamais la peau navy+or de l'administration.
const props = defineProps<{
  modelValue: DisplaySettings;
  eventId: number | null;
  selectedThemeId: number | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: DisplaySettings];
  'update:selectedThemeId': [value: number | null];
}>();

const { t, locale } = useAdminI18n();
const toast = useToast();

const themes = ref<ThemeRecord[]>([]);
const offline = ref(false);
const newThemeName = ref('');
const busy = ref(false);
const importInput = ref<HTMLInputElement | null>(null);

// Gestion possible uniquement en ligne ET avec une soiree resolue : un theme
// personnalise se rattache a une soiree.
const canManage = computed(() => !offline.value && props.eventId !== null);

const selectedTheme = computed(() => themes.value.find((th) => th.id === props.selectedThemeId) ?? null);

function gt(key: string, params: Record<string, string | number> = {}): string {
  return galleryText(locale.value, key, params);
}

function displayName(theme: ThemeRecord): string {
  // Un integre garde son libelle traduit ; un personnalise porte le nom saisi.
  return theme.builtin ? t(`display.theme.${theme.tokens.base}.name`) : theme.name;
}

// Repli hors-ligne : les sept themes livres, construits depuis la meme source
// que le moteur de rendu. Identifiants negatifs = non persistables (pas de
// gestion possible dans ce mode).
function offlineThemes(): ThemeRecord[] {
  return DISPLAY_THEME_IDS.map((id, index) => ({
    id: -(index + 1),
    eventId: null,
    name: DISPLAY_THEMES.find((th) => th.id === id)?.name ?? id,
    builtin: true,
    tokens: paletteToTokens(id, DEFAULT_THEME_PALETTES[id]),
    createdAt: null
  }));
}

async function loadThemes(): Promise<void> {
  try {
    themes.value = await fetchThemes(props.eventId);
    offline.value = false;
  } catch {
    themes.value = offlineThemes();
    offline.value = true;
  }
}

onMounted(async () => {
  await loadThemes();
  if (props.eventId !== null) {
    try {
      const applied = await fetchAppliedTheme(props.eventId);
      if (applied) {
        emit('update:selectedThemeId', applied.id);
      }
    } catch {
      // La lecture du theme applique est optionnelle : son echec ne bloque rien.
    }
  }
});

// Recharger si la soiree change (routage /e/:slug a venir cote front FE).
watch(() => props.eventId, loadThemes);

// Les tokens en cours d'edition : la base du theme actif + la palette vive que
// les sections de couleurs du panneau modifient. C'est ce qu'on duplique ou
// enregistre.
function currentTokens(): ThemeTokens {
  const base = props.modelValue.theme;
  return paletteToTokens(base, props.modelValue.themePalettes[base]);
}

// Selectionner = APERCU local : on pose la base et la palette du theme dans les
// reglages, sans rien ecrire en base. La barre d'enregistrement du panneau
// prend le relais ; annuler reste possible.
function selectTheme(theme: ThemeRecord): void {
  const next = cloneDisplaySettings(props.modelValue);
  next.theme = theme.tokens.base;
  next.themePalettes[theme.tokens.base] = tokensToPalette(theme.tokens);
  const palette = next.themePalettes[theme.tokens.base];
  emit('update:modelValue', { ...next, ...palette });
  emit('update:selectedThemeId', theme.id);
}

function themeThumbStyle(theme: ThemeRecord): Record<string, string> {
  const p = theme.tokens;
  return {
    '--thumb-bg': p.backgroundColor,
    '--thumb-header': p.headerTextColor,
    '--thumb-chart': p.chartPrimaryColor,
    '--thumb-plate': p.plateColorGold,
    '--thumb-text': p.statsTextColor
  };
}

function hasContrastIssue(theme: ThemeRecord): boolean {
  return checkThemeContrast(theme.tokens).length > 0;
}

function formatViolations(err: ThemeApiError): string {
  const pairs = (err.violations ?? []).map((v) => `${v.pair} ${v.ratio}`).join(', ');
  return pairs || err.message;
}

function handleApiError(err: unknown): void {
  if (err instanceof ThemeApiError && err.status === 422) {
    toast.error(gt('gallery.contrastRejected', { pairs: formatViolations(err) }));
    return;
  }
  toast.error(gt('gallery.actionFailed'));
}

async function duplicateTheme(): Promise<void> {
  if (!canManage.value || props.eventId === null || busy.value) return;
  const name = newThemeName.value.trim() || `${displayName(selectedTheme.value ?? themes.value[0])} (copie)`;
  busy.value = true;
  try {
    const created = await createTheme(props.eventId, name, currentTokens());
    newThemeName.value = '';
    await loadThemes();
    selectTheme(created);
    toast.success(gt('gallery.createdTheme'));
  } catch (err) {
    handleApiError(err);
  } finally {
    busy.value = false;
  }
}

async function saveIntoTheme(): Promise<void> {
  const theme = selectedTheme.value;
  if (!theme || theme.builtin || !canManage.value || busy.value) return;
  busy.value = true;
  try {
    await updateTheme(theme.id, { tokens: currentTokens() });
    await loadThemes();
    toast.success(gt('gallery.savedTheme'));
  } catch (err) {
    handleApiError(err);
  } finally {
    busy.value = false;
  }
}

async function removeTheme(): Promise<void> {
  const theme = selectedTheme.value;
  if (!theme || theme.builtin || !canManage.value || busy.value) return;
  if (!confirm(gt('gallery.deleteConfirm'))) return;
  busy.value = true;
  try {
    await deleteTheme(theme.id);
    emit('update:selectedThemeId', null);
    await loadThemes();
    toast.success(gt('gallery.deletedTheme'));
  } catch (err) {
    handleApiError(err);
  } finally {
    busy.value = false;
  }
}

function exportTheme(): void {
  const theme = selectedTheme.value;
  if (!theme) return;
  const payload = JSON.stringify({ name: displayName(theme), tokens: theme.tokens }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `theme-${theme.tokens.base}-${theme.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function triggerImport(): void {
  importInput.value?.click();
}

async function importTheme(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !canManage.value || props.eventId === null) return;

  let tokens: ThemeTokens;
  let name: string;
  try {
    const parsed = JSON.parse(await file.text()) as { name?: string; tokens?: unknown };
    tokens = validateThemeTokens(parsed.tokens ?? parsed);
    name = (parsed.name || file.name.replace(/\.json$/i, '')).slice(0, 80);
  } catch (err) {
    toast.error(gt('gallery.importSchemaError', { reason: err instanceof Error ? err.message : '' }));
    return;
  }

  // Contraste AVERTISSANT, pas bloquant (spec §5.4, decision commanditaire) :
  // l'import aboutit, l'avertissement nomme les paires sous seuil et le badge
  // de la galerie reste visible sur la vignette.
  const violations = checkThemeContrast(tokens);
  if (violations.length > 0) {
    toast.info(gt('gallery.contrastRejected', { pairs: violations.map((v) => `${v.pair} ${v.ratio}`).join(', ') }));
  }

  busy.value = true;
  try {
    const created = await createTheme(props.eventId, name, tokens);
    await loadThemes();
    selectTheme(created);
    toast.success(gt('gallery.importedTheme'));
  } catch (err) {
    handleApiError(err);
  } finally {
    busy.value = false;
  }
}

</script>

<template>
  <div class="theme-gallery">
    <p v-if="offline" class="gallery-offline">{{ gt('gallery.offline') }}</p>

    <div class="theme-grid" role="radiogroup" :aria-label="t('display.theme.aria')">
      <button
        v-for="theme in themes"
        :key="theme.id"
        type="button"
        class="theme-card"
        :class="{ selected: theme.id === selectedThemeId }"
        :aria-pressed="theme.id === selectedThemeId"
        :style="themeThumbStyle(theme)"
        @click="selectTheme(theme)"
      >
        <span class="theme-thumb" aria-hidden="true">
          <span class="thumb-title"></span>
          <span class="thumb-chart"></span>
          <span class="thumb-plate"></span>
        </span>
        <span class="theme-card-copy">
          <span class="theme-card-title">
            {{ displayName(theme) }}
            <span v-if="theme.id === selectedThemeId" class="selected-badge">{{ t('common.active') }}</span>
          </span>
          <span class="theme-tags">
            <span class="tag" :class="theme.builtin ? 'tag-builtin' : 'tag-custom'">
              {{ theme.builtin ? gt('gallery.builtin') : gt('gallery.custom') }}
            </span>
            <span v-if="hasContrastIssue(theme)" class="tag tag-warn" :title="gt('gallery.contrastWarning')">
              &#9888; {{ gt('gallery.contrastWarning') }}
            </span>
          </span>
        </span>
      </button>
    </div>

    <!-- Actions sur le theme selectionne + creation/import. -->
    <div v-if="canManage" class="theme-actions">
      <div class="theme-actions-row">
        <button
          type="button"
          class="ghost-btn"
          :disabled="!selectedTheme || busy"
          @click="exportTheme"
        >{{ gt('gallery.export') }}</button>

        <button type="button" class="ghost-btn" :disabled="busy" @click="triggerImport">
          {{ gt('gallery.import') }}
        </button>
        <input
          ref="importInput"
          type="file"
          accept="application/json,.json"
          class="visually-hidden"
          @change="importTheme"
        />

        <button
          v-if="selectedTheme && !selectedTheme.builtin"
          type="button"
          class="ghost-btn"
          :disabled="busy"
          @click="saveIntoTheme"
        >{{ gt('gallery.saveInto') }}</button>

        <button
          v-if="selectedTheme && !selectedTheme.builtin"
          type="button"
          class="ghost-btn danger"
          :disabled="busy"
          @click="removeTheme"
        >{{ gt('gallery.delete') }}</button>
      </div>

      <div class="theme-create-row">
        <input
          v-model="newThemeName"
          type="text"
          maxlength="80"
          class="theme-name-input"
          :placeholder="gt('gallery.namePlaceholder')"
          dir="auto"
        />
        <button type="button" class="ghost-btn primary" :disabled="busy" @click="duplicateTheme">
          {{ gt('gallery.duplicate') }}
        </button>
      </div>

      <p class="gallery-applied-hint">{{ gt('gallery.appliedHint') }}</p>
    </div>
  </div>
</template>

<style scoped>
.theme-gallery {
  width: 100%;
}

.gallery-offline {
  margin: 0 0 14px;
  padding: 10px 12px;
  border: 1px solid var(--shell-accent-deep);
  border-radius: var(--radius);
  background: rgba(228, 190, 99, 0.14);
  color: var(--shell-accent-strong);
  font-size: 12.5px;
  line-height: 1.45;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 2px solid var(--shell-border);
  border-radius: 14px;
  background: var(--shell-card);
  color: inherit;
  cursor: pointer;
  text-align: start;
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.theme-card:hover {
  transform: translateY(-2px);
  border-color: var(--shell-border-strong);
  box-shadow: var(--shadow-md);
}

.theme-card.selected {
  border-color: var(--shell-accent);
  box-shadow: 0 0 0 3px rgba(228, 190, 99, 0.14);
}

/* Vignette : la palette PROPRE du theme (donnees), jamais la peau de l'admin. */
.theme-thumb {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  height: 74px;
  padding: 12px;
  border-radius: 10px;
  background: var(--thumb-bg);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.thumb-title {
  width: 60%;
  height: 9px;
  border-radius: 3px;
  background: var(--thumb-header);
}

.thumb-chart {
  width: 85%;
  height: 6px;
  border-radius: 3px;
  background: var(--thumb-chart);
}

.thumb-plate {
  width: 45%;
  height: 12px;
  border-radius: 4px;
  background: var(--thumb-plate);
}

.theme-card-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.theme-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--shell-text-strong);
  font-size: 14px;
  font-weight: 600;
}

.theme-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.tag-builtin {
  background: var(--shell-raised);
  color: var(--shell-text-muted);
}

.tag-custom {
  background: rgba(228, 190, 99, 0.14);
  color: var(--shell-accent-strong);
}

.tag-warn {
  background: rgba(248, 113, 113, 0.16);
  color: var(--shell-error);
}

.selected-badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(228, 190, 99, 0.14);
  color: var(--shell-accent-strong);
  font-size: 11px;
  font-weight: 600;
}

.theme-actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--shell-border);
}

.theme-actions-row,
.theme-create-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.theme-create-row {
  margin-top: 12px;
}

.theme-name-input {
  flex: 1 1 200px;
  min-width: 0;
  padding: 9px 12px;
  border: 1px solid var(--field-border);
  border-radius: 9px;
  background: var(--field-bg);
  color: var(--field-text);
  font: inherit;
  font-size: 14px;
}

.theme-name-input:focus {
  border-color: var(--field-border-focus);
  outline: 3px solid rgba(228, 190, 99, 0.55);
}

/* Boutons SECONDAIRES : contour + texte, jamais d'aplat plein, sauf l'action
   dominante (primary) et la destructrice (danger). */
.ghost-btn {
  min-height: 40px;
  padding: 9px 14px;
  border: 1px solid var(--shell-border);
  border-radius: var(--radius);
  background: transparent;
  color: var(--shell-accent);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.ghost-btn:hover:not(:disabled) {
  border-color: var(--shell-accent);
  background: rgba(228, 190, 99, 0.14);
}

.ghost-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ghost-btn.primary {
  border: 0;
  background: var(--shell-accent);
  color: var(--shell-on-accent);
}

.ghost-btn.primary:hover:not(:disabled) {
  filter: brightness(1.06);
  background: var(--shell-accent);
}

.ghost-btn.danger {
  color: var(--shell-error);
}

.ghost-btn.danger:hover:not(:disabled) {
  border-color: var(--shell-error);
  background: rgba(248, 113, 113, 0.14);
}

.gallery-applied-hint {
  margin: 12px 0 0;
  color: var(--shell-text-muted);
  font-size: 12px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
