<template>
  <div class="product-demand-analysis ref-style">
    <div class="table-card">
      <!-- 第一层：产品表格（可展开 → 厂商） -->
      <el-table
        :data="productList"
        row-key="id"
        class="product-table ref-table ref-table-level-1"
        size="default"
        :row-class-name="productRowClassName"
        @expand-change="onProductExpandChange"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="ref-expand ref-expand-level-2">
              <div class="ref-expand-level-2-title">
                <span class="ref-expand-dot"></span>
                <span class="ref-expand-label">关联厂商竞争分析</span>
              </div>
              <!-- 第二层：该产品下的竞对厂商表格（可展开 → 客户） -->
              <el-table
                :data="row.vendors"
                row-key="id"
                class="vendor-table ref-table ref-table-level-2"
                size="default"
                :row-class-name="(r) => vendorRowClassName(row.id, r)"
                @expand-change="(a, expandedRows) => onVendorExpandChange(row.id, a, expandedRows)"
              >
                <el-table-column type="expand">
                  <template #default="{ row: vendorRow }">
                    <div class="ref-expand ref-expand-level-3">
                      <div class="ref-level3-head">
                        <span class="ref-level3-title">交易明细记录</span>
                        <span class="ref-level3-count">共 {{ vendorRow.customers.length }} 条数据</span>
                      </div>
                      <div class="ref-level3-body">
                      <el-table
                        :data="vendorRow.customers"
                        class="customer-table ref-table ref-table-level-3"
                        size="default"
                        :show-header="false"
                      >
                        <el-table-column prop="customerName" width="120">
                        </el-table-column>
                        <el-table-column prop="amount" width="200" align="left">
                          <template #default="{ row: customerRow }">
                            <span class="ref-level3-amount"><span class="ref-level3-amount-label">金额:</span> <span class="ref-level3-amount-value">{{ customerRow.amount || '-' }}</span></span>
                          </template>
                        </el-table-column>
                        <el-table-column prop="time" width="120">
                          <template #default="{ row: customerRow }">
                            <span class="ref-level3-date">{{ customerRow.time }}</span>
                          </template>
                        </el-table-column>
                        <el-table-column width="120">
                          <template #default="{ row: customerRow }">
                            <span class="ref-pill ref-pill-bid" :class="bidTypeClass(customerRow.bidType)">
                              {{ customerRow.bidType }}
                            </span>
                          </template>
                        </el-table-column>
                        <el-table-column width="72" align="center">
                          <template #default="{ row: customerRow }">
                            <el-dropdown trigger="click" @command="(cmd) => cmd === 'detail' && onDetail(vendorRow, customerRow)">
                              <el-button text circle size="small" class="ref-row-more">
                                <i class="ri-more-fill"></i>
                              </el-button>
                              <template #dropdown>
                                <el-dropdown-menu>
                                  <el-dropdown-item command="detail">
                                    <i class="ri-external-link-line"></i>
                                    详情
                                  </el-dropdown-item>
                                </el-dropdown-menu>
                              </template>
                            </el-dropdown>
                          </template>
                        </el-table-column>
                      </el-table>
                      </div>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="name" min-width="140">
                  <template #header>
                    <span class="ref-header"><i class="ri-building-4-line ref-header-icon"></i>竞对厂商</span>
                  </template>
                  <template #default="{ row: r }">
                    <div>
                      <div class="ref-vendor-name-label">厂商名称</div>
                      <div class="ref-vendor-name">{{ r.name }}</div>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="amountRange" width="140" align="center">
                  <template #header>
                    <span class="ref-header"><i class="ri-money-dollar-circle-line ref-header-icon"></i>金额区间</span>
                  </template>
                  <template #default="{ row: r }">
                    <div class="ref-vendor-cell">
                      <div class="ref-vendor-name-label">金额区间</div>
                      <div class="ref-vendor-cell-value ref-vendor-amount">{{ r.amountRange }}</div>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="winCount" width="100" align="center">
                  <template #header>
                    <span class="ref-header"><i class="ri-trophy-line ref-header-icon"></i>中标次数</span>
                  </template>
                  <template #default="{ row: r }">
                    <div class="ref-vendor-cell">
                      <div class="ref-vendor-name-label">中标</div>
                      <span class="ref-vendor-win-num">{{ r.winCount }}</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="customerCount" width="100" align="center">
                  <template #header>
                    <span class="ref-header"><i class="ri-team-line ref-header-icon"></i>客户数量</span>
                  </template>
                  <template #default="{ row: r }">
                    <div class="ref-vendor-cell">
                      <div class="ref-vendor-name-label">客户</div>
                      <span class="ref-vendor-cell-value ref-vendor-customer-num">{{ r.customerCount }}</span>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="name" min-width="160">
          <template #header>
            <span class="ref-header"><i class="ri-file-list-3-line ref-header-icon"></i>产品名称</span>
          </template>
          <template #default="{ row: r }">
            <div class="ref-product-name-cell">
              <span class="ref-product-label">Product Analysis</span>
              <span class="ref-product-name">{{ r.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="purchaseCount" width="96" align="center">
          <template #header>
            <span class="ref-header"><i class="ri-shopping-cart-2-line ref-header-icon"></i>被采购次数</span>
          </template>
          <template #default="{ row: r }">
            <div class="ref-product-cell ref-product-cell-center">
              <span class="ref-product-label ref-product-label-muted">采购总量</span>
              <span class="ref-num-tag">{{ r.purchaseCount }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="lastPurchase" label="最近采购时间" width="120" align="center">
          <template #header>
            <span class="ref-header"><i class="ri-calendar-line ref-header-icon"></i>最近采购时间</span>
          </template>
          <template #default="{ row: r }">
            <div class="ref-product-cell ref-product-cell-center">
              <span class="ref-product-label ref-product-label-muted">最后更新</span>
              <span class="ref-product-date">{{ r.lastPurchase }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="amountRange" width="130" align="right">
          <template #header>
            <span class="ref-header"><i class="ri-money-dollar-circle-line ref-header-icon"></i>金额范围</span>
          </template>
          <template #default="{ row: r }">
            <div class="ref-product-cell ref-product-cell-right">
              <span class="ref-product-label ref-product-label-muted">核心金额范围</span>
              <span class="ref-product-amount">{{ r.amountRange }}</span>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface CustomerRow {
  customerName: string
  amount: string
  time: string
  bidType: string
}

interface Vendor {
  id: string
  name: string
  amountRange: string
  winCount: number
  customerCount: number
  customers: CustomerRow[]
}

interface Product {
  id: string
  name: string
  purchaseCount: number
  lastPurchase: string
  amountRange: string
  vendors: Vendor[]
}

/** 第一层表格已展开的产品 id，用于行卡片高亮与左侧强调条 */
const expandedProductIds = ref<Set<string>>(new Set())

function productRowClassName({ row }: { row: Product }) {
  return expandedProductIds.value.has(row.id) ? 'ref-row-expanded' : ''
}

function onProductExpandChange(_row: Product, expandedRows: Product[]) {
  expandedProductIds.value = new Set(expandedRows.map((r) => r.id))
}

/** 第二层已展开的厂商 key = productId-vendorId */
const expandedVendorKeys = ref<Set<string>>(new Set())

function vendorRowClassName(productId: string, vendor: Vendor) {
  return expandedVendorKeys.value.has(`${productId}-${vendor.id}`) ? 'ref-vendor-expanded' : ''
}

function onVendorExpandChange(productId: string, _row: Vendor, expandedRows: Vendor[]) {
  const next = new Set<string>()
  expandedRows.forEach((r) => next.add(`${productId}-${r.id}`))
  expandedVendorKeys.value = next
}

// 银行监管报送产品 + 监管报送科技公司 模拟数据
const productList = ref<Product[]>([
  {
    id: '1',
    name: '一表通',
    purchaseCount: 34,
    lastPurchase: '2026.01.26',
    amountRange: '50W - 8300W',
    vendors: [
      {
        id: 'v1-1',
        name: '宏远贵德科技',
        amountRange: '200W - 8300W',
        winCount: 6,
        customerCount: 3,
        customers: [
          { customerName: '国家电投集团财务有限公司', amount: '8300万', time: '2026.01.26', bidType: '公开招标' },
          { customerName: '中国邮政储蓄银行股份有限公司', amount: '-', time: '2026.01.26', bidType: '竞争性谈判' },
          { customerName: '中国银行云南省分行', amount: '280万', time: '2025.11.15', bidType: '单一来源' },
        ],
      },
      {
        id: 'v1-2',
        name: '宇信科技',
        amountRange: '150W - 500W',
        winCount: 5,
        customerCount: 2,
        customers: [
          { customerName: '中国邮政储蓄银行股份有限公司', amount: '-', time: '2026.01.26', bidType: '公开招标' },
          { customerName: '中国银行股份有限公司', amount: '343万', time: '2025.12.10', bidType: '公开招标' },
        ],
      },
      {
        id: 'v1-3',
        name: '长亮科技',
        amountRange: '200W - 400W',
        winCount: 3,
        customerCount: 2,
        customers: [
          { customerName: '徽商银行股份有限公司', amount: '287万', time: '2026.01.26', bidType: '公开招标' },
          { customerName: '湖南银行', amount: '320万', time: '2025.10.08', bidType: '竞争性谈判' },
        ],
      },
      {
        id: 'v1-4',
        name: '中电金信',
        amountRange: '100W - 400W',
        winCount: 2,
        customerCount: 2,
        customers: [
          { customerName: '湖南银行湘西分行', amount: '-', time: '2026.01.20', bidType: '竞争性谈判' },
          { customerName: '某城商行', amount: '169万', time: '2026.01.15', bidType: '单一来源' },
        ],
      },
    ],
  },
  {
    id: '2',
    name: '反洗钱',
    purchaseCount: 14,
    lastPurchase: '2026.01.20',
    amountRange: '80W - 450W',
    vendors: [
      {
        id: 'v2-1',
        name: '银丰新融',
        amountRange: '200W - 450W',
        winCount: 4,
        customerCount: 3,
        customers: [
          { customerName: '某农商行', amount: '446万', time: '2026.01.20', bidType: '公开招标' },
          { customerName: '某城商行', amount: '280万', time: '2025.09.12', bidType: '竞争性谈判' },
          { customerName: '某财务公司', amount: '210万', time: '2025.06.08', bidType: '单一来源' },
        ],
      },
      {
        id: 'v2-2',
        name: '中电金信',
        amountRange: '150W - 400W',
        winCount: 3,
        customerCount: 2,
        customers: [
          { customerName: '张家口银行股份有限公司', amount: '-', time: '2026.01.20', bidType: '竞争性谈判' },
          { customerName: '某股份制银行分行', amount: '380万', time: '2025.11.20', bidType: '公开招标' },
        ],
      },
      {
        id: 'v2-3',
        name: '恒生电子',
        amountRange: '80W - 300W',
        winCount: 2,
        customerCount: 2,
        customers: [
          { customerName: '某信托公司', amount: '300万', time: '2025.08.15', bidType: '公开招标' },
          { customerName: '某村镇银行', amount: '80万', time: '2025.05.22', bidType: '单一来源' },
        ],
      },
    ],
  },
  {
    id: '3',
    name: '1104',
    purchaseCount: 22,
    lastPurchase: '2026.01.18',
    amountRange: '100W - 600W',
    vendors: [
      {
        id: 'v3-1',
        name: '神州信息',
        amountRange: '200W - 600W',
        winCount: 5,
        customerCount: 4,
        customers: [
          { customerName: '某省农商联合社', amount: '520万', time: '2026.01.18', bidType: '公开招标' },
          { customerName: '某城商行', amount: '380万', time: '2025.12.05', bidType: '竞争性谈判' },
          { customerName: '某农信社', amount: '260万', time: '2025.10.20', bidType: '单一来源' },
          { customerName: '某政策性银行分行', amount: '-', time: '2025.08.10', bidType: '公开招标' },
        ],
      },
      {
        id: 'v3-2',
        name: '长亮科技',
        amountRange: '150W - 450W',
        winCount: 4,
        customerCount: 3,
        customers: [
          { customerName: '某股份制银行', amount: '450万', time: '2025.11.28', bidType: '公开招标' },
          { customerName: '某城商行', amount: '220万', time: '2025.09.15', bidType: '竞争性谈判' },
          { customerName: '某农商行', amount: '180万', time: '2025.07.06', bidType: '单一来源' },
        ],
      },
      {
        id: 'v3-3',
        name: '宇信科技',
        amountRange: '100W - 400W',
        winCount: 3,
        customerCount: 2,
        customers: [
          { customerName: '某大行分行', amount: '-', time: '2025.12.20', bidType: '单一来源' },
          { customerName: '某城商行', amount: '340万', time: '2025.10.12', bidType: '公开招标' },
        ],
      },
    ],
  },
  {
    id: '4',
    name: 'EAST',
    purchaseCount: 18,
    lastPurchase: '2026.01.22',
    amountRange: '120W - 500W',
    vendors: [
      {
        id: 'v4-1',
        name: '中电金信',
        amountRange: '150W - 500W',
        winCount: 5,
        customerCount: 4,
        customers: [
          { customerName: '河南农村商业银行股份有限公司', amount: '169万', time: '2026.01.22', bidType: '公开招标' },
          { customerName: '中国邮政储蓄银行股份有限公司', amount: '-', time: '2026.01.22', bidType: '单一来源' },
          { customerName: '某城商行', amount: '380万', time: '2025.11.18', bidType: '竞争性谈判' },
          { customerName: '某农商行', amount: '220万', time: '2025.08.25', bidType: '公开招标' },
        ],
      },
      {
        id: 'v4-2',
        name: '恒生电子',
        amountRange: '120W - 400W',
        winCount: 4,
        customerCount: 3,
        customers: [
          { customerName: '某股份制银行', amount: '400万', time: '2025.12.15', bidType: '公开招标' },
          { customerName: '某财务公司', amount: '260万', time: '2025.10.08', bidType: '竞争性谈判' },
          { customerName: '某信托公司', amount: '120万', time: '2025.06.20', bidType: '单一来源' },
        ],
      },
      {
        id: 'v4-3',
        name: '宏远贵德科技',
        amountRange: '200W - 450W',
        winCount: 2,
        customerCount: 2,
        customers: [
          { customerName: '某政策性银行', amount: '-', time: '2025.09.28', bidType: '单一来源' },
          { customerName: '某城商行', amount: '320万', time: '2025.07.12', bidType: '公开招标' },
        ],
      },
    ],
  },
])

function bidTypeClass(bidType: string): string {
  if (!bidType) return ''
  if (bidType.includes('公开')) return 'ref-pill-public'
  if (bidType.includes('竞争')) return 'ref-pill-compete'
  if (bidType.includes('单一')) return 'ref-pill-single'
  return ''
}

function onDetail(vendor: Vendor, row: CustomerRow) {
  // TODO: 跳转详情页或打开弹窗
  console.log('详情', vendor.name, row)
}
</script>

<style scoped>
/* 严格参照 pro-nested-table 参考地址配色与尺寸 */
.product-demand-analysis.ref-style {
  --ref-bg: #ffffff;
  --ref-bg-page: #f8fafc;
  --ref-bg-header: #f9fafb;
  --ref-border: #e2e8f0;
  --ref-border-gray: #e5e7eb;
  --ref-border-light: #f1f5f9;
  --ref-border-blue: #bfdbfe;
  --ref-border-blue-500: #3b82f6;
  --ref-text: #0f172a;
  --ref-text-slate-800: #1e293b;
  --ref-text-slate-700: #334155;
  --ref-text-secondary: #64748b;
  --ref-text-muted: #94a3b8;
  --ref-text-gray-400: #9ca3af;
  --ref-accent: #2563eb;
  --ref-blue-400: #60a5fa;
  --ref-blue-50: #eff6ff;
  --ref-blue-100: #dbeafe;
  --ref-blue-200-shadow: rgba(191, 219, 254, 0.5);
  --ref-blue-900: #1e3a8a;
  --ref-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --ref-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  --ref-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
  --ref-shadow-xl-blue: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05);
  --ref-ring: 1px solid rgba(0, 0, 0, 0.05);
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  background: var(--ref-bg-page);
  border-radius: 0;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 参照参考项目：白色大卡片 rounded-2xl + shadow-xl + ring */
.table-card {
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: auto;
  display: flex;
  flex-direction: column;
  background: var(--ref-bg);
  border-radius: 1rem;
  box-shadow: var(--ref-shadow-xl-blue);
  border: var(--ref-ring);
  overflow: hidden;
}

.table-card :deep(.el-table) {
  flex: 1;
  width: 100% !important;
  min-width: 100%;
  min-height: 100%;
  border-collapse: separate;
  border-spacing: 0 12px;
}

.table-card :deep(.el-table__inner-wrapper) {
  width: 100% !important;
}

/* 表头行取消底部间距，保持与第一行卡片贴近 */
.table-card :deep(.el-table__header-wrapper) {
  margin-bottom: -4px;
}

/* 表头：参照参考项目 uppercase 小号标签 + 图标 */
.ref-header {
  display: inline-flex;
  align-items: center;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ref-text-gray-400);
}
.ref-header-icon {
  margin-right: 6px;
  font-size: 14px;
  color: var(--ref-text-gray-400);
}
.ref-header-empty {
  width: 24px;
}

/* 第一层产品名称单元格：参照参考项目 Product Analysis 小标签 + 产品名 */
.ref-product-name-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ref-product-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--ref-accent);
  letter-spacing: 0.025em;
  text-transform: uppercase;
}
.ref-product-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--ref-text-slate-800);
  transition: color 0.2s;
}
.product-table.ref-table-level-1 :deep(.el-table__row.ref-row-expanded .ref-product-name) {
  color: var(--ref-blue-900);
}
.product-table.ref-table-level-1 :deep(.el-table__row.ref-row-expanded .ref-product-label) {
  color: var(--ref-accent);
}

.ref-product-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
}
.ref-product-cell-center {
  align-items: center;
}
.ref-product-cell-right {
  align-items: flex-end;
}
.ref-product-label-muted {
  color: var(--ref-text-muted) !important;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.ref-product-date {
  font-size: 14px;
  font-weight: 600;
  color: var(--ref-text-secondary);
}
.ref-product-amount {
  font-size: 14px;
  font-weight: 700;
  color: var(--ref-text);
}
.product-table.ref-table-level-1 :deep(.el-table__row.ref-row-expanded .ref-num-tag) {
  color: var(--ref-accent);
}

/* 数字标签：参照参考项目加粗强调 */
.ref-num-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 800;
  font-size: 12px;
  color: var(--ref-accent);
  background: var(--ref-blue-100);
}
.product-table.ref-table-level-1 .ref-num-tag {
  color: var(--ref-accent);
}

/* 招标方式 Pill：与参考项目一致 violet / orange / blue */
.ref-pill {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
}
.ref-pill-bid.ref-pill-public { background: #7c3aed; }
.ref-pill-bid.ref-pill-compete { background: #ea580c; }
.ref-pill-bid.ref-pill-single { background: #2563eb; }
.ref-pill-bid:not([class*="ref-pill-"]) { background: #64748b; }

.ref-row-more {
  color: #9ca3af;
}
.ref-row-more:hover {
  color: var(--ref-text);
}

/* ========== 第一层：产品表 ========== */
.product-table.ref-table-level-1 {
  width: 100% !important;
  border: none;
}

/* 表头、表体表格撑满容器 */
.product-table.ref-table-level-1 :deep(.el-table__header-wrapper),
.product-table.ref-table-level-1 :deep(.el-table__body-wrapper) {
  width: 100% !important;
}

.product-table.ref-table-level-1 :deep(table.el-table__header),
.product-table.ref-table-level-1 :deep(table.el-table__body) {
  width: 100% !important;
  table-layout: fixed;
}

/* 产品名称列是第 2 列（第 1 列为展开图标），最小宽度 160px，弹性占用 */
.product-table.ref-table-level-1 :deep(colgroup col:nth-child(2)) {
  min-width: 160px;
}
.product-table.ref-table-level-1 :deep(.el-table__header th:nth-child(2)),
.product-table.ref-table-level-1 :deep(.el-table__body td:nth-child(2)) {
  min-width: 160px !important;
}

.product-table.ref-table-level-1 :deep(.el-table__inner-wrapper::before),
.product-table.ref-table-level-1 :deep(.el-table) {
  background: transparent !important;
}

/* 表头：与参考一致 py-4 px-4 bg-gray-50 border-b border-gray-200 */
.product-table.ref-table-level-1 :deep(.el-table__header-wrapper th) {
  background: var(--ref-bg-header) !important;
  color: var(--ref-text-gray-400);
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border: none !important;
  border-bottom: 1px solid var(--ref-border-gray) !important;
  padding: 16px;
}

/* 第一层数据行：参考 py-5 px-6 rounded-2xl border，未展开 shadow-sm，hover border-blue-300 */
.product-table.ref-table-level-1 :deep(.el-table__body-wrapper .el-table__row td) {
  background: var(--ref-bg) !important;
  color: var(--ref-text);
  font-size: 14px;
  border: 1px solid var(--ref-border) !important;
  border-left: none !important;
  padding: 20px 24px;
  transition: background 0.15s, border-color 0.2s, box-shadow 0.2s;
}
.product-table.ref-table-level-1 :deep(.el-table__body-wrapper .el-table__row) {
  box-shadow: var(--ref-shadow-sm);
}
.product-table.ref-table-level-1 :deep(.el-table__body-wrapper .el-table__row td:first-child) {
  border-left: 1px solid var(--ref-border) !important;
  border-top-left-radius: 1rem;
  border-bottom-left-radius: 1rem;
}
.product-table.ref-table-level-1 :deep(.el-table__body-wrapper .el-table__row td:last-child) {
  border-top-right-radius: 1rem;
  border-bottom-right-radius: 1rem;
}
.product-table.ref-table-level-1 :deep(.el-table__body-wrapper .el-table__row:hover td) {
  background: var(--ref-bg) !important;
  border-color: #93c5fd !important;
  box-shadow: var(--ref-shadow-sm);
}
/* 展开时：border-blue-500 shadow-lg，左侧条 w-1.5 bg-blue-600 rounded-r-full */
.product-table.ref-table-level-1 :deep(.el-table__body-wrapper .el-table__row.ref-row-expanded td),
.product-table.ref-table-level-1 :deep(.el-table__body-wrapper .el-table__row.ref-row-expanded:hover td) {
  border-color: var(--ref-border-blue-500) !important;
  box-shadow: var(--ref-shadow-lg);
}
.product-table.ref-table-level-1 :deep(.el-table__body-wrapper .el-table__row.ref-row-expanded td:first-child) {
  position: relative;
}
.product-table.ref-table-level-1 :deep(.el-table__body-wrapper .el-table__row.ref-row-expanded td:first-child::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 16px;
  bottom: 16px;
  width: 6px;
  background: #2563eb;
  border-radius: 0 9999px 9999px 0;
}

/* 参考：w-9 h-9 rounded-xl，未展开 bg-slate-50 text-slate-400，展开 bg-blue-600 text-white shadow-md shadow-blue-200 */
.product-table.ref-table-level-1 :deep(.el-table__expand-icon) {
  color: var(--ref-text-muted);
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  border-radius: 12px;
  background: var(--ref-bg-header);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s, transform 0.2s, box-shadow 0.2s;
}
.product-table.ref-table-level-1 :deep(.el-table__expand-icon:hover) {
  color: var(--ref-accent);
  background: var(--ref-blue-50);
}
.product-table.ref-table-level-1 :deep(.el-table__expand-icon--expanded) {
  color: #fff !important;
  background: var(--ref-accent) !important;
  transform: rotate(180deg);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(191, 219, 254, 0.4);
}
.product-table.ref-table-level-1 :deep(.el-table__expand-icon .el-icon) {
  font-size: 18px;
}

/* ========== 第二层展开区：参考 bg-slate-50/50 rounded-b-2xl border-x border-b p-6 pl-16 ========== */
.ref-expand.ref-expand-level-2 {
  padding: 24px 24px 24px 64px;
  background: rgba(248, 250, 252, 0.5);
  border: none;
  border-left: none;
  border-right: 1px solid var(--ref-border);
  border-bottom: 1px solid var(--ref-border);
  border-radius: 0 0 1rem 1rem;
  margin: 0;
}

.ref-expand-level-2-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-left: 2px;
}

.ref-expand-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ref-blue-400);
  flex-shrink: 0;
}

.ref-expand-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--ref-text-muted);
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.vendor-table.ref-table-level-2 {
  width: 100%;
  border: none;
  border-radius: 0;
  overflow: visible;
  background: transparent !important;
  border-collapse: separate;
  border-spacing: 0 12px;
}

.vendor-table.ref-table-level-2 :deep(.el-table__inner-wrapper::before),
.vendor-table.ref-table-level-2 :deep(.el-table) {
  background: transparent !important;
}

.vendor-table.ref-table-level-2 :deep(.el-table__header-wrapper) {
  display: none;
}

.vendor-table.ref-table-level-2 :deep(.el-table__body-wrapper tr) {
  transition: box-shadow 0.2s, border-color 0.2s;
}
/* 参考：py-4 px-5 rounded-xl，未展开 hover:border-blue-300 hover:shadow-sm，展开 border-blue-200 shadow-sm ring-1 ring-blue-100，左侧条 w-1 bg-blue-500 */
.vendor-table.ref-table-level-2 :deep(.el-table__body-wrapper td) {
  background: var(--ref-bg) !important;
  color: var(--ref-text);
  font-size: 13px;
  border: 1px solid var(--ref-border) !important;
  border-left: none !important;
  padding: 16px 20px;
  transition: background 0.15s, border-color 0.2s, box-shadow 0.2s;
}
.vendor-table.ref-table-level-2 :deep(.el-table__body-wrapper td:first-child) {
  border-left: 1px solid var(--ref-border) !important;
  border-top-left-radius: 12px;
  border-bottom-left-radius: 12px;
}
.vendor-table.ref-table-level-2 :deep(.el-table__body-wrapper td:last-child) {
  border-top-right-radius: 12px;
  border-bottom-right-radius: 12px;
}
.vendor-table.ref-table-level-2 :deep(.el-table__body-wrapper td:nth-child(3)) {
  border-left: 1px solid var(--ref-border-light) !important;
  border-right: 1px solid var(--ref-border-light) !important;
}
.vendor-table.ref-table-level-2 :deep(.el-table__body-wrapper tr:hover td) {
  border-color: #93c5fd !important;
  box-shadow: var(--ref-shadow-sm);
}
.vendor-table.ref-table-level-2 :deep(.el-table__body-wrapper tr.ref-vendor-expanded td),
.vendor-table.ref-table-level-2 :deep(.el-table__body-wrapper tr.ref-vendor-expanded:hover td) {
  border-color: var(--ref-border-blue) !important;
  box-shadow: var(--ref-shadow-sm);
  outline: 1px solid var(--ref-blue-100);
  outline-offset: -1px;
}
.vendor-table.ref-table-level-2 :deep(.el-table__body-wrapper tr.ref-vendor-expanded td:first-child) {
  position: relative;
}
.vendor-table.ref-table-level-2 :deep(.el-table__body-wrapper tr.ref-vendor-expanded td:first-child::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: #3b82f6;
  border-top-left-radius: 12px;
  border-bottom-left-radius: 12px;
}

/* 参考：展开时 ChevronRight 旋转 90°，expanded 为 bg-blue-50 text-blue-600（非实心蓝） */
.vendor-table.ref-table-level-2 :deep(.el-table__expand-icon) {
  color: var(--ref-text-muted);
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border-radius: 6px;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s, transform 0.2s;
}
.vendor-table.ref-table-level-2 :deep(.el-table__expand-icon:hover) {
  color: var(--ref-accent);
  background: transparent;
}
.vendor-table.ref-table-level-2 :deep(.el-table__expand-icon--expanded) {
  color: var(--ref-accent) !important;
  background: var(--ref-blue-50) !important;
  transform: rotate(90deg);
}
.vendor-table.ref-table-level-2 :deep(.el-table__expand-icon .el-icon) {
  font-size: 14px;
}

.ref-vendor-name-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--ref-text-muted);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 2px;
}
.ref-vendor-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--ref-text);
}

.ref-vendor-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.ref-vendor-cell .ref-vendor-name-label {
  margin-bottom: 0;
}
.ref-vendor-cell-value {
  font-size: 12px;
  font-weight: 700;
  color: var(--ref-text);
}
.ref-vendor-amount {
  font-size: 12px;
  font-weight: 700;
  font-family: ui-monospace, monospace;
  color: var(--ref-text-slate-700);
}
.ref-vendor-win-num {
  font-size: 12px;
  font-weight: 800;
  color: var(--ref-accent);
}
.ref-vendor-customer-num {
  font-size: 12px;
  font-weight: 800;
  color: var(--ref-text-slate-800);
}

/* ========== 第三层展开区（参照参考项目 slate-50 容器 + 头部 + 行 hover） ========== */
.ref-expand.ref-expand-level-3 {
  padding: 0;
  margin-top: 12px;
  background: #f8fafc;
  border: 1px solid var(--ref-border);
  border-radius: 12px;
  overflow: hidden;
}

/* 参考：bg-slate-100/50 px-4 py-2 border-b border-slate-200，tracking-widest */
.ref-level3-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: rgba(241, 245, 249, 0.5);
  border-bottom: 1px solid var(--ref-border);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.ref-level3-title {
  color: var(--ref-text-secondary);
}
.ref-level3-count {
  color: var(--ref-text-muted);
  font-weight: 700;
}

.ref-level3-body {
  background: #f8fafc;
  overflow: hidden;
}

.customer-table.ref-table-level-3 {
  width: 100%;
  border: none;
  border-radius: 0;
  overflow: hidden;
  background: transparent !important;
}

.customer-table.ref-table-level-3 :deep(.el-table__inner-wrapper::before),
.customer-table.ref-table-level-3 :deep(.el-table) {
  background: transparent !important;
}

.customer-table.ref-table-level-3 :deep(.el-table__header-wrapper) {
  display: none;
}

/* 参考：py-3 px-4 border-b border-gray-100 last:border-0 hover:bg-blue-50/30，实体 text-xs font-bold text-slate-700，金额 text-slate-500+text-slate-900，日期 text-[11px] font-mono text-slate-400 */
.customer-table.ref-table-level-3 :deep(.el-table__body-wrapper td) {
  background: #f8fafc !important;
  color: var(--ref-text);
  font-size: 12px;
  border: none !important;
  border-bottom: 1px solid var(--ref-border-light) !important;
  padding: 12px 16px;
  transition: background 0.15s;
}

.customer-table.ref-table-level-3 :deep(.el-table__body-wrapper tr:last-child td) {
  border-bottom: none !important;
}

.customer-table.ref-table-level-3 :deep(.el-table__body-wrapper tr:hover td) {
  background: rgba(239, 246, 255, 0.3) !important;
}

.ref-level3-amount {
  font-size: 12px;
  font-weight: 500;
}
.ref-level3-amount-label {
  color: var(--ref-text-secondary);
}
.ref-level3-amount-value {
  color: var(--ref-text);
  font-weight: 600;
}
.ref-level3-date {
  font-size: 11px;
  font-family: ui-monospace, monospace;
  color: var(--ref-text-muted);
}
.customer-table.ref-table-level-3 :deep(.el-table__body-wrapper td:first-child .cell) {
  font-size: 12px;
  font-weight: 700;
  color: var(--ref-text-slate-700);
}

/* 去掉竖线，只保留行底分隔 */
.ref-table :deep(.el-table__cell) {
  border-right: none !important;
}
.ref-table :deep(.el-table__row--striped td) {
  background: var(--ref-bg) !important;
}
</style>
