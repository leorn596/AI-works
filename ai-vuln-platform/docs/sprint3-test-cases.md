# Sprint 3 测试用例

> 版本: v1.0 | 日期: 2026-06-30 | QA Agent: robot01  
> 覆盖: US-17 ~ US-24 (Sprint 3 Event Bus + 新图表 + 交互联动 + 布局)

---

## 测试概览

| 测试类别 | 用例数 | 覆盖范围 |
|---------|-------|---------|
| Event Bus (US-19) | 12 | 发布/订阅/取消订阅/顺序/异常隔离/内存泄漏 |
| 图表点击 → AI 深度分析 (US-17) | 8 | Event Bus → AI 面板联动全链路 |
| 跨图表联动筛选 (US-18) | 10 | PieClick→BarFilter / BarClick→PieFilter / 重置 |
| 雷达图多维指标 (US-20) | 8 | 渲染/数据正确性/axis数量/空状态/零数据 |
| 折线图时间趋势 (US-21) | 8 | 渲染/X轴时间/空数据/零数据/多系列 |
| 图表维度筛选器 (US-22) | 7 | 下拉选项/联动/重置/级联 |
| 空状态 & 零数据 (US-23) | 10 | 雷达图/折线图/饼图/柱状图/全场景覆盖 |
| 三栏布局自适应 (US-24) | 8 | lg断点/ResizeObserver/图表resize/全屏切换 |
| 集成 & 边界 | 5 | 全链路联动/内存泄漏/极端数据 |
| **合计** | **76** | US-17 ~ US-24 |

---

## 一、US-19: Event Bus 事件总线

> **基线说明:** 当前 ChartArea.jsx 中点击饼图/柱状图直接通过 Redux `dispatch(selectVulnerability(matched))` 与 AIDetailAnalysis 耦合。Sprint 3 需引入 Event Bus 解耦组件通信。

### [TC-1901] Event Bus 单例模式验证
- **Story:** US-19
- **Steps:**
  1. 在 console 执行 `const bus1 = new EventBus()` `const bus2 = new EventBus()`
  2. 验证 `bus1 === bus2`
- **Expected:** EventBus 为单例，多次实例化返回同一引用
- **Result:** PENDING

### [TC-1902] 基本发布/订阅 — 同一事件
- **Story:** US-19
- **Steps:**
  1. 订阅事件 `'chart:click'`，回调记录被调用次数
  2. 发布 `'chart:click'` 3 次，发布 `'other:event'` 1 次
- **Expected:**
  - `'chart:click'` 回调被调用 3 次
  - `'other:event'` 不触发 `'chart:click'` 回调
- **Result:** PENDING

### [TC-1903] 基本发布/订阅 — payload 传递
- **Story:** US-19
- **Steps:**
  1. 订阅 `'chart:click'`，回调接收参数 `(payload) => captured.push(payload)`
  2. 发布 `'chart:click', { type: 'pie', value: 'SQLi' }`
- **Expected:** `captured[0]` 精确等于 `{ type: 'pie', value: 'SQLi' }`（值相等）
- **Result:** PENDING

### [TC-1904] 多订阅者 — 同一事件
- **Story:** US-19
- **Steps:**
  1. 两个独立组件分别订阅 `'chart:click'`
  2. 发布 `'chart:click'` 1 次
- **Expected:** 两个订阅者的回调各被调用 1 次，顺序与注册顺序一致
- **Result:** PENDING

### [TC-1905] 取消订阅（unsubscribe）
- **Story:** US-19
- **Steps:**
  1. 订阅 `'chart:click'`，保存返回的取消函数
  2. 调用取消函数
  3. 再次发布 `'chart:click'`
- **Expected:** 取消后回调不再被调用；其他未取消的订阅者仍正常收到事件
- **Result:** PENDING

### [TC-1906] 取消特定订阅不影响其他
- **Story:** US-19
- **Steps:**
  1. 注册两个不同回调 handlerA / handlerB 到同一事件
  2. 取消 handlerA 的订阅
  3. 发布事件
- **Expected:** handlerA 不触发，handlerB 正常触发
- **Result:** PENDING

### [TC-1907] 组件卸载时自动取消订阅 (useEffect cleanup)
- **Story:** US-19
- **Steps:**
  1. 组件挂载时订阅 `'chart:click'`
  2. 模拟组件卸载（通过条件渲染切换）
  3. 发布 `'chart:click'`
- **Expected:** 卸载后回调不被调用；console 无 "Can't perform a React state update on an unmounted component" 警告
- **Result:** PENDING

### [TC-1908] 发布不存在的事件不报错
- **Story:** US-19
- **Steps:**
  1. 不注册任何 `'nonexistent'` 订阅
  2. 发布 `'nonexistent'`
- **Expected:** 静默成功，无报错，无 console error
- **Result:** PENDING

### [TC-1909] 订阅回调异常隔离
- **Story:** US-19
- **Steps:**
  1. 注册 handlerA（正常）、handlerB（内部 throw Error）
  2. 发布事件
- **Expected:**
  - handlerA 正常执行
  - handlerB 异常被 EventBus catch，不阻断 handlerA
  - console 应有 error 日志（可选）
- **Result:** PENDING

### [TC-1910] 内存泄漏 — 多次 subscribe/unsubscribe 无残留
- **Story:** US-19
- **Steps:**
  1. 循环 1000 次：订阅然后立即取消
  2. 发布事件
- **Expected:** 无订阅者被调用，EventBus 内部 listeners 为空，内存无显著增长
- **Result:** PENDING

### [TC-1911] 事件命名规范验证
- **Story:** US-19
- **Steps:**
  1. 检查源码中所有 `EventBus.subscribe()` 调用
  2. 检查事件名格式
- **Expected:** 事件名遵循 `'domain:action'` 格式（如 `'chart:click'`, `'chart:filter'`, `'analysis:select'`），无裸字符串
- **Result:** PENDING

### [TC-1912] 同一回调重复订阅去重
- **Story:** US-19
- **Steps:**
  1. 同一函数引用注册两次到同一事件
  2. 发布事件 1 次
- **Expected:** 回调只被调用 1 次（去重）或文档明确声明重复注册行为
- **Result:** PENDING


---

## 二、US-17: 点击图表触发 AI 深度分析

> **基线说明:** 当前点击饼图/柱状图通过 `dispatch(selectVulnerability())` 切换右侧 AI 面板详情。Sprint 3 需改为通过 Event Bus 发布 `'chart:click'` 事件，由 AIDetailAnalysis 或其他组件订阅并触发 AI 深度分析。

### [TC-1701] 饼图点击 → Event Bus → AI 面板联动
- **Story:** US-17
- **Steps:**
  1. 加载有数据的漏洞列表（≥3 种类型）
  2. 点击饼图中 "SQL 注入" 扇区
  3. 观察 Event Bus 是否发布 `'chart:click'` 事件
  4. 观察 AI 分析面板是否更新为 SQL 注入相关漏洞详情
- **Expected:**
  - Event Bus 收到 `{ source: 'pie', vulnType: 'SQL 注入', matchedVuln: {...} }` 事件
  - AIDetailAnalysis 展示该类型的第一个漏洞详情
  - 列表联动高亮（VulnerabilityList 中对应项高亮）
- **Result:** PENDING

### [TC-1702] 柱状图点击 → Event Bus → AI 面板联动
- **Story:** US-17
- **Steps:**
  1. 加载数据，点击柱状图 "高危" 柱子
  2. 观察联动行为
- **Expected:**
  - Event Bus 收到 `{ source: 'bar', severity: '高危', matchedVuln: {...} }` 事件
  - AI 面板更新为第一个 CVSS≥7 的漏洞详情
- **Result:** PENDING

### [TC-1703] 雷达图点击 → Event Bus → AI 面板联动 (Sprint 3 新图表)
- **Story:** US-17
- **Steps:**
  1. 点击雷达图某个数据点
  2. 观察 Event Bus 事件
- **Expected:** Event Bus 发布 `'chart:click'`，AIDetailAnalysis 收到并展示对应漏洞
- **Result:** PENDING

### [TC-1704] 折线图点击 → Event Bus → AI 面板联动 (Sprint 3 新图表)
- **Story:** US-17
- **Steps:**
  1. 点击折线图某个时间点
  2. 观察 Event Bus 事件
- **Expected:** Event Bus 发布 `'chart:click'`，AIDetailAnalysis 收到并展示该时间点对应的漏洞
- **Result:** PENDING

### [TC-1705] AI 深度分析触发验证 — 非简单 Redux select
- **Story:** US-17
- **Steps:**
  1. 点击图表 → 检查是否仅通过 Redux `selectVulnerability` 做展示切换
  2. 检查是否有 AI 深度分析请求（如请求 /api/analyze/deep 端点）
- **Expected:**
  - 区别于 Sprint 2 的简单详情展示
  - 触发实际的 AI API 调用（如深度分析、关联漏洞推荐、攻击路径生成等）
  - 分析面板出现新内容块（深度分析/关联漏洞/修复建议/AI 交互区域等）
- **Result:** PENDING

### [TC-1706] AI 深度分析 Loading 状态
- **Story:** US-17
- **Steps:**
  1. 点击图表触发 AI 深度分析
  2. 在 API 返回前观察面板状态
- **Expected:**
  - 面板显示 Loading / Skeleton / "正在分析…" 提示
  - 图表点击处有视觉反馈（如高亮、加载指示器）
  - 不阻塞其他图表交互
- **Result:** PENDING

### [TC-1707] AI 深度分析 Error 状态
- **Story:** US-17
- **Steps:**
  1. Mock API 返回 500 或网络错误
  2. 点击图表触发分析
- **Expected:**
  - 面板显示错误提示 + 重试按钮
  - Event Bus 不崩坏，后续事件仍正常
  - Console 无未捕获异常
- **Result:** PENDING

### [TC-1708] 快速连续点击 — 请求竞态处理
- **Story:** US-17
- **Steps:**
  1. 快速连续点击饼图 3 个不同扇区
  2. 观察 AI 面板最终展示
- **Expected:**
  - 面板展示最后一次点击对应的分析结果（最新请求胜出）
  - 不出现前两次的结果覆盖最新结果
  - 中途请求应 Abort 或被忽略
  - 无 React state update on unmounted 警告
- **Result:** PENDING


---

## 三、US-18: 跨图表联动筛选

> **基线说明:** 当前 PieChart 和 BarChart 独立渲染，点击各自仅影响 AI 面板。Sprint 3 需实现跨图联动：点击饼图某类型 → 柱状图仅显示该类型的严重程度分布；点击柱状图某严重等级 → 饼图高亮对应扇区。

### [TC-1801] 饼图点击 → 柱状图数据过滤
- **Story:** US-18
- **Steps:**
  1. 数据包含多种类型（SQLi=5, XSS=3, CSRF=2）
  2. 点击饼图 "SQL 注入" 扇区
  3. 观察柱状图变化
- **Expected:**
  - 柱状图仅展示 SQL 注入类型的严重程度分布
  - 柱状图标题/副标题标注 "筛选: SQL 注入"
  - 饼图 SQL 注入扇区高亮，其他扇区变灰/降低透明度
- **Result:** PENDING

### [TC-1802] 柱状图点击 → 饼图数据过滤
- **Story:** US-18
- **Steps:**
  1. 点击柱状图 "高危" 柱子
  2. 观察饼图变化
- **Expected:**
  - 饼图仅展示 CVSS≥7 的漏洞类型分布
  - 饼图副标题标注 "筛选: 高危 (CVSS≥7)"
  - 柱状图高危柱子高亮
- **Result:** PENDING

### [TC-1803] 雷达图点击 → 饼图 + 柱状图联动
- **Story:** US-18
- **Steps:**
  1. 雷达图展示多个漏洞的 CVSS 维度（Base/Impact/Exploitability）
  2. 点击雷达图某个漏洞节点
- **Expected:**
  - 饼图按类型分布应高亮该漏洞类型对应的扇区
  - 柱状图按严重程度高亮该漏洞严重等级对应的柱子
  - 所有联动通过 Event Bus 统一分发
- **Result:** PENDING

### [TC-1804] 折线图时间点选中 → 饼图 + 柱状图联动
- **Story:** US-18
- **Steps:**
  1. 折线图展示每日漏洞趋势
  2. 点击某个有数据的时间点
- **Expected:**
  - 饼图/柱状图数据切换到该时间点的漏洞统计
  - 不当时刻数据被过滤
- **Result:** PENDING

### [TC-1805] 筛选状态可视化 — 高亮/灰显
- **Story:** US-18
- **Steps:**
  1. 点击饼图 SQLi → 观察所有图表的视觉状态
  2. 再次点击同一扇区取消筛选 → 观察变化
- **Expected:**
  - 筛选时：选中项高亮，未选中项降低透明度（0.3~0.5）
  - 取消筛选时：所有项恢复正常透明度
  - 图表间同步切换（饼图/柱状图/雷达图/折线图）
- **Result:** PENDING

### [TC-1806] 重置筛选 — 恢复到全量数据
- **Story:** US-18
- **Steps:**
  1. 依次点击饼图 SQLi → 柱状图高危，形成级联筛选
  2. 点击 "重置筛选" 按钮（或清除所有筛选条件）
- **Expected:**
  - 所有图表恢复到全量数据
  - Event Bus 发布 `'chart:filter'` 事件 payload 为 `{ filter: null }`
  - 所有高亮/灰显状态重置
  - AIDetailAnalysis 也恢复默认状态
- **Result:** PENDING

### [TC-1807] 跨图表筛选 — Event Bus 流量验证
- **Story:** US-18
- **Steps:**
  1. 在 console 中同时监听 `'chart:filter'` 和 `'chart:click'` 事件
  2. 点击饼图 SQLi
  3. 记录 Event Bus 发布的事件序列
- **Expected:**
  - 先发布 `'chart:click'`（点击事件）
  - 后发布 `'chart:filter'`（筛选事件），payload 包含筛选维度信息
  - 事件发布次数合理（每个图表组件只被通知一次，无无限循环）
- **Result:** PENDING

### [TC-1808] 筛选条件下数据一致性
- **Story:** US-18
- **Steps:**
  1. 点击饼图 SQLi，记录柱状图各柱子数值
  2. 手动用 JS filter 从全量 vulnerabilities 中筛选 SQLi 类型并按严重程度分组
  3. 对比两组数值
- **Expected:** 柱状图显示的分布与手动计算结果完全一致
- **Result:** PENDING

### [TC-1809] 筛选条件下的图表空数据表现
- **Story:** US-18
- **Steps:**
  1. 数据中 SQLi 全为低危（无严重/高危）
  2. 点击饼图 SQLi，观察柱状图
- **Expected:**
  - 柱状图 "严重" "高危" 柱子显示为 0（或柱状图不报错仍有坐标轴）
  - 低危柱子显示实际值
  - 不崩溃，不空白
- **Result:** PENDING

### [TC-1810] 防抖 — 快速切换筛选不导致渲染卡顿
- **Story:** US-18
- **Steps:**
  1. 快速连续点击饼图 5 个不同扇区（每次间隔 < 100ms）
  2. 观察图表重渲染行为
- **Expected:**
  - 最终展示最后一次点击的筛选结果
  - 中间态可能跳过但最终一致
  - 不出现显著卡顿（FPS ≥ 30）
  - 无内存飙升
- **Result:** PENDING


---

## 四、US-20: 雷达图多维度指标

> **基线说明:** 当前仅 PieChart 和 BarChart。Sprint 3 新增 RadarChart，展示漏洞的 CVSS 多维指标（基础分/影响分/可利用性/环境分等）用于对比多个漏洞。

### [TC-2001] 雷达图基本渲染
- **Story:** US-20
- **Steps:**
  1. 准备测试数据：2 个漏洞，各含 4 个 CVSS 维度分数
  2. 渲染 RadarChart 组件
  3. 检查 DOM
- **Expected:**
  - 雷达图正常渲染
  - ECharts radar 实例已初始化
  - Canvas/SVG 元素可见
- **Result:** PENDING

### [TC-2002] 雷达图 axis/维度数量正确性
- **Story:** US-20
- **Steps:**
  1. 传入 `dimensions: ['基础分', '影响分', '可利用性', '环境分']`
  2. 渲染雷达图
  3. 通过 `getOption()` 读取 radar.indicator 数量
- **Expected:** indicator 数量 = 4，名称与传入一致
- **Result:** PENDING

### [TC-2003] 雷达图数据正确性 — 单漏洞
- **Story:** US-20
- **Steps:**
  1. 传入 1 个漏洞数据 `{ name: 'CVE-2024-001', values: [8.5, 7.0, 6.0, 5.0] }`
  2. 渲染雷达图
  3. 读取 series[0].data
- **Expected:**
  - 数据点数量 = 4
  - 值依次为 8.5, 7.0, 6.0, 5.0
  - Tooltip 显示对应维度名称 + 分值
- **Result:** PENDING

### [TC-2004] 雷达图多漏洞对比 — 多系列渲染
- **Story:** US-20
- **Steps:**
  1. 传入 3 个漏洞数据用于对比
  2. 渲染雷达图
- **Expected:**
  - 3 个多边形叠加渲染，颜色不同
  - Legend 显示 3 个漏洞名称
  - 多边形不重叠导致无法辨识（使用不同填充透明度 0.1~0.3）
- **Result:** PENDING

### [TC-2005] 雷达图空数据处理
- **Story:** US-20
- **Steps:**
  1. 传入空数组 `vulnerabilities=[]`
- **Expected:**
  - 显示 Empty 组件 + "暂无数据" 提示
  - 不崩溃，不显示空白图表
  - 图表区域保持占位高度
- **Result:** PENDING

### [TC-2006] 雷达图零数据处理
- **Story:** US-20
- **Steps:**
  1. 传入漏洞数据但所有维度值均为 0
- **Expected:**
  - 雷达图显示原点或极小多边形（不显示大空白）
  - 坐标轴正常渲染
  - 不因全 0 导致报错
- **Result:** PENDING

### [TC-2007] 雷达图 CVSS 指标维度名称
- **Story:** US-20
- **Steps:**
  1. 检查 CVSS 指标命名
- **Expected:**
  - 至少包含: 基础分数 (Base)、影响分 (Impact)、可利用性 (Exploitability)
  - 可选: 环境分 (Environmental)、时间分 (Temporal)
  - 维度名称使用中文且与 CVSS v3.1 规范一致
- **Result:** PENDING

### [TC-2008] 雷达图响应式 Resize
- **Story:** US-20
- **Steps:**
  1. 渲染雷达图
  2. 通过 DevTools 缩放窗口宽度 1280 → 768 → 375
- **Expected:** 雷达图随容器 resize，文字不溢出，多边形不裁剪
- **Result:** PENDING


---

## 五、US-21: 折线图时间趋势

> **基线说明:** Sprint 3 新增 LineChart，展示漏洞发现时间趋势（按天/周/月聚合），支持多系列（按类型或严重程度分）。

### [TC-2101] 折线图基本渲染
- **Story:** US-21
- **Steps:**
  1. 准备测试数据：5 天的漏洞数量 `[{date:'2024-01-01', count:3}, ...]`
  2. 渲染 LineChart 组件
- **Expected:**
  - 折线图正常渲染
  - ECharts line 实例已初始化
  - X 轴为时间，Y 轴为数量
- **Result:** PENDING

### [TC-2102] 折线图 X 轴时间格式验证
- **Story:** US-21
- **Steps:**
  1. 传入跨月数据 `2024-01-28 ~ 2024-02-03`
  2. 检查 X 轴标签
- **Expected:**
  - X 轴类型为 `'time'` 或日期格式
  - 标签可读（如 "01/28", "01/30", "02/01"）
  - 自动间隔避免标签重叠
- **Result:** PENDING

### [TC-2103] 折线图多系列 — 按类型分组
- **Story:** US-21
- **Steps:**
  1. 数据包含 SQLi 和 XSS 两种类型，各有日统计数据
  2. 渲染折线图，按类型分组为 2 条线
- **Expected:**
  - 显示 2 条不同颜色的折线
  - Legend 显示 "SQL 注入" 和 "XSS"
  - 每条线的数据点与原始统计一致
- **Result:** PENDING

### [TC-2104] 折线图多系列 — 按严重程度分组
- **Story:** US-21
- **Steps:**
  1. 数据包含 4 个严重等级的日统计数据
  2. 渲染折线图，按严重程度分组
- **Expected:**
  - 显示 4 条折线，颜色与严重程度对应（严重=红，高危=橙，中危=黄，低危=绿）
  - Tooltip 同时显示同一天所有等级的数据
- **Result:** PENDING

### [TC-2105] 折线图空数据处理
- **Story:** US-21
- **Steps:**
  1. 传入空数组 `vulnerabilities=[]`
- **Expected:**
  - 显示 Empty 组件 + "暂无时间趋势数据"
  - 不崩溃
- **Result:** PENDING

### [TC-2106] 折线图零数据处理
- **Story:** US-21
- **Steps:**
  1. 传入数据：5 天的数据全为 0（`count=0`）
- **Expected:**
  - 折线图显示一条 Y=0 的水平线或贴近 X 轴
  - X 轴和 Y 轴正常渲染
  - 不因全 0 导致 Y 轴刻度异常
- **Result:** PENDING

### [TC-2107] 折线图 — 缺失日期插值
- **Story:** US-21
- **Steps:**
  1. 数据包含 1 月 1 日和 1 月 5 日，中间 1 月 2-4 日无记录
  2. 渲染折线图
- **Expected:**
  - 缺失日期显示为断点或插值为 0
  - 不显示为连续折线连接无数据的日期
  - 或用虚线标记缺数据段
- **Result:** PENDING

### [TC-2108] 折线图点击触发联动
- **Story:** US-21
- **Steps:**
  1. 点击折线图某个数据点（如 1 月 3 日）
  2. 观察事件与图表联动
- **Expected:**
  - Event Bus 发布 `'chart:click'` 事件携带时间点信息
  - 饼图/柱状图/雷达图切换为该时间点的数据（如果实现了时间筛选）
  - AIDetailAnalysis 展示该时间点的漏洞列表
- **Result:** PENDING


---

## 六、US-22: 图表维度筛选器

> **基线说明:** Sprint 3 新增全局图表筛选器组件，允许用户选择漏洞类型/严重程度/时间范围来过滤所有图表的数据。

### [TC-2201] 筛选器 UI 渲染
- **Story:** US-22
- **Steps:**
  1. 加载有数据的页面
  2. 检查筛选器组件是否存在
- **Expected:**
  - 筛选器组件渲染在图表区域上方或侧边
  - 至少包含: 漏洞类型下拉、严重程度下拉、时间范围选择器
  - 使用 Ant Design Select / DatePicker 等组件
- **Result:** PENDING

### [TC-2202] 漏洞类型筛选器选项正确性
- **Story:** US-22
- **Steps:**
  1. 加载数据（SQLi=5, XSS=3, CSRF=2）
  2. 展开类型下拉
- **Expected:**
  - 下拉选项 = ['全部', 'SQL 注入', 'XSS', 'CSRF']（或实际数据中的类型名）
  - 选项数量 = 去重后的类型数 + 1（全部选项）
  - 默认选中 "全部"
- **Result:** PENDING

### [TC-2203] 严重程度筛选器选项正确性
- **Story:** US-22
- **Steps:**
  1. 展开严重程度下拉
- **Expected:**
  - 选项 = ['全部', '严重(9-10)', '高危(7-9)', '中危(4-7)', '低危(0-4)']
  - 默认选中 "全部"
- **Result:** PENDING

### [TC-2204] 筛选器 → 图表联动
- **Story:** US-22
- **Steps:**
  1. 选择类型 = "SQL 注入"
  2. 观察所有图表（饼图、柱状图、折线图、雷达图）变化
- **Expected:**
  - 饼图: 仅显示 SQLi 类型（即 1 个扇区占 100%）
  - 柱状图: 仅显示 SQLi 的严重程度分布
  - 折线图: 仅显示 SQLi 的时间趋势
  - 雷达图: 仅显示 SQLi 类型的漏洞
  - Event Bus 发布 `'chart:filter'` 事件
- **Result:** PENDING

### [TC-2205] 筛选器 — 重置按钮
- **Story:** US-22
- **Steps:**
  1. 依次选择类型=SQLi、严重程度=高危，形成组合筛选
  2. 点击 "重置筛选" 按钮
- **Expected:**
  - 全部下拉恢复为 "全部"
  - 所有图表恢复到全量数据
  - Event Bus 发布 `'chart:filter'` 事件 payload 为 `null`
- **Result:** PENDING

### [TC-2206] 筛选器 — 级联筛选项
- **Story:** US-22
- **Steps:**
  1. 先选择类型 = "XSS"
  2. 再选择严重程度 = "严重"
  3. 观察数据
- **Expected:**
  - 所有图表数据 = vulnerabilities.filter(v => v.vuln_type === 'XSS' && v.cvss_score >= 9)
  - 如果结果为空，显示空状态（不崩溃）
- **Result:** PENDING

### [TC-2207] 筛选器与图表点击协同 — 不冲突
- **Story:** US-22
- **Steps:**
  1. 先通过筛选器选择类型=SQLi
  2. 再点击饼图扇区（此时只剩 SQLi 的饼图，即 1 个扇区）
  3. 观察联动行为
- **Expected:**
  - 筛选器状态不变
  - AI 面板仍正常响应点击
  - Event Bus 事件同时携带筛选条件 + 点击信息
- **Result:** PENDING


---

## 七、US-23: 图表空状态 & 零数据

> **基线说明:** PieChart 和 BarChart 已有基础空状态处理（使用 antd Empty 组件）。Sprint 3 需为所有新图表（雷达图、折线图）以及边界场景（零数据、筛选后空数据）统一空状态展示。

### [TC-2301] 雷达图 — 空数据 (vulnerabilities=[])
- **Story:** US-23
- **Steps:**
  1. 传入空数组
- **Expected:**
  - 显示 Empty 组件 + "暂无雷达图数据" 或等效提示
  - 图表容器占位高度保持（不塌缩为 0）
- **Result:** PENDING

### [TC-2302] 雷达图 — 零数据 (所有维度=0)
- **Story:** US-23
- **Steps:**
  1. 传入 `dimensions` 和 `values: [0, 0, 0, 0]`
- **Expected:**
  - 雷达图显示原点多边形或空雷达网格
  - 不崩溃，不显示 NaN
  - 有明确提示（如 "暂无评分数据"）
- **Result:** PENDING

### [TC-2303] 折线图 — 空数据 (vulnerabilities=[])
- **Story:** US-23
- **Steps:**
  1. 传入空数组
- **Expected:**
  - 显示 Empty 组件 + "暂无时间趋势数据"
  - 容器高度保持
- **Result:** PENDING

### [TC-2304] 折线图 — 所有天 count=0
- **Story:** US-23
- **Steps:**
  1. 传入 5 天全 0 数据
- **Expected:**
  - 可显示折线图（Y=0 水平线）而非 Empty
  - 或显示 "所选时间段内无漏洞记录"
- **Result:** PENDING

### [TC-2305] 饼图 — 已有空状态回归 (Sprint 2 覆盖)
- **Story:** US-23
- **Steps:**
  1. vulnerabilities=[]
- **Expected:** 已有 Empty 组件 "暂无数据"，Sprint 3 不被破坏
- **Result:** PENDING

### [TC-2306] 柱状图 — 已有空状态回归
- **Story:** US-23
- **Steps:**
  1. vulnerabilities=[]
- **Expected:** 已有 Empty 组件 "暂无数据"，Sprint 3 不被破坏
- **Result:** PENDING

### [TC-2307] 筛选器过滤后结果为空
- **Story:** US-23
- **Steps:**
  1. 选择类型=SQLi + 严重程度=低危
  2. 若数据中 SQLi 无低危漏洞，所有图表数据应为空
- **Expected:**
  - 每个图表独立显示空状态（Empty + 相应提示）
  - 不显示空白图表或残留数据
  - 筛选器标签保持当前选项，有 "无匹配结果" 反馈
- **Result:** PENDING

### [TC-2308] 空状态 — 所有图表统一 UI 风格
- **Story:** US-23
- **Steps:**
  1. 依次清空数据，检查 4 个图表（饼图/柱状图/雷达图/折线图）的空状态
- **Expected:**
  - 所有图表使用统一的 antd Empty 组件
  - 描述文案各有区别但风格一致
  - 图表容器 Card 保持标题，仅内容区为空状态
- **Result:** PENDING

### [TC-2309] 零数据 vs 空数据区分
- **Story:** US-23
- **Steps:**
  1. 对比 `vulnerabilities=[]`（空）和 vulnerabilities 存在但 count=0（零）的表现
- **Expected:**
  - 空数据 → Empty 组件
  - 零数据 → 图表可渲染（坐标轴存在，数据点/柱子在 0 位）
  - 两种状态有明确视觉区分
- **Result:** PENDING

### [TC-2310] 加载状态下的空状态不闪烁
- **Story:** US-23
- **Steps:**
  1. 设置 loading=true + vulnerabilities=[]
  2. 渲染所有图表
- **Expected:**
  - 加载时显示 ChartSkeleton，不显示 Empty
  - 加载完成后若无数据，切换为 Empty
  - 无 "Empty → 图表 → Empty" 闪烁
- **Result:** PENDING


---

## 八、US-24: 三栏布局自适应

> **基线说明:** LayoutContainer 当前为 lg+(≥1024px) 双栏（左：输入+列表+图表 / 右：AI分析）。Sprint 3 升级为三栏布局或优化为三栏（输入+图表 / 列表 / AI分析），支持更多断点。

### [TC-2401] lg 断点 (≥1024px) — 三栏布局渲染
- **Story:** US-24
- **Steps:**
  1. 设置视口宽度 = 1440px
  2. 检查 LayoutContainer
- **Expected:**
  - 三栏并排渲染（如：输入+图表 | 漏洞列表 | AI 分析）
  - 或优化后的二栏布局但更宽（左栏占比 > 右栏）
  - 使用 CSS Grid `grid-cols-3` 或等效 Tailwind 类
  - 各栏之间间距一致（gap-4 或 gap-6）
- **Result:** PENDING

### [TC-2402] md 断点 (768-1023px) — 双栏或堆叠
- **Story:** US-24
- **Steps:**
  1. 设置视口宽度 = 900px
- **Expected:**
  - 降级为双栏布局或堆叠
  - 内容不被截断，无横向滚动条（除非表格太宽）
  - 图表区域正常渲染
- **Result:** PENDING

### [TC-2403] sm 断点 (576-767px) — 单栏堆叠
- **Story:** US-24
- **Steps:**
  1. 设置视口宽度 = 650px
- **Expected:**
  - 单栏堆叠：输入 → 列表 → 图表 → AI 分析 自上而下
  - 图表宽度 100%，不溢出
- **Result:** PENDING

### [TC-2404] xs 断点 (<576px) — 移动端适配
- **Story:** US-24
- **Steps:**
  1. 设置视口宽度 = 375px (iPhone)
- **Expected:**
  - 单栏堆叠，所有内容可读
  - 图表不溢出视口
  - AI 分析面板卡片内边距合理
  - 无横向滚动
- **Result:** PENDING

### [TC-2405] 布局切换后图表 Resize 验证
- **Story:** US-24
- **Steps:**
  1. 在 1440px 渲染，保持图表可见
  2. 逐步缩小窗口到 375px
  3. 通过 DevTools 检查 ECharts 实例的宽度/高度
- **Expected:**
  - 每次断点切换，所有图表通过 ResizeObserver 自动 resize
  - ECharts `getWidth()` / `getHeight()` 与容器匹配
  - 图表内容不裁剪、不模糊
- **Result:** PENDING

### [TC-2406] 全屏切换 — 图表区域最大化
- **Story:** US-24
- **Steps:**
  1. 如果实现了全屏/展开按钮，点击图表区域全屏按钮
  2. 再点击退出全屏
- **Expected:**
  - 全屏时图表占据主要视口（如左栏全宽，右栏隐藏）
  - 退出全屏恢复原始布局
  - 两次切换图表 resize 正常，无报错
- **Result:** PENDING

### [TC-2407] 布局列宽比例验证 (三栏)
- **Story:** US-24
- **Steps:**
  1. 检查三栏布局的列宽（如果实现三栏）
- **Expected:**
  - 如 `grid-cols-[2fr_1fr_1fr]` 或 `grid-cols-[3fr_2fr_2fr]`
  - 输入+图表区最宽，AI 面板次之
  - 列宽使用比例单位（fr/百分比），不使用固定 px
- **Result:** PENDING

### [TC-2408] 布局切换后 AIDetailAnalysis 滚动行为
- **Story:** US-24
- **Steps:**
  1. 加载较多数据使 AI 面板内容超出视口
  2. 在 lg 断点 → sm 断点之间切换
- **Expected:**
  - AI 面板内容可滚动（`overflow-auto`），滚动条正常
  - 切换断点后滚动位置不丢失（或重置到顶部是接受的行为）
  - 不出现双滚动条
- **Result:** PENDING


---

## 九、集成测试 & 边界场景

### [TC-I01] 全链路联动 — 筛选器 → 图表 → AI 分析
- **Story:** US-17, US-18, US-19, US-22
- **Steps:**
  1. 加载包含 10+ 漏洞的测试数据
  2. 筛选器选择类型 = SQLi
  3. 观察所有图表数据过滤
  4. 点击柱状图中 "高危" 柱子
  5. 观察 AI 面板更新
  6. 点击 "重置筛选"
  7. 观察所有组件恢复
- **Expected:**
  - 每步操作，所有组件状态一致
  - Event Bus 事件序列正确，无循环触发
  - Console 无 Error（React key warning 允许）
- **Result:** PENDING

### [TC-I02] Event Bus 内存泄漏 — 组件反复挂载/卸载
- **Story:** US-19
- **Steps:**
  1. 通过条件渲染切换图表显示/隐藏 50 次
  2. 检查 Event Bus 内部 listeners Map
- **Expected:**
  - listeners Map 中无已卸载组件的残留回调
  - 内存使用量稳定（不持续增长）
  - 每次发布事件不触发已卸载组件的回调
- **Result:** PENDING

### [TC-I03] 极端大数据量 — 1000+ 漏洞
- **Story:** US-17, US-18, US-20, US-21
- **Steps:**
  1. 生成 1000 条漏洞 mock 数据（20 种类型 × 50）
  2. 渲染所有图表
  3. 操作筛选器
- **Expected:**
  - 初始渲染 ≤ 3s
  - 筛选器切换图表重渲染 ≤ 500ms
  - 饼图 Legend 自动滚动（type:'scroll'）
  - 无白屏或长时间卡顿
- **Result:** PENDING

### [TC-I04] 并发事件发布 — 不丢事件
- **Story:** US-19
- **Steps:**
  1. 同时发布 100 个不同事件
  2. 确认所有订阅者收到了对应事件
- **Expected:** 事件不丢失，回调调用次数与发布次数一致
- **Result:** PENDING

### [TC-I05] 筛选器 + 图表点击状态一致性
- **Story:** US-17, US-18, US-22
- **Steps:**
  1. 筛选器选择类型=SQLi + 严重程度=高危
  2. 在筛选后数据中点击饼图 SQLi 扇区
  3. 观察 AI 面板 + 图表 + 筛选器状态
- **Expected:**
  - 所有组件状态同步：筛选器反映当前筛选，图表反映筛选数据，AI面板反映选中漏洞
  - Event Bus 携带完整上下文（筛选条件 + 点击目标）
  - 无状态冲突或 race condition
- **Result:** PENDING


---

## 测试环境

| 项目 | 值 |
|------|-----|
| 前端框架 | React 19 + Vite 8 |
| 状态管理 | Redux Toolkit 2.12 |
| UI 库 | Ant Design 6.5 + Tailwind CSS 4.3 |
| 图表库 | ECharts 6.1 |
| 测试工具 | Vitest + React Testing Library (建议) |
| 浏览器 | Chrome 130+, Firefox 130+, Safari 17+ |
| 视口 | 375 / 650 / 900 / 1440 / 1920 |

---

## 执行状态汇总

| 状态 | 含义 |
|------|------|
| PENDING | 未执行 |
| PASS ✅ | 通过 |
| FAIL ❌ | 不通过 |
| BLOCKED 🚫 | 环境/依赖阻塞 |

**更新日期:** 2026-06-30  
**QA Agent:** robot01
