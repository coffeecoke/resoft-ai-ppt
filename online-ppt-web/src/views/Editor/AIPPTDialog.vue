<template>
  <div class="aippt-dialog">
    <div class="header">
      <span class="title">AIPPT</span>
      <!-- 模式选择 -->
      <span class="subtite" v-if="step === 'mode'">请选择生成方式</span>
      <!-- 智能生成模式 -->
      <span class="subtite" v-else-if="step === 'template'">从下方挑选合适的模板生成PPT，或<span class="local" v-tooltip="'上传.pptist格式模板文件'" @click="uploadLocalTemplate()">使用本地模板生成</span></span>
      <span class="subtite" v-else-if="step === 'outline'">确认下方内容大纲（点击编辑内容，右键添加/删除大纲项），开始选择模板</span>
      <span class="subtite" v-else-if="step === 'setup'">在下方输入您的PPT主题，并适当补充信息，如行业、岗位、学科、用途等</span>
      <!-- 模板填充模式 -->
      <span class="subtite" v-else-if="step === 'fill-template'">选择一个模板，AI将根据主题填充内容</span>
      <span class="subtite" v-else-if="step === 'fill-input'">输入主题，AI将根据模板结构生成内容</span>
      <span class="subtite" v-else-if="step === 'fill-preview'">预览并编辑生成的内容，确认后生成PPT</span>
    </div>
    
    <!-- 模式选择界面 -->
    <div class="mode-select" v-if="step === 'mode'">
      <div class="mode-card" @click="selectMode('smart')">
        <div class="mode-icon">💡</div>
        <div class="mode-title">智能生成</div>
        <div class="mode-desc">AI自动规划内容结构</div>
        <div class="mode-hint">适合不确定用什么模板时</div>
      </div>
      <div class="mode-card" @click="selectMode('fill')">
        <div class="mode-icon">📝</div>
        <div class="mode-title">模板填充</div>
        <div class="mode-desc">选定模板，AI填充内容</div>
        <div class="mode-hint">100%保留模板样式</div>
      </div>
    </div>
    
    <!-- ========== 模板填充模式 ========== -->
    
    <!-- 模板填充：选择模板 -->
    <div class="fill-template-select" v-if="step === 'fill-template'">
      <!-- 内置成品模板 -->
      <div class="section-title">📁 内置成品模板</div>
      <div class="full-templates" v-if="fullTemplateList.length">
        <div class="full-template" 
          :class="{ 'selected': fillSelectedTemplate === tpl.id }" 
          v-for="tpl in fullTemplateList" 
          :key="tpl.id" 
          @click="selectFullTemplate(tpl)"
        >
          <div class="template-preview">
            <div class="template-icon">📊</div>
          </div>
          <div class="template-info">
            <div class="template-name">{{ tpl.name }}</div>
            <div class="template-meta">{{ tpl.pageCount }}页 · {{ tpl.description }}</div>
          </div>
        </div>
      </div>
      <div class="no-templates" v-else>
        <span>暂无内置模板</span>
      </div>
      
      <!-- 上传本地模板 -->
      <div class="section-title" style="margin-top: 20px;">📤 上传本地模板</div>
      <div class="upload-local-template">
        <FileInput 
          accept=".pptist,.json" 
          @change="handleLocalTemplateUpload"
        >
          <div class="upload-trigger" :class="{ 'has-file': localTemplateFile }">
            <template v-if="localTemplateFile">
              <span class="file-icon">✅</span>
              <span class="file-name">{{ localTemplateFile.name }}</span>
              <span class="clear-btn" @click.stop="clearLocalTemplate">清除</span>
            </template>
            <template v-else>
              <span>点击上传 .pptist 或 .json 模板文件</span>
              <span class="hint">使用您自己的PPT作为模板</span>
            </template>
          </div>
        </FileInput>
      </div>
      
      <div class="btns">
        <Button class="btn" type="primary" @click="goToFillInput()" :disabled="!fillSelectedTemplate && !localTemplateData">下一步</Button>
        <Button class="btn" @click="step = 'mode'">返回</Button>
      </div>
    </div>
    
    <!-- 模板填充：输入主题 -->
    <div class="fill-input" v-if="step === 'fill-input'">
      <Input class="input" 
        ref="fillInputRef"
        v-model:value="fillKeyword" 
        :maxlength="50" 
        placeholder="请输入PPT主题" 
        @enter="generateFillContent()"
      >
        <template #suffix>
          <span class="count">{{ fillKeyword.length }} / 50</span>
        </template>
      </Input>
      
      <!-- Word上传 -->
      <div class="word-upload-section">
        <div class="section-label">📄 参考文档（可选）</div>
        <FileInput 
          v-if="!fillWordFile"
          accept=".docx" 
          @change="handleFillWordUpload"
        >
          <div class="upload-trigger" :class="{ 'parsing': fillWordParsing }">
            <span v-if="fillWordParsing">解析中...</span>
            <template v-else>
              <span>点击上传Word文档</span>
              <span class="hint">AI将参考文档内容生成更贴合的内容</span>
            </template>
          </div>
        </FileInput>
        <div v-if="fillWordFile && !fillWordParsing" class="uploaded-file">
          <span class="file-info">
            <span class="file-icon">📄</span>
            <span class="file-name">{{ fillWordFile.name }}</span>
            <span class="word-count" v-if="fillWordContent">({{ fillWordContent.wordCount }}字)</span>
          </span>
          <span class="remove-btn" @click="removeFillWordFile">删除</span>
        </div>
      </div>
      
      <!-- 模型选择 -->
      <div class="configs">
        <div class="config-item">
          <div class="label">模型：</div>
          <Select 
            class="config-content"
            style="width: 200px;"
            v-model:value="fillModel"
            :options="modelOptions"
          />
        </div>
      </div>
      
      <div class="btns" style="margin-top: 20px;">
        <Button class="btn" type="primary" @click="generateFillContent()" :disabled="!fillKeyword">生成内容</Button>
        <Button class="btn" @click="step = 'fill-template'">返回选模板</Button>
      </div>
    </div>
    
    <!-- 模板填充：预览编辑内容 -->
    <div class="fill-preview" v-if="step === 'fill-preview'">
      <div class="preview-content">
        <div class="page-group" v-for="page in fillSlots?.structure" :key="page.pageIndex">
          <div class="page-title">📄 第{{ page.pageIndex + 1 }}页 - {{ getPageTypeName(page.pageType) }}</div>
          <div class="slot-list">
            <div class="slot-item" v-for="slot in page.slots" :key="slot.id">
              <div class="slot-label">{{ getTextTypeName(slot.textType) }}：</div>
              <Input 
                class="slot-input"
                v-model:value="fillContentMap[slot.id]" 
                :placeholder="slot.currentText"
              />
            </div>
          </div>
        </div>
      </div>
      <div class="btns">
        <Button class="btn" type="primary" @click="applyFillTemplate()">确认生成PPT</Button>
        <Button class="btn" @click="generateFillContent()">🔄 重新生成</Button>
        <Button class="btn" @click="step = 'fill-input'">返回</Button>
      </div>
    </div>
    
    <!-- ========== 智能生成模式（原有流程） ========== -->
    
    <template v-if="step === 'setup'">
      <Input class="input" 
        ref="inputRef"
        v-model:value="keyword" 
        :maxlength="50" 
        placeholder="请输入PPT主题，如：一表通售前交流讲解" 
        @enter="createOutline()"
      >
        <template #suffix>
          <span class="count">{{ keyword.length }} / 50</span>
          <div class="submit" type="primary" @click="createOutline()"><IconSend class="icon" /> AI 生成</div>
        </template>
      </Input>
      
      <div class="recommends">
        <div class="recommend" v-for="(item, index) in recommends" :key="index" @click="setKeyword(item)">{{ item }}</div>
      </div>
      <!-- Word上传区域 -->
      <div class="word-upload-section">
        <div class="section-label">📄 参考文档（可选）</div>
        
        <!-- 未上传状态 -->
        <FileInput 
          v-if="!wordFile"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
          @change="handleWordUpload"
        >
          <div class="upload-trigger" :class="{ 'parsing': wordParsing }">
            <span v-if="wordParsing">解析中...</span>
            <template v-else>
              <span>点击上传Word文档</span>
              <span class="hint">AI将参考文档内容生成更贴合的大纲</span>
            </template>
          </div>
        </FileInput>
        
        <!-- 已上传状态 -->
        <div v-if="wordFile && !wordParsing" class="uploaded-file">
          <span class="file-info">
            <span class="file-icon">📄</span>
            <span class="file-name">{{ wordFile.name }}</span>
            <span class="word-count" v-if="wordContent">({{ wordContent.wordCount }}字)</span>
          </span>
          <span class="remove-btn" @click="removeWordFile">删除</span>
        </div>
      </div>

      
      <div class="configs">
        <div class="config-item">
          <div class="label">语言：</div>
          <Select 
            class="config-content"
            style="width: 80px;"
            v-model:value="language"
            :options="[
              { label: '中文', value: '中文' },
              { label: '英文', value: 'English' },
              { label: '日文', value: '日本語' },
            ]"
          />
        </div>
        <div class="config-item">
          <div class="label">风格：</div>
          <Select 
            class="config-content"
            style="width: 80px;"
            v-model:value="style"
            :options="[
              { label: '通用', value: '通用' },
              { label: '学术风', value: '学术风' },
              { label: '职场风', value: '职场风' },
              { label: '教育风', value: '教育风' },
              { label: '营销风', value: '营销风' },
            ]"
          />
        </div>
        <div class="config-item">
          <div class="label">模型：</div>
          <Select 
            class="config-content"
            style="width: 200px;"
            v-model:value="model"
            :options="modelOptions"
          />
        </div>
        <div class="config-item">
          <div class="label">配图：</div>
          <Select 
            class="config-content"
            style="width: 100px;"
            v-model:value="img"
            :options="[
              { label: '无', value: '' },
              { label: '模拟测试', value: 'test' },
              { label: 'AI搜图', value: 'ai-search', disabled: true },
              { label: 'AI生图', value: 'ai-create', disabled: true },
            ]"
          />
        </div>
      </div>
      <div class="configs" v-if="!isEmptySlide">
        <div class="config-item">
          <Checkbox v-model:value="overwrite">覆盖已有幻灯片</Checkbox>
        </div>
      </div>
    </template>
    <div class="preview" v-if="step === 'outline'">
      <pre ref="outlineRef" v-if="outlineCreating">{{ outline }}</pre>
       <div class="outline-view" v-else>
         <OutlineEditor v-model:value="outline" />
       </div>
      <div class="btns" v-if="!outlineCreating">
        <Button class="btn" type="primary" @click="step = 'template'">选择模板</Button>
        <Button class="btn" @click="outline = ''; step = 'setup'">返回重新生成</Button>
      </div>
    </div>
    <div class="select-template" v-if="step === 'template'">
      <div class="templates">
        <div class="template" 
          :class="{ 'selected': selectedTemplate === template.id }" 
          v-for="template in templates" 
          :key="template.id" 
          @click="selectedTemplate = template.id"
        >
          <img :src="template.cover" :alt="template.name">
        </div>
      </div>
      <div class="btns">
        <Button class="btn" type="primary" @click="createPPT()">生成</Button>
        <Button class="btn" @click="step = 'outline'">返回大纲</Button>
      </div>
    </div>

    <FullscreenSpin :loading="loading" tip="AI生成中，请耐心等待 ..." />
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, useTemplateRef } from 'vue'
import { storeToRefs } from 'pinia'
import api, { type WordContent, type ExtractSlotsResult, type ContentMap } from '@/services'
import useAIPPT from '@/hooks/useAIPPT'
import useSlideHandler from '@/hooks/useSlideHandler'
import type { AIPPTSlide } from '@/types/AIPPT'
import type { Slide, SlideTheme } from '@/types/slides'
import message from '@/utils/message'
import { decrypt } from '@/utils/crypto'
import { useMainStore, useSlidesStore } from '@/store'
import Input from '@/components/Input.vue'
import Button from '@/components/Button.vue'
import Select from '@/components/Select.vue'
import FullscreenSpin from '@/components/FullscreenSpin.vue'
import OutlineEditor from '@/components/OutlineEditor.vue'
import Checkbox from '@/components/Checkbox.vue'
import FileInput from '@/components/FileInput.vue'
import { modelOptions } from '@/configs/aiModels'

const mainStore = useMainStore()
const slidesStore = useSlidesStore()
const { templates } = storeToRefs(slidesStore)

const { resetSlides, isEmptySlide } = useSlideHandler()
const { AIPPT, presetImgPool, getMdContent } = useAIPPT()

// 步骤类型
type StepType = 'mode' | 'setup' | 'outline' | 'template' | 'fill-template' | 'fill-input' | 'fill-preview'

const language = ref('中文')
const style = ref('通用')
const img = ref('')
const keyword = ref('')
const outline = ref('')
const selectedTemplate = ref('template_1')
const loading = ref(false)
const outlineCreating = ref(false)
const overwrite = ref(true)
const step = ref<StepType>('mode')  // 默认显示模式选择
const model = ref('GLM-4.5-Flash')
const outlineRef = useTemplateRef<HTMLElement>('outlineRef')
const inputRef = useTemplateRef<InstanceType<typeof Input>>('inputRef')

// Word上传相关状态（智能生成模式）
const wordFile = ref<File | null>(null)
const wordContent = ref<WordContent | null>(null)
const wordParsing = ref(false)

// ============ 模板填充模式状态 ============
const fillSelectedTemplate = ref('')
const fillKeyword = ref('')
const fillModel = ref('GLM-4.5-Flash')
const fillWordFile = ref<File | null>(null)
const fillWordContent = ref<WordContent | null>(null)
const fillWordParsing = ref(false)
const fillSlots = ref<ExtractSlotsResult | null>(null)
const fillContentMap = ref<ContentMap>({})
const fillTemplateData = ref<{ slides: Slide[], theme: SlideTheme } | null>(null)
const fillInputRef = useTemplateRef<InstanceType<typeof Input>>('fillInputRef')

// 成品模板库
interface FullTemplateInfo {
  id: string
  name: string
  description: string
  pageCount: number
  cover: string
  file: string
}
const fullTemplateList = ref<FullTemplateInfo[]>([])
const localTemplateFile = ref<File | null>(null)
const localTemplateData = ref<{ slides: Slide[], theme: SlideTheme } | null>(null)

const recommends = ref([
  '一表通售前交流',
  // '大数据如何改变世界',
  // '餐饮市场调查与研究',
  // 'AIGC在教育领域的应用',
  // '社交媒体与品牌营销',
  // '5G技术如何改变我们的生活',
  '年度工作总结与展望',
  // '区块链技术及其应用',
  // '大学生职业生涯规划',
  // '公司年会策划方案',
]) 

onMounted(() => {
  setTimeout(() => {
    inputRef.value!.focus()
  }, 500)
})

const setKeyword = (value: string) => {
  keyword.value = value
  inputRef.value!.focus()
}

// 处理Word文件上传
const handleWordUpload = async (files: FileList) => {
  const file = files[0]
  if (!file) return
  
  // 检查文件类型
  if (!file.name.endsWith('.docx')) {
    message.error('请上传.docx格式的Word文档')
    return
  }
  
  // 检查文件大小（限制10MB）
  if (file.size > 10 * 1024 * 1024) {
    message.error('文件大小不能超过10MB')
    return
  }
  
  wordFile.value = file
  wordParsing.value = true
  
  try {
    console.log('📤 开始解析Word文档:', file.name)
    const result = await api.parseWord(file)
    
    if (result.success) {
      wordContent.value = result.data
      console.log('✅ Word解析成功:', result.data)
      message.success(`文档解析成功，共${result.data.wordCount}字`)
    } else {
      throw new Error(result.error || '解析失败')
    }
  } catch (error: any) {
    console.error('❌ Word解析失败:', error)
    message.error(error.message || '文档解析失败，请重试')
    wordFile.value = null
    wordContent.value = null
  } finally {
    wordParsing.value = false
  }
}

// 删除Word文件
const removeWordFile = () => {
  wordFile.value = null
  wordContent.value = null
}

// ============ 模式选择 ============
const selectMode = async (mode: 'smart' | 'fill') => {
  if (mode === 'smart') {
    step.value = 'setup'
    setTimeout(() => inputRef.value?.focus(), 100)
  } else {
    // 加载成品模板库索引
    await loadFullTemplateList()
    step.value = 'fill-template'
  }
}

// 加载成品模板库索引
const loadFullTemplateList = async () => {
  try {
    const response = await fetch('/mocks/full_templates/index.json')
    const data = await response.json()
    fullTemplateList.value = data.templates || []
    console.log('✅ 成品模板库加载成功:', fullTemplateList.value)
  } catch (error) {
    console.error('❌ 成品模板库加载失败:', error)
    fullTemplateList.value = []
  }
}

// 选择成品模板
const selectFullTemplate = (tpl: FullTemplateInfo) => {
  fillSelectedTemplate.value = tpl.id
  localTemplateFile.value = null
  localTemplateData.value = null
}

// 上传本地模板
const handleLocalTemplateUpload = async (files: FileList) => {
  const file = files[0]
  if (!file) return
  
  try {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        let content = e.target?.result as string
        
        // 如果是.pptist文件，需要解密
        if (file.name.endsWith('.pptist')) {
          content = decrypt(content)
        }
        
        const data = JSON.parse(content)
        
        if (!data.slides || !Array.isArray(data.slides)) {
          throw new Error('无效的模板文件格式')
        }
        
        localTemplateFile.value = file
        localTemplateData.value = {
          slides: data.slides,
          theme: data.theme || {}
        }
        fillSelectedTemplate.value = ''  // 清除内置模板选择
        
        message.success(`模板加载成功，共${data.slides.length}页`)
        console.log('✅ 本地模板加载成功:', data)
      } catch (parseError) {
        console.error('❌ 模板解析失败:', parseError)
        message.error('模板文件格式错误，请检查文件')
      }
    }
    reader.readAsText(file)
  } catch (error: any) {
    console.error('❌ 模板上传失败:', error)
    message.error(error.message || '模板上传失败')
  }
}

// 清除本地模板
const clearLocalTemplate = () => {
  localTemplateFile.value = null
  localTemplateData.value = null
}

// ============ 模板填充模式方法 ============

// 进入输入主题步骤
const goToFillInput = async () => {
  // 检查是否选择了模板
  if (!fillSelectedTemplate.value && !localTemplateData.value) {
    message.error('请先选择一个模板或上传本地模板')
    return
  }
  
  loading.value = true
  
  try {
    let templateData: { slides: Slide[], theme: SlideTheme }
    
    if (localTemplateData.value) {
      // 使用本地上传的模板
      templateData = localTemplateData.value
      console.log('📂 使用本地上传的模板')
    } else {
      // 从成品模板库加载
      const selectedTpl = fullTemplateList.value.find(t => t.id === fillSelectedTemplate.value)
      if (!selectedTpl) {
        throw new Error('未找到选择的模板')
      }
      
      console.log('📂 加载成品模板:', selectedTpl.file)
      const response = await fetch(`/mocks/full_templates/${selectedTpl.file}`)
      const data = await response.json()
      
      templateData = {
        slides: data.slides,
        theme: data.theme || {}
      }
    }
    
    fillTemplateData.value = templateData
    
    // 提取槽位
    const result = await api.extractSlots(templateData.slides)
    if (result.success) {
      fillSlots.value = result.data
      console.log('✅ 槽位提取成功:', result.data)
      
      // 检查槽位数量
      const MAX_SLOTS = 100
      if (result.data.totalSlots > MAX_SLOTS) {
        message.warning(`模板较复杂（${result.data.totalSlots}个文本槽位），建议使用更简单的模板以获得更好效果`)
      } else if (result.data.totalSlots > 50) {
        message.info(`模板共${result.data.totalSlots}个文本槽位，AI将为每个槽位生成内容`)
      }
    } else {
      throw new Error(result.error || '槽位提取失败')
    }
    
    step.value = 'fill-input'
    setTimeout(() => fillInputRef.value?.focus(), 100)
  } catch (error: any) {
    console.error('❌ 模板加载失败:', error)
    message.error(error.message || '模板加载失败')
  } finally {
    loading.value = false
  }
}

// 处理模板填充模式的Word上传
const handleFillWordUpload = async (files: FileList) => {
  const file = files[0]
  if (!file) return
  
  if (!file.name.endsWith('.docx')) {
    message.error('请上传.docx格式的Word文档')
    return
  }
  
  if (file.size > 10 * 1024 * 1024) {
    message.error('文件大小不能超过10MB')
    return
  }
  
  fillWordFile.value = file
  fillWordParsing.value = true
  
  try {
    const result = await api.parseWord(file)
    if (result.success) {
      fillWordContent.value = result.data
      message.success(`文档解析成功，共${result.data.wordCount}字`)
    } else {
      throw new Error(result.error || '解析失败')
    }
  } catch (error: any) {
    message.error(error.message || '文档解析失败')
    fillWordFile.value = null
    fillWordContent.value = null
  } finally {
    fillWordParsing.value = false
  }
}

// 删除模板填充模式的Word文件
const removeFillWordFile = () => {
  fillWordFile.value = null
  fillWordContent.value = null
}

// 生成填充内容
const generateFillContent = async () => {
  if (!fillKeyword.value) {
    message.error('请输入PPT主题')
    return
  }
  
  if (!fillSlots.value) {
    message.error('模板槽位信息丢失，请返回重新选择模板')
    return
  }
  
  // 检查槽位数量
  const MAX_SLOTS = 100
  if (fillSlots.value.totalSlots > MAX_SLOTS) {
    message.error(`模板槽位过多（${fillSlots.value.totalSlots}个），请选择更简单的模板（建议不超过${MAX_SLOTS}个）`)
    return
  }
  
  loading.value = true
  
  try {
    console.log(`📤 开始生成内容, 槽位数: ${fillSlots.value.totalSlots}`)
    
    const result = await api.generateFillContent({
      slots: fillSlots.value,
      topic: fillKeyword.value,
      wordContent: fillWordContent.value?.text || '',
      model: fillModel.value,
    })
    
    if (result.success) {
      fillContentMap.value = result.data
      console.log('✅ 内容生成成功:', result.data)
      step.value = 'fill-preview'
    } else {
      throw new Error(result.error || '内容生成失败')
    }
  } catch (error: any) {
    console.error('❌ 内容生成失败:', error)
    
    // 友好的错误提示
    let errorMsg = '内容生成失败，请重试'
    if (error.message?.includes('槽位过多')) {
      errorMsg = error.message
    } else if (error.message?.includes('timeout') || error.message?.includes('超时')) {
      errorMsg = '请求超时，模板可能过于复杂，请尝试更简单的模板'
    } else if (error.response?.data?.error) {
      errorMsg = error.response.data.error
    }
    
    message.error(errorMsg)
  } finally {
    loading.value = false
  }
}

// 应用模板填充
const applyFillTemplate = async () => {
  if (!fillTemplateData.value || !fillContentMap.value) {
    message.error('数据丢失，请重新生成')
    return
  }
  
  loading.value = true
  
  try {
    // 调用填充接口
    const result = await api.fillTemplate({
      slides: fillTemplateData.value.slides,
      contentMap: fillContentMap.value,
    })
    
    if (result.success) {
      // 重置当前幻灯片
      if (overwrite.value) resetSlides()
      
      // 设置新的幻灯片
      slidesStore.setSlides(result.data.slides)
      slidesStore.setTheme(fillTemplateData.value.theme)
      
      message.success('PPT生成成功！')
      mainStore.setAIPPTDialogState(false)
    } else {
      throw new Error(result.error || '模板填充失败')
    }
  } catch (error: any) {
    console.error('❌ 模板填充失败:', error)
    message.error(error.message || '模板填充失败')
  } finally {
    loading.value = false
  }
}

// 获取页面类型名称
const getPageTypeName = (type: string) => {
  const names: Record<string, string> = {
    'cover': '封面',
    'contents': '目录',
    'transition': '过渡页',
    'content': '内容页',
    'end': '结束页',
    'text_image': '图文页',
    'comparison': '对比页',
    'timeline': '时间线页',
    'statistics': '数据统计页',
    'quote': '引用页',
    'unknown': '未知类型'
  }
  return names[type] || type
}

// 获取文本类型名称
const getTextTypeName = (type: string) => {
  const names: Record<string, string> = {
    'title': '标题',
    'subtitle': '副标题',
    'content': '正文',
    'item': '列表项',
    'itemTitle': '项标题',
    'itemNumber': '编号',
    'partNumber': '节编号',
    'header': '页眉',
    'footer': '页脚',
    'notes': '注释',
  }
  return names[type] || type
}

// ============ 智能生成模式方法（原有） ============

const createOutline = async () => {
  if (!keyword.value) return message.error('请先输入PPT主题')

  loading.value = true
  outlineCreating.value = true
  
  // 构建请求参数
  const params: {
    content: string
    language: string
    model: string
    source?: 'word'
    wordContent?: WordContent
  } = {
    content: keyword.value,
    language: language.value,
    model: model.value,
  }
  
  // 如果有Word文档，添加到参数中
  if (wordContent.value) {
    params.source = 'word'
    params.wordContent = wordContent.value
    console.log('📄 使用Word模式生成大纲')
  } else {
    console.log('📝 使用主题模式生成大纲')
  }
  
  const stream = await api.AIPPT_Outline(params)
  
  console.log('🔍 AIPPT_Outline 响应流对象:', {
    stream,
    status: stream.status,
    statusText: stream.statusText,
    ok: stream.ok,
    body: stream.body,
    bodyType: stream.body?.constructor?.name,
  })
  
  if (stream.status === 500) {
    message.error('AI服务异常，请更换其他模型重试')
    loading.value = false
    outlineCreating.value = false
    return
  }

  loading.value = false
  step.value = 'outline'

  const reader: ReadableStreamDefaultReader = stream.body.getReader()
  const decoder = new TextDecoder('utf-8')
  
  console.log('📖 创建流读取器和解码器:', {
    reader,
    decoder,
  })
  
  const readStream = () => {
    reader.read().then(({ done, value }) => {
      if (done) {
        console.log('✅ AIPPT_Outline 流式响应完成，最终大纲内容:', outline.value)
        outline.value = getMdContent(outline.value)
        outline.value = outline.value.replace(/<!--[\s\S]*?-->/g, '').replace(/<think>[\s\S]*?<\/think>/g, '')
        outlineCreating.value = false
        return
      }
  
      const chunk = decoder.decode(value, { stream: true })
      console.log('📦 AIPPT_Outline 接收到的数据块:', {
        chunk,
        chunkLength: chunk.length,
        chunkType: typeof chunk,
        isString: typeof chunk === 'string',
        firstChars: chunk.substring(0, 100),
      })
      outline.value += chunk

      if (outlineRef.value) {
        outlineRef.value.scrollTop = outlineRef.value.scrollHeight + 20
      }

      readStream()
    })
  }
  readStream()
}

const createPPT = async (template?: { slides: Slide[], theme: SlideTheme }) => {
  loading.value = true

  if (overwrite.value) resetSlides()

  const stream = await api.AIPPT({
    content: outline.value,
    language: language.value,
    style: style.value,
    model: model.value,
  })

  if (img.value === 'test') {
    const imgs = await api.getMockData('imgs')
    presetImgPool(imgs)
  }

  let templateData = template
  if (!templateData) templateData = await api.getMockData(selectedTemplate.value)
  const templateSlides: Slide[] = templateData!.slides
  const templateTheme: SlideTheme = templateData!.theme

  const reader: ReadableStreamDefaultReader = stream.body.getReader()
  const decoder = new TextDecoder('utf-8')
  
  const readStream = () => {
    reader.read().then(({ done, value }) => {
      if (done) {
        loading.value = false
        mainStore.setAIPPTDialogState(false)
        slidesStore.setTheme(templateTheme)
        return
      }
  
      const chunk = decoder.decode(value, { stream: true })
      try {
        const text = chunk.replace('```json', '').replace('```', '').trim()
        if (text) {
          const slide: AIPPTSlide = JSON.parse(chunk)
          AIPPT(templateSlides, [slide])
        }
      }
      catch (err) {
        // eslint-disable-next-line
        console.error(err)
      }

      readStream()
    })
  }
  readStream()
}

const uploadLocalTemplate = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pptist'
  input.click()
  input.addEventListener('change', e => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        try {
          const { slides, theme } = JSON.parse(decrypt(reader.result as string))
          createPPT({ slides, theme })
        }
        catch {
          message.error('上传的模板文件数据异常，请重新上传或使用预置模板')
        }
      })
      reader.readAsText(file)
    }
  })
}
</script>

<style lang="scss" scoped>
.aippt-dialog {
  margin: -20px;
  padding: 30px;
}
.header {
  margin-bottom: 12px;

  .title {
    font-weight: 700;
    font-size: 20px;
    margin-right: 8px;
    background: linear-gradient(270deg, #d897fd, #33bcfc);
    background-clip: text;
    color: transparent;
    vertical-align: text-bottom;
    line-height: 1.1;
  }
  .subtite {
    color: #888;
    font-size: 12px;

    .local {
      color: $themeColor;
      text-decoration: underline;
      cursor: pointer;
    }
  }
}

/* Word上传区域样式 */
.word-upload-section {
  margin-top: 15px;
  
  .section-label {
    font-size: 12px;
    color: #888;
    margin-bottom: 8px;
  }
  
  .upload-trigger {
    border: 1px dashed #d9d9d9;
    border-radius: $borderRadius;
    padding: 12px 16px;
    text-align: center;
    cursor: pointer;
    transition: all .25s;
    font-size: 13px;
    color: #666;
    
    &:hover {
      border-color: $themeColor;
      color: $themeColor;
    }
    
    &.parsing {
      border-color: $themeColor;
      background-color: #f0f7ff;
      cursor: wait;
    }
    
    .hint {
      display: block;
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }
  }
  
  .uploaded-file {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background-color: #f6ffed;
    border: 1px solid #b7eb8f;
    border-radius: $borderRadius;
    font-size: 13px;
    
    .file-info {
      display: flex;
      align-items: center;
      
      .file-icon {
        margin-right: 6px;
      }
      
      .file-name {
        color: #333;
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .word-count {
        color: #52c41a;
        margin-left: 8px;
        font-size: 12px;
      }
    }
    
    .remove-btn {
      color: #ff4d4f;
      cursor: pointer;
      font-size: 12px;
      
      &:hover {
        text-decoration: underline;
      }
    }
  }
}

/* 模式选择样式 */
.mode-select {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-top: 30px;
  margin-bottom: 20px;
  
  .mode-card {
    width: 200px;
    padding: 24px 20px;
    border: 2px solid $borderColor;
    border-radius: 12px;
    text-align: center;
    cursor: pointer;
    transition: all 0.25s;
    
    &:hover {
      border-color: $themeColor;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }
    
    .mode-icon {
      font-size: 36px;
      margin-bottom: 12px;
    }
    
    .mode-title {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    }
    
    .mode-desc {
      font-size: 13px;
      color: #666;
      margin-bottom: 8px;
    }
    
    .mode-hint {
      font-size: 12px;
      color: #999;
    }
  }
}

/* 模板填充模式样式 */
.fill-template-select {
  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #333;
    margin-bottom: 12px;
  }
  
  .full-templates {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 10px;
    
    .full-template {
      width: calc(50% - 6px);
      padding: 12px;
      border: 2px solid $borderColor;
      border-radius: $borderRadius;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: all 0.25s;
      
      &:hover {
        border-color: $themeColor;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
      
      &.selected {
        border-color: $themeColor;
        background-color: rgba($themeColor, 0.05);
      }
      
      .template-preview {
        width: 60px;
        height: 45px;
        background-color: #f5f5f5;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        
        .template-icon {
          font-size: 24px;
        }
      }
      
      .template-info {
        flex: 1;
        
        .template-name {
          font-size: 14px;
          font-weight: 600;
          color: #333;
          margin-bottom: 4px;
        }
        
        .template-meta {
          font-size: 12px;
          color: #999;
        }
      }
    }
  }
  
  .no-templates {
    padding: 20px;
    text-align: center;
    color: #999;
    font-size: 13px;
    background-color: #f9f9f9;
    border-radius: $borderRadius;
  }
  
  .upload-local-template {
    .upload-trigger {
      border: 1px dashed #d9d9d9;
      border-radius: $borderRadius;
      padding: 16px;
      text-align: center;
      cursor: pointer;
      transition: all 0.25s;
      font-size: 13px;
      color: #666;
      
      &:hover {
        border-color: $themeColor;
        color: $themeColor;
      }
      
      &.has-file {
        border-style: solid;
        border-color: #52c41a;
        background-color: #f6ffed;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        
        .file-icon {
          color: #52c41a;
        }
        
        .file-name {
          color: #333;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .clear-btn {
          color: #ff4d4f;
          font-size: 12px;
          
          &:hover {
            text-decoration: underline;
          }
        }
      }
      
      .hint {
        display: block;
        font-size: 12px;
        color: #999;
        margin-top: 4px;
      }
    }
  }
  
  .btns {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 20px;
    
    .btn {
      width: 120px;
    }
  }
}

.fill-input {
  .input {
    margin-bottom: 15px;
  }
  
  .btns {
    display: flex;
    justify-content: center;
    gap: 10px;
    
    .btn {
      width: 140px;
    }
  }
}

.fill-preview {
  .preview-content {
    max-height: 400px;
    overflow: auto;
    padding: 10px;
    background-color: #f9f9f9;
    border-radius: $borderRadius;
    margin-bottom: 15px;
  }
  
  .page-group {
    margin-bottom: 16px;
    padding: 12px;
    background-color: #fff;
    border-radius: $borderRadius;
    border: 1px solid #eee;
    
    .page-title {
      font-size: 13px;
      font-weight: 600;
      color: #333;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eee;
    }
    
    .slot-list {
      .slot-item {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
        
        &:last-child {
          margin-bottom: 0;
        }
        
        .slot-label {
          width: 80px;
          font-size: 12px;
          color: #666;
          flex-shrink: 0;
        }
        
        .slot-input {
          flex: 1;
        }
      }
    }
  }
  
  .btns {
    display: flex;
    justify-content: center;
    gap: 10px;
    
    .btn {
      width: 140px;
    }
  }
}

.preview {
  pre {
    max-height: 450px;
    padding: 10px;
    margin-bottom: 15px;
    background-color: #f1f1f1;
    overflow: auto;
  }
  .outline-view {
    max-height: 450px;
    padding: 10px;
    margin-bottom: 15px;
    background-color: #f1f1f1;
    overflow: auto;
  }
  .btns {
    display: flex;
    justify-content: center;
    align-items: center;

    .btn {
      width: 120px;
      margin: 0 5px;
    }
  }
}
.select-template {
  .templates {
    max-height: 450px;
    overflow: auto;
    display: flex;
    margin-bottom: 10px;
    padding-right: 5px;
    @include flex-grid-layout();
  
    .template {
      border: 2px solid $borderColor;
      border-radius: $borderRadius;
      @include flex-grid-layout-children(2, 49%);

      &.selected {
        border-color: $themeColor;
      }
  
      img {
        width: 100%;
        min-height: 180px;
      }
    }
  }
  .btns {
    display: flex;
    justify-content: center;
    align-items: center;

    .btn {
      width: 120px;
      margin: 0 5px;
    }
  }
}
.recommends {
  display: flex;
  flex-wrap: wrap;
  margin-top: 10px;

  .recommend {
    font-size: 12px;
    background-color: #f1f1f1;
    border-radius: $borderRadius;
    padding: 3px 5px;
    margin-right: 5px;
    margin-top: 5px;
    cursor: pointer;

    &:hover {
      color: $themeColor;
    }
  }
}
.configs {
  margin-top: 15px;
  display: flex;
  justify-content: space-between;

  .config-item {
    font-size: 13px;
    display: flex;
    align-items: center;
  }
}
.count {
  font-size: 12px;
  color: #999;
  margin-right: 10px;
}
.submit {
  height: 20px;
  font-size: 12px;
  background-color: $themeColor;
  color: #fff;
  display: flex;
  align-items: center;
  padding: 0 8px 0 6px;
  border-radius: $borderRadius;
  cursor: pointer;

  &:hover {
    background-color: $themeHoverColor;
  }

  .icon {
    font-size: 15px;
    margin-right: 3px;
  }
}

@media screen and (width <= 800px) {
  .configs {
    margin-top: 15px;
    display: flex;
    flex-direction: column;

    .config-item {
      margin-top: 8px;

      .label {
        flex-shrink: 0;
      }

      .config-content {
        width: 100% !important;
      }
    }
  }
  .select-template {
    .templates {
      padding-right: 0;
    }
  }
  
  .word-upload-section {
    .uploaded-file {
      .file-info {
        .file-name {
          max-width: 150px;
        }
      }
    }
  }
}
</style>
