import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/',
    redirect: '/sales/home'
  },
  {
    // OnlyOffice 文档编辑页面（全屏，独立页签）
    path: '/onlyoffice/editor',
    name: 'OnlyOfficeEditor',
    component: () => import('@/views/OnlyOffice/EditorPage.vue'),
    meta: { title: '文档编辑' }
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
        path: 'product-search',
        name: 'SalesProductSearch',
        component: () => import('@/views/Sales/ProductSearchResult.vue'),
        meta: { title: '产品搜索结果' }
      },
      {
        path: 'customer-search',
        name: 'SalesCustomerSearch',
        component: () => import('@/views/Sales/CustomerSearchResult.vue'),
        meta: { title: '客户搜索结果' }
      },
      {
        path: 'question-search',
        name: 'SalesQuestionSearch',
        component: () => import('@/views/Sales/QuestionSearchResult.vue'),
        meta: { title: '问题搜索结果' }
      },
      {
        path: 'qa',
        name: 'SalesQA',
        component: () => import('@/views/Sales/QA.vue'),
        meta: { title: '客户关心问题' }
      },
      {
        path: 'competitor',
        name: 'SalesCompetitor',
        component: () => import('@/views/Sales/CompetitorAnalysis.vue'),
        meta: { title: '竞品分析' }
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
      {
        path: 'system/product',
        name: 'SystemProduct',
        component: () => import('@/views/Admin/System/Product/index.vue'),
        meta: { title: '产品解决方案' }
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

import { useAuthStore } from '@/store/auth'

router.beforeEach((to, _from, next) => {
  if (to.meta.public) return next()
  const authStore = useAuthStore()
  if (!authStore.isLoggedIn) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }
  next()
})

export default router



