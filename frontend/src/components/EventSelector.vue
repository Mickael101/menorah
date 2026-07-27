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

onMounted(async () => {
  try {
    const res = await adminFetch('/api/events');
    if (res.ok) {
      const data = await res.json();
      events.value = data.events as EventSummary[];
    }
  } finally {
    loading.value = false;
  }
});

function open(slug: string): void {
  router.push(`/e/${slug}/admin`);
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
        <li v-for="ev in events" :key="ev.id">
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
        </li>
      </ul>
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

@media (max-width: 520px) {
  .selector-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
