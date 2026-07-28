<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useAdminI18n } from '../../composables/useAdminI18n';
import { adminFetch } from '../../composables/useAdminAuth';
import { useAudioPreview } from '../../composables/useAudioPreview';
import { useToast } from '../../composables/useToast';
import { useDonations, type CelebrationRule } from '../../composables/useDonations';

// Les paliers appartiennent a displaySettings (etat du panneau parent, barre
// d'enregistrement commune) : la galerie les LIT et emet des tableaux neufs,
// elle ne possede rien et ne mute jamais la prop.
const props = defineProps<{ celebrations: CelebrationRule[] }>();
const emit = defineEmits<{ (e: 'update:celebrations', rules: CelebrationRule[]): void }>();

const { t } = useAdminI18n();
const toast = useToast();
const { formatAmount } = useDonations();

interface Gif {
  filename: string;
  url: string;
  audioUrl: string | null;
  uploadedAt: string;
}

function ruleFor(gifUrl: string): CelebrationRule | null {
  return props.celebrations.find((rule) => rule.gifUrl === gifUrl) ?? null;
}

// Montant du palier en shekels pour l'affichage ; champ vide = pas de regle.
function ruleAmountShekels(gifUrl: string): string {
  const rule = ruleFor(gifUrl);
  return rule ? String(rule.minAmount / 100) : '';
}

function setRuleAmount(gif: Gif, raw: string): void {
  const others = props.celebrations.filter((rule) => rule.gifUrl !== gif.url);
  const parsed = parseFloat(raw);
  if (isNaN(parsed) || parsed <= 0) {
    // Champ vide : ce GIF ne se declenche plus automatiquement.
    if (others.length !== props.celebrations.length) {
      emit('update:celebrations', others);
    }
    return;
  }
  const existing = ruleFor(gif.url);
  emit('update:celebrations', [
    ...others,
    {
      // Id stable derive du fichier : pas d'horloge, pas de doublon possible.
      id: existing?.id ?? `rule-${gif.filename}`,
      minAmount: Math.round(parsed * 100),
      gifUrl: gif.url,
      // Une regle neuve joue partout : c'est le geste demande (« aussi pour la
      // page de don ») ; les cases permettent ensuite de restreindre.
      playOnDisplay: existing?.playOnDisplay ?? true,
      playOnPledge: existing?.playOnPledge ?? true
    }
  ]);
}

function toggleRuleScope(gifUrl: string, scope: 'playOnDisplay' | 'playOnPledge'): void {
  const rule = ruleFor(gifUrl);
  if (!rule) return;
  emit('update:celebrations', props.celebrations.map((entry) =>
    entry.gifUrl === gifUrl ? { ...entry, [scope]: !entry[scope] } : entry
  ));
}

const API_BASE = import.meta.env.VITE_API_URL || '';
const gifs = ref<Gif[]>([]);
const isUploading = ref(false);
const uploadError = ref('');
const triggeringGif = ref<string | null>(null);
const uploadingAudioFor = ref<string | null>(null);

async function fetchGifs(): Promise<void> {
  try {
    // Via adminFetch (comme upload/associate/trigger/delete) : sur une soiree en
    // portee, scopedApiUrl reecrit /api/gifs en /api/events/:id/gifs, donc la
    // liste montre les GIF de la soiree ADMINISTREE. Un simple fetch brut visait
    // la soiree ACTIVE, si bien qu'un GIF televerse etait invisible et qu'une
    // suppression frappait un fichier d'une autre soiree (404).
    const response = await adminFetch(`${API_BASE}/api/gifs`);
    // Le code HTTP n'etait pas verifie, seul appel du fichier a s'en dispenser :
    // sur 404/500 le backend renvoie { error }, donc gifs.value devenait un
    // OBJET et le v-for rendait des vignettes fantomes (sans url, sans
    // filename).
    if (!response.ok) throw new Error(t('toast.actionFailed'));
    gifs.value = await response.json();
  } catch (error) {
    console.error('Error fetching GIFs:', error);
    // Etat vide plutot qu'une liste perimee (ou un objet d'erreur) : l'ecran
    // vide est honnete, l'ancien contenu ne l'est plus apres un echec.
    gifs.value = [];
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
    const response = await adminFetch(`${API_BASE}/api/gifs/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || t('gifs.uploadFailed'));
    }

    await fetchGifs();
    input.value = '';
  } catch (error: any) {
    uploadError.value = error.message || t('gifs.uploadFailed');
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
    const uploadResponse = await adminFetch(`${API_BASE}/api/gifs/upload-audio`, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error(t('gifs.audioUploadFailed'));
    }

    const audioResult = await uploadResponse.json();

    // Associate audio with GIF
    await adminFetch(`${API_BASE}/api/gifs/associate-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gifFilename, audioUrl: audioResult.url })
    });

    await fetchGifs();
    input.value = '';
    toast.success(t('toast.soundAttached'));
  } catch (error) {
    // Avant : console.error seulement, donc echec totalement invisible.
    toast.error(error instanceof Error ? error.message : t('gifs.audioUploadFailed'));
  } finally {
    uploadingAudioFor.value = null;
  }
}

async function removeAudioFromGif(gifFilename: string): Promise<void> {
  try {
    // Le code HTTP n'etait pas verifie : un 401 passait pour un succes.
    const response = await adminFetch(`${API_BASE}/api/gifs/associate-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gifFilename, audioUrl: null })
    });
    if (!response.ok) throw new Error(t('toast.actionFailed'));

    await fetchGifs();
    toast.success(t('toast.soundRemoved'));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('toast.actionFailed'));
  }
}

async function triggerGif(gif: Gif): Promise<void> {
  triggeringGif.value = gif.url;
  try {
    // Le code HTTP n'etait pas verifie : rien n'arrivait a l'ecran et
    // l'admin voyait quand meme « Envoye ! ».
    const response = await adminFetch(`${API_BASE}/api/gifs/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gifUrl: gif.url, audioUrl: gif.audioUrl })
    });
    if (!response.ok) throw new Error(t('toast.actionFailed'));

    toast.success(t('toast.gifTriggered'));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('toast.actionFailed'));
  } finally {
    setTimeout(() => {
      triggeringGif.value = null;
    }, 1000);
  }
}

async function deleteGif(filename: string): Promise<void> {
  if (!confirm(t('gifs.deleteConfirm'))) return;

  try {
    const response = await adminFetch(`${API_BASE}/api/gifs/${filename}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error(t('toast.actionFailed'));

    await fetchGifs();
    // La regle de palier du GIF supprime part avec lui (a enregistrer via la
    // barre commune). Une regle orpheline restee en base serait de toute
    // facon ignoree par les ecrans.
    const next = props.celebrations.filter((rule) => rule.gifUrl !== `/uploads/gifs/${filename}`);
    if (next.length !== props.celebrations.length) {
      emit('update:celebrations', next);
    }
    toast.success(t('toast.gifDeleted'));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('toast.actionFailed'));
  }
}

// Lecture partagee avec le reste du panel : un seul son a la fois,
// re-cliquer arrete. Voir composables/useAudioPreview.ts.
const { toggle: toggleAudio, stop: stopAudio, isPlaying } = useAudioPreview();

onMounted(fetchGifs);

// Sans ceci, quitter l'onglet laissait le son tourner indefiniment.
onUnmounted(stopAudio);
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
        {{ t('gifs.title') }}
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
          {{ isUploading ? t('gifs.importing') : t('gifs.import') }}
        </label>
        <p v-if="uploadError" class="upload-error">{{ uploadError }}</p>
        <p class="upload-hint">{{ t('gifs.formats') }}</p>
        <p class="upload-hint">{{ t('gifs.thresholdHint') }}</p>
      </div>

      <!-- GIFs Grid -->
      <div class="gifs-grid">
        <div v-if="gifs.length === 0" class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
          </svg>
          <p>{{ t('gifs.empty') }}</p>
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
                <span>{{ t('gifs.soundAttached') }}</span>
              </div>
              <div class="audio-mini-actions">
                <button
                  class="play-mini-btn"
                  :class="{ playing: isPlaying(gif.audioUrl) }"
                  :title="isPlaying(gif.audioUrl) ? t('common.stop') : t('common.play')"
                  :aria-label="isPlaying(gif.audioUrl) ? t('common.stop') : t('common.play')"
                  @click="toggleAudio(gif.audioUrl)"
                  type="button"
                >
                  <svg v-if="isPlaying(gif.audioUrl)" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
              {{ uploadingAudioFor === gif.filename ? t('common.uploading') : t('gifs.addSound') }}
            </label>
          </div>

          <!-- Palier : montant a partir duquel ce GIF part automatiquement
               quand un don arrive (ecran de salle et/ou page /don). -->
          <div class="threshold-section">
            <label class="threshold-field">
              <span>{{ t('gifs.thresholdLabel') }}</span>
              <input
                type="number"
                min="1"
                step="1"
                inputmode="decimal"
                :value="ruleAmountShekels(gif.url)"
                :placeholder="t('gifs.thresholdPlaceholder')"
                @change="setRuleAmount(gif, ($event.target as HTMLInputElement).value)"
              />
            </label>
            <div v-if="ruleFor(gif.url)" class="threshold-scopes">
              <label class="scope-toggle">
                <input
                  type="checkbox"
                  :checked="ruleFor(gif.url)?.playOnDisplay"
                  @change="toggleRuleScope(gif.url, 'playOnDisplay')"
                />
                <span>{{ t('admin.tabs.screen') }}</span>
              </label>
              <label class="scope-toggle">
                <input
                  type="checkbox"
                  :checked="ruleFor(gif.url)?.playOnPledge"
                  @change="toggleRuleScope(gif.url, 'playOnPledge')"
                />
                <span>{{ t('admin.tabs.pledge') }}</span>
              </label>
              <span class="threshold-badge">≥ {{ formatAmount(ruleFor(gif.url)!.minAmount) }}</span>
            </div>
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
              {{ triggeringGif === gif.url ? t('gifs.sent') : t('gifs.trigger') }}
            </button>
            <button class="delete-btn" :aria-label="t('common.delete')" @click="deleteGif(gif.filename)">
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
  background: var(--shell-card);
  /* L'ombre portee ne se voit pas sur du navy : c'est la bordure claire qui
     dessine le bord de la carte (carte contre page = 1.14). */
  border: 1px solid var(--shell-border);
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

/* Upload Section */
.upload-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--shell-border);
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 14px 28px;
  /* Un seul aplat or par panneau : il est pris par « Declencher », l'action de
     diffusion en direct repetee toute la soiree. « Importer » se prepare une
     fois, donc elle descend en contour et perd son degrade or. */
  /* Ratios consignes des trois plans, pas seulement du texte : la surface ne
     vaut que 1.15 contre la carte, et la bordure --shell-border-strong composee
     sur ce fond donne #595E7D, soit 2.63 contre la carte. Le controle se lit
     donc par son libelle, pas par sa boite. Ce n'est pas une regression :
     l'ancien degrade or valait 1.63 a 2.36 contre le blanc et son libelle blanc
     environ 1.9 — la conversion ameliore les deux. */
  background: var(--shell-raised);
  border: 1px solid var(--shell-border-strong);
  color: var(--shell-accent);           /* 8.19 sur --shell-raised */
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-btn:hover {
  transform: translateY(-2px);
  border-color: var(--shell-accent);
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
  color: var(--shell-error);             /* #ef4444 echouait a 4.20 sur navy ; 6.02 ici */
  font-size: 13px;
  margin-top: 8px;
}

.upload-hint {
  color: var(--shell-text-muted);
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
  color: var(--shell-text-muted);
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
  background: var(--shell-page);
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--shell-border);
  transition: all 0.2s ease;
}

.gif-card:hover {
  border-color: var(--shell-accent);
  box-shadow: var(--shadow);
}

.gif-preview {
  width: 100%;
  aspect-ratio: 16/10;
  overflow: hidden;
  /* Damier : ces GIF televerses sont souvent a fond transparent. Un aplat clair
     ferait un trou dans la carte, un aplat sombre mentirait (le theme public
     peut etre clair) ; le damier est la convention qui montre la transparence. */
  background-color: var(--shell-raised);
  background-image:
    linear-gradient(45deg, rgba(255, 255, 255, 0.07) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.07) 75%),
    linear-gradient(45deg, rgba(255, 255, 255, 0.07) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.07) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 8px 8px;
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
  /* L'aplat or plein du panneau : l'action dominante, la diffusion en direct. */
  background: var(--shell-accent-flat);
  color: var(--shell-on-accent);         /* 10.68 sur l'or */
  border: none;
  border-radius: var(--radius);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.trigger-btn:hover:not(:disabled) {
  background: var(--shell-accent-deep);  /* --shell-on-accent : 6.85 sur l'or profond */
}

/* :not(.triggering) — le bouton qui DIFFUSE n'est pas un bouton eteint.
   Le template desactive tous les boutons pendant qu'un GIF part, donc l'opacite
   frappait aussi celui qui declenche : le vert tombait a #248569 et son texte a
   4.17, alors que le commentaire ci-dessous annoncait 9.85. Le seul retour
   visuel de la diffusion en direct doit etre a pleine intensite. */
.trigger-btn:disabled:not(.triggering) {
  opacity: 0.6;
  cursor: not-allowed;
}

/* L'etat « en cours de diffusion » garde une couleur SEMANTIQUE distincte de
   l'or, sinon il se confondrait avec le repos maintenant que l'or est la peau. */
.trigger-btn.triggering {
  cursor: not-allowed;
  background: var(--shell-success);      /* --shell-on-accent : 9.85 sur le vert */
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
  background: var(--shell-raised);
  color: var(--shell-text-muted);
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.2s ease;
}

.delete-btn:hover {
  /* --error-100 etait un aplat clair : sur carte sombre il devient un voile. */
  background: rgba(248, 113, 113, 0.16); /* compose #31202D sur --shell-page */
  color: var(--shell-error);             /* 5.52 sur ce compose */
}

.delete-btn svg {
  width: 18px;
  height: 18px;
}

/* Audio Section */
.audio-section {
  padding: 8px 12px;
  border-top: 1px solid var(--shell-border);
  background: var(--shell-raised);
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
  color: var(--shell-accent);            /* 8.19 sur --shell-raised */
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
  background: rgba(228, 190, 99, 0.14);  /* compose #3A3B52 sur --shell-raised */
  color: var(--shell-accent);            /* 6.15 sur ce compose */
}

.play-mini-btn:hover {
  background: rgba(228, 190, 99, 0.20);  /* compose #464453 ; l'or reste a 5.35 */
}

/* Etat "en lecture" : le bouton doit dire clairement qu'un second clic arrete. */
.play-mini-btn.playing {
  background: var(--shell-accent-flat);
  color: var(--shell-on-accent);         /* 10.68 sur l'or, la ou #fff echouait */
  animation: audio-playing-pulse 1.4s ease-in-out infinite;
}

.play-mini-btn.playing:hover {
  background: var(--shell-accent-deep);  /* --shell-on-accent : 6.85 sur l'or profond */
}

@keyframes audio-playing-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(228, 190, 99, 0.5); }
  50% { box-shadow: 0 0 0 5px rgba(228, 190, 99, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .play-mini-btn.playing {
    animation: none;
  }
}

.play-mini-btn svg {
  width: 12px;
  height: 12px;
}

.remove-mini-btn {
  background: transparent;
  color: var(--shell-text-muted);
}

.remove-mini-btn:hover {
  background: rgba(248, 113, 113, 0.16); /* compose #413254 sur --shell-raised */
  color: var(--shell-error);             /* 4.20 sur ce compose : objet graphique, seuil 3.0 */
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
  /* Trait fort : ce pointille est le seul contour du controle (2.30 sur
     --shell-raised, contre 1.36 pour l'ancien --gray-300 sur --gray-100).
     Son libelle visible a 4.53 reste le porteur de l'identification. */
  border: 1px dashed var(--shell-border-strong);
  border-radius: var(--radius);
  font-size: 12px;
  color: var(--shell-text-muted);        /* 4.53 sur --shell-raised, le pire des fonds sombres */
  cursor: pointer;
  transition: all 0.2s;
}

.add-audio-btn:hover {
  border-color: var(--shell-accent);
  /* --gold-50 etait un aplat clair : sur carte sombre il devient un voile. */
  background: rgba(228, 190, 99, 0.14);  /* compose #3A3B52 sur --shell-raised */
  color: var(--shell-accent);            /* 6.15 sur ce compose */
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

/* Palier de declenchement automatique */
.threshold-section {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--shell-border);
  background: var(--shell-raised);
}

.threshold-field {
  display: grid;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--shell-text);
}

.threshold-field input {
  width: 100%;
  min-width: 0;
  padding: 7px 9px;
  border: 1px solid var(--shell-border-strong);
  border-radius: var(--radius);
  background: var(--shell-page);
  color: var(--shell-text-strong);
  font: inherit;
  font-size: 13px;
  box-sizing: border-box;
}

.threshold-field input:focus {
  border-color: var(--shell-accent);
  outline: 2px solid rgba(228, 190, 99, 0.45);
}

.threshold-scopes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.scope-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--shell-text);
  cursor: pointer;
}

.scope-toggle input {
  accent-color: var(--shell-accent-deep);
}

.threshold-badge {
  margin-inline-start: auto;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: rgba(228, 190, 99, 0.16);
  color: var(--shell-accent);
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
}
</style>
