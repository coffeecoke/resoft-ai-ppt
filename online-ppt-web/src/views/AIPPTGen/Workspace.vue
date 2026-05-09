<template>
  <div class="workspace">
    <!-- 顶部快捷入口 -->
    <div class="entry-section">
      <div class="entry-card" @click="goCreate">
        <div class="entry-icon">
          <el-icon><MagicStick /></el-icon>
        </div>
        <div class="entry-info">
          <div class="entry-title">AI 生成 PPT</div>
          <div class="entry-desc">输入主题，AI 自动生成完整演示文稿</div>
        </div>
        <el-icon class="entry-arrow"><ArrowRight /></el-icon>
      </div>
    </div>

    <!-- 我的作品 / 公共作品 -->
    <div class="projects-section">
      <div class="section-header">
        <div class="tab-group">
          <div class="tab-item" :class="{ active: activeTab === 'mine' }" @click="activeTab = 'mine'; currentPage = 1">
            我的作品
            <span class="tab-count">{{ myProjects.length }}</span>
          </div>
          <div class="tab-item" :class="{ active: activeTab === 'public' }" @click="activeTab = 'public'; currentPage = 1">
            公共作品
            <span class="tab-count">{{ publicProjects.length }}</span>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!loading && displayedProjects.length === 0" class="empty-state">
        <el-icon class="empty-icon"><FolderOpened /></el-icon>
        <div class="empty-text">还没有作品，去创建你的第一个 PPT 吧</div>
        <el-button type="primary" @click="goCreate">立即创建</el-button>
      </div>

      <!-- 骨架加载 -->
      <div v-else-if="loading" class="project-grid" style="margin-top:16px">
        <div v-for="i in 10" :key="i" class="project-card skeleton-card">
          <div class="skeleton-thumb"></div>
          <div class="card-footer">
            <div class="skeleton-line" style="width: 75%"></div>
            <div class="skeleton-line" style="width: 50%; margin-top: 6px"></div>
          </div>
        </div>
      </div>

      <!-- 项目网格 -->
      <div v-else class="project-grid" style="margin-top:16px">
        <div
          v-for="p in pagedProjects"
          :key="p.id"
          class="project-card"
          @click="openProject(p.id)"
        >
          <!-- 缩略图 -->
          <div class="thumbnail">
            <img v-if="p.thumbnailUrl" :src="p.thumbnailUrl" :alt="p.topic" />
            <div v-else class="thumb-placeholder">
              <el-icon><Picture /></el-icon>
            </div>
            <div class="slide-count">{{ p.slideCount }} 页</div>
          </div>

          <!-- 卡片底部 -->
          <div class="card-footer">
            <div class="card-title" :title="p.topic">{{ p.topic }}</div>
            <div class="card-meta">{{ formatDate(p.updatedAt) }}</div>
          </div>

          <!-- 操作菜单 -->
          <el-dropdown
            class="card-actions"
            trigger="click"
            @click.stop
            @command="(cmd: string) => handleCommand(cmd, p)"
          >
            <div class="actions-btn" @click.stop>
              <el-icon><MoreFilled /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="open">打开编辑</el-dropdown-item>
                <el-dropdown-item command="delete" divided style="color: #ef4444">删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="displayedProjects.length > pageSize" class="pagination-bar">
        <el-pagination
          class="workspace-pagination"
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="displayedProjects.length"
          layout="prev, pager, next"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { MagicStick, ArrowRight, Picture, MoreFilled, FolderOpened } from '@element-plus/icons-vue'
import { aipptGenApi } from '@/services/aipptGenService'
import { useAuthStore } from '@/store/auth'

interface Project {
  id: string
  topic: string
  slideCount: number
  updatedAt: string
  thumbnailUrl: string | null
}

const router = useRouter()
const authStore = useAuthStore()
const projects = ref<Project[]>([])
const loading = ref(true)
const activeTab = ref<'mine' | 'public'>('mine')
const currentPage = ref(1)
const pageSize = 10

const myProjects = computed(() =>
  projects.value.filter(p => p.creatorId != null && String(p.creatorId) === String(authStore.user?.userId))
)
const publicProjects = computed(() =>
  projects.value.filter(p => !p.creatorId || String(p.creatorId) !== String(authStore.user?.userId))
)
const displayedProjects = computed(() => activeTab.value === 'mine' ? myProjects.value : publicProjects.value)
const pagedProjects = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return displayedProjects.value.slice(start, start + pageSize)
})

onMounted(async () => {
  await loadProjects()
})

async function loadProjects() {
  loading.value = true
  try {
    const res: any = await aipptGenApi.listProjects()
    projects.value = res.data || []
  } catch {
    ElMessage.error('加载项目列表失败')
  } finally {
    loading.value = false
  }
}

function goCreate() {
  router.push('/ai-ppt/genPPT')
}

function openProject(id: string) {
  router.push(`/ai-ppt/editor/${id}`)
}

async function handleCommand(cmd: string, p: Project) {
  if (cmd === 'open') {
    openProject(p.id)
  } else if (cmd === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除《${p.topic}》？此操作不可恢复。`, '删除确认', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      })
    } catch {
      return // 用户取消
    }
    try {
      await aipptGenApi.deleteProject(p.id)
      projects.value = projects.value.filter(x => x.id !== p.id)
      if (currentPage.value > Math.ceil(displayedProjects.value.length / pageSize)) {
        currentPage.value = Math.max(1, currentPage.value - 1)
      }
      ElMessage.success('已删除')
    } catch (err: any) {
      ElMessage.error(err?.message || '删除失败，请重试')
    }
  }
}

function formatDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
</script>

<style scoped>
.workspace {
  height: 100%;
  overflow-y: auto;
  background: #f5f7fa;
  padding: 32px 40px;
  font-family: system-ui, sans-serif;
  box-sizing: border-box;
}

/* 快捷入口 */
.entry-section {
  margin-bottom: 36px;
}

.entry-card {
  display: inline-flex;
  align-items: center;
  gap: 16px;
  background: #fff;
  border: 1.5px solid #e5e7eb;
  border-radius: 16px;
  padding: 18px 24px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 320px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.entry-card:hover {
  border-color: #6366f1;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.15);
  transform: translateY(-2px);
}

.entry-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 20px;
  color: #fff;
}

.entry-info {
  flex: 1;
}

.entry-title {
  color: #111827;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 2px;
}

.entry-desc {
  color: #9ca3af;
  font-size: 12px;
}

.entry-arrow {
  color: #d1d5db;
  font-size: 16px;
}

/* 作品区 */
.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.tab-group {
  display: flex;
  gap: 4px;
  background: #f3f4f6;
  border-radius: 10px;
  padding: 4px;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 18px;
  border-radius: 7px;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { color: #374151; }

  &.active {
    background: #fff;
    color: #6366f1;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
}

.tab-count {
  font-size: 12px;
  background: #e5e7eb;
  color: #6b7280;
  padding: 1px 7px;
  border-radius: 10px;
  font-weight: 400;
  transition: all 0.15s;

  .active & {
    background: #ede9fe;
    color: #6366f1;
  }
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 80px 0;
}

.empty-icon {
  font-size: 52px;
  color: #d1d5db;
}

.empty-text {
  color: #9ca3af;
  font-size: 14px;
}

/* 项目网格 */
.project-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

.project-card {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.project-card:hover {
  border-color: #e0e0e0;
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
}

.project-card:hover .card-actions {
  opacity: 1;
}

/* 缩略图 */
.thumbnail {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
  background: #f8fafc;
  overflow: hidden;
}

.thumbnail img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d1d5db;
  font-size: 32px;
  background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
}

.slide-count {
  position: absolute;
  bottom: 6px;
  right: 8px;
  background: rgba(0,0,0,0.45);
  color: #fff;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 6px;
}

/* 卡片底部 */
.card-footer {
  padding: 10px 12px 12px;
}

.card-title {
  color: #111827;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 3px;
}

.card-meta {
  color: #9ca3af;
  font-size: 11px;
}

/* 操作菜单 */
.card-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.15s;
}

.actions-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(255,255,255,0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #374151;
  font-size: 15px;
  cursor: pointer;
  backdrop-filter: blur(4px);
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
  transition: background 0.15s;
}

.actions-btn:hover {
  background: #fff;
  color: #111827;
}

/* 骨架加载 */
.skeleton-card {
  pointer-events: none;
}

.skeleton-thumb {
  width: 100%;
  padding-top: 56.25%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-line {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  margin: 10px 12px 4px;
}

.skeleton-line:last-child {
  margin-bottom: 12px;
}

/* 分页 */
.pagination-bar {
  display: flex;
  justify-content: center;
  margin-top: 32px;
  padding-bottom: 8px;
}
</style>

<style>
.workspace-pagination.el-pagination .el-pager li {
  border-radius: 8px;
  font-weight: 500;
  color: #6b7280;
  background: #fff;
  border: 1px solid #e5e7eb;
  min-width: 32px;
  height: 32px;
  line-height: 32px;
  margin: 0 3px;
  transition: all 0.15s;
}
.workspace-pagination.el-pagination .el-pager li:hover {
  color: #6366f1;
  border-color: #6366f1;
}
.workspace-pagination.el-pagination .el-pager li.is-active {
  background: #6366f1;
  border-color: #6366f1;
  color: #fff;
}
.workspace-pagination.el-pagination button {
  border-radius: 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
  color: #6b7280;
  width: 32px;
  height: 32px;
  transition: all 0.15s;
}
.workspace-pagination.el-pagination button:hover:not(:disabled) {
  color: #6366f1;
  border-color: #6366f1;
}
.workspace-pagination.el-pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
