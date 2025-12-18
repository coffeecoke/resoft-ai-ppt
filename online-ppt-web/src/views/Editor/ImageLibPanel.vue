<template>
  <MoveablePanel 
    class="image-lib-panel" 
    :width="360" 
    :height="580" 
    :left="-270" 
    :top="90"
    :contentStyle="{
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }"
    title="AI图片搜索（来自 pexels.com）" 
    @close="close()"
  >
    <div class="container" v-loading="{ state: loading, text: '加载中...' }">
      <div class="tools">
        <Input class="input" v-model:value="searchWord" placeholder="搜索图片" @enter="search()">
          <template #prefix>
            <Popover class="more-icon" trigger="click" v-model:value="orientationVisible">
              <template #content>
                <PopoverMenuItem
                  class="popover-menu-item"
                  :class="{ 'active': item.key === orientation }"
                  center
                  v-for="item in orientationOptions"
                  :key="item.key"
                  @click="setOrientation(item.key); orientationVisible = false"
                >{{ item.label }}</PopoverMenuItem>
              </template>
              <div class="search-orientation">{{ orientationMap[orientation] }} <IconDown :size="14" /></div>
            </Popover>
          </template>
          <template #suffix>
            <div class="search-btn" @click="search()"><IconSearch /></div>
          </template>
        </Input>
      </div>

      <ImageWaterfallViewer 
        class="imgs-wrap"
        :list="imgs"
        :columnSpacing="5"
        :columnWidth="160"
      >
        <template v-slot:default="props">
          <div class="img-item">
            <img :src="props.src">
            <div class="mask">
              <Button type="primary" size="small" @click="selectImage(props.src)">插入</Button>
            </div>
          </div>
        </template>
      </ImageWaterfallViewer>
      
      <div class="load-more-footer" v-if="imgs.length > 0">
        <Button 
          v-if="hasMore" 
          :loading="loading" 
          @click="loadMore()"
          class="load-more-btn"
        >
          {{ loading ? '加载中...' : '加载更多' }}
        </Button>
        <span v-else class="no-more-text">没有更多图片了</span>
      </div>
    </div>
  </MoveablePanel>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import api from '@/services'
import { useMainStore } from '@/store/main'
import useCreateElement from '@/hooks/useCreateElement'
import message from '@/utils/message'
import Button from '@/components/Button.vue'
import MoveablePanel from '@/components/MoveablePanel.vue'
import ImageWaterfallViewer from '@/components/ImageWaterfallViewer.vue'
import Input from '@/components/Input.vue'
import Popover from '@/components/Popover.vue'
import PopoverMenuItem from '@/components/PopoverMenuItem.vue'

interface ImageItem {
  id: number
  width: number
  height: number
  src: string
}

type Orientation = 'landscape' | 'portrait' | 'square' | 'all'

const mainStore = useMainStore()

const { createImageElement } = useCreateElement()

const imgs = ref<ImageItem[]>([])
const loading = ref(false)
const orientationVisible = ref(false)
const searchWord = ref('')
const page = ref(1)
const perPage = ref(6)
const hasMore = ref(true)
const orientation = ref<Orientation>('all')
const orientationOptions: {
  key: Orientation
  label: string
}[] = [
  { key: 'all', label: '全部' },
  { key: 'landscape', label: '横向' },
  { key: 'portrait', label: '纵向' },
  { key: 'square', label: '方形' },
]
const orientationMap: { [key: string]: string } = {
  'all': '全部',
  'landscape': '横向',
  'portrait': '纵向',
  'square': '方形',
}

const close = () => {
  mainStore.setImageLibPanelState(false)
}

// 选择图片
const selectImage = (src: string) => {
  if (mainStore.imageLibPanelCallback) {
    // 使用回调（如设置背景图）
    mainStore.imageLibPanelCallback(src)
  } else {
    // 默认行为：插入图片元素
    createImageElement(src)
  }
  close()
}

onMounted(() => {
  search('风景')
})

const search = (q?: string) => {  
  const query = q || searchWord.value
  if (!query) return message.error('请输入搜索关键词')

  loading.value = true
  page.value = 1

  // orientation 'all' 时不传值，让后端处理
  const searchParams: any = {
    keyword: query,
    count: perPage.value,
    page: page.value,
  }
  
  if (orientation.value !== 'all') {
    searchParams.orientation = orientation.value
  }

  api.searchImages(searchParams).then(ret => {
    if (ret.success && ret.data) {
      // 适配新接口返回格式
      imgs.value = ret.data.images.map((img: any) => ({
        id: img.id,
        width: img.width,
        height: img.height,
        src: img.src
      }))
      hasMore.value = ret.data.hasMore !== false  // 是否还有更多图片
    } else {
      message.error(ret.error || '图片搜索失败')
      imgs.value = []
      hasMore.value = false
    }
    loading.value = false
  }).catch((err) => {
    message.error('图片搜索失败：' + (err.message || '网络错误'))
    loading.value = false
  })
}

const setOrientation = (value: Orientation) => {
  orientation.value = value
  if (searchWord.value) search()
}

const loadMore = () => {
  if (loading.value) return
  if (!hasMore.value) return  // 没有更多了，不再加载
  
  loading.value = true
  page.value += 1

  const searchParams: any = {
    keyword: searchWord.value || '风景',
    count: perPage.value,
    page: page.value,
  }
  
  if (orientation.value !== 'all') {
    searchParams.orientation = orientation.value
  }

  api.searchImages(searchParams).then(ret => {
    if (ret.success && ret.data) {
      const newImages = ret.data.images.map((img: any) => ({
        id: img.id,
        width: img.width,
        height: img.height,
        src: img.src
      }))
      imgs.value = [...imgs.value, ...newImages]
      hasMore.value = ret.data.hasMore !== false  // 更新是否还有更多
    } else {
      hasMore.value = false
    }
    loading.value = false
  }).catch(() => {
    hasMore.value = false
    loading.value = false
  })
}
</script>

<style lang="scss" scoped>
.image-lib-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.tools {
  flex-shrink: 0;
  margin-bottom: 10px;
}
.popover-menu-item {
  &.active {
    color: $themeColor;
  }
}
.search-orientation {
  color: #999;
  padding-left: 5px;
  cursor: pointer;
}
.search-btn {
  width: 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;

  &:hover {
    color: $themeColor;
  }
}
.imgs-wrap {
  flex: 1;
}
.img-item {
  border-radius: $borderRadius;
  overflow: hidden;
  position: relative;

  &:hover .mask {
    display: flex;
  }

  .mask {
    display: none;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: rgba(0, 0, 0, .25);
    @include absolute-0();
  }
}
.load-more-footer {
  text-align: center;
  padding: 15px 0;
  flex-shrink: 0;
  border-top: 1px solid var(--border-color);
  
  .load-more-btn {
    width: 90%;
    max-width: 200px;
  }
  
  .no-more-text {
    color: var(--text-tertiary);
    font-size: 12px;
  }
}
</style>
