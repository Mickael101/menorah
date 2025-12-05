import { createRouter, createWebHistory } from 'vue-router';
import AdminPanel from './pages/AdminPanel.vue';
import DisplayPage from './pages/DisplayPage.vue';
import MenorahAlt2 from './pages/MenorahAlt2.vue';
import Menorah1 from './pages/Menorah1.vue';
import Menorah2 from './pages/Menorah2.vue';
import Menorah3 from './pages/Menorah3.vue';
import Menorah4 from './pages/Menorah4.vue';
import Menorah7 from './pages/Menorah7.vue';
import Menorah8 from './pages/Menorah8.vue';
import Menorah9 from './pages/Menorah9.vue';
import DonorsPage from './pages/DonorsPage.vue';
import ChartPage from './pages/ChartPage.vue';

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
      path: '/menorah1',
      name: 'menorah1',
      component: Menorah1
    },
    {
      path: '/menorah2',
      name: 'menorah2',
      component: Menorah2
    },
    {
      path: '/menorah3',
      name: 'menorah3',
      component: Menorah3
    },
    {
      path: '/menorah4',
      name: 'menorah4',
      component: Menorah4
    },
    {
      path: '/menorah7',
      name: 'menorah7',
      component: Menorah7
    },
    {
      path: '/menorah8',
      name: 'menorah8',
      component: Menorah8
    },
    {
      path: '/menorah9',
      name: 'menorah9',
      component: Menorah9
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
    }
  ]
});

export default router;
