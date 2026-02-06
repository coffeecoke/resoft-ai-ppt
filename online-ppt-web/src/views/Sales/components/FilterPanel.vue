<template>
  <div class="filter-panel">
    <div class="filter-panel-header">
      <h3 class="filter-panel-title">全部筛选</h3>
      <button class="filter-panel-close" @click="handleClose">
        <i class="ri-close-line"></i>
      </button>
    </div>
    
    <div class="filter-panel-nav">
      <button 
        v-show="canScrollLeft"
        class="filter-nav-arrow filter-nav-arrow-left"
        @click="scrollNavLeft"
      >
        <i class="ri-arrow-left-s-line"></i>
      </button>
      <div class="filter-nav-content" ref="navContentRef">
        <div 
          v-for="category in filterCategories" 
          :key="category.id"
          class="filter-nav-item"
          :class="{ active: activeCategory === category.id }"
          @click="scrollToCategory(category.id)"
        >
          {{ category.name }}
        </div>
      </div>
      <button 
        v-show="canScrollRight"
        class="filter-nav-arrow filter-nav-arrow-right"
        @click="scrollNavRight"
      >
        <i class="ri-arrow-right-s-line"></i>
      </button>
    </div>
    
    <div class="filter-panel-content" ref="contentRef">
      <div 
        v-for="category in filterCategories" 
        :key="category.id"
        :id="`filter-category-${category.id}`"
        class="filter-category-section"
      >
        <!-- PPT目录：标题和切换按钮在同一行 -->
        <div v-if="category.id === 'pptCatalog'" class="filter-category-header">
          <h4 class="filter-category-title">{{ category.name }}</h4>
          <!-- 单选/多选切换按钮 -->
          <div class="filter-mode-switch">
            <button
              class="filter-mode-btn"
              :class="{ active: pptCatalogMode === 'single' }"
              @click="pptCatalogMode = 'single'"
            >
              <i class="ri-radio-button-line"></i>
              单选
            </button>
            <button
              class="filter-mode-btn"
              :class="{ active: pptCatalogMode === 'multiple' }"
              @click="pptCatalogMode = 'multiple'"
            >
              <i class="ri-checkbox-multiple-line"></i>
              多选
            </button>
          </div>
        </div>
        
        <!-- 其他分类：只显示标题 -->
        <h4 v-else-if="category.id !== 'customerName'" class="filter-category-title">{{ category.name }}</h4>
        
        <!-- 客户名称：显示输入框 -->
        <div v-if="category.id === 'customerName'" class="filter-customer-section">
          <div class="filter-input-wrapper">
          <el-input
            v-model="customerNameInput"
            placeholder="输入查询客户名称"
            clearable
            @input="handleCustomerNameInput"
          />
          </div>
          <div class="filter-input-wrapper">
            <el-input
              v-model="productNameInput"
              placeholder="选择产品名称"
              clearable
              @input="handleProductNameInput"
            />
          </div>
        </div>
        
        <!-- 参会人：显示输入框 -->
        <div v-if="category.id === 'participant'" class="filter-customer-section">
          <div class="filter-input-wrapper">
            <el-input
              v-model="participantInput"
              placeholder="输入参会人"
              clearable
              @input="handleParticipantInput"
            />
          </div>
        </div>
        
        <!-- PPT目录/响应文件目录：显示层级结构 -->
        <template v-else-if="category.id === 'pptCatalog' || category.id === 'responseFileCatalog'">
          <div class="filter-catalog-tree">
            <div 
              v-for="parent in catalogData" 
              :key="parent.id"
              class="filter-catalog-parent"
            >
              <div 
                class="filter-catalog-parent-title"
                :class="{ active: selectedParentIds.includes(parent.id) }"
                @click="handleParentClick(category.id, parent.id, parent)"
              >
                {{ ('text' in parent ? parent.text : parent.name) || '' }}
              </div>
              <div class="filter-catalog-children">
                <button
                  v-for="child in parent.children"
                  :key="child.id"
                  class="filter-option-btn filter-option-btn-child"
                  :class="{ 
                    active: selectedOptions[category.id]?.includes(child.id)
                  }"
                  @click="toggleOption(category.id, child.id)"
                >
                  {{ (('text' in child ? child.text : child.name) || '').replace(/\n/g, ' ') }}
                </button>
              </div>
            </div>
          </div>
        </template>
        
        <!-- 问题分类：显示标题和列表项 -->
        <template v-else-if="category.id === 'questionCategory'">
          <div class="filter-question-category-list">
            <div 
              v-for="parent in catalogData" 
              :key="parent.id"
              class="filter-question-category-group"
            >
              <h4 class="filter-question-category-title">
                {{ getCategoryName(parent) }}
              </h4>
              <div class="filter-question-category-children">
                <button
                  v-for="child in parent.children"
                  :key="child.id"
                  class="filter-option-btn filter-option-btn-child"
                  :class="{ 
                    active: selectedOptions[category.id]?.includes(child.id)
                  }"
                  @click="toggleOption(category.id, child.id)"
                >
                  {{ getCategoryName(child) }}
                </button>
              </div>
            </div>
          </div>
        </template>
        
        <!-- 其他分类：显示选项按钮 -->
        <template v-else>
          <div class="filter-options" :class="{ 'filter-options-spaced': category.id === 'audience' || category.id === 'language' || category.id === 'industry' || category.id === 'meetingType' || category.id === 'customerType' }">
            <button
              v-for="option in category.options"
              :key="option.id"
              class="filter-option-btn"
              :class="{ 
                active: selectedOptions[category.id]?.includes(option.id),
                'filter-option-btn-spaced': category.id === 'audience' || category.id === 'language' || category.id === 'industry' || category.id === 'meetingType' || category.id === 'customerType'
              }"
              @click="toggleOption(category.id, option.id)"
            >
              {{ option.name }}
            </button>
          </div>
          <div v-if="category.hasMore" class="filter-expand">
            <a href="#" class="filter-expand-link">
              展开全部
              <i class="ri-arrow-down-s-line"></i>
            </a>
          </div>
        </template>
      </div>
    </div>
    
    <div class="filter-panel-footer">
      <button class="filter-reset-btn" @click="handleReset">
        重置筛选
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { ElInput } from 'element-plus'
import { salesData } from '../../../configs/salesData'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  activeTab: {
    type: String,
    default: 'ppt'
  },
  filters: {
    type: Object,
    default: () => ({})
  },
  pptCatalogTree: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:visible', 'close', 'create-ppt', 'update:filters'])

// 当前激活的筛选类别（用于导航栏高亮）
const activeCategory = ref('customerName')

// 内容区域引用
const contentRef = ref<HTMLElement | null>(null)
// 导航栏内容区域引用
const navContentRef = ref<HTMLElement | null>(null)

// 导航栏滚动状态
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

// 客户名称输入框的值
const customerNameInput = ref('')
// 产品名称输入框的值
const productNameInput = ref('')
// 参会人输入框的值
const participantInput = ref('')

// 已选中的选项
const selectedOptions = reactive<Record<string, string[]>>({
  customerName: [],
  pptCatalog: [],
  procurementMethod: [],
  responseFileCatalog: [],
  questionCategory: [],
  meetingType: [],
  customerType: [],
  industry: [],
  audience: [],
  language: [],
  essenceType: []
})

// 选中的一级目录ID列表（支持多选）
const selectedParentIds = ref<string[]>([])

// PPT目录选择模式：'single' 单选 | 'multiple' 多选
const pptCatalogMode = ref<'single' | 'multiple'>('multiple')

// PPT目录数据（优先使用 API 的目录树，fallback 到配置）
const pptCatalogData = computed(() => {
  if (props.pptCatalogTree && Array.isArray(props.pptCatalogTree) && props.pptCatalogTree.length > 0) {
    console.log('[FilterPanel] 📋 使用 API 目录树:', props.pptCatalogTree)
    // API 树结构已经是 {id, name, children: [{code, name}]} 格式，可以直接使用
    // 需要把 children 的 code 映射为 id 以兼容 selectedOptions
    return props.pptCatalogTree.map((parent: any) => ({
      id: parent.id || parent.code,
      name: parent.name,
      children: Array.isArray(parent.children) ? parent.children.map((child: any) => ({
        id: child.code || child.id, // 使用 code 作为 id
        name: child.name
      })) : []
    }))
  }
  console.log('[FilterPanel] 📋 使用本地配置目录')
  return salesData.productCatalog || []
})

// 响应文件目录数据
const responseFileCatalogData = [
  {
    id: 'business',
    text: '一、商务部分',
    children: [
      { id: 'file-header', text: '文件头部' },
      { id: 'score-index', text: '评分索引表' },
      { id: 'bid-letter', text: '投标函' },
      { id: 'legal-representative', text: '法定代表人身份证明' },
      { id: 'authorization', text: '法定代表人授权委托书' },
      { id: 'basic-info', text: '投标人基本情况表' },
      { id: 'qualification', text: '资格审查资料' },
      { id: 'deviation', text: '偏离表' },
      { id: 'commitment', text: '承诺函' },
      { id: 'deposit', text: '投标保证金缴纳凭证' },
      { id: 'certificate', text: '公司资质证书' },
      { id: 'performance', text: '类似项目业绩' },
      { id: 'project-team', text: '项目团队' }
    ]
  },
  {
    id: 'quotation',
    text: '二、报价',
    children: [
      { id: 'bid-price', text: '投标报价' }
    ]
  },
  {
    id: 'technical',
    text: '三、技术部分',
    children: [
      { id: 'project-understanding', text: '项目理解' },
      { id: 'overall-solution', text: '总体技术方案' },
      { id: 'detailed-solution', text: '详细功能方案' },
      { id: 'implementation', text: '实施方案' },
      { id: 'project-management', text: '项目管理方案' },
      { id: 'after-sales', text: '售后运维服务方案' },
      { id: 'training', text: '培训方案' }
    ]
  },
  {
    id: 'other',
    text: '四、其他部分',
    children: [
      { id: 'appendix', text: '其他附录或综合性材料' }
    ]
  }
]

// 关心问题的问题分类数据
const questionCategoryData = [
  {
    id: 'company',
    name: '公司类',
    children: [
      { id: 'qualifications', name: '资质与案例' },
      { id: 'scale', name: '公司规模与背景' },
      { id: 'cooperation', name: '合作模式' },
      { id: 'regulatory', name: '监管资源与协作' }
    ]
  },
  {
    id: 'product',
    name: '产品类',
    children: [
      { id: 'performance', name: '性能与效率' },
      { id: 'architecture', name: '产品架构' },
      { id: 'features', name: '产品功能' },
      { id: 'compatibility', name: '兼容性与接口扩展' }
    ]
  },
  {
    id: 'business',
    name: '业务类',
    children: [
      { id: 'policy', name: '监管政策适配' },
      { id: 'security', name: '数据安全与合规治理' },
      { id: 'customization', name: '业务适配与定制化' }
    ]
  },
  {
    id: 'commerce',
    name: '商务类',
    children: [
      { id: 'budget', name: '预算与报价' },
      { id: 'price-competitiveness', name: '价格竞争力与优惠政策' }
    ]
  },
  {
    id: 'project',
    name: '项目实施类',
    children: [
      { id: 'poc', name: 'POC' },
      { id: 'project-cycle', name: '项目周期' },
      { id: 'project-team', name: '项目团队' },
      { id: 'project-control', name: '项目管控' },
      { id: 'resource-allocation', name: '资源配置' },
      { id: 'data-migration', name: '数据迁移与系统切换' }
    ]
  },
  {
    id: 'after-sales',
    name: '售后保障类',
    children: [
      { id: 'maintenance-content', name: '运维内容' },
      { id: 'maintenance-cost', name: '运维费用和周期' },
      { id: 'training', name: '培训与知识转移' },
      { id: 'security-support', name: '安全支撑' }
    ]
  }
]

// 根据 activeTab 获取目录数据
const catalogData = computed(() => {
  if (props.activeTab === 'concerned') {
    return questionCategoryData
  } else if (props.activeTab === 'response') {
    return responseFileCatalogData
  } else {
    return pptCatalogData.value // pptCatalogData 现在是 computed
  }
})

// 根据 activeTab 获取筛选类别配置
const filterCategories = computed(() => {
  if (props.activeTab === 'concerned') {
    // 关心问题的筛选类别
    return [
  {
    id: 'customerName',
    name: '客户',
    hasMore: false,
        options: []
      },
      {
        id: 'questionCategory',
        name: '问题分类',
        hasMore: false,
        options: []
      },
      {
        id: 'industry',
        name: '行业领域',
        hasMore: false,
        options: [
          { id: 'national', name: '全国/股份制/政策性银行' },
          { id: 'city', name: '城商行' },
          { id: 'foreign', name: '外资行' },
          { id: 'rural', name: '农商' },
          { id: 'finance', name: '财务公司' },
          { id: 'trust', name: '信托公司' },
          { id: 'auto', name: '汽车/消费金融' },
          { id: 'leasing', name: '金融租赁' },
          { id: 'other', name: '其他' }
        ]
      },
      {
        id: 'essenceType',
        name: '本质类型',
        hasMore: false,
        options: [
          { id: 'confirm', name: '确认类' },
          { id: 'compare', name: '对比类' },
          { id: 'concern', name: '顾虑类' },
          { id: 'suggestion', name: '建议类' },
          { id: 'other', name: '其它意图' }
        ]
      }
    ]
  } else if (props.activeTab === 'response') {
    // 响应文件的筛选类别
    return [
      {
        id: 'customerName',
        name: '客户',
        hasMore: false,
        options: []
      },
      {
        id: 'responseFileCatalog',
        name: '响应文件目录',
        hasMore: false,
        options: []
      },
      {
        id: 'industry',
        name: '行业',
        hasMore: false,
        options: [
          { id: '全国/股份制/政策性银行', name: '全国/股份制/政策性银行' },
          { id: '城商行', name: '城商行' },
          { id: '外资行', name: '外资行' },
          { id: '农商', name: '农商' },
          { id: '财务公司', name: '财务公司' },
          { id: '信托公司', name: '信托公司' },
          { id: '汽车/消费金融', name: '汽车/消费金融' },
          { id: '金融租赁', name: '金融租赁' },
          { id: '其他', name: '其他' }
        ]
      }
    ]
  } else if (props.activeTab === 'video') {
    // 交流会议的筛选类别（不包含PPT目录）
    return [
      {
        id: 'customerName',
        name: '客户',
        hasMore: false,
        options: []
      },
      {
        id: 'participant',
        name: '参会人',
        hasMore: false,
        options: []
      },
      {
        id: 'meetingType',
        name: '会议类型',
        hasMore: false,
        options: [
          { id: 'meeting1', name: '首次交流' },
          { id: 'meeting2', name: '需求调研' },
          { id: 'meeting3', name: '方案讲解' },
          { id: 'meeting4', name: '技术答疑' },
          { id: 'meeting5', name: '投标澄清' },
          { id: 'meeting6', name: '高层汇报' }
        ]
      },
      {
        id: 'customerType',
        name: '客户类型',
        hasMore: false,
        options: [
          { id: 'customerType1', name: '新客户新产品' },
          { id: 'customerType2', name: '老客户新产品' },
          { id: 'customerType3', name: '老客户老产品' }
        ]
      },
      {
        id: 'industry',
        name: '行业',
        hasMore: false,
        options: [
          { id: '全国/股份制/政策性银行', name: '全国/股份制/政策性银行' },
          { id: '城商行', name: '城商行' },
          { id: '外资行', name: '外资行' },
          { id: '农商', name: '农商' },
          { id: '财务公司', name: '财务公司' },
          { id: '信托公司', name: '信托公司' },
          { id: '汽车/消费金融', name: '汽车/消费金融' },
          { id: '金融租赁', name: '金融租赁' },
          { id: '其他', name: '其他' }
        ]
      },
      {
        id: 'audience',
        name: '交流对象',
        hasMore: false,
        options: [
          { id: '技术', name: '技术' },
          { id: '技术负责人', name: '技术负责人' },
          { id: '业务', name: '业务' },
          { id: '业务负责人', name: '业务负责人' }
        ]
      },
      {
        id: 'language',
        name: '语言',
        hasMore: false,
        options: [
          { id: '中文', name: '中文' },
          { id: '英文', name: '英文' }
        ]
      }
    ]
  } else if (props.activeTab === 'tender') {
    // 招标文件的筛选类别
    return [
      {
        id: 'customerName',
        name: '客户',
        hasMore: false,
        options: []
      },
      {
        id: 'procurementMethod',
        name: '采购方式',
        hasMore: false,
        options: [
          { id: 'open', name: '公开招标' },
          { id: 'invite', name: '邀请招标' },
          { id: 'negotiation', name: '竞争性谈判' },
          { id: 'inquiry', name: '询价' },
          { id: 'single', name: '单一来源' }
        ]
      },
      {
        id: 'industry',
        name: '行业',
        hasMore: false,
        options: [
          { id: '全国/股份制/政策性银行', name: '全国/股份制/政策性银行' },
          { id: '城商行', name: '城商行' },
          { id: '外资行', name: '外资行' },
          { id: '农商', name: '农商' },
          { id: '财务公司', name: '财务公司' },
          { id: '信托公司', name: '信托公司' },
          { id: '汽车/消费金融', name: '汽车/消费金融' },
          { id: '金融租赁', name: '金融租赁' },
          { id: '其他', name: '其他' }
        ]
      }
    ]
  } else {
    // PPT的筛选类别
    return [
      {
        id: 'customerName',
        name: '客户',
        hasMore: false,
        options: []
  },
  {
    id: 'pptCatalog',
    name: 'PPT目录',
    hasMore: false,
        options: []
  },
  {
    id: 'industry',
    name: '行业',
    hasMore: false,
    options: [
      { id: '全国/股份制/政策性银行', name: '全国/股份制/政策性银行' },
      { id: '城商行', name: '城商行' },
      { id: '外资行', name: '外资行' },
      { id: '农商', name: '农商' },
      { id: '财务公司', name: '财务公司' },
      { id: '信托公司', name: '信托公司' },
      { id: '汽车/消费金融', name: '汽车/消费金融' },
      { id: '金融租赁', name: '金融租赁' },
      { id: '其他', name: '其他' }
    ]
  },
  {
    id: 'audience',
    name: '交流对象',
    hasMore: false,
    options: [
      { id: '技术', name: '技术' },
      { id: '技术负责人', name: '技术负责人' },
      { id: '业务', name: '业务' },
      { id: '业务负责人', name: '业务负责人' }
    ]
  },
  {
    id: 'language',
    name: '语言',
    hasMore: false,
    options: [
      { id: '中文', name: '中文' },
      { id: '英文', name: '英文' }
    ]
  }
]
  }
})

// 切换选项
const toggleOption = (categoryId: string, optionId: string) => {
  if (!selectedOptions[categoryId]) {
    selectedOptions[categoryId] = []
  }
  
  // PPT目录单选模式处理
  if (categoryId === 'pptCatalog' && pptCatalogMode.value === 'single') {
    const index = selectedOptions[categoryId].indexOf(optionId)
    if (index > -1) {
      // 如果已选中，取消选中
      selectedOptions[categoryId].splice(index, 1)
      // 清除对应一级目录的选中状态
      const parent = (catalogData.value as any[]).find((p: any) => 
        p.children && p.children.some((c: any) => c.id === optionId)
      )
      if (parent) {
        const parentIndex = selectedParentIds.value.indexOf(parent.id)
        if (parentIndex > -1) {
          selectedParentIds.value.splice(parentIndex, 1)
        }
      }
    } else {
      // 如果未选中，先清空所有选中项，再选中当前项
      selectedOptions[categoryId] = [optionId]
      // 清除所有一级目录的选中状态
      selectedParentIds.value = []
      // 找到该二级目录所属的一级目录并选中
      const parent = (catalogData.value as any[]).find((p: any) => 
        p.children && p.children.some((c: any) => c.id === optionId)
      )
      if (parent && !selectedParentIds.value.includes(parent.id)) {
        selectedParentIds.value.push(parent.id)
      }
    }
    return
  }
  
  // 多选模式或非PPT目录：原有逻辑
  const index = selectedOptions[categoryId].indexOf(optionId)
  if (index > -1) {
    selectedOptions[categoryId].splice(index, 1)
  } else {
    selectedOptions[categoryId].push(optionId)
  }
  // 如果选中了二级目录，需要检查并清除对应一级目录的选中状态
  // 找到该二级目录所属的一级目录
  const parent = (catalogData.value as any[]).find((p: any) => 
    p.children && p.children.some((c: any) => c.id === optionId)
  )
  if (parent) {
    const parentIndex = selectedParentIds.value.indexOf(parent.id)
    if (parentIndex > -1) {
      selectedParentIds.value.splice(parentIndex, 1)
    }
  }
}

// 点击一级目录
const handleParentClick = (categoryId: string, parentId: string, parent: any) => {
  if (!selectedOptions[categoryId]) {
    selectedOptions[categoryId] = []
  }
  
  const parentIndex = selectedParentIds.value.indexOf(parentId)
  
  // PPT目录单选模式处理
  if (categoryId === 'pptCatalog' && pptCatalogMode.value === 'single') {
    if (parentIndex > -1) {
      // 如果当前已选中，则取消选中，并清除该目录下所有二级目录的选中状态
      selectedParentIds.value.splice(parentIndex, 1)
      if (parent.children) {
        parent.children.forEach((child: any) => {
          const index = selectedOptions[categoryId].indexOf(child.id)
          if (index > -1) {
            selectedOptions[categoryId].splice(index, 1)
          }
        })
      }
    } else {
      // 如果当前未选中，先清空所有选中项，再选中当前父级及其所有子级
      selectedOptions[categoryId] = []
      selectedParentIds.value = [parentId]
      if (parent.children) {
        parent.children.forEach((child: any) => {
          selectedOptions[categoryId].push(child.id)
        })
      }
    }
    return
  }
  
  // 多选模式或非PPT目录：原有逻辑
  if (parentIndex > -1) {
    // 如果当前已选中，则取消选中，并清除该目录下所有二级目录的选中状态
    selectedParentIds.value.splice(parentIndex, 1)
    if (parent.children) {
      parent.children.forEach((child: any) => {
        const index = selectedOptions[categoryId].indexOf(child.id)
        if (index > -1) {
          selectedOptions[categoryId].splice(index, 1)
        }
      })
    }
  } else {
    // 如果当前未选中，则选中该一级目录，并将该目录下所有二级目录都设为选中状态
    selectedParentIds.value.push(parentId)
    if (parent.children) {
      parent.children.forEach((child: any) => {
        // 如果该二级目录还未选中，则添加到选中列表
        if (!selectedOptions[categoryId].includes(child.id)) {
          selectedOptions[categoryId].push(child.id)
        }
      })
    }
  }
}

// 处理客户名称输入
const handleCustomerNameInput = (value: string) => {
  // 可以在这里添加输入处理逻辑，比如防抖、搜索等
  console.log('客户名称输入:', value)
}

const handleProductNameInput = (value: string) => {
  // 可以在这里添加输入处理逻辑，比如防抖、搜索等
  console.log('产品名称输入:', value)
}

const handleParticipantInput = (value: string) => {
  // 可以在这里添加输入处理逻辑，比如防抖、搜索等
  console.log('参会人输入:', value)
}

// 重置筛选
const handleReset = () => {
  Object.keys(selectedOptions).forEach(key => {
    selectedOptions[key] = []
  })
  selectedParentIds.value = []
  customerNameInput.value = ''
  productNameInput.value = ''
  participantInput.value = ''
  // 重置时根据当前tab重置对应的目录选项
  if (props.activeTab === 'concerned') {
    selectedOptions.questionCategory = []
  } else if (props.activeTab === 'response') {
    selectedOptions.responseFileCatalog = []
  } else if (props.activeTab === 'ppt') {
    selectedOptions.pptCatalog = []
  } else if (props.activeTab === 'tender') {
    selectedOptions.procurementMethod = []
  } else {
    selectedOptions.pptCatalog = []
  }
}

// 获取分类名称（兼容text和name属性）
const getCategoryName = (item: any) => {
  return item.name || item.text || ''
}

// 滚动到指定分类
const scrollToCategory = (categoryId: string) => {
  activeCategory.value = categoryId
  nextTick(() => {
    const element = document.getElementById(`filter-category-${categoryId}`)
    if (element && contentRef.value) {
      // 获取导航栏的实际高度
      const navElement = document.querySelector('.filter-panel-nav')
      const headerElement = document.querySelector('.filter-panel-header')
      const navHeight = (navElement?.clientHeight || 56) + (headerElement?.clientHeight || 40) + 8 // 加上一些间距
      const offsetTop = element.offsetTop - navHeight
      contentRef.value.scrollTo({
        top: Math.max(0, offsetTop),
        behavior: 'smooth'
      })
    }
  })
}

// 检查导航栏滚动状态
const checkNavScroll = () => {
  if (!navContentRef.value) return
  
  const { scrollLeft, scrollWidth, clientWidth } = navContentRef.value
  canScrollLeft.value = scrollLeft > 0
  canScrollRight.value = scrollLeft < scrollWidth - clientWidth - 1
}

// 导航栏向左滚动
const scrollNavLeft = () => {
  if (!navContentRef.value) return
  navContentRef.value.scrollBy({ left: -120, behavior: 'smooth' })
  setTimeout(checkNavScroll, 300)
}

// 导航栏向右滚动
const scrollNavRight = () => {
  if (!navContentRef.value) return
  navContentRef.value.scrollBy({ left: 120, behavior: 'smooth' })
  setTimeout(checkNavScroll, 300)
}

// 监听导航栏滚动
onMounted(() => {
  nextTick(() => {
    if (navContentRef.value) {
      navContentRef.value.addEventListener('scroll', checkNavScroll)
      // 监听窗口大小变化
      window.addEventListener('resize', checkNavScroll)
      checkNavScroll()
    }
  })
})

onBeforeUnmount(() => {
  if (navContentRef.value) {
    navContentRef.value.removeEventListener('scroll', checkNavScroll)
  }
  window.removeEventListener('resize', checkNavScroll)
})

// 关闭面板
const handleClose = () => {
  emit('update:visible', false)
  emit('close')
}

// 新建PPT
const handleCreatePpt = () => {
  emit('create-ppt')
}

// 🆕 监听筛选条件变化，同步到 useFilters 的 pptFilters（触发接口请求）
// 防抖标记，避免初始化时触发
const isInitialized = ref(false)

onMounted(() => {
  nextTick(() => {
    isInitialized.value = true
  })
})

watch(
  () => ({
    pptCatalog: selectedOptions.pptCatalog,
    industry: selectedOptions.industry,
    audience: selectedOptions.audience,
    language: selectedOptions.language,
    customerName: customerNameInput.value
  }),
  (newVal) => {
    if (!isInitialized.value) return
    
    console.log('[FilterPanel] 🔄 筛选条件变化，同步到 filters')
    
    if (!props.filters.pptFilters) {
      console.warn('[FilterPanel] props.filters.pptFilters 不存在')
      return
    }
    
    // 映射 FilterPanel 的 selectedOptions 到 pptFilters（PPT tab）
    if (props.activeTab === 'ppt') {
      // PPT目录 → productIntro
      props.filters.pptFilters.productIntro = newVal.pptCatalog || []
      // 行业
      props.filters.pptFilters.industry = newVal.industry || []
      // 交流对象
      props.filters.pptFilters.audience = newVal.audience || []
      // 语言
      props.filters.pptFilters.language = newVal.language || []
      // 客户名称
      props.filters.pptFilters.customerName = newVal.customerName || ''
      
      console.log('[FilterPanel] ✅ 同步后的 pptFilters:', {
        productIntro: props.filters.pptFilters.productIntro,
        industry: props.filters.pptFilters.industry,
        audience: props.filters.pptFilters.audience,
        language: props.filters.pptFilters.language,
        customerName: props.filters.pptFilters.customerName
      })
      
      // 触发事件通知父组件（Home.vue 会调用 loadDocuments）
      emit('update:filters', props.filters)
    }
  },
  { deep: true }
)
</script>

<style scoped lang="scss">
.filter-panel {
  width: 340px;
  flex-shrink: 0;
  box-sizing: border-box;
  margin-top: 0;
  // 确保面板高度正好填满从顶部到底部的可视区域
  // top: 89px（header高度）+ margin-top: 0 = 89px
  // 面板高度 = 100vh - 89px，这样面板底部正好在视口底部
  height: calc(100vh - 89px);
  max-height: calc(100vh - 89px);
  background: #fff;
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  position: sticky;
  top: 89px;
  padding: 15px 0 0 0;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  // 确保flex布局正确工作，限制面板不会超出视口
  min-height: 0;
  // 确保面板底部不会超出视口
  align-self: flex-start;
}

.filter-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 15px 10px 15px;
  border-bottom: none;
  flex-shrink: 0;
}

.filter-panel-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.filter-panel-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #6b7280;
  font-size: 20px;
  padding: 0;
  
  &:hover {
    color: #1f2937;
  }
}

.filter-panel-nav {
  display: flex;
  align-items: center;
  padding: 12px 15px 0 12px;
  border-bottom: none;
  gap: 8px;
  position: relative;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.filter-nav-arrow {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: #fff;
  border-radius: 50%;
  cursor: pointer;
  color: #1f2937;
  font-size: 18px;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  
  &:hover:not(.disabled) {
    color: #006DF9;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  }
  
  &.disabled {
    color: #d1d5db;
    cursor: not-allowed;
  }
  
  &.filter-nav-arrow-right {
    margin-top: -8px;
  }
}

.filter-nav-content {
  flex: 1;
  display: flex;
  align-items: center;
  overflow-x: hidden;
  gap: 20px;
  scroll-behavior: smooth;
}

.filter-nav-item {
  font-size: 0.875rem;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  padding-bottom: 8px;
  position: relative;
  transition: color 0.2s;
  
  &:hover {
    color: #1f2937;
  }
  
  &.active {
    color: #006DF9;
    font-weight: 500;
    
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 4px;
      border-top-left-radius: 9999px;
      border-top-right-radius: 9999px;
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      background-color: rgb(37 99 235 / 1);
      box-shadow: 0 -2px 8px rgba(37, 99, 235, 0.4);
    }
  }
}

.filter-panel-content {
  flex: 1 1 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 15px;
  min-height: 0;
  // 确保内容区域不会超出，为footer留出空间
  // flex: 1 1 0 表示：flex-grow: 1, flex-shrink: 1, flex-basis: 0
  // 这样content会自动占据剩余空间，footer始终在底部可见
  // 使用max-height确保content不会超出面板高度
  max-height: 100%;
  // 确保滚动条正确显示
  -webkit-overflow-scrolling: touch;
}

.filter-category-section {
  margin-bottom: 20px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.filter-category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.filter-category-title {
  font-size: 1rem;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.92);
  margin: 0;
  flex: 1;
}

.filter-customer-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 5px;
  
  .new-ppt-btn {
    width: auto;
    align-self: flex-start;
    
    i {
      font-weight: normal;
    }
  }
}

.filter-input-wrapper {
  width: 100%;
  
  :deep(.el-input) {
    width: 100%;
  }
  
  :deep(.el-input__wrapper) {
    border-radius: 20px;
    border: none;
    
    &:hover {
      border: none;
    }
    
    &.is-focus {
      border: 1px solid #006DF9;
      box-shadow: 0 0 0 1px #006DF9 inset;
    }
  }
  
  :deep(.el-input__inner) {
    font-size: 0.75rem;
    
    &::placeholder {
      font-size: 0.75rem;
    }
  }
}

.filter-options {
  display: block;
  
  &::after {
    content: '';
    display: table;
    clear: both;
  }
}

// 单选/多选切换按钮样式
.filter-mode-switch {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 4px;
  background: #f5f7fa;
  border-radius: 8px;
  position: relative;
  flex-shrink: 0;
  margin-left: 12px;
}

.filter-mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  z-index: 1;
  
  i {
    font-size: 14px;
  }
  
  &:hover {
    color: #64748b;
  }
  
  &.active {
    background: #fff;
    color: #2563eb;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    
    &:hover {
      color: #1d4ed8;
      border-color: #cbd5e1;
    }
  }
}

// PPT目录层级结构样式
.filter-catalog-tree {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.filter-catalog-parent {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-left: 0;
  padding-right: 0;
  margin-bottom: 15px;
}

.filter-catalog-parent-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: #94a3b8;
  padding: 10px 0 0 0;
  border: none;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1rem;
  letter-spacing: 0.025em;
  
  &:first-child {
    margin-top: 0;
  }
  
  &.active {
    color: #006DF9;
    font-weight: 600;
  }
}

.filter-catalog-children {
  display: block;
  padding-left: 0 !important;
  padding-right: 0 !important;
  margin-top: 2px;
  
  &::after {
    content: '';
    display: table;
    clear: both;
  }
}

// 问题分类列表样式
.filter-question-category-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.filter-question-category-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-question-category-title {
  font-size: 0.75rem;
  font-weight: normal;
  color: #999;
  padding: 0;
  margin-top: 10px;
  border: none;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1.5;
  
  &:first-child {
    margin-top: 0;
  }
}

.filter-question-category-children {
  display: block;
  padding-left: 0 !important;
  padding-right: 0 !important;
  margin-top: 0;
  
  &::after {
    content: '';
    display: table;
    clear: both;
  }
}

.filter-option-btn {
  font-size: 0.75rem;
  padding: 5px 8px;
  border: none;
  border-radius: 4px;
  background: #f7f8fa;
  color: #1f2937;
  font-weight: normal;
  height: auto;
  min-height: 1.2rem;
  display: flex;
  margin-right: 6px;
  align-items: center;
  justify-content: flex-start;
  text-align: left;
  line-height: 1.3rem;
  cursor: pointer;
  transition: all 0.2s;
  width: fit-content;
  white-space: normal;
  float: left;
  margin-right: 8px;
  
  &:hover {
    border: none;
    color: #006DF9;
  }
  
  &.active {
    border: none;
    background: #f0f7ff;
    color: #006DF9;
    font-weight: 600;
  }
  
  &.has-color {
    border-color: currentColor;
  }
  
  &.filter-option-btn-child {
    float: left;
    margin-right: 10px;
    margin-top: 5px;
  }
  
  &.filter-option-btn-spaced {
    margin-right: 8px;
    margin-top: 5px;
  }
}

.filter-expand {
  margin-top: 16px;
}

.filter-expand-link {
  font-size: 14px;
  color: #6b7280;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  
  &:hover {
    color: #006DF9;
  }
  
  i {
    font-size: 16px;
  }
}

.filter-panel-footer {
  padding: 16px 15px;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
  background: #fff;
  // 确保footer始终在底部可见
  position: relative;
  z-index: 10;
  // 添加阴影，增强层次感
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
  // 确保footer有最小高度
  min-height: 68px;
  box-sizing: border-box;
}

.filter-reset-btn {
  width: 100%;
  padding: 8px 12px;
  background: #006DF9;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  
  &:hover {
    background: #0056cc;
  }
}
</style>

