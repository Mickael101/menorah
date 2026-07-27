<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useEventContext } from '../composables/useEventContext';
import { adminFetch, setAdminToken, authExpired } from '../composables/useAdminAuth';
import { useAdminI18n } from '../composables/useAdminI18n';
import AdminPanel from './AdminPanel.vue';
import AdminLogin from '../components/AdminLogin.vue';
import EventSelector from '../components/EventSelector.vue';

// Point d'entree de l'administration, herite (/admin) comme prefixe
// (/e/:slug/admin). Porte : la resolution du contexte de soiree, le gate
// d'authentification par ecran de connexion (le window.prompt disparait), le
// selecteur organisateur sur /admin, et l'ecran 404 pour un slug inconnu (jamais
// de repli silencieux sur une autre soiree).
const route = useRoute();
const { t, direction, locale } = useAdminI18n();
const { event, eventId, notFound, resolve, clear } = useEventContext();

type Phase = 'resolving' | 'notFound' | 'noActiveEvent' | 'login' | 'selector' | 'ready';
const phase = ref<Phase>('resolving');
const loginError = ref<'401' | '403' | 'generic' | null>(null);
const checking = ref(false);

const slugParam = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : null));
const eventName = computed(() => event.value?.name ?? null);

// Sonde l'acces admin pour la cible courante. adminFetch cible la route
// prefixee et injecte le jeton via la portee ambiante posee par resolve().
type ProbeResult = 'ok' | '401' | '403' | 'error';
async function probeAdmin(): Promise<ProbeResult> {
  try {
    const res = await adminFetch('/api/donations?full=1');
    if (res.ok) return 'ok';
    if (res.status === 401) return '401';
    if (res.status === 403) return '403';
    return 'error';
  } catch {
    return 'error';
  }
}

// Detecte l'organisateur : GET /api/events est reserve au niveau organisateur.
// Le 401 d'un admin de soiree est la reponse ATTENDUE de cette sonde, pas une
// expiration de session : `expectAuthFailure` empeche adminFetch de lever
// `authExpired` (sans quoi le gate se renverrait lui-meme vers la connexion).
async function probeOrganizer(): Promise<boolean> {
  try {
    const res = await adminFetch('/api/events', {}, { expectAuthFailure: true });
    return res.ok;
  } catch {
    return false;
  }
}

// Re-execute le gate. `initial` = arrivee sur la page (aucune erreur affichee si
// le jeton manque) ; sinon, on vient d'une soumission de code et on affiche
// l'erreur.
async function runGate(initial: boolean): Promise<void> {
  // Portee heritee (/admin) : la seule ou la question « organisateur ou admin de
  // la soiree active ? » se pose.
  const legacyScope = !slugParam.value;
  if (legacyScope && await probeOrganizer()) {
    // Organisateur => selecteur ; sinon on poursuit comme admin de la soiree
    // active (comportement d'aujourd'hui).
    phase.value = 'selector';
    return;
  }

  const result = await probeAdmin();
  if (result === 'ok') {
    phase.value = 'ready';
    return;
  }

  // Aucune soiree active resolue et pas organisateur : les routes heritees
  // repondent 503 une fois l'AUTHENTIFICATION FRANCHIE (requireEventAdmin est
  // monte avant resolveActiveEvent), si bien qu'un code par ailleurs valide ne
  // mene nulle part. On oriente alors vers le lien de SA soiree
  // (/e/:slug/admin) plutot que de boucler sur l'ecran de connexion.
  //
  // Le test est fait APRES probeAdmin() et EXCLUT les echecs d'auth (401/403) :
  // avant, il suffisait qu'aucune soiree ne soit active pour tomber ici, donc
  // une simple FAUTE DE FRAPPE dans le jeton organisateur envoyait sur un ecran
  // sans champ de code, sans message et — a la difference de 'notFound' — sans
  // lien de retour : back-office inatteignable jusqu'a un rechargement, mauvais
  // jeton conserve en storage. Un echec d'authentification doit rester un echec
  // d'authentification et repartir vers AdminLogin avec son message.
  //
  // `!initial` : au premier affichage on laisse l'ecran de connexion, sans quoi
  // l'organisateur — encore sans jeton, donc indistinguable ici — ne pourrait
  // plus se connecter pour atteindre le selecteur.
  if (legacyScope && !initial && event.value === null && result === 'error') {
    phase.value = 'noActiveEvent';
    return;
  }

  phase.value = 'login';
  loginError.value = initial ? null : (result === '403' ? '403' : result === '401' ? '401' : 'generic');
}

let sequence = 0;
async function init(): Promise<void> {
  const current = ++sequence;
  phase.value = 'resolving';
  loginError.value = null;
  await resolve(slugParam.value);
  if (current !== sequence) return; // une navigation plus recente a pris la main

  if (notFound.value) {
    phase.value = 'notFound';
    return;
  }
  await runGate(true);
}

async function onLogin(code: string): Promise<void> {
  checking.value = true;
  loginError.value = null;
  // Jeton range PAR SOIREE sur une route prefixee (une connexion a une autre
  // soiree n'ecrase plus rien) ; sur /admin herite, sous la cle historique
  // (jeton organisateur ou soiree active).
  setAdminToken(code, slugParam.value ? eventId.value : null);
  await runGate(false);
  checking.value = false;
}

watch(slugParam, () => { void init(); }, { immediate: true });

// Expiration EN COURS de session : adminFetch leve `authExpired` quand un jeton
// reellement envoye est rejete (401) — typiquement l'organisateur a regenere le
// code alors que le panneau etait ouvert. Sans ce chemin de retour, chaque
// action admin echouait en silence et l'ecran de connexion restait inatteignable
// sans rechargement manuel.
//
// Le signal est BAISSE dans tous les cas (re-arme pour la prochaine expiration :
// un drapeau laisse a true ne declencherait plus jamais ce watch). La bascule
// vers la connexion, elle, n'a lieu que depuis un ecran deja ouvert : pendant
// 'resolving' ou 'login', le gate a deja la main et ecraserait de toute facon la
// phase — le gate initial reste donc intact.
watch(authExpired, (expired) => {
  if (!expired) return;
  authExpired.value = false;
  if (phase.value === 'ready' || phase.value === 'selector') {
    phase.value = 'login';
    loginError.value = '401';
  }
});

onUnmounted(() => {
  clear();
});
</script>

<template>
  <div v-if="phase === 'resolving'" class="entry-state" :dir="direction" :lang="locale">
    <p>{{ t('event.loading') }}</p>
  </div>

  <div v-else-if="phase === 'notFound'" class="entry-state entry-notfound" :dir="direction" :lang="locale">
    <div class="notfound-card">
      <h1>{{ t('event.notFoundTitle') }}</h1>
      <p>{{ t('event.notFoundMessage') }}</p>
      <a href="/admin" class="notfound-link">{{ t('event.backToAdmin') }}</a>
    </div>
  </div>

  <div v-else-if="phase === 'noActiveEvent'" class="entry-state entry-notfound" :dir="direction" :lang="locale">
    <div class="notfound-card">
      <h1>{{ t('event.noActiveTitle') }}</h1>
      <p>{{ t('event.noActiveMessage') }}</p>
      <!-- Sortie de secours, comme la carte 'notFound' voisine : sans elle,
           cet ecran n'offre ni champ de code ni retour, et seul un rechargement
           manuel en sort. Lien plein (pas router-link) : on veut le rechargement
           qui rejoue le gate initial et ramene a l'ecran de connexion. -->
      <a href="/admin" class="notfound-link">{{ t('event.backToAdmin') }}</a>
    </div>
  </div>

  <AdminLogin
    v-else-if="phase === 'login'"
    :event-name="eventName"
    :error="loginError"
    :checking="checking"
    @submit="onLogin"
  />

  <EventSelector v-else-if="phase === 'selector'" />

  <AdminPanel v-else />
</template>

<style scoped>
/* Ecrans-couverture (chargement, 404) tokenises, alignes sur l'ecran de
   connexion frere (AdminLogin) : la coquille admin suit la bascule clair/sombre.
   Les aplats or (CTA) gardent l'or via --shell-accent-flat dans les deux modes. */
.entry-state {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: radial-gradient(ellipse at top, var(--shell-raised) 0%, var(--shell-page) 60%);
  color: var(--shell-text);
  box-sizing: border-box;
}

.notfound-card {
  max-width: 420px;
  text-align: center;
  background: var(--shell-card);
  border: 1px solid var(--shell-border);
  border-radius: 18px;
  padding: 32px 26px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.25);
}

.notfound-card h1 {
  font-size: 22px;
  margin: 0 0 10px;
  color: var(--shell-accent);
}

.notfound-card p {
  font-size: 14px;
  color: var(--shell-text-muted);
  margin: 0 0 22px;
}

.notfound-link {
  display: inline-block;
  background: linear-gradient(135deg, var(--shell-accent-flat) 0%, var(--shell-accent-flat-deep) 100%);
  color: var(--shell-on-accent);
  border-radius: 12px;
  padding: 12px 22px;
  font-size: 14px;
  font-weight: 800;
  text-decoration: none;
}
</style>
