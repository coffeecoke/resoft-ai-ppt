/**
 * 文档文本提取器 - 前端应用
 */

class ExtractorApp {
    constructor() {
        this.files = []
        this.isExtracting = false
        this.currentPreviewFile = null
        this.currentPreviewUrl = null
        this.init()
    }

    init() {
        this.bindEvents()
        this.loadHistory()
    }

    bindEvents() {
        // 文件选择
        const fileInput = document.getElementById('fileInput')
        const selectBtn = document.getElementById('selectBtn')
        const uploadArea = document.getElementById('uploadArea')

        selectBtn.addEventListener('click', () => fileInput.click())
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e))

        // 拖拽上传
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault()
            uploadArea.classList.add('drag-over')
        })

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over')
        })

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault()
            uploadArea.classList.remove('drag-over')
            this.handleFileSelect({ target: { files: e.dataTransfer.files } })
        })

        // 清空列表
        document.getElementById('clearBtn')?.addEventListener('click', () => this.clearFiles())

        // 开始提取
        document.getElementById('extractBtn')?.addEventListener('click', () => this.startExtraction())

        // 刷新历史
        document.getElementById('refreshHistoryBtn')?.addEventListener('click', () => this.loadHistory())

        // 预览模态框
        document.getElementById('closePreviewBtn')?.addEventListener('click', () => this.closePreview())
        document.getElementById('copyContentBtn')?.addEventListener('click', () => this.copyContent())
        document.getElementById('downloadPreviewBtn')?.addEventListener('click', () => this.downloadPreview())
        
        // 点击模态框外部关闭
        document.getElementById('previewModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'previewModal') {
                this.closePreview()
            }
        })
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files)
        const jsonFiles = files.filter(f => f.name.endsWith('.json'))

        if (jsonFiles.length === 0) {
            this.showToast('请选择 JSON 文件', 'warning')
            return
        }

        jsonFiles.forEach(file => {
            if (!this.files.find(f => f.name === file.name)) {
                this.files.push(file)
            }
        })

        this.renderFileList()
        this.showToast(`已添加 ${jsonFiles.length} 个文件`, 'success')
    }

    renderFileList() {
        const fileListSection = document.getElementById('fileListSection')
        const fileList = document.getElementById('fileList')
        const fileCount = document.getElementById('fileCount')

        if (this.files.length === 0) {
            fileListSection.style.display = 'none'
            return
        }

        fileListSection.style.display = 'block'
        fileCount.textContent = this.files.length

        fileList.innerHTML = this.files.map((file, index) => `
            <div class="file-item" data-index="${index}">
                <div class="file-info">
                    <div class="file-icon">JSON</div>
                    <div class="file-details">
                        <h4>${file.name}</h4>
                        <p>${this.formatFileSize(file.size)}</p>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="icon-btn" onclick="app.removeFile(${index})" title="移除">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('')
    }

    removeFile(index) {
        this.files.splice(index, 1)
        this.renderFileList()
        this.showToast('文件已移除', 'success')
    }

    clearFiles() {
        this.files = []
        this.renderFileList()
        this.showToast('列表已清空', 'success')
    }

    async startExtraction() {
        if (this.files.length === 0) {
            this.showToast('请先选择文件', 'warning')
            return
        }

        if (this.isExtracting) {
            this.showToast('正在提取中...', 'warning')
            return
        }

        this.isExtracting = true
        this.showProgress()

        const results = []
        const total = this.files.length

        for (let i = 0; i < this.files.length; i++) {
            const file = this.files[i]
            this.updateProgress((i / total) * 100, `正在提取: ${file.name}`)

            try {
                const result = await this.extractFile(file)
                results.push({ file: file.name, success: true, ...result })
                this.addProgressItem(file.name, true)
            } catch (error) {
                results.push({ file: file.name, success: false, error: error.message })
                this.addProgressItem(file.name, false, error.message)
            }
        }

        this.updateProgress(100, '提取完成！')
        this.isExtracting = false

        setTimeout(() => {
            this.showResults(results)
            this.loadHistory()
        }, 500)
    }

    async extractFile(file) {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/extract', {
            method: 'POST',
            body: formData
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || '提取失败')
        }

        return await response.json()
    }

    showProgress() {
        document.getElementById('progressSection').style.display = 'block'
        document.getElementById('progressFill').style.width = '0%'
        document.getElementById('progressText').textContent = '0%'
        document.getElementById('progressDetails').innerHTML = ''
    }

    updateProgress(percent, text) {
        const fill = document.getElementById('progressFill')
        const textEl = document.getElementById('progressText')

        fill.style.width = `${percent}%`
        textEl.textContent = `${Math.round(percent)}%`
    }

    addProgressItem(fileName, success, error = null) {
        const details = document.getElementById('progressDetails')
        const item = document.createElement('div')
        item.className = `progress-item ${success ? 'success' : 'error'}`
        item.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                ${success 
                    ? '<polyline points="20 6 9 17 4 12"></polyline>'
                    : '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'
                }
            </svg>
            <span>${fileName}: ${success ? '提取成功' : `提取失败 - ${error}`}</span>
        `
        details.appendChild(item)
    }

    showResults(results) {
        const resultSection = document.getElementById('resultSection')
        const resultList = document.getElementById('resultList')

        resultSection.style.display = 'block'

        resultList.innerHTML = results.filter(r => r.success).map(result => `
            <div class="result-item">
                <div class="result-header">
                    <div class="result-title">${result.file}</div>
                </div>
                <div class="result-stats">
                    <div class="stat-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        </svg>
                        <span>${result.recordCount} 条记录</span>
                    </div>
                    <div class="stat-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        </svg>
                        <span>${result.slideCount} 个幻灯片</span>
                    </div>
                    <div class="stat-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span>${result.timestamp}</span>
                    </div>
                </div>
                <div class="result-files">
                    <button class="file-link" onclick="app.previewFile('${result.detailFile}', '详细版 - ${result.file}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        查看详细版
                    </button>
                    <button class="file-link" onclick="app.previewFile('${result.mergedFile}', '拼接版 - ${result.file}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        查看拼接版
                    </button>
                    <a href="${result.detailFile}" class="file-link" download>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        下载详细版
                    </a>
                    <a href="${result.mergedFile}" class="file-link" download>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        下载拼接版
                    </a>
                </div>
            </div>
        `).join('')

        this.showToast('提取完成！', 'success')
    }

    // 预览文件
    async previewFile(fileUrl, title) {
        try {
            this.currentPreviewFile = title
            this.currentPreviewUrl = fileUrl
            
            const modal = document.getElementById('previewModal')
            const titleEl = document.getElementById('previewTitle')
            const contentEl = document.getElementById('previewContent')
            
            // 显示模态框
            modal.classList.add('show')
            titleEl.textContent = title
            contentEl.innerHTML = `
                <div class="loading">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                    <p>正在加载...</p>
                </div>
            `
            
            // 加载文件内容
            const response = await fetch(`/api/preview?file=${encodeURIComponent(fileUrl)}`)
            const data = await response.json()
            
            if (!data.success) {
                throw new Error(data.message || '加载失败')
            }
            
            // 解析并显示内容
            this.renderPreviewContent(data.content)
            
        } catch (error) {
            console.error('预览失败:', error)
            this.showToast('预览失败: ' + error.message, 'error')
            this.closePreview()
        }
    }

    // 渲染预览内容
    renderPreviewContent(content) {
        const contentEl = document.getElementById('previewContent')
        const lineCountEl = document.getElementById('previewLineCount')
        
        const lines = content.split('\n')
        const dataLines = lines.filter(line => line.trim() && !line.startsWith('='))
        
        lineCountEl.textContent = `共 ${dataLines.length} 行 ${dataLines.length > 1 ? `(${dataLines.length - 1} 条数据 + 1 行表头)` : ''}`
        
        // 检查是否是表格格式（制表符分隔）
        if (content.includes('\t')) {
            // 表格格式渲染
            const rows = lines.filter(line => line.trim() && !line.startsWith('='))
            if (rows.length > 0) {
                const headers = rows[0].split('\t')
                const dataRows = rows.slice(1)
                
                let tableHTML = '<table><thead><tr>'
                headers.forEach(header => {
                    tableHTML += `<th>${this.escapeHtml(header)}</th>`
                })
                tableHTML += '</tr></thead><tbody>'
                
                dataRows.forEach(row => {
                    const cells = row.split('\t')
                    tableHTML += '<tr>'
                    cells.forEach(cell => {
                        tableHTML += `<td>${this.escapeHtml(cell)}</td>`
                    })
                    tableHTML += '</tr>'
                })
                
                tableHTML += '</tbody></table>'
                contentEl.innerHTML = tableHTML
            } else {
                contentEl.textContent = content
            }
        } else {
            // 纯文本渲染
            contentEl.textContent = content
        }
    }

    // HTML 转义
    escapeHtml(text) {
        const div = document.createElement('div')
        div.textContent = text
        return div.innerHTML
    }

    // 关闭预览
    closePreview() {
        const modal = document.getElementById('previewModal')
        modal.classList.remove('show')
        this.currentPreviewFile = null
        this.currentPreviewUrl = null
    }

    // 复制内容
    async copyContent() {
        try {
            const contentEl = document.getElementById('previewContent')
            const text = contentEl.innerText || contentEl.textContent
            await navigator.clipboard.writeText(text)
            this.showToast('内容已复制到剪贴板', 'success')
        } catch (error) {
            this.showToast('复制失败', 'error')
        }
    }

    // 下载预览文件
    downloadPreview() {
        if (this.currentPreviewUrl) {
            window.location.href = this.currentPreviewUrl
        }
    }

    async loadHistory() {
        try {
            const response = await fetch('/api/history')
            const history = await response.json()

            const historyList = document.getElementById('historyList')

            if (history.length === 0) {
                historyList.innerHTML = `
                    <div class="empty-state">
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 2v20M2 12h20"></path>
                        </svg>
                        <p>暂无历史记录</p>
                    </div>
                `
                return
            }

            historyList.innerHTML = history.map(item => `
                <div class="history-item" onclick="app.openHistory('${item.date}')">
                    <div class="history-date">${item.date}</div>
                    <div class="history-title">${item.files.length} 个文件</div>
                    <div class="history-count">${item.totalRecords} 条记录</div>
                </div>
            `).join('')
        } catch (error) {
            console.error('加载历史失败:', error)
        }
    }

    openHistory(date) {
        window.open(`/output/${date}`, '_blank')
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
        return (bytes / 1024 / 1024).toFixed(2) + ' MB'
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer')
        const toast = document.createElement('div')
        toast.className = `toast ${type}`
        toast.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                ${type === 'success' 
                    ? '<polyline points="20 6 9 17 4 12"></polyline>'
                    : type === 'error'
                    ? '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'
                    : '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'
                }
            </svg>
            <span>${message}</span>
        `
        container.appendChild(toast)

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse'
            setTimeout(() => toast.remove(), 300)
        }, 3000)
    }
}

// 初始化应用
const app = new ExtractorApp()

