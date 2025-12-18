import { createRouter, createWebHistory } from 'vue-router';
import AdminPanel from './pages/AdminPanel.vue';
import DisplayPage from './pages/DisplayPage.vue';
import DisplayPage2 from './pages/DisplayPage2.vue';
import DisplayPage3 from './pages/DisplayPage3.vue';
import DisplayPage4 from './pages/DisplayPage4.vue';
import DisplayPage5 from './pages/DisplayPage5.vue';
import DisplayPage6 from './pages/DisplayPage6.vue';
import DisplayPage7 from './pages/DisplayPage7.vue';
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
      path: '/display4',
      name: 'display4',
      component: DisplayPage4
    },
    {
      path: '/display5',
      name: 'display5',
      component: DisplayPage5
    },
    {
      path: '/display6',
      name: 'display6',
      component: DisplayPage6
    },
    {
      path: '/display7',
      name: 'display7',
      component: DisplayPage7
    },
    {
      path: '/display8',
      name: 'display8',
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
