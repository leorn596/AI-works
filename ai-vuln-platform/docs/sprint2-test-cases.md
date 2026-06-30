# Sprint 2 测试用例

> 版本: v1.0 | 日期: 2026-06-30 | QA Agent: robot01  
> 覆盖: US-09 ~ US-16 (Sprint 2 图表 + 文件上传 + 响应式)

---

## 测试概览

| 测试类别 | 用例数 | 覆盖范围 |
|---------|-------|---------|
| 图表渲染 & 交互 (US-09/10/11) | 18 | ECharts 饼图/柱状图/通用基类 |
| 文件上传 & 解析 (US-12/13) | 18 | ZAP JSON / Nmap XML 解析 |
| 数据填充 & 全链路 (US-14/15) | 10 | 自动填充列表 / 完整 loading 流程 |
| 响应式断点适配 (US-16) | 8 | 5 断点 × 多种场景 |
| 安全专项 | 12 | 文件上传安全 / XXE / 速率限制 / 依赖 |
| 集成 & 性能 | 6 | 端到端 / 并发 / 性能基准 |
| **合计** | **72** | US-09 ~ US-16 |

---

## 一、US-09: 饼图展示漏洞类型分布

### [TC-0901] 饼图基本渲染验证
- **Story:** US-09
- **Steps:**
  1. 准备测试数据：3 种漏洞类型(SQLi×5, XSS×3, CSRF×2)
  2. 渲染饼图组件
  3. 检查 DOM 中是否存在 canvas/svg 元素
- **Expected:**
  - 饼图正常渲染，无报错
  - ECharts 实例已初始化（可通过 `echarts.getInstanceByDom` 验证）
  - Canvas 或 SVG 元素存在
- **Result:** PENDING

### [TC-0902] 饼图数据正确性 — 类型数量
- **Story:** US-09
- **Steps:**
  1. 注入 mock 数据：`[{name:'SQLi', value:5}, {name:'XSS', value:3}, {name:'CSRF', value:2}]`
  2. 渲染饼图
  3. 通过 ECharts getOption() 读取 series[0].data
- **Expected:**
  - 饼图扇形数量 = 3
  - 每个扇形名称和数值与输入一致
  - 合计 = 5+3+2 = 10
- **Result:** PENDING

### [TC-0903] 饼图数据正确性 — 百分比计算
- **Story:** US-09
- **Steps:**
  1. 注入数据：SQLi=40, XSS=30, CSRF=30（总数=100）
  2. 渲染饼图
  3. 检查 tooltip / label 中显示的百分比
- **Expected:**
  - SQLi 占比 40%、XSS 30%、CSRF 30%
  - 百分比之和 = 100%
  - 精度至少保留 1 位小数
- **Result:** PENDING

### [TC-0904] 饼图空数据展示
- **Story:** US-09
- **Steps:**
  1. 传入空数组 `[]` 作为数据
  2. 渲染饼图组件
- **Expected:**
  - 不报错、不空白崩溃
  - 显示空状态提示（如 "暂无漏洞类型数据" — 可用 Empty 组件或图表内文字提示）
  - 或显示灰色空饼图占位
- **Result:** PENDING

### [TC-0905] 饼图零值数据展示
- **Story:** US-09
- **Steps:**
  1. 传入数据：`[{name:'SQLi', value:0}, {name:'XSS', value:0}]`
  2. 渲染饼图
- **Expected:**
  - 不报错
  - 所有扇区不显示（因为 value=0）
  - 显示 "暂无数据" 或等效空状态
  - 不应除以 0 导致 NaN
- **Result:** PENDING

### [TC-0906] 饼图 tooltip 交互验证
- **Story:** US-09
- **Steps:**
  1. 渲染饼图（有 3 种类型数据）
  2. 鼠标悬浮在 "SQLi" 扇区上
  3. 检查 tooltip 内容
- **Expected:**
  - Tooltip 出现，显示类型名称(SQLi)、数值(5)、百分比(50%)
  - Tooltip 样式清晰可读
  - 鼠标移开 tooltip 消失
- **Result:** PENDING

### [TC-0907] 饼图点击事件回调
- **Story:** US-09
- **Steps:**
  1. 渲染饼图，注册 `on('click')` 事件回调
  2. 点击 "XSS" 扇区区域
  3. 观察回调是否触发，参数是否正确
- **Expected:**
  - 点击事件触发，回调执行
  - 回调参数包含：`{name: 'XSS', value: 3, dataIndex: ...}`
  - 不因扇区太小而点不到（可设置 `selectedMode`）
- **Result:** PENDING

### [TC-0908] 饼图 Legend 图例渲染
- **Story:** US-09
- **Steps:**
  1. 渲染包含 5 种类型的饼图
  2. 检查 Legend 组件
- **Expected:**
  - Legend 显示所有 5 种类型的名称和色块
  - Legend 点击可切换对应扇区显隐
  - 切换后饼图重新计算百分比
- **Result:** PENDING

---

## 二、US-10: 柱状图展示漏洞严重程度分布

### [TC-1001] 柱状图基本渲染验证
- **Story:** US-10
- **Steps:**
  1. 准备数据：严重程度分布（严重=3, 高危=5, 中危=8, 低危=2）
  2. 渲染柱状图组件
  3. 检查 DOM 中的 canvas/svg 元素
- **Expected:**
  - 柱状图正常渲染，无报错
  - X 轴为严重程度类别，Y 轴为数量
- **Result:** PENDING

### [TC-1002] 柱状图数据正确性
- **Story:** US-10
- **Steps:**
  1. 注入数据：`['严重','高危','中危','低危']` → `[3,5,8,2]`
  2. 通过 getOption() 验证配置
- **Expected:**
  - X 轴类目与输入一致
  - Y 轴数值与输入一致
  - 柱状图高度比例正确（严重:高危:中危:低危 = 3:5:8:2）
- **Result:** PENDING

### [TC-1003] 柱状图空数据展示
- **Story:** US-10
- **Steps:**
  1. 传入空数组 `[]` 或全零数组
  2. 渲染柱状图
- **Expected:**
  - 不崩溃
  - 显示空状态提示或 Y 轴范围正常（0-max 合理）
  - 不显示异常的 Y 轴（如 NaN）
- **Result:** PENDING

### [TC-1004] 柱状图 tooltip 交互
- **Story:** US-10
- **Steps:**
  1. 渲染柱状图，悬浮到 "高危" 柱子上
  2. 检查 tooltip
- **Expected:**
  - Tooltip 显示类别名称("高危")和数量(5)
  - 可配置显示百分比占比
- **Result:** PENDING

### [TC-1005] 柱状图点击事件回调
- **Story:** US-10
- **Steps:**
  1. 注册 `on('click')` 事件
  2. 点击 "中危" 柱子
  3. 验证回调参数
- **Expected:**
  - 事件触发，回调收到 `{name: '中危', value: 8, ...}`
  - 可用于联动筛选漏洞列表
- **Result:** PENDING

### [TC-1006] 柱状图颜色映射
- **Story:** US-10
- **Steps:**
  1. 渲染柱状图（严重/高危/中危/低危）
  2. 检查每根柱子的颜色
- **Expected:**
  - 严重=红色(#f5222d), 高危=橙色(#fa8c16), 中危=金色(#faad14), 低危=绿色(#52c41a)
  - 或使用统一的 severity 色板
  - 颜色与右侧漏洞列表 severity tag 一致
- **Result:** PENDING

---

## 三、US-11: ECharts 通用基类组件

### [TC-1101] 通用基类封装性验证
- **Story:** US-11
- **Steps:**
  1. 检查通用基类组件的 props 定义
  2. 验证子组件（饼图/柱状图）是否通过基类渲染
- **Expected:**
  - 存在 `EChartsBase` 或类似命名的通用封装组件
  - 接受 props：`option`, `height`, `loading`, `onChartReady`, `onEvents`
  - 饼图和柱状图组件复用基类
- **Result:** PENDING

### [TC-1102] 通用基类 loading 状态
- **Story:** US-11
- **Steps:**
  1. 传入 `loading={true}` prop
  2. 渲染基类组件
  3. 再切换为 `loading={false}`
- **Expected:**
  - Loading 时显示 Spin/Skeleton（复用 ChartSkeleton 或内置 loading）
  - Loading 结束后图表正常渲染
  - Loading 期间不出现空白闪烁
- **Result:** PENDING

### [TC-1103] 通用基类 error 状态
- **Story:** US-11
- **Steps:**
  1. 传入无效/损坏的 option 配置
  2. 渲染基类组件
- **Expected:**
  - 不白屏
  - 捕获 ECharts 异常
  - 显示 "图表数据异常" 降级提示
  - ErrorBoundary 兜底生效
- **Result:** PENDING

### [TC-1104] 通用基类 resize 自适应
- **Story:** US-11
- **Steps:**
  1. 渲染图表组件（宽度 1200px）
  2. 通过 JS 调整容器宽度到 600px
  3. 等待 resize 事件触发（Debounce 300ms）
- **Expected:**
  - 图表自动 resize，内容不变形
  - ECharts `resize()` 被调用
  - 饼图扇区面积相应缩小，标签仍可读
- **Result:** PENDING

### [TC-1105] 通用基类实例清理
- **Story:** US-11
- **Steps:**
  1. 渲染图表组件
  2. 触发组件卸载（路由切换或条件渲染）
  3. 检查 ECharts 实例是否被 dispose
- **Expected:**
  - `useEffect` cleanup 中调用 `echartsInstance.dispose()`
  - 卸载后 `echarts.getInstanceByDom(container)` 返回 undefined
  - 无内存泄漏（多次挂载/卸载后 DOM 节点数不增长）
- **Result:** PENDING

### [TC-1106] 通用基类事件透传
- **Story:** US-11
- **Steps:**
  1. 传入 `onEvents={{ click: handleClick }}` prop
  2. 点击图表
  3. 验证回调执行
- **Expected:**
  - handleClick 被调用，参数为 ECharts 事件对象
  - 支持多个事件类型（click, mouseover, mouseout, legendselectchanged）
- **Result:** PENDING

---

## 四、US-12: 上传 ZAP/Nmap 扫描文件

### [TC-1201] ZAP JSON 文件上传 — 正常流程
- **Story:** US-12
- **Steps:**
  1. 准备一个合法的 ZAP JSON 扫描报告文件
  2. 切换到 "文件上传" tab（原 US-04 中的 disabled tab 需启用）
  3. 拖拽/点击上传 ZAP JSON 文件
  4. 观察上传进度和结果
- **Expected:**
  - 文件上传成功
  - 显示文件名和大小
  - 上传组件显示成功状态（绿色勾）
  - 自动触发明细解析步骤
- **Result:** PENDING

### [TC-1202] Nmap XML 文件上传 — 正常流程
- **Story:** US-12
- **Steps:**
  1. 准备一个合法的 Nmap XML 扫描报告文件（`nmap -oX output.xml`）
  2. 通过文件上传组件上传该 XML 文件
- **Expected:**
  - 文件上传成功
  - 组件正确识别为 XML 格式
  - 显示文件名和大小
- **Result:** PENDING

### [TC-1203] 仅允许 .json / .xml 文件格式
- **Story:** US-12
- **Steps:**
  1. 尝试上传 .txt 文件
  2. 尝试上传 .png 文件
  3. 尝试上传 .pdf 文件
  4. 尝试上传 .exe 文件
- **Expected:**
  - 所有非 .json/.xml 文件被前端拦截
  - Ant Design Upload 的 `accept=".json,.xml"` 生效
  - 或自定义 `beforeUpload` 返回 false + 提示 "仅支持 JSON/XML 格式"
  - 后端同样校验文件扩展名和 MIME 类型
- **Result:** PENDING

### [TC-1204] MIME 类型双重校验
- **Story:** US-12
- **Steps:**
  1. 将一个 .txt 文件改扩展名为 .json
  2. 尝试上传这个伪装的 JSON 文件
  3. 检查前端 beforeUpload 和后端的处理
- **Expected:**
  - 前端通过 File.type 检查 MIME 类型（`application/json`）
  - 或通过读取文件头部 magic bytes 校验
  - 后端同样验证 Content-Type 和文件内容
  - 拒绝并提示 "文件格式不匹配"
- **Result:** PENDING

### [TC-1205] 文件大小限制 — 超大文件 (≥10MB)
- **Story:** US-12
- **Steps:**
  1. 生成一个 15MB 的合法 JSON 文件
  2. 尝试上传
- **Expected:**
  - 前端 `beforeUpload` 检查 file.size
  - 若 ≥10MB，阻止上传 + 提示 "文件大小不能超过 10MB"
  - 后端同样限制 body size（Nginx `client_max_body_size` / FastAPI 限制）
  - 不占用过多内存
- **Result:** PENDING

### [TC-1206] 空文件上传
- **Story:** US-12
- **Steps:**
  1. 准备一个 0 字节的 .json 文件
  2. 尝试上传
- **Expected:**
  - 前端或后端拦截
  - 提示 "文件为空，请选择有效的扫描报告"
  - 不触发后续的解析流程
- **Result:** PENDING

### [TC-1207] 文件名安全 — 路径遍历
- **Story:** US-12
- **Steps:**
  1. 尝试上传文件名含 `../../../etc/passwd` 的文件
  2. 尝试上传文件名含 `<script>` 的文件
  3. 检查后端日志和文件系统
- **Expected:**
  - 文件名被清理/规范化为安全名称
  - 不保存到服务器磁盘（仅内存处理）
  - 前端显示时对文件名做 HTML 转义
- **Result:** PENDING

### [TC-1208] 并发多文件上传
- **Story:** US-12
- **Steps:**
  1. 同时选择并上传 3 个合法 JSON 文件
  2. 观察上传行为
- **Expected:**
  - 仅允许单文件上传（multiple={false} 或 queue 限制）
  - 或允许批量上传，逐个解析
  - 每个文件都有独立的进度/状态
- **Result:** PENDING

---

## 五、US-13: 前端文件解析 + 数据清洗管道

### [TC-1301] ZAP JSON 格式解析正确性
- **Story:** US-13
- **Steps:**
  1. 准备标准 ZAP JSON 报告（包含 sites → alerts 结构）
  2. 模拟前端读取文件并解析
  3. 检查解析出的漏洞列表
- **Expected:**
  - 成功提取所有 alert 条目
  - 每个 alert 包含：name, risk, description, solution, cweid, wascid, url, param
  - Risk 值正确映射（Informational→Low, Low→Low, Medium→Medium, High→High, Critical→Critical）
  - 解析出的漏洞数量 = ZAP 报告中 alerts 数量
- **Result:** PENDING

### [TC-1302] Nmap XML 格式解析正确性
- **Story:** US-13
- **Steps:**
  1. 准备标准 Nmap XML 报告（`nmap -sV -oX` 格式）
  2. 解析 XML 文件
  3. 检查提取的 host/port/service 信息
- **Expected:**
  - 成功提取所有 host 和 port 信息
  - 每个条目包含：ip, hostname, port, protocol, service, version
  - 有 open 状态的端口被正确标记为漏洞候选
  - 可识别常见脆弱服务（如旧版本 OpenSSH、Apache、nginx）
- **Result:** PENDING

### [TC-1303] ZAP JSON 格式不完整 — 容错处理
- **Story:** US-13
- **Steps:**
  1. 准备一个不含 `alerts` 字段的 JSON 文件
  2. 准备一个 `alerts` 为空数组的 JSON 文件
  3. 尝试解析
- **Expected:**
  - 不崩溃
  - 返回空列表
  - 提示 "未在扫描报告中找到漏洞条目"
  - 不显示白屏或 JS 错误
- **Result:** PENDING

### [TC-1304] Nmap XML 格式损坏 — 容错处理
- **Story:** US-13
- **Steps:**
  1. 准备一个 XML 标签不闭合的文件
  2. 准备一个非 XML 内容但扩展名为 .xml 的文件
  3. 尝试解析
- **Expected:**
  - 捕获 XML 解析错误
  - 显示 "XML 文件解析失败，请确认文件来自 Nmap" 提示
  - 不崩溃
  - 不执行后续 AI 分析
- **Result:** PENDING

### [TC-1305] 数据清洗 — 去重逻辑验证
- **Story:** US-13
- **Steps:**
  1. 注入包含 3 条重复漏洞的 mock 数据（同 URL + 同类型）
  2. 执行数据清洗管道
  3. 检查输出
- **Expected:**
  - 重复条目被合并或去除
  - 去重后的数量 ≤ 原始数量
  - 保留最高 CVSS/severity 的条目
  - 去重日志可追踪（console 或通知）
  - **注意：** 去重策略明确：按 (vuln_type + url/endpoint) 或仅按 vuln_name 去重
- **Result:** PENDING

### [TC-1306] 数据清洗 — 空字段填充
- **Story:** US-13
- **Steps:**
  1. 注入缺少 name/description 等关键字段的漏洞数据
  2. 执行数据清洗管道
- **Expected:**
  - 缺失的 name → 填充为 "未命名漏洞"
  - 缺失的 description → 填充为 "（无描述）"
  - 缺失的 cvss_score → 设为 0 或 null
  - 缺失的 cvss_vector → 设为空字符串
  - 清洗后数据通过 unified schema 验证
- **Result:** PENDING

### [TC-1307] 数据类型强制转换
- **Story:** US-13
- **Steps:**
  1. 注入 cvss_score 为字符串 `"7.5"` 的 mock 数据
  2. 注入 vuln_type 为数字 `1` 的 mock 数据
  3. 执行清洗管道
- **Expected:**
  - cvss_score 被转为 float: 7.5
  - vuln_type 被转为 string: "1"
  - 所有字段类型符合统一 schema：
    ```typescript
    { vuln_name: string, vuln_type: string, cvss_score: number | null, ... }
    ```
- **Result:** PENDING

### [TC-1308] 超大解析数据量处理
- **Story:** US-13
- **Steps:**
  1. 准备一个包含 5000+ 个 alerts 的 ZAP JSON 文件
  2. 解析并执行清洗管道
  3. 观察页面响应
- **Expected:**
  - 解析在 5 秒内完成
  - 页面不冻结（如有大量数据，应分批渲染或虚拟列表）
  - 使用 Web Worker 或 setTimeout 分片避免主线程阻塞
  - 去重后数量合理（通常去重后 ≤ 500）
- **Result:** PENDING

---

## 六、US-14: 上传解析后自动填充漏洞列表

### [TC-1401] 解析完成后自动填充
- **Story:** US-14
- **Steps:**
  1. 上传并解析一个 ZAP JSON 报告（含 5 条 alerts）
  2. 等待解析完成
  3. 观察左侧 VulnerabilityList 组件
- **Expected:**
  - 列表自动显示解析出的 5 条漏洞
  - 列表条目按 severity/type 排序
  - 第一个漏洞自动选中（右侧显示详情）
  - 无手动刷新操作
- **Result:** PENDING

### [TC-1402] 填充后 Redux State 一致性
- **Story:** US-14
- **Steps:**
  1. 解析完成后检查 Redux DevTools
  2. 验证 state.analysis 的结构
- **Expected:**
  - `vulnerabilities` 数组包含解析出的数据
  - `status` 为 `'success'`
  - `currentVulnerability` 指向第一个漏洞
  - `summary` 包含描述内容或待分析状态
  - 无 state 残留（旧数据被正确清除）
- **Result:** PENDING

### [TC-1403] 连续上传覆盖旧数据
- **Story:** US-14
- **Steps:**
  1. 上传文件 A（5 条漏洞）→ 列表显示 5 条
  2. 上传文件 B（3 条漏洞）→ 等待解析
  3. 观察列表
- **Expected:**
  - 列表中只有文件 B 的 3 条漏洞（旧数据被清除）
  - 或者列表累积显示 8 条（8=5+3 去重后）
  - **行为需明确：** 覆盖模式还是追加模式
- **Result:** PENDING

### [TC-1404] 上传后切换到手动模式数据隔离
- **Story:** US-14
- **Steps:**
  1. 上传文件并解析 → 列表填充
  2. 切换到 "手动描述" tab
  3. 提交一个手动描述
  4. 等待 AI 分析完成
- **Expected:**
  - 手动分析完成后列表更新为手动分析的结果
  - 之前文件上传的数据被清除（正常行为）
  - 不发生数据混叠
- **Result:** PENDING

### [TC-1405] 列表项点击联动图表高亮
- **Story:** US-14
- **Steps:**
  1. 解析完成后，饼图和柱状图渲染
  2. 点击漏洞列表中的 "XSS" 类型条目
  3. 观察图表变化
- **Expected:**
  - 饼图中 "XSS" 扇区高亮/选中
  - 柱状图中对应严重程度柱子高亮
  - 联动状态正确（点击后高亮，再点击取消）
- **Result:** PENDING

---

## 七、US-15: 上传+解析+AI分析 完整 Loading 流程

### [TC-1501] 完整三阶段 Loading 流程
- **Story:** US-15
- **Steps:**
  1. 上传一个 ZAP JSON 文件
  2. 观察整个过程中的步骤指示
  3. 记录各阶段的过渡
- **Expected:**
  - 阶段 1 "上传中..." → 进度条显示上传百分比
  - 阶段 2 "解析中..." → 显示解析进度（如：已提取 N/50 alerts）
  - 阶段 3 "AI 分析中..." → 显示 AnalysisProgress（连接AI/识别类型/生成建议）
  - 每个阶段间有明确的视觉过渡（非静默等待）
- **Result:** PENDING

### [TC-1502] 上传进度条准确性
- **Story:** US-15
- **Steps:**
  1. 上传 5MB JSON 文件
  2. 使用 Chrome DevTools 限制网络为 Slow 3G
  3. 观察上传进度条
- **Expected:**
  - 进度条从 0% → 100% 平滑过渡
  - 百分比与实际上传进度一致
  - 上传完成后平滑过渡到解析阶段
- **Result:** PENDING

### [TC-1503] 解析阶段进度指示
- **Story:** US-15
- **Steps:**
  1. 上传包含 200 条 alerts 的 ZAP JSON
  2. 观察解析阶段的提示
- **Expected:**
  - 显示 "正在解析扫描报告..." 文字
  - 如有分段处理，显示 "已处理 50/200 条漏洞"
  - 解析完成后自动进入 AI 分析阶段
- **Result:** PENDING

### [TC-1504] 用户取消上传操作
- **Story:** US-15
- **Steps:**
  1. 开始上传一个较大的文件
  2. 在上传进度达到 30% 时点击 "取消" 按钮
- **Expected:**
  - 上传立即终止
  - 文件从队列中移除
  - 页面恢复初始状态
  - 后端不保存部分上传的文件
- **Result:** PENDING

### [TC-1505] 上传/解析失败后的重试
- **Story:** US-15
- **Steps:**
  1. 上传过程中网络中断 → 上传失败
  2. 观察是否提供重试选项
  3. 上传成功但解析失败
  4. 观察是否可重新解析
- **Expected:**
  - 上传失败显示 "上传失败，请重试" + Retry 按钮
  - 解析失败显示 "解析失败: <原因>" + 可重新上传
  - 失败状态不清除已上传的文件引用（避免重复上传）
- **Result:** PENDING

### [TC-1506] 同时进行中的操作互斥
- **Story:** US-15
- **Steps:**
  1. 开始文件上传+解析+AI 分析流程
  2. 在 AI 分析阶段尝试切换 tab 或上传新文件
  3. 观察行为
- **Expected:**
  - 所有输入控件在上传/解析/AI分析期间禁用
  - Tab 切换在流程中锁定
  - 上传按钮 disabled
  - 显示 "分析进行中，请稍候..." 提示
- **Result:** PENDING

---

## 八、US-16: 响应式断点适配

### 定义：
| 断点 | 最小宽度 | 布局预期 |
|------|---------|---------|
| xs | < 576px | 图表区上下堆叠，列表全宽 |
| sm | ≥ 576px | 图表区上下堆叠，列表全宽 |
| md | ≥ 768px | 图表并排 2 列，列表全宽 |
| lg | ≥ 1024px | 左(输入+列表) / 右(图表+分析) |
| xl | ≥ 1280px | 全宽双栏，图表并排 2 列 |

### [TC-1601] xs 断点 (< 576px) — 布局验证
- **Story:** US-16
- **Steps:**
  1. 设置浏览器宽度 = 375px（iPhone SE）
  2. 访问包含图表和文件上传的页面
  3. 检查布局
- **Expected:**
  - 所有组件单列堆叠
  - 饼图和柱状图上下排列，宽度 100%
  - 输入区全宽，按钮全宽
  - 无横向滚动条
  - 文字大小适当缩小，标签仍可读
- **Result:** PENDING

### [TC-1602] sm 断点 (≥ 576px) — 布局验证
- **Story:** US-16
- **Steps:**
  1. 设置浏览器宽度 = 600px
  2. 检查布局
- **Expected:**
  - 与 xs 类似但可有轻微调整
  - 图表区仍为单列但宽度合理
  - 上传区域按钮并列
- **Result:** PENDING

### [TC-1603] md 断点 (≥ 768px) — 图表并排
- **Story:** US-16
- **Steps:**
  1. 设置浏览器宽度 = 800px (iPad portrait)
  2. 检查图表区布局
- **Expected:**
  - 饼图和柱状图并排显示（2 列 grid）
  - 每个图表宽度约 50%
  - 图表标签/legend 不重叠
  - 列表和输入区仍为全宽
- **Result:** PENDING

### [TC-1604] lg 断点 (≥ 1024px) — 双栏布局
- **Story:** US-16
- **Steps:**
  1. 设置浏览器宽度 = 1100px (iPad landscape)
  2. 检查整体布局
- **Expected:**
  - 左侧面板：输入区 + 漏洞列表
  - 右侧面板：饼图 | 柱状图(上下) + AI 分析详情
  - 双栏约各占 50%
  - 无元素溢出或重叠
- **Result:** PENDING

### [TC-1605] xl 断点 (≥ 1280px) — 完整布局
- **Story:** US-16
- **Steps:**
  1. 设置浏览器宽度 = 1440px (Desktop)
  2. 检查完整布局
- **Expected:**
  - 左侧：输入区 + 漏洞列表（上层）+ 图表区（下层，饼图|柱状图并排）
  - 右侧：AI 分析详情
  - 所有元素有合理的间距和 padding
  - 最大宽度合理限制（如 max-w-[1440px]）
- **Result:** PENDING

### [TC-1606] 图表 resize 跨断点自适应
- **Story:** US-16
- **Steps:**
  1. 在 xl 断点(1440px)渲染饼图
  2. 逐步缩小窗口到 xs(375px)
  3. 再逐步放大到 xl
  4. 在每个断点检查图表渲染
- **Expected:**
  - 每次断点切换时图表自动 resize
  - 无渲染错误、无重叠、无丢失元素
  - ECharts resize 被正确 debounce（避免高频触发）
  - 标签在窄屏时自动隐藏或缩小
- **Result:** PENDING

### [TC-1607] 移动端菜单折叠
- **Story:** US-16
- **Steps:**
  1. 窗口宽度 < 768px
  2. 检查顶部导航栏
- **Expected:**
  - 导航菜单折叠为汉堡菜单（hamburger icon）
  - 点击展开菜单
  - 菜单项垂直排列
  - 不影响主要内容区域
- **Result:** PENDING

### [TC-1608] 图表在小屏上的交互可用性
- **Story:** US-16
- **Steps:**
  1. 窗口宽度 375px
  2. 渲染饼图/柱状图
  3. 尝试点击扇区/柱子
  4. 尝试查看 tooltip
- **Expected:**
  - 触摸区域足够大（至少 44×44px 或可点击区域）
  - Tooltip 不超出屏幕边界
  - 图例（legend）在窄屏时可滚动或折叠
- **Result:** PENDING

---

## 九、US-12/13 专项测试 — 文件上传安全

### [TC-SEC01] 上传文件不保存到磁盘
- **Story:** US-12
- **Steps:**
  1. 上传一个文件并完成解析
  2. SSH 到后端服务器
  3. 检查 `/tmp/`, `/var/tmp/`, `/app/uploads/` 等常见临时目录
  4. 检查后端代码中是否有 `file.save()` / `open(..., 'wb')` 等磁盘写入操作
- **Expected:**
  - 后端不将上传文件持久化到磁盘
  - 文件内容仅在内存中处理（`await file.read()`）
  - 无临时文件残留
- **Result:** PENDING

### [TC-SEC02] XML 解析 XXE 防护
- **Story:** US-13
- **Steps:**
  1. 准备一个包含 XXE payload 的 XML 文件（尝试读取 `/etc/passwd`）
  2. 上传该文件
  3. 观察解析结果和服务器日志
- **Expected:**
  - 不读取外部实体
  - 文件解析失败或实体被忽略
  - 服务器不返回 `/etc/passwd` 内容
  - 如使用 `defusedxml` 库，自动禁用外部实体
  - 如使用 `xml.etree.ElementTree`，设置 `resolve_entities=False`
- **Result:** PENDING

### [TC-SEC03] XML 解析 Billion Laughs 攻击防护
- **Story:** US-13
- **Steps:**
  1. 准备一个 Billion Laughs (指数实体扩展) 攻击 XML 文件
  2. 上传该文件
  3. 观察内存和 CPU 使用
- **Expected:**
  - 解析在合理时间/内存内完成或被终止
  - 不导致服务器 OOM
  - 实体扩展有硬限制（如 max 1000 entities）
- **Result:** PENDING

### [TC-SEC04] /api/analyze/batch 端点速率限制
- **Story:** US-12, US-15
- **Steps:**
  1. 在 1 分钟内连续调用 `/api/analyze/batch` 端点 20 次
  2. 检查第 11 次之后的响应
- **Expected:**
  - 前 10 次正常处理
  - 超过限制后返回 HTTP 429 Too Many Requests
  - 响应包含 `Retry-After` 头
  - 响应体格式统一：`{"code": 429, "message": "请求过于频繁，请稍后再试", "data": null}`
  - 速率限制建议：10 req/min（或类似合理值）
  - 限流逻辑基于 IP 或 session，通过 Redis 实现
- **Result:** PENDING

### [TC-SEC05] 前端文件大小前端限制绕过测试
- **Story:** US-12
- **Steps:**
  1. 使用 curl 直接调用后端 API，绕过前端 10MB 限制
  2. 发送 50MB 的 JSON body
  3. 观察后端响应
- **Expected:**
  - 后端有独立的 body size 限制
  - 返回 413 Payload Too Large
  - 不因 OOM 而崩溃
- **Result:** PENDING

---

## 十、新增依赖安全审查

### 新增依赖预期（Sprint 2）

| 依赖 | 用途 | 版本范围 |
|------|------|---------|
| echarts | 图表渲染 | ^6.1.0 (已存在) |
| echarts-for-react | React ECharts 封装 | ^3.0.6 (已存在) |
| fast-xml-parser | 前端 Nmap XML 解析 | 待确认 |
| defusedxml | 后端 XXE 安全 XML 解析 | 待确认 |

### [TC-DEP01] npm audit 无高危漏洞
- **Story:** US-11, US-13
- **Steps:**
  1. `cd frontend && npm audit`
  2. 检查输出
- **Expected:**
  - 无 Critical 级别漏洞
  - 无 High 级别漏洞（如有，需评估风险并记录）
  - Moderate/Low 可接受但需记录
- **Result:** PENDING

### [TC-DEP02] pip-audit 无高危漏洞
- **Story:** US-13
- **Steps:**
  1. `cd backend && pip-audit`
  2. 检查输出
- **Expected:**
  - 无 Critical 级别漏洞
  - 无已知 CVE 在新增依赖中
- **Result:** PENDING

### [TC-DEP03] XML 解析库安全选型验证
- **Story:** US-13
- **Steps:**
  1. 检查后端 XML 解析库的选择
  2. 验证库的已知安全配置
- **Expected:**
  - 后端：使用 `defusedxml` 或 `lxml`（禁用外部实体）
  - 前端：使用 `fast-xml-parser` 或 DOMParser（浏览器默认安全）
  - 不使用 Python 标准库 `xml.etree.ElementTree`（无默认 XXE 防护）
- **Result:** PENDING

---

## 十一、集成测试

### [TC-INT01] 端到端：ZAP 上传 → 解析 → AI 分析 → 图表展示
- **Story:** US-12, US-13, US-14, US-15, US-09, US-10
- **Steps:**
  1. 启动完整环境（前端+后端+数据库+AI Mock）
  2. 上传标准 ZAP JSON 报告
  3. 等待完整三阶段流程完成
  4. 检查最终页面状态
- **Expected:**
  - 左侧漏洞列表填充解析结果
  - 饼图正确展示漏洞类型分布
  - 柱状图正确展示严重程度分布
  - 右侧详情区显示选中漏洞的 AI 分析
  - 所有图表可交互（点击/悬浮）
  - Console 无报错
- **Result:** PENDING

### [TC-INT02] 端到端：Nmap XML 上传 → 解析 → AI 分析 → 图表展示
- **Story:** US-12, US-13, US-14, US-15, US-09, US-10
- **Steps:**
  1. 上传标准 Nmap XML 扫描报告
  2. 等待完整流程完成
  3. 检查页面状态
- **Expected:**
  - 漏洞列表显示提取的主机/端口/服务信息
  - 饼图按服务类型分布
  - 柱状图按风险等级分布
  - 无报错
- **Result:** PENDING

### [TC-INT03] Dashboard 完整页面渲染（含图表区）
- **Story:** US-09, US-10, US-14
- **Steps:**
  1. 解析完成后观察 Dashboard 页面
  2. 截图对比设计稿
- **Expected:**
  - 输入区在顶部
  - 图表区（饼图+柱状图）在中间（成对并排）
  - 漏洞列表在图表区下方
  - AI 分析详情在右侧
  - 所有区域间距合理，无视觉冲突
- **Result:** PENDING

### [TC-INT04] 多次上传切换不泄漏状态
- **Story:** US-14, US-15
- **Steps:**
  1. 上传文件 A → 完整分析
  2. 切换到手动描述 → AI 分析
  3. 再次上传文件 B → 完整分析
  4. 检查每次切换后的状态
- **Expected:**
  - 每次切换后相关的 Redux state 被正确重置
  - 总并发请求 ≤ 1（无请求堆积）
  - 无内存泄漏（页面长时间运行后内存稳定）
- **Result:** PENDING

### [TC-INT05] 历史记录页面不崩溃
- **Story:** US-09, US-10, US-16
- **Steps:**
  1. 完成一次完整的文件上传+分析+图表展示
  2. 点击导航栏 "分析历史"
  3. 再切回 "漏洞分析"
  4. 观察状态
- **Expected:**
  - 路由切换流畅
  - 切回分析页后，图表正常重渲染（ECharts 实例正确 dispose+reinitialize）
  - 无 "ECharts instance already exists" 警告
- **Result:** PENDING

### [TC-INT06] 图表渲染性能基准
- **Story:** US-09, US-10, US-11
- **Steps:**
  1. 准备 20 种漏洞类型 × 50 个严重等级的数据（总计 100 条）
  2. 渲染饼图 + 柱状图
  3. 使用 Performance API 测量渲染耗时
- **Expected:**
  - 首屏图表渲染 < 500ms
  - 数据更新（重新 setOption）< 200ms
  - 不出现明显的卡顿或布局抖动
- **Result:** PENDING

---

## 十二、缺陷报告模板

```
[BUG-<id>] <Title>
  Severity: Critical / High / Medium / Low
  Story: US-XX
  Steps to Reproduce: 1. 2. 3.
  Expected:
  Actual:
  Screenshot/Log: <link or paste>
  Fix Suggestion: <具体代码修改建议>
```

---

## 十三、验收结论模板

### [ACCEPT] US-XX
- 所有关联测试用例通过
- 无 P0/P1 缺陷
- 功能完整可用
- 安全审查无 Critical 发现

### [REJECT] US-XX
- 原因: <具体原因>
- 阻塞缺陷: [BUG-XX]
- 改进意见: <可执行的具体步骤，含代码示例>

---

## 十四、Sprint 1 遗留缺陷跟进（P0/P1）

**以下 Sprint 1 缺陷已纳入 Sprint 2 第 0 步修复，Sprint 2 验收前需确认已修复：**

| 缺陷 | Severity | 说明 | Sprint 2 验证 |
|------|----------|------|--------------|
| [BUG-04] | High | 提交按钮无限流 | [TC-LEGACY01] |
| [BUG-05] | High | Error state 不渲染到 UI | [TC-LEGACY02] |
| [BUG-07] | High | 异常处理器泄露详情 | [TC-LEGACY03] |
| [BUG-06] | Medium | fetch 无超时 | [TC-LEGACY04] |
| [BUG-08] | Medium | CORS 过度开放 | [TC-LEGACY05] |
| [BUG-09] | Medium | AI API 无 timeout | [TC-LEGACY06] |
| [BUG-01] | Medium | /health 格式不统一 | [TC-LEGACY07] |

### [TC-LEGACY01] 提交按钮 disabled/loading 联动
- **Story:** US-07 (Sprint 1)
- **Steps:**
  1. 点击"开始 AI 分析"
  2. 观察按钮状态
- **Expected:** Button `loading={status === 'loading'}` 和 `disabled={status === 'loading'}`；loading 期间不可重复点击
- **Result:** PENDING

### [TC-LEGACY02] 错误状态 UI 渲染
- **Story:** US-05, US-07 (Sprint 1)
- **Steps:**
  1. 触发一个会导致错误的操作
  2. 观察页面
- **Expected:** 展示 `<Alert type="error" message={error} />`；不静默失败
- **Result:** PENDING

### [TC-LEGACY03] 异常处理器安全消息
- **Story:** US-08 (Sprint 1)
- **Steps:**
  1. 触发一个 500 错误
  2. 检查返回 JSON
- **Expected:** `{"code": 500, "message": "服务器内部错误", "data": null}`；不暴露 `str(exc)`
- **Result:** PENDING

### [TC-LEGACY04] fetch 超时机制
- **Story:** US-05 (Sprint 1)
- **Steps:**
  1. 模拟 API 慢响应
  2. 等待 30s
- **Expected:** 30s 后前端超时提示 "请求超时，请重试"
- **Result:** PENDING

### [TC-LEGACY05] CORS 方法/头限制
- **Story:** US-08 (Sprint 1)
- **Steps:**
  1. 检查 `allow_methods` 和 `allow_headers`
- **Expected:** 限定为 `["GET","POST","OPTIONS"]` 和 `["Content-Type","Authorization"]`
- **Result:** PENDING

### [TC-LEGACY06] AI API 调用 timeout
- **Story:** US-05 (Sprint 1)
- **Steps:**
  1. 检查 OpenAI 客户端初始化
- **Expected:** `timeout=30` 或 `httpx.Timeout(30)` 设置
- **Result:** PENDING

### [TC-LEGACY07] /health 统一返回格式
- **Story:** US-02 (Sprint 1)
- **Steps:**
  1. `curl /api/health`
- **Expected:** `{"code": 200, "message": "ok", "data": {"status": "healthy"}}`
- **Result:** PENDING

---

## 变更记录

| 日期 | 版本 | 描述 |
|------|------|------|
| 2026-06-30 | v1.0 | 初始版本，覆盖 US-09 ~ US-16 + 安全审查 + 遗留缺陷跟进 |
