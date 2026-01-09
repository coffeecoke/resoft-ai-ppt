/**
 * 管理后台菜单配置
 * 
 * 定义左侧导航菜单结构
 */

export interface MenuItem {
  path: string
  name: string
  icon?: string
  children?: MenuItem[]
  meta?: {
    title?: string
    hidden?: boolean
  }
}

export const adminMenus: MenuItem[] = [
  {
    path: '/admin/system',
    name: '系统管理',
    icon: 'Setting',
    children: [
      {
        path: '/admin/system/role',
        name: '角色管理',
        meta: { title: '角色管理' }
      },
      {
        path: '/admin/system/user',
        name: '用户管理',
        meta: { title: '用户管理' }
      },
      {
        path: '/admin/system/dept',
        name: '部门管理',
        meta: { title: '部门管理' }
      },
      {
        path: '/admin/system/dict',
        name: '字典管理',
        meta: { title: '字典管理' }
      }
    ]
  },
  {
    path: '/admin/document',
    name: '文档管理',
    icon: 'Document',
    children: [
      {
        path: '/admin/document/template',
        name: '模版管理',
        meta: { title: '模版管理' }
      },
      {
        path: '/admin/document/document',
        name: '文档管理',
        meta: { title: '文档管理' }
      },
      {
        path: '/admin/document/file-scan',
        name: '文件扫描',
        meta: { title: '文件扫描' }
      }
    ]
  }
]

