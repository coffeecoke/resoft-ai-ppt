<template>
  <div v-if="visible" class="advanced-filter-panel">
    <div class="advanced-filter-content">
      <!-- PPT筛选（含 ppt / ppt-new 标签页） -->
      <template v-if="activeTab === 'ppt' || activeTab === 'ppt-new'">
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">客户名称</h4>
          <div class="filter-options">
            <el-input
              :model-value="filters.pptFilters?.customerName"
              @update:model-value="updateFilter('ppt', 'customerName', $event)"
              placeholder="请输入客户名称"
              clearable
              style="width: 200px;"
            />
          </div>
        </div>
        <div v-if="!activeProduct" class="filter-section filter-section-inline">
          <h4 class="filter-section-title">PPT目录</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.pptFilters?.productIntro"
              @update:model-value="updateFilter('ppt', 'productIntro', $event)"
            >
              <!-- 有后台目录树时按父级分组展示（与 bat 一致：父集 + 二级） -->
              <template v-if="pptCatalogTree && pptCatalogTree.length > 0">
                <div v-for="parent in pptCatalogTree" :key="parent.id" class="filter-catalog-group">
                  <div class="filter-catalog-parent">{{ parent.name }}</div>
                  <div class="filter-row">
                    <el-checkbox 
                      v-for="child in (parent.children || [])" 
                      :key="child.code" 
                      :label="child.code"
                    >
                      {{ child.name }}
                    </el-checkbox>
                  </div>
                </div>
              </template>
              <!-- 无接口数据时用本地字典兜底 -->
              <div v-else class="filter-row">
                <el-checkbox 
                  v-for="option in pptCatalogOptions" 
                  :key="option.value" 
                  :label="option.value"
                >
                  {{ option.label }}
                </el-checkbox>
              </div>
            </el-checkbox-group>
          </div>
        </div>
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">行业</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.pptFilters?.industry"
              @update:model-value="updateFilter('ppt', 'industry', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in industryOptions" 
                  :key="option.value" 
                  :label="option.value"
                >
                  {{ option.label }}
                </el-checkbox>
              </div>
            </el-checkbox-group>
          </div>
        </div>
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">交流对象</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.pptFilters?.audience"
              @update:model-value="updateFilter('ppt', 'audience', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in audienceOptions" 
                  :key="option.value" 
                  :label="option.value"
                >
                  {{ option.label }}
                </el-checkbox>
              </div>
            </el-checkbox-group>
          </div>
        </div>
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">语言</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.pptFilters?.language"
              @update:model-value="updateFilter('ppt', 'language', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in languageOptions" 
                  :key="option.value" 
                  :label="option.value"
                >
                  {{ option.label }}
                </el-checkbox>
              </div>
            </el-checkbox-group>
          </div>
        </div>
      </template>

      <!-- 交流会议筛选 -->
      <template v-else-if="activeTab === 'video'">
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">客户名称</h4>
          <div class="filter-options">
            <el-input
              :model-value="filters.videoFilters?.customerName"
              @update:model-value="updateFilter('video', 'customerName', $event)"
              placeholder="请输入客户名称"
              clearable
              style="width: 200px;"
            />
          </div>
        </div>
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">客户属性</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.videoFilters?.customerType"
              @update:model-value="updateFilter('video', 'customerType', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in industryOptions" 
                  :key="option.value" 
                  :label="option.value"
                >
                  {{ option.label }}
                </el-checkbox>
              </div>
            </el-checkbox-group>
          </div>
        </div>
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">会议类型</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.videoFilters?.meetingType"
              @update:model-value="updateFilter('video', 'meetingType', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in meetingTypeOptions" 
                  :key="option.value" 
                  :label="option.value"
                >
                  {{ option.label }}
                </el-checkbox>
              </div>
            </el-checkbox-group>
          </div>
        </div>
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">参会人员</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.videoFilters?.participants"
              @update:model-value="updateFilter('video', 'participants', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in audienceOptions" 
                  :key="option.value" 
                  :label="option.value"
                >
                  {{ option.label }}
                </el-checkbox>
              </div>
            </el-checkbox-group>
          </div>
        </div>
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">我方参与人员</h4>
          <div class="filter-options">
            <el-select
              :model-value="filters.videoFilters?.ourParticipants"
              @update:model-value="updateFilter('video', 'ourParticipants', $event)"
              multiple
              filterable
              placeholder="请选择我方参与人员"
              style="width: 100%;"
            >
              <el-option-group
                v-for="dept in companyStructure"
                :key="dept.department"
                :label="dept.department"
              >
                <el-option
                  v-for="member in dept.members"
                  :key="member.id"
                  :label="`${member.name}（${member.role}）`"
                  :value="member.id"
                />
              </el-option-group>
            </el-select>
          </div>
        </div>
      </template>

      <!-- 招标文件筛选 -->
      <template v-else-if="activeTab === 'tender'">
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">客户名称</h4>
          <div class="filter-options">
            <el-input
              :model-value="filters.tenderFilters?.customerName"
              @update:model-value="updateFilter('tender', 'customerName', $event)"
              placeholder="请输入客户名称"
              clearable
              style="width: 200px;"
            />
          </div>
        </div>
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">采购方式</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.tenderFilters?.procurementMethod"
              @update:model-value="updateFilter('tender', 'procurementMethod', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in procurementMethodOptions" 
                  :key="option.value" 
                  :label="option.value"
                >
                  {{ option.label }}
                </el-checkbox>
              </div>
            </el-checkbox-group>
          </div>
        </div>
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">项目需求概览</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.tenderFilters?.projectOverview"
              @update:model-value="updateFilter('tender', 'projectOverview', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in projectOverviewOptions" 
                  :key="option.value" 
                  :label="option.value"
                >
                  {{ option.label }}
                </el-checkbox>
              </div>
            </el-checkbox-group>
          </div>
        </div>
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">技术要求</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.tenderFilters?.technicalRequirements"
              @update:model-value="updateFilter('tender', 'technicalRequirements', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in technicalRequirementsOptions" 
                  :key="option.value" 
                  :label="option.value"
                >
                  {{ option.label }}
                </el-checkbox>
              </div>
            </el-checkbox-group>
          </div>
        </div>
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">资格与评审规则</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.tenderFilters?.qualificationReview"
              @update:model-value="updateFilter('tender', 'qualificationReview', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in qualificationReviewOptions" 
                  :key="option.value" 
                  :label="option.value"
                >
                  {{ option.label }}
                </el-checkbox>
              </div>
            </el-checkbox-group>
          </div>
        </div>
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">合同与商务</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.tenderFilters?.contractBusiness"
              @update:model-value="updateFilter('tender', 'contractBusiness', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in contractBusinessOptions" 
                  :key="option.value" 
                  :label="option.value"
                >
                  {{ option.label }}
                </el-checkbox>
              </div>
            </el-checkbox-group>
          </div>
        </div>
      </template>

      <!-- 响应文件筛选 -->
      <template v-else-if="activeTab === 'response'">
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">客户名称</h4>
          <div class="filter-options">
            <el-input
              :model-value="filters.responseFilters?.customerName"
              @update:model-value="updateFilter('response', 'customerName', $event)"
              placeholder="请输入客户名称"
              clearable
              style="width: 200px;"
            />
          </div>
        </div>
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">响应目录</h4>
          <div class="filter-options">
            <el-checkbox-group
              :model-value="filters.responseFilters?.sectionTypes"
              @update:model-value="updateFilter('response', 'sectionTypes', $event)"
            >
              <template v-if="bidSectionTypes && bidSectionTypes.length > 0">
                <div class="filter-catalog-group">
                  <div class="filter-catalog-parent">基础部分</div>
                  <div class="filter-row">
                    <el-checkbox
                      v-for="t in bidSectionTypes"
                      :key="t.code"
                      :label="t.code"
                    >
                      {{ t.name }}
                    </el-checkbox>
                  </div>
                </div>
              </template>
              <div v-else class="filter-row" style="color:#999;font-size:12px;">暂无章节类型数据</div>
            </el-checkbox-group>
          </div>
        </div>
      </template>

      <!-- 其他tab的筛选内容 -->
      <template v-else>
        <div class="filter-section">
          <p>该tab的筛选选项待完善</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, onMounted, computed } from 'vue'
import { useSalesOptions } from '@/hooks/useSalesOptions'
import {
  productSolutionOptions,
  audienceOptions,
  languageOptions,
  pptCatalogOptions,
  meetingTypeOptions,
  questionerOptions,
  exchangeStageOptions,
  userNeedsOptions,
  questionTypeOptions,
  procurementMethodOptions,
  projectOverviewOptions,
  technicalRequirementsOptions,
  qualificationReviewOptions,
  contractBusinessOptions,
  companyStructure
} from '../constants/salesConfig'

const { load, industryOptions } = useSalesOptions()
onMounted(() => load())

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  activeTab: {
    type: String,
    default: 'ppt'
  },
  activeProduct: {
    type: String,
    default: ''
  },
  filters: {
    type: Object,
    default: () => ({})
  },
  /** 后台接口返回的 PPT 目录树（一级+二级），用于高级筛选「PPT目录」带父级展示 */
  pptCatalogTree: {
    type: Array,
    default: () => []
  },
  /** 后台接口返回的响应文件章节类型列表（来自 bid_section_types 表） */
  bidSectionTypes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:filters'])

const updateFilter = (tab, field, value) => {
  console.log(`[AdvancedFilterPanel] 🎯 筛选更新: tab=${tab}, field=${field}, value=`, value)
  
  // 映射 tab 名称到实际的 filter 对象名称
  const filterMap = {
    'ppt': 'pptFilters',
    'video': 'videoFilters',
'tender': 'tenderFilters',
    'response': 'responseFilters'
  }
  
  const filterKey = filterMap[tab]
  if (!filterKey || !props.filters[filterKey]) {
    console.warn(`[AdvancedFilterPanel] 未知的 tab 或缺少 filter: ${tab}`)
    return
  }
  
  console.log(`[AdvancedFilterPanel] ✅ 更新前:`, props.filters[filterKey][field])
  
  // 直接更新 reactive 对象（因为传入的是 reactive 对象）
  props.filters[filterKey][field] = value
  
  console.log(`[AdvancedFilterPanel] ✅ 更新后:`, props.filters[filterKey][field])
  console.log(`[AdvancedFilterPanel] 📤 触发 emit update:filters`)
  
  // 触发事件通知父组件（虽然已经直接修改了，但保持事件机制）
  emit('update:filters', props.filters)
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

