import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// PPT 编辑器原有样式
import '@icon-park/vue-next/styles/index.css'
import 'prosemirror-view/style/prosemirror.css'
import 'animate.css'
import '@/assets/styles/prosemirror.scss'
import '@/assets/styles/global.scss'
import '@/assets/styles/font.scss'

// Element Plus 样式（作用域隔离到 .sales-platform）
import '@/assets/styles/element-plus-scoped.scss'

// 售前平台样式
import '@/assets/styles/sales.scss'
// 管理后台样式
import '@/assets/styles/admin.scss'
import 'remixicon/fonts/remixicon.css'

import Icon from '@/plugins/icon'
import Directive from '@/plugins/directive'

// Element Plus（全局注册组件功能，但样式已在 sales.scss 中隔离）
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

const app = createApp(App)

// 注册 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(Icon)
app.use(Directive)
app.use(ElementPlus, {
  locale: zhCn
})  // Element Plus 组件功能全局可用，配置为中文
app.use(createPinia())
app.use(router)
app.mount('#app')
