import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import { TOKEN_KEY } from '../constants/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/login/LoginView.vue'),
      meta: { title: '登录', public: true },
    },
    {
      path: '/',
      component: AppLayout,
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('../views/dashboard/DashboardView.vue'),
          meta: { title: '工作台' },
        },
        {
          path: 'categories',
          name: 'categories',
          component: () => import('../views/catalog/CategoryView.vue'),
          meta: { title: '分类管理' },
        },
        {
          path: 'products',
          name: 'products',
          component: () => import('../views/catalog/ProductView.vue'),
          meta: { title: '商品管理' },
        },
        {
          path: 'specs',
          name: 'specs',
          component: () => import('../views/catalog/SpecView.vue'),
          meta: { title: '规格管理' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem(TOKEN_KEY)

  if (!to.meta.public && !token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && token) {
    return { name: 'dashboard' }
  }
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? '管理端')} · ToCoffee`
})

export default router
