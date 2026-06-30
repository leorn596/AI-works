# Sprint 5 测试用例

> 版本: v1.0 | 日期: 2026-06-30 | QA Agent: robot01  
> 覆盖: US-33 ~ US-40 (Sprint 5 — 多源交叉验证 + CVSS 精准推断 + 加固清单 + 三栏正式启用 + 多源雷达图)

---

## 测试概览

| 测试类别 | 用例数 | 覆盖范围 |
|---------|-------|---------|
| US-33: ZAP+Nmap 双源上传 & AI 交叉验证 | 12 | 双文件上传 / 单源回退 / schemas / cross_validation prompt / 融合结果 |
| US-34: 交叉验证结果四象限展示 | 8 | 一致/ZAP独有/Nmap独有/冲突 四象限 / 统计摘要 / 点击联动 |
| US-35: CVSS 3.1 向量精准推断 | 12 | 向量格式校验 / 再推断二次验算 / 偏差检测 / 缺失向量补全 / 降级 |
| US-36: CVSS Redis 缓存 | 9 | 命中/未命中/TTL/失效/multi-source 缓存 / key 格式 |
| US-37: AI 安全加固清单生成 | 10 | API 生成 / DB 持久化 / checklist 完整性 / priority 分级 |
| US-38: 加固清单类别筛选 | 7 | API 参数过滤 / 多类别 / 空结果 / UI 筛选交互 |
| US-39: 三栏布局正式启用 | 8 | 三栏切换 / 历史加载联动 / 响应式降级 / load-vuln-detail / 出入动画 |
| US-40: 多源对比雷达图 | 8 | 双雷达 / 源标识 / 维度对齐 / tooltip 对比 / 单源回退 |
| 集成 & 边界 | 6 | 全链路 / 并发 / 大文件 / 异常恢复 / 超时 |
| **合计** | **80** | US-33 ~ US-40 |

---

## 一、US-33: ZAP+Nmap 双源上传 & AI 交叉验证

> **基线说明:** 当前仅有单文件上传（InputSection），后端仅 `/analyze/manual` 和 `/analyze/batch`。Sprint 5 需新增 `POST /api/analyze/multi-source` 端点，接受 ZAP JSON + Nmap XML 两个源文件，调用 AI 进行交叉验证，返回融合结果。

### [TC-3301] multi-source 端点接受 ZAP+Nmap 双文件
- **Story:** US-33
- **Steps:**
  1. 准备有效 ZAP JSON 文件（含 3 个 alert）和 Nmap XML 文件（含 5 个 host）
  2. 构造 `multipart/form-data` 请求：`POST /api/analyze/multi-source`
  3. 字段 `zap_file` 上传 ZAP JSON，`nmap_file` 上传 Nmap XML
  4. 可选字段 `model` 传模型名
  5. 检查 HTTP 状态码
- **Expected:**
  - HTTP 200
  - `data` 包含 `cross_validation` 字段
  - `data.zap_vulnerabilities` 为 ZAP 解析结果数组
  - `data.nmap_vulnerabilities` 为 Nmap 解析结果数组
  - `data.cross_validation` 包含交叉验证结果
  - `data.summary` / `data.cvss_overall` 存在
- **Result:** PENDING

### [TC-3302] multi-source 仅传 ZAP 文件时应返回错误或单源回退
- **Story:** US-33
- **Steps:**
  1. 仅上传 `zap_file`，不传 `nmap_file`
  2. 请求 `POST /api/analyze/multi-source`
- **Expected:**
  - HTTP 400 或 422（参数校验失败）
  - 若设计为单源回退，应返回 HTTP 200 且 `cross_validation` 为空/null
  - 错误信息明确指出缺少 nmap 输入
- **Result:** PENDING

### [TC-3303] multi-source 仅传 Nmap 文件时同上校验
- **Story:** US-33
- **Steps:**
  1. 仅上传 `nmap_file`，不传 `zap_file`
  2. 请求 `POST /api/analyze/multi-source`
- **Expected:**
  - HTTP 400 或 422 或单源回退（同 TC-3302 策略）
- **Result:** PENDING

### [TC-3304] ZAP 文件格式校验（非 JSON/损坏 JSON）
- **Story:** US-33
- **Steps:**
  1. 上传一个 TXT 文件作为 `zap_file`
  2. 上传有效 Nmap XML 作为 `nmap_file`
  3. 请求 `POST /api/analyze/multi-source`
- **Expected:**
  - HTTP 400，错误信息包含 "ZAP格式" 或 "JSON" 关键词
  - 不应静默失败或返回空数组
- **Result:** PENDING

### [TC-3305] Nmap 文件格式校验（非 XML/无效 XML）
- **Story:** US-33
- **Steps:**
  1. 上传有效 ZAP JSON 作为 `zap_file`
  2. 上传损坏的 XML 文件作为 `nmap_file`
  3. 请求 `POST /api/analyze/multi-source`
- **Expected:**
  - HTTP 400，错误信息包含 "Nmap格式" 或 "XML" 关键词
- **Result:** PENDING

### [TC-3306] Pydantic Schema 定义：MultiSourceResponse
- **Story:** US-33
- **Steps:**
  1. 审查 `backend/app/api/schemas.py`，确认新增 `MultiSourceResponse` 或类似 schema
  2. 检查字段列表
- **Expected:**
  - 包含 `zap_vulnerabilities: list[VulnerabilityOut]`（或类似）
  - 包含 `nmap_vulnerabilities: list[VulnerabilityOut]`（或类似）
  - 包含 `cross_validation: CrossValidationResult`（或类似）
  - `CrossValidationResult` 包含 `matched`, `zap_only`, `nmap_only`, `conflicts` 四个子数组
  - 每个子数组元素包含 `zap_item` / `nmap_item` / `confidence` 等字段
- **Result:** PENDING

### [TC-3307] ZAP 文件解析提取 alert 数量正确
- **Story:** US-33
- **Steps:**
  1. 准备 ZAP JSON 报告包含 5 个 alerts
  2. 上传请求 multi-source
  3. 检查 `data.zap_vulnerabilities.length`
- **Expected:**
  - `zap_vulnerabilities.length === 5`
  - 每个元素包含 `vuln_name`, `vuln_type`, `severity`, `cvss_score`, `description`
  - ZAP alert name 映射到 `vuln_name`
- **Result:** PENDING

### [TC-3308] Nmap 文件解析提取 host/port/service 数量正确
- **Story:** US-33
- **Steps:**
  1. 准备 Nmap XML 报告包含 3 个 host，共 12 个开放端口
  2. 上传请求 multi-source
  3. 检查 `data.nmap_vulnerabilities.length`
- **Expected:**
  - `nmap_vulnerabilities.length` 为合理数量（开放端口数或服务数）
  - 每个元素至少包含 `vuln_name`, `service`, `port`
- **Result:** PENDING

### [TC-3309] AI cross_validation prompt 发送正确
- **Story:** US-33
- **Steps:**
  1. 在 ai_service.py 中定位 `cross_validate` 或类似函数
  2. 检查 AI prompt 内容
  3. 审查 prompt 是否要求输出匹配/独有/冲突分类
  4. 审查 temperature/max_tokens 设置
- **Expected:**
  - Prompt 包含 ZAP 解析结果 + Nmap 解析结果
  - 要求输出 JSON 包含 `matched`, `zap_only`, `nmap_only`, `conflicts` 四类
  - temperature ≤ 0.4（需精确匹配）
  - max_tokens ≥ 4096（双源数据量大）
  - 明确要求不要 markdown code fences
- **Result:** PENDING

### [TC-3310] cross_validation 结果 schema 完整且可解析
- **Story:** US-33
- **Steps:**
  1. 模拟 AI 返回的 cross_validation JSON
  2. 检查 `_parse_ai_response` 或新增 parser 能否正确处理
  3. 验证边界情况：matched=[] / zap_only=[] / nmap_only=[]
- **Expected:**
  - JSON 解析成功，不抛异常
  - `matched` 数组元素格式与 VulnerabilityOut 兼容
  - 空数组场景不崩溃
  - 嵌套字段（conflicts 内的 zap_item / nmap_item）正确提取
- **Result:** PENDING

### [TC-3311] multi-source 结果自动保存 MySQL
- **Story:** US-33
- **Steps:**
  1. 发送双源分析成功请求
  2. 查询 `analysis_tasks` 表：最新记录 `input_type='multi-source'`（或 'msource'）
  3. 查询 `vulnerabilities` 表：关联该 task_id 的记录
- **Expected:**
  - analysis_tasks 新增 1 条记录，input_type 标记为多源
  - input_content 包含 ZAP+Nmap 文件名或摘要
  - vulnerabilities 表记录数 ≥ ZAP+Nmap 合并数
  - 每条漏洞可能附加 `source` 标记（ZAP/Nmap/Both）
- **Result:** PENDING

### [TC-3312] multi-source 结果 Redis 缓存
- **Story:** US-33 (交叉依赖 US-36)
- **Steps:**
  1. 同 TC-3311 完成后
  2. 请求 `GET /api/history/{task_id}`
  3. 检查响应中 `from_cache` 字段
  4. 再次请求同一 task_id
- **Expected:**
  - 第一次或第二次返回 `from_cache: true`
  - 缓存命中的响应与首次分析结果一致
  - 缓存 TTL 默认 3600s
- **Result:** PENDING

---

## 二、US-34: 交叉验证结果四象限展示

> **基线说明:** 前端无交叉验证结果展示组件。Sprint 5 需新增 `CrossValidationPanel` 组件，展示匹配/仅ZAP/仅Nmap/冲突四个象限，并在 AIDetailAnalysis 或独立面板显示。

### [TC-3401] CrossValidationPanel 组件渲染四象限
- **Story:** US-34
- **Steps:**
  1. 触发 multi-source 分析
  2. 检查页面是否渲染 `CrossValidationPanel`
  3. 确认四个象限区域可见
- **Expected:**
  - 四象限分别标记为：匹配一致 / 仅ZAP发现 / 仅Nmap发现 / 冲突
  - 每个象限有对应图标或配色区分
  - 象限内显示漏洞条数
- **Result:** PENDING

### [TC-3402] "匹配一致"象限展示两个源都发现的漏洞
- **Story:** US-34
- **Steps:**
  1. 使用已知有重合漏洞的双源数据（如 80/tcp 出现在两个报告中）
  2. 触发 multi-source 分析
  3. 观察"匹配一致"象限
- **Expected:**
  - 象限显示匹配的漏洞名称列表
  - 每个条目同时显示 ZAP 评分和 Nmap 评分（如适用）
  - `match_count ≥ 1`
  - 点击条目可查看双方详情对比
- **Result:** PENDING

### [TC-3403] "仅ZAP发现"象限展示 ZAP 独有的漏洞
- **Story:** US-34
- **Steps:**
  1. 使用 ZAP 有 SQLi 但 Nmap 没有的数据
  2. 观察"仅ZAP发现"象限
- **Expected:**
  - 显示 ZAP 独有的漏洞列表
  - 每个条目显示 ZAP 来源标识
  - 数量与 cross_validation.zap_only 一致
- **Result:** PENDING

### [TC-3404] "仅Nmap发现"象限展示 Nmap 独有的服务/漏洞
- **Story:** US-34
- **Steps:**
  1. 使用 Nmap 有开放端口但 ZAP 未扫描的数据
  2. 观察"仅Nmap发现"象限
- **Expected:**
  - 显示 Nmap 独有的开放端口/服务列表
  - 每个条目显示 Nmap 来源标识
  - 数量与 cross_validation.nmap_only 一致
- **Result:** PENDING

### [TC-3405] "冲突"象限展示两源评分不一致的同一漏洞
- **Story:** US-34
- **Steps:**
  1. 使用 ZAP 给某漏洞 CVSS 8.5 但 Nmap 服务对应的漏洞 CVSS 6.0 的数据
  2. 观察"冲突"象限
- **Expected:**
  - 显示冲突条目，包含两次评估的 CVSS 差异
  - 差异超过 2.0 才进入冲突象限（或按阈值过滤）
  - 高亮显示分歧的字段（cvss_score/cvss_vector/vuln_type）
  - 标注建议："以AI融合分析为准"
- **Result:** PENDING

### [TC-3406] 统计摘要行展示各象限计数
- **Story:** US-34
- **Steps:**
  1. 完成多源分析后检查组件顶部或底部统计区域
- **Expected:**
  - 显示：匹配 X 个 / ZAP独有 Y 个 / Nmap独有 Z 个 / 冲突 W 个
  - 总数 = X + Y + Z + W
  - 统计数字与 cross_validation 数据一致
- **Result:** PENDING

### [TC-3407] 点击四象限条目联动 AIDetailAnalysis
- **Story:** US-34
- **Steps:**
  1. 点击"匹配一致"象限中某个漏洞条目
  2. 观察右侧 AIDetailAnalysis 面板
  3. 点击"冲突"象限中某个条目
- **Expected:**
  - 选中条目高亮
  - AIDetailAnalysis 显示该漏洞的完整详情
  - 冲突条目展示双方评估对比（如 ZAP: 8.5 vs Nmap: 6.0）
  - 通过 Redux 或 eventBus 传递选中状态
- **Result:** PENDING

### [TC-3408] 不存在交叉验证数据时不渲染该组件
- **Story:** US-34
- **Steps:**
  1. 触发单源 manual 分析（非 multi-source）
  2. 检查页面
- **Expected:**
  - CrossValidationPanel 不渲染或隐藏
  - 无空白占位、无 js error
  - 不影响其他组件正常显示
- **Result:** PENDING

---

## 三、US-35: CVSS 3.1 向量精准推断

> **基线说明:** 当前 AI prompt 要求返回 `cvss_vector`，但无任何格式校验或二次验算。`_parse_ai_response` 直接透传 AI 返回值。Sprint 5 需新增 CVSS 3.1 向量格式验证 + 再推断修正机制。

### [TC-3501] CVSS 3.1 向量格式正则校验通过
- **Story:** US-35
- **Steps:**
  1. 审查 ai_service.py 中新增的 CVSS 向量验证函数
  2. 输入合法向量 `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`
- **Expected:**
  - 验证函数返回 `(True, None)` 或 `(True, parsed_dict)`
  - 正则匹配 `CVSS:3.1/AV:[NALP]/AC:[LH]/PR:[NLH]/UI:[NR]/S:[UC]/C:[NLH]/I:[NLH]/A:[NLH]` 格式
- **Result:** PENDING

### [TC-3502] CVSS 向量格式校验不通过（非法值）
- **Story:** US-35
- **Steps:**
  1. 输入伪向量 `AV:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`（非法 AV 值 X）
  2. 输入缺少必填字段的向量 `AV:N/AC:L`（不完整）
  3. 输入空字符串
  4. 输入数字 `9.8`
- **Expected:**
  - 全部返回 `(False, error_message)`
  - error_message 标明具体错误（"无效的AV值 X" / "缺少PR字段" / "格式不匹配"）
- **Result:** PENDING

### [TC-3503] CVSS 二次验算：score 与 vector 应一致
- **Story:** US-35
- **Steps:**
  1. 审查新增的 `recalculate_cvss3_score(vector)` 函数
  2. 测试常用向量：
     - `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` → 预期分数 9.8
     - `AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H` → 预期分数 8.1
     - `AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N` → 应在 4.x-6.x 范围
  3. 允许 ±0.1 的浮点误差
- **Expected:**
  - 已知向量计算出的分数与 NVD 官方计算器一致
  - 函数返回值 ≤10.0 且 ≥0.0
- **Result:** PENDING

### [TC-3504] AI 返回的 cvss_score 与从 vector 重算的分数偏差检测
- **Story:** US-35
- **Steps:**
  1. AI 返回 `cvss_vector: AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` + `cvss_score: 7.5`
  2. 后台重算得 9.8
  3. 检查日志和响应
- **Expected:**
  - 偏差 > 1.0 时触发 WARNING 日志
  - `cvss_score` 应使用重算值（9.8）覆盖 AI 返回的不一致值（7.5）
  - 响应中 `cvss_score_discrepancy` 字段标记之前的偏差（可选）
- **Result:** PENDING

### [TC-3505] AI 仅返回 cvss_score，未返回 cvss_vector 时自动推断
- **Story:** US-35
- **Steps:**
  1. 模拟 AI 返回 `cvss_score: 8.5, cvss_vector: null`
  2. 观察后端处理逻辑
- **Expected:**
  - 不应直接存空 vector
  - 根据 cvss_score 范围 + vuln_type + impact 推断一个合理向量
  - 或调用 AI 二次请求补全 vector
  - `cvss_vector_auto_inferred: true` 标记
- **Result:** PENDING

### [TC-3506] AI 仅返回 cvss_vector，未返回 cvss_score 时自动计算
- **Story:** US-35
- **Steps:**
  1. 模拟 AI 返回 `cvss_vector: AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H, cvss_score: null`
  2. 观察后端处理
- **Expected:**
  - `cvss_score` 根据 vector 重新计算为 9.8
  - 数据库中存储了正确的两者
- **Result:** PENDING

### [TC-3507] AI 返回空 vector 且无 score 时的降级处理
- **Story:** US-35
- **Steps:**
  1. AI 返回 `cvss_vector: ""` 且 `cvss_score: null`
  2. 检查结果
- **Expected:**
  - cvss_vector 在 DB 中为 NULL（允许）
  - cvss_score 在 DB 中为 NULL（允许）
  - 不应系统崩溃
  - 日志记录 WARNING "无法推断 CVSS"
- **Result:** PENDING

### [TC-3508] cvss_vector 必须在 vulnerabilities 表正确存储
- **Story:** US-35
- **Steps:**
  1. 提交 manual 分析
  2. 查询 `SELECT cvss_vector FROM vulnerabilities WHERE task_id = <id>`
- **Expected:**
  - cvss_vector 非空（CVSS 3.1 格式）或 NULL（降级场景）
  - 若有值，csv_vector 不含前缀 `CVSS:3.1/`（与实现约定一致）
  - cvss_vector 字段长度不超过 200
- **Result:** PENDING

### [TC-3509] NVD lookup 补充 CVSS（若实现）
- **Story:** US-35
- **Steps:**
  1. 如果 US-35 包含 NVD API 查询 CVE 的 CVSS
  2. 模拟通过 CVE 反查 CVSS
- **Expected:**
  - NVD API 调用成功 → 填充已验证的 CVSS 向量和评分
  - NVD API 不可达 → 降级到本地推演
  - 超时 ≤ 5s，不影响整体分析流程
- **Result:** PENDING

### [TC-3510] 批量分析中每个漏洞都经过 CVSS 校验
- **Story:** US-35
- **Steps:**
  1. 调用 `POST /api/analyze/batch` 提交 10 个漏洞
  2. 检查响应中每个漏洞的 cvss_vector / cvss_score
- **Expected:**
  - 10 个漏洞的 CVSS 都经过格式校验
  - 偏差被修正的不超过合理数量
  - 无未处理（null + null）的漏洞超过 20%
- **Result:** PENDING

### [TC-3511] 所有 CVSS 向量中的 temporal/environmental metrics 处理
- **Story:** US-35
- **Steps:**
  1. AI 若返回包含 E:RL:T 等 temporal/environmental 指标的向量
  2. 检查处理逻辑
- **Expected:**
  - 若仅支持 Base Score，则剥离 temporal/environmental 部分后进行校验
  - 或者完整保留、校验所有 8 个 Base 指标
  - 处理策略在代码注释中明确
- **Result:** PENDING

### [TC-3512] 判断逻辑性能：单次 recalculate ≤ 10ms
- **Story:** US-35
- **Steps:**
  1. 对 1000 个合法向量调用 recalculate_cvss3_score
  2. 记录耗时
- **Expected:**
  - 单次 ≤ 10ms
  - 1000 次总计 ≤ 1s
  - 无内存泄漏
- **Result:** PENDING

---

## 四、US-36: CVSS Redis 缓存

> **基线说明:** Redis 已有通用 `cache_analysis_result(task_id, data)` 缓存整体分析结果。Sprint 5 需新增 CVSS 特定缓存（如 `cvss:{vector_hash}` → score mapping），避免重复计算同一向量的分数。

### [TC-3601] CVSS 向量 → 分数映射缓存 key 格式
- **Story:** US-36
- **Steps:**
  1. 查看 `redis.py` 或新增的 CVSS 缓存模块
  2. 确认缓存 key 命名约定
- **Expected:**
  - Key 格式如 `cvss:score:<hash>` 或 `cvss:<vector_hash>`
  - hash 算法确定（MD5 或 SHA256 前 16 字符）
  - 不同向量不产生相同 hash（无碰撞）
- **Result:** PENDING

### [TC-3602] 首次计算 CVSS 分数未命中缓存
- **Story:** US-36
- **Steps:**
  1. 清空 Redis（`FLUSHDB` 测试库）
  2. 发送分析请求，包含 CVSS 向量
  3. 检查日志 `cvss_cache miss`
- **Expected:**
  - 日志显示 MISS（或 DEBUG 级，与全局缓存区分）
  - 计算完成后写入 Redis
  - 缓存写入成功日志出现
- **Result:** PENDING

### [TC-3603] 相同向量第二次请求命中 CVSS 缓存
- **Story:** US-36
- **Steps:**
  1. 完成 TC-3602
  2. 再次发送包含相同 CVSS 向量的分析请求
  3. 检查日志
- **Expected:**
  - 日志显示 `cvss_cache HIT`
  - 不执行 recalculate_cvss3_score
  - 响应速度比首次快
- **Result:** PENDING

### [TC-3604] CVSS 缓存 TTL 配置独立
- **Story:** US-36
- **Steps:**
  1. 检查缓存写入时的 TTL 参数
- **Expected:**
  - CVSS 缓存 TTL 独立于全局 `CACHE_TTL = 3600`
  - 建议值 ≥ 86400（24h），因为向量→分数映射是静态的
  - 或永久缓存（但需要 eviction 策略）
- **Result:** PENDING

### [TC-3605] CVSS 缓存失效/手动刷新
- **Story:** US-36
- **Steps:**
  1. 调用 `POST /api/cache/cvss/invalidate`（若提供）
  2. 或通过 Redis CLI `DEL cvss:score:*`
  3. 再次请求
- **Expected:**
  - 缓存失效后重新计算
  - 日志显示 MISS
  - 新计算结果正确写入
- **Result:** PENDING

### [TC-3606] 多源分析中 CVSS 缓存复用
- **Story:** US-36 (交叉 US-33)
- **Steps:**
  1. 先执行 manual 分析，AI 返回某向量 → CVSS 缓存写入
  2. 再执行 multi-source 分析，AI 返回相同向量
  3. 检查是否命中 CVSS 缓存
- **Expected:**
  - 第二次命中 CVSS 缓存（跨请求类型复用）
  - 日志显示 HIT
- **Result:** PENDING

### [TC-3607] Redis 不可用时的降级
- **Story:** US-36
- **Steps:**
  1. 停止 Redis 服务
  2. 发送分析请求
- **Expected:**
  - 不应 HTTP 500
  - 回退到本地计算（无缓存）
  - 日志记录 WARNING 级别 "Redis 不可用，CVSS 缓存跳过"
  - 分析结果正常返回
- **Result:** PENDING

### [TC-3608] CVSS 缓存键不污染分析结果缓存
- **Story:** US-36
- **Steps:**
  1. 在 Redis 中 `KEYS *`
  2. 分别发送 manual 分析请求
  3. 再次 `KEYS *` 检查
- **Expected:**
  - 有两条不同前缀的 key：`analysis:{task_id}` 和 `cvss:score:{hash}`
  - 不会互相覆盖
  - cvss 缓存写入失败不影响 analysis 缓存写入
- **Result:** PENDING

### [TC-3609] 向量规范化 → 同一语义向量命中缓存
- **Story:** US-36
- **Steps:**
  1. 写入缓存：`AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`
  2. 查询时输入：`AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`（完全相同）
  3. 查询时输入：` AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H `（首尾空格）
  4. 查询时输入：`AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`（指标顺序不同但语义相同）
- **Expected:**
  - 情形 2：命中
  - 情形 3：若向量规范化（trim），命中
  - 情形 4：若排序指标，命中
  - 若不规范化，仅情形 2 命中——需记录已知限制
- **Result:** PENDING

---

## 五、US-37: AI 安全加固清单生成

> **基线说明:** MySQL 已定义 `remediation_checklists` 表，ORM 已定义 `RemediationChecklist` 模型，但无 API 生成/返回清单，无 AI 服务调用。Sprint 5 需新增 `POST /api/remediation/generate`（或嵌入在分析响应中）生成结构化加固清单。

### [TC-3701] 加固清单 API 生成成功
- **Story:** US-37
- **Steps:**
  1. 完成一次 manual 分析（或使用已有 task_id）
  2. 调用 `POST /api/remediation/generate` 传入 `task_id: <id>`
  3. 检查响应
- **Expected:**
  - HTTP 200
  - `data.items` 数组 ≥ 1 条
  - 每条包含 `id`, `item_text`, `priority`, `category`（或类似字段）
  - `item_text` 描述具体可操作步骤
  - `priority` 分级（如 immediate/short_term/long_term/optional）
- **Result:** PENDING

### [TC-3702] 加固清单自动嵌入分析响应
- **Story:** US-37
- **Steps:**
  1. 提交 manual 分析
  2. 检查 `POST /api/analyze/manual` 响应中是否包含 `remediation_checklist`
- **Expected:**
  - 若设计为分析时自动生成：响应 `data.remediation_checklist` 有关联清单
  - 若设计为独立 API：响应中无 checklist，但日志提示生成入口
  - 两种设计均需明确且文档化
- **Result:** PENDING

### [TC-3703] 加固清单 AI prompt 质量检查
- **Story:** US-37
- **Steps:**
  1. 审查 ai_service.py 的新增 `generate_remediation_checklist()` 函数
  2. 检查 AI prompt
- **Expected:**
  - Prompt 包含原始漏洞分析结果（vuln_type, cvss_score, description）
  - 要求 JSON 数组输出，每项包含 item_text, priority, category
  - 明确要求 actionable（可执行的）步骤，不要泛泛的建议
  - Priority 定义：immediate（>9.0 CVSS）, short_term（7-9）, medium_term（4-7）, long_term（<4）
  - Category 至少包含：patching, configuration, code_fix, monitoring, access_control
- **Result:** PENDING

### [TC-3704] Priority 正确性验证
- **Story:** US-37
- **Steps:**
  1. 使用已知 CVSS 9.8 的漏洞（如 RCE）生成清单
  2. 使用已知 CVSS 5.0 的漏洞（如 XSS）生成清单
  3. 检查 priority 分级
- **Expected:**
  - CVSS ≥ 9.0 的漏洞对应的 checklist items 至少有 1 条 priority: "immediate" 或 "critical"
  - CVSS 4-7 的对应 priority 应为 "medium_term" 或类似
  - Priority 不应全部相同
  - Priority 分级与 CVSS 评分正相关
- **Result:** PENDING

### [TC-3705] 加固清单 DB 持久化
- **Story:** US-37
- **Steps:**
  1. 生成加固清单
  2. 查询 `SELECT * FROM remediation_checklists WHERE task_id = <id>`
- **Expected:**
  - 新增记录数 = 响应中 items.length
  - `item_text` 非空
  - `is_completed` 默认 = 0
  - `created_at` 有值
- **Result:** PENDING

### [TC-3706] 清单条目不可为空/不可重复
- **Story:** US-37
- **Steps:**
  1. 生成清单后检查 items
- **Expected:**
  - 每条 `item_text` 非空字符串
  - 无完全重复的 item_text（去重或 AI 确保不重复）
  - 若有重复，count ≤ 1（最多 1 条意外重复）
- **Result:** PENDING

### [TC-3707] 无漏洞场景（空 vulnerabilities）不生成清单
- **Story:** US-37
- **Steps:**
  1. 分析一个安全的输入（无漏洞结果）
  2. 尝试生成清单或检查自动生成行为
- **Expected:**
  - 返回空数组或明确信息 "未发现漏洞，无需加固"
  - 不在 DB 创建空记录
- **Result:** PENDING

### [TC-3708] 加固清单与 vulnerabilities 的数量关系
- **Story:** US-37
- **Steps:**
  1. 对有 3 个漏洞的 task 生成清单
  2. 检查 checklist items 数量
- **Expected:**
  - items ≥ vulnerabilities 数量（每个漏洞至少 1 条）
  - 不应有未关联漏洞的孤立 item
  - 若有通用的"安全加固建议"，应标记为 task 级别
- **Result:** PENDING

### [TC-3709] 重复生成不产生重复记录
- **Story:** US-37
- **Steps:**
  1. 对同一 task_id 调用两次生成
  2. 查询 DB
- **Expected:**
  - 若设计为幂等：第二次覆盖/替换，记录数不变
  - 若设计为非幂等：应警告或拒绝"已存在清单"
  - 不能产生重复记录的垃圾数据
- **Result:** PENDING

### [TC-3710] checklist 条目可标记完成状态
- **Story:** US-37
- **Steps:**
  1. 生成清单后
  2. 调用 `PUT/PATCH /api/remediation/{item_id}/toggle` 或类似
  3. 将 `is_completed` 从 0 切换为 1
  4. 再次请求清单
- **Expected:**
  - 完成状态切换成功
  - DB 中 `is_completed` 变为 1
  - 响应确认状态已更新
- **Result:** PENDING

---

## 六、US-38: 加固清单类别筛选

> **基线说明:** remediation_checklists 表目前仅有 `item_text` 和 `is_completed` 字段，无 category。Sprint 5 需扩展字段，支持类别分类和按类别筛选。

### [TC-3801] 加固清单 category 字段存在于 DB
- **Story:** US-38
- **Steps:**
  1. 检查 `init.sql` 或 migration：`remediation_checklists` 表是否新增 `category` 列
  2. 检查 ORM 模型是否有对应字段
- **Expected:**
  - SQL: `ALTER TABLE remediation_checklists ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'general'`
  - ORM: `category = Column(String(50), nullable=False, default="general")`
- **Result:** PENDING

### [TC-3802] API 支持按 category 筛选清单
- **Story:** US-38
- **Steps:**
  1. 生成包含多类别的清单
  2. 请求 `GET /api/remediation/{task_id}?category=patching`
  3. 请求 `GET /api/remediation/{task_id}?category=configuration`
- **Expected:**
  - patching 筛选返回仅 patching 类别的 items
  - configuration 筛选返回仅 configuration 类别的 items
  - 筛选后的数组不包含其他类别
- **Result:** PENDING

### [TC-3803] category 参数不传时返回全部
- **Story:** US-38
- **Steps:**
  1. 请求 `GET /api/remediation/{task_id}` 不传 category
- **Expected:**
  - 返回该 task 的所有 checklist items
  - 所有类别混合在结果中
- **Result:** PENDING

### [TC-3804] 不存在的 category 返回空数组
- **Story:** US-38
- **Steps:**
  1. 请求 `GET /api/remediation/{task_id}?category=nonexistent`
- **Expected:**
  - HTTP 200
  - items = []（空数组）
  - 不返回错误
- **Result:** PENDING

### [TC-3805] 按 priority + category 组合筛选
- **Story:** US-38
- **Steps:**
  1. 请求 `GET /api/remediation/{task_id}?category=patching&priority=immediate`
- **Expected:**
  - 返回 category=patching 且 priority=immediate 的交集
  - 所有返回项同时满足两个条件
- **Result:** PENDING

### [TC-3806] 前端 UI 提供 category 筛选下拉框
- **Story:** US-38
- **Steps:**
  1. 在完成 multi-source 分析后
  2. 检查加固清单区域是否有类别筛选 UI
- **Expected:**
  - Select 或 Tabs 组件显示可用的 category 列表
  - 包含至少 patching / configuration / code_fix / monitoring / access_control 选项
  - 切换类别立即过滤清单显示
  - 有"全部"选项重置筛选
- **Result:** PENDING

### [TC-3807] 类别筛选后统计计数更新
- **Story:** US-38
- **Steps:**
  1. 筛选到 patching 类别
  2. 检查清单区域显示
- **Expected:**
  - 显示 "X/Y 条"（X=当前筛选数量, Y=总数）
  - 或有 pending/completed 分类统计
  - 计数与实际数组长度一致
- **Result:** PENDING

---

## 七、US-39: 三栏布局正式启用

> **基线说明:** LayoutContainer 已有 `threeCol` state 和切换按钮。但三栏布局中 HistoryPanel 功能可能不完整（取决于 Sprint 4 完成度）。Sprint 5 需确保三栏布局正式发布：历史栏点击加载详情 → 联动中间图表区域 → 右侧 AI 面板完整展示。

### [TC-3901] 三栏布局按钮切换工作正常
- **Story:** US-39
- **Steps:**
  1. 页面默认双栏布局
  2. 点击"三栏"按钮
  3. 观察布局变化
  4. 再次点击"双栏"按钮切换回去
- **Expected:**
  - 三栏模式下：grid 变为 `xl:grid-cols-[1fr_1.6fr_1.4fr]`，三列并排显示
  - 双栏模式下：恢复 `lg:grid-cols-2`
  - 切换无闪烁/布局跳动
  - 切换时无数据丢失
- **Result:** PENDING

### [TC-3902] 三栏各区域内容正确渲染
- **Story:** US-39
- **Steps:**
  1. 切换到三栏模式
  2. 检查左栏（25%）：HistoryPanel 是否渲染
  3. 检查中栏（40%）：InputSection + VulnerabilityList + ChartArea
  4. 检查右栏（35%）：AIDetailAnalysis
- **Expected:**
  - 左栏：HistoryPanel 完整渲染（标题、筛选、列表、分页）
  - 中栏：三个子组件按序堆叠
  - 右栏：AIDetailAnalysis 初始显示 Empty 提示
  - 所有组件无 js error
- **Result:** PENDING

### [TC-3903] 历史记录点击 "加载" → 漏洞列表 & 图表区联动更新
- **Story:** US-39
- **Steps:**
  1. 三栏模式下，左栏历史列表有记录
  2. 点击某条记录的 "加载" 按钮
  3. 观察中栏 VulnerabilityList 和 ChartArea
  4. 观察右栏 AIDetailAnalysis
- **Expected:**
  - 中栏 VulnerabilityList 展示加载的漏洞
  - 中栏 4 个图表（Pie/Bar/Radar/Trend）全部更新为新数据
  - 右栏 AIDetailAnalysis 展示第一个漏洞详情
  - 加载状态用 Spin 反馈
- **Result:** PENDING

### [TC-3904] 三栏模式下新分析结果自动更新
- **Story:** US-39
- **Steps:**
  1. 三栏模式下，提交 manual 分析
  2. 分析完成后观察三栏
- **Expected:**
  - 中栏 VulnerabilityList 显示新分析结果
  - 中栏 ChartArea 自动更新
  - 右栏展示新分析详情
  - 左栏 HistoryPanel 可刷新获取最新记录
- **Result:** PENDING

### [TC-3905] 响应式降级：小屏自动回退双栏
- **Story:** US-39
- **Steps:**
  1. 三栏模式在 xl 屏幕（≥1280px）
  2. 缩窄浏览器窗口至 <1280px
  3. 观察布局
- **Expected:**
  - 三栏降级为单栏上下堆叠（grid-cols-1）
  - HistoryPanel、InputSection、VulnerabilityList、ChartArea、AIDetailAnalysis 按序堆叠
  - 无横向滚动条、无溢出的固定宽度
  - 恢复窗口宽度后又回到三栏
- **Result:** PENDING

### [TC-3906] 三栏按钮在小屏不显示或禁用
- **Story:** US-39
- **Steps:**
  1. 在 xl 以下屏幕（<1280px）
  2. 检查三栏切换按钮
- **Expected:**
  - 按钮可隐藏或 disabled + tooltip 说明 "需 1280px 以上屏幕"
  - 或按钮可见但点击无效/toast 提示
  - 不应强制进入三栏
- **Result:** PENDING

### [TC-3907] 三栏模式下的 Loading/Error/Empty 三态
- **Story:** US-39
- **Steps:**
  1. 三栏 + 历史加载中 → Loading 态
  2. 三栏 + API 故障 → Error 态
  3. 三栏 + 无历史数据 → Empty 态
- **Expected:**
  - Loading：Spin 居中显示（每个区域独立 loading）
  - Error：Alert 显示错误信息 + 重试按钮
  - Empty：Empty 组件 "暂无历史记录"
  - 三种状态互不干扰
- **Result:** PENDING

### [TC-3908] 三栏布局下的键盘/无障碍访问
- **Story:** US-39
- **Steps:**
  1. 三栏模式下 Tab 键焦点导航
  2. 检查 ARIA 标签
- **Expected:**
  - Tab 顺序合理：左→中→右（历史筛选→输入→图表→分析）
  - 关键按钮有 aria-label
  - 无键盘陷阱
- **Result:** PENDING

---

## 八、US-40: 多源对比雷达图

> **基线说明:** 当前 RadarChart 仅支持单系列 "安全态势评估"，六维度固定。Sprint 5 需扩展支持双源（ZAP vs Nmap）双雷达叠加对比，同时保留单雷达回退。

### [TC-4001] 双雷达渲染：ZAP 系列 + Nmap 系列
- **Story:** US-40
- **Steps:**
  1. 完成 multi-source 分析
  2. 检查 ChartArea 或新增的 ComparisonRadarChart 组件
  3. 确认雷达图显示两条系列线
- **Expected:**
  - 两条雷达线分别标注 "ZAP" 和 "Nmap"
  - 使用不同颜色/线型区分（如 ZAP=橙色, Nmap=蓝色）
  - 图例（legend）显示两个源名称
  - 六维度与单雷达相同：严重度分布 / 类型覆盖面 / 平均CVSS / 最高CVSS / 漏洞密度 / 影响广度
- **Result:** PENDING

### [TC-4002] ZAP 和 Nmap 数据源维度对齐
- **Story:** US-40
- **Steps:**
  1. 确认 ZAP 漏洞数组和 Nmap 漏洞数组分别计算六维度值
  2. 对比两个雷达的数值合理性
- **Expected:**
  - ZAP 维度基于 `cross_validation.zap_vulnerabilities` 或 `result.zap_vulnerabilities`
  - Nmap 维度基于 `cross_validation.nmap_vulnerabilities` 或 `result.nmap_vulnerabilities`
  - 每个维度的 max=100（ZAP 和 Nmap 共用同一套 scale）
  - 两个雷达的 indicator（维度名）完全一致
- **Result:** PENDING

### [TC-4003] Tooltip 同时显示两个源
- **Story:** US-40
- **Steps:**
  1. 鼠标悬停在对比雷达图的任意维度点
  2. 观察 tooltip
- **Expected:**
  - Tooltip 显示该维度两个源的值
  - 格式如：
    ```
    平均CVSS
    ZAP: 75
    Nmap: 42
    ```
  - 或 ECharts legend toggle 后只显示实时的单个
- **Result:** PENDING

### [TC-4004] 单源模式（仅 manual/batch）回退为单雷达
- **Story:** US-40
- **Steps:**
  1. 完成 manual 单源分析
  2. 检查 RadarChart 渲染
- **Expected:**
  - 仅显示 1 条雷达线（"安全态势" 或 "单源评估"）
  - 不报错、不空白
  - 图例仅 1 项
  - 与 Sprint 4 的单雷达行为完全一致
- **Result:** PENDING

### [TC-4005] Legend 交互：点击切换系列可见性
- **Story:** US-40
- **Steps:**
  1. 在双雷达图中点击 legend 的 "ZAP"
  2. 再点击 "Nmap"
  3. 再点击恢复两者
- **Expected:**
  - 点击 ZAP → ZAP 雷达线隐藏，仅 Nmap 可见
  - 点击 Nmap → Nmap 隐藏，仅 ZAP 可见
  - 再次点击恢复可见
  - 功能符合 ECharts 默认交互行为
- **Result:** PENDING

### [TC-4006] 双雷达模式下选中漏洞联动
- **Story:** US-40
- **Steps:**
  1. 在 CrossValidationPanel 点击一条匹配漏洞
  2. 观察双雷达图是否有联动高亮
  3. 或点击雷达图上的点是否联动其他面板
- **Expected:**
  - 若 US-40 要求：选中漏洞的维度在雷达图上高亮或显示标记
  - 至少不破坏现有的 chart:filter → AIDetailAnalysis 联动
  - 若暂不支持联动，不出现 js error
- **Result:** PENDING

### [TC-4007] 多源对比雷达图在双栏和三栏布局中均正常
- **Story:** US-40 (交叉 US-39)
- **Steps:**
  1. 双栏模式下查看对比雷达图
  2. 切换到三栏模式查看
  3. 缩放浏览器窗口
- **Expected:**
  - 双栏：在 ChartArea 的 grid 中渲染为 1/2 宽
  - 三栏：适配中栏 40% 宽度
  - 不出现横向溢出
  - height 固定 280px 合理显示
- **Result:** PENDING

### [TC-4008] 对比差值可视化提示
- **Story:** US-40
- **Steps:**
  1. 在 ZAP 和 Nmap 某一维度差异巨大时（如平均CVSS ZAP=80, Nmap=20）
  2. 观察图表上是否有差异提示
- **Expected:**
  - 若设计包含差值标注：差异大的维度有视觉提示（如阴影面积差、箭头、百分比标注）
  - 若不包含：雷达图面积差异直观可见，不额外标注也是可接受的
- **Result:** PENDING

---

## 九、集成 & 边界测试

### [TC-I01] Sprint 5 全链路：ZAP+Nmap → 交叉验证 → CVSS校验 → 缓存 → 加固清单 → 四象限 → 双雷达
- **Story:** 集成
- **Steps:**
  1. 上传 ZAP JSON + Nmap XML
  2. 等待 multi-source 分析完成
  3. 验证 cross_validation 四象限
  4. 验证 CVSS 向量全部合法
  5. 验证 Redis 缓存生效
  6. 生成加固清单
  7. 筛选清单类别
  8. 切换三栏布局
  9. 查看双雷达对比图
  10. 从历史加载此任务
- **Expected:**
  - 全流程无错误
  - 各组件数据一致
  - 响应时间（不含 AI 调用）< 3s
- **Result:** PENDING

### [TC-I02] 并发 multi-source 请求
- **Story:** 集成
- **Steps:**
  1. 同时发送 3 个 multi-source 请求
  2. 等待全部完成
  3. 检查 MySQL + Redis
- **Expected:**
  - 3 个 task_id 均正确创建
  - 无数据混串（ZAP-A 和 Nmap-B 不交叉）
  - Redis 缓存键不冲突
  - 无 DB 死锁
- **Result:** PENDING

### [TC-I03] 大文件上传（ZAP JSON 10MB + Nmap XML 10MB）
- **Story:** 边界
- **Steps:**
  1. 构造或使用大型扫描报告（ZAP ~10MB完整报告，Nmap ~10MB /24 扫描）
  2. 上传 multi-source
- **Expected:**
  - 前端限制：10MB `MAX_SIZE` 应适用
  - 若后端不限制：response 时间合理（可长但不断开）
  - 不 OOM（内存使用 < 200MB 增量）
  - 结果完整返回
- **Result:** PENDING

### [TC-I04] 空报告（ZAP 无 alert / Nmap 无开放端口）
- **Story:** 边界
- **Steps:**
  1. ZAP 报告：0 个 alert
  2. Nmap 报告：0 个开放端口（全部 filtered）
  3. 上传 multi-source
- **Expected:**
  - HTTP 200
  - `zap_vulnerabilities` = []
  - `nmap_vulnerabilities` = []
  - `cross_validation` 各子数组为空
  - 前端不崩溃
  - 空状态提示 "未发现漏洞"
- **Result:** PENDING

### [TC-I05] AI 调用超时的优雅降级
- **Story:** 边界
- **Steps:**
  1. 模拟 AI API 超时（调整 timeout 为 1s）
  2. 发送 multi-source 请求
- **Expected:**
  - HTTP 503 "AI 服务响应超时"
  - 不创建残留的 pending task
  - 前端显示友好的错误提示（非白屏）
- **Result:** PENDING

### [TC-I06] Sprint 4 历史回看 + Sprint 5 多源结果的兼容性
- **Story:** 集成
- **Steps:**
  1. 在 Sprint 4 的 DB 中预先有 manual/batch 的历史记录
  2. 在 Sprint 5 中查询历史
  3. 加载 Sprint 4 的 manual 记录
  4. 加载 Sprint 5 的 multi-source 记录
- **Expected:**
  - Sprint 4 记录正常加载，UI 不变
  - Sprint 5 multi-source 记录加载后显示交叉验证面板 + 双雷达
  - 两种记录类型平滑过渡，无 breaking change
- **Result:** PENDING

---

## 附录 A: CVSS 3.1 标准参考向量

| 向量 | 预期分数 | 严重性 |
|------|---------|--------|
| `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` | 9.8 | Critical |
| `AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H` | 8.1 | High |
| `AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H` | 8.8 | High |
| `AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N` | 4.2 | Medium |
| `AV:L/AC:L/PR:N/UI:R/S:U/C:N/I:N/A:H` | 5.5 | Medium |
| `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L` | 5.3 | Medium |
| `AV:N/AC:L/PR:H/UI:N/S:U/C:N/I:N/A:N` | 0.0 | None |

## 附录 B: 交叉验证输出 Schema 参考

```json
{
  "cross_validation": {
    "matched": [
      {
        "match_type": "exact",
        "zap_item": { "vuln_name": "...", "vuln_type": "...", "cvss_score": 8.1 },
        "nmap_item": { "vuln_name": "...", "vuln_type": "...", "port": 443, "service": "https" },
        "confidence": 0.9
      }
    ],
    "zap_only": [
      { "vuln_name": "SQL Injection", "reason": "Web-layer; Nmap network scan cannot detect" }
    ],
    "nmap_only": [
      { "vuln_name": "Open SSH port", "reason": "Network-layer; ZAP web scan cannot detect" }
    ],
    "conflicts": [
      {
        "vuln_name": "Weak TLS",
        "zap_assessment": { "cvss_score": 7.5, "severity": "High" },
        "nmap_assessment": { "cvss_score": 5.9, "severity": "Medium" },
        "difference_reason": "ZAP detected certificate chain issues, Nmap only checks cipher suite"
      }
    ]
  },
  "summary": "...",
  "cvss_overall": 9.8
}
```

## 附录 C: 加固清单 category 枚举参考

| Category | 含义 | 示例 |
|----------|------|------|
| `patching` | 补丁/升级 | 将 OpenSSL 升级到 3.x |
| `configuration` | 配置加固 | 禁用 TLS 1.0/1.1 |
| `code_fix` | 代码修复 | 使用参数化查询替代字符串拼接 |
| `monitoring` | 监控告警 | 配置 WAF 规则监控 SQLi 尝试 |
| `access_control` | 访问控制 | 限制管理界面仅内网 IP 访问 |
| `network` | 网络层面 | 关闭未使用的 22 端口外网访问 |
| `general` | 通用建议 | 定期进行渗透测试 |

## 附录 D: 依赖与前置条件

- Sprint 4 成果（US-25~32 + US-21 债务清还）必须已验收通过
- 后端需安装 `cvss` Python 库（`pip install cvss`）或自行实现 CVSS 3.1 计算
- Redis 服务需可用（用于 CVSS 缓存 + 分析结果缓存）
- 前端 ECharts 依赖已就绪（用于双雷达图）
- 需新增 Python 依赖：`pip install python-multipart`（文件上传）
