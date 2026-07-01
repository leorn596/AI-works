# Sprint 6 验收报告

**日期**: 2026-06-30 17:55 CST
**验收人**: QA Agent (subagent)
**服务端**: localhost:8000 (uvicorn, PID 62135, Python 3.11)
**项目路径**: `/root/.openclaw/workspace/robot01/ai-vuln-platform/`

---

## 验收概览

| User Story | 描述 | 判定 |
|---|---|---|
| T6.1 | BaseChart 单图 PNG 导出按钮 | ✅ ACCEPT |
| T6.2 | PDF 报告导出 (后端 + 前端) | ✅ ACCEPT |
| T6.3 | 批量 PNG 导出 (eventBus 联动) | ✅ ACCEPT |
| T6.4 | ExportActions 组件集成 (AIDetailAnalysis + CrossValidation) | ✅ ACCEPT |
| T6.0 | HistoryPanel checklist DB 状态合并 + taskId 传递 | ✅ ACCEPT |
| T6.0 | InputSection URL Tab 占位 | ✅ ACCEPT |
| — | weasyprint → xhtml2pdf 迁移 (requirements.txt + Dockerfile) | ✅ ACCEPT |

**结论: 7/7 ACCEPT，0 REJECT，全部通过。**

---

## 第一步：API 测试

### 1.1 PDF 导出 — 正常用例

```bash
# Task 2 (0 vulns, 0 checklist items)
$ curl -s -o /tmp/sprint6.pdf -w "HTTP %{http_code} size %{size_download}" http://localhost:8000/api/report/2/pdf
HTTP 200 size 2982

$ file /tmp/sprint6.pdf
/tmp/sprint6.pdf: PDF document, version 1.4  ✅

# Task 5 (1 vuln, 5 checklist items) — full mode
$ curl -s -o /tmp/sprint6_task5.pdf -w "HTTP %{http_code} size %{size_download}" http://localhost:8000/api/report/5/pdf
HTTP 200 size 5057

$ file /tmp/sprint6_task5.pdf
/tmp/sprint6_task5.pdf: PDF document, version 1.4  ✅

# Task 5 — summary mode
$ curl -s -o /tmp/sprint6_summary.pdf -w "HTTP %{http_code} size %{size_download}" "http://localhost:8000/api/report/5/pdf?mode=summary"
HTTP 200 size 2917

$ file /tmp/sprint6_summary.pdf
/tmp/sprint6_summary.pdf: PDF document, version 1.4  ✅
```

**验证点**:
- full 模式比 summary 模式大 ~2100 字节（漏洞明细 + checklist 内容）✅
- 所有文件均为合法 PDF 1.4 格式 ✅

### 1.2 PDF 导出 — 异常用例

```bash
# 不存在的任务
$ curl http://localhost:8000/api/report/999/pdf
{"detail":"任务不存在"}  → HTTP 404 ✅

# 非法 mode 参数
$ curl "http://localhost:8000/api/report/5/pdf?mode=invalid"
{"detail":[{"msg":"String should match pattern '^(summary|full)$'",...}]}  → HTTP 422 ✅
```

### 1.3 History 详情（含 checklist）

```bash
$ curl -s http://localhost:8000/api/history/5 | python3 -c "import json,sys; d=json.load(sys.stdin); print('checklist:', len(d['data'].get('checklist',[])))"
checklist: 5  ✅

$ curl -s http://localhost:8000/api/history/999
{"detail":"任务不存在"}  → HTTP 404 ✅
```

**验证点**:
- checklist 字段存在，包含 5 条记录（与 task 5 的 remediation_items 一致）✅
- checklist 记录包含 `id`, `item_text`, `is_completed` 字段 ✅

---

## 第二步：代码审查

### T6.1 — BaseChart 单图 PNG 导出

**文件**: `frontend/src/components/charts/BaseChart.jsx`

| 检查项 | 结果 |
|---|---|
| `chartType` prop 声明 + 默认值 `'chart'` | ✅ |
| 下载按钮 DOM 渲染（`aria-label="导出图表为 PNG"`） | ✅ |
| `handleExportPNG` 调用 `chartRef.current.getDataURL()` | ✅ |
| pixelRatio=2 高质量导出 | ✅ |
| 创建 `<a>` 标签触发下载，文件名含时间戳 | ✅ |
| Loading 状态（`exporting` state + Button loading prop） | ✅ |
| 错误捕获 + `message.error` 提示 | ✅ |
| 图表未初始化时的保护（message.error 提示） | ✅ |

**子图表 chartType 传递验证**:

| 文件 | chartType 值 |
|---|---|
| PieChart.jsx | `"pie"` ✅ |
| BarChart.jsx | `"bar"` ✅ |
| RadarChart.jsx | `"radar"` ✅ |
| TrendChart.jsx | `"trend"` ✅ |

### T6.2 — PDF 报告后端

**文件**: `backend/app/services/pdf_service.py`

| 检查项 | 结果 |
|---|---|
| xhtml2pdf 导入（非 weasyprint） | ✅ |
| HTML 模板含完整 CSS（@page A4、中文字体栈） | ✅ |
| 严重程度标签 + 颜色映射（`_severity_label` / `_severity_color`） | ✅ |
| 漏洞明细表格渲染（`_render_vuln_rows`） | ✅ |
| 加固清单渲染（`_render_checklist_section`） | ✅ |
| `generate_pdf_html` 支持 full/summary 两种模式 | ✅ |
| `generate_pdf_bytes` 错误处理（ImportError → RuntimeError） | ✅ |
| 异步函数签名 | ✅ |

**路由** (`backend/app/api/routes.py:380-450`):

| 检查项 | 结果 |
|---|---|
| GET `/report/{task_id}/pdf` 路由定义 | ✅ |
| mode Query 参数，regex 校验 `^(summary\|full)$` | ✅ |
| 任务存在性检查 → 404 | ✅ |
| 任务状态检查（必须 completed）→ 400 | ✅ |
| 链接 vulnerabilities + remediation_items association | ✅ |
| StreamingResponse with `application/pdf` Content-Type | ✅ |
| Content-Disposition 附件下载头 | ✅ |

**前端** (`frontend/src/components/ExportActions.jsx`):

| 检查项 | 结果 |
|---|---|
| PDF 下拉菜单（full / summary） | ✅ |
| `handleExportPDF(mode)` fetch + blob 下载 | ✅ |
| PDF loading 状态 + 成功/失败 message | ✅ |
| URL.createObjectURL + revokeObjectURL 清理 | ✅ |
| taskId 为空的保护（message.warning） | ✅ |

### T6.3 — 批量 PNG 导出 (eventBus 联动)

**流程**: ExportActions → `emit('chart:exportAll')` → 所有 BaseChart → 各自导出

| 检查项 | 结果 |
|---|---|
| ExportActions 中 `emit('chart:exportAll')` 触发 | ✅ |
| BaseChart 中 `useEffect` 监听 `chart:exportAll` | ✅ |
| 每个 BaseChart 独立调用 `getDataURL` + 触发下载 | ✅ |
| eventBus `off` 清理在 useEffect return 中 | ✅ |
| eventBus error 隔离（per-listener try/catch） | ✅ |

**注意**: `handleExportPNG` 设置 `pngLoading=true` 后立即在 finally 设 false，loading 指示器可能一闪而过。这是微小 UX 体验问题，不影响功能正确性。**建议后续 Sprint 改为真正的异步等待（例如等待所有 chart 完成回调），但当前实现已满足验收标准。**

### T6.4 — ExportActions 组件集成

**集成点 1** — `AIDetailAnalysis.jsx`:

| 检查项 | 结果 |
|---|---|
| 导入 ExportActions 组件 | ✅ |
| 仅在 `status === 'success'` 时渲染 | ✅ |
| 传递 `taskId` 从 Redux store | ✅ |
| 放置于标题行右侧（与 h3 同 flex row） | ✅ |

**集成点 2** — `CrossValidation.jsx`:

| 检查项 | 结果 |
|---|---|
| 导入 ExportActions 组件 | ✅ |
| 传递 `taskId` 从 Redux store | ✅ |
| 放置于结果头部右侧（与统计 Tags 同行） | ✅ |

### T6.0 — HistoryPanel DB 状态合并 + taskId 传递

**文件**: `frontend/src/store/analysisSlice.js`

| 检查项 | 结果 |
|---|---|
| 新增 `checklist: []` initial state | ✅ |
| 新增 `taskId: null` initial state | ✅ |
| `setChecklist` reducer | ✅ |
| `setTaskId` reducer | ✅ |
| 两个 reducer 均导出（actions 对象） | ✅ |
| `clearAnalysis` 清空两个新字段 | ✅ |
| `analyzeManual.fulfilled` 设置 `checklist` + `taskId` | ✅ |
| `analyzeBatch.fulfilled` 设置 `checklist` + `taskId` | ✅ |
| `analyzeMultiSource.fulfilled` 设置 `taskId`（checklist 合理省略） | ✅ |

**文件**: `frontend/src/components/HistoryPanel.jsx`

| 检查项 | 结果 |
|---|---|
| 导入 `setChecklist` + `setTaskId` | ✅ |
| `handleLoadDetail` 中 `dispatch(setChecklist(...))` | ✅ |
| `handleLoadDetail` 中 `dispatch(setTaskId(taskId))` | ✅ |

**文件**: `frontend/src/components/RemediationChecklist.jsx`

| 检查项 | 结果 |
|---|---|
| `useEffect` 监听 `rawChecklist` 变化 | ✅ |
| 检测 `is_completed` 字段并合并到 localStorage | ✅ |
| localStorage 作为 fallback（DB 优先） | ✅ |
| 合并策略：DB 完成状态覆盖 localStorage | ✅ |
| 持久化到 localStorage | ✅ |

### URL Tab 占位

**文件**: `frontend/src/components/InputSection.jsx`

| 检查项 | 结果 |
|---|---|
| Tab key `"url"` 存在 | ✅ |
| `LinkOutlined` 图标 | ✅ |
| URL 输入框（disabled 状态 + placeholder） | ✅ |
| 蓝色提示横幅 "🚀 URL 扫描功能即将上线" | ✅ |
| Tab 顺序（URL → 文件上传 → 多源对比 → 手动描述） | ✅ |

### 依赖迁移: weasyprint → xhtml2pdf

**文件**: `backend/requirements.txt`

| 检查项 | 结果 |
|---|---|
| `weasyprint` 已移除 | ✅ |
| `xhtml2pdf>=0.2.15` 已添加 | ✅ |
| 无 weasyprint 相关系统依赖残留 | ✅ |

**文件**: `docker/backend.Dockerfile`

| 检查项 | 结果 |
|---|---|
| 无 Pango / cairo / GDK 等 weasyprint 系统依赖 | ✅ |
| 仅保留 gcc + default-libmysqlclient-dev | ✅ |
| 轻量化依赖组合 | ✅ |

---

## 第三步：回归检查

| 检查项 | 结果 |
|---|---|
| 所有 14 个预期文件存在 | ✅ |
| 后端服务正常运行（uvicorn） | ✅ |
| 数据库连接正常（task 1-5 可查询） | ✅ |
| 历史记录 API 正常 | ✅ |
| Redux store 无破坏性变更（仅添加字段/reducer） | ✅ |
| eventBus 工具函数未修改（const listeners 唯一实例） | ✅ |

---

## 发现的问题

### 问题 1: pdf_service.py 文档注释残留 [MINOR]
- **位置**: `backend/app/services/pdf_service.py:101`
- **描述**: Docstring 中写 "ready for WeasyPrint rendering"，应为 "xhtml2pdf"
- **严重度**: 极低 — 不影响功能，仅注释文本不准确
- **建议**: 后续修改

### 问题 2: PNG 批量导出 loading 闪烁 [MINOR]
- **位置**: `frontend/src/components/ExportActions.jsx:47-53`
- **描述**: `handleExportPNG` 设置 `pngLoading=true`，同步 `emit` 后立即 `setPngLoading(false)`，loading 指示器几乎不可见
- **严重度**: 低 — 不影响功能正确性
- **建议**: 后续 Sprint 改为异步等待机制，当前可接受

### 问题 3: Dockerfile 路径不匹配 [INFO]
- **描述**: Developer 清单写 `backend/Dockerfile`，实际文件在 `docker/backend.Dockerfile`
- **严重度**: 信息 — 项目实际路径已在 docker/ 目录，修改的是正确文件
- **建议**: Developer 交付文档更新路径描述

---

## 最终判定

| 维度 | 结果 |
|---|---|
| 所有 User Story 验收 | ✅ ALL ACCEPT |
| API 功能正确性 | ✅ 通过 |
| 错误处理（404/400/422） | ✅ 通过 |
| 代码质量 | ✅ 良好 |
| 回归影响 | ✅ 无破坏性变更 |
| 阻塞问题 | 0 |

**Sprint 6 — 验收通过。** 🎉
