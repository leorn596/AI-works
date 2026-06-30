# Sprint 4 测试用例

> 版本: v1.0 | 日期: 2026-06-30 | QA Agent: robot01  
> 覆盖: US-25 ~ US-32 + US-21(债务) (Sprint 4 持久化 + 历史查询 + 缓存 + 索引 + 组件迁移)

---

## 测试概览

| 测试类别 | 用例数 | 覆盖范围 |
|---------|-------|---------|
| US-25: 分析结果自动存入 MySQL | 10 | analysis_tasks 写入 / vulnerabilities 写入 / 事务 / 异常回滚 |
| US-26: 时间范围筛选 | 8 | 开始时间 / 结束时间 / 组合筛选 / 边界值 / 非法参数 |
| US-27: 漏洞类型筛选 | 8 | 单类型 / 多类型 / 组合筛选 / 未知类型 / 大小写 |
| US-28: 回看历史完整报告 | 7 | 报告内容 / 关联数据 / 404 / 权限 |
| US-29: 分页查询接口 | 9 | 分页参数 / 边界 / 元数据 / 默认值 / 排序 |
| US-30: Redis 缓存 | 10 | 命中 / 未命中 / TTL / 失效 / 缓存键 / 序列化 |
| US-31: DB 索引优化 | 8 | EXPLAIN / 覆盖索引 / 联合索引 / 索引统计 |
| US-32: HistoryDrawer 组件 | 10 | 渲染 / 抽屉 / 列表 / 筛选 / 分页 / API 迁移 |
| US-21(债务): 折线图时间轴修复 | 8 | X轴渲染 / 真实时间 / 多系列 / 排序 / 空数据 |
| 集成 & 边界 | 6 | 全链路 / 并发 / 大数据量 / 异常恢复 |
| **合计** | **84** | US-25 ~ US-32 + US-21(债务) |

---

## 一、US-25: 分析结果自动存入 MySQL

> **基线说明:** 当前 `analyze_vulnerability()` 和 `analyze_vulnerability_batch()` 只调用 AI API 返回数据，不写入 MySQL。Sprint 4 需确保分析完成后自动创建 `analysis_tasks` 和 `vulnerabilities` 表记录。

### [TC-2501] 手动分析完成后 analysis_tasks 表有新记录
- **Story:** US-25
- **Steps:**
  1. 清空 `analysis_tasks` 表：`SELECT COUNT(*) FROM analysis_tasks;` 记录初始值
  2. 调用 `POST /api/analyze/manual` 提交有效漏洞描述
  3. 等待分析完成
  4. 再次查询 `SELECT COUNT(*) FROM analysis_tasks;`
  5. 查询最新记录的字段值：`input_type, input_content, model_used, status, summary, cvss_overall`
- **Expected:**
  - 记录数 +1
  - `input_type` = `'manual'`
  - `input_content` = 提交的 description
  - `model_used` = 使用的模型名（或 NULL）
  - `status` = `'completed'`
  - `summary` 非空
  - `cvss_overall` 为数值（0-10）
  - `error_message` = NULL
  - `created_at` / `updated_at` 有值
- **Result:** PENDING

### [TC-2502] 手动分析完成后 vulnerabilities 表有关联记录
- **Story:** US-25
- **Steps:**
  1. 在 TC-2501 完成后
  2. 获取最新 task_id
  3. 查询 `SELECT * FROM vulnerabilities WHERE task_id = <id>;`
  4. 验证每条记录的字段完整性
- **Expected:**
  - 漏洞条数 ≥ 1
  - 每条记录 `task_id` 正确关联
  - `vuln_name, vuln_type` 非空
  - `cvss_score` 为 0-10 数值
  - `description, remediation` 有内容
  - `created_at` 有值
- **Result:** PENDING

### [TC-2503] 批量分析完成后 analysis_tasks 有 N 条记录
- **Story:** US-25
- **Steps:**
  1. 清空表 → 记录初始计数
  2. 调用 `POST /api/analyze/batch` 提交 3 个漏洞
  3. 等待分析完成
  4. 查询 `SELECT COUNT(*) FROM analysis_tasks;`
  5. 查询最新记录的 `input_type` 和 `status`
- **Expected:**
  - 记录数 +1（一次批量分析 = 一个 task）
  - `input_type` = `'file'` 或 `'batch'`
  - `status` = `'completed'`
- **Result:** PENDING

### [TC-2504] 批量分析后 vulnerabilities 包含全部漏洞
- **Story:** US-25
- **Steps:**
  1. TC-2503 完成后
  2. 获取最新 task_id
  3. `SELECT COUNT(*) FROM vulnerabilities WHERE task_id = <id>;`
  4. 对比漏洞数量是否 ≥ 批量输入数量
- **Expected:**
  - vulnerabilities 条数 ≥ 提交漏洞数（AI 可能识别额外漏洞）
  - 每条记录 vuln_type 标准化（SQLi/XSS/SSRF 等）
- **Result:** PENDING

### [TC-2505] AI 调用失败时 task 状态为 failed
- **Story:** US-25
- **Steps:**
  1. 临时修改 OPENAI_API_KEY 为无效值
  2. 调用 `POST /api/analyze/manual`
  3. 查询 `SELECT status, error_message FROM analysis_tasks WHERE id = <最新>;`
  4. 恢复正确的 API KEY
- **Expected:**
  - `status` = `'failed'`
  - `error_message` 包含错误描述（如 "AI 服务调用失败"）
  - `vulnerabilities` 表无关联记录
  - AnalysisTask 仍然被创建（失败也留痕）
- **Result:** PENDING

### [TC-2506] 写入 MySQL 在 API 响应返回之前完成
- **Story:** US-25
- **Steps:**
  1. 监听 API 请求完成事件
  2. 调用 `POST /api/analyze/manual`
  3. API 返回成功响应后，立即查询 `analysis_tasks` 和 `vulnerabilities`
  4. 验证数据已存在（不依赖延迟写入）
- **Expected:**
  - API 返回 `code: 200` 时，DB 中已有完整记录
  - 不存在 "数据后续异步写入" 的竞态窗口
- **Result:** PENDING

### [TC-2507] 数据库连接不可用时的降级行为
- **Story:** US-25
- **Steps:**
  1. 关闭 MySQL 容器 `docker stop vuln-mysql`
  2. 调用 `POST /api/analyze/manual`
  3. 观察 API 返回
  4. 恢复 MySQL 容器
- **Expected:**
  - API 返回 503 或 500
  - 错误信息不泄露数据库连接细节（如 IP/端口）
  - 不存在 Unhandled Exception 导致 502
  - AnalysisTask 不做部分写入
- **Result:** PENDING

### [TC-2508] 事务一致性：task 写入失败时不写入 vulnerabilities
- **Story:** US-25
- **Steps:**
  1. Mock 或强制 analysis_tasks 插入失败（如唯一约束冲突）
  2. 观察 vulnerabilities 表
- **Expected:**
  - vulnerabilities 表无孤立记录（无 task_id 指向不存在的 task）
  - 对应 ORM 使用事务或 cascade 保证原子性
  - 整个操作回滚
- **Result:** PENDING

### [TC-2509] 并发分析请求不产生数据冲突
- **Story:** US-25
- **Steps:**
  1. 同时发起 3 个 `POST /api/analyze/manual` 请求
  2. 等待全部完成
  3. 查询 `SELECT COUNT(DISTINCT id) as cnt FROM analysis_tasks;`
  4. 验证 vulnerabilities 的 task_id 正确对应
- **Expected:**
  - analysis_tasks 记录数 = 3（每条不同）
  - 每个 task 的 vulnerabilities 只关联自己的 task_id
  - 无重复 ID、无覆盖
- **Result:** PENDING

### [TC-2510] remediation_checklists 表写入验证
- **Story:** US-25
- **Steps:**
  1. 完成一次分析
  2. 查询 `SELECT * FROM remediation_checklists WHERE task_id = <id>;`
  3. 验证 item_text 和 is_completed 字段
- **Expected:**
  - 如果 AI 返回修复建议，至少有 1 条 checklist
  - 每条 `is_completed` = 0（默认未完成）
  - `item_text` 非空，含可操作的修复步骤
  - 如果 Sprint 4 不实现 checklist 写入，此用例标记为 SKIP 并注明范围
- **Result:** PENDING

---

## 二、US-26: 时间范围筛选历史记录

> **基线说明:** 当前无 `GET /api/history` 端点。Sprint 4 需实现带时间筛选的历史查询接口。

### [TC-2601] 按开始时间 (start_date) 筛选
- **Story:** US-26
- **Steps:**
  1. 准备测试数据：插入 created_at 分别为 `2024-01-01`, `2024-06-15`, `2024-12-31` 的三条记录
  2. 调用 `GET /api/history?start_date=2024-06-01`
  3. 检查返回的记录
- **Expected:**
  - 只返回 `created_at >= 2024-06-01` 的记录（2条）
  - 不包含 2024-01-01 的记录
  - 响应格式为 `{code, message, data: {items: [...], total, page, page_size}}`
- **Result:** PENDING

### [TC-2602] 按结束时间 (end_date) 筛选
- **Story:** US-26
- **Steps:**
  1. 使用 TC-2601 的数据
  2. 调用 `GET /api/history?end_date=2024-06-30`
- **Expected:**
  - 只返回 `created_at <= 2024-06-30` 的记录（2条）
  - 不包含 2024-12-31 的记录
  - 时间比较应包含 end_date 当天 23:59:59
- **Result:** PENDING

### [TC-2603] 开始+结束时间组合筛选
- **Story:** US-26
- **Steps:**
  1. 调用 `GET /api/history?start_date=2024-06-01&end_date=2024-11-30`
- **Expected:**
  - 只返回 2024-06-15 那条（1 条）
  - total = 1
- **Result:** PENDING

### [TC-2604] 只给 end_date，不给 start_date
- **Story:** US-26
- **Steps:**
  1. 调用 `GET /api/history?end_date=2024-01-15`
- **Expected:**
  - 返回所有 `created_at <= 2024-01-15` 的记录（1条）
- **Result:** PENDING

### [TC-2605] 非法日期格式处理
- **Story:** US-26
- **Steps:**
  1. 调用 `GET /api/history?start_date=abc`
  2. 调用 `GET /api/history?start_date=2024-13-01`（非法月份）
  3. 调用 `GET /api/history?end_date=not-a-date`
- **Expected:**
  - 返回 422 或 400
  - 错误 message 明确提示日期格式应为 YYYY-MM-DD
  - 不执行 SQL 查询（避免数据库报错）
- **Result:** PENDING

### [TC-2606] start_date > end_date 的语义处理
- **Story:** US-26
- **Steps:**
  1. 调用 `GET /api/history?start_date=2024-12-31&end_date=2024-01-01`
- **Expected:**
  - 方案 A（推荐）：返回 422，message 提示 start_date 不能大于 end_date
  - 方案 B：返回空列表（total=0）
  - 必须有明确处理，不能返回全部数据
- **Result:** PENDING

### [TC-2607] 时区一致性
- **Story:** US-26
- **Steps:**
  1. 在 `2024-06-15 23:30 UTC` 创建一条记录
  2. 调用 `GET /api/history?start_date=2024-06-15&end_date=2024-06-15`
  3. 检查是否包含该记录
- **Expected:**
  - 记录应被包含（无论 UTC 还是 Asia/Shanghai，同一日期应匹配）
  - 如果后端使用 UTC 存储，前端时间/后端转换应一致
  - 文档或注释注明时区策略
- **Result:** PENDING

### [TC-2608] 无匹配结果时返回空列表
- **Story:** US-26
- **Steps:**
  1. 调用 `GET /api/history?start_date=2099-01-01&end_date=2099-12-31`
- **Expected:**
  - `data.items` = `[]`
  - `data.total` = 0
  - HTTP 200（非 404），空列表是正常结果
- **Result:** PENDING

---

## 三、US-27: 漏洞类型筛选历史记录

> **基线说明:** 当前无类型筛选功能。Sprint 4 后端需支持 `vuln_type` 查询参数；前端 HistoryDrawer 提供类型下拉选择。

### [TC-2701] 单类型筛选 — SQLi
- **Story:** US-27
- **Steps:**
  1. 准备包含 SQLi、XSS、RCE 三种漏洞的分析记录
  2. 调用 `GET /api/history?vuln_type=SQLi`
- **Expected:**
  - 只返回包含至少一个 SQLi 漏洞的 task
  - 不返回纯 XSS/RCE 的 task
- **Result:** PENDING

### [TC-2702] 多类型筛选（逗号分隔）
- **Story:** US-27
- **Steps:**
  1. 调用 `GET /api/history?vuln_type=SQLi,XSS`
- **Expected:**
  - 返回包含 SQLi **或** XSS 漏洞的 task（OR 语义）
  - 同一条可同时满足多个条件但不重复
- **Result:** PENDING

### [TC-2703] 类型筛选 + 时间筛选 组合
- **Story:** US-27 / US-26
- **Steps:**
  1. 调用 `GET /api/history?vuln_type=SQLi&start_date=2024-06-01&end_date=2024-12-31`
- **Expected:**
  - 返回同时满足 类型=SQLi 且 时间在范围内 的 task
  - 筛选条件为 AND 关系
- **Result:** PENDING

### [TC-2704] 类型筛选 + 分页 组合
- **Story:** US-27 / US-29
- **Steps:**
  1. 调用 `GET /api/history?vuln_type=XSS&page=1&page_size=5`
- **Expected:**
  - 正确分页
  - total 只统计匹配 XSS 的记录数（不受分页影响）
- **Result:** PENDING

### [TC-2705] 未知/不存在类型筛选
- **Story:** US-27
- **Steps:**
  1. 调用 `GET /api/history?vuln_type=NONEXISTENT`
- **Expected:**
  - 返回空列表 `items: []`, `total: 0`
  - HTTP 200（非 400/422，未知类型非非法参数）
- **Result:** PENDING

### [TC-2706] 漏洞类型大小写敏感性
- **Story:** US-27
- **Steps:**
  1. 插入一条 vuln_type=`'SQLi'` 的漏洞
  2. 调用 `GET /api/history?vuln_type=sqli`
  3. 调用 `GET /api/history?vuln_type=SQLI`
- **Expected:**
  - 后端应做大小写不敏感匹配（SQL `UPPER(vuln_type)` 或 Python `.upper()`）
  - 两条查询都返回包含该漏洞的 task
  - 如果不支持，标记为 KNOWN LIMITATION 并在 US-27 后续修复
- **Result:** PENDING

### [TC-2707] 漏洞类型参数 SQL 注入防护
- **Story:** US-27
- **Steps:**
  1. 调用 `GET /api/history?vuln_type='; DROP TABLE analysis_tasks; --`
  2. 调用 `GET /api/history?vuln_type=1' OR '1'='1`
  3. 检查是否返回异常数据或报错
- **Expected:**
  - 使用参数化查询（SQLAlchemy ORM filter）而非字符串拼接
  - 不执行恶意 SQL
  - 返回空列表或 422
- **Result:** PENDING

### [TC-2708] 前端类型筛选下拉选项数据来源
- **Story:** US-27 / US-32
- **Steps:**
  1. 检查 HistoryDrawer 组件的 vuln_type 下拉选项
  2. 验证选项是否从 API 获取 (`GET /api/history/types` 或类似)
  3. 验证是否包含"全部"默认选项
- **Expected:**
  - 下拉列表从后端 API 获取已有的 vuln_type 去重列表
  - 默认选中"全部类型"
  - 选项变化时触发查询
  - loading 期间下拉不卡死
- **Result:** PENDING

---

## 四、US-28: 回看历史完整报告

> **基线说明:** 当前无历史报告详情端点。Sprint 4 需实现 `GET /api/history/{task_id}` 返回包含 vulnerabilities + remediation_checklists 的完整报告。

### [TC-2801] 完整报告包含所有关联数据
- **Story:** US-28
- **Steps:**
  1. 准备一条已完成的分析记录（task_id=1）
  2. 调用 `GET /api/history/1`
  3. 验证返回结构的完整性
- **Expected:**
  - 返回包含 task 基础信息：`id, input_type, model_used, status, summary, cvss_overall, created_at`
  - 包含 `vulnerabilities` 数组（所有关联漏洞）
  - 每个 vulnerability 包含：`id, vuln_name, vuln_type, cvss_vector, cvss_score, description, remediation`
  - 包含 `remediation_checklists` 数组（如果有）
  - 统一响应格式 `{code, message, data: {...}}`
- **Result:** PENDING

### [TC-2802] 不存在的 task_id 返回 404
- **Story:** US-28
- **Steps:**
  1. 调用 `GET /api/history/99999`
- **Expected:**
  - HTTP 404
  - 响应体 `{code: 404, message: "历史记录不存在"或类似, data: null}`
  - 不暴露异常栈
- **Result:** PENDING

### [TC-2803] task_id 为非法格式
- **Story:** US-28
- **Steps:**
  1. 调用 `GET /api/history/abc`
  2. 调用 `GET /api/history/-1`
- **Expected:**
  - HTTP 422（FastAPI 路径参数验证）
  - 不执行数据库查询
- **Result:** PENDING

### [TC-2804] 报告中 vulnerabilities 按 CVSS 降序排列
- **Story:** US-28
- **Steps:**
  1. 获取 `GET /api/history/<id>`
  2. 检查 vulnerabilities 数组顺序
- **Expected:**
  - 漏洞按 `cvss_score` 降序排列（高分在前）
  - 或按 `id` / `created_at` 排序并通过文档说明
  - **推荐：** 按 `cvss_score DESC` 排序（安全审查场景最合理）
- **Result:** PENDING

### [TC-2805] 报告中 raw_ai_response 字段控制
- **Story:** US-28
- **Steps:**
  1. 调用 `GET /api/history/<id>` 默认查询
  2. 检查 vulnerabilities[].raw_ai_response 是否返回
- **Expected:**
  - 默认不返回 raw_ai_response（体积大，前端不一定需要）
  - 若提供 `?include_raw=true` 参数则返回
  - 若不区分，至少保证 JSON 体积可控
- **Result:** PENDING

### [TC-2806] 前端 HistoryDrawer 点击查看完整报告
- **Story:** US-28 / US-32
- **Steps:**
  1. 打开 HistoryDrawer
  2. 点击某条历史记录
  3. 观察是否展示完整报告
- **Expected:**
  - 调用 `GET /api/history/<id>`
  - 在 Drawer 内或独立 Modal/Page 展示完整报告
  - Loading 状态过渡
  - 报告布局清晰：task 摘要 + 漏洞列表 + checklist
  - 支持关闭返回列表
- **Result:** PENDING

### [TC-2807] 前端报告渲染数据安全
- **Story:** US-28
- **Steps:**
  1. 查看报告中 AI 生成的 description/remediation 字段渲染方式
  2. 尝试在 description 中含 `<script>alert(1)</script>` 的测试数据
- **Expected:**
  - React JSX 默认转义（如果不使用 dangerouslySetInnerHTML）
  - 如果使用 Markdown 渲染，需做 XSS 过滤
  - 无 XSS 风险
- **Result:** PENDING

---

## 五、US-29: 分页查询接口

> **基线说明:** 当前无分页接口。Sprint 4 需在 `GET /api/history` 实现标准分页。

### [TC-2901] 基本分页参数
- **Story:** US-29
- **Steps:**
  1. 插入 25 条分析记录
  2. 调用 `GET /api/history?page=1&page_size=10`
  3. 检查返回
- **Expected:**
  - `data.items` 长度为 10
  - `data.total` = 25
  - `data.page` = 1
  - `data.page_size` = 10
  - `data.total_pages` = 3（或由 total/page_size 计算）
- **Result:** PENDING

### [TC-2902] 最后一页数据量正确
- **Story:** US-29
- **Steps:**
  1. 使用 TC-2901 数据
  2. 调用 `GET /api/history?page=3&page_size=10`
- **Expected:**
  - `data.items` 长度为 5（25 条 / page_size=10 → 最后一页 5 条）
  - `data.total` = 25
  - `data.page` = 3
- **Result:** PENDING

### [TC-2903] 超出总页数的 page 参数
- **Story:** US-29
- **Steps:**
  1. 调用 `GET /api/history?page=99&page_size=10`
- **Expected:**
  - 返回空列表 `items: []`
  - `total` 仍为实际总数
  - HTTP 200（非 404/400）
- **Result:** PENDING

### [TC-2904] 默认分页参数
- **Story:** US-29
- **Steps:**
  1. 调用 `GET /api/history`（不传 page/page_size）
- **Expected:**
  - 使用默认值（如 page=1, page_size=20）
  - 返回不超过 page_size 条记录
  - 元数据正确
- **Result:** PENDING

### [TC-2905] page_size 上限
- **Story:** US-29
- **Steps:**
  1. 调用 `GET /api/history?page_size=9999`
- **Expected:**
  - page_size 被限制到最大值（如 100）
  - 或返回 422 提示超出允许范围
  - 不能真的返回 9999 条（性能风险）
- **Result:** PENDING

### [TC-2906] 非法分页参数
- **Story:** US-29
- **Steps:**
  1. 调用 `GET /api/history?page=0`
  2. 调用 `GET /api/history?page=-1`
  3. 调用 `GET /api/history?page_size=abc`
  4. 调用 `GET /api/history?page_size=0`
- **Expected:**
  - HTTP 422
  - 错误信息明确（如 "page must be >= 1"）
- **Result:** PENDING

### [TC-2907] 分页结果排序
- **Story:** US-29
- **Steps:**
  1. 插入多条 created_at 不同的记录
  2. 调用 `GET /api/history?page=1&page_size=10`
  3. 检查 items 的 created_at 顺序
- **Expected:**
  - 默认按 `created_at DESC` 降序排列（最新在前）
  - 如果有 `sort_by` / `sort_order` 参数，文档说明
- **Result:** PENDING

### [TC-2908] 分页 + 筛选组合不影响 total 准确性
- **Story:** US-29 / US-26 / US-27
- **Steps:**
  1. 插入 20 条记录，其中 5 条为 SQLi
  2. 调用 `GET /api/history?vuln_type=SQLi&page=1&page_size=3`
- **Expected:**
  - `items` 长度 = 3
  - `total` = 5（匹配 SQLi 的总数，不是 20）
  - `total_pages` 基于 5 计算
- **Result:** PENDING

### [TC-2909] 空库首次查询
- **Story:** US-29
- **Steps:**
  1. 清空 analysis_tasks 表
  2. 调用 `GET /api/history`
- **Expected:**
  - `items: []`, `total: 0`, `page: 1`
  - HTTP 200
  - 不报错
- **Result:** PENDING

---

## 六、US-30: Redis 缓存

> **基线说明:** docker-compose 已配置 Redis 容器，config.py 有 REDIS_URL 设置。Sprint 4 需实现 Redis 缓存机制（历史查询结果缓存 / 分析结果缓存）。

### [TC-3001] Redis 连接验证
- **Story:** US-30
- **Steps:**
  1. 启动 docker-compose 全栈
  2. 检查后端日志：Redis 连接成功
  3. 调用 `redis-cli -a redis123 PING`（docker exec）
- **Expected:**
  - 后端启动日志显示 Redis 连接成功
  - PING → PONG
  - Redis 连接失败时后端应降级（不崩溃）
- **Result:** PENDING

### [TC-3002] 历史查询首次请求（缓存 MISS）
- **Story:** US-30
- **Steps:**
  1. 确保 Redis 中无相关 key（FLUSHDB 或确认 key 不存在）
  2. 调用 `GET /api/history?page=1&page_size=10`
  3. 记录响应时间 T1
  4. 检查 Redis 中是否创建了新 key
- **Expected:**
  - 首次请求从 MySQL 查询（缓存 MISS）
  - 响应头或日志可区分 MISS
  - Redis 中生成缓存 key
  - 缓存 key 命名规范（如 `history:page=1:size=10:...`）
- **Result:** PENDING

### [TC-3003] 历史查询重复请求（缓存 HIT）
- **Story:** US-30
- **Steps:**
  1. 在 TC-3002 后立即再次调用同一请求
  2. 记录响应时间 T2
  3. 检查 Redis key 的访问计数或日志
- **Expected:**
  - 第二次请求从 Redis 返回（缓存 HIT）
  - T2 < T1（有性能提升）
  - 数据内容与首次一致
  - 响应头或日志可区分 HIT
- **Result:** PENDING

### [TC-3004] 缓存 TTL 过期后重新查询
- **Story:** US-30
- **Steps:**
  1. 手动设置缓存 TTL 为短时间（如 10s，仅测试环境）
  2. 发起首次请求 → 等待 TTL 过期 → 再次请求
  3. 验证第二次请求重新查 MySQL（缓存 MISS）
- **Expected:**
  - TTL 过期后 key 被自动删除或返回 NULL
  - 过期后查询回源 MySQL 并重新写入 Redis
  - TTL 默认建议 5 分钟（300s）
- **Result:** PENDING

### [TC-3005] 新分析完成后缓存失效
- **Story:** US-30
- **Steps:**
  1. 先查询 `GET /api/history` → 缓存 HIT
  2. 调用 `POST /api/analyze/manual` 完成一次新分析
  3. 再次查询 `GET /api/history`（相同参数）
- **Expected:**
  - 第三次查询包含新分析结果
  - 缓存失效策略：写入新 task 时清除相关缓存 key
  - 或使用 cache-aside 模式：写入时主动 invalidate
  - 绝不返回过期数据
- **Result:** PENDING

### [TC-3006] 不同查询参数的缓存隔离
- **Story:** US-30
- **Steps:**
  1. 查询 `GET /api/history?page=1&page_size=5`
  2. 查询 `GET /api/history?page=2&page_size=5`
  3. 验证 Redis 中有两个不同的缓存 key
  4. 验证两个查询结果不混淆
- **Expected:**
  - 不同参数的查询使用不同缓存 key
  - 缓存 key 包含 page、page_size、筛选参数
  - 缓存结果互相独立
- **Result:** PENDING

### [TC-3007] Redis 不可用时的降级
- **Story:** US-30
- **Steps:**
  1. 停止 Redis 容器 `docker stop vuln-redis`
  2. 调用 `GET /api/history`
  3. 调用 `POST /api/analyze/manual`
  4. 恢复 Redis
- **Expected:**
  - 历史查询正常返回（直接查 MySQL，无缓存）
  - 分析功能正常
  - 后端不崩溃
  - 日志记录 Redis 不可用警告
  - 恢复 Redis 后缓存功能自动恢复
- **Result:** PENDING

### [TC-3008] 缓存数据序列化验证
- **Story:** US-30
- **Steps:**
  1. 获取缓存 key 的值：`redis-cli GET <key>`
  2. 验证值的格式
- **Expected:**
  - 使用 JSON 序列化（不是 pickle）
  - 可以跨语言读取（JSON 标准）
  - 如果使用 msgpack，需在技术文档中注明
- **Result:** PENDING

### [TC-3009] 缓存 key 命名规范
- **Story:** US-30
- **Steps:**
  1. 检查 Redis 中所有 key
  2. 验证命名模式
- **Expected:**
  - 有统一前缀（如 `vuln:cache:`）
  - 包含版本号或环境标识避免冲突
  - 例如：`vuln:v1:history:page=1:size=10`
  - Key 长度合理（不包含完整 SQL）
- **Result:** PENDING

### [TC-3010] 大量数据缓存内存占用
- **Story:** US-30
- **Steps:**
  1. 插入 1000 条历史记录
  2. 查询 `GET /api/history?page=1&page_size=100`
  3. 检查 Redis 内存使用：`redis-cli INFO memory`
- **Expected:**
  - 缓存 value 不超过合理大小（建议 < 1MB per key）
  - 如果数据量大，考虑只缓存热点数据（前几页）
  - 使用 `maxmemory-policy allkeys-lru` 配置
- **Result:** PENDING

---

## 七、US-31: DB 索引优化

> **基线说明:** 当前 init.sql 和 ORM 模型定义了基础索引 `idx_status`, `idx_created_at`, `idx_task_id`, `idx_vuln_type`。Sprint 4 需验证并补充联合索引、覆盖索引以优化历史查询性能。

### [TC-3101] EXPLAIN: 按 created_at 范围查询
- **Story:** US-31
- **Steps:**
  1. 执行 `EXPLAIN SELECT * FROM analysis_tasks WHERE created_at >= '2024-06-01' AND created_at <= '2024-12-31';`
  2. 检查 key 列
- **Expected:**
  - `key` = `idx_created_at`（使用索引）
  - `type` = `range`（范围扫描）
  - `rows` 小于全表扫描
  - 如果未使用索引，此用例 FAIL → 需添加或调整索引
- **Result:** PENDING

### [TC-3102] EXPLAIN: 按 vuln_type 筛选
- **Story:** US-31
- **Steps:**
  1. 执行 `EXPLAIN SELECT * FROM vulnerabilities WHERE vuln_type = 'SQLi';`
  2. 检查 key 列
- **Expected:**
  - `key` = `idx_vuln_type`（使用索引）
  - `type` = `ref`（等值查找）
  - 过滤效果良好（rows 与总数成比例）
- **Result:** PENDING

### [TC-3103] EXPLAIN: 历史查询联合筛选（时间+类型 JOIN）
- **Story:** US-31
- **Steps:**
  1. 模拟 GET /api/history 查询 SQL
  2. `EXPLAIN SELECT DISTINCT at.* FROM analysis_tasks at INNER JOIN vulnerabilities v ON at.id = v.task_id WHERE v.vuln_type = 'SQLi' AND at.created_at >= '2024-01-01';`
  3. 检查执行计划
- **Expected:**
  - 至少使用了一个索引（idx_vuln_type 或 idx_created_at）
  - type 不为 ALL（不做全表扫描）
  - 如果性能差 → 建议创建联合索引 `(vuln_type, task_id)` 或覆盖索引
- **Result:** PENDING

### [TC-3104] EXPLAIN: 分页 + 排序
- **Story:** US-31
- **Steps:**
  1. 模拟分页查询：`EXPLAIN SELECT * FROM analysis_tasks ORDER BY created_at DESC LIMIT 10 OFFSET 0;`
  2. 检查 Extra 列
- **Expected:**
  - `Extra` 包含 `Using index`（覆盖索引，避免回表）或 `Backward index scan`
  - 如果是 `Using filesort` 且 rows 很大 → 需添加复合索引
  - 建议创建 `INDEX idx_created_at_desc (created_at DESC)` 或利用现有 idx_created_at
- **Result:** PENDING

### [TC-3105] EXPLAIN: 按 task_id 查漏洞
- **Story:** US-31
- **Steps:**
  1. 模拟 GET /api/history/{id} 查询：`EXPLAIN SELECT * FROM vulnerabilities WHERE task_id = 1;`
- **Expected:**
  - `key` = `idx_task_id`
  - `type` = `ref`
  - 性能优秀
- **Result:** PENDING

### [TC-3106] 联合索引建议：vulnerabilities(vuln_type, task_id)
- **Story:** US-31
- **Steps:**
  1. 检查是否存在联合索引 `idx_vuln_type_task (vuln_type, task_id)` 或类似
  2. 如果不存在，评估创建后的 EXPLAIN 对比
- **Expected:**
  - 存在该联合索引 或 已在 Sprint 4 添加
  - 用于加速"按类型筛选+JOIN task"查询
  - 覆盖 type=ref 无需回表
- **Result:** PENDING

### [TC-3107] 索引对写入性能的影响
- **Story:** US-31
- **Steps:**
  1. 批量插入 100 条 analysis_tasks + 500 条 vulnerabilities
  2. 记录写入耗时
- **Expected:**
  - 写入性能可接受（普通数据量下不应成瓶颈）
  - 索引数量合理（每表 2-4 个索引）
  - 无冗余/重复索引
- **Result:** PENDING

### [TC-3108] 慢查询日志与索引监控
- **Story:** US-31
- **Steps:**
  1. 检查 MySQL 慢查询日志配置
  2. 运行所有历史查询
  3. 查看是否有慢查询（> 1s）
- **Expected:**
  - 所有历史查询 < 500ms（10万条以下数据）
  - 如有慢查询，分析 EXPLAIN 并优化索引
  - docker-compose 中 MySQL 可加 `--slow_query_log=1` 参数（可选）
- **Result:** PENDING

---

## 八、US-32: HistoryDrawer 组件

> **基线说明:** 当前使用 `HistoryPanel.jsx`，数据从 `localStorage` 读取。Sprint 4 需创建 `HistoryDrawer.jsx`，数据从 `GET /api/history` API 获取，支持筛选和分页。

### [TC-3201] HistoryDrawer 基础渲染
- **Story:** US-32
- **Steps:**
  1. 打开应用
  2. 点击触发 HistoryDrawer 的按钮/入口
  3. 观察 Drawer 是否弹出
- **Expected:**
  - Ant Design Drawer 组件正确渲染
  - 位置（right/left）合理
  - 有标题"分析历史"或类似
  - 有关闭按钮
  - 宽度合适（如 480px ~ 600px）
- **Result:** PENDING

### [TC-3202] HistoryDrawer 历史列表加载
- **Story:** US-32
- **Steps:**
  1. 打开 HistoryDrawer
  2. 观察加载状态
  3. 等待列表渲染
- **Expected:**
  - 首次打开时从 API 加载（loading spinner/skeleton）
  - 列表项按 created_at DESC 排列
  - 每项显示：日期、类型标签、漏洞数量、摘要（截断）
  - 数据来自 `GET /api/history` 而非 localStorage
- **Result:** PENDING

### [TC-3203] HistoryDrawer 空状态
- **Story:** US-32
- **Steps:**
  1. 清空数据库（无分析记录）
  2. 打开 HistoryDrawer
- **Expected:**
  - 显示 Empty 组件 "暂无历史记录"
  - 无报错
- **Result:** PENDING

### [TC-3204] HistoryDrawer 分页
- **Story:** US-32
- **Steps:**
  1. 插入 50 条历史记录
  2. 打开 HistoryDrawer
  3. 滚动到底部或点击分页器
- **Expected:**
  - 底部有 Ant Design Pagination 组件
  - 页码切换正确触发 API 请求
  - page_size 变化时总页数更新
  - Loading 状态在切换页码时正确显示
- **Result:** PENDING

### [TC-3205] HistoryDrawer 时间筛选
- **Story:** US-32 / US-26
- **Steps:**
  1. 打开 HistoryDrawer
  2. 选择 DatePicker 开始/结束日期
  3. 点击查询/自动触发
- **Expected:**
  - 日期选择器（或 DatePicker.RangePicker）可用
  - 选择日期后列表自动刷新或点击"筛选"按钮
  - API 请求包含 start_date / end_date 参数
  - 清除日期后恢复全部数据
- **Result:** PENDING

### [TC-3206] HistoryDrawer 类型筛选
- **Story:** US-32 / US-27
- **Steps:**
  1. 打开 HistoryDrawer
  2. 从类型下拉选择 "SQLi"
  3. 观察列表变化
- **Expected:**
  - 下拉选项从 API 获取（不硬编码）
  - 选择类型后列表更新
  - 支持选择"全部"恢复
  - 类型筛选与时间筛选可组合
- **Result:** PENDING

### [TC-3207] HistoryDrawer 点击查看详情
- **Story:** US-32 / US-28
- **Steps:**
  1. 打开 HistoryDrawer
  2. 点击某条记录
  3. 观察详情展示
- **Expected:**
  - 调用 `GET /api/history/<id>`
  - 在 Drawer 内展开详情 或 打开新 Modal/子页面
  - 显示完整漏洞列表、CVSS 评分、修复建议
  - 有"返回列表"操作
  - Loading + Error 状态
- **Result:** PENDING

### [TC-3208] HistoryDrawer API 错误处理
- **Story:** US-32
- **Steps:**
  1. 模拟 API 返回 500 / 网络断开
  2. 打开 HistoryDrawer
- **Expected:**
  - 显示错误提示（Alert / Notification）
  - 提供"重试"按钮
  - 不白屏
  - Drawer 仍然可关闭
- **Result:** PENDING

### [TC-3209] HistoryPanel localStorage 迁移
- **Story:** US-32
- **Steps:**
  1. 检查代码：`HistoryPanel.jsx` 是否仍在对 `localStorage` 读写
  2. 检查 `@/store/analysisSlice.setManualVulnerabilities` 是否仍依赖 localStorage 数据
  3. 确认 HistoryDrawer 已替代 HistoryPanel 的所有功能
- **Expected:**
  - HistoryPanel.jsx 可能保留但标记为 deprecated
  - 主流程使用 HistoryDrawer + API
  - 旧 localStorage 数据有迁移路径或提示
  - 不影响现有用户（如果是从旧版升级）
- **Result:** PENDING

### [TC-3210] HistoryDrawer 防抖/节流
- **Story:** US-32
- **Steps:**
  1. 快速连续切换筛选条件（类型 → 时间 → 类型）
  2. 观察 API 请求频率
- **Expected:**
  - 应该防抖（如 300ms）避免过多 API 请求
  - 或取消上一个未完成的请求（AbortController）
  - 不出现竞态条件（旧响应覆盖新响应）
- **Result:** PENDING

---

## 九、US-21(债务): 折线图时间轴修复

> **基线说明:** 当前 `TrendChart.jsx` 在 `created_at` 存在时按日期聚合，否则模拟 Timeline，但存在潜在问题：X 轴可能使用字符串而非真实时间轴；多系列不支持；时间排序不保证正确。

### [TC-2101] TrendChart X 轴使用真实时间类型
- **Story:** US-21(债务)
- **Steps:**
  1. 提供带有 `created_at` 字段（ISO 8601 格式）的漏洞数据
  2. 渲染 TrendChart
  3. 检查 ECharts option 的 `xAxis.type`
- **Expected:**
  - `xAxis.type` = `'time'`（不是 `'category'` 字符串）
  - X 轴标签为格式化日期（如 `2024-06-15`）
  - 数据点间距与实际时间间隔成正比
  - 如果数据跨越多天，X 轴自动抽稀显示
- **Result:** PENDING

### [TC-2102] TrendChart 按时间排序验证
- **Story:** US-21(债务)
- **Steps:**
  1. 提供乱序的漏洞数据（时间顺序故意打乱）
  2. 渲染 TrendChart
  3. 检查数据点是否按真实时间排序
- **Expected:**
  - 折线从左到右时间递增
  - 排序在后端或前端完成
  - 不与原始数组顺序相同（如果原始顺序是乱的）
- **Result:** PENDING

### [TC-2103] TrendChart 多系列渲染
- **Story:** US-21(债务)
- **Steps:**
  1. 提供多种类型的漏洞数据（类型字段不同）
  2. 渲染 TrendChart
  3. 检查是否每个类型一条折线
- **Expected:**
  - 如果存在多系列支持：每种漏洞类型一条独立折线
  - Legend 图例显示所有系列名称
  - 颜色区分明确（自动配色）
  - 如果 Sprint 4 不实现多系列，标记为后续需求
- **Result:** PENDING

### [TC-2104] TrendChart 空数据展示
- **Story:** US-21(债务)
- **Steps:**
  1. 传入 `vulnerabilities={[]}` 或 `null`
  2. 渲染 TrendChart
- **Expected:**
  - 显示 Empty "暂无数据"
  - 不抛出异常
  - 组件正常渲染容器
- **Result:** PENDING

### [TC-2105] TrendChart 单一数据点
- **Story:** US-21(债务)
- **Steps:**
  1. 提供只有一个漏洞的数据
  2. 渲染 TrendChart
- **Expected:**
  - 渲染单个数据点
  - 不报错
  - 折线可能退化为单个点
  - 如果有 `smooth: true`，单点不应产生奇怪曲线
- **Result:** PENDING

### [TC-2106] TrendChart 无 created_at 字段降级
- **Story:** US-21(债务)
- **Steps:**
  1. 提供没有 `created_at` 字段的漏洞数组
  2. 渲染 TrendChart
- **Expected:**
  - 显示"模拟数据"标签（现有行为）
  - 按数组索引模拟时间轴
  - 不报错
- **Result:** PENDING

### [TC-2107] TrendChart Tooltip 内容正确
- **Story:** US-21(债务)
- **Steps:**
  1. 渲染 TrendChart 在有时间数据上
  2. Hover 数据点
  3. 检查 Tooltip
- **Expected:**
  - Tooltip 显示日期（格式友好）
  - 显示累计漏洞数
  - 如果多系列，显示系列名称 + 值
- **Result:** PENDING

### [TC-2108] TrendChart 响应式缩放
- **Story:** US-21(债务)
- **Steps:**
  1. 渲染 TrendChart
  2. 拖动浏览器窗口改变宽度
- **Expected:**
  - 图表自动 resize（BaseChart 应处理）
  - 不溢出容器
  - 滚动条不出现
- **Result:** PENDING

---

## 十、集成测试 & 边界

### [TC-INT01] 全链路：分析 → 存储 → 历史查询 → 回看报告
- **Story:** 集成
- **Steps:**
  1. 调用 `POST /api/analyze/manual` 完成分析
  2. 调用 `GET /api/history` 验证记录出现
  3. 调用 `GET /api/history/<id>` 查看完整报告
  4. 在前端 HistoryDrawer 中验证同样流程
- **Expected:**
  - 全链路数据一致
  - 时间戳一致
  - 无数据丢失
- **Result:** PENDING

### [TC-INT02] 并发分析 + 并发查询
- **Story:** 集成
- **Steps:**
  1. 同时发起 5 个分析请求 + 3 个历史查询请求
  2. 等待全部完成
  3. 验证数据一致性
- **Expected:**
  - 所有请求正常完成（或合理限流拒绝）
  - 数据库无死锁
  - Redis 无脏数据
  - 返回数据完整
- **Result:** PENDING

### [TC-INT03] 大数据量场景：1000+ 条历史记录
- **Story:** 集成
- **Steps:**
  1. 插入 1000 条 analysis_tasks + 5000 条 vulnerabilities
  2. 执行典型历史查询（带筛选+分页）
  3. 记录响应时间
- **Expected:**
  - 查询响应时间 < 1s（有索引 + 缓存）
  - 分页跳转流畅
  - 不会 OOM
- **Result:** PENDING

### [TC-INT04] 数据库回滚后缓存一致性
- **Story:** 集成
- **Steps:**
  1. 写入一条数据 → 缓存建立
  2. 手动删除 MySQL 中该记录（模拟异常回滚）
  3. 再次查询
- **Expected:**
  - 缓存失效或返回空
  - 不返回已删除的幽灵数据
  - 日志记录不一致情况（可选）
- **Result:** PENDING

### [TC-INT05] Docker 全栈重启后状态恢复
- **Story:** 集成
- **Steps:**
  1. docker-compose up -d 启动全栈
  2. 执行分析和查询
  3. docker-compose down && docker-compose up -d
  4. 再次查询历史
- **Expected:**
  - MySQL 数据持久化（volume 保留）
  - Redis 数据可能丢失（AOF 配置可恢复）
  - 后端自动重新连接 DB 和 Redis
  - 历史数据完整
- **Result:** PENDING

### [TC-INT06] 前端直接访问 API 路径验证
- **Story:** 集成
- **Steps:**
  1. 检查 `vite.config.js` 的 proxy 配置
  2. 检查生产环境 nginx 配置是否转发 `/api/*` 到后端
  3. 在前端 console 手动执行 `fetch('/api/history')`
- **Expected:**
  - 开发环境：Vite proxy 正确转发到后端
  - 生产环境：nginx 或前端构建配置确保 API 可达
  - CORS 配置与前端域名匹配
- **Result:** PENDING

---

## 十一、汇总统计

| 类别 | 用例数 |
|------|--------|
| US-25: 分析结果自动存入 MySQL | 10 |
| US-26: 时间范围筛选 | 8 |
| US-27: 漏洞类型筛选 | 8 |
| US-28: 回看历史完整报告 | 7 |
| US-29: 分页查询接口 | 9 |
| US-30: Redis 缓存 | 10 |
| US-31: DB 索引优化 | 8 |
| US-32: HistoryDrawer 组件 | 10 |
| US-21(债务): 折线图时间轴修复 | 8 |
| 集成 & 边界 | 6 |
| **合计** | **84** |

---

## 十二、缺陷追踪模板

| ID | Story | Severity | Description | Status |
|----|-------|----------|-------------|--------|
| BUG-XX | US-XX | High/Medium/Low | ... | OPEN |

---

> **QA 签名:** robot01  
> **验收标准:** 所有 PENDING 用例变为 PASS 或明确标记 SKIP + 理由  
> **依赖:** Developer 完成 Sprint 4 所有 US 实现后，QA 执行验收
