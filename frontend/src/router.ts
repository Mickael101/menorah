import { createRouter, createWebHistory } from 'vue-router';
import AdminEntry from './pages/AdminEntry.vue';
import DisplayPage from './pages/DisplayPage.vue';
import DisplayPage8 from './pages/DisplayPage8.vue';
import DisplayHiddenPage from './pages/DisplayHiddenPage.vue';
import DonorPledgePage from './pages/DonorPledgePage.vue';

// Routage multi-soirees (contrat § Routage frontend). Deux familles :
//   - routes HERITEES (/admin, /don, /display...) : resolues sur la soiree
//     ACTIVE, comportement d'aujourd'hui conserve. Des QR codes vers /don sont
//     peut-etre deja imprimes : elles ne bougent pas.
//   - routes PREFIXEES /e/:slug/... : resolues sur la soiree nommee.
//
// Les routes display pointent vers les composants Display EXISTANTS, sans les
// modifier : le contexte slug est resolu par useEventContext ; sa consommation
// par les Display (aujourd'hui elles montrent la soiree active) est cablee
// APRES le merge du front DD.
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/admin'
    },

    // Admin : soiree active (heritee) ou nommee. AdminEntry porte la resolution
    // de contexte, l'ecran de connexion et le selecteur organisateur.
    {
      path: '/admin',
      name: 'admin',
      component: AdminEntry
    },
    {
      path: '/e/:slug/admin',
      name: 'event-admin',
      component: AdminEntry
    },

    // Page de don publique.
    {
      path: '/don',
      name: 'don',
      component: DonorPledgePage
    },
    {
      path: '/donate',
      redirect: '/don'
    },
    {
      path: '/e/:slug/don',
      name: 'event-don',
      component: DonorPledgePage
    },

    // Ecrans publics.
    {
      path: '/display',
      name: 'display',
      component: DisplayPage
    },
    {
      path: '/e/:slug/display',
      name: 'event-display',
      component: DisplayPage
    },
    {
      path: '/display-light',
      name: 'display-light',
      component: DisplayPage8
    },
    {
      path: '/e/:slug/display-light',
      name: 'event-display-light',
      component: DisplayPage8
    },
    {
      path: '/display-hidden',
      name: 'display-hidden',
      component: DisplayHiddenPage
    },
    {
      path: '/e/:slug/display-hidden',
      name: 'event-display-hidden',
      component: DisplayHiddenPage
    }
  ]
});

export default router;
