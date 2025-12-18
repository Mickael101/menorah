import { createRouter, createWebHistory } from 'vue-router';
import AdminPanel from './pages/AdminPanel.vue';
import DisplayPage from './pages/DisplayPage.vue';
import DisplayPage8 from './pages/DisplayPage8.vue';
import DisplayHiddenPage from './pages/DisplayHiddenPage.vue';

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
      path: '/display-light',
      name: 'display-light',
      component: DisplayPage8
    },
    {
      path: '/display-hidden',
      name: 'display-hidden',
      component: DisplayHiddenPage
    }
  ]
});

export default router;
