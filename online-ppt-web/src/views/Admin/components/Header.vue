<template>
  <div class="admin-header" :class="{ collapsed: isCollapsed }">
    <div class="header-left">
      <el-icon class="collapse-icon" @click="toggleSidebar">
        <Expand v-if="isCollapsed" />
        <Fold v-else />
      </el-icon>
      
      <el-breadcrumb separator="/" class="breadcrumb">
        <el-breadcrumb-item
          v-for="item in breadcrumbList"
          :key="item.path"
          :to="item.path"
        >
          {{ item.title }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>
    
    <div class="header-right">
      <div class="user-info">
        <el-dropdown>
          <span class="user-name">
            <el-icon><User /></el-icon>
            <span>管理员</span>
            <el-icon class="arrow-down"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>个人中心</el-dropdown-item>
              <el-dropdown-item divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Expand, Fold, User, ArrowDown } from '@element-plus/icons-vue'
import { adminMenus } from '@/configs/adminMenu'

const route = useRoute()

// 侧边栏折叠状态
const isCollapsed = ref(false)

// 切换侧边栏
const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
  // 触发事件通知父组件
  emit('toggle-sidebar', isCollapsed.value)
}

// 生成面包屑导航
const breadcrumbList = computed(() => {
  const path = route.path
  const list: Array<{ title: string; path: string }> = [
    { title: '首页', path: '/admin' }
  ]

  // 查找当前路径对应的菜单项
  for (const menu of adminMenus) {
    if (path.startsWith(menu.path)) {
      list.push({ title: menu.name, path: menu.path })
      
      if (menu.children) {
        for (const child of menu.children) {
          if (path === child.path || path.startsWith(child.path + '/')) {
            list.push({ title: child.name, path: child.path })
            break
          }
        }
      }
      break
    }
  }

  return list
})

const emit = defineEmits<{
  'toggle-sidebar': [value: boolean]
}>()

defineExpose({
  isCollapsed,
  toggleSidebar
})
</script>

<style lang="scss" scoped>
.admin-header {
  height: 60px;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  position: fixed;
  top: 0;
  left: 200px;
  right: 0;
  z-index: 999;
  transition: left 0.3s;

  &.collapsed {
    left: 64px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .collapse-icon {
      font-size: 20px;
      cursor: pointer;
      color: #666;
      transition: color 0.2s;

      &:hover {
        color: #1890ff;
      }
    }

    .breadcrumb {
      :deep(.el-breadcrumb__inner) {
        color: #666;
        font-weight: normal;
      }

      :deep(.el-breadcrumb__inner.is-link) {
        color: #1890ff;
        cursor: pointer;

        &:hover {
          color: #40a9ff;
        }
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 20px;

    .user-info {
      .user-name {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        color: #666;
        font-size: 14px;

        .arrow-down {
          font-size: 12px;
        }

        &:hover {
          color: #1890ff;
        }
      }
    }
  }
}
</style>

