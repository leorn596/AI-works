# Sprint 1 测试用例

> 版本: v1.0 | 日期: 2026-06-30 | QA Agent: robot01  
> 覆盖: US-01 ~ US-08 (Sprint 1 最小闭环)

---

## 测试概览

| 测试类别 | 用例数 | 覆盖范围 |
|---------|-------|---------|
| 页面三态 (Loading/Success/Error) | 6 | US-06, US-07 |
| 表单边界测试 | 6 | US-04 |
| 网络异常模拟 | 4 | US-04, US-05 |
| 初始空状态引导 | 2 | US-06 |
| CORS/Env/ErrorBoundary | 5 | US-08 |
| API 端点验证 | 4 | US-02, US-03 |
| 前端脚手架验证 | 4 | US-01 |
| **合计** | **31** | US-01 ~ US-08 |

---

## US-01: 前端脚手架（React+Vite+路由+状态管理）

### [TC-0101] 项目启动验证
- **Story:** US-01
- **Steps:**
  1. 进入 `frontend/` 目录
  2. 执行 `npm install`
  3. 执行 `npm run dev`
  4. 浏览器访问 `http://localhost:5173`
- **Expected:** 页面正常渲染，无白屏/无控制台报错，Vite 热更新生效
- **Result:** PENDING

### [TC-0102] 路由系统验证
- **Story:** US-01
- **Steps:**
  1. 启动前端开发服务器
  2. 访问 `/` 根路径 → 观察是否渲染默认页面
  3. 访问 `/analysis` 路径 → 观察是否进入分析页面
  4. 访问任意不存在的路径 `/nonexistent` → 观察是否展示 404
- **Expected:**
  - `/` 正常渲染首页
  - `/analysis` 正常渲染分析页
  - `/nonexistent` 展示 404 页面
- **Result:** PENDING

### [TC-0103] Redux Store 初始化验证
- **Story:** US-01
- **Steps:**
  1. 启动前端，打开 Redux DevTools
  2. 观察初始 state 结构
  3. 确认 store 包含必要的 slice（vuln, analysis, ui）
- **Expected:** Redux store 正常初始化，slice 结构完整，无 undefined 值
- **Result:** PENDING

### [TC-0104] Ant Design + Tailwind 共存验证
- **Story:** US-01
- **Steps:**
  1. 渲染一个 Ant Design Button 组件
  2. 同一页面渲染一个 Tailwind 样式的 div
  3. 检查元素样式是否各自生效，无样式冲突
- **Expected:** Ant Design 组件样式正常，Tailwind 类名正常生效，无 CSS 冲突
- **Result:** PENDING

---

## US-02: 后端框架（FastAPI+路由结构）

### [TC-0201] 后端启动验证
- **Story:** US-02
- **Steps:**
  1. 进入 `backend/` 目录
  2. 安装依赖 `pip install -r requirements.txt`
  3. 执行 `uvicorn main:app --host 0.0.0.0 --port 8000`
  4. 访问 `http://localhost:8000/docs`
- **Expected:** Swagger UI 正常展示，所有已注册路由可见
- **Result:** PENDING

### [TC-0202] /health 端点返回值格式
- **Story:** US-02
- **Steps:**
  1. 启动后端服务
  2. `curl http://localhost:8000/api/v1/health`
  3. 检查返回 JSON 结构及 HTTP 状态码
- **Expected:**
  - HTTP 200
  - 返回格式: `{ "code": 200, "message": "ok", "data": { "status": "healthy", ... } }`
  - `data.status` 为 `"healthy"`
- **Result:** PENDING

### [TC-0203] API 路由结构验证
- **Story:** US-02
- **Steps:**
  1. 检查 `backend/api/` 目录结构
  2. 确认路由注册在 `api/v1/` 前缀下
  3. 确认存在 `/api/v1/vulnerabilities` 相关端点
  4. 确认存在 `/api/v1/analysis` 相关端点
- **Expected:**
  - 路由结构: `/api/v1/` 前缀
  - 至少包含: health, vulnerabilities, analysis 路由模块
- **Result:** PENDING

### [TC-0204] 统一返回格式一致性
- **Story:** US-02
- **Steps:**
  1. 调用 `/api/v1/health` → 检查返回结构
  2. 调用 `/api/v1/vulnerabilities` (GET) → 检查返回结构
  3. 调用 `/api/v1/analysis` (POST) → 检查返回结构
  4. 触发一个 404 → 检查返回结构
- **Expected:** 所有端点统一返回 `{ "code": <number>, "message": "<string>", "data": <any> }` 格式
- **Result:** PENDING

---

## US-03: MySQL 核心表创建

### [TC-0301] 数据库连接验证
- **Story:** US-03
- **Steps:**
  1. 启动 MySQL 服务
  2. 使用配置的凭据连接数据库
  3. 执行 `SHOW TABLES;`
- **Expected:** 连接成功，数据库存在，表结构正确
- **Result:** PENDING

### [TC-0302] vulnerabilities 表结构验证
- **Story:** US-03
- **Steps:**
  1. 连接 MySQL
  2. 执行 `DESCRIBE vulnerabilities;`
  3. 检查关键字段: id, title, description, severity, status, created_at, updated_at
- **Expected:**
  - 存在 `id` (主键/自增)
  - 存在 `title` (VARCHAR/非空)
  - 存在 `description` (TEXT)
  - 存在 `severity` (枚举/VARCHAR)
  - 存在 `status` (枚举/VARCHAR, 默认 pending)
  - 存在 `created_at` / `updated_at` (DATETIME/TIMESTAMP)
- **Result:** PENDING

### [TC-0303] analysis_results 表结构验证
- **Story:** US-03
- **Steps:**
  1. 连接 MySQL
  2. 执行 `DESCRIBE analysis_results;`
  3. 检查关联字段: vulnerability_id, ai_analysis, confidence_score
- **Expected:**
  - 存在 `vulnerability_id` (外键关联 vulnerabilities.id)
  - 存在 `ai_analysis` (JSON/TEXT)
  - 存在 `confidence_score` (DECIMAL/FLOAT)
  - 外键约束生效
- **Result:** PENDING

---

## US-04: 手动填写漏洞描述并提交分析

### [TC-0401] 表单空输入校验
- **Story:** US-04
- **Steps:**
  1. 打开分析页面
  2. 标题和描述字段保持为空
  3. 点击"提交分析"按钮
- **Expected:**
  - 表单阻止提交
  - 在标题字段显示 "请输入漏洞标题" 或类似错误提示
  - 在描述字段显示 "请输入漏洞描述" 或类似错误提示
  - 不发送 API 请求
- **Result:** PENDING

### [TC-0402] 表单超短输入校验
- **Story:** US-04
- **Steps:**
  1. 标题输入 "XSS"（少于 5 字符，如果规则如此）
  2. 描述输入 "有漏洞"（少于最小字符数）
  3. 点击提交
- **Expected:** 表单提示输入长度不足（具体阈值按实际校验规则判断）
- **Result:** PENDING

### [TC-0403] 表单超长输入处理
- **Story:** US-04
- **Steps:**
  1. 标题输入 500 个字符
  2. 描述输入 50000 个字符
  3. 点击提交
- **Expected:** 表单提示长度超限，或自动截断，不会导致页面崩溃
- **Result:** PENDING

### [TC-0404] 特殊字符输入安全
- **Story:** US-04
- **Steps:**
  1. 标题输入 `<script>alert('XSS')</script>`
  2. 描述输入 `'; DROP TABLE vulnerabilities; --`
  3. 点击提交（即使校验通过）
- **Expected:**
  - 前端对输入做转义/过滤（React JSX 默认转义）
  - 后端使用参数化查询，不执行注入
  - 提交后页面无异常，数据库完整
- **Result:** PENDING

### [TC-0405] 正常提交流程验证
- **Story:** US-04
- **Steps:**
  1. 标题输入 "SQL Injection in /api/users"
  2. 描述输入 "发现 /api/users 端点的 id 参数存在 SQL 注入..."
  3. 点击"提交分析"
  4. 观察：loading 状态出现 → 结果页面展示
- **Expected:**
  - 提交按钮变为 loading 状态
  - 提交期间不可重复点击
  - 提交成功后跳转到结果展示
  - 漏洞列表中出现新条目
- **Result:** PENDING

### [TC-0406] Unicode / 中文输入验证
- **Story:** US-04
- **Steps:**
  1. 标题输入 "跨站脚本攻击漏洞（反射型）"
  2. 描述输入包含中文、emoji 的完整描述
  3. 点击提交
- **Expected:** 正常提交，数据库正确存储 UTF-8 内容，页面正常展示
- **Result:** PENDING

---

## US-05: AI 生成漏洞分析结果

### [TC-0501] AI 分析成功返回验证
- **Story:** US-05
- **Steps:**
  1. 提交一个有效的漏洞描述
  2. 等待 AI 分析完成
  3. 检查返回的 analysis 数据结构
- **Expected:**
  - API 返回 `{ code: 200, data: { analysis: ..., confidence: ..., recommendation: ... } }`
  - `analysis` 字段包含结构化内容
  - `confidence` 为 0-1 之间的数值
- **Result:** PENDING

### [TC-0502] AI 服务不可用时的降级处理
- **Story:** US-05
- **Steps:**
  1. 模拟 AI API 不可用（断开网络或使用无效 API Key）
  2. 提交漏洞描述
  3. 观察前端和后端行为
- **Expected:**
  - 后端返回 `{ code: 503, message: "AI 服务暂时不可用", data: null }`
  - 前端展示友好的错误提示，不崩溃
  - 漏洞记录仍然保存（待分析状态）
- **Result:** PENDING

### [TC-0503] AI 分析超时处理
- **Story:** US-05
- **Steps:**
  1. 设置 AI API 超时时间为 2 秒（或模拟慢响应）
  2. 提交一个超长漏洞描述
  3. 观察超时行为
- **Expected:**
  - 后端在超时后返回 `{ code: 504, message: "AI 分析超时", data: null }`
  - 前端展示超时提示，保留用户输入数据
- **Result:** PENDING

---

## US-06: 双栏布局（左漏洞列表 / 右AI分析区）

### [TC-0601] 初始空状态展示
- **Story:** US-06
- **Steps:**
  1. 清空数据库中的漏洞记录
  2. 访问主页
  3. 观察页面布局
- **Expected:**
  - 左侧展示空状态引导（如 "暂无漏洞，请提交第一个漏洞分析"）
  - 右侧分析区展示初始引导（如 "点击左侧漏洞查看详细分析"）
  - 双栏布局结构正确
- **Result:** PENDING

### [TC-0602] 漏洞列表加载状态
- **Story:** US-06
- **Steps:**
  1. 确保数据库有 10+ 条记录
  2. 刷新页面
  3. 观察列表加载过程
- **Expected:**
  - 左侧列表加载期间展示 Skeleton/Spin 组件
  - 加载完成后正常展示漏洞条目
  - 每个条目显示标题、严重程度标签、状态
- **Result:** PENDING

### [TC-0603] 点击漏洞展示分析详情
- **Story:** US-06
- **Steps:**
  1. 左侧列表有漏洞
  2. 点击列表中的某个漏洞
  3. 观察右侧面板变化
- **Expected:**
  - 右侧显示该漏洞的 AI 分析详情
  - 选中漏洞高亮显示
  - 切换漏洞时右侧平滑更新
- **Result:** PENDING

### [TC-0604] 响应式布局验证
- **Story:** US-06
- **Steps:**
  1. 打开页面，浏览器窗口宽度 ≥ 1024px
  2. 缩小到 768px
  3. 缩小到 375px（手机尺寸）
- **Expected:**
  - 1024px+: 左右双栏并排
  - 768px: 左右双栏或切换为上下布局
  - 375px: 单栏布局，列表和分析区可切换
- **Result:** PENDING

---

## US-07: 统一 Loading 状态

### [TC-0701] API 请求全程 Loading 态
- **Story:** US-07
- **Steps:**
  1. 提交漏洞分析请求
  2. 提交后立即观察按钮和页面状态
  3. 等待请求完成
  4. 观察是否回到正常状态
- **Expected:**
  - 提交按钮立即进入 loading（显示 Spin/disabled）
  - 页面显示全局加载指示器
  - 请求完成后 loading 消失，渲染结果
- **Result:** PENDING

### [TC-0702] 快速连续点击防护
- **Story:** US-07
- **Steps:**
  1. 快速连续点击"提交分析"按钮 5 次
  2. 观察 Network 面板
- **Expected:** 只发送 1 次 API 请求，按钮在 loading 期间不可点击
- **Result:** PENDING

### [TC-0703] 列表刷新 Loading 态
- **Story:** US-07
- **Steps:**
  1. 在左侧漏洞列表上方点击刷新按钮
  2. 观察列表区域状态
- **Expected:** 列表区域显示 loading skeleton/Spin，请求完成后刷新数据
- **Result:** PENDING

---

## US-08: CORS/环境变量/ErrorBoundary

### [TC-0801] CORS 跨域请求验证
- **Story:** US-08
- **Steps:**
  1. 前端运行在 `localhost:5173`
  2. 后端运行在 `localhost:8000`
  3. 从前端发起 API 请求到后端
  4. 检查浏览器 Network 面板中的 CORS 头
- **Expected:**
  - 请求成功，无 CORS blocked 错误
  - 响应头包含 `Access-Control-Allow-Origin`（不应为 `*`，应指定具体域名）
  - 响应头包含 `Access-Control-Allow-Methods`、`Access-Control-Allow-Headers`
- **Result:** PENDING

### [TC-0802] 环境变量缺失时的后端启动行为
- **Story:** US-08
- **Steps:**
  1. 删除/注释 `.env` 中的 `DATABASE_URL`
  2. 尝试启动后端服务
  3. 观察启动日志
- **Expected:**
  - 后端启动失败，输出明确错误消息 "未配置 DATABASE_URL 环境变量"
  - 进程以非零退出码退出
  - 不在启动时 panic/crash dump
- **Result:** PENDING

### [TC-0803] 无硬编码密钥检查
- **Story:** US-08
- **Steps:**
  1. 搜索 `backend/` 目录中所有 `.py` 文件
  2. 搜索关键字: `sk-`, `api_key =`, `password = "`, `secret = "`
  3. 搜索 `frontend/` 目录中所有 `.ts/.tsx/.js/.jsx` 文件
  4. 搜索关键字: `sk-`, `Bearer`, `api_key:`
- **Expected:** 所有密钥/密码均通过环境变量或 `.env` 文件读取，无硬编码
- **Result:** PENDING

### [TC-0804] ErrorBoundary 捕获验证
- **Story:** US-08
- **Steps:**
  1. 在前端代码中临时抛出一个 Error（仅在测试环境）
  2. 观察页面行为
- **Expected:**
  - 页面不白屏
  - 展示 ErrorBoundary 兜底 UI（如 "页面发生错误，请刷新重试"）
  - 错误被捕获并记录到控制台
- **Result:** PENDING

### [TC-0805] 后端全局异常处理验证
- **Story:** US-08
- **Steps:**
  1. 访问一个会触发 500 的端点（或模拟异常）
  2. 检查返回格式
- **Expected:**
  - 返回 `{ "code": 500, "message": "服务器内部错误", "data": null }`
  - 不暴露堆栈信息给客户端
- **Result:** PENDING

---

## 网络异常模拟

### [TC-NET01] API 超时前端降级
- **Story:** US-04, US-07
- **Steps:**
  1. 使用 Chrome DevTools → Network → 限制为 Slow 3G
  2. 提交漏洞分析请求
  3. 设置请求超时（前端 axios/fetch timeout 30s）
- **Expected:**
  - 超时后展示 "请求超时，请重试" 提示
  - 不白屏，不崩溃
  - 用户可重新提交
- **Result:** PENDING

### [TC-NET02] 断网状态前端降级
- **Story:** US-04, US-07
- **Steps:**
  1. 打开页面，在 DevTools → Network 中选择 "Offline"
  2. 点击提交分析
- **Expected:**
  - 展示 "网络连接异常，请检查网络" 提示
  - 保留用户已输入的内容
- **Result:** PENDING

### [TC-NET03] API 返回 5xx 前端降级
- **Story:** US-05
- **Steps:**
  1. Mock API 返回 500 状态码
  2. 从前端发起请求
- **Expected:**
  - 前端捕获错误，展示 "服务器错误，请稍后重试"
  - 不白屏，不崩溃
- **Result:** PENDING

### [TC-NET04] API 返回 4xx 前端降级
- **Story:** US-04
- **Steps:**
  1. Mock API 返回 400 状态码 + `{ code: 400, message: "请求参数错误" }`
  2. 从前端发起请求
- **Expected:**
  - 前端展示后端返回的具体错误消息
  - 表单高亮错误字段
- **Result:** PENDING

---

## 缺陷报告模板

```
[BUG-<id>] <Title>
  Severity: Critical / High / Medium / Low
  Story: US-XX
  Steps to Reproduce: 1. 2. 3.
  Expected: 
  Actual: 
  Screenshot/Log: <link or paste>
```

---

## 验收结论模板

### [ACCEPT] US-XX
- 所有关联测试用例通过
- 无 P0/P1 缺陷
- 功能完整可用

### [REJECT] US-XX
- 原因: <具体原因>
- 阻塞缺陷: [BUG-XX]
- 改进意见: <可执行的具体步骤>

---

## 变更记录

| 日期 | 版本 | 描述 |
|------|------|------|
| 2026-06-30 | v1.0 | 初始版本，覆盖 US-01 ~ US-08 共 31 个测试用例 |
