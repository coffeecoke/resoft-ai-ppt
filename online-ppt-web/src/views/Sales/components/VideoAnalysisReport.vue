<template>
  <div class="side-block analysis-report">
    <div class="report-header">
      <h4 class="sub-head">{{ reportTitle }}</h4>
      <el-button 
        size="small" 
        type="primary" 
        :icon="Download"
        @click="downloadReport"
        class="download-btn"
      >
        下载报告
      </el-button>
    </div>
    
    <!-- 交流目标达成情况 -->
    <div class="report-section">
      <div class="report-section-title">一、交流目标达成情况</div>
      <div class="report-content">
        {{ videoDetail.analysis?.goalAchievement || '已完成一表通政策、产品方案、案例及实施流程的全面介绍，解答客户多方面疑问，初步挖掘核心需求，基本达成政策传递与方案展示目标。' }}
      </div>
    </div>

    <!-- 核心议题 -->
    <div class="report-section">
      <div class="report-section-title">二、核心议题</div>
      <div class="report-content">
        <ul class="report-list">
          <li v-for="(topic, index) in videoDetail.analysis?.coreTopics" :key="index">{{ topic }}</li>
        </ul>
      </div>
    </div>

    <!-- 关键维度分析 -->
    <div class="report-section">
      <div class="report-section-title">三、关键维度分析</div>
      <div 
        v-for="(dimension, index) in videoDetail.analysis?.dimensions" 
        :key="index"
        class="dimension-item"
      >
        <div class="dimension-title">{{ dimension.name }}</div>
        <div class="dimension-content">
          <div v-if="dimension.ourDisplay" class="dimension-subsection">
            <div class="subsection-title">我方展示：</div>
            <ul class="report-list">
              <li v-for="(item, i) in dimension.ourDisplay" :key="i">{{ item }}</li>
            </ul>
          </div>
          <div v-if="dimension.customerInfo" class="dimension-subsection">
            <div class="subsection-title">已挖掘客户信息：</div>
            <ul class="report-list">
              <li v-for="(item, i) in dimension.customerInfo" :key="i">{{ item }}</li>
            </ul>
          </div>
          <div v-if="dimension.pendingInfo" class="dimension-subsection">
            <div class="subsection-title">待挖掘信息：</div>
            <ul class="report-list">
              <li v-for="(item, i) in dimension.pendingInfo" :key="i">{{ item }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- 关键节点 -->
    <div class="report-section">
      <div class="report-section-title">四、关键节点</div>
      <div class="report-content">
        <div 
          v-for="(node, index) in videoDetail.analysis?.keyNodes" 
          :key="index"
          class="key-node-item"
        >
          <div class="key-node-time">{{ node.time }}</div>
          <div class="key-node-desc">{{ node.desc }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Download } from '@element-plus/icons-vue'

const props = defineProps({
  videoDetail: {
    type: Object,
    required: true,
    default: () => ({})
  }
})

// 计算报告标题
const reportTitle = computed(() => {
  const customerName = props.videoDetail.customerName || props.videoDetail.customer || '阜新银行'
  const product = props.videoDetail.productSolution || '一表通'
  return `${customerName}${product}建设项目售前交流报告`
})

// 下载报告
const downloadReport = () => {
  // 生成报告内容
  const reportContent = generateReportContent()

  // 创建 Blob 对象
  const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' })

  // 创建下载链接
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${reportTitle.value}_${new Date().getTime()}.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// 生成报告内容
const generateReportContent = () => {
  const detail = props.videoDetail
  const analysis = detail.analysis || {}
  
  let content = `${reportTitle.value}\n`
  content += '='.repeat(50) + '\n\n'
  
  // 基本信息
  content += '一、基本信息\n'
  content += `客户名称：${detail.customerName || detail.customer || '阜新银行'}\n`
  content += `客户类型：${detail.customerType || '老客户新产品'}\n`
  content += `交流时间：${detail.exchangeTime || '2025 年 5 月 15 日'}\n`
  content += `交流次数：${detail.exchangeCount || '首次'}\n`
  content += `产品解决方案：${detail.productSolution || '一表通'}\n`
  content += `交流人员：${detail.exchangePersonnel || ''}\n`
  content += `交流主题：${detail.exchangeTheme || ''}\n`
  content += `交流目标：${detail.exchangeGoal || ''}\n\n`
  
  // 交流目标达成情况
  if (analysis.goalAchievement) {
    content += '二、交流目标达成情况\n'
    content += analysis.goalAchievement + '\n\n'
  }
  
  // 核心议题
  if (analysis.coreTopics && analysis.coreTopics.length > 0) {
    content += '三、核心议题\n'
    analysis.coreTopics.forEach((topic, index) => {
      content += `${index + 1}. ${topic}\n`
    })
    content += '\n'
  }
  
  // 关键维度分析
  if (analysis.dimensions && analysis.dimensions.length > 0) {
    content += '四、关键维度分析\n'
    analysis.dimensions.forEach((dimension, index) => {
      content += `${index + 1}. ${dimension.name}\n`
      if (dimension.ourDisplay && dimension.ourDisplay.length > 0) {
        content += '   我方展示：\n'
        dimension.ourDisplay.forEach((item, i) => {
          content += `   ${i + 1}. ${item}\n`
        })
      }
      if (dimension.customerInfo && dimension.customerInfo.length > 0) {
        content += '   已挖掘客户信息：\n'
        dimension.customerInfo.forEach((item, i) => {
          content += `   ${i + 1}. ${item}\n`
        })
      }
      if (dimension.pendingInfo && dimension.pendingInfo.length > 0) {
        content += '   待挖掘信息：\n'
        dimension.pendingInfo.forEach((item, i) => {
          content += `   ${i + 1}. ${item}\n`
        })
      }
      content += '\n'
    })
  }
  
  // 关键节点
  if (analysis.keyNodes && analysis.keyNodes.length > 0) {
    content += '五、关键节点\n'
    analysis.keyNodes.forEach((node, index) => {
      content += `${index + 1}. ${node.time}：${node.desc}\n`
    })
  }
  
  return content
}
</script>

<style scoped lang="scss">
/* 分析报告样式 */
.analysis-report {
  .report-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    padding-bottom: 12px;
    border-bottom: 0;
  }
  
  .sub-head {
    font-size: 0.85rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
    flex: 1;
  }
  
  .download-btn {
    flex-shrink: 0;
  }
}

.report-section {
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.report-section-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid #2563eb;
}

.report-content {
  font-size: 14px;
  color: #4b5563;
  line-height: 1.8;
  padding-left: 11px;
}

.report-list {
  margin: 0;
  padding-left: 20px;
  color: #4b5563;
  line-height: 1.8;
  
  li {
    margin-bottom: 8px;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
}

.dimension-item {
  margin-bottom: 20px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
  border-left: 2px solid #e5e7eb;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.dimension-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
}

.dimension-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dimension-subsection {
  padding-left: 8px;
}

.subsection-title {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.key-node-item {
  margin-bottom: 12px;
  padding: 10px;
  background: #f9fafb;
  border-radius: 6px;
  border-left: 2px solid #2563eb;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.key-node-time {
  font-size: 12px;
  font-weight: 600;
  color: #2563eb;
  margin-bottom: 6px;
}

.key-node-desc {
  font-size: 13px;
  color: #4b5563;
  line-height: 1.6;
}
</style>