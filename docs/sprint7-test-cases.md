# Sprint 7 测试用例 — 性能优化 & 体验增强

> **QA Agent:** robot01  
> **测试基线:** 2026-06-30  
> **覆盖用户故事:** US-49 ~ US-56  
> **基线代码:** frontend/src/main.jsx, ErrorBoundary.jsx, VulnerabilityList.jsx, BaseChart.jsx, ChartArea.jsx, analysisSlice.js, package.json  

---

## 一、基线代码审查（Sprint 7 前快照）

### 1.1 ErrorBoundary 现状

| 文件 | 关键发现 |
|------|---------|
| `main.jsx:12-14` | 仅 1 个 `<ErrorBoundary>` 包裹 `<App>`，全局级别 |
| `ErrorBoundary.jsx` | Class Component，捕获渲染错误 → 显示 error Result + 重试/刷新按钮 |
| `App.jsx` | BrowserRouter + AppLayout，无分段 ErrorBoundary |

**Sprint 7 需求：** 各关键 Section（InputSection / ChartArea / VulnerabilityList / AIDetailAnalysis）各自包裹 ErrorBoundary，实现**分层隔离**。

### 1.2 图表懒加载现状

| 文件 | 关键发现 |
|------|---------|
| `ChartArea.jsx:18-21` | 4 个图表组件 **静态 import**：`import PieChart from './charts/PieChart'` 等 |
| `BaseChart.jsx` | 无 lazy 相关逻辑 |
| `package.json` | 无 `@loadable/component` 等懒加载库 |

**Sprint 7 需求：** 将 4 个图表组件改为 `React.lazy()` + `<Suspense>` + IntersectionObserver 懒加载（仅视口内图表初始化）。

### 1.3 虚拟滚动现状

| 文件 | 关键发现 |
|------|---------|
| `VulnerabilityList.jsx:99` | `scroll={{ y: 300 }}` — Antd Table 的**固定高度滚动**，非虚拟滚动 |
| `package.json` | 无 `react-window` / `react-virtualized` / `@tanstack/react-virtual` |

**Sprint 7 需求：** 对 VulnerabilityList 实现虚拟滚动（100+ 条目时自动启用），Antd 6.x Table 原生支持 `virtual` 属性或引入专用虚拟滚动方案。

### 1.4 图表 resize 现状

| 文件 | 关键发现 |
|------|---------|
| `BaseChart.jsx:50-58` | `ResizeObserver` + `chartRef.current.resize()` — 无 debounce/throttle |
| `BaseChart.jsx:60-64` | cleanup：`resizeObserver.disconnect()` + `chartRef.current.dispose()` — 单实例 |

**已知风险：**
- 快速 resize（拖拽窗口）可能频繁触发 ECharts resize，造成性能抖动
- 容器从 hidden → visible 切换时（Tab 切换、侧边栏折叠），ECharts 可能未重新计算尺寸

**Sprint 7 需求：** debounce resize、hidden→visible 重新计算、container 尺寸 0 时不 resize。

### 1.5 布局自适应现状

| 文件 | 关键发现 |
|------|---------|
| `ChartArea.jsx:144` | `grid grid-cols-1 md:grid-cols-2` — 两档断点 |
| `App.jsx` | Header + Content，无侧边栏，无移动端菜单 |
| `LayoutContainer.jsx` | 需确认是否存在 |

**Sprint 7 需求：** 完整的响应式布局体系（mobile/tablet/desktop），包括侧边栏折叠、图表单列/双列自适应、InputSection 响应式排版。

### 1.6 API 重试机制现状

| 文件 | 关键发现 |
|------|---------|
| `analysisSlice.js` | 3 个 createAsyncThunk + AbortController + timeout，**无重试** |
| 错误处理 | `rejectWithValue` 直接返回错误消息 |
| 网络错误 | `err.name === 'AbortError'` 分支处理，其他为 `err.message` |

**Sprint 7 需求：** 对 `analyzeManual` / `analyzeBatch` / `analyzeMultiSource` 添加指数退避重试（最多 3 次），5xx/网络错误才重试，4xx 不重试。

### 1.7 全局 Notification 现状

| 文件 | 关键发现 |
|------|---------|
| `ChartArea.jsx:60,87,100` | 直接调用 `notification.info()` （3 处） |
| `BaseChart.jsx:101,115` | 直接调用 `message.success()` / `message.error()` （2 处） |
| `InputSection.jsx` | 需确认是否有 notification 调用 |
| `store/analysisSlice.js` | 无 notification 相关 reducer |

**现有问题：** 通知分散在各组件中，样式和文案不统一，无持久化/队列机制。

**Sprint 7 需求：** 创建全局 notificationSlice（Redux）或统一 hook，集中管理通知的创建、自动消失、手动关闭、去重。

### 1.8 性能基准现状

| 项目 | 现状 |
|------|------|
| Lighthouse 报告 | 无 |
| Bundle 分析 | 无（vite 未配置 `rollup-plugin-visualizer`） |
| 性能指标文档 | 无 |
| `package.json` scripts | 无 `preview` 之外的性能相关命令 |

**Sprint 7 需求：** 创建 `docs/performance-benchmark.md`，记录关键性能基线（FCP、LCP、TTI、bundle size、chart render time）。

### 1.9 console 残留检查（基线）

```
$ grep -rn "console\." frontend/src/ --include="*.jsx" --include="*.js" | grep -v console.error
(无结果)
```

仅 3 处合法 `console.error`：`ErrorBoundary.jsx:20`、`HistoryPanel.jsx:120`、`eventBus.js:45`。

### 1.10 基线结论

- US-49~55 均为**现有行为的增强/覆盖**，需验收基线的正确替换
- US-56 为**纯文档**产出
- 基线已有 ResizeObserver（US-52 的改造基础）
- 基线已有 0 个 console.log，Sprint 7 不得引入新 console.log
- 基线的 5 处 notification/message 调用需要全部迁移到统一方案（US-55）

---

## 二、US-49: ErrorBoundary 全覆盖

### TC-49-01: 各关键 Section 包裹 ErrorBoundary

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 代码已部署 |
| **测试步骤** | 检查以下组件的渲染层级：<br>1. InputSection<br>2. ChartArea<br>3. VulnerabilityList<br>4. AIDetailAnalysis |
| **期望结果** | 每个 Section 的父级存在独立的 `<ErrorBoundary>` 包裹<br>全局 `main.jsx` 的 `<ErrorBoundary>` 保留 |
| **验收标准** | ✅ 至少 4 个 Section 级 ErrorBoundary + 1 个全局 ErrorBoundary |

### TC-49-02: Section 级错误隔离 — 不影响其他 Section

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 代码已部署，分析结果已展示 |
| **测试步骤** | 1. 模拟 ChartArea 渲染异常（抛 Error）<br>2. 观察 VulnerabilityList 和 AIDetailAnalysis 状态 |
| **期望结果** | ChartArea 区域显示降级 UI（error Result + 重试按钮）<br>VulnerabilityList 和 AIDetailAnalysis **不受影响**，正常渲染 |
| **验收标准** | ✅ 一个 Section 崩溃不影响其余 Section |

### TC-49-03: Section ErrorBoundary 重试按钮

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | 某个 Section 因错误触发 ErrorBoundary 降级 UI |
| **测试步骤** | 点击降级 UI 中的"重试"按钮 |
| **期望结果** | 重新尝试渲染该 Section 及其子组件<br>若错误已修复则恢复正常；若仍失败则再次降级 |
| **验收标准** | ✅ 重试不刷新整页，只重试当前 Section |

### TC-49-04: ErrorBoundary 降级 UI 差异化

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | 不同 Section 触发错误 |
| **测试步骤** | 分别触发 InputSection / ChartArea / VulnerabilityList / AIDetailAnalysis 的渲染错误，观察降级 UI |
| **期望结果** | 降级 UI 标题或文案能区分是哪个 Section 出错<br>例："输入区域加载失败" vs "图表区域渲染出错" |
| **验收标准** | ✅ 降级 UI 包含 Section 名称或可区分的文案 |

### TC-49-05: ErrorBoundary 不吞噬事件处理器错误

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | 分析结果已展示 |
| **测试步骤** | 1. 点击 VulnerabilityList 某行触发 `selectVulnerability`<br>2. 若 dispatch 内部抛同步错误，观察行为 |
| **期望结果** | ErrorBoundary 仅捕获渲染阶段错误，不捕获事件处理器中的错误<br>（React ErrorBoundary 的预期行为：不捕获事件处理器错误） |
| **验收标准** | ✅ 事件处理器中的错误**不会**触发 ErrorBoundary 降级 |

### TC-49-06: 全局 ErrorBoundary 兜底

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 代码已部署 |
| **测试步骤** | 模拟 `AppLayout` 渲染异常（非 Section 级别） |
| **期望结果** | 全局 ErrorBoundary 捕获，显示全页面降级 UI（含"刷新页面"按钮） |
| **验收标准** | ✅ 全局 ErrorBoundary 作为最后兜底正常工作 |

### TC-49-07: ErrorBoundary 控制台错误日志

| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **前置条件** | 某个 Section 触发渲染异常 |
| **测试步骤** | 打开 DevTools Console，触发 Section 渲染错误 |
| **期望结果** | `console.error` 输出包含：<br>- 错误消息<br>- 组件栈（component stack）<br>- Section 标识 |
| **验收标准** | ✅ 错误日志包含足够的调试信息 |

---

## 三、US-50: 图表懒加载

### TC-50-01: 图表组件使用 React.lazy 动态导入

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 代码已提交 |
| **测试步骤** | 检查 `ChartArea.jsx` 的 import 语句 |
| **期望结果** | 4 个图表组件使用 `React.lazy(() => import('...'))` 动态导入<br>不再使用顶层静态 `import PieChart from '...'` |
| **验收标准** | ✅ 所有图表组件改为 lazy import |

### TC-50-02: Suspense fallback 渲染

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | 网络节流（Slow 3G），分析结果已存在 |
| **测试步骤** | 加载 Dashboard 页面，观察图表区域初始状态 |
| **期望结果** | 图表组件加载期间显示 `<Suspense fallback={...}>` 中定义的占位 UI<br>（如 ChartSkeleton 或加载中指示器） |
| **验收标准** | ✅ Suspense fallback 在加载中正确显示 |

### TC-50-03: IntersectionObserver 视口懒加载 — 图表分批渲染

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | 分析结果已展示，图表区 grid 布局 |
| **测试步骤** | 1. 打开 DevTools Network/Performance 面板<br>2. 向下滚动页面<br>3. 观察图表 bundle 加载时机 |
| **期望结果** | 仅**视口内可见**的图表组件才初始化渲染<br>非视口内的图表延迟加载（或仅加载不初始化 ECharts 实例） |
| **验收标准** | ✅ 首次进入时仅加载首屏可见图表（通常 2 个），滚动后才加载其余 |

### TC-50-04: 懒加载对图表功能无影响

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 代码已部署，所有图表已加载 |
| **测试步骤** | 1. 点击饼图类型筛选<br>2. 点击柱状图严重程度筛选<br>3. 点击图表导出 PNG<br>4. 检查 eventBus `chart:exportAll` 批量导出 |
| **期望结果** | 所有交互功能与懒加载前**完全一致** |
| **验收标准** | ✅ 交互功能无回归 |

### TC-50-05: 图表懒加载后首次渲染性能

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | Chrome DevTools Performance 面板 |
| **测试步骤** | 1. 清除缓存，录制 Dashboard 页面加载 Performance<br>2. 对比 Sprint 6 基线：首次 JS 执行时间、ECharts init 时间 |
| **期望结果** | 首次 JS 执行时间 ≤ Sprint 6 基线的 70%（懒加载收益）<br>ECharts 总 init 时间分布在多个帧中 |
| **验收标准** | ✅ 首次交互时间有可测量改善 |

### TC-50-06: 无数据时图表懒加载不触发

| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **前置条件** | 页面初始状态，未进行分析 |
| **测试步骤** | 检查 Network 面板 |
| **期望结果** | 图表组件 bundle 不在初始加载中<br>仅当 `vulnerabilities.length > 0` 且视口可见时才加载 |
| **验收标准** | ✅ 无数据时不加载图表 bundle |

### TC-50-07: vite 构建后 chart chunk 分离

| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **前置条件** | `npm run build` 完成 |
| **测试步骤** | 检查 `dist/assets/` 目录 |
| **期望结果** | 4 个图表组件各自生成独立的 chunk（或一个 charts chunk）<br>不合并到主 bundle 中 |
| **验收标准** | ✅ 图表代码与主 bundle 分离，支持按需加载 |

---

## 四、US-51: 虚拟滚动

### TC-51-01: VulnerabilityList 虚拟滚动实现

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 代码已部署，vulnerabilities.length ≥ 100 |
| **测试步骤** | 1. 制造 200+ 条漏洞数据<br>2. 渲染 VulnerabilityList<br>3. 打开 DevTools Elements 面板，检查渲染的 DOM 节点数 |
| **期望结果** | DOM 中实际渲染的 `<tr>` 数量远小于数据总量（仅视口内 + 缓冲区行）<br>Antd Table 的 `virtual` prop 已启用 |
| **验收标准** | ✅ 200 条数据时 DOM 渲染 ≤ 30 个 `<tr>` 节点 |

### TC-51-02: 虚拟滚动列表滚动流畅性

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | 200+ 条漏洞数据 |
| **测试步骤** | 1. 快速滚动 VulnerabilityList 列表<br>2. 观察 FPS（Chrome DevTools Rendering → FPS meter） |
| **期望结果** | 滚动过程中 FPS ≥ 50，无白屏/闪烁/明显卡顿 |
| **验收标准** | ✅ 虚拟滚动不产生 jank |

### TC-51-03: 虚拟滚动行点击高亮正常

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | 200+ 条漏洞数据 |
| **测试步骤** | 1. 点击列表中第 150 条漏洞<br>2. 观察右侧 AIDetailAnalysis 更新<br>3. 向上滚动回到列表顶部 |
| **期望结果** | 点击行后：<br>- `currentVulnerability` 正确更新<br>- 选中行高亮（蓝色背景）正常<br>- 滚动后回到该行位置，高亮仍然存在 |
| **验收标准** | ✅ 选中行在虚拟滚动中状态保持 |

### TC-51-04: 虚拟滚动与交叉筛选协同

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | 200+ 条混合漏洞数据 |
| **测试步骤** | 1. 通过图表筛选器筛选特定类型<br>2. 观察 VulnerabilityList 更新和虚拟滚动状态 |
| **期望结果** | 筛选后列表重新计算虚拟行高度/数量<br>无渲染错误，数据正确 |
| **验收标准** | ✅ 筛选操作不破坏虚拟滚动状态 |

### TC-51-05: 少量数据时虚拟滚动不启用

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | vulnerabilities.length < 100 |
| **测试步骤** | 分析返回少量漏洞（如 5 条），渲染 VulnerabilityList |
| **期望结果** | 虚拟滚动功能不启用或自动降级为普通渲染<br>列表表现与 Sprint 6 一致 |
| **验收标准** | ✅ 少量数据时行为无退化 |

### TC-51-06: 空数据处理

| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **前置条件** | vulnerabilities.length === 0 |
| **测试步骤** | 页面初始状态 |
| **期望结果** | 显示 Empty 占位，不初始化虚拟滚动 |
| **验收标准** | ✅ 空列表不触发虚拟滚动逻辑 |

### TC-51-07: 虚拟滚动行高一致性

| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **前置条件** | 不同漏洞的 vuln_name 长度差异大（短名称 + 超长名称） |
| **测试步骤** | 渲染列表，检查各行高度 |
| **期望结果** | 行高统一（单行 + ellipsis），不因内容长短而变化<br>无布局错位 |
| **验收标准** | ✅ 行高一致，无抖动 |

---

## 五、US-52: 图表 resize 修复

### TC-52-01: ResizeObserver debounce 生效

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 代码已部署，图表已渲染 |
| **测试步骤** | 1. 打开 Chrome DevTools Performance 面板开始录制<br>2. 快速拖动浏览器窗口边缘，连续 resize 5 秒<br>3. 停止录制，检查 ECharts resize 调用频率 |
| **期望结果** | `chartRef.current.resize()` 调用频率大幅降低（含 debounce 150-300ms）<br>快速 resize 期间不会每帧都调用 resize |
| **验收标准** | ✅ resize 调用频率 ≤ 每秒 6 次 |

### TC-52-02: 容器尺寸为 0 时不 resize

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | 图表已渲染 |
| **测试步骤** | 1. 将图表容器 `display: none` 或 `width: 0`（模拟侧边栏折叠/隐藏）<br>2. 检查 console 是否有 ECharts 报错 |
| **期望结果** | 容器尺寸为 0 时 `resize()` 被跳过<br>**无** ECharts 相关的 "width/height should not be 0" 警告或错误 |
| **验收标准** | ✅ 尺寸为 0 时不调用 resize，无 ECharts 错误 |

### TC-52-03: 隐藏→显示时图表重新渲染

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | 图表初始渲染后，隐藏再显示（如 Tab 切换 / 侧边栏展开） |
| **测试步骤** | 1. 切换 Tab 使图表不可见<br>2. 等待 2 秒<br>3. 切换回图表 Tab |
| **期望结果** | 图表在变为可见后自动调用 `resize()`<br>图表尺寸正确填充容器，无空白/溢出 |
| **验收标准** | ✅ 隐藏→显示的图表尺寸自适应正确 |

### TC-52-04: resize cleanup 不泄漏

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | Sprint 7 代码 |
| **测试步骤** | 1. 检查 BaseChart useEffect cleanup 逻辑<br>2. 分析完成后挂载图表 → 清空分析（unmount 图表）→ 再次分析（重新 mount）<br>3. 在 DevTools Memory 中抓取堆快照，对比 mount/unmount 循环 10 次 |
| **期望结果** | 每次 unmount 都正确调用 `resizeObserver.disconnect()` 和 `chartRef.current.dispose()`<br>堆内存无持续增长（无 ECharts 实例泄漏） |
| **验收标准** | ✅ 无 ResizeObserver 或 ECharts 实例泄漏 |

### TC-52-05: 4 个图表同时 resize 不冲突

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | 4 个图表均在视口中可见 |
| **测试步骤** | 快速 resize 窗口，观察 console 和页面 |
| **期望结果** | 4 个图表的 resize 各自独立，互不干扰<br>无竞态条件、无 console 报错 |
| **验收标准** | ✅ 多图表 resize 无冲突 |

### TC-52-06: 移动端横竖屏切换

| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **前置条件** | DevTools Device Toolbar 切换到移动端（375px） |
| **测试步骤** | 1. 竖屏（375×812）渲染图表<br>2. 切换到横屏（812×375） |
| **期望结果** | 图表自动填充新宽度，文字/图例缩放合理<br>无截断、无溢出 |
| **验收标准** | ✅ 横竖屏切换图表自适应 |

### TC-52-07: ResizeObserver polyfill 兼容性

| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **前置条件** | 无（代码审查） |
| **测试步骤** | 1. 检查是否使用了 `ResizeObserver` polyfill<br>2. 确认在支持的浏览器中不使用 polyfill |
| **期望结果** | 若使用 polyfill，仅在 `typeof ResizeObserver === 'undefined'` 时加载<br>若不使用 polyfill，package.json 的 browserslist 覆盖 ResizeObserver 支持的浏览器 |
| **验收标准** | ✅ 不因 ResizeObserver 缺失而导致功能不可用 |

---

## 六、US-53: 布局自适应终版

### TC-53-01: 移动端布局（< 768px）

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 代码已部署，分析成功 |
| **测试步骤** | DevTools 切换到 375px（iPhone SE），检查：<br>1. 导航栏<br>2. InputSection<br>3. 图表区<br>4. VulnerabilityList<br>5. AIDetailAnalysis |
| **期望结果** | - 导航栏：标题可见，导航项折叠为汉堡菜单或水平排列<br>- InputSection：全宽，textarea 适配<br>- 图表区：单列 `grid-cols-1`<br>- VulnerabilityList + AIDetailAnalysis：上下堆叠，非左右分栏<br>- 无横向滚动条 |
| **验收标准** | ✅ 375px 宽度下所有内容正常展示，无横向溢出 |

### TC-53-02: 平板布局（768px — 1024px）

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | 分析成功 |
| **测试步骤** | DevTools 切换到 820px（iPad Air），检查布局 |
| **期望结果** | - 导航栏：全尺寸显示<br>- 图表区：双列 `md:grid-cols-2`<br>- VulnerabilityList + AIDetailAnalysis：左右分栏<br>- InputSection：合理宽度 |
| **验收标准** | ✅ 820px 布局充分利用空间，各区域比例合理 |

### TC-53-03: 桌面布局（≥ 1024px）

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | 分析成功 |
| **测试步骤** | DevTools 切换到 1440px，检查布局 |
| **期望结果** | - 三栏或两栏布局居中，最大宽度合理（如 `max-w-7xl`）<br>- 图表区双列<br>- VulnerabilityList（左侧 ~40%）+ AIDetailAnalysis（右侧 ~60%）<br>- 内容不无限拉伸 |
| **验收标准** | ✅ 桌面布局视觉舒适，内容居中，最大宽度限制生效 |

### TC-53-04: 导航栏响应式折叠

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | Sprint 7 代码已部署 |
| **测试步骤** | 1. 桌面模式（≥ 768px）：导航项水平排列<br>2. 移动端（< 768px）：导航项折叠为菜单 |
| **期望结果** | 移动端导航菜单可展开/收起<br>路由切换后菜单自动收起<br>当前路由高亮 |
| **验收标准** | ✅ 导航在移动端和桌面端均正常 |

### TC-53-05: InputSection 响应式排版

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | 页面加载 |
| **测试步骤** | 在不同视口宽度检查 InputSection 排版 |
| **期望结果** | - 移动端：输入框/按钮全宽，垂直堆叠<br>- 桌面端：水平排列或合理分组<br>- Tabs 不溢出 |
| **验收标准** | ✅ InputSection 在所有断点下排版合理 |

### TC-53-06: 侧边栏折叠（若实现）

| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **前置条件** | Sprint 7 实现了侧边栏布局 |
| **测试步骤** | 点击侧边栏折叠按钮 |
| **期望结果** | 侧边栏折叠后主内容区自动扩展填满<br>隐藏→展开时图表 resize 正常触发 |
| **验收标准** | ✅ 侧边栏折叠不破坏图表/列表渲染 |

### TC-53-07: 内容无横向溢出

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 代码已部署 |
| **测试步骤** | 在 320px、375px、414px、768px、1024px、1440px 下检查是否存在横向滚动条 |
| **期望结果** | 所有断点下**无**横向滚动条（`overflow-x: hidden` 或内容自适应） |
| **验收标准** | ✅ 所有主流断点下 0 横向溢出 |

### TC-53-08: 超宽内容截断

| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **前置条件** | 存在超长 vuln_name（100+ 字符不含空格） |
| **测试步骤** | 检查 VulnerabilityList 的表头和 AIDetailAnalysis 的标题 |
| **期望结果** | 超长文本正确截断（text-ellipsis）或换行<br>不撑开表格/卡片宽度 |
| **验收标准** | ✅ 超长内容不破坏布局 |

---

## 七、US-54: API 重试机制

### TC-54-01: 网络错误自动重试

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 代码已部署 |
| **测试步骤** | 1. 断开网络或模拟 `fetch` 失败<br>2. 提交分析请求<br>3. 恢复网络 |
| **期望结果** | 自动重试（最多 3 次），指数退避<br>第 3 次失败后返回 `rejectWithValue` |
| **验收标准** | ✅ 临时网络中断触发自动重试 |

### TC-54-02: 5xx 服务器错误重试

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | 后端返回 HTTP 500/502/503 |
| **测试步骤** | 模拟后端返回 500，提交分析 |
| **期望结果** | 对 5xx 响应自动重试（最多 3 次）<br>指数退避间隔约为 1s → 2s → 4s |
| **验收标准** | ✅ 5xx 错误触发重试 |

### TC-54-03: 4xx 错误不重试

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | 后端返回 HTTP 400/404/422 |
| **测试步骤** | 提交无效参数触发 422 |
| **期望结果** | **立即**返回错误，不进行任何重试<br>UI 显示对应的错误消息 |
| **验收标准** | ✅ 4xx 错误不浪费重试次数 |

### TC-54-04: 指数退避时间合理

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | 代码已提交 |
| **测试步骤** | 检查重试逻辑中的退避间隔 |
| **期望结果** | 退避策略至少为指数退避：第 1 次重试 1s，第 2 次 2s，第 3 次 4s<br>（或带 ±25% 随机抖动 jitter） |
| **验收标准** | ✅ 退避间隔随重试次数递增 |

### TC-54-05: AbortController timeout 与重试协同

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | 后端响应缓慢 |
| **测试步骤** | 1. 模拟后端延迟 35 秒（超时设置为 30s）<br>2. 观察重试行为 |
| **期望结果** | 30s 超时后 abort，视为网络错误触发重试<br>每次重试使用新的 AbortController + 新的 timeout |
| **验收标准** | ✅ timeout 与重试机制不冲突 |

### TC-54-06: 重试进度 UI 反馈

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | 网络不稳定 |
| **测试步骤** | 触发网络错误，观察 UI 状态 |
| **期望结果** | 显示类似 "正在重试 (1/3)..." 的反馈<br>按钮保持 loading 状态 |
| **验收标准** | ✅ 用户能感知重试正在进行 |

### TC-54-07: 所有 thunk 统一重试

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 代码 |
| **测试步骤** | 分别测试 `analyzeManual` / `analyzeBatch` / `analyzeMultiSource` 的网络错误场景 |
| **期望结果** | 所有 3 个 thunk 均具有重试能力<br>重试逻辑由共享的 wrapper 函数提供（非重复代码） |
| **验收标准** | ✅ 3 个 API thunk 均有重试能力，逻辑复用 |

### TC-54-08: 用户手动取消不触发重试

| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **前置条件** | 提交分析后，请求进行中 |
| **测试步骤** | 1. 点击分析后，立即点击"取消"或"清除分析"<br>2. 观察是否有重试 |
| **期望结果** | 用户取消的请求**不触发重试**<br>如果是通过 AbortController.abort() 取消的，应跳过重试 |
| **验收标准** | ✅ 用户主动取消不重试 |

---

## 八、US-55: 全局 Notification

### TC-55-01: 统一 Notification store/机制存在

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 代码已提交 |
| **测试步骤** | 检查是否存在以下之一：<br>1. Redux notificationSlice<br>2. 自定义 `useNotification` hook<br>3. 全局 NotificationProvider 组件 |
| **期望结果** | 存在集中的通知管理机制<br>组件不再直接调用 `antd.notification.info()` 或 `antd.message.success()` |
| **验收标准** | ✅ 全局通知方案已实现 |

### TC-55-02: 组件迁移 — 无直接 antd notification 调用

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 代码已提交 |
| **测试步骤** | `grep -rn "notification\." frontend/src/components/ --include="*.jsx"` |
| **期望结果** | 0 个 `notification.info()` / `notification.success()` 直接调用<br>仅全局 notification 管理层中允许使用 antd notification API |
| **验收标准** | ✅ 组件层无直接 notification API 调用 |

### TC-55-03: 通知类型支持

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 代码已部署 |
| **测试步骤** | 依次触发以下场景：<br>1. 分析成功 → success 通知<br>2. 分析失败 → error 通知<br>3. 图表筛选 → info 通知<br>4. 数据保存中 → warning 通知 |
| **期望结果** | 每种类型通知样式正确（颜色/图标）<br>文案清晰，格式统一 |
| **验收标准** | ✅ 至少支持 success / error / info / warning 4 种类型 |

### TC-55-04: 通知自动消失

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | 触发任意通知 |
| **测试步骤** | 等待通知出现，不手动关闭 |
| **期望结果** | 通知在 3-5 秒后自动消失<br>duration 可通过配置调整 |
| **验收标准** | ✅ 通知有合理的自动消失时间 |

### TC-55-05: 通知去重

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | 同一操作触发多次相同通知 |
| **测试步骤** | 快速连续 3 次点击"重置筛选"按钮 |
| **期望结果** | 相同内容的通知在短时间内**只显示 1 条**（或替换前一条）<br>不会叠加 3 条完全相同的通知 |
| **验收标准** | ✅ 相同通知去重 |

### TC-55-06: 通知队列上限

| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **前置条件** | 快速触发 10+ 条不同通知 |
| **测试步骤** | 连续触发多种不同操作的通知 |
| **期望结果** | 同时最多显示 3-5 条通知<br>超出部分排队等待，不堆满屏幕 |
| **验收标准** | ✅ 通知有数量上限，不遮挡主要内容 |

### TC-55-07: 通知可手动关闭

| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **前置条件** | 触发一条通知 |
| **测试步骤** | 点击通知右上角的关闭按钮 |
| **期望结果** | 通知立即关闭，不等待自动消失 |
| **验收标准** | ✅ 所有类型通知均可手动关闭 |

### TC-55-08: Notification 不影响现有 eventBus 通知

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | 图表交互触发 `emit('chart:filter', ...)` |
| **测试步骤** | 点击图表 → 确认 AIDetailAnalysis 更新 → 检查通知 |
| **期望结果** | `chart:filter` 事件仍然正常投递到 AIDetailAnalysis<br>通知内容包含筛选信息 |
| **验收标准** | ✅ 全局 Notification 不破坏 eventBus 通信 |

---

## 九、US-56: 性能基准文档

### TC-56-01: 文档文件存在

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 交付物已提交 |
| **测试步骤** | 检查 `docs/performance-benchmark.md` 是否存在 |
| **期望结果** | 文件存在，内容非空 |
| **验收标准** | ✅ 文档已交付 |

### TC-56-02: 文档包含关键性能指标

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | 文档存在 |
| **测试步骤** | 检查文档目录和内容 |
| **期望结果** | 至少包含以下指标的说明和基线值：<br>1. **FCP** (First Contentful Paint)<br>2. **LCP** (Largest Contentful Paint)<br>3. **TTI** (Time to Interactive)<br>4. **Bundle Size** (主 bundle + chart chunk + vendor chunk)<br>5. **图表首次渲染时间** (ECharts init + first paint) |
| **验收标准** | ✅ 5 项核心指标均有记录 |

### TC-56-03: 文档包含测试环境说明

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | 文档存在 |
| **测试步骤** | 检查文档中"测试环境"章节 |
| **期望结果** | 包含：<br>- 网络条件（如 "Fast 3G throttling"）<br>- 硬件配置<br>- 浏览器版本<br>- 测试数据量<br>- Lighthouse 版本 |
| **验收标准** | ✅ 测试环境可复现 |

### TC-56-04: 文档包含对比数据

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | 文档存在 |
| **测试步骤** | 检查是否有 Sprint 6 vs Sprint 7 的对比 |
| **期望结果** | 关键指标有 Sprint 6 基线 vs Sprint 7 优化后的数值对比<br>包含改善百分比 |
| **验收标准** | ✅ 优化前后对比，改善可见 |

### TC-56-05: 文档包含 bundle 分析

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | 运行 `npm run build` |
| **测试步骤** | 检查文档中的 bundle 分析章节 |
| **期望结果** | 包含：<br>- 主 bundle 大小<br>- 各 chunk 大小（vendor / chart / main）<br>- gzip/brotli 压缩后大小<br>- 与 Sprint 6 的对比 |
| **验收标准** | ✅ Bundle 分析数据准确 |

### TC-56-06: 文档包含优化建议

| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **前置条件** | 文档存在 |
| **测试步骤** | 检查文档末尾 |
| **期望结果** | 包含：<br>- 当前已知瓶颈<br>- 进一步优化建议（如 HTTP/2 push、CDN、SSR 等）<br>- 优先级排序 |
| **验收标准** | ✅ 有 actionable 的后续优化建议 |

### TC-56-07: 文档格式和可读性

| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **前置条件** | 文档存在 |
| **测试步骤** | 阅读文档 |
| **期望结果** | Markdown 格式规范<br>表格/列表排版清晰<br>无拼写错误<br>中英文混排合理 |
| **验收标准** | ✅ 文档专业可读 |

---

## 十、集成 & 回归测试

### TC-INT-01: 完整用户流程 — 分析→懒加载→交互→重试

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 全部 US 已实现 |
| **测试步骤** | 1. 加载页面（确认首屏性能）<br>2. 输入漏洞描述 → 开始 AI 分析<br>3. 等待分析完成 → 确认图表懒加载后渲染正常<br>4. 点击图表筛选（确认全局 notification 显示）<br>5. 切换移动端布局（确认响应式正常）<br>6. 断开网络 → 重新提交分析（确认 retry 机制）<br>7. 恢复网络 → 确认最终成功 |
| **期望结果** | 全流程无报错，UI/UX 正常 |
| **验收标准** | ✅ 端到端流程通过 |

### TC-INT-02: 回归 — 现有分析功能不受影响

| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | Sprint 7 代码已部署 |
| **测试步骤** | 1. 手动分析（analyzeManual）正常提交并展示<br>2. 文件上传 + 批量分析（analyzeBatch）正常<br>3. 多源对比（analyzeMultiSource）正常<br>4. 历史记录查询正常<br>5. 图表交叉筛选正常<br>6. AI 详情面板正常<br>7. 加固清单勾选/持久化正常<br>8. PNG 导出正常<br>9. PDF 报告导出正常<br>10. ExportActions 批量导出正常 |
| **期望结果** | Sprint 1-6 所有功能无回归 |
| **验收标准** | ✅ 无现有功能受损 |

### TC-INT-03: 错误边界 + 重试 + 通知协同

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | Sprint 7 全部 US 已实现 |
| **测试步骤** | 1. 触发分析请求 → 网络错误 → 自动重试<br>2. 重试期间触发 Section 渲染错误<br>3. 观察 ErrorBoundary 降级 + 重试通知 + 错误通知的共存 |
| **期望结果** | 多个错误/通知机制不冲突：<br>- ErrorBoundary 降级独立于 API 重试<br>- 重试通知和错误通知区分清晰<br>- 不出现通知风暴 |
| **验收标准** | ✅ 复杂场景下所有机制协同工作 |

### TC-INT-04: 性能回归 — 主流程 bundle 大小

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | `npm run build` 完成 |
| **测试步骤** | 1. 检查 `dist/assets/` 目录<br>2. 对比 Sprint 6 build 产物 |
| **期望结果** | 主 bundle 不显著增大（< 10% 增幅）<br>图表 chunk 拆分后按需加载<br>虚拟滚动依赖（如有）不显著增大 bundle |
| **验收标准** | ✅ 构建产物体积合理 |

### TC-INT-05: 回归 — RateLimit 中间件

| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | 后端已部署 |
| **测试步骤** | 快速连续请求 /api/analyze/manual 超过 10 次<br>（注意：retry 重试次数不计入 RateLimit） |
| **期望结果** | 第 11 次请求返回 429<br>retry 机制不绕过 RateLimit |
| **验收标准** | ✅ RateLimiter 与 retry 机制不冲突 |

---

## 十一、测试统计

| 分类 | 用例数 | P0 | P1 | P2 |
|------|--------|-----|-----|-----|
| US-49 ErrorBoundary 全覆盖 | 7 | 4 | 2 | 1 |
| US-50 图表懒加载 | 7 | 4 | 1 | 2 |
| US-51 虚拟滚动 | 7 | 3 | 2 | 2 |
| US-52 图表 resize 修复 | 7 | 3 | 2 | 2 |
| US-53 布局自适应终版 | 8 | 4 | 2 | 2 |
| US-54 API 重试机制 | 8 | 4 | 2 | 2 |
| US-55 全局 Notification | 8 | 3 | 3 | 2 |
| US-56 性能基准文档 | 7 | 2 | 3 | 2 |
| 集成/回归 | 5 | 2 | 3 | 0 |
| **总计** | **64** | **29** | **20** | **15** |

---

## 十二、Sprint 7 专项检查清单

### 🔴 高风险项（必须通过）

| 检查项 | 对应 TC |
|--------|---------|
| 4 个 Section ErrorBoundary 各自独立 | TC-49-01, 02 |
| 图表改为 React.lazy 动态导入 | TC-50-01 |
| 虚拟滚动在 200 条数据时 DOM 节点 < 30 | TC-51-01 |
| resize debounce 生效 | TC-52-01 |
| 所有断点无横向溢出 | TC-53-07 |
| 网络错误自动重试 | TC-54-01 |
| 组件层无直接 notification API 调用 | TC-55-02 |
| 性能基准文档交付 | TC-56-01 |

### 🟡 中风险项

| 检查项 | 对应 TC |
|--------|---------|
| 懒加载对交互无回归 | TC-50-04 |
| 虚拟滚动与交叉筛选协同 | TC-51-04 |
| 隐藏→显示 resize | TC-52-03 |
| 移动端导航折叠 | TC-53-04 |
| AbortController timeout + retry 协同 | TC-54-05 |
| 通知去重 | TC-55-05 |

### 🟢 低风险项

| 检查项 | 对应 TC |
|--------|---------|
| vite chunk 分离验证 | TC-50-07 |
| ResizeObserver polyfill 兼容 | TC-52-07 |
| 侧边栏折叠 | TC-53-06 |
| 用户取消不重试 | TC-54-08 |
| 通知队列上限 | TC-55-06 |
| 文档格式可读性 | TC-56-07 |

---

## 十三、验收就绪声明

> ✅ **QA 基线审查完成**  
> ✅ **64 条 Sprint 7 测试用例已编写**  
> ✅ **所有 US（49-56）均已覆盖**  
> ✅ **包含 5 条集成/回归测试**  
> ✅ **高风险 8 项 + 中风险 6 项 + 低风险 6 项已标记**  
> 
> **等待 Developer 提交 Sprint 7 代码后执行验收测试。**
> 
> **预计验收执行时间:** ~60 分钟（含手动 UI 验证 + 性能测量 + 文档审查）

---

*QA Agent: robot01 | 生成时间: 2026-06-30 18:07 CST*
