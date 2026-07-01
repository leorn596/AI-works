# Sprint 9：线上缺陷修复专版

## 总览

| 字段 | 值 |
|------|-----|
| 时间盒 | 1 周 |
| 总故事点 | 34 |
| 前置文档 | `AI安全漏洞分析平台_迭代增量开发计划.md`、`AI安全漏洞分析平台_项目策划书.md` |
| 待修复缺陷 | 6 类（7 个子项） |

---

## BUG-01：AI 连接超时（Critical）

**现象：** 手动描述漏洞或 URL 分析时，返回 "AI 服务响应超时"。

**根因：** `backend/app/services/ai_service.py` 中所有 OpenAI 调用使用 `timeout=30`（30秒），但实际 AI 模型响应可能超过 30 秒。前端 `apiClient.js` 设置 60s 超时 + 3 次重试，但后端 30s 先到，提前抛异常。

**连锁影响：** 因异常在 `_save_analysis_result` 之前抛出，任务不存入 MySQL → 历史记录无数据显示（BUG-05）。

**修复要点：**
1. 统一所有 AI 调用的 `timeout` 从 30s 提升到 90s（`analyze_vulnerability`、`analyze_url`、`analyze_vulnerability_batch`）
2. 给 `client.chat.completions.create()` 添加 `max_retries=2` 参数（OpenAI 客户端内置重试）
3. 优化错误提示信息，区分"超时"、"API Key 无效"、"模型不存在"等不同错误

**涉及文件：**
- `backend/app/services/ai_service.py`

---

## BUG-02：PDF 导出乱码（Major）

**现象：** 导出的 PDF 报告中文字体乱码或无中文内容。

**根因（双因素）：**
1. **字体缺失：** `backend/app/services/pdf_service.py` 中 `_ensure_cjk_fonts()` 注册 `/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc`，但 Docker 镜像 `python:3.11-slim` 未安装该字体包。
2. **清单渲染缺陷：** `_render_checklist_section()` 只检查 `item.get("item_text", "")`，但结构化 checklist 项使用 `{title, detail, priority, category}`，无 `item_text` 字段，导致清单部分为空。

**修复要点：**
1. 后端 Dockerfile 添加 `fonts-wqy-zenhei` 安装
2. `_render_checklist_section()` 增加对结构化 `{title, detail}` 的支持
3. 添加 fallback 字体路径（多个 Linux 发行版的通用路径）

**涉及文件：**
- `docker/backend.Dockerfile`（加一行 apt-get install fonts-wqy-zenhei）
- `backend/app/services/pdf_service.py`（修改 `_render_checklist_section`）

---

## BUG-03：安全加固清单类别过滤失效（Major）

**现象：** Segmented 组件中有"全部/配置/代码/网络/权限"5个选项，但选择后仅"配置"有内容，其余均为空；清单内容无法预览。

**根因：** `frontend/src/components/RemediationChecklist.jsx` 中 `parseChecklistItem()` 函数首先检查 `item.item_text || item`。后端 API 返回的 checklist 是结构化的 `{priority, category, title, detail}` 对象（无 `item_text` 字段），当 `item.item_text` 为 undefined 时 fallback 到整个 item 对象，`typeof text !== 'string'` 为 true，返回固定 `{ priority: 3, category: '配置', title: '', detail: '' }`。

**修复要点：**
1. 重构 `parseChecklistItem()` 检测 item 是否为对象且有 `category` 字段，直接使用结构化字段
2. 移除对废弃 `item_text` 格式的强依赖

**涉及文件：**
- `frontend/src/components/RemediationChecklist.jsx`

---

## BUG-04：图表动态 import 404（High）

**现象：** 生产环境下图表区空白，控制台报 `Failed to fetch dynamically imported module: http://192.168.100.80:8081/assets/PieChart-xxxx.js`（4 个图表各一个 404）。

**根因：** `ChartArea.jsx` 中 4 个图表使用 `React.lazy(() => import('./charts/PieChart'))`，Vite 构建时会生成独立 chunk 文件。默认 Vite `base` 为 `/`，但在部署环境下如果前端通过 IP:8081 访问而静态资源路径不匹配（如 nginx 未正确配置或构建产物路径问题），导致浏览器无法加载异步 chunk。

**修复要点：**
1. 在 `vite.config.js` 中显式设置 `base: '/'`（或根据部署环境调整）
2. 确认 `build.rollupOptions.output.chunkFileNames` 确保 chunk 输出路径一致
3. 检查 nginx 配置确保静态资源的 `try_files` 覆盖 `/assets/` 路径

**涉及文件：**
- `frontend/vite.config.js`

---

## BUG-05：URL 扫描"敬请期待" + 历史失效（High）

**现象：** URL 扫描输入后无响应或提示功能不可用；历史记录页面为空。

**根因：** **连锁依赖 BUG-01**。当 AI 调用超时（30s）抛异常时：
1. `routes.py` 中 `_save_analysis_result()` 不会执行
2. 任务未被持久化到 MySQL
3. 历史页面查询不到任何记录
URL 分析功能本身已实现（后端 `analyze_url_endpoint` + 前端 `analyzeUrl` thunk），非功能缺失。

**修复要点：**
1. 修复 BUG-01 后此问题自动解除
2. 额外：在 `InputSection.jsx` URL tab 中添加超时/错误的友好提示

**涉及文件：**
- `frontend/src/components/InputSection.jsx`（增强 URL 分析出错提示）

---

## BUG-06：URL 分析后漏洞列表崩溃（Critical）

**现象：** 输入 `https://example.com/login.php?redirect=http://evil.com` 进行 URL 分析后，控制台报 `TypeError: Cannot convert undefined or null to object at Object.values`，漏洞列表组件崩溃。

**根因：** 后端进行 URL 分析时，对包含特殊查询参数的 URL 调用 AI 模型。AI 可能返回非标准/空数据，经 `_parse_ai_response()` 处理后 `vulnerabilities` 数组中可能含 `null` 元素或数据结构不完整。当 `VulnerabilityList.jsx`（通过 react-window `FixedSizeList`）渲染时，遍历到 `null` 元素导致 `Object.values(null)` 崩溃。

**修复要点：**
1. 在 `analysisSlice.js` 的 `analyzeUrl.fulfilled` handler 中过滤掉 `vulnerabilities` 数组中的 `null`/`undefined` 元素
2. 在 `VulnerabilityList.jsx` 的 `VulnRow` 组件中添加可选链式访问保护
3. 在 `_parse_ai_response()` 中添加深层空值防御

**涉及文件：**
- `frontend/src/store/analysisSlice.js`
- `frontend/src/components/VulnerabilityList.jsx`
- `backend/app/services/ai_service.py`（`_parse_ai_response` 强化）

---

## 任务分配总表

| 任务ID | 指派 | 关联BUG | 涉及文件 | 预估故事点 |
|--------|------|---------|---------|-----------|
| T9.1 | Developer | BUG-01 | `backend/app/services/ai_service.py` | 3 |
| T9.2 | Developer | BUG-02 | `docker/backend.Dockerfile`, `backend/app/services/pdf_service.py` | 5 |
| T9.3 | Developer | BUG-03 | `frontend/src/components/RemediationChecklist.jsx` | 3 |
| T9.4 | Developer | BUG-04 | `frontend/vite.config.js` | 2 |
| T9.5 | Developer | BUG-05 | `frontend/src/components/InputSection.jsx` | 2 |
| T9.6 | Developer | BUG-06 | `frontend/src/store/analysisSlice.js`, `frontend/src/components/VulnerabilityList.jsx`, `backend/app/services/ai_service.py` | 5 |
| T9.7 | Test Agent | BUG-01~06 | 全量回归测试 + 专项测试 | 5 |
| T9.8 | Test Agent | BUG-02 | PDF 中文字体与内容完整性验证 | 3 |
| T9.9 | Test Agent | BUG-04 | 图表 chunk 加载 + 响应式适配验证 | 3 |
| T9.10 | Test Agent | BUG-06 | 异常 URL（含 SSRF/XSS 载荷）边界测试 | 3 |
| **合计** | — | — | — | **34** |

---

## 验收标准

1. ✅ 手动描述漏洞分析 ≤10s（正常）或 ≥90s 超时提示友好
2. ✅ 导出的 PDF 正确显示中文，包含漏洞列表 + 加固清单
3. ✅ 安全加固清单 Segmented 筛选四类均能显示对应项
4. ✅ 生产环境所有图表 chunk 加载正常，无 404
5. ✅ URL 扫描功能正常运行，分析历史可查询
6. ✅ 含特殊参数 URL（如含 SSRF/XSS 载荷）不崩溃，显示"未发现漏洞"或正常结果
7. ✅ 全功能回归测试通过（Sprint 1-8 核心用户故事）
