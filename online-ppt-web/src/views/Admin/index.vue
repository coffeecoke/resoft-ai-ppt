<template>
  <div class="admin-layout">
    <div class="admin-content">
      <RouterView />
    </div>
  </div>
</template>

<script lang="ts" setup>
// Admin 管理后台布局组件
</script>

<style lang="scss" scoped>
.admin-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;
}

.admin-header {
  height: 60px;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  
  .logo {
    font-size: 18px;
    font-weight: 600;
    color: #333;
  }
  
  .nav {
    display: flex;
    gap: 20px;
    
    .nav-item {
      padding: 8px 16px;
      border-radius: 4px;
      color: #666;
      text-decoration: none;
      transition: all 0.2s;
      
      &:hover {
        background-color: #f0f0f0;
        color: #333;
      }
      
      &.router-link-active {
        background-color: #1890ff;
        color: #fff;
      }
    }
  }
}

.admin-content {
  flex: 1;
  overflow: auto;
  padding: 20px;
}
</style>





