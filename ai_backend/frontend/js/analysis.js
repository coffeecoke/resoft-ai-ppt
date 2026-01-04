/**
 * PPT AI 内容分析管理 - Vue 3 应用
 */

const { createApp } = Vue;

const API_BASE = '';

createApp({
    data() {
        return {
            // 标签页
            tabs: [
                { id: 'prompts', name: '提示词管理', icon: '📝' },
                { id: 'test', name: '分析测试', icon: '🧪' },
                { id: 'batch', name: '批量分析', icon: '📚' },
                { id: 'results', name: '分析结果', icon: '📊' },
                { id: 'statistics', name: '统计报表', icon: '📈' },
                { id: 'categories', name: '分类标准', icon: '🏷️' }
            ],
            activeTab: 'prompts',
            
            // 提示词管理
            prompts: [],
            selectedPrompt: null,
            showPromptModal: false,
            promptForm: {
                id: '',
                name: '',
                code: '',
                type: 'ppt_analysis',
                description: '',
                prompt: '',
                isActive: true,
                sortOrder: 0
            },
            isEditMode: false,
            promptLoading: false,
            
            // 单页测试
            testData: {
                slideText: '',
                slideIndex: 0,
                slideId: 'test',
                modelName: 'gpt-4o-mini',  // 推荐使用 gpt-4o-mini（快速且性价比高）
                promptId: ''
            },
            testLoading: false,
            testResult: null,
            testError: null,
            
            // 批量分析
            documents: [],
            selectedDocumentId: '',
            selectedDocument: null,
            batchData: {
                modelName: 'gpt-4o-mini'  // 推荐使用 gpt-4o-mini（快速且性价比高）
            },
            batchLoading: false,
            batchProgress: {
                show: false,
                current: 0,
                total: 0,
                percent: 0,
                currentSlideId: ''
            },
            batchResult: null,
            
            // 分析结果
            results: [],
            
            // 统计数据
            statistics: null,
            
            // 分类标准
            categories: [],
            
            // Toast 提示
            toasts: [],
            toastId: 0
        };
    },
    
    mounted() {
        this.loadPrompts();
        this.loadCategories();
        this.loadDocuments();
    },
    
    methods: {
        // ==================== 提示词管理 ====================
        
        async loadPrompts() {
            try {
                const response = await axios.get(`${API_BASE}/api/ppt-analysis/prompts`);
                if (response.data.success) {
                    this.prompts = response.data.data;
                    // 如果有激活的提示词，自动选择第一个
                    const activePrompt = this.prompts.find(p => p.is_active);
                    if (activePrompt && !this.testData.promptId) {
                        this.testData.promptId = activePrompt.id;
                    }
                }
            } catch (error) {
                console.error('加载提示词失败:', error);
                this.showToast('加载提示词失败', 'error');
            }
        },
        
        openPromptModal(prompt = null) {
            this.isEditMode = !!prompt;
            if (prompt) {
                this.promptForm = {
                    id: prompt.id,
                    name: prompt.name,
                    code: prompt.code,
                    type: prompt.type,
                    description: prompt.description || '',
                    prompt: prompt.prompt,
                    isActive: prompt.is_active,
                    sortOrder: prompt.sort_order
                };
            } else {
                this.promptForm = {
                    id: '',
                    name: '',
                    code: '',
                    type: 'ppt_analysis',
                    description: '',
                    prompt: '',
                    isActive: true,
                    sortOrder: 0
                };
            }
            this.showPromptModal = true;
        },
        
        closePromptModal() {
            this.showPromptModal = false;
            this.selectedPrompt = null;
        },
        
        async savePrompt() {
            if (!this.promptForm.name || !this.promptForm.code || !this.promptForm.prompt) {
                this.showToast('请填写必填项', 'error');
                return;
            }
            
            this.promptLoading = true;
            
            try {
                const data = {
                    name: this.promptForm.name,
                    code: this.promptForm.code,
                    type: this.promptForm.type,
                    description: this.promptForm.description,
                    prompt: this.promptForm.prompt,
                    isActive: this.promptForm.isActive,
                    sortOrder: this.promptForm.sortOrder
                };
                
                let response;
                if (this.isEditMode) {
                    response = await axios.put(`${API_BASE}/api/ppt-analysis/prompts/${this.promptForm.id}`, data);
                } else {
                    response = await axios.post(`${API_BASE}/api/ppt-analysis/prompts`, data);
                }
                
                if (response.data.success) {
                    this.showToast(this.isEditMode ? '更新成功' : '创建成功', 'success');
                    this.closePromptModal();
                    this.loadPrompts();
                } else {
                    this.showToast(response.data.message || '保存失败', 'error');
                }
            } catch (error) {
                console.error('保存提示词失败:', error);
                this.showToast(error.response?.data?.message || '保存失败', 'error');
            } finally {
                this.promptLoading = false;
            }
        },
        
        async deletePrompt(id) {
            if (!confirm('确定要删除这个提示词吗？')) {
                return;
            }
            
            try {
                const response = await axios.delete(`${API_BASE}/api/ppt-analysis/prompts/${id}`);
                if (response.data.success) {
                    this.showToast('删除成功', 'success');
                    this.loadPrompts();
                } else {
                    this.showToast(response.data.message || '删除失败', 'error');
                }
            } catch (error) {
                console.error('删除提示词失败:', error);
                this.showToast(error.response?.data?.message || '删除失败', 'error');
            }
        },
        
        async togglePromptStatus(id) {
            try {
                const response = await axios.patch(`${API_BASE}/api/ppt-analysis/prompts/${id}/toggle`);
                if (response.data.success) {
                    this.showToast('状态更新成功', 'success');
                    this.loadPrompts();
                } else {
                    this.showToast(response.data.message || '更新失败', 'error');
                }
            } catch (error) {
                console.error('更新状态失败:', error);
                this.showToast(error.response?.data?.message || '更新失败', 'error');
            }
        },
        
        viewPrompt(prompt) {
            this.selectedPrompt = prompt;
        },
        
        // ==================== 单页分析 ====================
        
        async analyzeSingle() {
            if (!this.testData.slideText.trim()) {
                this.showToast('请输入测试文本', 'error');
                return;
            }
            
            this.testLoading = true;
            this.testResult = null;
            this.testError = null;
            
            try {
                const requestData = {
                    slideText: this.testData.slideText,
                    slideIndex: this.testData.slideIndex,
                    slideId: this.testData.slideId,
                    modelName: this.testData.modelName
                };
                
                // 如果选择了提示词，则添加 promptId
                if (this.testData.promptId) {
                    requestData.promptId = this.testData.promptId;
                }
                
                const response = await axios.post(`${API_BASE}/api/ppt-analysis/analyze-single`, requestData);
                
                if (response.data.success) {
                    this.testResult = response.data.result;
                    this.showToast('分析完成！', 'success');
                } else {
                    this.testError = response.data.message || '分析失败';
                    this.showToast(this.testError, 'error');
                }
            } catch (error) {
                console.error('分析失败:', error);
                this.testError = error.response?.data?.message || error.message || '分析失败';
                this.showToast(this.testError, 'error');
            } finally {
                this.testLoading = false;
            }
        },
        
        clearTest() {
            this.testData.slideText = '';
            this.testResult = null;
            this.testError = null;
        },
        
        // ==================== 文档管理 ====================
        
        async loadDocuments() {
            try {
                const response = await axios.get(`${API_BASE}/api/documents/list`);
                
                if (response.data.success) {
                    // API返回格式：{ success: true, data: { list, total, page, pageSize } }
                    const documents = response.data.data.list || [];
                    this.documents = documents.map(doc => ({
                        id: doc.id,
                        name: doc.name,
                        slideCount: doc.slide_count,
                        extractedCount: doc.extracted_count || 0
                    }));
                }
            } catch (error) {
                console.error('加载文档列表失败:', error);
                this.showToast('加载文档列表失败', 'error');
            }
        },
        
        onDocumentChange() {
            const doc = this.documents.find(d => d.id === this.selectedDocumentId);
            this.selectedDocument = doc || null;
            this.batchResult = null;
            this.batchProgress.show = false;
        },
        
        // ==================== 批量分析 ====================
        
        async startBatchAnalysis() {
            if (!this.selectedDocumentId) {
                this.showToast('请先选择文档', 'error');
                return;
            }
            
            this.batchLoading = true;
            this.batchResult = null;
            this.batchProgress = {
                show: true,
                current: 0,
                total: 0,
                percent: 0,
                currentSlideId: ''
            };
            
            try {
                // 构建URL，把modelName作为query参数
                const url = `${API_BASE}/api/ppt-analysis/analyze/${this.selectedDocumentId}?modelName=${this.batchData.modelName}`;
                
                // 使用EventSource接收SSE流
                const eventSource = new EventSource(url);
                
                eventSource.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'start') {
                        this.showToast('开始分析...', 'info');
                    } else if (data.type === 'progress') {
                        this.batchProgress.current = data.current;
                        this.batchProgress.total = data.total;
                        this.batchProgress.percent = data.progress;
                        this.batchProgress.currentSlideId = data.slideId;
                    } else if (data.type === 'complete') {
                        this.batchResult = data.results;
                        this.showToast('分析完成！', 'success');
                        eventSource.close();
                        this.batchLoading = false;
                    } else if (data.type === 'error') {
                        this.showToast(data.message || '分析失败', 'error');
                        eventSource.close();
                        this.batchLoading = false;
                    }
                };
                
                eventSource.onerror = (error) => {
                    console.error('SSE连接错误:', error);
                    this.showToast('分析过程中断', 'error');
                    eventSource.close();
                    this.batchLoading = false;
                };
                
            } catch (error) {
                console.error('启动分析失败:', error);
                this.showToast('启动分析失败', 'error');
                this.batchLoading = false;
            }
        },
        
        async viewResults() {
            if (!this.selectedDocumentId) {
                return;
            }
            
            this.activeTab = 'results';
            await this.loadResults();
        },
        
        async viewStatistics() {
            if (!this.selectedDocumentId) {
                return;
            }
            
            this.activeTab = 'statistics';
            await this.loadStatistics();
        },
        
        // ==================== 分析结果 ====================
        
        async loadResults() {
            if (!this.selectedDocumentId) {
                this.results = [];
                return;
            }
            
            try {
                const response = await axios.get(
                    `${API_BASE}/api/ppt-analysis/results/${this.selectedDocumentId}`
                );
                
                if (response.data.success) {
                    this.results = response.data.results;
                }
            } catch (error) {
                console.error('加载结果失败:', error);
                this.showToast('加载结果失败', 'error');
            }
        },
        
        async refreshResults() {
            await this.loadResults();
            this.showToast('已刷新', 'success');
        },
        
        // ==================== 统计报表 ====================
        
        async loadStatistics() {
            if (!this.selectedDocumentId) {
                this.statistics = null;
                return;
            }
            
            try {
                const response = await axios.get(
                    `${API_BASE}/api/ppt-analysis/statistics/${this.selectedDocumentId}`
                );
                
                if (response.data.success) {
                    this.statistics = response.data;
                }
            } catch (error) {
                console.error('加载统计失败:', error);
                this.showToast('加载统计失败', 'error');
            }
        },
        
        async refreshStatistics() {
            await this.loadStatistics();
            this.showToast('已刷新', 'success');
        },
        
        // ==================== 分类标准 ====================
        
        async loadCategories() {
            try {
                const response = await axios.get(`${API_BASE}/api/ppt-analysis/categories`);
                
                if (response.data.success) {
                    this.categories = response.data.categories;
                }
            } catch (error) {
                console.error('加载分类标准失败:', error);
                this.showToast('加载分类标准失败', 'error');
            }
        },
        
        // ==================== 工具方法 ====================
        
        formatDate(dateString) {
            if (!dateString) return '-';
            const date = new Date(dateString);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        
        showToast(message, type = 'info') {
            const id = ++this.toastId;
            const toast = { id, message, type };
            this.toasts.push(toast);
            
            setTimeout(() => {
                const index = this.toasts.findIndex(t => t.id === id);
                if (index > -1) {
                    this.toasts.splice(index, 1);
                }
            }, 3000);
        }
    }
}).mount('#app');

