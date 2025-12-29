<template>
  <div v-if="visible" class="advanced-filter-panel">
    <div class="advanced-filter-content">
      <!-- PPT筛选 -->
      <template v-if="activeTab === 'ppt'">
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">客户名称</h4>
          <div class="filter-options">
            <el-input
              :model-value="filters.ppt?.customerName"
              @update:model-value="updateFilter('ppt', 'customerName', $event)"
              placeholder="请输入客户名称"
              clearable
              style="width: 200px;"
            />
          </div>
        </div>
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">产品解决方案</h4>
          <div class="filter-options">
            <el-select 
              :model-value="filters.ppt?.productSolution" 
              @update:model-value="updateFilter('ppt', 'productSolution', $event)"
              placeholder="请选择" 
              clearable 
              style="width: 200px;"
            >
              <el-option 
                v-for="option in productSolutionOptions" 
                :key="option.value" 
                :label="option.label" 
                :value="option.value" 
              />
            </el-select>
          </div>
        </div>
        <div v-if="!activeProduct" class="filter-section filter-section-inline">
          <h4 class="filter-section-title">PPT目录</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.ppt?.productIntro"
              @update:model-value="updateFilter('ppt', 'productIntro', $event)"
            >
              <div class="filter-row">
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
              :model-value="filters.ppt?.industry"
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
              :model-value="filters.ppt?.audience"
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
              :model-value="filters.ppt?.language"
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
              :model-value="filters.video?.customerName"
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
              :model-value="filters.video?.customerType"
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
              :model-value="filters.video?.meetingType"
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
              :model-value="filters.video?.participants"
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
              :model-value="filters.video?.ourParticipants"
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

      <!-- 客户关心问题筛选 -->
      <template v-else-if="activeTab === 'qa'">
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">客户名称</h4>
          <div class="filter-options">
            <el-input
              :model-value="filters.qa?.customerName"
              @update:model-value="updateFilter('qa', 'customerName', $event)"
              placeholder="请输入客户名称"
              clearable
              style="width: 200px;"
            />
          </div>
        </div>
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">客户行业</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.qa?.customerIndustry"
              @update:model-value="updateFilter('qa', 'customerIndustry', $event)"
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
          <h4 class="filter-section-title">提问人</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.qa?.questioner"
              @update:model-value="updateFilter('qa', 'questioner', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in questionerOptions" 
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
          <h4 class="filter-section-title">交流阶段</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.qa?.exchangeStage"
              @update:model-value="updateFilter('qa', 'exchangeStage', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in exchangeStageOptions" 
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
          <h4 class="filter-section-title">用户需求</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.qa?.userNeeds"
              @update:model-value="updateFilter('qa', 'userNeeds', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in userNeedsOptions" 
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
          <h4 class="filter-section-title">问题类型</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.qa?.questionType"
              @update:model-value="updateFilter('qa', 'questionType', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in questionTypeOptions" 
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

      <!-- 招标文件筛选 -->
      <template v-else-if="activeTab === 'tender'">
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">客户名称</h4>
          <div class="filter-options">
            <el-input
              :model-value="filters.tender?.customerName"
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
              :model-value="filters.tender?.procurementMethod"
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
              :model-value="filters.tender?.projectOverview"
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
              :model-value="filters.tender?.technicalRequirements"
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
              :model-value="filters.tender?.qualificationReview"
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
              :model-value="filters.tender?.contractBusiness"
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
              :model-value="filters.response?.customerName"
              @update:model-value="updateFilter('response', 'customerName', $event)"
              placeholder="请输入客户名称"
              clearable
              style="width: 200px;"
            />
          </div>
        </div>
        <div class="filter-section filter-section-inline">
          <h4 class="filter-section-title">报价</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.response?.quotation"
              @update:model-value="updateFilter('response', 'quotation', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in quotationOptions" 
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
          <h4 class="filter-section-title">投标状态</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.response?.bidStatus"
              @update:model-value="updateFilter('response', 'bidStatus', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in bidStatusOptions" 
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
          <h4 class="filter-section-title">商务资质</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.response?.businessQualification"
              @update:model-value="updateFilter('response', 'businessQualification', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in businessQualificationOptions" 
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
          <h4 class="filter-section-title">技术方案</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.response?.technicalSolution"
              @update:model-value="updateFilter('response', 'technicalSolution', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in technicalSolutionOptions" 
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
          <h4 class="filter-section-title">实施与保障</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.response?.implementationGuarantee"
              @update:model-value="updateFilter('response', 'implementationGuarantee', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in implementationGuaranteeOptions" 
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
          <h4 class="filter-section-title">案例与证明</h4>
          <div class="filter-options">
            <el-checkbox-group 
              :model-value="filters.response?.casesProof"
              @update:model-value="updateFilter('response', 'casesProof', $event)"
            >
              <div class="filter-row">
                <el-checkbox 
                  v-for="option in casesProofOptions" 
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
import { defineProps, defineEmits } from 'vue'
import {
  productSolutionOptions,
  industryOptions,
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
  quotationOptions,
  bidStatusOptions,
  businessQualificationOptions,
  technicalSolutionOptions,
  implementationGuaranteeOptions,
  casesProofOptions,
  companyStructure
} from '../constants/salesConfig'

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
  }
})

const emit = defineEmits(['update:filters'])

const updateFilter = (tab, field, value) => {
  const newFilters = { ...props.filters }
  if (!newFilters[tab]) {
    newFilters[tab] = {}
  }
  newFilters[tab] = {
    ...newFilters[tab],
    [field]: value
  }
  emit('update:filters', newFilters)
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

