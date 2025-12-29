<template>
  <el-dialog 
    :model-value="visible" 
    @update:model-value="handleClose"
    :show-close="true" 
    fullscreen 
    class="video-dialog" 
  >
    <template #header>
      <div class="video-header">
        <div class="video-title-row">
          <span class="v-title">{{ videoDetail.project }}</span>
          <div class="v-meta">
            <span>创建人：{{ videoDetail.host }}</span>
            <el-divider direction="vertical" />
            <span>{{ videoDetail.time }}</span>
            <el-divider direction="vertical" />
            <span>观看 100</span>
          </div>
        </div>
        <div class="v-actions">
          <el-button round size="small"><el-icon><Star /></el-icon> 收藏</el-button>
        </div>
      </div>
    </template>
    <div class="video-layout assistant-split-pane-container">
      <div class="video-main-col" :style="{ width: leftWidth }">
        <div class="video-player-placeholder">
          <div class="play-btn"><el-icon size="64"><VideoPlay /></el-icon></div>
          <div class="video-controls">
            <div class="progress-bar"></div>
            <div class="ctrl-row">
              <el-icon><VideoPlay /></el-icon>
              <span>00:00 / 38:54</span>
            </div>
          </div>
        </div>
        <div class="video-desc">{{ videoDetail.desc }}</div>
        <div class="video-stats-row">
          <span>观看 100</span>
          <span>收藏 23</span>
        </div>
        <div class="video-qa-grid">
          <div class="qa-card">
            <div class="card-head">本次交流问题汇总</div>
            <div class="qa-content">
              <div v-for="(q, i) in videoDetail.qa" :key="i" class="qa-pair">
                <div class="q-line"><strong>Q：{{ q.q }}</strong></div>
                <div class="a-line">A：{{ q.a }}</div>
              </div>
            </div>
          </div>
          <div class="qa-card">
            <div class="card-head">潜在问题和需求</div>
            <div class="qa-content">
              <div v-for="(n, i) in videoDetail.needs" :key="i" class="qa-pair">
                <div class="q-line"><strong>需求：{{ n.q }}</strong></div>
                <div class="a-line">{{ n.a }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div 
        class="split-pane-divider" 
        @mousedown="startResize"
      >
        <i class="ri-arrow-left-right-fill divider-icon"></i>
      </div>
      <div class="video-side-col" :style="{ width: rightWidth }">
        <div class="side-block">
          <h3 class="side-head">{{ videoDetail.customer }}</h3>
          <div class="side-info-row">线索：云南金融地方金融监管系统</div>
          <div class="side-info-row">日期及时间：2025.09.29 13:00-14:30</div>
          <div class="side-info-row side-info-row-host">主讲人：{{ videoDetail.host }}</div>
          <div class="side-info-row">我方参会人：{{ videoDetail.participants }}</div>
        </div>
        <div class="side-block">
          <h4 class="sub-head">客户参会人</h4>
          <div v-for="(p, i) in videoDetail.customerParticipants" :key="i" class="participant-item">
            <div class="p-name">{{ p.name }} / {{ p.role }}</div>
            <div class="p-tags">
              <el-tag size="small" effect="plain">因售前接触 {{ p.stat1 }}</el-tag>
              <el-tag size="small" effect="plain">因项目接触 {{ p.stat2 }}</el-tag>
              <el-tag size="small" effect="plain" v-if="p.stat3">因售后接触 {{ p.stat3 }}</el-tag>
            </div>
          </div>
          <div class="side-desc">
            主讲内容：沟通客户需求，了解项目申报进度<br>
            系统名称：地方金融监管系统<br>
            报备说明：现场漫谈，无录屏，有录音，本项目第10次交流。<br>
            交流目的：沟通客户需求，了解项目申报进度，了解申报预算。
          </div>
        </div>
        <div class="side-block">
          <h4 class="sub-head">交流文件</h4>
          <div v-for="f in videoDetail.files" :key="f.id" class="file-item">
            <img src="https://dummyimage.com/40x40/eee/999?text=PPT" class="file-icon" />
            <div class="file-info">
              <div class="f-name">{{ f.name }}</div>
              <div class="f-meta">
                <div class="f-meta-line">创建者：郑相宜 {{ f.size }}</div>
                <div class="f-meta-stats">
                  <span class="stat-item">
                    <i class="ri-eye-line"></i>
                    <span>{{ f.view }}</span>
                  </span>
                  <span class="stat-item">
                    <i class="ri-download-line"></i>
                    <span>{{ f.down }}</span>
                  </span>
                  <span class="stat-item">
                    <i class="ri-thumb-up-line"></i>
                    <span>{{ f.like }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="side-block">
          <h4 class="sub-head">相关交流会议</h4>
          <div v-for="rv in videoDetail.relatedVideos" :key="rv.id" class="rel-video-item">
            <div class="rv-thumb">
              <img :src="rv.img" />
              <span class="rv-dur">{{ rv.duration }}</span>
            </div>
            <div class="rv-info">
              <div class="rv-title">{{ rv.title }}</div>
              <div class="rv-meta">创建者：{{ rv.author }} {{ rv.date }}<br>观看 {{ rv.view }} 点赞 {{ rv.like }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, defineProps, defineEmits } from 'vue'
import { VideoPlay, Star } from '@element-plus/icons-vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  videoDetail: {
    type: Object,
    default: () => ({
      customer: '',
      project: '',
      time: '',
      host: '',
      participants: '',
      desc: '',
      customerParticipants: [],
      files: [],
      relatedVideos: [],
      qa: [],
      needs: []
    })
  }
})

const emit = defineEmits(['update:visible', 'close'])

// 分屏调整相关
const leftWidth = ref('calc(63% - 0.63px)')
const rightWidth = ref('calc(37% - 0.37px)')
const isResizing = ref(false)
const startX = ref(0)
const startLeftWidth = ref(0)
const startRightWidth = ref(0)

const startResize = (e) => {
  isResizing.value = true
  startX.value = e.clientX
  const container = e.target.closest('.assistant-split-pane-container')
  if (container) {
    const leftCol = container.querySelector('.video-main-col')
    const rightCol = container.querySelector('.video-side-col')
    if (leftCol && rightCol) {
      startLeftWidth.value = leftCol.offsetWidth
      startRightWidth.value = rightCol.offsetWidth
    }
  }
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

const handleResize = (e) => {
  if (!isResizing.value) return
  
  const container = document.querySelector('.assistant-split-pane-container')
  if (!container) return
  
  const containerWidth = container.offsetWidth
  const diff = e.clientX - startX.value
  const newLeftWidth = startLeftWidth.value + diff
  const newRightWidth = startRightWidth.value - diff
  
  // 限制最小宽度
  const minLeftWidth = 384
  const minRightWidth = 440
  
  if (newLeftWidth >= minLeftWidth && newRightWidth >= minRightWidth) {
    const leftPercent = (newLeftWidth / containerWidth) * 100
    const rightPercent = (newRightWidth / containerWidth) * 100
    leftWidth.value = `${leftPercent}%`
    rightWidth.value = `${rightPercent}%`
  }
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

const handleClose = (value) => {
  emit('update:visible', value)
  emit('close')
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>
