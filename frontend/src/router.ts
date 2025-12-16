import { createRouter, createWebHistory } from 'vue-router';
import AdminPanel from './pages/AdminPanel.vue';
import DisplayPage from './pages/DisplayPage.vue';

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
    }
  ]
});

export default router;
