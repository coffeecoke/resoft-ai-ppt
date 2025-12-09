<template>
  <div class="aippt-dialog">
    <div class="header">
      <span class="title">AIPPT</span>
      <span class="subtite" v-if="step === 'template'">从下方挑选合适的模板生成PPT，或<span class="local" v-tooltip="'上传.pptist格式模板文件'" @click="uploadLocalTemplate()">使用本地模板生成</span></span>
      <span class="subtite" v-else-if="step === 'outline'">确认下方内容大纲（点击编辑内容，右键添加/删除大纲项），开始选择模板</span>
      <span class="subtite" v-else>在下方输入您的PPT主题，并适当补充信息，如行业、岗位、学科、用途等</span>
    </div>
    
    <template v-if="step === 'setup'">
      <Input class="input" 
        ref="inputRef"
        v-model:value="keyword" 
        :maxlength="50" 
        placeholder="请输入PPT主题，如：大学生职业生涯规划" 
        @enter="createOutline()"
      >
        <template #suffix>
          <span class="count">{{ keyword.length }} / 50</span>
          <div class="submit" type="primary" @click="createOutline()"><IconSend class="icon" /> AI 生成</div>
        </template>
      </Input>

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

      <div class="recommends">
        <div class="recommend" v-for="(item, index) in recommends" :key="index" @click="setKeyword(item)">{{ item }}</div>
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
import api, { type WordContent } from '@/services'
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

const language = ref('中文')
const style = ref('通用')
const img = ref('')
const keyword = ref('')
const outline = ref('')
const selectedTemplate = ref('template_1')
const loading = ref(false)
const outlineCreating = ref(false)
const overwrite = ref(true)
const step = ref<'setup' | 'outline' | 'template'>('setup')
const model = ref('GLM-4.5-Flash')
const outlineRef = useTemplateRef<HTMLElement>('outlineRef')
const inputRef = useTemplateRef<InstanceType<typeof Input>>('inputRef')

// Word上传相关状态
const wordFile = ref<File | null>(null)
const wordContent = ref<WordContent | null>(null)
const wordParsing = ref(false)

const recommends = ref([
  '2025科技前沿动态',
  '大数据如何改变世界',
  '餐饮市场调查与研究',
  'AIGC在教育领域的应用',
  '社交媒体与品牌营销',
  '5G技术如何改变我们的生活',
  '年度工作总结与展望',
  '区块链技术及其应用',
  '大学生职业生涯规划',
  '公司年会策划方案',
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
