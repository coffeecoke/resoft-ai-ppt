<template>
  <div class="sidebar" :class="{ collapsed: isCollapsed }">
    <div class="logo">
      <img v-if="!isCollapsed" src="/logo.png" alt="Logo" class="logo-img" />
      <span v-if="!isCollapsed" class="logo-text">售前工作台管理</span>
      <span v-else class="logo-text-mini">管理</span>
    </div>
    
    <el-menu
      :default-active="activeMenu"
      :collapse="isCollapsed"
      :unique-opened="true"
      router
      class="admin-menu"
    >
      <template v-for="menu in adminMenus" :key="menu.path">
        <el-sub-menu v-if="menu.children && menu.children.length > 0" :index="menu.path">
          <template #title>
            <el-icon v-if="menu.icon && getIcon(menu.icon)">
              <component :is="getIcon(menu.icon)" />
            </el-icon>
            <span>{{ menu.name }}</span>
          </template>
          <el-menu-item
            v-for="child in menu.children"
            :key="child.path"
            :index="child.path"
          >
            {{ child.name }}
          </el-menu-item>
        </el-sub-menu>
        <el-menu-item v-else :index="menu.path">
          <el-icon v-if="menu.icon && getIcon(menu.icon)">
            <component :is="getIcon(menu.icon)" />
          </el-icon>
          <span>{{ menu.name }}</span>
        </el-menu-item>
      </template>
    </el-menu>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { adminMenus } from '@/configs/adminMenu'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

const route = useRoute()

// 折叠状态
const isCollapsed = ref(false)

// 图标映射
const iconMap: Record<string, any> = ElementPlusIconsVue

// 获取图标组件
const getIcon = (iconName?: string) => {
  if (!iconName) return null
  return iconMap[iconName] || null
}

// 当前激活的菜单
const activeMenu = computed(() => {
  const path = route.path
  // 精确匹配子菜单项
  for (const menu of adminMenus) {
    if (menu.children) {
      for (const child of menu.children) {
        if (path === child.path || path.startsWith(child.path + '/')) {
          return child.path
        }
      }
    }
  }
  return path
})

// 暴露折叠方法供外部调用
defineExpose({
  toggle: () => {
    isCollapsed.value = !isCollapsed.value
  },
  isCollapsed
})
</script>

<style lang="scss" scoped>
.sidebar {
  width: 200px;
  height: 100vh;
  background-color: #001529;
  transition: width 0.3s;
  overflow: hidden;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;

  &.collapsed {
    width: 64px;
  }

  .logo {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 18px;
    font-weight: 600;

    .logo-img {
      height: 20px;
      margin-right: 8px;
    }

    .logo-text {
      white-space: nowrap;
    }

    .logo-text-mini {
      font-size: 14px;
    }
  }

  .admin-menu {
    border: none !important;
    background-color: #001529 !important;
    height: calc(100vh - 60px);
    overflow-y: auto;

    // 菜单项基础样式
    :deep(.el-menu-item),
    :deep(.el-sub-menu__title) {
      color: rgba(255, 255, 255, 0.65) !important;
      height: 50px;
      line-height: 50px;
      padding: 0 20px !important;
      margin: 0 !important;
      border-bottom: none !important;
      
      &:hover {
        background-color: rgba(255, 255, 255, 0.08) !important;
        color: #fff !important;
      }
    }

    // 激活的菜单项
    :deep(.el-menu-item.is-active) {
      background-color: #1890ff !important;
      color: #fff !important;
      border-bottom: none !important;
      
      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background-color: #1890ff;
      }
    }

    // 激活的子菜单标题
    :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
      color: #fff !important;
    }

    // 子菜单容器
    :deep(.el-sub-menu) {
      .el-menu {
        background-color: #000c17 !important;
        border: none !important;
      }
    }

    // 子菜单项样式
    :deep(.el-sub-menu .el-menu-item) {
      background-color: #000c17 !important;
      padding-left: 50px !important;
      height: 40px;
      line-height: 40px;
      color: rgba(255, 255, 255, 0.65) !important;
      
      &:hover {
        background-color: rgba(255, 255, 255, 0.08) !important;
        color: #fff !important;
      }
      
      &.is-active {
        background-color: #1890ff !important;
        color: #fff !important;
      }
    }

    // 子菜单展开时的样式
    :deep(.el-sub-menu.is-opened > .el-sub-menu__title) {
      color: #fff !important;
    }

    // 图标样式
    :deep(.el-icon) {
      color: inherit !important;
      margin-right: 8px;
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    // 折叠状态下的样式
    :deep(.el-menu--collapse) {
      .el-menu-item,
      .el-sub-menu__title {
        padding: 0 20px !important;
        text-align: center;
      }
    }

    // 子菜单箭头
    :deep(.el-sub-menu__icon-arrow) {
      right: 20px;
      margin-top: -6px;
      color: rgba(255, 255, 255, 0.65) !important;
    }

    // 子菜单展开时箭头颜色
    :deep(.el-sub-menu.is-opened .el-sub-menu__icon-arrow) {
      color: #fff !important;
    }
  }
}
</style>

