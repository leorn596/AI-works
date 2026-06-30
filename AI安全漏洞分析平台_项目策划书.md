# AI Web 安全漏洞报告与分析平台 — 项目策划书

---

## 第1章：项目目标

构建一个 **AI驱动的Web安全漏洞智能分析平台**，核心能力覆盖：
- 三种漏洞信息输入方式（目标URL扫描 / 粘贴扫描报告 / 手动描述）
- AI自动分析漏洞原理与影响范围、评估风险等级（参照CVSS 3.1标准）
- 生成详细的漏洞分析报告与修复方案、安全加固清单
- 前端可视化仪表盘，支持多类型图表交互联动

---

## 第2章：需求分析

### 2.1 用户角色定义

| 角色 | 说明 |
|------|------|
| **安全分析人员** | 平台核心用户，输入漏洞信息、查看分析报告、管理任务 |
| **开发运维人员** | 查看分配漏洞列表、获取修复方案、标记修复状态 |
| **系统管理员** | 管理系统配置、查看平台运行状态 |

### 2.2 功能需求

| 编号 | 功能 | 说明 |
|------|------|------|
| F-01 | 漏洞输入 | 支持三种方式：目标URL扫描、粘贴扫描报告、手动描述漏洞现象 |
| F-02 | AI漏洞分析与修复 | AI分析漏洞原理与影响范围、评估风险等级（CVSS）、生成修复方案 |
| F-03 | CVSS风险评级 | 参考CVSS 3.1标准，自动计算基础分/时间分/环境分 |
| F-04 | 图表交互联动 | 点击图表某类漏洞，AI分析区展示该类漏洞的详细报告 |
| F-05 | 漏洞分析历史记录 | MySQL存储，支持按时间/类型回看历史分析 |
| F-06 | AI生成安全加固清单 | 按优先级排序的操作步骤CheckList |
| F-07 | 多源对比分析 | 同一目标，同时分析OWASP ZAP与Nmap扫描结果并交叉验证 |
| F-08 | 图表导出 | 图表可导出为图片/PDF报告 |
| F-09 | 可视化仪表盘 | 前端展示漏洞分布（按类型/严重程度/时间趋势） |
| F-10 | 交互筛选 | 支持按漏洞类型、严重程度、时间范围多维度筛选与联动 |

### 2.3 技术要点（前端重点）

| 编号 | 要点 | 说明 |
|------|------|------|
| T-01 | 图表库深度集成 | ECharts / Chart.js，绘制饼图、柱状图、雷达图等多类型图表 |
| T-02 | 前端文件解析与数据清洗 | 扫描报告（ZAP/Nmap JSON/XML）上传后本地预处理 |
| T-03 | 图表交互事件监听 | ECharts click事件捕获漏洞类型，向AI分析区传递做深度分析 |
| T-04 | 响应式双栏/三栏自适应布局 | CSS Grid/Flexbox，按屏幕宽度切换布局模式 |
| T-05 | 异步状态管理 | 分析中的Loading态、ErrorBoundary错误处理 |

### 2.4 非功能需求

- 单次漏洞分析响应时间 ≤ 10s
- 前端图表渲染支持 ≥ 1000条漏洞数据
- CVSS评分准确度对标主流漏洞数据库
- **界面布局**：左侧漏洞列表与图表区，右侧AI详细分析区

### 2.5 用例场景

- **场景一（安全工程师）**：提交URL → AI扫描分析 → 仪表盘展示交互图表 → 点击图表分类联动AI深度分析 → 导出报告
- **场景二（运维人员）**：收到报告 → 筛选高危漏洞 → 查看修复方案与安全加固清单 → 标记已修复
- **场景三（多源对比）**：同时上传ZAP和Nmap结果 → AI交叉验证 → 生成综合报告

---

## 第3章：系统架构设计

### 3.1 总体架构分层

```
┌─────────────────────────────────────────┐
│          展示层 (Frontend)               │
│  React/Vue + ECharts 可视化仪表盘        │
│  双栏/三栏自适应布局                      │
├─────────────────────────────────────────┤
│          业务层 (Backend Service)        │
│  Node.js/Python — 请求路由/AI调度/聚合    │
├─────────────────────────────────────────┤
│          AI分析层 (AI Engine)            │
│  大模型API — 特征提取/CVSS评分/修复方案   │
├─────────────────────────────────────────┤
│          数据层 (Data Layer)             │
│  MySQL(历史) + Redis(缓存) + 文件存储     │
└─────────────────────────────────────────┘
```

### 3.2 核心数据流

- **输入流**：URL / 扫描文件 / 手动输入 → 前端解析清洗 → 后端转发 → AI分析 → 结果回写
- **联动流**：图表点击事件 → 捕获分类参数 → 请求AI深度分析 → 右侧面板更新
- **存储流**：分析结果 → MySQL持久化 → 历史查询 → 按时间/类型检索

### 3.3 AI分析引擎模块

| 模块 | 功能 |
|------|------|
| 漏洞特征提取 | 从非结构化输入中提取漏洞属性（类型、影响范围、攻击向量） |
| CVSS评分推理 | 参考CVSS 3.1向量公式，推断各指标值并计算评分 |
| 修复方案生成 | 按漏洞类型+严重程度生成对应修复措施 |
| 多源交叉验证 | 比对ZAP vs Nmap结果，去重/增强/冲突标记 |

### 3.4 前端架构重点

- **图表组件**：ECharts饼图（类型分布）、柱状图（严重程度）、雷达图（多维度）、折线图（时间趋势）
- **交互联动**：Event Bus管理图表↔AI面板的数据传递
- **布局组件**：响应式双栏（默认）/ 三栏（历史对比），CSS Grid/Flexbox
- **状态管理**：Redux/Pinia管理Loading/Error/数据状态

### 3.5 接口设计（RESTful API）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/analyze/url` | URL扫描分析 |
| POST | `/api/analyze/report` | 上传扫描报告 |
| POST | `/api/analyze/manual` | 手动描述漏洞 |
| POST | `/api/analyze/multi-source` | 多源对比分析 |
| GET | `/api/history` | 历史记录查询（时间/类型筛选） |
| GET | `/api/report/:id` | 获取详细漏洞报告 |
| GET | `/api/report/:id/export` | 导出PDF报告 |

---

## 第4章：前端详细设计 ⭐

### 4.1 整体布局结构

- **默认双栏**：左侧 漏洞列表 + 图表区 / 右侧 AI详细分析面板
- **三栏（历史对比）**：左侧 历史列表 / 中间 图表区 / 右侧 分析面板
- **响应式断点**：≥1200px 三栏 / 768–1199px 双栏 / <768px 单栏

### 4.2 组件树结构

```
App
├── LayoutContainer（自适应布局外壳）
│   ├── LeftPanel
│   │   ├── InputSection（URL输入 / 文件上传 / 手动描述）
│   │   ├── VulnerabilityList（漏洞列表，支持筛选排序）
│   │   └── ChartArea
│   │       ├── PieChart（漏洞类型分布饼图）
│   │       ├── BarChart（严重程度柱状图）
│   │       ├── RadarChart（多维度雷达图）
│   │       └── TrendChart（时间趋势折线图）
│   └── RightPanel
│       ├── AIDetailAnalysis（AI分析详情区）
│       ├── RemediationChecklist（安全加固清单）
│       └── ExportActions（导出图片/PDF按钮）
└── HistoryDrawer（历史记录侧边抽屉）
```

### 4.3 图表交互联动机制

- **事件驱动**：ECharts `click` 事件监听 → 提取系列名/类目 → 通过Event Bus传递给右侧面板
- **联动流程**：点击饼图某漏洞类型 → 左侧列表自动筛选该类型 → 右侧AI面板请求深度分析 → 展示详细报告
- **跨图表联动**：点击柱状图某等级 → 饼图高亮对应部分，互为筛选条件

### 4.4 文件解析与数据清洗

- **支持格式**：JSON（ZAP/Nmap导出）、XML（ZAP报告）、HTML（Nmap格式）
- **解析方式**：FileReader + 自定义Parser（提取IP、端口、漏洞名称、风险等级、CVE编号）
- **清洗规则**：去重、标准化字段名、补全缺失严重程度、合并同类漏洞

### 4.5 异步状态管理

- 统一状态层：`idle → loading → success | error`
- **Loading态**：骨架屏 + 进度条（图表加载 / AI分析中）
- **ErrorBoundary**：组件级错误捕获，降级显示 + 重试按钮
- **典型流程**：上传文件 → 前端解析（本地loading）→ 请求AI分析（远程loading）→ 渲染结果

### 4.6 图表导出功能

- **图片导出**：ECharts `getDataURL()` 获取base64 → 触发下载
- **PDF导出**：`html2canvas` 截图 + `jsPDF` 拼接 → 生成含图表和分析报告的PDF文档

---

## 第5章：后端详细设计

### 5.1 技术栈选型

| 组件 | 选型 |
|------|------|
| 后端框架 | Python FastAPI 或 Node.js Express |
| 数据库 | MySQL 8.x |
| 缓存 | Redis |
| 文件存储 | 本地文件系统 / 对象存储 |
| AI模型接入 | OpenAI API / 本地模型 / 国产大模型（统一接口封装） |

### 5.2 AI分析服务模块

**5.2.1 大模型接入层**
- 统一LLM接口，支持多模型切换
- Prompt模板库：按漏洞类型动态组装（SQL注入/XSS/SSRF等）
- 流式响应支持（SSE）：分析结果逐段推送到前端

**5.2.2 漏洞分析Pipeline**
```
输入 → 意图识别 → 特征提取 → 漏洞分类
→ CVSS向量生成 → 风险评级 → 修复方案生成 → 结果格式化
```

**5.2.3 CVSS评分引擎**
- 解析CVSS 3.1向量字符串（如 `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`）
- 根据漏洞特征自动推断CVSS参数
- 输出评分（0–10）+ 严重程度等级

### 5.3 多源对比分析模块

- 接收ZAP和Nmap两份扫描结果
- 交叉匹配规则：CVE编号 / 端口+服务名 / 漏洞名称相似度
- 输出矩阵：ZAP独有 / Nmap独有 / 双方一致 / 冲突项

### 5.4 历史记录与查询服务

- 查询接口：支持分页、时间范围筛选、漏洞类型筛选、全文检索
- 对比模式：选中两条历史记录 → 并排展示差异

### 5.5 报告导出服务

- PDF生成：后端 WeasyPrint / Puppeteer 渲染HTML模板 → 输出PDF
- 内容组织：漏洞总览 → 详细分析（含图表）→ 安全加固清单

---

## 第6章：数据库设计

### 6.1 核心实体

| 实体 | 说明 |
|------|------|
| `analysis_task` | 分析任务（一次URL/文件/手动分析） |
| `vulnerability` | 漏洞条目（一次任务含多个漏洞） |
| `remediation_checklist` | 安全加固清单项 |

### 6.2 核心表结构

**`analysis_task`**
```
id              BIGINT PK AUTO_INCREMENT
target_url      VARCHAR(1024)       — 目标URL
source_type     ENUM('url','file','manual','multi')
input_content   TEXT                — 原始输入
status          ENUM('pending','analyzing','done','failed')
cvss_overall    DECIMAL(3,1)        — 整体最高CVSS评分
summary         TEXT                — AI生成总览摘要
report_pdf      VARCHAR(512)        — PDF文件路径
created_at      DATETIME
updated_at      DATETIME
```

**`vulnerability`**
```
id              BIGINT PK AUTO_INCREMENT
task_id         BIGINT FK → analysis_task.id
vuln_name       VARCHAR(256)        — 漏洞名称
vuln_type       VARCHAR(64)         — 类型（SQLi/XSS/SSRF...）
severity        ENUM('none','low','medium','high','critical')
cvss_vector     VARCHAR(64)         — CVSS 3.1向量
cvss_score      DECIMAL(3,1)
description     TEXT                — 漏洞原理与影响范围
remediation     TEXT                — 修复方案
cve_id          VARCHAR(32)         — CVE编号
source          VARCHAR(32)         — 「zap」「nmap」「ai-identify」
created_at      DATETIME
```

**`remediation_checklist`**
```
id              BIGINT PK AUTO_INCREMENT
task_id         BIGINT FK
priority        TINYINT             — 1(紧急)~5(建议)
category        VARCHAR(64)         — 配置/代码/网络/权限
step_title      VARCHAR(256)
step_detail     TEXT
is_done         BOOLEAN DEFAULT FALSE
sort_order      INT
```

### 6.3 索引策略

- `analysis_task`：`(created_at)`, `(source_type)`
- `vulnerability`：`(task_id)`, `(vuln_type)`, `(severity)`, `(cve_id)`
- 联合索引：`(task_id, severity)`, `(severity, vuln_type)`

### 6.4 Redis 缓存设计

| Key | 用途 |
|-----|------|
| `task:{id}:progress` | 分析进度（百分比+当前阶段） |
| `task:{id}:result_cache` | 分析结果实时缓存（供图表快速渲染） |
| `cvss:vector:{hash}` | CVSS评分结果缓存 |

---

---

*策划书完。文件已保存至工作区。*
