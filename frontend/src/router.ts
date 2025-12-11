import { createRouter, createWebHistory } from 'vue-router';
import AdminPanel from './pages/AdminPanel.vue';
import DisplayPage from './pages/DisplayPage.vue';
import MenorahAlt2 from './pages/MenorahAlt2.vue';
import DonorsPage from './pages/DonorsPage.vue';
import ChartPage from './pages/ChartPage.vue';
import MenorahAscension from './pages/MenorahAscension.vue';
import MenorahRespiration from './pages/MenorahRespiration.vue';
import MenorahSymphonie from './pages/MenorahSymphonie.vue';
import MenorahJackpot from './pages/MenorahJackpot.vue';
import MenorahIncandescent from './pages/MenorahIncandescent.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/admin'
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminPanel
    },
    {
      path: '/display',
      name: 'display',
      component: DisplayPage
    },
    {
      path: '/menorah',
      name: 'menorah',
      component: MenorahAlt2
    },
    {
      path: '/donors',
      name: 'donors',
      component: DonorsPage
    },
    {
      path: '/chart',
      name: 'chart',
      component: ChartPage
    },
    {
      path: '/menorah-ascension',
      name: 'menorah-ascension',
      component: MenorahAscension
    },
    {
      path: '/menorah-respiration',
      name: 'menorah-respiration',
      component: MenorahRespiration
    },
    {
      path: '/menorah-symphonie',
      name: 'menorah-symphonie',
      component: MenorahSymphonie
    },
    {
      path: '/menorah-jackpot',
      name: 'menorah-jackpot',
      component: MenorahJackpot
    },
    {
      path: '/menorah-incandescent',
      name: 'menorah-incandescent',
      component: MenorahIncandescent
    }
  ]
});

export default router;
