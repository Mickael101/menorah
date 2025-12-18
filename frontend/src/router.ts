import { createRouter, createWebHistory } from 'vue-router';
import AdminPanel from './pages/AdminPanel.vue';
import DisplayPage from './pages/DisplayPage.vue';
import DisplayPage2 from './pages/DisplayPage2.vue';
import DisplayPage3 from './pages/DisplayPage3.vue';
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
      path: '/display2',
      name: 'display2',
      component: DisplayPage2
    },
    {
      path: '/display3',
      name: 'display3',
      component: DisplayPage3
    },
    {
      path: '/display-hidden',
      name: 'display-hidden',
      component: DisplayHiddenPage
    }
  ]
});

export default router;
