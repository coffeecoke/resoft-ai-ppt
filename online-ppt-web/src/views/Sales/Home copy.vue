<template>
  <div class="layout">
    <Header />
    
    <div class="main">
      <SearchBar />
      
      <!-- 主推产品数据看板 -->
      <section v-if="activeNav === 'recommend'" class="product-dashboard">
        <div class="dashboard-header">
          <el-segmented v-model="activeDashboardTab" :options="[
            { label: '重点关注产品', value: 'products' },
            { label: '品牌基础资料', value: 'brand' }
          ]" size="small" />
        </div>
        <div v-if="activeDashboardTab === 'products'" class="dashboard-scroll">
          <div 
            v-for="(item, index) in productStats" 
            :key="item.name" 
            class="stat-card" 
            :class="{ 'is-selected': activeProduct === item.name }" 
            @click="selectProduct(item.name)"
          >
            <span 
              class="stat-number" 
              :class="{ 'stat-number-gray': index >= 3 }"
              :style="{ backgroundColor: getProductNumberColor(index) }"
            >{{ index + 1 }}</span>
            <div class="stat-title">{{ item.name }}</div>
            <div class="stat-body">
              <div class="stat-row">
                <span class="label">交流场次</span>
                <span class="value">{{ item.sessions }}</span>
              </div>
              <div class="stat-row">
                <span class="label">PPT回传</span>
                <span class="value">{{ item.ppts }}</span>
              </div>
              <div class="stat-row">
                <span class="label">关心问题</span>
                <span class="value">{{ item.questions }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="activeDashboardTab === 'brand'" class="brand-content">
          <div class="brand-tabs tabs-row">
            <el-segmented v-model="activeBrandTab" :options="[
              { label: '公司介绍', value: 'company' },
              { label: '产品全向图', value: 'products' },
              { label: '制度解读合集', value: 'regulations' },
              { label: '台历', value: 'calendar' },
              { label: '监管合规', value: 'compliance' },
              { label: '泛监管', value: 'general' },
              { label: '协同信创', value: 'xinchuang' },
              { label: '地方金融监管', value: 'local' },
              { label: '金融票据业务', value: 'bill' }
            ]" size="small" />
          </div>
          <div class="brand-tab-content">
            <!-- 公司介绍 -->
            <div v-if="activeBrandTab === 'company'" class="ppt-grid">
              <div 
                v-for="item in brandCompanyItems" 
                :key="item.id" 
                class="ppt-card" 
                @click="openBrandItem(item)" 
                style="cursor: pointer;"
              >
                <div class="thumb">
                  <img :src="item.thumbnail" :alt="item.title" />
                  <span v-if="item.tag" class="badge" :class="item.tag === 'PDF' ? 'badge-public' : 'badge-practical'">{{ item.tag }}</span>
                  <div v-if="item.type === 'video'" class="play-icon"><el-icon><VideoPlay /></el-icon></div>
                </div>
                <div class="meta">
                  <div class="title">{{ item.title }}</div>
                  <div class="sub">{{ item.date }}</div>
                </div>
              </div>
            </div>
            <!-- 其他tab的内容 -->
            <div v-else class="ppt-grid">
              <div 
                v-for="item in getBrandTabItems(activeBrandTab)" 
                :key="item.id" 
                class="ppt-card" 
                @click="openBrandItem(item)" 
                style="cursor: pointer;"
              >
                <div class="thumb">
                  <img :src="item.thumbnail" :alt="item.title" />
                  <span v-if="item.tag" class="badge" :class="item.tag === 'PDF' ? 'badge-public' : 'badge-practical'">{{ item.tag }}</span>
                  <div v-if="item.type === 'video'" class="play-icon"><el-icon><VideoPlay /></el-icon></div>
                </div>
                <div class="meta">
                  <div class="title">{{ item.title }}</div>
                  <div class="sub">{{ item.date }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="activeNav === 'recommend' && activeDashboardTab === 'products'" class="tabs">
        <div class="tabs-row">
          <el-segmented v-model="activeTab" :options="[
            { label: '产品介绍PPT', value: 'ppt' },
            { label: '交流会议', value: 'video' },
            { label: '客户关心问题', value: 'qa' },
            { label: '招标文件', value: 'tender' },
            { label: '响应文件', value: 'response' }
          ]" />
          <div class="filters-inline">
            <el-select v-model="fAudience" placeholder="交流对象" clearable style="width: 160px; display: none;"></el-select>
            <el-select v-model="fIndustry" placeholder="行业" clearable style="width: 160px; display: none;"></el-select>
            <el-input v-model="customerName" placeholder="输入客户名称" style="width: 160px; display: none;" />
            <el-button @click="showAdvancedFilter = !showAdvancedFilter" type="primary" plain>
              <el-icon><Filter /></el-icon> 高级筛选
            </el-button>
          </div>
        </div>
        
        <!-- 高级筛选面板 -->
        <div v-if="showAdvancedFilter && activeNav === 'recommend' && activeDashboardTab === 'products'" class="advanced-filter-panel">
          <div class="advanced-filter-content">
          <!-- PPT筛选 -->
          <template v-if="activeTab === 'ppt'">
            <div class="filter-section filter-section-inline">
              <h4 class="filter-section-title">客户名称</h4>
              <div class="filter-options">
                <el-input
                  v-model="pptFilters.customerName"
                  placeholder="请输入客户名称"
                  clearable
                  style="width: 200px;"
                />
              </div>
            </div>
            <div class="filter-section filter-section-inline">
              <h4 class="filter-section-title">产品解决方案</h4>
              <div class="filter-options">
                <el-select v-model="pptFilters.productSolution" placeholder="请选择" clearable style="width: 200px;">
                  <el-option label="一表通" value="一表通" />
                  <el-option label="1104" value="1104" />
                  <el-option label="受益所有人" value="受益所有人" />
                  <el-option label="反洗钱" value="反洗钱" />
                  <el-option label="金数" value="金数" />
                </el-select>
              </div>
            </div>
            <div v-if="!activeProduct" class="filter-section filter-section-inline">
              <h4 class="filter-section-title">PPT目录</h4>
              <div class="filter-options">
                <el-checkbox-group v-model="pptFilters.productIntro">
                  <div class="filter-row">
                    <el-checkbox label="产品案例">产品案例</el-checkbox>
                    <el-checkbox label="监管发文与背景分析">监管发文与背景分析</el-checkbox>
                    <el-checkbox label="行业发展趋势">行业发展趋势</el-checkbox>
                    <el-checkbox label="监管要求">监管要求</el-checkbox>
                    <el-checkbox label="客户痛难点">客户痛难点</el-checkbox>
                    <el-checkbox label="解决方案概述">解决方案概述</el-checkbox>
                    <el-checkbox label="产品架构设计">产品架构设计</el-checkbox>
                    <el-checkbox label="产品功能详解">产品功能详解</el-checkbox>
                    <el-checkbox label="DEMO交互">DEMO交互</el-checkbox>
                    <el-checkbox label="产品优势说明">产品优势说明</el-checkbox>
                    <el-checkbox label="产品应用场景">产品应用场景</el-checkbox>
                    <el-checkbox label="软硬件资源需求">软硬件资源需求</el-checkbox>
                    <el-checkbox label="实施服务流程">实施服务流程</el-checkbox>
                    <el-checkbox label="售后服务保障">售后服务保障</el-checkbox>
                    <el-checkbox label="其他">其他</el-checkbox>
                    <el-checkbox label="合作伙伴名单">合作伙伴名单</el-checkbox>
                  </div>
                </el-checkbox-group>
              </div>
            </div>
            <div class="filter-section filter-section-inline">
              <h4 class="filter-section-title">行业</h4>
              <div class="filter-options">
                <el-checkbox-group v-model="pptFilters.industry">
                  <div class="filter-row">
                    <el-checkbox label="全国/股份制/政策性银行">全国/股份制/政策性银行</el-checkbox>
                    <el-checkbox label="城商行">城商行</el-checkbox>
                    <el-checkbox label="外资行">外资行</el-checkbox>
                    <el-checkbox label="农商">农商</el-checkbox>
                    <el-checkbox label="财务公司">财务公司</el-checkbox>
                    <el-checkbox label="信托公司">信托公司</el-checkbox>
                    <el-checkbox label="汽车/消费金融">汽车/消费金融</el-checkbox>
                    <el-checkbox label="金融租赁">金融租赁</el-checkbox>
                    <el-checkbox label="其他">其他</el-checkbox>
                  </div>
                </el-checkbox-group>
              </div>
            </div>
            <div class="filter-section filter-section-inline">
              <h4 class="filter-section-title">交流对象</h4>
              <div class="filter-options">
                <el-checkbox-group v-model="pptFilters.audience">
                  <div class="filter-row">
                    <el-checkbox label="技术">技术</el-checkbox>
                    <el-checkbox label="技术负责人">技术负责人</el-checkbox>
                    <el-checkbox label="业务">业务</el-checkbox>
                    <el-checkbox label="业务负责人">业务负责人</el-checkbox>
                  </div>
                </el-checkbox-group>
              </div>
            </div>
            <div class="filter-section filter-section-inline">
              <h4 class="filter-section-title">语言</h4>
              <div class="filter-options">
                <el-checkbox-group v-model="pptFilters.language">
                  <div class="filter-row">
                    <el-checkbox label="中文">中文</el-checkbox>
                    <el-checkbox label="英文">英文</el-checkbox>
                  </div>
                </el-checkbox-group>
              </div>
            </div>
          </template>

            <!-- 交流会议筛选 -->
            <template v-else-if="activeTab === 'video'">
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">客户名称</h4>
                <div class="filter-options">
                  <el-input
                    v-model="videoFilters.customerName"
                    placeholder="请输入客户名称"
                    clearable
                    style="width: 200px;"
                  />
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">客户属性</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="videoFilters.customerType">
                    <div class="filter-row">
                      <el-checkbox label="全国/股份制/政策性银行">全国/股份制/政策性银行</el-checkbox>
                      <el-checkbox label="城商行">城商行</el-checkbox>
                      <el-checkbox label="外资行">外资行</el-checkbox>
                      <el-checkbox label="农商">农商</el-checkbox>
                      <el-checkbox label="财务公司">财务公司</el-checkbox>
                      <el-checkbox label="信托公司">信托公司</el-checkbox>
                      <el-checkbox label="汽车/消费金融">汽车/消费金融</el-checkbox>
                      <el-checkbox label="金融租赁">金融租赁</el-checkbox>
                      <el-checkbox label="其他">其他</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">会议类型</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="videoFilters.meetingType">
                    <div class="filter-row">
                      <el-checkbox label="首次交流">首次交流</el-checkbox>
                      <el-checkbox label="需求调研">需求调研</el-checkbox>
                      <el-checkbox label="方案讲解">方案讲解</el-checkbox>
                      <el-checkbox label="技术答疑">技术答疑</el-checkbox>
                      <el-checkbox label="投标澄清">投标澄清</el-checkbox>
                      <el-checkbox label="高层汇报">高层汇报</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">参会人员</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="videoFilters.participants">
                    <div class="filter-row">
                      <el-checkbox label="技术">技术</el-checkbox>
                      <el-checkbox label="技术负责人">技术负责人</el-checkbox>
                      <el-checkbox label="业务">业务</el-checkbox>
                      <el-checkbox label="业务负责人">业务负责人</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">我方参与人员</h4>
                <div class="filter-options">
                  <el-select
                    v-model="videoFilters.ourParticipants"
                    multiple
                    filterable
                    placeholder="请选择我方参与人员"
                    style="width: 100%;"
                  >
                    <el-option-group
                      v-for="dept in companyStructure"
                      :key="dept.department"
                      :label="dept.department"
                    >
                      <el-option
                        v-for="member in dept.members"
                        :key="member.id"
                        :label="`${member.name}（${member.role}）`"
                        :value="member.id"
                      />
                    </el-option-group>
                  </el-select>
                </div>
              </div>
            </template>

            <!-- 客户关心问题筛选 -->
            <template v-else-if="activeTab === 'qa'">
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">客户名称</h4>
                <div class="filter-options">
                  <el-input
                    v-model="qaFilters.customerName"
                    placeholder="请输入客户名称"
                    clearable
                    style="width: 200px;"
                  />
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">客户行业</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="qaFilters.customerIndustry">
                    <div class="filter-row">
                      <el-checkbox label="全国/股份制/政策性银行">全国/股份制/政策性银行</el-checkbox>
                      <el-checkbox label="城商行">城商行</el-checkbox>
                      <el-checkbox label="外资行">外资行</el-checkbox>
                      <el-checkbox label="农商">农商</el-checkbox>
                      <el-checkbox label="财务公司">财务公司</el-checkbox>
                      <el-checkbox label="信托公司">信托公司</el-checkbox>
                      <el-checkbox label="汽车/消费金融">汽车/消费金融</el-checkbox>
                      <el-checkbox label="金融租赁">金融租赁</el-checkbox>
                      <el-checkbox label="其他">其他</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">提问人</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="qaFilters.questioner">
                    <div class="filter-row">
                      <el-checkbox label="决策层">决策层</el-checkbox>
                      <el-checkbox label="管理层">管理层</el-checkbox>
                      <el-checkbox label="技术层">技术层</el-checkbox>
                      <el-checkbox label="使用层">使用层</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">交流阶段</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="qaFilters.exchangeStage">
                    <div class="filter-row">
                      <el-checkbox label="初步接触">初步接触</el-checkbox>
                      <el-checkbox label="需求调研">需求调研</el-checkbox>
                      <el-checkbox label="方案讲解">方案讲解</el-checkbox>
                      <el-checkbox label="技术答疑">技术答疑</el-checkbox>
                      <el-checkbox label="投标澄清">投标澄清</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">用户需求</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="qaFilters.userNeeds">
                    <div class="filter-row">
                      <el-checkbox label="产品功能咨询">产品功能咨询</el-checkbox>
                      <el-checkbox label="价格与优惠">价格与优惠</el-checkbox>
                      <el-checkbox label="交付周期">交付周期</el-checkbox>
                      <el-checkbox label="售后保障">售后保障</el-checkbox>
                      <el-checkbox label="技术适配性">技术适配性</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">问题类型</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="qaFilters.questionType">
                    <div class="filter-row">
                      <el-checkbox label="信息收集">信息收集</el-checkbox>
                      <el-checkbox label="对比评估">对比评估</el-checkbox>
                      <el-checkbox label="风险担忧">风险担忧</el-checkbox>
                      <el-checkbox label="价值探寻">价值探寻</el-checkbox>
                      <el-checkbox label="细节深挖">细节深挖</el-checkbox>
                      <el-checkbox label="潜在痛点">潜在痛点</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
            </template>

            <!-- 招标文件筛选 -->
            <template v-else-if="activeTab === 'tender'">
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">客户名称</h4>
                <div class="filter-options">
                  <el-input
                    v-model="tenderFilters.customerName"
                    placeholder="请输入客户名称"
                    clearable
                    style="width: 200px;"
                  />
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">采购方式</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="tenderFilters.procurementMethod">
                    <div class="filter-row">
                      <el-checkbox label="公开招标">公开招标</el-checkbox>
                      <el-checkbox label="邀请招标">邀请招标</el-checkbox>
                      <el-checkbox label="竞争性谈判">竞争性谈判</el-checkbox>
                      <el-checkbox label="询价">询价</el-checkbox>
                      <el-checkbox label="单一来源">单一来源</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">项目需求概览</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="tenderFilters.projectOverview">
                    <div class="filter-row">
                      <el-checkbox label="项目背景">项目背景</el-checkbox>
                      <el-checkbox label="建设目标">建设目标</el-checkbox>
                      <el-checkbox label="项目范围">项目范围</el-checkbox>
                      <el-checkbox label="叫服务清单">叫服务清单</el-checkbox>
                      <el-checkbox label="项目周期要求">项目周期要求</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">技术要求</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="tenderFilters.technicalRequirements">
                    <div class="filter-row">
                      <el-checkbox label="性能要求">性能要求</el-checkbox>
                      <el-checkbox label="非功能性要求">非功能性要求</el-checkbox>
                      <el-checkbox label="关键技术要求">关键技术要求</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">资格与评审规则</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="tenderFilters.qualificationReview">
                    <div class="filter-row">
                      <el-checkbox label="硬性门槛">硬性门槛</el-checkbox>
                      <el-checkbox label="评分标准">评分标准</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">合同与商务</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="tenderFilters.contractBusiness">
                    <div class="filter-row">
                      <el-checkbox label="付款方式">付款方式</el-checkbox>
                      <el-checkbox label="验收标准">验收标准</el-checkbox>
                      <el-checkbox label="知识产权归属">知识产权归属</el-checkbox>
                      <el-checkbox label="违约责任">违约责任</el-checkbox>
                      <el-checkbox label="保修与运维">保修与运维</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
            </template>

            <!-- 响应文件筛选 -->
            <template v-else-if="activeTab === 'response'">
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">客户名称</h4>
                <div class="filter-options">
                  <el-input
                    v-model="responseFilters.customerName"
                    placeholder="请输入客户名称"
                    clearable
                    style="width: 200px;"
                  />
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">报价</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="responseFilters.quotation">
                    <div class="filter-row">
                      <el-checkbox label="10万以下">10万以下</el-checkbox>
                      <el-checkbox label="10万-20万">10万-20万</el-checkbox>
                      <el-checkbox label="20万-50万">20万-50万</el-checkbox>
                      <el-checkbox label="50-100万">50-100万</el-checkbox>
                      <el-checkbox label="100万-200万">100万-200万</el-checkbox>
                      <el-checkbox label="200万-500万">200万-500万</el-checkbox>
                      <el-checkbox label="500万以上">500万以上</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">投标状态</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="responseFilters.bidStatus">
                    <div class="filter-row">
                      <el-checkbox label="已提交">已提交</el-checkbox>
                      <el-checkbox label="中标">中标</el-checkbox>
                      <el-checkbox label="未中标">未中标</el-checkbox>
                      <el-checkbox label="弃标">弃标</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">商务资质</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="responseFilters.businessQualification">
                    <div class="filter-row">
                      <el-checkbox label="公司简介">公司简介</el-checkbox>
                      <el-checkbox label="发展历程">发展历程</el-checkbox>
                      <el-checkbox label="组织架构">组织架构</el-checkbox>
                      <el-checkbox label="资质证明">资质证明</el-checkbox>
                      <el-checkbox label="财务状况">财务状况</el-checkbox>
                      <el-checkbox label="核心团队简历">核心团队简历</el-checkbox>
                      <el-checkbox label="商务偏离表">商务偏离表</el-checkbox>
                      <el-checkbox label="报价单">报价单</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">技术方案</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="responseFilters.technicalSolution">
                    <div class="filter-row">
                      <el-checkbox label="总体架构">总体架构</el-checkbox>
                      <el-checkbox label="功能模块设计">功能模块设计</el-checkbox>
                      <el-checkbox label="关键技术选型说明">关键技术选型说明</el-checkbox>
                      <el-checkbox label="数据架构设计">数据架构设计</el-checkbox>
                      <el-checkbox label="安全设计方案">安全设计方案</el-checkbox>
                      <el-checkbox label="性能与高可用设计">性能与高可用设计</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">实施与保障</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="responseFilters.implementationGuarantee">
                    <div class="filter-row">
                      <el-checkbox label="项目实施计划">项目实施计划</el-checkbox>
                      <el-checkbox label="项目组织架构">项目组织架构</el-checkbox>
                      <el-checkbox label="培训计划">培训计划</el-checkbox>
                      <el-checkbox label="售后服务方案">售后服务方案</el-checkbox>
                      <el-checkbox label="质量保障体系">质量保障体系</el-checkbox>
                      <el-checkbox label="风险管理与应对">风险管理与应对</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
              <div class="filter-section filter-section-inline">
                <h4 class="filter-section-title">案例与证明</h4>
                <div class="filter-options">
                  <el-checkbox-group v-model="responseFilters.casesProof">
                    <div class="filter-row">
                      <el-checkbox label="成功案例">成功案例</el-checkbox>
                      <el-checkbox label="知识产权说明">知识产权说明</el-checkbox>
                    </div>
                  </el-checkbox-group>
                </div>
              </div>
            </template>

            <!-- 其他tab的筛选内容可以在这里添加 -->
            <template v-else>
              <div class="filter-section">
                <p>该tab的筛选选项待完善</p>
              </div>
            </template>
          </div>
        </div>
      </section>

      <!-- 选中产品时显示目录选择、公共版、实战版 -->
      <div v-if="activeNav === 'recommend' && activeDashboardTab === 'products' && activeTab === 'ppt' && activeProduct" class="columns">
        <div class="product-ppt-section">
          <div class="product-catalog card-block">
            <div class="section-head">
              <h3>{{ activeProduct || '产品介绍PPT' }}</h3>
            </div>
            <div class="catalog-mode-switch">
              <div class="mode-switch-container">
                <div 
                  class="mode-item" 
                  :class="{ active: catalogMode === 'single' }"
                  @click="catalogMode = 'single'"
                >
                  <svg class="mode-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 3L10.07 10.07L7.5 12.5L3 3Z" fill="currentColor"/>
                    <path d="M10.07 10.07L12.5 7.5L21 16L16 21L7.5 12.5L10.07 10.07Z" fill="currentColor"/>
                  </svg>
                  <span class="mode-text">单选模式</span>
                </div>
                <div 
                  class="mode-item" 
                  :class="{ active: catalogMode === 'multiple' }"
                  @click="catalogMode = 'multiple'"
                >
                  <svg class="mode-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
                    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
                    <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
                    <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
                    <line x1="10" y1="6.5" x2="14" y2="6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <line x1="6.5" y1="10" x2="6.5" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <line x1="17.5" y1="10" x2="17.5" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <line x1="10" y1="17.5" x2="14" y2="17.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <span class="mode-text">多选模式</span>
                </div>
              </div>
            </div>
            <ul class="catalog-list">
              <li v-for="item in productCatalog" :key="item.id">
                <div class="cat-title">
                  <el-checkbox 
                    v-if="catalogMode === 'multiple'" 
                    :model-value="isParentSelected(item.id)"
                    @change="toggleParentCatalog(item.id)"
                    @click.stop
                  />
                  <span>{{ item.text }}</span>
                </div>
                <ul class="catalog-sub">
                  <li 
                    v-for="c in item.children" 
                    :key="c.id" 
                    :class="{active: isCatalogSelected(c.id)}"
                    @click="selectCatalog(c.id)"
                  >
                    <el-checkbox 
                      v-if="catalogMode === 'multiple'" 
                      :model-value="activeCatalogIds.includes(c.id)"
                      @change="toggleCatalog(c.id)"
                      @click.stop
                    >
                      <template #default>
                        <span>{{ c.text }}</span>
                      </template>
                    </el-checkbox>
                    <el-radio 
                      v-else
                      :model-value="activeCatalogIds[0]"
                      :label="c.id"
                      @change="selectCatalog(c.id)"
                      @click.stop
                    >
                      <template #default>
                        <span>{{ c.text }}</span>
                      </template>
                    </el-radio>
                  </li>
                </ul>
              </li>
            </ul>
          </div>

          <div class="public-block card-block">
            <div class="section-head"><h3>公共版</h3></div>
            <div class="ppt-groups" :class="{'ppt-summary-grid': activeCatalogIds.length === 0}">
              <!-- 概览模式：显示PPT封面卡片 -->
              <template v-if="activeCatalogIds.length === 0">
                <div v-for="p in publicPPTData" :key="p.id" class="ppt-card" @click="openPpt(p)" style="cursor:pointer;" v-show="p.type === 'ppt-cover'">
                  <div class="thumb"><img :src="p.thumbnail" :alt="p.title" /></div>
                  <div class="meta">
                    <div class="title">{{ p.title }}</div>
                    <div class="sub">{{ p.date }} · {{ p.author }}</div>
                  </div>
                </div>
              </template>
              <!-- 选择单个二级目录：显示带标题的幻灯片组 -->
              <template v-else-if="activeCatalogIds.length === 1">
                <div v-for="p in publicPPTData" :key="p.id" v-show="p.type === 'slides'" class="ppt-group-item">
                  <div class="ppt-group-header">
                    <div class="ppt-group-title" @click="openPpt(p)" style="cursor:pointer">
                      <el-icon><Document /></el-icon> {{ p.title }}
                    </div>
                    <div class="ppt-group-meta">{{ p.date }} · {{ p.author }}</div>
                  </div>
                  <div class="ppt-slides-scroll">
                    <div v-for="slide in p.slides" :key="slide.id" class="slide-card" @click="openPpt(p)">
                      <img :src="slide.img" loading="lazy" />
                      <div class="slide-page-num">P{{ slide.page }}</div>
                    </div>
                  </div>
                </div>
              </template>
              <!-- 选择多个二级目录：合并所有图片，按顺序一行一行排列 -->
              <template v-else>
                <div class="ppt-slides-scroll">
                  <div 
                    v-for="(slide, index) in mergedSlides" 
                    :key="slide.id || index" 
                    class="slide-card" 
                    @click="openPpt(slide.parent)"
                  >
                    <img :src="slide.img" loading="lazy" />
                    <div class="slide-page-num">P{{ slide.page }}</div>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <div class="practical-block card-block">
            <div class="section-head"><h3>实战版</h3></div>
            <div class="ppt-groups">
              <div v-if="activeCatalogIds.length === 0" class="customer-group">
                <div v-for="p in practicalPPTData" :key="p.id" v-show="p.type === 'file'" class="ppt-item">
                  <i class="ri-file-ppt-2-fill" style="color: #FD6330; font-size: 18px;"></i>
                  <span class="title" style="cursor:pointer;" @click="openPractical(p)">{{ p.title }}</span>
                  <div class="meta-right">
                    <span class="author">{{ p.author }}</span>
                    <span class="date">{{ p.date }}</span>
                  </div>
                </div>
              </div>
              <template v-else>
                <div v-for="group in practicalPPTData" :key="group.customer" class="customer-group">
                  <!-- 保留机构信息标题行 -->
                  <div class="customer-title">
                    <span>{{ group.customer }}</span>
                    <span class="customer-meta">{{ group.meta }}</span>
                  </div>
                  <!-- 选择单个二级目录：显示带标题的幻灯片组 -->
                  <template v-if="activeCatalogIds.length === 1">
                    <div v-for="p in group.items" :key="p.id" v-show="p.type === 'slides'" class="ppt-group-item">
                      <div class="ppt-group-header">
                        <div class="ppt-group-title" @click="openPractical(p)" style="cursor:pointer">
                          <el-icon><Document /></el-icon> {{ p.title }}
                        </div>
                        <div class="ppt-group-meta">{{ p.date }} · {{ p.author }}</div>
                      </div>
                      <div class="ppt-slides-scroll">
                        <div v-for="slide in p.slides" :key="slide.id" class="slide-card" @click="openPractical(p)">
                          <img :src="slide.img" loading="lazy" />
                          <div class="slide-page-num">P{{ slide.page }}</div>
                        </div>
                      </div>
                    </div>
                  </template>
                  <!-- 选择多个二级目录：合并所有图片，按顺序一行一行排列 -->
                  <template v-else>
                    <div class="ppt-slides-scroll">
                      <div 
                        v-for="(slide, index) in getMergedSlidesForGroup(group)" 
                        :key="slide.id || index" 
                        class="slide-card" 
                        @click="openPractical(slide.parent)"
                      >
                        <img :src="slide.img" loading="lazy" />
                        <div class="slide-page-num">P{{ slide.page }}</div>
                      </div>
                    </div>
                  </template>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- 未选中产品时显示原来的卡片网格 -->
      <section v-if="activeNav === 'recommend' && activeDashboardTab === 'products' && activeTab === 'ppt' && !activeProduct" class="ppt-grid">
        <div 
          v-for="item in filteredPPT" 
          :key="item.id" 
          class="ppt-card" 
          @click="openPpt(item)" 
          style="cursor: pointer;"
        >
          <div class="thumb">
            <img :src="item.thumbnail" :alt="item.title" />
            <span class="badge" :class="item.tag === '公共版' ? 'badge-public' : 'badge-practical'">{{ item.tag }}</span>
          </div>
          <div class="meta">
            <div class="title">{{ item.title }}</div>
            <div class="sub">{{ item.date }}</div>
          </div>
        </div>
      </section>

      <section v-if="activeNav === 'recommend' && activeDashboardTab === 'products' && activeTab === 'video'" class="ppt-grid">
        <div 
          v-for="item in filteredVideos" 
          :key="item.id" 
          class="ppt-card" 
          @click="openVideo(item)" 
          style="cursor: pointer;"
        >
          <div class="thumb is-video">
            <img :src="item.thumbnail" :alt="item.title" />
            <span class="badge" :class="item.tag === '公共版' ? 'badge-public' : 'badge-practical'">{{ item.tag }}</span>
            <div class="play-icon"><el-icon><VideoPlay /></el-icon></div>
            <span class="video-duration">{{ item.duration || '38:54' }}</span>
          </div>
          <div class="meta">
            <div class="title">{{ item.title }}</div>
            <div class="sub">{{ item.date }}</div>
          </div>
        </div>
      </section>

      <section v-if="activeNav === 'recommend' && activeDashboardTab === 'products' && activeTab === 'tender'" class="ppt-grid">
        <div 
          v-for="item in tenderFiles" 
          :key="item.id" 
          class="ppt-card" 
          @click="openPpt(item)" 
          style="cursor: pointer;"
        >
          <div class="thumb">
            <img :src="item.thumbnail" :alt="item.title" />
            <span class="badge badge-tender">招标文件</span>
          </div>
          <div class="meta">
            <div class="title">{{ item.title }}</div>
            <div class="sub">{{ item.date }}</div>
          </div>
        </div>
      </section>

      <section v-if="activeNav === 'recommend' && activeDashboardTab === 'products' && activeTab === 'response'" class="ppt-grid">
        <div 
          v-for="item in responseFiles" 
          :key="item.id" 
          class="ppt-card" 
          @click="openPpt(item)" 
          style="cursor: pointer;"
        >
          <div class="thumb">
            <img :src="item.thumbnail" :alt="item.title" />
            <span class="badge badge-response">响应文件</span>
          </div>
          <div class="meta">
            <div class="title">{{ item.title }}</div>
            <div class="sub">{{ item.date }}</div>
          </div>
        </div>
      </section>

      <section v-if="activeNav === 'recommend' && activeDashboardTab === 'products' && activeTab === 'qa'" class="qa-section">
        <div class="qa-layout">
          <div class="qa-left card-block">
            <div class="section-head">
              <h3>帮助最多的问题</h3>
            </div>
            <ul class="qa-list-rich qa-list-left">
              <li v-for="q in leftQuestions" :key="q.id" :data-qa-id="q.id" :class="{active: expandedLeftQaId === q.id}">
                <div class="qa-title-row" @click="toggleLeftQa(q.id)">
                  <div class="qa-title">
                    <span class="qa-category-tag" :style="{ backgroundColor: q.categoryColor }">{{ q.category }}</span>
                    {{ q.title }}
                  </div>
                  <div class="qa-expand-icon">
                    <i class="ri-arrow-down-s-line" v-if="expandedLeftQaId !== q.id"></i>
                    <i class="ri-arrow-up-s-line" v-else></i>
                  </div>
                </div>
                <div class="qa-answer" v-if="expandedLeftQaId === q.id">答：{{ q.answer }}</div>
                <div class="qa-meta" v-if="expandedLeftQaId === q.id">
                  <div class="qa-meta-top">
                    <span class="qa-meta-time">{{ q.date }}</span>
                    <span class="qa-meta-words">{{ getAnswerWordCount(q.answer) }}次阅读</span>
                  </div>
                  <div class="qa-meta-feedback">
                    <span class="qa-feedback-text">这个对你有帮助吗？</span>
                    <div class="qa-feedback-buttons">
                      <button class="qa-feedback-btn qa-like-btn" @click.stop="handleLike(q.id)" :class="{ active: q.userLiked }">
                        <i class="ri-thumb-up-line"></i>
                        <span>{{ q.likes }}</span>
                      </button>
                      <button class="qa-feedback-btn qa-dislike-btn" @click.stop="handleDislike(q.id)" :class="{ active: q.userDisliked }">
                        <i class="ri-thumb-down-line"></i>
                        <span>{{ q.dislikes }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </div>
          <div class="qa-right-list card-block">
            <div class="section-head">
              <h3>阅读量最高的问题</h3>
            </div>
            <ul class="qa-list-rich qa-list-right">
              <li v-for="q in rightQuestions" :key="q.id" :data-qa-id="q.id" :class="{active: expandedRightListQaId === q.id}">
                <div class="qa-title-row" @click="toggleRightListQa(q.id)">
                  <div class="qa-title">
                    <span class="qa-category-tag" :style="{ backgroundColor: q.categoryColor }">{{ q.category }}</span>
                    {{ q.title }}
                  </div>
                  <div class="qa-expand-icon">
                    <i class="ri-arrow-down-s-line" v-if="expandedRightListQaId !== q.id"></i>
                    <i class="ri-arrow-up-s-line" v-else></i>
                  </div>
                </div>
                <div class="qa-answer" v-if="expandedRightListQaId === q.id">答：{{ q.answer }}</div>
                <div class="qa-meta" v-if="expandedRightListQaId === q.id">
                  <div class="qa-meta-top">
                    <span class="qa-meta-time">{{ q.date }}</span>
                    <span class="qa-meta-words">{{ getAnswerWordCount(q.answer) }}次阅读</span>
                  </div>
                  <div class="qa-meta-feedback">
                    <span class="qa-feedback-text">这个对你有帮助吗？</span>
                    <div class="qa-feedback-buttons">
                      <button class="qa-feedback-btn qa-like-btn" @click.stop="handleLike(q.id)" :class="{ active: q.userLiked }">
                        <i class="ri-thumb-up-line"></i>
                        <span>{{ q.likes }}</span>
                      </button>
                      <button class="qa-feedback-btn qa-dislike-btn" @click.stop="handleDislike(q.id)" :class="{ active: q.userDisliked }">
                        <i class="ri-thumb-down-line"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </div>
          <div class="qa-latest card-block">
            <div class="section-head">
              <h3>最新</h3>
            </div>
            <ul class="qa-list-rich qa-list-latest">
              <li v-for="q in latestQuestions" :key="q.id" :data-qa-id="q.id" :class="{active: expandedLatestQaId === q.id}">
                <div class="qa-title-row" @click="toggleLatestQa(q.id)">
                  <div class="qa-title">
                    <span class="qa-category-tag" :style="{ backgroundColor: q.categoryColor }">{{ q.category }}</span>
                    {{ q.title }}
                  </div>
                  <div class="qa-expand-icon">
                    <i class="ri-arrow-down-s-line" v-if="expandedLatestQaId !== q.id"></i>
                    <i class="ri-arrow-up-s-line" v-else></i>
                  </div>
                </div>
                <div class="qa-answer" v-if="expandedLatestQaId === q.id">答：{{ q.answer }}</div>
                <div class="qa-meta" v-if="expandedLatestQaId === q.id">
                  <div class="qa-meta-top">
                    <span class="qa-meta-time">{{ q.date }}</span>
                    <span class="qa-meta-words">{{ getAnswerWordCount(q.answer) }}次阅读</span>
                  </div>
                  <div class="qa-meta-feedback">
                    <span class="qa-feedback-text">这个对你有帮助吗？</span>
                    <div class="qa-feedback-buttons">
                      <button class="qa-feedback-btn qa-like-btn" @click.stop="handleLike(q.id)" :class="{ active: q.userLiked }">
                        <i class="ri-thumb-up-line"></i>
                        <span>{{ q.likes }}</span>
                      </button>
                      <button class="qa-feedback-btn qa-dislike-btn" @click.stop="handleDislike(q.id)" :class="{ active: q.userDisliked }">
                        <i class="ri-thumb-down-line"></i>
                        <span>{{ q.dislikes }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </div>
          <aside class="qa-right card-block">
            <div class="section-head">
              <h3>Top 10 热门问题</h3>
              <el-link>更多</el-link>
            </div>
            <ul class="qa-simple">
              <li v-for="(q, index) in top10Questions" :key="q.id" :class="{ 'top-rank': index < 3, 'active': expandedTop10QaId === q.id }">
                <div class="qa-rank-item" @click="toggleTop10Qa(q.id)">
                  <span class="rank-number" :class="{ 'top-three': index < 3 }">{{ index + 1 }}</span>
                  <span class="rank-title">{{ q.title }}</span>
                  <span class="rank-value">{{ formatViews(q.views) }}</span>
                </div>
                <div class="qa-answer" v-if="expandedTop10QaId === q.id">答：{{ q.answer }}</div>
                <div class="qa-meta" v-if="expandedTop10QaId === q.id">
                  <div class="qa-meta-top">
                    <span class="qa-meta-time">{{ q.date }}</span>
                    <span class="qa-meta-words">{{ getAnswerWordCount(q.answer) }}次阅读</span>
                  </div>
                  <div class="qa-meta-feedback">
                    <span class="qa-feedback-text">这个对你有帮助吗？</span>
                    <div class="qa-feedback-buttons">
                      <button class="qa-feedback-btn qa-like-btn" @click.stop="handleLike(q.id)" :class="{ active: q.userLiked }">
                        <i class="ri-thumb-up-line"></i>
                        <span>{{ q.likes }}</span>
                      </button>
                      <button class="qa-feedback-btn qa-dislike-btn" @click.stop="handleDislike(q.id)" :class="{ active: q.userDisliked }">
                        <i class="ri-thumb-down-line"></i>
                        <span>{{ q.dislikes }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </aside>
        </div>
      </section>

      <section v-if="activeNav === 'ppt'" class="ppt-summary">
        <h2 class="page-title">产品介绍PPT</h2>
        <div class="filters-row">
          <div class="filters-left">
            <el-select v-model="fProduct" placeholder="产品及解决方案" clearable style="min-width:160px">
              <el-option label="一表通" value="一表通" />
              <el-option label="1104" value="1104" />
              <el-option label="受益所有人" value="受益所有人" />
              <el-option label="反洗钱" value="反洗钱" />
            </el-select>
            <el-select v-model="fAudience" placeholder="交流对象" clearable style="min-width:140px">
              <el-option label="业务" value="业务" />
              <el-option label="科技" value="科技" />
              <el-option label="业务领导" value="业务领导" />
              <el-option label="科技领导" value="科技领导" />
            </el-select>
            <el-select v-model="fIndustry" placeholder="行业" clearable style="min-width:120px">
              <el-option label="全国性银行" value="全国性银行" />
              <el-option label="城商行" value="城商行" />
              <el-option label="外资行" value="外资行" />
              <el-option label="农村信社" value="农村信社" />
              <el-option label="汽车/消费金融" value="汽车/消费金融" />
            </el-select>
            <el-select v-model="fBiz" placeholder="业务条线" clearable style="min-width:140px">
              <el-option label="监管条线" value="监管条线" />
              <el-option label="信创协同条线" value="信创协同条线" />
              <el-option label="票据条线" value="票据条线" />
              <el-option label="互联网金融条线" value="互联网金融条线" />
            </el-select>
            <el-select v-model="fVersion" placeholder="版本" clearable style="min-width:120px">
              <el-option label="公共版" value="public" />
              <el-option label="实战版" value="practical" />
            </el-select>
            <el-input v-model="customerName" placeholder="输入客户名称" style="max-width:220px;" />
          </div>
          <div class="sort-tabs">
            <el-radio-group v-model="sort" size="small">
              <el-radio-button label="综合排序" />
              <el-radio-button label="最新上传" />
              <el-radio-button label="最多下载" />
            </el-radio-group>
          </div>
        </div>
        <div class="ppt-summary-grid">
          <div 
            v-for="item in filteredPPTPage" 
            :key="item.id" 
            class="ppt-card" 
            @click="openPpt(item)" 
            style="cursor: pointer;"
          >
            <div class="thumb">
              <img :src="item.thumbnail" :alt="item.title" />
              <span class="badge" :class="item.tag === '公共版' ? 'badge-public' : 'badge-practical'">{{ item.tag }}</span>
            </div>
            <div class="meta">
              <div class="title">{{ item.title }}</div>
              <div class="sub">{{ item.date }}</div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="activeNav === 'video'" class="video-page">
        <h2 class="page-title">交流会议</h2>
        <div class="filters-row">
          <div class="filters-left">
            <el-select v-model="fProduct" placeholder="产品名称" clearable style="min-width:160px">
              <el-option label="一表通" value="一表通" />
              <el-option label="1104" value="1104" />
              <el-option label="受益所有人" value="受益所有人" />
              <el-option label="反洗钱" value="反洗钱" />
              <el-option label="金数" value="金数" />
            </el-select>
            <el-select v-model="fIndustry" placeholder="行业" clearable style="min-width:160px">
              <el-option label="银行" value="银行" />
              <el-option label="保险" value="保险" />
              <el-option label="证券" value="证券" />
              <el-option label="政务" value="政务" />
              <el-option label="企业" value="企业" />
            </el-select>
          </div>
        </div>
        <div class="ppt-summary-grid">
          <div 
            v-for="item in filteredVideosPage" 
            :key="item.id" 
            class="ppt-card" 
            @click="openVideo(item)" 
            style="cursor: pointer;"
          >
            <div class="thumb is-video">
              <img :src="item.thumbnail" :alt="item.title" />
              <span class="badge" :class="item.tag === '公共版' ? 'badge-public' : 'badge-practical'">{{ item.tag }}</span>
              <div class="play-icon"><el-icon><VideoPlay /></el-icon></div>
            </div>
            <div class="meta">
              <div class="title">{{ item.title }}</div>
              <div class="sub">{{ item.product }} | {{ item.industry }} | {{ item.date }}</div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="activeNav === 'tender'" class="tender-page">
        <h2 class="page-title">招投标</h2>
        <div class="filters-row">
          <div class="filters-left">
            <el-select v-model="fProduct" placeholder="产品及解决方案" clearable style="min-width:160px">
              <el-option label="一表通" value="一表通" />
              <el-option label="1104" value="1104" />
              <el-option label="受益所有人" value="受益所有人" />
              <el-option label="反洗钱" value="反洗钱" />
              <el-option label="金数" value="金数" />
            </el-select>
            <el-select v-model="fIndustry" placeholder="行业" clearable style="min-width:160px">
              <el-option label="全国性银行" value="全国性银行" />
              <el-option label="城商行" value="城商行" />
              <el-option label="外资行" value="外资行" />
              <el-option label="农村信社" value="农村信社" />
              <el-option label="汽车/消费金融" value="汽车/消费金融" />
            </el-select>
            <el-input v-model="customerName" placeholder="输入客户名称" style="max-width:220px;" />
          </div>
        </div>
        <div class="ppt-summary-grid">
          <div 
            v-for="item in tenderFiles" 
            :key="item.id" 
            class="ppt-card" 
            @click="openPpt(item)" 
            style="cursor: pointer;"
          >
            <div class="thumb">
              <img :src="item.thumbnail" :alt="item.title" />
              <span class="badge badge-tender">招标文件</span>
            </div>
            <div class="meta">
              <div class="title">{{ item.title }}</div>
              <div class="sub">{{ item.date }}</div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- PPT 对话框 -->
    <PptDialog
      v-model:visible="dialogVisible"
      :title="dialogTitle"
      :type="dialogType"
      :slides="slides"
      :is-response-dialog="isResponseDialog"
      :response-toc-sections="responseTocSections"
      :communication-info="communicationInfo"
      :similar-documents="similarDocuments"
      :similar-communications="similarCommunications"
      @close="handlePptDialogClose"
    />

    <!-- PDF 对话框 -->
    <PdfDialog
      v-model:visible="pdfDialogVisible"
      :title="pdfDialogTitle"
      :pdf-url="pdfDialogUrl"
      :update-date="pdfDialogUpdateDate"
      @close="handlePdfDialogClose"
    />

    <!-- 视频对话框 -->
    <el-dialog 
      v-model="videoDialogVisible" 
      :show-close="true" 
      fullscreen 
      class="video-dialog" 
    >
      <template #header>
        <div class="video-header">
          <div class="video-title-row">
            <span class="v-title">{{ videoDetail.project }}</span>
            <div class="v-meta">
              <span>创建人：{{ videoDetail.host }}</span>
              <el-divider direction="vertical" />
              <span>{{ videoDetail.time }}</span>
              <el-divider direction="vertical" />
              <span>观看 100</span>
            </div>
          </div>
          <div class="v-actions">
            <el-button round size="small"><el-icon><Star /></el-icon> 收藏</el-button>
          </div>
        </div>
      </template>
      <div class="video-layout assistant-split-pane-container">
        <div class="video-main-col" :style="{ width: leftWidth }">
          <div class="video-player-placeholder">
            <div class="play-btn"><el-icon size="64"><VideoPlay /></el-icon></div>
            <div class="video-controls">
              <div class="progress-bar"></div>
              <div class="ctrl-row">
                <el-icon><VideoPlay /></el-icon>
                <span>00:00 / 38:54</span>
              </div>
            </div>
          </div>
          <div class="video-desc">{{ videoDetail.desc }}</div>
          <div class="video-stats-row">
            <span>观看 100</span>
            <span>收藏 23</span>
          </div>
          <div class="video-qa-grid">
            <div class="qa-card">
              <div class="card-head">本次交流问题汇总</div>
              <div class="qa-content">
                <div v-for="(q, i) in videoDetail.qa" :key="i" class="qa-pair">
                  <div class="q-line"><strong>Q：{{ q.q }}</strong></div>
                  <div class="a-line">A：{{ q.a }}</div>
                </div>
              </div>
            </div>
            <div class="qa-card">
              <div class="card-head">潜在问题和需求</div>
              <div class="qa-content">
                <div v-for="(n, i) in videoDetail.needs" :key="i" class="qa-pair">
                  <div class="q-line"><strong>需求：{{ n.q }}</strong></div>
                  <div class="a-line">{{ n.a }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div 
          class="split-pane-divider" 
          @mousedown="startResize"
        >
          <i class="ri-arrow-left-right-fill divider-icon"></i>
        </div>
        <div class="video-side-col" :style="{ width: rightWidth }">
          <div class="side-block">
            <h3 class="side-head">{{ videoDetail.customer }}</h3>
            <div class="side-info-row">线索：云南金融地方金融监管系统</div>
            <div class="side-info-row">日期及时间：2025.09.29 13:00-14:30</div>
            <div class="side-info-row side-info-row-host">主讲人：{{ videoDetail.host }}</div>
            <div class="side-info-row">我方参会人：{{ videoDetail.participants }}</div>
          </div>
          <div class="side-block">
            <h4 class="sub-head">客户参会人</h4>
            <div v-for="(p, i) in videoDetail.customerParticipants" :key="i" class="participant-item">
              <div class="p-name">{{ p.name }} / {{ p.role }}</div>
              <div class="p-tags">
                <el-tag size="small" effect="plain">因售前接触 {{ p.stat1 }}</el-tag>
                <el-tag size="small" effect="plain">因项目接触 {{ p.stat2 }}</el-tag>
                <el-tag size="small" effect="plain" v-if="p.stat3">因售后接触 {{ p.stat3 }}</el-tag>
              </div>
            </div>
            <div class="side-desc">
              主讲内容：沟通客户需求，了解项目申报进度<br>
              系统名称：地方金融监管系统<br>
              报备说明：现场漫谈，无录屏，有录音，本项目第10次交流。<br>
              交流目的：沟通客户需求，了解项目申报进度，了解申报预算。
            </div>
          </div>
          <div class="side-block">
            <h4 class="sub-head">交流文件</h4>
            <div v-for="f in videoDetail.files" :key="f.id" class="file-item">
              <img src="https://dummyimage.com/40x40/eee/999?text=PPT" class="file-icon" />
              <div class="file-info">
                <div class="f-name">{{ f.name }}</div>
                <div class="f-meta">
                  <div class="f-meta-line">创建者：郑相宜 {{ f.size }}</div>
                  <div class="f-meta-stats">
                    <span class="stat-item">
                      <i class="ri-eye-line"></i>
                      <span>{{ f.view }}</span>
                    </span>
                    <span class="stat-item">
                      <i class="ri-download-line"></i>
                      <span>{{ f.down }}</span>
                    </span>
                    <span class="stat-item">
                      <i class="ri-thumb-up-line"></i>
                      <span>{{ f.like }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="side-block">
            <h4 class="sub-head">相关交流会议</h4>
            <div v-for="rv in videoDetail.relatedVideos" :key="rv.id" class="rel-video-item">
              <div class="rv-thumb">
                <img :src="rv.img" />
                <span class="rv-dur">{{ rv.duration }}</span>
              </div>
              <div class="rv-info">
                <div class="rv-title">{{ rv.title }}</div>
                <div class="rv-meta">创建者：{{ rv.author }} {{ rv.date }}<br>观看 {{ rv.view }} 点赞 {{ rv.like }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Filter, Document, VideoPlay, MagicStick, Download, Star } from '@element-plus/icons-vue'
import Header from './components/Header.vue'
import SearchBar from './components/SearchBar.vue'
import PptDialog from './components/PptDialog.vue'
import PdfDialog from './components/PdfDialog.vue'
const router = useRouter()
const route = useRoute()

const activeNav = ref('recommend')

// 根据路由参数设置activeNav
onMounted(() => {
  if (route.query.nav) {
    activeNav.value = route.query.nav
  }
})

// 监听路由变化
watch(() => route.query.nav, (newNav) => {
  if (newNav) {
    activeNav.value = newNav
  }
})
const activeTab = ref('ppt')
const activeDashboardTab = ref('products')
const activeBrandTab = ref('company')
const filterVersion = ref('all')
const activeProduct = ref('')
const customerName = ref('')
const fProduct = ref(null)
const fAudience = ref(null)
const fIndustry = ref(null)
const fBiz = ref(null)
const fVersion = ref(null)
const sort = ref('综合排序')
const activeSlide = ref(0)
const selectedSlides = ref([])
const wordTocMode = ref('single') // single | multi
const isResponseDialog = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogType = ref('public')
const currentPptTag = ref('公共版')
const aiPanelVisible = ref(false)
const aiInputText = ref('')
const videoDialogVisible = ref(false)

// PDF 对话框相关状态
const pdfDialogVisible = ref(false)
const pdfDialogTitle = ref('')
const pdfDialogUrl = ref('')
const pdfDialogUpdateDate = ref('')
const currentVideo = ref(null)
const expandedQaId = ref(null)
const expandedTop10QaId = ref(null)
const expandedLeftQaId = ref(null)
const expandedRightListQaId = ref(null)
const expandedLatestQaId = ref(null)

// 高级筛选相关
const showAdvancedFilter = ref(false)
const pptFilters = reactive({
  customerName: '',
  productSolution: null,
  productIntro: [],
  industry: [],
  audience: [],
  language: []
})
const qaFilters = reactive({
  customerName: '',
  customerIndustry: [],
  questioner: [],
  exchangeStage: [],
  userNeeds: [],
  questionType: []
})
const videoFilters = reactive({
  customerName: '',
  customerType: [],
  meetingType: [],
  participants: [],
  ourParticipants: []
})
const tenderFilters = reactive({
  customerName: '',
  procurementMethod: [],
  projectOverview: [],
  technicalRequirements: [],
  qualificationReview: [],
  contractBusiness: []
})
const responseFilters = reactive({
  customerName: '',
  quotation: [],
  bidStatus: [],
  businessQualification: [],
  technicalSolution: [],
  implementationGuarantee: [],
  casesProof: []
})

// 公司组织结构数据
const companyStructure = [
  {
    department: '技术部',
    members: [
      { id: 'tech1', name: '张三', role: '技术' },
      { id: 'tech2', name: '李四', role: '技术' },
      { id: 'tech3', name: '王五', role: '技术' }
    ]
  },
  {
    department: '技术部',
    members: [
      { id: 'tech_lead1', name: '赵六', role: '技术负责人' },
      { id: 'tech_lead2', name: '孙七', role: '技术负责人' }
    ]
  },
  {
    department: '业务部',
    members: [
      { id: 'biz1', name: '周八', role: '业务' },
      { id: 'biz2', name: '吴九', role: '业务' },
      { id: 'biz3', name: '郑十', role: '业务' }
    ]
  },
  {
    department: '业务部',
    members: [
      { id: 'biz_lead1', name: '钱一', role: '业务负责人' },
      { id: 'biz_lead2', name: '钱二', role: '业务负责人' }
    ]
  },
  {
    department: '产品部',
    members: [
      { id: 'prod1', name: '产品经理A', role: '产品' },
      { id: 'prod2', name: '产品经理B', role: '产品' }
    ]
  },
  {
    department: '销售部',
    members: [
      { id: 'sales1', name: '销售A', role: '销售' },
      { id: 'sales2', name: '销售B', role: '销售' }
    ]
  }
]

// 扁平化人员列表，用于下拉选择
const allCompanyMembers = computed(() => {
  return companyStructure.flatMap(dept => 
    dept.members.map(member => ({
      ...member,
      label: `${member.name}（${dept.department} - ${member.role}）`,
      value: member.id
    }))
  )
})

// 分屏调整宽度相关
const leftWidth = ref('calc(63% - 0.63px)')
const rightWidth = ref('calc(37% - 0.37px)')
const isResizing = ref(false)
const startX = ref(0)
const startLeftWidth = ref(0)
const startRightWidth = ref(0)

const startResize = (e) => {
  isResizing.value = true
  startX.value = e.clientX
  const container = e.target.closest('.assistant-split-pane-container')
  if (container) {
    const leftCol = container.querySelector('.video-main-col')
    const rightCol = container.querySelector('.video-side-col')
    if (leftCol && rightCol) {
      startLeftWidth.value = leftCol.offsetWidth
      startRightWidth.value = rightCol.offsetWidth
    }
  }
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

const handleResize = (e) => {
  if (!isResizing.value) return
  
  const container = document.querySelector('.assistant-split-pane-container')
  if (!container) return
  
  const containerWidth = container.offsetWidth
  const diff = e.clientX - startX.value
  const newLeftWidth = startLeftWidth.value + diff
  const newRightWidth = startRightWidth.value - diff
  
  // 限制最小宽度
  const minLeftWidth = 384
  const minRightWidth = 440
  
  if (newLeftWidth >= minLeftWidth && newRightWidth >= minRightWidth) {
    const leftPercent = (newLeftWidth / containerWidth) * 100
    const rightPercent = (newRightWidth / containerWidth) * 100
    leftWidth.value = `${leftPercent}%`
    rightWidth.value = `${rightPercent}%`
  }
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

const productStats = [
  { name: '一表通', sessions: 124, ppts: 45, questions: 89 },
  { name: '1104', sessions: 98, ppts: 32, questions: 67 },
  { name: '受益所有人', sessions: 86, ppts: 28, questions: 45 },
  { name: '反洗钱', sessions: 112, ppts: 39, questions: 78 },
  { name: '金数', sessions: 145, ppts: 56, questions: 102 },
  { name: '金数数据质量', sessions: 76, ppts: 24, questions: 34 },
  { name: '监管集市', sessions: 65, ppts: 18, questions: 29 },
  { name: '征信', sessions: 54, ppts: 15, questions: 21 },
  { name: '票据', sessions: 43, ppts: 12, questions: 19 },
  { name: '支付', sessions: 32, ppts: 9, questions: 15 },
]

const brandMaterials = [
  { id: 'b1', name: '公司简介', type: 'PPT', updateDate: '2025-10-20', usage: 156 },
  { id: 'b2', name: '技术体系介绍', type: 'PPT', updateDate: '2025-10-18', usage: 89 },
  { id: 'b3', name: '业务体系介绍', type: 'PPT', updateDate: '2025-10-15', usage: 67 },
  { id: 'b4', name: '监管合作案例', type: 'PPT', updateDate: '2025-10-12', usage: 134 },
  { id: 'b5', name: '机构合作案例', type: 'PPT', updateDate: '2025-10-10', usage: 98 },
  { id: 'b6', name: '资质认证', type: 'PDF', updateDate: '2025-10-08', usage: 45 },
  { id: 'b7', name: '荣誉证书', type: 'PDF', updateDate: '2025-10-05', usage: 32 },
  { id: 'b8', name: '企业宣传册', type: 'PDF', updateDate: '2025-10-01', usage: 78 },
]

// 品牌基础资料 - 公司介绍tab的内容
const brandCompanyItems = [
  { id: 'bc1', title: '公司介绍（PDF版）', date: '2025-10-20', tag: 'PDF', type: 'pdf', pdfUrl: '/test.pdf', thumbnail: 'https://picsum.photos/seed/brand1/320/180' },
  { id: 'bc2', title: '公司介绍（PPT版）', date: '2025-10-20', tag: 'PPT', type: 'ppt', thumbnail: 'https://picsum.photos/seed/brand2/320/180' },
  { id: 'bc3', title: '企业宣传视频', date: '2025-10-20', type: 'video', thumbnail: 'https://picsum.photos/seed/brand3/320/180' },
  { id: 'bc4', title: '监管方向企业介绍（PDF版）', date: '2025-10-20', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/brand4/320/180' },
  { id: 'bc5', title: '监管方向企业介绍（PPT版）', date: '2025-10-20', tag: 'PPT', type: 'ppt', thumbnail: 'https://picsum.photos/seed/brand5/320/180' },
]

// 品牌基础资料 - 产品合集tab的内容
const brandProductsItems = [
  { id: 'bp1', title: '产品全向图25版本', date: '2025-10-20', tag: 'PDF', type: 'pdf', pdfUrl: '/test.pdf', thumbnail: 'https://picsum.photos/seed/product1/320/180' },
  { id: 'bp2', title: '产品全向图24版本', date: '2024-10-20', tag: 'PDF', type: 'pdf', pdfUrl: '/test.pdf', thumbnail: 'https://picsum.photos/seed/product2/320/180' },
  { id: 'bp3', title: '产品全向图23版本', date: '2023-10-20', tag: 'PDF', type: 'pdf', pdfUrl: '/test.pdf', thumbnail: 'https://picsum.photos/seed/product3/320/180' },
]

// 品牌基础资料 - 制度解读tab的内容
const brandRegulationsItems = [
  { id: 'br1', title: '2017年监管制度解读合集', date: '2017-12-31', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/reg2017/320/180' },
  { id: 'br2', title: '2018年监管制度解读合集', date: '2018-12-31', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/reg2018/320/180' },
  { id: 'br3', title: '2019年监管制度解读合集', date: '2019-12-31', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/reg2019/320/180' },
  { id: 'br4', title: '2020年监管制度解读合集', date: '2020-12-31', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/reg2020/320/180' },
  { id: 'br5', title: '2021年监管制度解读合集', date: '2021-12-31', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/reg2021/320/180' },
  { id: 'br6', title: '2022年监管制度解读合集', date: '2022-12-31', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/reg2022/320/180' },
  { id: 'br7', title: '2023年监管制度解读合集', date: '2023-12-31', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/reg2023/320/180' },
  { id: 'br8', title: '2024年监管制度解读合集', date: '2024-12-31', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/reg2024/320/180' },
]

// 品牌基础资料 - 台历tab的内容
const brandCalendarItems = [
  { id: 'bcal1', title: '2023年台历', date: '2023-01-01', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/cal2023/320/180' },
  { id: 'bcal2', title: '2024年台历', date: '2024-01-01', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/cal2024/320/180' },
  { id: 'bcal3', title: '2025年台历', date: '2025-01-01', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/cal2025/320/180' },
]

// 品牌基础资料 - 监管合规tab的内容
const brandComplianceItems = [
  { id: 'bcomp1', title: '一表通报送平台（NUPS-GRDC）', date: '2025-10-20', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/comp1/320/180' },
  { id: 'bcomp2', title: '先进统计报送平台', date: '2025-10-20', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/comp2/320/180' },
  { id: 'bcomp3', title: '反洗钱计算引擎', date: '2025-10-20', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/comp3/320/180' },
  { id: 'bcomp4', title: '金融技术数据报送系统PBOCD', date: '2025-10-20', tag: 'PDF', type: 'pdf', thumbnail: 'https://picsum.photos/seed/comp4/320/180' },
]

const openBrandMaterial = (item) => {
  // 可以在这里添加打开品牌基础资料的处理逻辑
  console.log('打开品牌基础资料:', item)
}

const openBrandItem = (item) => {
  // 打开品牌基础资料项
  console.log('打开品牌基础资料项:', item)
  if (item.type === 'video') {
    // 如果是视频，可以打开视频对话框
    openVideo({ id: item.id, title: item.title, thumbnail: item.thumbnail })
  } else if (item.type === 'ppt') {
    // 品牌基础资料中的PPT文件统一使用公共版弹出层
    openPpt({ id: item.id, title: item.title, thumbnail: item.thumbnail, tag: '公共版' })
  } else if (item.type === 'pdf') {
    // PDF文件使用PDF弹出层
    pdfDialogTitle.value = item.title
    pdfDialogUrl.value = item.pdfUrl || `/test.pdf`
    pdfDialogUpdateDate.value = item.date || item.updateDate || ''
    pdfDialogVisible.value = true
  } else {
    // 其他类型，也使用公共版弹出层
    openPpt({ id: item.id, title: item.title, thumbnail: item.thumbnail, tag: '公共版' })
  }
}

const getBrandTabItems = (tab) => {
  // 根据tab返回对应的内容
  const itemsMap = {
    'products': brandProductsItems,
    'regulations': brandRegulationsItems,
    'calendar': brandCalendarItems,
    'compliance': brandComplianceItems,
    'general': [], // 泛监管
    'xinchuang': [], // 协同信创
    'local': [], // 地方金融监管
    'bill': [] // 金融票据业务
  }
  return itemsMap[tab] || []
}

const pptList = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  title: `某产品交流PPT示例 ${i + 1}.ppt`,
  date: '10-31',
  tag: i % 2 === 0 ? '公共版' : '实战版',
  product: ['一表通', '1104', '受益所有人', '反洗钱', '金数'][i % 5],
  thumbnail: 'https://picsum.photos/seed/ppt' + (i + 1) + '/320/180',
}))

const allVideos = Array.from({ length: 12 }, (_, i) => ({
  id: 'v' + i,
  title: `产品演示视频示例 ${i + 1}.mp4`,
  date: '10-31',
  tag: i % 2 === 0 ? '公共版' : '实战版',
  product: ['一表通', '1104', '受益所有人', '反洗钱', '金数'][i % 5],
  industry: ['银行', '保险', '证券', '政务', '企业'][i % 5],
  thumbnail: 'https://picsum.photos/seed/video' + (i + 1) + '/360/200',
  duration: `${Math.floor(Math.random() * 30) + 10}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`
}))

const tenderFiles = Array.from({ length: 8 }, (_, i) => ({
  id: 't' + i,
  title: `招标文件示例 ${i + 1}.pdf`,
  date: '10-31',
  tag: '招标文件',
  thumbnail: 'https://picsum.photos/seed/tender' + (i + 1) + '/320/180',
}))

const responseFiles = [
  { id: 'r1', title: '北京银行 一表通项目建设', date: '10-31', tag: '响应文件', type: 'response', thumbnail: 'https://picsum.photos/seed/response1/320/180' },
  { id: 'r2', title: '上海银行 数据质量监管项目', date: '10-31', tag: '响应文件', type: 'response', thumbnail: 'https://picsum.photos/seed/response2/320/180' },
  { id: 'r3', title: '招商银行 反洗钱智能风控项目', date: '10-31', tag: '响应文件', type: 'response', thumbnail: 'https://picsum.photos/seed/response3/320/180' },
  { id: 'r4', title: '交通银行 客户360画像平台项目', date: '10-31', tag: '响应文件', type: 'response', thumbnail: 'https://picsum.photos/seed/response4/320/180' },
  { id: 'r5', title: '浦发银行 统一报送与指标库项目', date: '10-31', tag: '响应文件', type: 'response', thumbnail: 'https://picsum.photos/seed/response5/320/180' },
  { id: 'r6', title: '兴业银行 金数数据中台项目', date: '10-31', tag: '响应文件', type: 'response', thumbnail: 'https://picsum.photos/seed/response6/320/180' },
  { id: 'r7', title: '中信银行 受益所有人识别项目', date: '10-31', tag: '响应文件', type: 'response', thumbnail: 'https://picsum.photos/seed/response7/320/180' },
  { id: 'r8', title: '民生银行 1104监管报送项目', date: '10-31', tag: '响应文件', type: 'response', thumbnail: 'https://picsum.photos/seed/response8/320/180' },
]

const questions = [
  { id: 1, title: '系统支持哪些数据库兼容？', category: '数', categoryColor: '#FF6A00', tags: ['国产化', '数据库'], answer: '数据库支持mysql、Oracle[11gR1、12cR2]、DB2、达梦。', date: '2025/10/20', customer: '渤海银行', views: 123, likes: 123, comments: 12, userLiked: false, userDisliked: false },
  { id: 2, title: '如何配置容灾与备份？', category: '技', categoryColor: '#9C27B0', tags: ['高可用', '备份'], answer: '系统提供完整的容灾备份方案，支持主备切换、数据同步、定时备份等功能。', date: '2025/10/18', customer: '北京银行', views: 98, likes: 45, comments: 8, userLiked: false, userDisliked: false },
  { id: 3, title: 'RSZS如何在个性化场景做扩展？', category: '技', categoryColor: '#9C27B0', tags: ['可扩展性'], answer: 'RSZS可信区个性化分支1.4版本与公司合版已实现功能对接，支持个性化配置和统一管理。', date: '2025/10/15', customer: '上海银行', views: 67, likes: 23, comments: 5, userLiked: false, userDisliked: false },
  { id: 4, title: 'RSZS制度包升级,速度比报送区慢很多,10分钟3张表', category: '产', categoryColor: '#2563eb', tags: ['产品'], answer: '制度包升级速度慢的问题已定位，主要是数据校验逻辑复杂导致，已优化算法提升处理速度。', date: '2025/10/12', customer: '招商银行', views: 145, likes: 67, comments: 15, userLiked: false, userDisliked: false },
  { id: 5, title: '可信区校验结果表报文推送失败', category: '产', categoryColor: '#2563eb', tags: ['产品'], answer: '报文推送失败通常由网络异常或配置错误引起，请检查网络连接和推送配置参数。', date: '2025/10/10', customer: '工商银行', views: 112, likes: 34, comments: 9, userLiked: false, userDisliked: false },
  { id: 6, title: '如何配置容灾与备份？', category: '技', categoryColor: '#9C27B0', tags: ['技术'], answer: '系统提供完整的容灾备份方案，支持主备切换、数据同步、定时备份等功能。', date: '2025/10/08', customer: '建设银行', views: 89, likes: 28, comments: 6, userLiked: false, userDisliked: false },
  { id: 7, title: '系统性能如何优化？', category: '技', categoryColor: '#9C27B0', tags: ['性能优化'], answer: '系统支持多种性能优化策略，包括数据库索引优化、缓存机制、负载均衡等。', date: '2025/10/05', customer: '农业银行', views: 76, likes: 19, comments: 4, userLiked: false, userDisliked: false },
  { id: 8, title: '数据安全如何保障？', category: '业', categoryColor: '#2563eb', tags: ['数据安全'], answer: '系统采用多重安全机制，包括数据加密、访问控制、审计日志等，确保数据安全。', date: '2025/10/03', customer: '交通银行', views: 94, likes: 31, comments: 7, userLiked: false, userDisliked: false },
  { id: 9, title: '系统部署需要哪些环境？', category: '技', categoryColor: '#9C27B0', tags: ['部署'], answer: '系统支持Linux、Windows等操作系统，需要JDK 1.8+、数据库、应用服务器等环境。', date: '2025/10/01', customer: '民生银行', views: 101, likes: 42, comments: 10, userLiked: false, userDisliked: false },
  { id: 10, title: '如何实现数据同步？', category: '数', categoryColor: '#FF6A00', tags: ['数据同步'], answer: '系统提供实时同步和定时同步两种模式，支持增量同步和全量同步。', date: '2025/09/28', customer: '光大银行', views: 82, likes: 25, comments: 5, userLiked: false, userDisliked: false },
  { id: 11, title: '系统支持哪些接口协议？', category: '技', categoryColor: '#9C27B0', tags: ['接口'], answer: '系统支持RESTful API、WebService、消息队列等多种接口协议。', date: '2025/09/25', customer: '华夏银行', views: 115, likes: 38, comments: 11, userLiked: false, userDisliked: false },
  { id: 12, title: '如何进行系统监控？', category: '技', categoryColor: '#9C27B0', tags: ['监控'], answer: '系统提供完善的监控功能，包括性能监控、日志监控、告警通知等。', date: '2025/09/22', customer: '平安银行', views: 108, likes: 36, comments: 9, userLiked: false, userDisliked: false },
]

const materials = Array.from({ length: 9 }, (_, i) => ({
  id: 'm' + i,
  title: `宣传物料示例 ${i + 1}`,
  date: '2025/10/20',
  thumbnail: 'https://picsum.photos/seed/material' + (i + 1) + '/360/200',
}))

const slides = [
  { id: 's1', title: '公司介绍', img: 'https://picsum.photos/seed/slide1/1024/640' },
  { id: 's2', title: '资质认证', img: 'https://picsum.photos/seed/slide2/1024/640' },
  { id: 's3', title: '技术体系', img: 'https://picsum.photos/seed/slide3/1024/640' },
  { id: 's4', title: '产品架构', img: 'https://picsum.photos/seed/slide4/1024/640' },
]

const sideInfo = {
  sessions: [
    { id: 'se1', type: '视频', title: '产品宣讲交流', date: '25/09/01', view: 100, like: 30, comment: 10, thumb: 'https://picsum.photos/seed/session1/120/80' },
    { id: 'se2', type: '视频', title: '方案澄清会议', date: '25/09/05', view: 80, like: 20, comment: 6, thumb: 'https://picsum.photos/seed/session2/120/80' },
  ],
  docs: [
    { id: 'd1', title: '北京某行交流宣讲PPT', tag: '公共版', date: '25/09/01', creator: '郑相宜', view: 23, like: 12, comment: 1, thumb: 'https://picsum.photos/seed/doc1/120/90' },
    { id: 'd2', title: '北京某行二次交流纪要.PPT', tag: '实战版', date: '25/09/10', creator: '郑相宜', view: 18, like: 6, comment: 2, thumb: 'https://picsum.photos/seed/doc2/120/90' },
  ],
  exchanges: [
    { id: 'ex1', title: '北京某行—一表通交流', date: '25/08/28' },
    { id: 'ex2', title: '天津某农商—功能演示交流', date: '25/08/30' },
  ],
}

const videoDetail = {
  customer: '潍坊银行',
  project: '金融基础数据报送系统(PBOCD)',
  time: '2025.09.29 13:00-14:30',
  host: '郑相宜',
  participants: '张三、李四',
  desc: '沟通我司针对本次发文的产品功能情况，以及沟通客户内部后续推进计划。沟通我司针对本次发文的产品功能情况，以及沟通客户内部后续推进计划。',
  customerParticipants: [
    { name: '张海英', role: '政策研究处/处长', stat1: 9, stat2: 19, stat3: 40, stat4: 2 },
    { name: '王洪博', role: '科长', stat1: 9, stat2: 19 }
  ],
  files: [
    { id: 1, name: '金融基础数据报送系统(PBOCD)', type: 'ppt', size: '25/09/01', view: 23, down: 12, like: 1 }
  ],
  relatedVideos: [
    { id: 1, title: '中信信托s金数及数据质量产品方案介绍', author: '郑相宜', date: '25/09/01', view: 100, like: 30, duration: '01:05:51', img: 'https://picsum.photos/seed/rel1/160/90' },
    { id: 2, title: '中信信托s金数及数据质量产品方案介绍', author: '郑相宜', date: '25/09/01', view: 100, like: 30, duration: '01:05:51', img: 'https://picsum.photos/seed/rel2/160/90' }
  ],
  qa: [
    { q: '问题描述xxxxx文字示例文字示例 05:10', a: '面。对。都不行。是不是都不用开声音，因为不就咱们几个吗？不用开。什么。不是你一个人开声音没事，你开你自己的开声' },
    { q: '问题描述xxxxx文字示例文字示例 15:10', a: '面。对。都不行。是不是都不用开声音，因为不就咱们几个吗？不用开。什么。不是你一个人开声音没事，你开你自己的开声' }
  ],
  needs: [
    { q: '想了解更多关于受益所有人的系统建设', a: '都不行。是不是都不用开声音，因为不就咱们几个吗？不用开。什么。不是你一个人开声音没事，你开你自己的开声' },
    { q: '问题描述xxxxx文字示例文字示例 15:10', a: '面。对。都不行。是不是都不用开声音，因为不就咱们几个吗？不用开。什么。不是你一个人开声音没事，你开你自己的开声' }
  ]
}

const filteredPPT = computed(() => {
  let list = pptList
  if (filterVersion.value === 'public') list = list.filter(x => x.tag === '公共版')
  if (filterVersion.value === 'practical') list = list.filter(x => x.tag === '实战版')
  if (activeProduct.value) list = list.filter(x => x.product === activeProduct.value)
  return list
})

const filteredVideos = computed(() => {
  let list = allVideos
  if (filterVersion.value === 'public') list = list.filter(x => x.tag === '公共版')
  if (filterVersion.value === 'practical') list = list.filter(x => x.tag === '实战版')
  if (activeProduct.value) list = list.filter(x => x.product === activeProduct.value)
  return list
})

const filteredVideosPage = computed(() => {
  let list = allVideos
  if (fProduct.value && fProduct.value !== 'all') list = list.filter(x => x.product === fProduct.value)
  if (fIndustry.value && fIndustry.value !== 'all') list = list.filter(x => x.industry === fIndustry.value)
  return list
})

const filteredPPTPage = computed(() => {
  let list = pptList
  if (fVersion.value === 'public') list = list.filter(x => x.tag === '公共版')
  if (fVersion.value === 'practical') list = list.filter(x => x.tag === '实战版')
  if (fProduct.value && fProduct.value !== 'all') list = list.filter(x => x.product === fProduct.value)
  if (customerName.value) {
    const q = customerName.value.trim()
    if (q) list = list.filter(x => x.title.includes(q))
  }
  return list
})

// 将问题列表分成左右两部分
const leftQuestions = computed(() => {
  const mid = Math.ceil(questions.length / 2)
  return questions.slice(0, mid)
})

const rightQuestions = computed(() => {
  const mid = Math.ceil(questions.length / 2)
  return questions.slice(mid)
})

// 最新问题（按日期排序，最新的在前）
const latestQuestions = computed(() => {
  return [...questions]
    .sort((a, b) => {
      const dateA = new Date(a.date.replace(/\//g, '-'))
      const dateB = new Date(b.date.replace(/\//g, '-'))
      return dateB - dateA
    })
    .slice(0, 6)
})

// Top10 热门问题列表（按浏览量排序）
const top10Questions = computed(() => {
  return [...questions]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)
})

// 前3个热门问题（用于推荐页面底部显示）- 固定显示前3个问题
const top3Questions = computed(() => {
  return questions.slice(0, 3)
})

// 切换Top10问题展开/收起
const toggleTop10Qa = (qaId) => {
  if (expandedTop10QaId.value === qaId) {
    expandedTop10QaId.value = null
  } else {
    expandedTop10QaId.value = qaId
  }
}

// 选择Top10问题（保留用于可能的其他用途）
const selectTop10Question = (question) => {
  expandedQaId.value = question.id
  // 滚动到对应位置
  setTimeout(() => {
    const element = document.querySelector(`.qa-list-rich li[data-qa-id="${question.id}"]`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, 100)
}

const getFilterTitle = () => {
  const titles = {
    'ppt': '产品介绍PPT - 高级筛选',
    'video': '交流会议 - 高级筛选',
    'qa': '客户关心问题 - 高级筛选',
    'tender': '招标文件 - 高级筛选',
    'response': '响应文件 - 高级筛选'
  }
  return titles[activeTab.value] || '高级筛选'
}

const selectProduct = (productName) => {
  if (activeProduct.value === productName) {
    activeProduct.value = ''
    activeCatalogIds.value = []
  } else {
    activeProduct.value = productName
    activeCatalogIds.value = []
    updateProductContent()
  }
}

const openPpt = (item) => {
  dialogTitle.value = item.title
  currentPptTag.value = item.tag || '公共版'
  dialogType.value = item.tag === '公共版' ? 'public' : 'practical'
  isResponseDialog.value = item.type === 'response'
  dialogVisible.value = true

  // 响应文件打开 Word 弹窗内容布局：左侧目录，右侧正文
  if (item.type === 'response') {
    const pages = responseTocFlat.map((t, idx) => ({
      id: `w${idx + 1}`,
      title: t.title,
      img: `https://dummyimage.com/900x1200/f8fafc/6b7280&text=${encodeURIComponent(t.title)}`
    }))
    slides.splice(0, slides.length, ...pages)
    dialogType.value = 'practical'
  }

  // 实战版时加载相关数据
  if (dialogType.value === 'practical') {
    // 售前交流信息
    communicationInfo.value = {
      title: '沧州银行一表通系统建设',
      creator: '郑相宜',
      date: '25/09/01',
      views: 100,
      likes: 30,
      comments: 10,
      ourParticipants: '李鹏超、郑相宜',
      clientParticipants: '政策研究处处长 张海英,科长 王洪博',
      leadName: '廊坊银行金数系统建设',
      mainContent: '沟通客户需求,了解项目申报进度',
      systemName: '金融基础数据系统',
      reportNotes: '腾讯会议,本项目第10次'
    }

    // 相似文档
    similarDocuments.value = [
      {
        id: 'doc1',
        title: '北京银行一表通建设售前交流.PPT',
        creator: '郑相宜',
        date: '25/09/01',
        views: 23,
        likes: 12,
        comments: 1,
        downloads: 4
      },
      {
        id: 'doc2',
        title: '北京银行一表通建设售前交流.PPT',
        creator: '郑相宜',
        date: '25/09/01',
        views: 23,
        likes: 12,
        comments: 1,
        downloads: 4
      },
      {
        id: 'doc3',
        title: '北京银行一表通建设售前交流.PPT',
        creator: '郑相宜',
        date: '25/09/01',
        views: 23,
        likes: 12,
        comments: 1,
        downloads: 4
      }
    ]

    // 相似交流
    similarCommunications.value = [
      {
        id: 'comm1',
        title: '北京银行一表通建设售前交流方案',
        creator: '郑相宜',
        date: '25/09/01',
        views: 100,
        likes: 30,
        comments: 10
      },
      {
        id: 'comm2',
        title: '天津农发行一表通建设售前交流方案',
        creator: '郑相宜',
        date: '25/09/01',
        views: 100,
        likes: 30,
        comments: 10
      },
      {
        id: 'comm3',
        title: '天津农发行一表通建设售前交流方案',
        creator: '郑相宜',
        date: '25/09/01',
        views: 100,
        likes: 30,
        comments: 10,
        downloads: 4
      }
    ]
  } else {
    // 公共版时清空数据
    communicationInfo.value = null
    similarDocuments.value = []
    similarCommunications.value = []
  }
}

const handlePptDialogClose = () => {
  // 对话框关闭时的清理工作
  dialogVisible.value = false
}

const handlePdfDialogClose = () => {
  // PDF对话框关闭时的清理工作
  pdfDialogVisible.value = false
  pdfDialogTitle.value = ''
  pdfDialogUrl.value = ''
  pdfDialogUpdateDate.value = ''
}

// 实战版相关数据
const communicationInfo = ref(null)
const similarDocuments = ref([])
const similarCommunications = ref([])

const responseTocSections = [
  {
    title: '一、商务基础类',
    items: [
      '文件头部',
      '法定代表人身份证明',
      '法定代表人授权委托书',
      '投标人基本情况表',
      '资格审查资料',
      '投标保证金缴纳凭证',
      '公司资质证书',
      '类似项目业绩',
      '项目团队',
      '投标报价'
    ]
  },
  {
    title: '二、技术方案类',
    items: [
      '项目理解',
      '总体技术方案',
      '详细功能方案',
      '实施方案',
      '项目管理方案',
      '售后运维服务方案',
      '培训方案'
    ]
  },
  {
    title: '三、投标响应类',
    items: [
      '评分索引表',
      '投标函',
      '偏离表',
      '承诺函'
    ]
  }
]

const responseTocFlat = responseTocSections.flatMap(section =>
  section.items.map(title => ({ section: section.title, title }))
)

const responseIndex = (title) => responseTocFlat.findIndex(t => t.title === title)

const openVideo = (item) => {
  currentVideo.value = item
  videoDialogVisible.value = true
}

const toggleQa = (qaId) => {
  if (expandedQaId.value === qaId) {
    expandedQaId.value = null
  } else {
    expandedQaId.value = qaId
  }
}

// 左侧模块独立展开/收起
const toggleLeftQa = (qaId) => {
  if (expandedLeftQaId.value === qaId) {
    expandedLeftQaId.value = null
  } else {
    expandedLeftQaId.value = qaId
  }
}

// 右侧列表模块独立展开/收起
const toggleRightListQa = (qaId) => {
  if (expandedRightListQaId.value === qaId) {
    expandedRightListQaId.value = null
  } else {
    expandedRightListQaId.value = qaId
  }
}

// 最新模块独立展开/收起
const toggleLatestQa = (qaId) => {
  if (expandedLatestQaId.value === qaId) {
    expandedLatestQaId.value = null
  } else {
    expandedLatestQaId.value = qaId
  }
}

const scrollToSlide = (i) => {
  nextTick(() => {
    const el = document.querySelector(`.ppt-view-list .ppt-view-item:nth-child(${i + 1})`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

const chooseSlide = (i) => { 
  activeSlide.value = i 
  scrollToSlide(i)
}

const toggleSlideSelection = (i) => {
  const index = selectedSlides.value.indexOf(i)
  if (index > -1) {
    selectedSlides.value.splice(index, 1)
  } else {
    selectedSlides.value.push(i)
  }
}

const toggleResponseItem = (title) => {
  const idx = responseIndex(title)
  if (idx < 0) return
  if (wordTocMode.value === 'multi') {
    toggleSlideSelection(idx)
    activeSlide.value = idx
    scrollToSlide(idx)
  } else {
    selectedSlides.value = []
    chooseSlide(idx)
  }
}

const openAiPanel = () => {
  aiPanelVisible.value = true
}

const closeAiPanel = () => {
  aiPanelVisible.value = false
}

const analyzeSelectedSlide = () => {
  const targetIndex = selectedSlides.value.length ? selectedSlides.value[0] : activeSlide.value
  activeSlide.value = targetIndex
  aiPanelVisible.value = true
}

const openAiPpt = () => {
  router.push('/ai-ppt')
}

// 产品目录数据
const productCatalog = [
  { id: '1', text: '企业基本信息', children: [
    { id: '1.1', text: '公司简介' },
    { id: '1.2', text: '技术体系' },
    { id: '1.3', text: '业务体系' },
    { id: '1.4', text: '监管合作' },
    { id: '1.5', text: '机构合作' }
  ]},
  { id: '2', text: '监管发文与背景分析', children: [
    { id: '2.1', text: '行业监管发展' },
    { id: '2.2', text: '监管要求' },
    { id: '2.3', text: '客户痛点/难点' }
  ]},
  { id: '3', text: '产品解决方案', children: [
    { id: '3.1', text: '解决方案概述' },
    { id: '3.2', text: '产品架构设计' },
    { id: '3.3', text: '产品功能详解' },
    { id: '3.4', text: 'Demo与交互演示' },
    { id: '3.5', text: '产品优势说明' },
    { id: '3.6', text: '产品应用场景' }
  ]},
  { id: '4', text: '实施计划', children: [
    { id: '4.1', text: '软硬件资源需求' },
    { id: '4.2', text: '实施服务流程' },
    { id: '4.3', text: '联调安排' },
    { id: '4.4', text: '售后服务保障' }
  ]},
  { id: '5', text: '合作案例', children: [] }
]

// 公共版PPT数据
const publicPPTData = ref([])
// 实战版PPT数据
const practicalPPTData = ref([])

// 目录选择相关
const activeCatalogIds = ref([])
const catalogMode = ref('single') // 'single' 或 'multiple'
const selectedParentIds = ref([]) // 多选模式下选中的一级目录

const isCatalogSelected = (catId) => {
  return activeCatalogIds.value.includes(catId)
}

const isParentSelected = (parentId) => {
  if (catalogMode.value !== 'multiple') return false
  const parent = productCatalog.find(p => p.id === parentId)
  if (!parent) return false
  return parent.children.every(child => activeCatalogIds.value.includes(child.id))
}

const toggleParentCatalog = (parentId) => {
  if (catalogMode.value !== 'multiple') return
  const parent = productCatalog.find(p => p.id === parentId)
  if (!parent) return
  
  const allSelected = parent.children.every(child => activeCatalogIds.value.includes(child.id))
  if (allSelected) {
    // 取消选择该一级目录下的所有二级目录
    activeCatalogIds.value = activeCatalogIds.value.filter(id => 
      !parent.children.some(child => child.id === id)
    )
  } else {
    // 选择该一级目录下的所有二级目录
    const childIds = parent.children.map(child => child.id)
    activeCatalogIds.value = [...new Set([...activeCatalogIds.value, ...childIds])]
  }
  updateProductContent()
}

const toggleCatalog = (catId) => {
  if (catalogMode.value !== 'multiple') return
  if (activeCatalogIds.value.includes(catId)) {
    activeCatalogIds.value = activeCatalogIds.value.filter(id => id !== catId)
  } else {
    activeCatalogIds.value = [...activeCatalogIds.value, catId]
  }
  updateProductContent()
}

const selectCatalog = (catId) => {
  if (catalogMode.value === 'single') {
    // 单选模式：只能选择一个
    activeCatalogIds.value = catId ? [catId] : []
  } else {
    // 多选模式：可以多选
    toggleCatalog(catId)
  }
  updateProductContent()
}

const generateSlides = (seed, count) => Array.from({length: count}, (_, i) => ({
  id: seed + '_' + i,
  img: `https://picsum.photos/seed/${seed}${i}/320/180`,
  page: i + 1
}))

const updateProductContent = () => {
  if (!activeProduct.value) return
  
  const ids = activeCatalogIds.value
  const isOverview = ids.length === 0

  if (isOverview) {
    publicPPTData.value = productCatalog.map(c => ({
      id: 'pub_L1_' + c.id,
      title: `${c.id} ${c.text} (标准拆分版)`,
      date: '2025-10-31',
      author: '公共库',
      type: 'ppt-cover',
      thumbnail: `https://picsum.photos/seed/pub_cover_${c.id}/320/180`
    }))

    practicalPPTData.value = [
      { id: 'file_bh', title: '渤海银行一表通售前交流.ppt', date: '2025-10-28', author: '王总', type: 'file' },
      { id: 'file_cz', title: '沧州银行一表通售前交流.ppt', date: '2025-10-26', author: '刘经理', type: 'file' },
      { id: 'file_zs', title: '招商银行一表通售前交流.ppt', date: '2025-10-24', author: '陈工', type: 'file' },
      { id: 'file_dy', title: '第一银行上海一表通售前交流.ppt', date: '2025-10-20', author: '张工', type: 'file' }
    ]
  } else {
    publicPPTData.value = []
    const practicalMap = new Map()

    ids.forEach(catId => {
      publicPPTData.value.push({ 
        id: 'pb_detail_' + catId, 
        title: `${activeProduct.value} 标准介绍 - ${catId}`, 
        date: '10-31', 
        author: '标准化小组',
        type: 'slides', 
        slides: generateSlides('pb_det_' + catId, 3) 
      })

      const addToMap = (customer, item) => {
        if (!practicalMap.has(customer)) practicalMap.set(customer, [])
        practicalMap.get(customer).push(item)
      }

      addToMap('某国有大行', {
        id: 'pc1_' + catId, 
        title: `${activeProduct.value} 汇报 - ${catId} 相关页`, 
        date: '10-25', 
        author: '赵总',
        type: 'slides',
        slides: generateSlides('pc1_' + catId, 2)
      })

      addToMap('某农商行', {
        id: 'pc2_' + catId, 
        title: `${activeProduct.value} 方案 - ${catId} 相关页`, 
        date: '10-22', 
        author: '李工',
        type: 'slides',
        slides: generateSlides('pc2_' + catId, 1)
      })
    })

    practicalPPTData.value = Array.from(practicalMap.entries()).map(([customer, items]) => {
      const first = items && items.length ? items[0] : null
      const meta = first ? `${first.date} · ${first.author}` : ''
      return { customer, items, meta }
    })
  }
}

// 合并所有选择的二级目录的图片（公共版）
const mergedSlides = computed(() => {
  if (activeCatalogIds.value.length <= 1) return []
  const allSlides = []
  publicPPTData.value.forEach(p => {
    if (p.type === 'slides' && p.slides) {
      p.slides.forEach(slide => {
        allSlides.push({
          ...slide,
          parent: p // 保存父级信息，用于点击时打开
        })
      })
    }
  })
  return allSlides
})

// 合并某个机构的所有图片（实战版）
const getMergedSlidesForGroup = (group) => {
  if (activeCatalogIds.value.length <= 1) return []
  const allSlides = []
  group.items.forEach(p => {
    if (p.type === 'slides' && p.slides) {
      p.slides.forEach(slide => {
        allSlides.push({
          ...slide,
          parent: p // 保存父级信息，用于点击时打开
        })
      })
    }
  })
  return allSlides
}

const openPractical = (item) => {
  // 打开实战版PPT
  if (item.type === 'file') {
    openPpt({ id: item.id, title: item.title, thumbnail: '', tag: '实战版' })
  } else {
    openPpt(item)
  }
}

// 监听activeProduct变化，更新内容
watch(activeProduct, (newVal) => {
  if (newVal) {
    activeCatalogIds.value = []
    updateProductContent()
  } else {
    publicPPTData.value = []
    practicalPPTData.value = []
  }
})

// 监听模式切换，清空选择
watch(catalogMode, () => {
  activeCatalogIds.value = []
  selectedParentIds.value = []
  updateProductContent()
})

const getBrandTabName = (tab) => {
  const names = {
    'company': '公司介绍',
    'products': '产品合集',
    'regulations': '制度解读',
    'calendar': '台历',
    'compliance': '监管合规',
    'general': '泛监管',
    'xinchuang': '协同信创',
    'local': '地方金融监管',
    'bill': '金融票据业务'
  }
  return names[tab] || ''
}

const getProductNumberColor = (index) => {
  // 前三个序号标签使用特定颜色
  if (index === 0) return '#E02020' // 红色
  if (index === 1) return '#FA6400' // 橙色
  if (index === 2) return '#F7B500' // 黄色
  // 后面的都使用统一的灰蓝色
  return '#DDEAFF'
}

// 格式化浏览量
const formatViews = (views) => {
  if (views >= 10000) {
    return (views / 10000).toFixed(1) + '万'
  }
  return views.toString()
}

// 计算答案字数
const getAnswerWordCount = (answer) => {
  if (!answer) return 0
  // 计算中文字符和英文单词
  const chineseChars = (answer.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = answer.replace(/[\u4e00-\u9fa5]/g, '').trim().split(/\s+/).filter(w => w.length > 0).length
  return chineseChars + englishWords
}

// 处理点赞
const handleLike = (qaId) => {
  const question = questions.find(q => q.id === qaId)
  if (!question) return

  if (question.userLiked) {
    question.userLiked = false
    if (question.likes > 0) question.likes--
  } else {
    question.userLiked = true
    question.likes++
    if (question.userDisliked) {
      question.userDisliked = false
      if (question.dislikes > 0) question.dislikes--
    }
  }
}

// 处理点踩
const handleDislike = (qaId) => {
  const question = questions.find(q => q.id === qaId)
  if (!question) return

  if (question.userDisliked) {
    question.userDisliked = false
    if (question.dislikes > 0) question.dislikes--
  } else {
    question.userDisliked = true
    question.dislikes++
    if (question.userLiked) {
      question.userLiked = false
      if (question.likes > 0) question.likes--
    }
  }
}
</script>

<style scoped>

</style>

