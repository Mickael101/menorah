import { computed, ref } from 'vue';

// Contexte de soiree resolu depuis la route (contrat § Routage frontend).
//
// Deux sources, jamais un repli silencieux de l'une sur l'autre :
//   - /e/:slug/...  -> GET /api/events/by-slug/:slug (public). Slug inconnu =>
//     etat `notFound`, JAMAIS la soiree active a la place : afficher les dons de
//     la soiree A sur l'ecran de la soiree B est exactement ce que le
//     multi-evenements existe pour empecher.
//   - route heritee (/admin, /don, /display...) -> GET /api/events/active
//     (public). C'est le comportement d'aujourd'hui : la soiree active.
//
// Portee AMBIANTE (`scopedEventId`) : c'est la couture retro-compatible avec le
// front DD. Les composables (`useDonations`, `adminFetch`) lisent cette portee
// pour choisir entre les routes heritees (portee nulle => soiree active, comme
// aujourd'hui) et les routes prefixees `/api/events/:id/...`. Une page qui
// n'appelle jamais `resolve()` laisse la portee a null : signature et
// comportement inchanges. Seul un slug resolu pose une portee.

export interface EventContext {
  id: number;
  slug: string;
  name: string;
  status: string;
  logoUrl: string | null;
  defaultLocale: string;
  currency: string;
}

// null = soiree active (routes heritees). Un nombre = soiree nommee (routes
// prefixees). Lue par useDonations et useAdminAuth ; ne jamais l'ecrire
// ailleurs qu'ici.
const scopedEventId = ref<number | null>(null);
const currentEvent = ref<EventContext | null>(null);
const ready = ref(false);
const notFound = ref(false);
const multipleActive = ref(false);

// Accesseur non reactif pour les modules hors composant (adminFetch, builders
// d'URL) : ils construisent une URL a l'instant de l'appel, sans reactivite.
export function currentEventScope(): number | null {
  return scopedEventId.value;
}

async function resolveBySlug(slug: string): Promise<void> {
  const response = await fetch(`/api/events/by-slug/${encodeURIComponent(slug)}`);
  if (response.status === 404) {
    notFound.value = true;
    currentEvent.value = null;
    scopedEventId.value = null;
    return;
  }
  if (!response.ok) {
    throw new Error('Failed to resolve event slug');
  }
  const data = await response.json();
  currentEvent.value = data.event as EventContext;
  // Slug resolu => routes prefixees sur CETTE soiree.
  scopedEventId.value = data.event.id;
}

async function resolveActive(): Promise<void> {
  const response = await fetch('/api/events/active');
  if (!response.ok) {
    throw new Error('Failed to resolve active event');
  }
  const data = await response.json();
  currentEvent.value = (data.event ?? null) as EventContext | null;
  multipleActive.value = Boolean(data.multipleActive);
  // Route heritee => portee nulle : les composables emploient les routes
  // heritees, resolues cote serveur sur la soiree active. Byte-identique a
  // aujourd'hui.
  scopedEventId.value = null;
}

export function useEventContext() {
  // Resout le contexte selon la presence d'un slug. Idempotent : peut etre
  // rappele quand la route change (watch sur route.params.slug).
  async function resolve(slug: string | null | undefined): Promise<void> {
    ready.value = false;
    notFound.value = false;
    multipleActive.value = false;
    try {
      if (slug) {
        await resolveBySlug(slug);
      } else {
        await resolveActive();
      }
    } finally {
      ready.value = true;
    }
  }

  // Remet le contexte a l'etat neutre (soiree active) : a appeler au demontage
  // d'une page prefixee pour ne pas laisser fuiter sa portee sur la page
  // suivante.
  function clear(): void {
    scopedEventId.value = null;
    currentEvent.value = null;
    notFound.value = false;
    multipleActive.value = false;
    ready.value = false;
  }

  const event = computed(() => currentEvent.value);
  const eventId = computed(() => currentEvent.value?.id ?? null);
  const slug = computed(() => currentEvent.value?.slug ?? null);

  return {
    event,
    eventId,
    slug,
    ready,
    notFound,
    multipleActive,
    resolve,
    clear
  };
}
