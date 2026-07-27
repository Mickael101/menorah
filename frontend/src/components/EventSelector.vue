<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { adminFetch } from '../composables/useAdminAuth';
import { useDonations } from '../composables/useDonations';
import { useAdminI18n } from '../composables/useAdminI18n';

// Selecteur de soiree pour l'organisateur, sur /admin herite (contrat). Liste
// les soirees via GET /api/events (organisateur) et renvoie vers
// /e/:slug/admin, ou l'admin de soiree prend le relais.
interface EventSummary {
  id: number;
  slug: string;
  name: string;
  status: 'draft' | 'active' | 'archived';
  donationCount: number;
  totalAmount: number;
}

const router = useRouter();
const { t, direction, locale } = useAdminI18n();
const { formatAmount } = useDonations();

const events = ref<EventSummary[]>([]);
const loading = ref(true);

async function loadEvents(): Promise<void> {
  try {
    const res = await adminFetch('/api/events');
    if (res.ok) {
      const data = await res.json();
      events.value = data.events as EventSummary[];
    }
  } finally {
    loading.value = false;
  }
}

onMounted(loadEvents);

function open(slug: string): void {
  router.push(`/e/${slug}/admin`);
}

// --- Creation d'une soiree (organisateur). Le code admin renvoye par le POST
// n'est affiche qu'UNE fois (le backend ne stocke que son empreinte) : le bloc
// de succes reste a l'ecran tant que l'organisateur ne l'a pas ferme.
const showCreate = ref(false);
const newName = ref('');
const slugTouched = ref(false);
const newSlug = ref('');
const creating = ref(false);
const createError = ref('');
const created = ref<{ event: EventSummary; adminCode: string } | null>(null);
const codeCopied = ref(false);

// Translitteration minimale : un nom hebreu produit un slug vide -> l'
// organisateur le remplit lui-meme (champ toujours editable).
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function onNameInput(): void {
  if (!slugTouched.value) {
    newSlug.value = slugify(newName.value);
  }
}

async function submitCreate(): Promise<void> {
  if (creating.value) return;
  createError.value = '';
  creating.value = true;
  try {
    const res = await adminFetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.value.trim(), slug: newSlug.value.trim() })
    });
    if (res.status === 409) {
      createError.value = t('selector.slugTaken');
      return;
    }
    if (!res.ok) {
      createError.value = t('selector.createError');
      return;
    }
    const data = await res.json();
    created.value = { event: data.event as EventSummary, adminCode: data.adminCode as string };
    showCreate.value = false;
    newName.value = '';
    newSlug.value = '';
    slugTouched.value = false;
    await loadEvents();
  } catch {
    createError.value = t('selector.createError');
  } finally {
    creating.value = false;
  }
}

async function copyCode(): Promise<void> {
  if (!created.value) return;
  try {
    await navigator.clipboard.writeText(created.value.adminCode);
    codeCopied.value = true;
    setTimeout(() => { codeCopied.value = false; }, 2500);
  } catch {
    // clipboard indisponible : le code reste visible, copie manuelle
  }
}

// --- Activation / archivage par ligne (PUT /api/events/:id). Deux clics :
// le premier arme la confirmation, le second execute — pas de dialogue bloquant.
const pendingAction = ref<number | null>(null);

async function toggleStatus(ev: EventSummary): Promise<void> {
  if (pendingAction.value !== ev.id) {
    pendingAction.value = ev.id;
    setTimeout(() => { if (pendingAction.value === ev.id) pendingAction.value = null; }, 4000);
    return;
  }
  pendingAction.value = null;
  const nextStatus = ev.status === 'active' ? 'archived' : 'active';
  const res = await adminFetch(`/api/events/${ev.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: nextStatus })
  });
  if (res.ok) {
    await loadEvents();
  }
}
</script>

<template>
  <div class="selector-screen" :dir="direction" :lang="locale">
    <div class="selector-card">
      <h1 class="selector-title">{{ t('selector.title') }}</h1>
      <p class="selector-desc">{{ t('selector.description') }}</p>

      <p v-if="loading" class="selector-loading">{{ t('event.loading') }}</p>
      <p v-else-if="events.length === 0" class="selector-empty">{{ t('selector.empty') }}</p>

      <ul v-else class="selector-list">
        <li v-for="ev in events" :key="ev.id" class="selector-row">
          <button type="button" class="selector-item" @click="open(ev.slug)">
            <span class="item-main">
              <span class="item-name" dir="auto">{{ ev.name }}</span>
              <span class="item-slug">/{{ ev.slug }}</span>
            </span>
            <span class="item-meta">
              <span class="item-status" :class="`status-${ev.status}`">
                {{ t(`selector.status.${ev.status}`) }}
              </span>
              <span class="item-amount">{{ formatAmount(ev.totalAmount) }}</span>
            </span>
          </button>
          <button
            type="button"
            class="status-action"
            :class="{ danger: ev.status === 'active', armed: pendingAction === ev.id }"
            @click="toggleStatus(ev)"
          >
            {{ pendingAction === ev.id
              ? t('selector.confirmAction')
              : (ev.status === 'active' ? t('selector.archive') : t('selector.activate')) }}
          </button>
        </li>
      </ul>

      <!-- Code admin affiche UNE seule fois, a la creation -->
      <div v-if="created" class="created-box" role="alert">
        <p class="created-title">{{ t('selector.createdTitle') }} — <span dir="auto">{{ created.event.name }}</span></p>
        <p class="created-code-label">{{ t('selector.codeLabel') }}</p>
        <div class="created-code-row">
          <code class="created-code">{{ created.adminCode }}</code>
          <button type="button" class="copy-btn" @click="copyCode">
            {{ codeCopied ? t('selector.copied') : t('selector.copy') }}
          </button>
        </div>
        <p class="created-warning">{{ t('selector.codeWarning') }}</p>
        <div class="created-actions">
          <button type="button" class="primary-btn" @click="open(created.event.slug)">{{ t('selector.open') }}</button>
          <button type="button" class="ghost-btn" @click="created = null">{{ t('selector.cancel') }}</button>
        </div>
      </div>

      <!-- Creation -->
      <form v-if="showCreate && !created" class="create-form" @submit.prevent="submitCreate">
        <label for="new-event-name">{{ t('selector.nameLabel') }}</label>
        <input
          id="new-event-name"
          v-model="newName"
          type="text"
          maxlength="120"
          :placeholder="t('selector.namePlaceholder')"
          @input="onNameInput"
        />
        <label for="new-event-slug">{{ t('selector.slugLabel') }}</label>
        <input
          id="new-event-slug"
          v-model="newSlug"
          type="text"
          dir="ltr"
          maxlength="60"
          spellcheck="false"
          @input="slugTouched = true"
        />
        <p v-if="createError" class="create-error" role="alert">{{ createError }}</p>
        <div class="created-actions">
          <button type="submit" class="primary-btn" :disabled="creating || !newName.trim() || !newSlug.trim()">
            {{ creating ? t('selector.creating') : t('selector.createSubmit') }}
          </button>
          <button type="button" class="ghost-btn" @click="showCreate = false; createError = ''">{{ t('selector.cancel') }}</button>
        </div>
      </form>
      <button v-if="!showCreate && !created" type="button" class="create-toggle" @click="showCreate = true">
        + {{ t('selector.create') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Ecran-couverture tokenise, aligne sur l'ecran de connexion frere
   (AdminLogin) : la coquille admin suit la bascule clair/sombre, seuls les
   ecrans publics gardent le theme de la soiree. */
.selector-screen {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: radial-gradient(ellipse at top, var(--shell-raised) 0%, var(--shell-page) 60%);
  color: var(--shell-text-strong);
  box-sizing: border-box;
}

.selector-card {
  width: 100%;
  max-width: 560px;
  background: var(--shell-card);
  border: 1px solid var(--shell-border);
  border-radius: 18px;
  padding: 28px 24px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.25);
}

.selector-title {
  font-size: 22px;
  margin: 0 0 6px;
  color: var(--shell-accent);
  text-align: center;
}

.selector-desc {
  font-size: 14px;
  color: var(--shell-text-muted);
  text-align: center;
  margin: 0 0 22px;
}

.selector-loading,
.selector-empty {
  text-align: center;
  color: var(--shell-text-muted);
  padding: 20px 0;
}

.selector-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.selector-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  /* Ligne en creux dans la carte (motif .word-item / .copy-group). */
  background: var(--shell-page);
  border: 1.5px solid var(--shell-border);
  border-radius: 12px;
  color: var(--shell-text);
  cursor: pointer;
  transition: all 0.2s;
  text-align: start;
}

.selector-item:hover {
  border-color: var(--shell-accent);
  background: color-mix(in srgb, var(--shell-accent) 12%, var(--shell-page));
}

.item-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.item-name {
  font-size: 16px;
  font-weight: 700;
}

.item-slug {
  font-size: 12px;
  color: var(--shell-text-muted);
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.item-status {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 9px;
  border-radius: 999px;
}

/* Pastilles de statut : semantiques, tokenisees. « active » porte le vert de
   succes ; « draft »/« archived » restent neutres et se distinguent par
   l'intensite du texte (archived plus estompe). */
.status-active {
  background: color-mix(in srgb, var(--shell-success) 18%, var(--shell-page));
  color: var(--shell-success);
}

.status-draft {
  background: var(--shell-raised);
  color: var(--shell-text);
}

.status-archived {
  background: var(--shell-raised);
  color: var(--shell-text-muted);
}

.item-amount {
  font-size: 14px;
  font-weight: 700;
  color: var(--shell-accent);
}

.selector-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.selector-row .selector-item {
  flex: 1;
  min-width: 0;
}

/* Activation/archivage : deux clics (arme puis confirme), pas de dialogue. */
.status-action {
  flex-shrink: 0;
  padding: 0 14px;
  border-radius: 12px;
  border: 1.5px solid var(--shell-border);
  background: var(--shell-raised);
  color: var(--shell-text);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.status-action.danger {
  color: var(--shell-error);
}

.status-action.armed {
  border-color: var(--shell-accent);
  background: color-mix(in srgb, var(--shell-accent) 16%, var(--shell-raised));
  color: var(--shell-text-strong);
}

.create-toggle {
  width: 100%;
  margin-top: 14px;
  padding: 13px;
  border-radius: 12px;
  border: 1.5px dashed var(--shell-border-strong);
  background: none;
  color: var(--shell-accent);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.create-toggle:hover {
  border-color: var(--shell-accent);
  background: color-mix(in srgb, var(--shell-accent) 8%, var(--shell-card));
}

.create-form {
  margin-top: 16px;
  text-align: start;
}

.create-form label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--shell-accent);
  margin: 12px 0 6px;
}

.create-form input {
  width: 100%;
  box-sizing: border-box;
  background: var(--field-bg);
  border: 1.5px solid var(--field-border);
  border-radius: 10px;
  color: var(--field-text);
  padding: 12px 13px;
  font-size: 15px;
}

.create-form input:focus {
  outline: none;
  border-color: var(--field-border-focus);
}

.create-error {
  background: color-mix(in srgb, var(--shell-error) 12%, var(--shell-card));
  border: 1px solid var(--shell-error);
  color: var(--shell-error);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  margin: 12px 0 0;
}

.created-box {
  margin-top: 16px;
  padding: 16px;
  border-radius: 12px;
  border: 1.5px solid var(--shell-accent);
  background: color-mix(in srgb, var(--shell-accent) 8%, var(--shell-card));
  text-align: start;
}

.created-title {
  font-weight: 700;
  color: var(--shell-text-strong);
  margin: 0 0 10px;
}

.created-code-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--shell-accent);
  margin: 0 0 6px;
}

.created-code-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.created-code {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  direction: ltr;
  background: var(--field-bg);
  color: var(--field-text);
  border: 1.5px solid var(--field-border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
}

.copy-btn {
  flex-shrink: 0;
  padding: 10px 14px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, var(--shell-accent-flat) 0%, var(--shell-accent-flat-deep) 100%);
  color: var(--shell-on-accent);
  font-weight: 700;
  cursor: pointer;
}

.created-warning {
  font-size: 13px;
  color: var(--shell-warning);
  margin: 10px 0 0;
}

.created-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.primary-btn {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, var(--shell-accent-flat) 0%, var(--shell-accent-flat-deep) 100%);
  color: var(--shell-on-accent);
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ghost-btn {
  padding: 12px 16px;
  border-radius: 10px;
  border: 1.5px solid var(--shell-border);
  background: none;
  color: var(--shell-text);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 520px) {
  .selector-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .selector-row {
    flex-direction: column;
  }

  .status-action {
    padding: 10px;
  }
}
</style>
