<template>
  <section class="search-bar">
    <el-input v-model="keyword" placeholder="请输入关键词" class="search" @keyup.enter="handleSearch">
      <template #prepend>
        <el-select v-model="searchType" placeholder="筛选">
          <el-option label="客户" value="客户" />
          <el-option label="产品" value="产品" />
          <el-option label="问题" value="问题" />
        </el-select>
      </template>
      <template #append>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
      </template>
    </el-input>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const keyword = ref('')
const searchType = ref('客户')

const handleSearch = () => {
  const q = keyword.value.trim()
  const t = searchType.value
  if (!q) return
  
  if (t === '产品') {
    router.push({ path: '/sales/product-search', query: { q } })
  } else {
    router.push({ path: '/search', query: { type: t, q } })
  }
}

defineExpose({
  keyword,
  searchType
})
</script>

<style scoped>
</style>

