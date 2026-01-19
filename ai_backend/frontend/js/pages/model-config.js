/**
 * 模型配置管理页面脚本
 */

let currentScene = 'all';
let models = [];

// 页面初始化 - 等待DOM完全加载
(async function() {
  console.log('🔧 加载模型配置页面...');
  
  // ✅ 等待DOM元素存在
  await waitForElement('model-list');
  
  await loadModels();
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

// 加载模型列表
async function loadModels() {
  try {
    const params = currentScene !== 'all' ? { scene_type: currentScene } : {};
    models = await API.get('/api/admin/models', params);
    renderModelList();
  } catch (error) {
    console.error('加载模型列表失败:', error);
    showMessage('加载失败: ' + error.message, 'error');
  }
}

// 渲染模型列表
function renderModelList() {
  const tbody = document.getElementById('model-list');
  
  if (!models || models.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">暂无模型配置</td></tr>';
    return;
  }
  
  tbody.innerHTML = models.map(model => `
    <tr>
      <td><strong>${model.name}</strong></td>
      <td>${getProviderName(model.provider)}</td>
      <td><span class="badge badge-primary">${getSceneName(model.scene_type)}</span></td>
      <td style="font-size: 12px; color: var(--text-secondary);">${model.api_url}</td>
      <td>
        ${model.is_active ? 
          '<span class="badge badge-success">启用</span>' : 
          '<span class="badge badge-danger">禁用</span>'}
        ${model.is_available ? '' : '<span class="badge badge-warning">不可用</span>'}
      </td>
      <td>
        ${model.is_default ? 
          '<span class="badge badge-primary">默认</span>' : 
          `<button class="btn btn-sm" onclick="setDefault('${model.id}', '${model.scene_type}')">设为默认</button>`}
      </td>
      <td>
        <div style="font-size: 12px;">
          <div>调用: ${(model.total_calls || 0).toLocaleString()} 次</div>
          <div style="color: var(--text-secondary);">Tokens: ${(model.total_tokens || 0).toLocaleString()}</div>
        </div>
      </td>
      <td>
        <button class="btn btn-sm" onclick="editModel('${model.id}')">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteModel('${model.id}', '${model.name}')">删除</button>
      </td>
    </tr>
  `).join('');
}

// 切换场景
function switchScene(scene) {
  currentScene = scene;
  
  // 更新Tab激活状态
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.scene === scene);
  });
  
  loadModels();
}

// 打开添加对话框
function openAddDialog() {
  document.getElementById('dialog-title').textContent = '添加模型配置';
  document.getElementById('model-form').reset();
  document.getElementById('model-id').value = '';
  
  // 如果当前在某个场景，预选该场景
  if (currentScene !== 'all') {
    document.querySelector('[name="scene_type"]').value = currentScene;
  }
  
  document.getElementById('model-dialog').showModal();
}

// 编辑模型
async function editModel(id) {
  try {
    const model = models.find(m => m.id === id);
    if (!model) {
      showMessage('模型不存在', 'error');
      return;
    }
    
    document.getElementById('dialog-title').textContent = '编辑模型配置';
    document.getElementById('model-id').value = model.id;
    document.querySelector('[name="name"]').value = model.name;
    document.querySelector('[name="code"]').value = model.code;
    document.querySelector('[name="provider"]').value = model.provider;
    document.querySelector('[name="model_name"]').value = model.model_name;
    document.querySelector('[name="api_url"]').value = model.api_url;
    document.querySelector('[name="api_key"]').value = ''; // 不回显密钥
    document.querySelector('[name="api_secret"]').value = '';
    document.querySelector('[name="scene_type"]').value = model.scene_type;
    document.querySelector('[name="max_tokens"]').value = model.max_tokens;
    document.querySelector('[name="temperature"]').value = model.temperature;
    document.querySelector('[name="remark"]').value = model.remark || '';
    
    document.getElementById('model-dialog').showModal();
  } catch (error) {
    showMessage('加载模型信息失败', 'error');
  }
}

// 保存模型
async function saveModel(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData);
  
  // 类型转换
  data.max_tokens = parseInt(data.max_tokens);
  data.temperature = parseFloat(data.temperature);
  
  // 如果是编辑且密钥为空，则不更新密钥
  if (data.id && !data.api_key) {
    delete data.api_key;
  }
  if (data.id && !data.api_secret) {
    delete data.api_secret;
  }
  
  try {
    if (data.id) {
      await API.put(`/api/admin/models/${data.id}`, data);
      showMessage('模型配置已更新', 'success');
    } else {
      await API.post('/api/admin/models', data);
      showMessage('模型配置已创建', 'success');
    }
    
    closeDialog();
    await loadModels();
  } catch (error) {
    // 检查是否是code重复错误
    if (error.message.includes('模型代码') || error.message.includes('code')) {
      const codeInput = document.querySelector('input[name="code"]');
      if (codeInput) {
        codeInput.focus();
        codeInput.style.borderColor = 'var(--error-color)';
        setTimeout(() => {
          codeInput.style.borderColor = '';
        }, 3000);
      }
      showMessage('模型代码已存在，请使用不同的代码（如：xfyun_spark_v35_custom）', 'error');
    } else {
      showMessage('保存失败: ' + error.message, 'error');
    }
  }
}

// 设置默认模型
async function setDefault(id, sceneType) {
  try {
    await API.put(`/api/admin/models/${id}/set-default`, { scene_type: sceneType });
    showMessage('已设置为默认模型', 'success');
    await loadModels();
  } catch (error) {
    showMessage('设置失败: ' + error.message, 'error');
  }
}

// 删除模型
async function deleteModel(id, name) {
  if (!confirm(`确定要删除模型"${name}"吗？`)) {
    return;
  }
  
  try {
    await API.delete(`/api/admin/models/${id}`);
    showMessage('模型配置已删除', 'success');
    await loadModels();
  } catch (error) {
    showMessage('删除失败: ' + error.message, 'error');
  }
}

// 关闭对话框
function closeDialog() {
  document.getElementById('model-dialog').close();
}

// 工具函数
function getProviderName(provider) {
  const names = {
    xfyun: '讯飞星火',
    openai: 'OpenAI',
    qwen: '通义千问',
    baidu: '文心一言',
    custom: '自定义',
  };
  return names[provider] || provider;
}

function getSceneName(scene) {
  const sceneMap = {
    'transcription': '语音转文本',
    'transcription_correction': '语音转录纠错',
    'role_judgment': '角色判断',
    'qa_extraction': '问答对提取',
    'qa_classification': '问答对分类',
    'ppt_analysis': 'PPT分析',
    'document_extract': '文档提取',
    'document_manage': '文档管理',
    'general': '通用'
  };
  return sceneMap[scene] || scene || '未分类';
}

// 暴露到全局（以便HTML中调用）
window.switchScene = switchScene;
window.openAddDialog = openAddDialog;
window.editModel = editModel;
window.saveModel = saveModel;
window.setDefault = setDefault;
window.deleteModel = deleteModel;
window.closeDialog = closeDialog;

