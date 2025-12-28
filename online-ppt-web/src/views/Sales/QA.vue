<template>
  <div class="layout qa-page">
    <Header />
    
    <div class="main">
      <SearchBar />
      
      <h2 class="page-title">客户关心问题</h2>
      <div class="filters-row">
        <div class="filters-left">
          <el-select placeholder="产品及解决方案" clearable style="min-width:160px"></el-select>
          <el-select placeholder="交流对象" clearable style="min-width:140px"></el-select>
          <el-select placeholder="行业" clearable style="min-width:120px"></el-select>
          <el-select placeholder="业务条线" clearable style="min-width:140px"></el-select>
          <el-input placeholder="输入客户名称" style="max-width:220px;" />
        </div>
        <div class="qa-counts">
          全部 {{ counts.all }} · 产品问题 {{ counts.product }} · 业务问题 {{ counts.biz }} · 数据问题 {{ counts.data }}
        </div>
      </div>

      <div class="qa-layout">
        <div class="qa-left card-block">
          <ul class="qa-list-rich">
            <li v-for="item in list" :key="item.id">
              <div class="qa-title">
                <span class="qa-category-tag">{{ item.category || '产品' }}</span>
                {{ item.title }}
              </div>
              <div class="qa-meta">{{ item.date }} · 赞 {{ item.like }} · 评 {{ item.comment }}</div>
              <div class="qa-answer">答：{{ item.answer }}</div>
            </li>
          </ul>
        </div>
        <aside class="qa-right card-block">
          <div class="section-head">
            <h3>客户关心问题</h3>
            <el-link>更多</el-link>
          </div>
          <ul class="qa-simple">
            <li v-for="q in sidebar" :key="q">{{ q }}</li>
          </ul>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import Header from '@/components/Sales/Header.vue'
import SearchBar from '@/components/Sales/SearchBar.vue'
const counts = reactive({ all: 46, product: 15, biz: 19, data: 21 })

const list = reactive([
  { id: 1, title: '融合——一表通支持哪些数据库？', answer: '数据库支持mysql、Oracle11gR1、12cR1、DB2，迁移...', date: '2025/10/20', category: '技术', tags: ['数据库','兼容'], like: 12, comment: 12 },
  { id: 2, title: '如何建立数据治理机制？', answer: '结合"一表通"框架的策略和治理流程...', date: '2025/10/20', category: '实施', tags: ['治理','流程'], like: 12, comment: 12 },
  { id: 3, title: 'RSZS可落在个性化交付45个公司合同', answer: '工程板块产品个性化交付的...，后续会用版本', date: '2025/10/20', category: '商务', tags: ['交付','合同'], like: 12, comment: 12 },
  { id: 4, title: 'RSZS制度每升级，速度比报送区很多，10分钟3张表', answer: '优化制度化提速流程', date: '2025/10/20', category: '产品', tags: ['效率','提速'], like: 12, comment: 12 },
  { id: 5, title: '可核区检验结果表报文推送失败', answer: '核验结果表报文格式校验差异...', date: '2025/10/20', category: '技术', tags: ['核验','报文'], like: 12, comment: 12 },
  { id: 6, title: '不同银行——一表通项目区别是什么', answer: '不同银行在监管要求差异较大...', date: '2025/10/20', category: '需求', tags: ['监管','项目'], like: 12, comment: 12 },
  { id: 7, title: '"一表通"监管推进设计的数据血缘管理新要求', answer: '2023年中部省份监管新增...', date: '2025/10/20', category: '数据安全', tags: ['数据血缘','监管'], like: 12, comment: 12 },
])

const sidebar = [
  '数据库如何保障数据安全？',
  '系统部署需要多长时间？',
  '成本投入预算范围？',
  '一表通接入之后与EAST如何衔接？',
  '信托行业的合作客户有哪些？',
  '公司监管行业案例有多少？',
]
</script>

<style scoped>

</style>




