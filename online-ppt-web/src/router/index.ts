import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Editor',
    component: () => import('@/views/Editor/index.vue'),
    meta: { title: 'PPT编辑器' }
  },
  {
    path: '/screen',
    name: 'Screen',
    component: () => import('@/views/Screen/index.vue'),
    meta: { title: '演示模式' }
  },
  {
    path: '/mobile',
    name: 'Mobile',
    component: () => import('@/views/Mobile/index.vue'),
    meta: { title: '移动端' }
  },
  {
    path: '/admin',
    name: 'Admin',
    redirect: '/admin/templates',
    component: () => import('@/views/Admin/index.vue'),
    children: [
      {
        path: 'templates',
        name: 'TemplateList',
        component: () => import('@/views/Admin/TemplateList.vue'),
        meta: { title: '模板管理' }
      },
      {
        path: 'template-editor/:id?',
        name: 'TemplateEditor',
        component: () => import('@/views/Admin/TemplateEditor.vue'),
        meta: { title: '模板编辑器' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// 设置页面标题
router.afterEach((to) => {
  if (to.meta.title) {
    document.title = to.meta.title as string
  }
})

export default router



