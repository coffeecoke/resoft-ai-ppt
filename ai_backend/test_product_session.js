/**
 * 产品和场次管理功能测试脚本
 * 运行方式：node ai_backend/test_product_session.js
 */

const BASE_URL = 'http://localhost:3000';

// 测试辅助函数
async function testAPI(name, method, url, data = null) {
  console.log(`\n📝 测试: ${name}`);
  console.log(`请求: ${method} ${url}`);
  
  const options = {
    method,
    headers: {}
  };

  if (data) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
    console.log('数据:', JSON.stringify(data, null, 2));
  }

  try {
    const response = await fetch(`${BASE_URL}${url}`, options);
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ 成功');
      console.log('返回:', JSON.stringify(result.data, null, 2));
      return result.data;
    } else {
      console.log('❌ 失败:', result.error);
      return null;
    }
  } catch (error) {
    console.log('❌ 错误:', error.message);
    return null;
  }
}

// 主测试流程
async function main() {
  console.log('='.repeat(60));
  console.log('🧪 产品和场次管理功能测试');
  console.log('='.repeat(60));

  // 1. 测试产品管理
  console.log('\n【第一部分：产品管理】');
  
  // 创建产品
  const product = await testAPI(
    '创建产品',
    'POST',
    '/api/products',
    {
      name: '一表通',
      code: 'YBT_TEST',
      description: '监管报表一表通系统',
      category: '监管',
      tags: ['监管', '报表', '自动化'],
      isActive: true
    }
  );

  if (product) {
    // 获取产品详情
    await testAPI(
      '获取产品详情',
      'GET',
      `/api/products/${product.id}`
    );

    // 更新产品
    await testAPI(
      '更新产品',
      'PUT',
      `/api/products/${product.id}`,
      {
        description: '监管报表一表通系统 - 已更新'
      }
    );
  }

  // 获取产品列表
  await testAPI(
    '获取产品列表',
    'GET',
    '/api/products?isActive=true'
  );

  // 获取产品统计
  await testAPI(
    '获取产品统计',
    'GET',
    '/api/products/statistics'
  );

  // 2. 测试场次管理
  console.log('\n【第二部分：场次管理】');

  // 创建场次
  const session = await testAPI(
    '创建场次',
    'POST',
    '/api/sessions',
    {
      title: 'XX银行产品交流会',
      customerName: 'XX银行',
      sessionDate: new Date().toISOString(),
      duration: 120,
      location: '北京',
      productId: product?.id,
      status: 'draft'
    }
  );

  if (session) {
    // 获取场次详情
    await testAPI(
      '获取场次详情',
      'GET',
      `/api/sessions/${session.id}`
    );

    // 更新场次
    await testAPI(
      '更新场次',
      'PUT',
      `/api/sessions/${session.id}`,
      {
        status: 'completed'
      }
    );
  }

  // 获取场次列表
  await testAPI(
    '获取场次列表',
    'GET',
    '/api/sessions'
  );

  // 获取场次统计
  await testAPI(
    '获取场次统计',
    'GET',
    '/api/sessions/statistics'
  );

  // 获取最近场次
  await testAPI(
    '获取最近场次',
    'GET',
    '/api/sessions/recent?limit=5'
  );

  // 3. 测试关联查询
  console.log('\n【第三部分：关联查询】');

  if (product) {
    await testAPI(
      '按产品筛选场次',
      'GET',
      `/api/sessions?productId=${product.id}`
    );
  }

  // 4. 清理测试数据（可选）
  console.log('\n【第四部分：清理测试数据】');
  
  if (session && confirm('\n是否删除测试场次？(需要手动确认)')) {
    await testAPI(
      '删除场次',
      'DELETE',
      `/api/sessions/${session.id}`
    );
  }

  if (product && confirm('\n是否删除测试产品？(需要手动确认)')) {
    await testAPI(
      '删除产品',
      'DELETE',
      `/api/products/${product.id}`
    );
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ 测试完成！');
  console.log('='.repeat(60));
  console.log('\n📖 详细文档请查看: ai_backend/PRODUCT_SESSION_FEATURE.md');
  console.log('🌐 访问转录页面: http://localhost:3000/transcription.html');
}

// 简化的confirm函数（Node.js环境下）
function confirm(message) {
  console.log(message);
  console.log('(自动跳过删除操作)');
  return false;
}

// 运行测试
main().catch(console.error);

