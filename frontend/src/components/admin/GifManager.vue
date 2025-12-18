<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface Gif {
  filename: string;
  url: string;
  audioUrl: string | null;
  uploadedAt: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '';
const gifs = ref<Gif[]>([]);
const isUploading = ref(false);
const uploadError = ref('');
const triggeringGif = ref<string | null>(null);
const uploadingAudioFor = ref<string | null>(null);

async function fetchGifs(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/gifs`);
    gifs.value = await response.json();
  } catch (error) {
    console.error('Error fetching GIFs:', error);
  }
}

async function uploadGif(event: Event): Promise<void> {
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

    await fetchGifs();
    input.value = '';
  } catch (error: any) {
    uploadError.value = error.message || 'Failed to upload GIF';
  } finally {
    isUploading.value = false;
  }
}

async function uploadAudioForGif(event: Event, gifFilename: string): Promise<void> {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

  uploadingAudioFor.value = gifFilename;

  const formData = new FormData();
  formData.append('audio', input.files[0]);

  try {
    // Upload audio file
    const uploadResponse = await fetch(`${API_BASE}/api/gifs/upload-audio`, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error('Audio upload failed');
    }

    const audioResult = await uploadResponse.json();

    // Associate audio with GIF
    await fetch(`${API_BASE}/api/gifs/associate-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gifFilename, audioUrl: audioResult.url })
    });

    await fetchGifs();
    input.value = '';
  } catch (error) {
    console.error('Error uploading audio:', error);
  } finally {
    uploadingAudioFor.value = null;
  }
}

async function removeAudioFromGif(gifFilename: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/gifs/associate-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gifFilename, audioUrl: null })
    });
    await fetchGifs();
  } catch (error) {
    console.error('Error removing audio:', error);
  }
}

async function triggerGif(gif: Gif): Promise<void> {
  triggeringGif.value = gif.url;
  try {
    await fetch(`${API_BASE}/api/gifs/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gifUrl: gif.url, audioUrl: gif.audioUrl })
    });
  } catch (error) {
    console.error('Error triggering GIF:', error);
  } finally {
    setTimeout(() => {
      triggeringGif.value = null;
    }, 1000);
  }
}

async function deleteGif(filename: string): Promise<void> {
  if (!confirm('Supprimer ce GIF ?')) return;

  try {
    await fetch(`${API_BASE}/api/gifs/${filename}`, {
      method: 'DELETE'
    });
    await fetchGifs();
  } catch (error) {
    console.error('Error deleting GIF:', error);
  }
}

function playAudio(url: string): void {
  const audio = new Audio(url);
  audio.play();
}

onMounted(fetchGifs);
</script>

<template>
  <div class="gif-manager">
    <div class="card">
      <h2 class="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="m21 15-5-5L5 21"/>
        </svg>
        Gestion des GIFs
      </h2>

      <!-- Upload Section -->
      <div class="upload-section">
        <label class="upload-btn" :class="{ uploading: isUploading }">
          <input
            type="file"
            accept="image/gif,image/png,image/jpeg,image/webp"
            @change="uploadGif"
            :disabled="isUploading"
          />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {{ isUploading ? 'Upload en cours...' : 'Importer un GIF' }}
        </label>
        <p v-if="uploadError" class="upload-error">{{ uploadError }}</p>
        <p class="upload-hint">Formats acceptes: GIF, PNG, JPG, WebP (max 50MB)</p>
      </div>

      <!-- GIFs Grid -->
      <div class="gifs-grid">
        <div v-if="gifs.length === 0" class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
          </svg>
          <p>Aucun GIF importe</p>
        </div>

        <div v-for="gif in gifs" :key="gif.filename" class="gif-card">
          <div class="gif-preview">
            <img :src="gif.url" :alt="gif.filename" />
          </div>

          <!-- Audio Section -->
          <div class="audio-section">
            <div v-if="gif.audioUrl" class="audio-attached">
              <div class="audio-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18V5l12-2v13"/>
                  <circle cx="6" cy="18" r="3"/>
                  <circle cx="18" cy="16" r="3"/>
                </svg>
                <span>Son associe</span>
              </div>
              <div class="audio-mini-actions">
                <button class="play-mini-btn" @click="playAudio(gif.audioUrl)" type="button">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                </button>
                <button class="remove-mini-btn" @click="removeAudioFromGif(gif.filename)" type="button">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            <label v-else class="add-audio-btn" :class="{ uploading: uploadingAudioFor === gif.filename }">
              <input
                type="file"
                accept="audio/*"
                @change="(e) => uploadAudioForGif(e, gif.filename)"
                :disabled="uploadingAudioFor !== null"
              />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
              {{ uploadingAudioFor === gif.filename ? 'Upload...' : 'Ajouter son' }}
            </label>
          </div>

          <div class="gif-actions">
            <button
              class="trigger-btn"
              :class="{ triggering: triggeringGif === gif.url }"
              @click="triggerGif(gif)"
              :disabled="triggeringGif !== null"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              {{ triggeringGif === gif.url ? 'Envoye !' : 'Declencher' }}
            </button>
            <button class="delete-btn" @click="deleteGif(gif.filename)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gif-manager {
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

/* Upload Section */
.upload-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--gray-200);
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 14px 28px;
  background: linear-gradient(135deg, var(--gold-500), var(--gold-600));
  color: white;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
}

.upload-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(212, 175, 55, 0.4);
}

.upload-btn.uploading {
  opacity: 0.7;
  cursor: wait;
}

.upload-btn input {
  display: none;
}

.upload-btn svg {
  width: 20px;
  height: 20px;
}

.upload-error {
  color: var(--error-500);
  font-size: 13px;
  margin-top: 8px;
}

.upload-hint {
  color: var(--gray-500);
  font-size: 12px;
  margin-top: 8px;
}

/* GIFs Grid */
.gifs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: var(--gray-400);
  text-align: center;
}

.empty-state svg {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-state p {
  font-size: 14px;
  margin: 0;
}

.gif-card {
  background: var(--gray-50);
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--gray-200);
  transition: all 0.2s ease;
}

.gif-card:hover {
  border-color: var(--gold-300);
  box-shadow: var(--shadow);
}

.gif-preview {
  width: 100%;
  aspect-ratio: 16/10;
  overflow: hidden;
  background: var(--gray-100);
}

.gif-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gif-actions {
  display: flex;
  gap: 8px;
  padding: 12px;
}

.trigger-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--primary-500);
  color: white;
  border: none;
  border-radius: var(--radius);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.trigger-btn:hover:not(:disabled) {
  background: var(--primary-600);
}

.trigger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.trigger-btn.triggering {
  background: var(--success-500);
  animation: pulse-success 0.5s ease;
}

@keyframes pulse-success {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.trigger-btn svg {
  width: 16px;
  height: 16px;
}

.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--gray-100);
  color: var(--gray-500);
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.2s ease;
}

.delete-btn:hover {
  background: var(--error-100);
  color: var(--error-500);
}

.delete-btn svg {
  width: 18px;
  height: 18px;
}

/* Audio Section */
.audio-section {
  padding: 8px 12px;
  border-top: 1px solid var(--gray-200);
  background: var(--gray-100);
}

.audio-attached {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.audio-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--gold-600);
}

.audio-badge svg {
  width: 14px;
  height: 14px;
}

.audio-mini-actions {
  display: flex;
  gap: 4px;
}

.play-mini-btn, .remove-mini-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
}

.play-mini-btn {
  background: var(--gold-100);
  color: var(--gold-600);
}

.play-mini-btn:hover {
  background: var(--gold-200);
}

.play-mini-btn svg {
  width: 12px;
  height: 12px;
}

.remove-mini-btn {
  background: transparent;
  color: var(--gray-400);
}

.remove-mini-btn:hover {
  background: var(--error-100);
  color: var(--error-500);
}

.remove-mini-btn svg {
  width: 14px;
  height: 14px;
}

.add-audio-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px;
  background: transparent;
  border: 1px dashed var(--gray-300);
  border-radius: var(--radius);
  font-size: 12px;
  color: var(--gray-500);
  cursor: pointer;
  transition: all 0.2s;
}

.add-audio-btn:hover {
  border-color: var(--gold-400);
  color: var(--gold-600);
  background: var(--gold-50);
}

.add-audio-btn.uploading {
  opacity: 0.6;
  cursor: wait;
}

.add-audio-btn input {
  display: none;
}

.add-audio-btn svg {
  width: 14px;
  height: 14px;
}
</style>
