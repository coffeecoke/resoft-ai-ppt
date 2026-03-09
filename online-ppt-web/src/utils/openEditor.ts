import router from '@/router'

/**
 * 打开编辑器页签
 * 同一个文档/模板复用同一个浏览器页签（已打开则聚焦，未打开则新建）
 *
 * @param path     路由路径，如 /ppt/editor
 * @param query    路由 query 参数
 * @param id       文档或模板 ID（用于页签命名）
 * @param initData 可选的初始数据（新建文档时传入，存入 sessionStorage 供编辑器秒开使用）
 */
export function openEditorTab(
  path: string,
  query: Record<string, string>,
  id: string,
  initData?: object
) {
  if (initData) {
    sessionStorage.setItem(`editor_init_${id}`, JSON.stringify(initData))
  }
  // 用 router.resolve 生成正确的含 hash 的完整 href（兼容 hash 路由模式）
  const resolved = router.resolve({ path, query })
  window.open(resolved.href, `editor_${id}`)
}
