<template>
  <div class="ai-edit-panel" :class="{ 'collapsed': isCollapsed }">
    <!-- 折叠按钮 -->
    <div class="collapse-toggle" @click="toggleCollapse">
      <span v-if="isCollapsed">💬</span>
      <span v-else>›</span>
    </div>
    
    <div class="panel-content" v-show="!isCollapsed">
      <!-- 头部 -->
      <div class="panel-header">
        <div class="title">
          <span class="icon">✨</span>
          <span>PPT助手</span>
        </div>
        <div class="actions">
          <span class="action-btn" @click="clearHistory" v-tooltip="'清空对话'">🗑️</span>
        </div>
      </div>
      
      <!-- 快捷操作按钮 -->
      <div class="quick-actions">
        <button class="quick-btn" @click="quickAction('change_style')">
          <span class="btn-icon">🎨</span>
          <span>更换样式</span>
        </button>
        <button class="quick-btn" @click="quickAction('continue_write')">
          <span class="btn-icon">✏️</span>
          <span>续写一页</span>
        </button>
        <button class="quick-btn" @click="quickAction('adjust_content')">
          <span class="btn-icon">📝</span>
          <span>增减内容</span>
        </button>
      </div>
      
      <!-- 消息列表 -->
      <div class="message-list" ref="messageListRef">
        <!-- 欢迎消息 -->
        <div class="message assistant" v-if="messages.length === 0">
          <div class="message-content">
            <p>👋 你好！我是PPT智能助手</p>
            <p>我可以帮你：</p>
            <ul>
              <li>更换页面样式</li>
              <li>续写PPT内容</li>
              <li>推荐配图</li>
              <li>调整内容项数</li>
            </ul>
            <p>也可以和我随便聊聊～</p>
          </div>
        </div>
        
        <!-- 对话消息 -->
        <div 
          v-for="msg in messages" 
          :key="msg.id" 
          :class="['message', msg.role]"
        >
          <!-- 用户消息 -->
          <div v-if="msg.role === 'user'" class="message-content user-msg">
            {{ msg.content }}
          </div>
          
          <!-- AI消息 -->
          <div v-else class="message-content assistant-msg">
            <!-- 普通文本（支持 Markdown） -->
            <div 
              v-if="msg.type === 'chat' || msg.type === 'query' || msg.type === 'limit'" 
              class="chat-text markdown-body"
              v-html="renderMarkdown(msg.content)"
            ></div>
            
            <!-- 编辑操作结果 -->
            <div v-else-if="msg.type === 'edit'" class="edit-result">
              <div class="result-text" v-html="renderMarkdown(msg.content)"></div>
              
              <!-- 更换样式 -->
              <TemplateSelector
                v-if="msg.action === 'change_style'"
                :slideType="msg.data?.slideType"
                :itemCount="msg.data?.itemCount"
                @select="handleTemplateSelect"
              />
              
              <!-- 续写一页 -->
              <ContinuePreview
                v-if="msg.action === 'continue_write'"
                :slide="msg.data?.slide"
                @confirm="handleContinueConfirm"
                @cancel="handleContinueCancel"
              />
              
              <!-- 增减内容 -->
              <ContentAdjust
                v-if="msg.action === 'adjust_content'"
                :items="msg.data?.items"
                :count="msg.data?.count"
                :originalCount="msg.data?.originalCount"
                :slideType="msg.data?.slideType"
                @confirm="handleAdjustConfirm"
              />
            </div>
            
            <!-- 流式输出中 -->
            <div v-if="msg.streaming" class="streaming-indicator">
              <span class="dot">●</span>
              <span class="dot">●</span>
              <span class="dot">●</span>
            </div>
          </div>
        </div>
        
        <!-- 加载中 -->
        <div v-if="loading" class="message assistant">
          <div class="message-content loading">
            <span class="loading-dot">●</span>
            <span class="loading-dot">●</span>
            <span class="loading-dot">●</span>
          </div>
        </div>
      </div>
      
      <!-- 输入区域 -->
      <div class="input-area">
        <textarea
          ref="inputRef"
          v-model="inputText"
          placeholder="需要我做什么？"
          @keydown.enter.exact="handleEnter"
          @keydown.enter.shift.exact.prevent="inputText += '\n'"
          :disabled="loading"
        ></textarea>
        <button class="send-btn" @click="sendMessage" :disabled="loading || !inputText.trim()">
          <span v-if="loading">⏳</span>
          <span v-else>➤</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useSlidesStore, useMainStore } from '@/store'
import { storeToRefs } from 'pinia'
import { nanoid } from 'nanoid'
import { marked } from 'marked'
import api from '@/services'
import message from '@/utils/message'
import { getSlideItemCount } from '@/services/templateService'
import type { Slide, PPTElement } from '@/types/slides'
import TemplateSelector from './TemplateSelector.vue'
import ContinuePreview from './ContinuePreview.vue'
import ContentAdjust from './ContentAdjust.vue'

// 配置 marked
marked.setOptions({
  breaks: true,      // 支持换行
  gfm: true,         // 支持 GitHub 风格 Markdown
})

/**
 * 渲染 Markdown 为 HTML
 */
const renderMarkdown = (text: string): string => {
  if (!text) return ''
  try {
    return marked.parse(text) as string
  } catch (e) {
    return text
  }
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  type?: 'chat' | 'query' | 'edit' | 'limit' | 'error'
  action?: string
  data?: any
  streaming?: boolean
}

const slidesStore = useSlidesStore()
const mainStore = useMainStore()
const { slides, slideIndex, currentSlide } = storeToRefs(slidesStore)

const isCollapsed = ref(mainStore.aiEditPanelCollapsed)
const inputText = ref('')
const loading = ref(false)
const messages = ref<ChatMessage[]>([])
const messageListRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

// 当前PPT上下文
const pptContext = computed(() => ({
  currentSlide: currentSlide.value,
  slideIndex: slideIndex.value,
  totalSlides: slides.value.length,
  topic: '', // 可从store或其他地方获取
  slides: slides.value,
}))

// 折叠/展开
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
  // 同步折叠状态到 store
  mainStore.setAIEditPanelCollapsed(isCollapsed.value)
}

// 清空对话
const clearHistory = () => {
  messages.value = []
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

// 生成消息ID
const genMsgId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// 快捷操作
// 续写话术前缀
const CONTINUE_PREFIX = '插入的PPT主要内容是：'
// 续写意图识别正则
const CONTINUE_PATTERN = /^插入的PPT主要内容是[：:]\s*(.+)$/

/**
 * 识别续写意图
 * @returns 主题内容，如果不是续写意图返回 null
 */
const parseContinueIntent = (text: string): string | null => {
  const match = text.match(CONTINUE_PATTERN)
  return match ? match[1].trim() : null
}

const quickAction = (action: string) => {
  // 续写一页：特殊处理，填入话术并聚焦
  if (action === 'continue_write') {
    inputText.value = CONTINUE_PREFIX
    nextTick(() => {
      inputRef.value?.focus()
      // 光标定位到末尾
      const len = inputText.value.length
      inputRef.value?.setSelectionRange(len, len)
    })
    return
  }
  
  // 其他操作：直接发送
  const actionTexts: Record<string, string> = {
    change_style: '帮我更换样式',
    adjust_content: '帮我减少内容项数',
  }
  inputText.value = actionTexts[action] || ''
  sendMessage()
}

// 发送消息
const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text || loading.value) return
  
  // 检测续写意图
  const continueTopicContent = parseContinueIntent(text)
  
  // 添加用户消息
  messages.value.push({
    id: genMsgId(),
    role: 'user',
    content: text,
  })
  inputText.value = ''
  scrollToBottom()
  
  // 续写意图：主题内容为空时提示
  if (text.startsWith(CONTINUE_PREFIX) && !continueTopicContent) {
    messages.value.push({
      id: genMsgId(),
      role: 'assistant',
      content: '请在"插入的PPT主要内容是："后面输入您想要的主题内容，例如：\n\n`插入的PPT主要内容是：年度销售分析`',
      type: 'chat',
    })
    scrollToBottom()
    return
  }
  
  loading.value = true
  
  try {
    // 续写意图：走续写流程
    if (continueTopicContent) {
      await handleContinueWrite(continueTopicContent)
      return
    }
    
    // 普通消息：调用 AI 对话
    const response = await api.aipptChat({
      message: text,
      context: pptContext.value,
      history: messages.value.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      })),
      model: 'deepseek-chat',
    })
    
    // 检查是否是SSE流式响应
    const contentType = response.headers.get('content-type')
    
    if (contentType?.includes('text/event-stream')) {
      // 流式响应处理
      await handleStreamResponse(response)
    } else {
      // 普通JSON响应
      const result = await response.json()
      handleJsonResponse(result)
    }
  } catch (error: any) {
    console.error('对话错误:', error)
    messages.value.push({
      id: genMsgId(),
      role: 'assistant',
      content: '抱歉，出现了错误：' + (error.message || '未知错误'),
      type: 'error',
    })
  } finally {
    loading.value = false
    scrollToBottom()
  }
}

// 处理流式响应
const handleStreamResponse = async (response: Response) => {
  const reader = response.body?.getReader()
  if (!reader) {
    // reader 为空，回退到普通响应处理
    console.warn('无法获取流式响应 reader，尝试普通解析')
    try {
      const text = await response.text()
      messages.value.push({
        id: genMsgId(),
        role: 'assistant',
        content: text || '收到空响应',
        type: 'chat',
      })
    } catch (e) {
      messages.value.push({
        id: genMsgId(),
        role: 'assistant',
        content: '无法读取响应',
        type: 'error',
      })
    }
    return
  }
  
  const decoder = new TextDecoder()
  let currentMsg: ChatMessage | null = null
  let buffer = '' // 缓冲区，处理不完整的数据块
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk
      
      // 按换行符分割，处理完整的行
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 保留最后一个不完整的行
      
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        
        try {
          const data = JSON.parse(line.slice(6))
          
          if (data.type === 'chat') {
            if (data.streaming && !currentMsg) {
              // 开始流式输出
              currentMsg = {
                id: genMsgId(),
                role: 'assistant',
                content: '',
                type: 'chat',
                streaming: true,
              }
              messages.value.push(currentMsg)
            } else if (data.content && currentMsg) {
              // 追加内容
              currentMsg.content += data.content
              scrollToBottom()
            }
          } else if (data.type === 'done' && currentMsg) {
            currentMsg.streaming = false
          } else if (data.type === 'error') {
            // 处理错误
            if (currentMsg) {
              currentMsg.streaming = false
              currentMsg.content += `\n\n❌ 错误: ${data.message || '未知错误'}`
            } else {
              messages.value.push({
                id: genMsgId(),
                role: 'assistant',
                content: `❌ 错误: ${data.message || '未知错误'}`,
                type: 'error',
              })
            }
          }
        } catch (e) {
          // 解析失败，忽略
          console.warn('SSE 数据解析失败:', line)
        }
      }
    }
    
    // 处理缓冲区中剩余的数据
    if (buffer.startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.slice(6))
        if (data.type === 'done' && currentMsg) {
          currentMsg.streaming = false
        }
      } catch (e) {
        // 忽略
      }
    }
    
    // 如果没有收到任何消息
    if (!currentMsg) {
      messages.value.push({
        id: genMsgId(),
        role: 'assistant',
        content: '未收到有效响应，请重试',
        type: 'error',
      })
    }
  } catch (error: any) {
    console.error('流式响应处理错误:', error)
    if (currentMsg) {
      currentMsg.streaming = false
      currentMsg.content += `\n\n❌ 错误: ${error.message || '连接中断'}`
    } else {
      messages.value.push({
        id: genMsgId(),
        role: 'assistant',
        content: `❌ 错误: ${error.message || '连接中断'}`,
        type: 'error',
      })
    }
  }
}

// 处理JSON响应
const handleJsonResponse = (result: any) => {
  if (!result.success) {
    messages.value.push({
      id: genMsgId(),
      role: 'assistant',
      content: result.error || '处理失败',
      type: 'error',
    })
    return
  }
  
  const msg: ChatMessage = {
    id: genMsgId(),
    role: 'assistant',
    content: result.message || '',
    type: result.type,
  }
  
  if (result.type === 'edit') {
    msg.action = result.action
    msg.data = result.data
    
    // 对于更换样式，使用前端计算的精确 itemCount
    if (result.action === 'change_style' && currentSlide.value) {
      msg.data = {
        ...msg.data,
        slideType: currentSlide.value.type || 'content',
        itemCount: getSlideItemCount(currentSlide.value),
      }
    }
    
  }
  
  messages.value.push(msg)
  scrollToBottom()
}

// 处理回车
const handleEnter = (e: KeyboardEvent) => {
  e.preventDefault()
  sendMessage()
}

// ============ 编辑操作处理 ============

/**
 * 从页面元素中提取文本内容（按类型分组）
 * 包括内容类型和序号类型，以支持过渡页的完整替换
 */
const extractSlideTexts = (slide: Slide) => {
  const texts: Record<string, string[]> = {
    title: [],
    content: [],
    itemTitle: [],
    item: [],
    subtitle: [],
    itemNumber: [],   // 序号（过渡页需要）
    partNumber: [],   // 章节号（过渡页需要）
  }
  
  if (!slide.elements) return texts
  
  for (const el of slide.elements) {
    let textType = ''
    let textContent = ''
    
    if (el.type === 'text') {
      textType = el.textType || ''
      // 提取纯文本
      textContent = el.content?.replace(/<[^>]*>/g, '').trim() || ''
    } else if (el.type === 'shape' && el.text) {
      textType = el.text.type || ''
      textContent = el.text.content?.replace(/<[^>]*>/g, '').trim() || ''
    }
    
    if (textType && textContent && texts[textType] !== undefined) {
      texts[textType].push(textContent)
    }
  }
  
  return texts
}

/**
 * 替换HTML中的文本内容，保留样式标签
 */
const replaceTextContent = (html: string, newText: string): string => {
  if (!html) return `<p>${newText}</p>`
  
  // 尝试替换第一个文本节点的内容
  // 匹配 >文本< 的模式
  const replaced = html.replace(/>([^<]+)</, `>${newText}<`)
  if (replaced !== html) return replaced
  
  // 如果没有匹配到，直接包装
  return `<p>${newText}</p>`
}

/**
 * 需要用当前页面内容替换的文本类型（通用）
 * 这些是实际的"内容"，需要保留用户的文字
 */
const CONTENT_TEXT_TYPES = ['title', 'subtitle', 'content', 'itemTitle', 'item']

/**
 * 过渡页特殊处理：所有文本都用当前页的（包括序号）
 * 因为过渡页的序号是章节号，有实际意义
 */
const TRANSITION_TEXT_TYPES = ['title', 'subtitle', 'content', 'itemTitle', 'item', 'itemNumber', 'partNumber']

/**
 * 判断文本类型是否需要替换内容
 * @param textType 文本类型
 * @param slideType 页面类型
 */
const shouldReplaceContent = (textType: string, slideType?: string): boolean => {
  // 过渡页：所有文本都用当前页的内容（包括序号）
  if (slideType === 'transition') {
    return TRANSITION_TEXT_TYPES.includes(textType)
  }
  // 其他页面：只替换内容类型，序号用新模板的
  return CONTENT_TEXT_TYPES.includes(textType)
}

/**
 * 将文本内容填充到新模板中
 * 
 * 核心逻辑：
 * 1. title, subtitle, content, itemTitle, item → 用当前页面内容替换
 * 2. itemNumber, partNumber 等序号 → 
 *    - 过渡页：用当前页内容（章节号有意义）
 *    - 其他页：保留新模板内容（装饰性序号）
 * 3. 其他装饰性元素 → 保留新模板的内容
 * 
 * @param template 新模板
 * @param texts 当前页面提取的文本内容
 * @param slideType 当前页面类型
 */
const fillTemplateWithContent = (
  template: Slide, 
  texts: Record<string, string[]>,
  slideType?: string
): Slide => {
  const newElements: PPTElement[] = []
  
  // 记录每种类型的使用索引
  const usedIndices: Record<string, number> = {
    title: 0,
    content: 0,
    itemTitle: 0,
    item: 0,
    subtitle: 0,
    itemNumber: 0,
    partNumber: 0,
  }
  
  for (const el of template.elements) {
    let newEl: PPTElement = { ...el, id: nanoid(10) }
    
    // 文本元素
    if (el.type === 'text' && el.textType) {
      const textType = el.textType as string
      
      // 根据页面类型判断是否需要替换
      if (shouldReplaceContent(textType, slideType)) {
        const textList = texts[textType] || []
        const idx = usedIndices[textType] || 0
        
        if (idx < textList.length) {
          // 有对应的当前页面内容，替换进去
          const newContent = replaceTextContent(el.content || '', textList[idx])
          newEl = { ...newEl, content: newContent } as PPTElement
          usedIndices[textType] = idx + 1
        } else {
          // 没有对应内容，清空（不使用模板原有内容）
          const emptyContent = replaceTextContent(el.content || '', '')
          newEl = { ...newEl, content: emptyContent } as PPTElement
        }
      }
      // 不需要替换的类型：保留新模板的内容
    }
    // 形状中的文本
    else if (el.type === 'shape' && el.text?.type) {
      const textType = el.text.type as string
      
      // 根据页面类型判断是否需要替换
      if (shouldReplaceContent(textType, slideType)) {
        const textList = texts[textType] || []
        const idx = usedIndices[textType] || 0
        
        if (idx < textList.length) {
          // 有对应内容，替换
          const newContent = replaceTextContent(el.text.content || '', textList[idx])
          newEl = { 
            ...newEl, 
            text: { ...el.text, content: newContent } 
          } as PPTElement
          usedIndices[textType] = idx + 1
        } else {
          // 没有对应内容，清空
          const emptyContent = replaceTextContent(el.text.content || '', '')
          newEl = { 
            ...newEl, 
            text: { ...el.text, content: emptyContent } 
          } as PPTElement
        }
      }
      // 不需要替换的类型：保留新模板的内容
    }
    
    newElements.push(newEl)
  }
  
  return {
    ...template,
    id: nanoid(10),
    elements: newElements,
  }
}

/**
 * 选择模板 - 应用样式更换
 */
const handleTemplateSelect = (template: Slide) => {
  if (!currentSlide.value) {
    message.error('当前没有选中的页面')
    return
  }
  
  try {
    // 1. 提取当前页面的文本内容
    const texts = extractSlideTexts(currentSlide.value)
    const slideType = currentSlide.value.type
    console.log('提取的文本:', texts, '页面类型:', slideType)
    
    // 2. 将内容填充到新模板中（传入页面类型，用于区分过渡页）
    const newSlide = fillTemplateWithContent(template, texts, slideType)
    console.log('新页面:', newSlide)
    
    // 3. 替换当前页面
    slidesStore.updateSlide({
      elements: newSlide.elements,
      background: newSlide.background,
    })
    
    message.success('样式已更换！')
    
    // 添加成功消息
    messages.value.push({
      id: genMsgId(),
      role: 'assistant',
      content: '✅ 样式更换成功！页面内容已保留。',
      type: 'chat',
    })
    scrollToBottom()
  } catch (error: any) {
    console.error('样式更换失败:', error)
    message.error('样式更换失败：' + error.message)
  }
}

/**
 * 处理续写一页流程
 * @param topic 用户输入的主题内容
 */
const handleContinueWrite = async (topic: string) => {
  try {
    // 1. 显示处理中消息
    const processingMsgId = genMsgId()
    messages.value.push({
      id: processingMsgId,
      role: 'assistant',
      content: `好的，正在为您生成"${topic}"相关内容...`,
      type: 'chat',
      streaming: true,
    })
    scrollToBottom()
    
    // 2. 调用后端生成要点
    const response = await api.aipptChat({
      message: `续写一页：${topic}`,  // 特殊格式让后端识别
      context: {
        ...pptContext.value,
        continueWriteTopic: topic,  // 额外传递主题
      },
      model: 'deepseek-chat',
    })
    
    const result = await response.json()
    
    // 更新处理消息
    const processingMsg = messages.value.find(m => m.id === processingMsgId)
    if (processingMsg) {
      processingMsg.streaming = false
    }
    
    if (!result.success || !result.data?.items) {
      messages.value.push({
        id: genMsgId(),
        role: 'assistant',
        content: `❌ 生成失败：${result.error || '无法生成内容'}`,
        type: 'error',
      })
      return
    }
    
    const items = result.data.items as Array<{ title: string; text: string }>
    const itemCount = items.length
    
    // 3. 显示生成的要点
    let itemsPreview = `✅ 已生成 ${itemCount} 个要点：\n\n`
    items.forEach((item, i) => {
      itemsPreview += `**${i + 1}. ${item.title}**\n${item.text || ''}\n\n`
    })
    
    messages.value.push({
      id: genMsgId(),
      role: 'assistant',
      content: itemsPreview,
      type: 'chat',
    })
    scrollToBottom()
    
    // 4. 匹配模板
    messages.value.push({
      id: genMsgId(),
      role: 'assistant',
      content: '正在匹配最合适的模板...',
      type: 'chat',
      streaming: true,
    })
    
    const matchedTemplate = await findBestTemplate(itemCount)
    
    // 更新消息
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg.streaming) {
      lastMsg.streaming = false
    }
    
    if (!matchedTemplate) {
      messages.value.push({
        id: genMsgId(),
        role: 'assistant',
        content: '❌ 未找到匹配的模板，请检查模板库',
        type: 'error',
      })
      return
    }
    
    // 5. 创建新页面
    const newSlide = createSlideFromTemplate(matchedTemplate, items, topic)
    
    // 6. 插入到当前页面的下一页
    const insertIndex = slideIndex.value + 1
    slidesStore.addSlide(newSlide, insertIndex)
    
    // 7. 跳转到新页面
    await nextTick()
    slidesStore.updateSlideIndex(insertIndex)
    
    // 8. 成功消息
    messages.value.push({
      id: genMsgId(),
      role: 'assistant',
      content: `🎉 新页面已插入到第 ${insertIndex + 1} 页，已自动跳转！`,
      type: 'chat',
    })
    scrollToBottom()
    
    message.success('续写成功！')
  } catch (error: any) {
    console.error('续写失败:', error)
    messages.value.push({
      id: genMsgId(),
      role: 'assistant',
      content: `❌ 续写失败：${error.message || '未知错误'}`,
      type: 'error',
    })
  } finally {
    loading.value = false
  }
}

/**
 * 查找最匹配的模板
 * @param targetItemCount 目标要点数量
 */
const findBestTemplate = async (targetItemCount: number): Promise<Slide | null> => {
  const { getTemplateList, getTemplateSlides, getSlideItemCount } = await import('@/services/templateService')
  
  const templateList = await getTemplateList()
  if (templateList.length === 0) return null
  
  let bestMatch: Slide | null = null
  let minDiff = Infinity
  
  // 遍历所有模板库
  for (const tpl of templateList) {
    try {
      const slides = await getTemplateSlides(tpl.id)
      
      // 只筛选 content 类型
      const contentSlides = slides.filter(s => s.type === 'content')
      
      for (const slide of contentSlides) {
        const itemCount = getSlideItemCount(slide)
        const diff = Math.abs(itemCount - targetItemCount)
        
        // 优先完全匹配
        if (diff === 0) {
          return slide
        }
        
        // 否则找最接近的（优先 >= 目标数量）
        if (itemCount >= targetItemCount && diff < minDiff) {
          minDiff = diff
          bestMatch = slide
        } else if (!bestMatch && diff < minDiff) {
          minDiff = diff
          bestMatch = slide
        }
      }
    } catch (e) {
      console.warn(`加载模板 ${tpl.id} 失败`, e)
    }
  }
  
  return bestMatch
}

/**
 * 根据模板和要点创建新页面
 */
const createSlideFromTemplate = (
  template: Slide,
  items: Array<{ title: string; text: string }>,
  topic: string
): Slide => {
  // 构建文本内容
  const texts: Record<string, string[]> = {
    title: [topic],
    subtitle: [],
    content: [],
    itemTitle: items.map(it => it.title),
    item: items.map(it => it.text || ''),
    itemNumber: [],
    partNumber: [],
  }
  
  // 使用现有的填充函数
  return fillTemplateWithContent(template, texts, 'content')
}

// 确认续写（旧版，保留兼容）
const handleContinueConfirm = (slide: any) => {
  // 插入到当前页面的下一页
  const insertIndex = slideIndex.value + 1
  slidesStore.addSlide(slide, insertIndex)
  
  // 跳转到新页面
  nextTick(() => {
    slidesStore.updateSlideIndex(insertIndex)
  })
  
  message.success('页面已添加')
}

// 取消续写
const handleContinueCancel = () => {
  message.info('已取消')
}

// 确认调整内容
const handleAdjustConfirm = (data: { items: any[], template?: Slide }) => {
  if (!currentSlide.value) {
    message.error('当前没有选中的页面')
    return
  }
  
  try {
    // 1. 构建新的文本内容
    const texts: Record<string, string[]> = {
      title: [],
      content: [],
      itemTitle: [],
      item: [],
      subtitle: [],
      itemNumber: [],
      partNumber: [],
    }
    
    // 从当前页面提取非 item 类型的内容（title, subtitle 等）
    const currentTexts = extractSlideTexts(currentSlide.value)
    texts.title = currentTexts.title
    texts.subtitle = currentTexts.subtitle
    texts.content = currentTexts.content
    texts.itemNumber = currentTexts.itemNumber
    texts.partNumber = currentTexts.partNumber
    
    // 使用调整后的 items
    if (data.items && data.items.length > 0) {
      texts.itemTitle = data.items.map(item => {
        if (typeof item === 'string') return item
        return item.title || ''
      })
      texts.item = data.items.map(item => {
        if (typeof item === 'string') return ''
        return item.text || ''
      })
    }
    
    // 2. 如果选择了模板，应用新模板样式
    if (data.template) {
      const slideType = currentSlide.value.type
      const newSlide = fillTemplateWithContent(data.template, texts, slideType)
      
      slidesStore.updateSlide({
        elements: newSlide.elements,
        background: newSlide.background,
      })
      
      message.success('内容已调整，样式已更换！')
    } else {
      // 3. 没有选择模板，只更新内容（直接修改当前页面的元素）
      const newElements = updateSlideContent(currentSlide.value, texts)
      slidesStore.updateSlide({ elements: newElements })
      
      message.success('内容已调整！')
    }
    
    // 添加成功消息
    messages.value.push({
      id: genMsgId(),
      role: 'assistant',
      content: data.template 
        ? '✅ 内容已调整，样式已更换！' 
        : '✅ 内容已调整！',
      type: 'chat',
    })
    scrollToBottom()
  } catch (error: any) {
    console.error('内容调整失败:', error)
    message.error('调整失败：' + error.message)
  }
}

/**
 * 更新页面内容（不更换模板）
 */
const updateSlideContent = (slide: Slide, texts: Record<string, string[]>): PPTElement[] => {
  const newElements: PPTElement[] = []
  
  const usedIndices: Record<string, number> = {
    itemTitle: 0,
    item: 0,
  }
  
  for (const el of slide.elements) {
    let newEl: PPTElement = { ...el }
    
    // 文本元素
    if (el.type === 'text' && el.textType) {
      const textType = el.textType as string
      
      if (textType === 'itemTitle' || textType === 'item') {
        const textList = texts[textType] || []
        const idx = usedIndices[textType] || 0
        
        if (idx < textList.length) {
          const newContent = replaceTextContent(el.content || '', textList[idx])
          newEl = { ...newEl, content: newContent } as PPTElement
          usedIndices[textType] = idx + 1
        } else {
          // 多余的元素标记为删除（设为空或跳过）
          continue // 跳过多余的元素
        }
      }
    }
    // 形状中的文本
    else if (el.type === 'shape' && el.text?.type) {
      const textType = el.text.type as string
      
      if (textType === 'itemTitle' || textType === 'item') {
        const textList = texts[textType] || []
        const idx = usedIndices[textType] || 0
        
        if (idx < textList.length) {
          const newContent = replaceTextContent(el.text.content || '', textList[idx])
          newEl = { 
            ...newEl, 
            text: { ...el.text, content: newContent } 
          } as PPTElement
          usedIndices[textType] = idx + 1
        } else {
          continue // 跳过多余的元素
        }
      }
    }
    
    newElements.push(newEl)
  }
  
  return newElements
}

// 监听消息变化，自动滚动
watch(messages, () => {
  scrollToBottom()
}, { deep: true })

onMounted(() => {
  // 自动聚焦输入框
  inputRef.value?.focus()
})
</script>

<style lang="scss" scoped>
// 主题颜色变量
.ai-edit-panel {
  // 亮色主题（默认）
  --panel-bg: #fff;
  --panel-border: #eee;
  --panel-shadow: rgba(0, 0, 0, 0.1);
  --text-primary: #333;
  --text-secondary: #666;
  --bg-hover: #f5f5f5;
  --bg-secondary: #fafafa;
  --bg-message-user: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --bg-message-assistant: #f5f5f5;
  --text-message-user: #fff;
  --text-message-assistant: #333;
  --input-border: #ddd;
  --input-border-focus: #667eea;
  --quick-btn-border: #e0e0e0;
  --quick-btn-hover-bg: #f0f4ff;
  --quick-btn-hover-border: #667eea;
  
  // 暗色主题适配
  @media (prefers-color-scheme: dark) {
    --panel-bg: #1e1e1e;
    --panel-border: #333;
    --panel-shadow: rgba(0, 0, 0, 0.3);
    --text-primary: #e0e0e0;
    --text-secondary: #a0a0a0;
    --bg-hover: #2a2a2a;
    --bg-secondary: #252525;
    --bg-message-user: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --bg-message-assistant: #2a2a2a;
    --text-message-user: #fff;
    --text-message-assistant: #e0e0e0;
    --input-border: #444;
    --input-border-focus: #667eea;
    --quick-btn-border: #444;
    --quick-btn-hover-bg: #2a2a50;
    --quick-btn-hover-border: #667eea;
  }
  
  position: fixed;
  right: 0;
  top: 40px;
  bottom: 0;
  width: 380px;
  background: var(--panel-bg);
  box-shadow: -2px 0 12px var(--panel-shadow);
  display: flex;
  flex-direction: column;
  z-index: 100;
  transition: transform 0.3s ease;
  
  &.collapsed {
    transform: translateX(calc(100% - 4px));
  }
}

.collapse-toggle {
  position: absolute;
  left: -32px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 60px;
  background: var(--panel-bg);
  border-radius: 8px 0 0 8px;
  box-shadow: -2px 0 8px var(--panel-shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  color: var(--text-primary);
  
  &:hover {
    background: var(--bg-hover);
  }
}

.panel-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--panel-border);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  
  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    
    .icon {
      font-size: 20px;
    }
  }
  
  .actions {
    .action-btn {
      cursor: pointer;
      opacity: 0.8;
      
      &:hover {
        opacity: 1;
      }
    }
  }
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--panel-border);
  background: var(--bg-secondary);
  
  .quick-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 4px;
    border: 1px solid var(--quick-btn-border);
    border-radius: 8px;
    background: var(--panel-bg);
    cursor: pointer;
    font-size: 12px;
    color: var(--text-primary);
    transition: all 0.2s;
    
    &:hover {
      border-color: var(--quick-btn-hover-border);
      background: var(--quick-btn-hover-bg);
    }
    
    .btn-icon {
      font-size: 18px;
    }
  }
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  
  .message {
    margin-bottom: 16px;
    
    &.user {
      display: flex;
      justify-content: flex-end;
    }
    
    &.assistant {
      display: flex;
      justify-content: flex-start;
    }
  }
  
  .message-content {
    max-width: 90%;
    padding: 10px 14px;
    border-radius: 12px;
    line-height: 1.5;
    font-size: 14px;
    
    &.user-msg {
      background: var(--bg-message-user);
      color: var(--text-message-user);
      border-bottom-right-radius: 4px;
    }
    
    &.assistant-msg {
      background: var(--bg-message-assistant);
      color: var(--text-message-assistant);
      border-bottom-left-radius: 4px;
      
      // Markdown 内容样式
      .markdown-body {
        :deep(p) {
          margin: 0 0 8px 0;
          
          &:last-child {
            margin-bottom: 0;
          }
        }
        
        :deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
          margin: 12px 0 8px 0;
          font-weight: 600;
          
          &:first-child {
            margin-top: 0;
          }
        }
        
        :deep(h1) { font-size: 1.3em; }
        :deep(h2) { font-size: 1.2em; }
        :deep(h3) { font-size: 1.1em; }
        
        :deep(ul), :deep(ol) {
          margin: 8px 0;
          padding-left: 20px;
        }
        
        :deep(li) {
          margin: 4px 0;
        }
        
        :deep(code) {
          background: rgba(0, 0, 0, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Monaco', 'Consolas', monospace;
          font-size: 0.9em;
        }
        
        :deep(pre) {
          background: rgba(0, 0, 0, 0.1);
          padding: 12px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 8px 0;
          
          code {
            background: none;
            padding: 0;
          }
        }
        
        :deep(blockquote) {
          margin: 8px 0;
          padding: 8px 12px;
          border-left: 3px solid #667eea;
          background: rgba(102, 126, 234, 0.1);
          border-radius: 0 4px 4px 0;
        }
        
        :deep(strong) {
          font-weight: 600;
        }
        
        :deep(em) {
          font-style: italic;
        }
        
        :deep(a) {
          color: #667eea;
          text-decoration: none;
          
          &:hover {
            text-decoration: underline;
          }
        }
        
        :deep(hr) {
          border: none;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
          margin: 12px 0;
        }
        
        :deep(table) {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
          font-size: 0.9em;
          
          th, td {
            border: 1px solid rgba(0, 0, 0, 0.1);
            padding: 6px 10px;
            text-align: left;
          }
          
          th {
            background: rgba(0, 0, 0, 0.05);
            font-weight: 600;
          }
        }
      }
      
      ul {
        margin: 8px 0;
        padding-left: 20px;
        
        li {
          margin: 4px 0;
        }
      }
    }
    
    &.loading {
      display: flex;
      gap: 4px;
      color: var(--text-secondary);
      
      .loading-dot {
        animation: blink 1.4s infinite;
        
        &:nth-child(2) { animation-delay: 0.2s; }
        &:nth-child(3) { animation-delay: 0.4s; }
      }
    }
  }
  
  .streaming-indicator {
    display: flex;
    gap: 2px;
    margin-top: 8px;
    
    .dot {
      font-size: 8px;
      color: var(--text-secondary);
      animation: blink 1.4s infinite;
      
      &:nth-child(2) { animation-delay: 0.2s; }
      &:nth-child(3) { animation-delay: 0.4s; }
    }
  }
  
  .edit-result {
    .result-text {
      margin-bottom: 12px;
      color: var(--text-primary);
    }
  }
}

.input-area {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--panel-border);
  background: var(--panel-bg);
  
  textarea {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid var(--input-border);
    border-radius: 8px;
    resize: none;
    height: 44px;
    font-size: 14px;
    font-family: inherit;
    background: var(--panel-bg);
    color: var(--text-primary);
    
    &::placeholder {
      color: var(--text-secondary);
    }
    
    &:focus {
      outline: none;
      border-color: var(--input-border-focus);
    }
    
    &:disabled {
      background: var(--bg-hover);
      opacity: 0.6;
    }
  }
  
  .send-btn {
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    transition: opacity 0.2s;
    
    &:hover:not(:disabled) {
      opacity: 0.9;
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

@keyframes blink {
  0%, 80%, 100% { opacity: 0; }
  40% { opacity: 1; }
}
</style>

