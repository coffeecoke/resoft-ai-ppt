/**
 * WOPI 协议控制器 - OnlyOffice 集成
 *
 * WOPI (Web Application Open Platform Interface) 是 OnlyOffice 使用的文件访问协议
 * 参考：https://sdk.onlyoffice.com/plugin/wopi/
 *
 * API 端点：
 * - GET  /wopi/files/:id           → CheckFileInfo（返回文件元信息）
 * - GET  /wopi/files/:id/contents  → 获取文件内容
 * - POST /wopi/files/:id/contents  → 保存文件内容
 */

import { Router } from 'express'
import fs from 'fs/promises'
import path from 'path'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

const router = Router()

const UPLOAD_BASE_DIR = process.env.UPLOAD_BASE_DIR || ''
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const ONLYOFFICE_URL = process.env.ONLYOFFICE_URL || 'http://localhost:8080'

/**
 * 解析文件路径（支持相对路径和绝对路径）
 */
function resolveFilePath(relativePath) {
  if (!relativePath) return relativePath
  if (path.isAbsolute(relativePath)) return relativePath
  return UPLOAD_BASE_DIR ? path.join(UPLOAD_BASE_DIR, relativePath) : relativePath
}

/**
 * 生成编辑器 Token
 * POST /api/wopi/token
 *
 * Body: { documentId: string, mode: 'view' | 'edit' }
 *
 * 返回：{ token, fileUrl, fileName, permissions }
 */
router.post('/token', async (req, res) => {
  try {
    const { documentId, mode = 'view' } = req.body
    const username = req.user?.username

    if (!documentId) {
      return res.status(400).json({ success: false, error: 'documentId is required' })
    }

    // 查询个人文档
    const doc = await prisma.personal_documents.findUnique({
      where: { id: documentId }
    })

    if (!doc) {
      return res.status(404).json({ success: false, error: '文档不存在' })
    }

    // 权限判断：只有创建者可以编辑
    const canEdit = mode === 'edit' && doc.created_by === username

    // 生成 JWT token（OnlyOffice 会携带此 token 访问 WOPI 接口）
    const token = jwt.sign(
      {
        documentId,
        userId: username,
        permissions: {
          edit: canEdit,
          download: true,
          print: true
        }
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    )

    // WOPI 文件 URL（OnlyOffice 会访问此 URL 获取文件）
    const fileUrl = `${process.env.BACKEND_URL || 'http://localhost:5001'}/wopi/files/${documentId}`

    res.json({
      success: true,
      data: {
        token,
        fileUrl,
        fileName: doc.name,
        permissions: {
          edit: canEdit,
          download: true,
          print: true
        }
      }
    })
  } catch (error) {
    console.error('[WOPI] Token 生成失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /wopi/files/:id
 * CheckFileInfo - 返回文件元信息
 *
 * OnlyOffice 在打开文件时会先调用此接口获取文件信息
 */
router.get('/files/:id', async (req, res) => {
  try {
    const { id } = req.params
    const access_token = req.query.access_token || req.headers['x-wopi-override']

    // 验证 token
    let tokenData = null
    try {
      tokenData = jwt.verify(access_token, JWT_SECRET)
    } catch (e) {
      // 如果 token 无效，尝试从 header 获取
      const authHeader = req.headers.authorization
      if (authHeader?.startsWith('Bearer ')) {
        tokenData = jwt.verify(authHeader.slice(7), JWT_SECRET)
      }
    }

    if (!tokenData) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const doc = await prisma.personal_documents.findUnique({
      where: { id }
    })

    if (!doc) {
      return res.status(404).json({ error: 'File not found' })
    }

    // 获取文件状态
    const filePath = resolveFilePath(doc.file_path)
    let fileSize = Number(doc.file_size)
    let version = 1

    try {
      const stat = await fs.stat(filePath)
      fileSize = stat.size
    } catch (e) {
      console.warn('[WOPI] 文件不存在:', filePath)
    }

    // 返回 WOPI CheckFileInfo 格式
    res.json({
      BaseFileName: doc.name + (doc.file_type || '.docx'),
      OwnerId: doc.created_by,
      UserId: tokenData.userId || 'anonymous',
      UserFriendlyName: tokenData.userId || '匿名用户',
      Version: version,
      Size: fileSize,
      UserCanWrite: tokenData.permissions?.edit === true,
      UserCanNotWriteRelative: true,
      ReadOnly: tokenData.permissions?.edit !== true,
      SupportsUpdate: true,
      SupportsLocks: false,
      DownloadUrl: `${process.env.BACKEND_URL || 'http://localhost:5001'}/wopi/files/${id}/contents?access_token=${access_token}`,
      FileUrl: `${process.env.BACKEND_URL || 'http://localhost:5001'}/wopi/files/${id}/contents?access_token=${access_token}`
    })
  } catch (error) {
    console.error('[WOPI] CheckFileInfo 失败:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /wopi/files/:id/contents
 * 获取文件内容
 *
 * OnlyOffice 通过此接口获取实际文件内容
 */
router.get('/files/:id/contents', async (req, res) => {
  try {
    const { id } = req.params
    const access_token = req.query.access_token

    // 验证 token
    let tokenData = null
    try {
      tokenData = jwt.verify(access_token, JWT_SECRET)
    } catch (e) {
      const authHeader = req.headers.authorization
      if (authHeader?.startsWith('Bearer ')) {
        tokenData = jwt.verify(authHeader.slice(7), JWT_SECRET)
      }
    }

    if (!tokenData) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const doc = await prisma.personal_documents.findUnique({
      where: { id }
    })

    if (!doc) {
      return res.status(404).json({ error: 'File not found' })
    }

    const filePath = resolveFilePath(doc.file_path)

    // 检查文件是否存在
    try {
      await fs.access(filePath)
    } catch (e) {
      return res.status(404).json({ error: 'File not found on disk' })
    }

    // 返回文件流
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.name)}.docx"`)

    const fileBuffer = await fs.readFile(filePath)
    res.send(fileBuffer)
  } catch (error) {
    console.error('[WOPI] 获取文件内容失败:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /wopi/files/:id/contents
 * 保存文件内容
 *
 * OnlyOffice callback 机制：
 * - 当文档编辑完成时，OnlyOffice 会发送 JSON 格式的回调
 * - JSON 包含 status 和下载 URL
 * - status=2 表示文档关闭需要保存
 * - status=6 表示强制保存
 */
router.post('/files/:id/contents', async (req, res) => {
  try {
    const { id } = req.params
    const access_token = req.query.access_token

    console.log(`[WOPI] 收到保存请求: id=${id}`)

    // 验证 token
    let tokenData = null
    try {
      tokenData = jwt.verify(access_token, JWT_SECRET)
    } catch (e) {
      const authHeader = req.headers.authorization
      if (authHeader?.startsWith('Bearer ')) {
        tokenData = jwt.verify(authHeader.slice(7), JWT_SECRET)
      }
    }

    if (!tokenData) {
      console.log('[WOPI] Token 无效')
      return res.status(403).json({ error: 1, message: 'Invalid token' })
    }

    const doc = await prisma.personal_documents.findUnique({
      where: { id }
    })

    if (!doc) {
      return res.status(404).json({ error: 1, message: 'File not found' })
    }

    // 检查请求类型：OnlyOffice callback 发送 JSON
    const contentType = req.headers['content-type'] || ''

    if (contentType.includes('application/json')) {
      // OnlyOffice callback 格式
      const callbackData = req.body
      console.log('[WOPI] Callback data:', JSON.stringify(callbackData))

      // status: 2 = 文档关闭保存, 6 = 强制保存
      if (callbackData.status === 2 || callbackData.status === 6) {
        // 从 OnlyOffice 提供的 URL 下载文档
        const downloadUrl = callbackData.url
        if (!downloadUrl) {
          return res.json({ error: 1, message: 'No download URL' })
        }

        console.log(`[WOPI] 从 ${downloadUrl} 下载文档...`)

        // 下载文档
        const response = await fetch(downloadUrl)
        if (!response.ok) {
          return res.json({ error: 1, message: 'Download failed' })
        }

        const fileBuffer = Buffer.from(await response.arrayBuffer())

        // 写入文件
        const filePath = resolveFilePath(doc.file_path)
        await fs.writeFile(filePath, fileBuffer)

        // 更新数据库
        await prisma.personal_documents.update({
          where: { id },
          data: {
            file_size: BigInt(fileBuffer.length),
            updated_at: new Date()
          }
        })

        console.log(`[WOPI] 文件已保存: ${doc.name}, 大小: ${fileBuffer.length} bytes`)
      }

      // 返回成功
      return res.json({ error: 0 })
    } else {
      // 直接文件上传格式
      if (!tokenData.permissions?.edit) {
        return res.status(403).json({ error: 1, message: 'No write permission' })
      }

      const filePath = resolveFilePath(doc.file_path)

      // 获取请求体中的文件内容
      const chunks = []
      for await (const chunk of req) {
        chunks.push(chunk)
      }
      const fileBuffer = Buffer.concat(chunks)

      // 写入文件
      await fs.writeFile(filePath, fileBuffer)

      // 更新数据库记录
      await prisma.personal_documents.update({
        where: { id },
        data: {
          file_size: BigInt(fileBuffer.length),
          updated_at: new Date()
        }
      })

      console.log(`[WOPI] 文件已保存(直接上传): ${doc.name}, 大小: ${fileBuffer.length} bytes`)

      return res.json({ error: 0 })
    }
  } catch (error) {
    console.error('[WOPI] 保存文件失败:', error)
    return res.json({ error: 1, message: error.message })
  }
})

/**
 * 获取 OnlyOffice 编辑器配置
 * GET /api/wopi/editor-config/:documentId
 */
router.get('/editor-config/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params
    const { mode = 'edit' } = req.query
    const username = req.user?.username

    // 生成 token
    const doc = await prisma.personal_documents.findUnique({
      where: { id: documentId }
    })

    if (!doc) {
      return res.status(404).json({ success: false, error: '文档不存在' })
    }

    const canEdit = mode === 'edit' && doc.created_by === username

    const token = jwt.sign(
      {
        documentId,
        userId: username,
        permissions: { edit: canEdit, download: true, print: true }
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    )

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5001'

    // OnlyOffice 编辑器配置
    // 文档 key 保持稳定（同一文档用同一 key），OnlyOffice 会缓存
    const config = {
      document: {
        fileType: 'docx',
        key: documentId, // 使用文档 ID 作为 key，保持稳定
        title: doc.name + '.docx',
        url: `${backendUrl}/wopi/files/${documentId}/contents?access_token=${token}`,
        permissions: {
          edit: canEdit,
          download: true,
          print: true
        }
      },
      documentType: 'word',
      editorConfig: {
        mode: canEdit ? 'edit' : 'view',
        callbackUrl: `${backendUrl}/wopi/files/${documentId}/contents?access_token=${token}`,
        lang: 'zh-CN',
        user: {
          id: username,
          name: username
        },
        customization: {
          autosave: true,
          forcesave: true,
          chat: false,
          comments: false
        }
      }
    }

    console.log(`[WOPI] 编辑器配置: documentId=${documentId}, canEdit=${canEdit}, url=${config.document.url}`)

    res.json({ success: true, data: config })
  } catch (error) {
    console.error('[WOPI] 获取编辑器配置失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router