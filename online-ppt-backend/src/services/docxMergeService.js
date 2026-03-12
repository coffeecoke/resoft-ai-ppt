/**
 * Docx 合并服务
 *
 * 将多个独立的 .docx 片段合并为一个完整文档。
 * 原理：.docx 是 ZIP 包（内含 XML），用 adm-zip 操作 XML 节点做段落拼接，
 *       同时处理图片/关系/内容类型合并。
 */

import AdmZip from 'adm-zip'

class DocxMergeService {
  /**
   * 合并多个 docx 文件为一个
   *
   * @param {string[]} docxPaths - 有序的 .docx 文件绝对路径列表
   * @param {{ pageBreak?: boolean }} options - 选项
   * @returns {Buffer} 合并后的 docx Buffer
   */
  merge(docxPaths, options = {}) {
    const { pageBreak = true } = options

    if (!docxPaths.length) throw new Error('没有可合并的文件')
    if (docxPaths.length === 1) {
      // 单文件直接返回
      const zip = new AdmZip(docxPaths[0])
      return zip.toBuffer()
    }

    // ���第一个文件作为骨架
    const baseZip = new AdmZip(docxPaths[0])
    let baseDocXml = baseZip.readAsText('word/document.xml')
    let baseRels = baseZip.readAsText('word/_rels/document.xml.rels') || ''
    let baseContentTypes = baseZip.readAsText('[Content_Types].xml') || ''

    // 收集基础文件中已有的 media 文件名
    const existingMedia = new Set()
    baseZip.getEntries().forEach(e => {
      if (e.entryName.startsWith('word/media/')) {
        existingMedia.add(e.entryName)
      }
    })

    // 提取基础文档的 body 内容（<w:body>...</w:body> 之间）
    const bodyMatch = baseDocXml.match(/<w:body>([\s\S]*)<\/w:body>/)
    if (!bodyMatch) throw new Error('无法解析基础文档的 body')

    let bodyContent = bodyMatch[1]

    // 移除最后的 <w:sectPr>...</w:sectPr>（节属性，最后再加回去）
    const sectPrMatch = bodyContent.match(/<w:sectPr[\s\S]*<\/w:sectPr>\s*$/)
    const sectPr = sectPrMatch ? sectPrMatch[0] : ''
    if (sectPr) {
      bodyContent = bodyContent.slice(0, bodyContent.lastIndexOf(sectPr))
    }

    // 收集已有的最大 rId 数字
    let maxRid = 0
    const ridMatches = baseRels.matchAll(/Id="rId(\d+)"/g)
    for (const m of ridMatches) {
      maxRid = Math.max(maxRid, parseInt(m[1]))
    }

    // 收集已注册的 content types
    const registeredExtensions = new Set()
    const extMatches = baseContentTypes.matchAll(/Extension="([^"]+)"/g)
    for (const m of extMatches) {
      registeredExtensions.add(m[1].toLowerCase())
    }

    // 逐个合并后续片段
    for (let i = 1; i < docxPaths.length; i++) {
      const fragZip = new AdmZip(docxPaths[i])
      const fragDocXml = fragZip.readAsText('word/document.xml')
      const fragRels = fragZip.readAsText('word/_rels/document.xml.rels') || ''

      if (!fragDocXml) continue

      // 提取片段 body 内容
      const fragBodyMatch = fragDocXml.match(/<w:body>([\s\S]*)<\/w:body>/)
      if (!fragBodyMatch) continue
      let fragBody = fragBodyMatch[1]

      // 移除片段的 sectPr
      const fragSectPrMatch = fragBody.match(/<w:sectPr[\s\S]*<\/w:sectPr>\s*$/)
      if (fragSectPrMatch) {
        fragBody = fragBody.slice(0, fragBody.lastIndexOf(fragSectPrMatch[0]))
      }

      // 计算 rId 偏移量
      const ridOffset = maxRid + (i * 1000)

      // 收集片段的关系映射 { 原始rId → 新rId, target }
      const relEntries = []
      const relRegex = /<Relationship\s+Id="rId(\d+)"\s+Type="([^"]+)"\s+Target="([^"]+)"[^/]*\/>/g
      let relMatch
      while ((relMatch = relRegex.exec(fragRels)) !== null) {
        const origNum = parseInt(relMatch[1])
        const newRid = `rId${origNum + ridOffset}`
        relEntries.push({
          origId: `rId${origNum}`,
          newId: newRid,
          type: relMatch[2],
          target: relMatch[3],
          fullMatch: relMatch[0],
        })
      }

      // 处理图片：拷贝 media 文件到基础 zip，重命名避免冲突
      const mediaRenames = new Map() // 旧target → 新target
      for (const rel of relEntries) {
        if (rel.target.startsWith('media/')) {
          const origPath = `word/${rel.target}`
          const fragEntry = fragZip.getEntry(origPath)
          if (!fragEntry) continue

          let newMediaName = rel.target
          const newPath = `word/${newMediaName}`

          // 如果同名文件已存在，加前缀
          if (existingMedia.has(newPath)) {
            const ext = newMediaName.substring(newMediaName.lastIndexOf('.'))
            const baseName = newMediaName.substring(6, newMediaName.lastIndexOf('.')) // 去掉 media/ 前缀
            newMediaName = `media/${baseName}_f${i}${ext}`
          }

          const finalPath = `word/${newMediaName}`
          if (!existingMedia.has(finalPath)) {
            baseZip.addFile(finalPath, fragEntry.getData())
            existingMedia.add(finalPath)

            // 注册 content type
            const ext = newMediaName.substring(newMediaName.lastIndexOf('.') + 1).toLowerCase()
            if (!registeredExtensions.has(ext)) {
              const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', emf: 'image/x-emf', wmf: 'image/x-wmf' }
              const mime = mimeMap[ext]
              if (mime) {
                baseContentTypes = baseContentTypes.replace('</Types>', `<Default Extension="${ext}" ContentType="${mime}"/></Types>`)
                registeredExtensions.add(ext)
              }
            }
          }

          mediaRenames.set(rel.target, newMediaName)
        }
      }

      // 替换片段内容中的 rId 引用
      for (const rel of relEntries) {
        // 替换 r:embed="rId5" / r:link="rId5" / r:id="rId5"
        const escOrigId = rel.origId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        fragBody = fragBody.replace(
          new RegExp(`(r:embed="|r:link="|r:id=")${escOrigId}"`, 'g'),
          `$1${rel.newId}"`
        )
      }

      // 添加关系条目到基础 rels
      for (const rel of relEntries) {
        const target = mediaRenames.get(rel.target) || rel.target
        const newRelEntry = `<Relationship Id="${rel.newId}" Type="${rel.type}" Target="${target}"/>`
        baseRels = baseRels.replace('</Relationships>', `${newRelEntry}</Relationships>`)
      }

      // 更新最大 rId
      for (const rel of relEntries) {
        const num = parseInt(rel.newId.replace('rId', ''))
        maxRid = Math.max(maxRid, num)
      }

      // 插入分页符
      if (pageBreak) {
        bodyContent += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
      }

      // 追加片段内容
      bodyContent += fragBody
    }

    // 重组 document.xml
    const newDocXml = baseDocXml.replace(
      /<w:body>[\s\S]*<\/w:body>/,
      `<w:body>${bodyContent}${sectPr}</w:body>`
    )

    // 写回
    baseZip.updateFile('word/document.xml', Buffer.from(newDocXml, 'utf-8'))
    if (baseRels) {
      baseZip.updateFile('word/_rels/document.xml.rels', Buffer.from(baseRels, 'utf-8'))
    }
    baseZip.updateFile('[Content_Types].xml', Buffer.from(baseContentTypes, 'utf-8'))

    return baseZip.toBuffer()
  }
  /**
   * 带标题行的混合合并
   *
   * @param {Array<{type:'docx'|'heading', path?:string, title?:string, level?:number}>} tasks
   * @returns {Buffer}
   */
  mergeWithHeadings(tasks, options = {}) {
    const { pageBreak = true } = options

    // 找第一个 docx 作为骨架
    const firstDocxIndex = tasks.findIndex(t => t.type === 'docx')
    if (firstDocxIndex === -1) throw new Error('没有可合并的 docx 文件')

    const baseZip = new AdmZip(tasks[firstDocxIndex].path)
    let baseDocXml = baseZip.readAsText('word/document.xml')
    let baseRels = baseZip.readAsText('word/_rels/document.xml.rels') || ''
    let baseContentTypes = baseZip.readAsText('[Content_Types].xml') || ''

    const existingMedia = new Set()
    baseZip.getEntries().forEach(e => {
      if (e.entryName.startsWith('word/media/')) existingMedia.add(e.entryName)
    })

    const bodyMatch = baseDocXml.match(/<w:body>([\s\S]*)<\/w:body>/)
    if (!bodyMatch) throw new Error('无法解析基础文档的 body')

    let bodyContent = bodyMatch[1]
    const sectPrMatch = bodyContent.match(/<w:sectPr[\s\S]*<\/w:sectPr>\s*$/)
    const sectPr = sectPrMatch ? sectPrMatch[0] : ''
    if (sectPr) bodyContent = bodyContent.slice(0, bodyContent.lastIndexOf(sectPr))

    let maxRid = 0
    for (const m of baseRels.matchAll(/Id="rId(\d+)"/g)) {
      maxRid = Math.max(maxRid, parseInt(m[1]))
    }

    const registeredExtensions = new Set()
    for (const m of baseContentTypes.matchAll(/Extension="([^"]+)"/g)) {
      registeredExtensions.add(m[1].toLowerCase())
    }

    let docxCounter = 0 // 用于 rId 偏移

    for (let taskIdx = 0; taskIdx < tasks.length; taskIdx++) {
      const task = tasks[taskIdx]

      if (task.type === 'heading') {
        // 插入标题段落 XML
        const styleVal = `Heading${Math.min(task.level || 1, 6)}`
        const headingXml = `<w:p><w:pPr><w:pStyle w:val="${styleVal}"/></w:pPr><w:r><w:t>${escapeXml(task.title || '')}</w:t></w:r></w:p>`
        bodyContent += headingXml
        continue
      }

      // type === 'docx'
      if (taskIdx === firstDocxIndex) {
        docxCounter++
        continue // 骨架已经是 bodyContent 初始值
      }

      docxCounter++
      const fragZip = new AdmZip(task.path)
      const fragDocXml = fragZip.readAsText('word/document.xml')
      const fragRels = fragZip.readAsText('word/_rels/document.xml.rels') || ''
      if (!fragDocXml) continue

      const fragBodyMatch = fragDocXml.match(/<w:body>([\s\S]*)<\/w:body>/)
      if (!fragBodyMatch) continue
      let fragBody = fragBodyMatch[1]

      const fragSectPrMatch = fragBody.match(/<w:sectPr[\s\S]*<\/w:sectPr>\s*$/)
      if (fragSectPrMatch) fragBody = fragBody.slice(0, fragBody.lastIndexOf(fragSectPrMatch[0]))

      const ridOffset = maxRid + (docxCounter * 1000)
      const relEntries = []
      const relRegex = /<Relationship\s+Id="rId(\d+)"\s+Type="([^"]+)"\s+Target="([^"]+)"[^/]*\/>/g
      let relMatch
      while ((relMatch = relRegex.exec(fragRels)) !== null) {
        const origNum = parseInt(relMatch[1])
        relEntries.push({
          origId: `rId${origNum}`,
          newId: `rId${origNum + ridOffset}`,
          type: relMatch[2],
          target: relMatch[3],
        })
      }

      const mediaRenames = new Map()
      for (const rel of relEntries) {
        if (!rel.target.startsWith('media/')) continue
        const origPath = `word/${rel.target}`
        const fragEntry = fragZip.getEntry(origPath)
        if (!fragEntry) continue

        let newMediaName = rel.target
        const newPath = `word/${newMediaName}`
        if (existingMedia.has(newPath)) {
          const ext = newMediaName.substring(newMediaName.lastIndexOf('.'))
          const baseName = newMediaName.substring(6, newMediaName.lastIndexOf('.'))
          newMediaName = `media/${baseName}_f${docxCounter}${ext}`
        }
        const finalPath = `word/${newMediaName}`
        if (!existingMedia.has(finalPath)) {
          baseZip.addFile(finalPath, fragEntry.getData())
          existingMedia.add(finalPath)
          const ext = newMediaName.substring(newMediaName.lastIndexOf('.') + 1).toLowerCase()
          if (!registeredExtensions.has(ext)) {
            const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', emf: 'image/x-emf', wmf: 'image/x-wmf' }
            const mime = mimeMap[ext]
            if (mime) {
              baseContentTypes = baseContentTypes.replace('</Types>', `<Default Extension="${ext}" ContentType="${mime}"/></Types>`)
              registeredExtensions.add(ext)
            }
          }
        }
        mediaRenames.set(rel.target, newMediaName)
      }

      for (const rel of relEntries) {
        const escOrigId = rel.origId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        fragBody = fragBody.replace(
          new RegExp(`(r:embed="|r:link="|r:id=")${escOrigId}"`, 'g'),
          `$1${rel.newId}"`
        )
      }

      for (const rel of relEntries) {
        const target = mediaRenames.get(rel.target) || rel.target
        baseRels = baseRels.replace('</Relationships>', `<Relationship Id="${rel.newId}" Type="${rel.type}" Target="${target}"/></Relationships>`)
        maxRid = Math.max(maxRid, parseInt(rel.newId.replace('rId', '')))
      }

      if (pageBreak) {
        bodyContent += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
      }
      bodyContent += fragBody
    }

    const newDocXml = baseDocXml.replace(
      /<w:body>[\s\S]*<\/w:body>/,
      `<w:body>${bodyContent}${sectPr}</w:body>`
    )

    baseZip.updateFile('word/document.xml', Buffer.from(newDocXml, 'utf-8'))
    if (baseRels) baseZip.updateFile('word/_rels/document.xml.rels', Buffer.from(baseRels, 'utf-8'))
    baseZip.updateFile('[Content_Types].xml', Buffer.from(baseContentTypes, 'utf-8'))

    return baseZip.toBuffer()
  }
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default new DocxMergeService()