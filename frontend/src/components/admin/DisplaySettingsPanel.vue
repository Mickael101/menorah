<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useDonations, type DisplaySettings, DEFAULT_DISPLAY_SETTINGS } from '../../composables/useDonations';

const { config, fetchConfig, updateConfig, isLoading, error } = useDonations();
const API_BASE = import.meta.env.VITE_API_URL || '';

// Local form state
const settings = ref<DisplaySettings>({ ...DEFAULT_DISPLAY_SETTINGS });
const isUploading = ref(false);
const uploadError = ref('');

// Load settings on mount
onMounted(async () => {
  await fetchConfig();
  syncSettings();
});

// Sync with config changes
watch(() => config.value.displaySettings, () => {
  syncSettings();
}, { deep: true });

function syncSettings(): void {
  if (config.value.displaySettings) {
    settings.value = { ...config.value.displaySettings };
  }
}

// Save all settings
async function saveSettings(): Promise<void> {
  await updateConfig({ displaySettings: settings.value });
}

// Reset to defaults
function resetDefaults(): void {
  settings.value = { ...DEFAULT_DISPLAY_SETTINGS };
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
    const response = await fetch(`${API_BASE}/api/gifs/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    const result = await response.json();
    settings.value.backgroundImage = result.url;
    input.value = '';
  } catch (error: any) {
    uploadError.value = error.message || 'Failed to upload image';
  } finally {
    isUploading.value = false;
  }
}

// Remove background image
function removeBackgroundImage(): void {
  settings.value.backgroundImage = null;
}
</script>

<template>
  <div class="display-settings-panel">
    <div class="card">
      <h2 class="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        Parametres d'affichage
      </h2>

      <p v-if="error" class="error-msg">{{ error }}</p>

      <!-- Background Section -->
      <section class="settings-section">
        <h3>Fond d'ecran</h3>

        <div class="color-row">
          <label>Couleur de fond</label>
          <div class="color-input-group">
            <input type="color" v-model="settings.backgroundColor" />
            <input type="text" v-model="settings.backgroundColor" class="hex-input" />
          </div>
        </div>

        <div class="image-upload-row">
          <label>Image de fond</label>
          <div class="image-preview" v-if="settings.backgroundImage">
            <img :src="settings.backgroundImage" alt="Background" />
            <button class="remove-image-btn" @click="removeBackgroundImage">
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
            {{ isUploading ? 'Upload...' : 'Choisir une image' }}
          </label>
          <p v-if="uploadError" class="upload-error">{{ uploadError }}</p>
        </div>
      </section>

      <!-- Plate Colors Section -->
      <section class="settings-section">
        <h3>Couleurs des plaques</h3>

        <div class="color-row">
          <label>
            <span class="color-badge gold"></span>
            Or (72,000+ ₪)
          </label>
          <div class="color-input-group">
            <input type="color" v-model="settings.plateColorGold" />
            <input type="text" v-model="settings.plateColorGold" class="hex-input" />
          </div>
        </div>

        <div class="color-row">
          <label>
            <span class="color-badge diamond"></span>
            Diamant (36,000+ ₪)
          </label>
          <div class="color-input-group">
            <input type="color" v-model="settings.plateColorDiamond" />
            <input type="text" v-model="settings.plateColorDiamond" class="hex-input" />
          </div>
        </div>

        <div class="color-row">
          <label>
            <span class="color-badge bronze"></span>
            Bronze (26,000+ ₪)
          </label>
          <div class="color-input-group">
            <input type="color" v-model="settings.plateColorBronze" />
            <input type="text" v-model="settings.plateColorBronze" class="hex-input" />
          </div>
        </div>

        <div class="color-row">
          <label>Texte des plaques</label>
          <div class="color-input-group">
            <input type="color" v-model="settings.plateTextColor" />
            <input type="text" v-model="settings.plateTextColor" class="hex-input" />
          </div>
        </div>
      </section>

      <!-- Text Colors Section -->
      <section class="settings-section">
        <h3>Couleurs du texte</h3>

        <div class="color-row">
          <label>Titre / En-tete</label>
          <div class="color-input-group">
            <input type="color" v-model="settings.headerTextColor" />
            <input type="text" v-model="settings.headerTextColor" class="hex-input" />
          </div>
        </div>

        <div class="color-row">
          <label>Statistiques</label>
          <div class="color-input-group">
            <input type="color" v-model="settings.statsTextColor" />
            <input type="text" v-model="settings.statsTextColor" class="hex-input" />
          </div>
        </div>
      </section>

      <!-- Chart Colors Section -->
      <section class="settings-section">
        <h3>Couleurs du graphique</h3>

        <div class="color-row">
          <label>Couleur principale</label>
          <div class="color-input-group">
            <input type="color" v-model="settings.chartPrimaryColor" />
            <input type="text" v-model="settings.chartPrimaryColor" class="hex-input" />
          </div>
        </div>

        <div class="color-row">
          <label>Couleur secondaire</label>
          <div class="color-input-group">
            <input type="color" v-model="settings.chartSecondaryColor" />
            <input type="text" v-model="settings.chartSecondaryColor" class="hex-input" />
          </div>
        </div>
      </section>

      <!-- Actions -->
      <div class="actions">
        <button class="reset-btn" @click="resetDefaults">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          Reinitialiser
        </button>
        <button class="save-btn" @click="saveSettings" :disabled="isLoading">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          {{ isLoading ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  right: 8px;
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
</style>
