// 提示词管理页面逻辑

let currentPrompt = null;
let currentScene = 'all';

// 页面初始化 - 等待DOM完全加载
(async function() {
  console.log('📝 加载提示词管理页面...');
  
  // ✅ 等待DOM元素存在
  await waitForElement('prompt-list');
  
  await loadPrompts();
})();

// 等待DOM元素加载完成
function waitForElement(id, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      const element = document.getElementById(id);
      if (element) {
        console.log(`✅ DOM元素 #${id} 已加载`);
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        console.error(`❌ 等待DOM元素 #${id} 超时`);
        reject(new Error(`元素 #${id} 加载超时`));
      } else {
        setTimeout(check, 50); // 每50ms检查一次
      }
    };
    
    check();
  });
}

// 加载提示词列表
async function loadPrompts() {
  try {
    const params = currentScene !== 'all' ? `?scene_type=${currentScene}` : '';
    const prompts = await API.get(`/api/admin/prompts${params}`);
    
    console.log('📊 加载提示词数据:', prompts);
    console.log('📊 数据类型:', typeof prompts, '是否数组:', Array.isArray(prompts));
    console.log('📊 数据长度:', prompts?.length);
    
    renderPromptList(prompts || []);
  } catch (error) {
    console.error('加载提示词列表失败:', error);
    showMessage('加载失败: ' + error.message, 'error');
    
    // 显示错误信息
    const tbody = document.getElementById('prompt-list');
    tbody.innerHTML = `<tr><td colspan="8" class="error">加载失败: ${error.message}</td></tr>`;
  }
}

// 渲染提示词列表
function renderPromptList(prompts) {
  const tbody = document.getElementById('prompt-list');
  
  if (prompts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">暂无提示词模板</td></tr>';
    return;
  }
  
  tbody.innerHTML = prompts.map(prompt => {
    const variables = prompt.variables ? Object.keys(JSON.parse(prompt.variables)).length : 0;
    const statusBadge = prompt.is_active 
      ? '<span class="badge badge-success">启用</span>'
      : '<span class="badge badge-secondary">禁用</span>';
    
    const sceneMap = {
      'transcription': '语音转文本',
      'transcription_correction': '语音转录纠错',
      'ppt_analysis': 'PPT分析',
      'document_extract': '文档提取',
      'document_manage': '文档管理',
      'general': '通用'
    };
    
    return `
      <tr>
        <td><strong>${escapeHtml(prompt.name)}</strong></td>
        <td><code>${escapeHtml(prompt.code)}</code></td>
        <td>${sceneMap[prompt.scene_type] || prompt.scene_type || '<span class="text-muted">未分类</span>'}</td>
        <td><span class="badge badge-info">v${prompt.version || '1.0'}</span></td>
        <td>${statusBadge}</td>
        <td>${variables}</td>
        <td>${formatDate(prompt.updated_at)}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick='viewPrompt(${JSON.stringify(prompt)})'>查看</button>
          <button class="btn btn-sm btn-secondary" onclick='editPrompt(${JSON.stringify(prompt)})'>编辑</button>
          <button class="btn btn-sm btn-info" onclick='duplicatePrompt("${prompt.id}")'>复制</button>
          <button class="btn btn-sm btn-danger" onclick='deletePrompt("${prompt.id}", "${escapeHtml(prompt.name)}")'>删除</button>
        </td>
      </tr>
    `;
  }).join('');
}

// 按场景筛选
function filterByScene(scene) {
  currentScene = scene;
  
  // 更新Tab样式
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scene === scene);
  });
  
  loadPrompts();
}

// 打开对话框
function openDialog(prompt = null) {
  const dialog = document.getElementById('prompt-dialog');
  const form = document.getElementById('prompt-form');
  const title = document.getElementById('dialog-title');
  
  form.reset();
  
  if (prompt) {
    // 编辑模式
    title.textContent = '编辑提示词模板';
    currentPrompt = { ...prompt };
    
    // 填充表单
    Object.keys(prompt).forEach(key => {
      const input = form.elements[key];
      if (input) {
        if (input.type === 'checkbox') {
          input.checked = prompt[key];
        } else if (key === 'variables' && prompt[key]) {
          input.value = JSON.stringify(prompt[key], null, 2);
        } else {
          input.value = prompt[key] || '';
        }
      }
    });
  } else {
    // 新增模式
    title.textContent = '添加提示词模板';
    currentPrompt = null;
    form.elements['is_active'].checked = true;
    form.elements['version'].value = '1.0';
  }
  
  dialog.showModal();
}

// 关闭对话框
function closeDialog() {
  document.getElementById('prompt-dialog').close();
  currentPrompt = null;
}

// 查看提示词
let currentViewPrompt = null;

function viewPrompt(prompt) {
  currentViewPrompt = prompt;
  
  const sceneMap = {
    'transcription': '语音转文本',
    'transcription_correction': '语音转录纠错',
    'ppt_analysis': 'PPT分析',
    'document_extract': '文档提取',
    'document_manage': '文档管理',
    'general': '通用'
  };
  
  // 填充基本信息
  document.getElementById('view-basic-info').innerHTML = `
    <p><strong>模板名称：</strong>${escapeHtml(prompt.name)}</p>
    <p><strong>模板代码：</strong><code>${escapeHtml(prompt.code)}</code></p>
    <p><strong>场景类型：</strong>${sceneMap[prompt.scene_type] || prompt.scene_type || '未分类'}</p>
    <p><strong>版本号：</strong>v${prompt.version || '1.0'}</p>
    <p><strong>状态：</strong>${prompt.is_active ? '✅ 启用' : '❌ 禁用'}</p>
    <p><strong>更新时间：</strong>${formatDate(prompt.updated_at)}</p>
  `;
  
  // 填充提示词内容
  document.getElementById('view-prompt-content').textContent = prompt.prompt || '无内容';
  
  // 填充变量定义
  const variablesSection = document.getElementById('view-variables-section');
  if (prompt.variables) {
    try {
      const vars = typeof prompt.variables === 'string' ? JSON.parse(prompt.variables) : prompt.variables;
      document.getElementById('view-variables').textContent = JSON.stringify(vars, null, 2);
      variablesSection.style.display = 'block';
    } catch (e) {
      variablesSection.style.display = 'none';
    }
  } else {
    variablesSection.style.display = 'none';
  }
  
  // 填充备注
  const remarkSection = document.getElementById('view-remark-section');
  if (prompt.description) {
    document.getElementById('view-remark').textContent = prompt.description;
    remarkSection.style.display = 'block';
  } else {
    remarkSection.style.display = 'none';
  }
  
  // 打开对话框
  document.getElementById('view-dialog').showModal();
}

// 关闭查看对话框
function closeViewDialog() {
  document.getElementById('view-dialog').close();
  currentViewPrompt = null;
}

// 从查看对话框进入编辑
function editFromView() {
  closeViewDialog();
  if (currentViewPrompt) {
    editPrompt(currentViewPrompt);
  }
}

// 编辑提示词
function editPrompt(prompt) {
  openDialog(prompt);
}

// 保存提示词
async function savePrompt(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  const data = {};
  
  formData.forEach((value, key) => {
    if (key === 'is_active') {
      data[key] = form.elements[key].checked;
    } else if (key === 'variables' && value) {
      try {
        data[key] = JSON.parse(value);
      } catch (e) {
        showMessage('变量定义格式错误，必须是有效的JSON', 'error');
        throw e;
      }
    } else {
      data[key] = value;
    }
  });
  
  // 如果是编辑，添加id
  if (currentPrompt) {
    data.id = currentPrompt.id;
  }
  
  console.log('💾 保存提示词数据:', {
    isEdit: !!data.id,
    id: data.id,
    code: data.code,
    name: data.name
  });
  
  try {
    if (data.id) {
      console.log('📝 调用PUT接口:', `/api/admin/prompts/${data.id}`);
      await API.put(`/api/admin/prompts/${data.id}`, data);
      showMessage('提示词模板已更新', 'success');
    } else {
      console.log('➕ 调用POST接口:', '/api/admin/prompts');
      await API.post('/api/admin/prompts', data);
      showMessage('提示词模板已创建', 'success');
    }
    
    closeDialog();
    await loadPrompts();
  } catch (error) {
    // 检查是否是code重复错误
    if (error.message.includes('代码') || error.message.includes('code')) {
      const codeInput = form.elements['code'];
      if (codeInput) {
        codeInput.focus();
        codeInput.style.borderColor = 'var(--error-color)';
        setTimeout(() => {
          codeInput.style.borderColor = '';
        }, 3000);
      }
      showMessage('模板代码已存在，请使用不同的代码', 'error');
    } else {
      showMessage('保存失败: ' + error.message, 'error');
    }
  }
}

// 复制提示词
async function duplicatePrompt(id) {
  try {
    await API.post(`/api/admin/prompts/${id}/duplicate`);
    showMessage('提示词模板已复制', 'success');
    await loadPrompts();
  } catch (error) {
    showMessage('复制失败: ' + error.message, 'error');
  }
}

// 删除提示词
async function deletePrompt(id, name) {
  if (!confirm(`确定要删除提示词模板"${name}"吗？`)) {
    return;
  }
  
  try {
    await API.delete(`/api/admin/prompts/${id}`);
    showMessage('提示词模板已删除', 'success');
    await loadPrompts();
  } catch (error) {
    showMessage('删除失败: ' + error.message, 'error');
  }
}

// 测试提示词渲染
function testPrompt() {
  const form = document.getElementById('prompt-form');
  const prompt = form.elements['prompt'].value;
  const variablesStr = form.elements['variables'].value;
  
  if (!prompt) {
    showMessage('请先填写提示词内容', 'warning');
    return;
  }
  
  // 打开测试对话框
  const testDialog = document.getElementById('test-dialog');
  
  // 如果有变量定义，预填充测试变量
  if (variablesStr) {
    try {
      const vars = JSON.parse(variablesStr);
      const testVars = {};
      Object.keys(vars).forEach(key => {
        testVars[key] = `测试_${key}`;
      });
      document.getElementById('test-variables').value = JSON.stringify(testVars, null, 2);
    } catch (e) {
      document.getElementById('test-variables').value = '{}';
    }
  } else {
    document.getElementById('test-variables').value = '{}';
  }
  
  document.getElementById('test-result').textContent = '等待渲染...';
  testDialog.showModal();
}

// 执行测试渲染
async function runTest() {
  const form = document.getElementById('prompt-form');
  const prompt = form.elements['prompt'].value;
  const testVariablesStr = document.getElementById('test-variables').value;
  
  try {
    const variables = JSON.parse(testVariablesStr);
    
    const response = await API.post('/api/admin/prompts/test/render', {
      template: prompt,
      variables: variables
    });
    
    document.getElementById('test-result').textContent = response.rendered;
  } catch (error) {
    document.getElementById('test-result').textContent = '渲染失败: ' + error.message;
    showMessage('测试失败: ' + error.message, 'error');
  }
}

// 关闭测试对话框
function closeTestDialog() {
  document.getElementById('test-dialog').close();
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// HTML转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

