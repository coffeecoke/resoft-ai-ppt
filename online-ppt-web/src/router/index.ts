import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/ppt/admin/templates'
  },
  {
    path: '/ppt',
    component: () => import('@/views/PPT/Layout.vue'),
    children: [
      {
        path: 'editor',
        name: 'Editor',
        component: () => import('@/views/Editor/index.vue'),
        meta: { title: 'PPT编辑器' }
      },
      {
        path: 'screen',
        name: 'Screen',
        component: () => import('@/views/Screen/index.vue'),
        meta: { title: '演示模式' }
      },
      {
        path: 'mobile',
        name: 'Mobile',
        component: () => import('@/views/Mobile/index.vue'),
        meta: { title: '移动端', requireMobile: true }
      },
      {
        path: 'admin',
        name: 'admin',
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
      },
      {
        path: 'docs',
        name: 'DocumentList',
        component: () => import('@/views/Docs/index.vue'),
        meta: { title: '我的文档' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})

// 设置页面标题
router.afterEach((to) => {
  if (to.meta.title) {
    document.title = to.meta.title as string
  }
})

export default router



