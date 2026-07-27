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
.selector-screen {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: radial-gradient(ellipse at top, #131731 0%, #070914 60%);
  color: #f7f3ea;
  box-sizing: border-box;
}

.selector-card {
  width: 100%;
  max-width: 560px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(228, 190, 99, 0.22);
  border-radius: 18px;
  padding: 28px 24px;
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
}

.selector-title {
  font-size: 22px;
  margin: 0 0 6px;
  color: #f2cc72;
  text-align: center;
}

.selector-desc {
  font-size: 14px;
  color: rgba(247, 243, 234, 0.65);
  text-align: center;
  margin: 0 0 22px;
}

.selector-loading,
.selector-empty {
  text-align: center;
  color: rgba(247, 243, 234, 0.6);
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
  background: rgba(7, 9, 20, 0.55);
  border: 1.5px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  color: #f7f3ea;
  cursor: pointer;
  transition: all 0.2s;
  text-align: start;
}

.selector-item:hover {
  border-color: rgba(228, 190, 99, 0.6);
  background: rgba(228, 190, 99, 0.08);
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
  color: rgba(247, 243, 234, 0.5);
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

.status-active {
  background: rgba(79, 192, 138, 0.18);
  color: #7fe0b0;
}

.status-draft {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(247, 243, 234, 0.7);
}

.status-archived {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(247, 243, 234, 0.45);
}

.item-amount {
  font-size: 14px;
  font-weight: 700;
  color: #f2cc72;
}

@media (max-width: 520px) {
  .selector-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
