import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/sales/home'
  },
  {
    path: '/sales',
    component: () => import('@/views/Sales/Layout.vue'),
    children: [
      {
        path: 'home',
        name: 'SalesHome',
        component: () => import('@/views/Sales/Home.vue'),
        meta: { title: '售前平台 - 首页' }
      },
      {
        path: 'product',
        name: 'SalesProduct',
        component: () => import('@/views/Sales/Product.vue'),
        meta: { title: '产品介绍PPT' }
      },
      {
        path: 'qa',
        name: 'SalesQA',
        component: () => import('@/views/Sales/QA.vue'),
        meta: { title: '客户关心问题' }
      },
      {
        path: 'profile',
        name: 'SalesProfile',
        component: () => import('@/views/Sales/Profile.vue'),
        meta: { title: '个人中心' }
      }
    ]
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
          },
        ]
      },
      {
        path: 'docs',
        name: 'DocumentList',
        component: () => import('@/views/Docs/index.vue'),
        meta: { title: '我的文档' }
      },
      
    ]
  },
  {
    path: '/admin',
    component: () => import('@/views/Admin/Layout.vue'),
    children: [
      {
        path: '',
        redirect: '/admin/system/role'
      },
      // 系统管理
      {
        path: 'system/role',
        name: 'SystemRole',
        component: () => import('@/views/Admin/System/Role/index.vue'),
        meta: { title: '角色管理' }
      },
      {
        path: 'system/user',
        name: 'SystemUser',
        component: () => import('@/views/Admin/System/User/index.vue'),
        meta: { title: '用户管理' }
      },
      {
        path: 'system/dept',
        name: 'SystemDept',
        component: () => import('@/views/Admin/System/Dept/index.vue'),
        meta: { title: '部门管理' }
      },
      {
        path: 'system/dict',
        name: 'SystemDict',
        component: () => import('@/views/Admin/System/Dict/index.vue'),
        meta: { title: '字典管理' }
      },
      // 文档管理
      {
        path: 'document/template',
        name: 'DocumentTemplate',
        component: () => import('@/views/Admin/Document/Template/index.vue'),
        meta: { title: '模版管理' }
      },
      {
        path: 'document/document',
        name: 'DocumentDocument',
        component: () => import('@/views/Admin/Document/Document/index.vue'),
        meta: { title: '文档管理' }
      },
      {
        path: 'document/file-scan',
        name: 'DocumentFileScan',
        component: () => import('@/views/Admin/Document/FileScan/index.vue'),
        meta: { title: '文件扫描' }
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



