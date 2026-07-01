# Sprint 1 安全审查清单

> 审查日期: 2026-06-30 | 审查人: QA & Security Agent (robot01)  
> 范围: US-01 ~ US-08 安全相关项  
> 状态: 设计阶段预审 — 待代码落地后复查

---

## [SEC-01] CORS 配置审查

### 审查项
| # | 检查点 | 要求 | 设计预期 | 风险 |
|---|--------|------|---------|------|
| 1 | `Access-Control-Allow-Origin` | 不设为 `*` | 指定具体域名列表，通过 `CORS_ORIGINS` 环境变量注入 | ⚠️ 若设为 `*` 则任意网站均可调用 API |
| 2 | `Access-Control-Allow-Methods` | 仅暴露必要 HTTP 方法 | 应为 `GET, POST, PUT, DELETE` 或更少 | 低 |
| 3 | `Access-Control-Allow-Headers` | 限制允许的请求头 | 应为 `Content-Type, Authorization` | 低 |
| 4 | `Access-Control-Allow-Credentials` | 如需携带 Cookie | 若使用 Token 认证（Bearer），不建议开启 | ⚠️ 与 `*` origin 互斥 |
| 5 | CORS 配置来源 | 环境变量动态配置 | `CORS_ORIGINS` 逗号分隔，非硬编码 | 合规 |

### 审查结论
- **状态:** ⚠️ 设计层面无问题，代码落地后需验证：
  - FastAPI `CORSMiddleware` 的 `allow_origins` 参数是否为动态读取
  - `allow_methods` 和 `allow_headers` 是否过度开放
  - 生产环境 `CORS_ORIGINS` 是否仅包含实际域名

### 验收检查清单
```
[ ] FastAPI CORS 配置使用环境变量 CORS_ORIGINS
[ ] allow_origins 不为 ["*"]
[ ] allow_credentials 为 False（若使用 Bearer Token）
[ ] Docker Compose 中 CORS_ORIGINS 默认值合理
```

---

## [SEC-02] API 端点授权审查

### 审查项
| # | 检查点 | 要求 | 风险等级 |
|---|--------|------|---------|
| 1 | `/api/v1/vulnerabilities` (GET) | 是否允许未授权访问？Sprint 1 无用户系统，该端点可公开 | Low |
| 2 | `/api/v1/vulnerabilities` (POST) | 是否允许匿名提交？Sprint 1 允许，后期需加认证 | ⚠️ Medium |
| 3 | `/api/v1/analysis` (POST) | 是否会消耗 AI API 配额？需加速率限制 | ⚠️ High |
| 4 | `/api/v1/health` (GET) | 是否暴露敏感信息（DB 状态/IP 等）？ | ⚠️ Medium |
| 5 | 所有 POST 端点 | 是否验证 Content-Type 为 `application/json`？ | Medium |

### 审查结论
- **状态:** ⚠️ Sprint 1 作为 MVP 无用户认证系统，可接受匿名访问，但必须：
  1. **速率限制**: `/api/v1/analysis` 必须限制请求频率（建议 10 req/min）
  2. **健康检查脱敏**: `/health` 不暴露数据库 IP/密码/端口
  3. **请求大小限制**: POST body 的大小限制（建议 10KB）
  4. **Content-Type 校验**: 拒绝非 JSON 请求

### 验收检查清单
```
[ ] analysis 端点有速率限制（Redis 实现）
[ ] POST 端点限制 request body ≤ 10KB
[ ] /health 不暴露数据库连接字符串等敏感信息
[ ] 非 JSON Content-Type 拒绝并返回 415
[ ] 所有异常返回统一 { code, message, data } 格式，不泄露堆栈
```

---

## [SEC-03] 环境变量管理审查

### 审查项
| # | 检查点 | 要求 | 风险等级 |
|---|--------|------|---------|
| 1 | `.env` 文件是否在 `.gitignore` 中 | 必须排除 | 🔴 Critical |
| 2 | `AI_API_KEY` 是否硬编码 | 必须通过环境变量读取 | 🔴 Critical |
| 3 | `DATABASE_URL` 是否包含密码 | 确保不在日志/响应中出现 | 🔴 Critical |
| 4 | `.env.template` 是否提供 | 需有模板文件，值用占位符 | ✅ Required |
| 5 | 日志是否打印环境变量 | `LOG_LEVEL=DEBUG` 时不能泄露密钥 | ⚠️ High |

### 审查结论
- **已创建** `docker/.env.template`，值使用占位符
- **待验证**: 
  - `backend/.gitignore` 是否包含 `.env`
  - `frontend/.gitignore` 是否包含 `.env` / `.env.local`
  - 后端日志模块是否过滤敏感字段（API Key / 密码 / Token）

### 验收检查清单
```
[ ] .env 在 backend/.gitignore 和根 .gitignore 中
[ ] 代码中无硬编码的 sk-xxx / Bearer token / 密码字符串
[ ] 后端 logger 过滤敏感字段（或 LOG_LEVEL=INFO 时不打印 Request body）
[ ] .env.template 存在且值均为占位符
```

---

## [SEC-04] 输入安全审查

### 审查项
| # | 检查点 | 要求 | 风险等级 |
|---|--------|------|---------|
| 1 | SQL 注入 | 使用 SQLAlchemy 2.0 参数化查询 | 🔴 Critical |
| 2 | XSS | React JSX 默认转义，dangerouslySetInnerHTML 禁用 | ⚠️ High |
| 3 | 命令注入 | 无 `os.system()` / `subprocess` 用户参数拼接 | 🔴 Critical |
| 4 | Prompt Injection | AI 分析提示词中用户输入需包裹/限制 | ⚠️ Medium |
| 5 | JSON 解析安全 | 使用 `Pydantic` 模型校验，类型强制 | Medium |

### 验收检查清单
```
[ ] 所有数据库查询使用 SQLAlchemy ORM 或参数化查询
[ ] 前端无 dangerouslySetInnerHTML（或仅用于受信任内容）
[ ] 后端无 subprocess/os.system 调用用户输入
[ ] AI Prompt 使用系统提示词 + 用户消息分离，限制输出格式
[ ] 所有 API 请求体使用 Pydantic BaseModel 校验
```

---

## [SEC-05] 依赖安全审查

### 审查项
| # | 检查点 | 要求 |
|---|--------|------|
| 1 | Python 依赖 | `requirements.txt` 锁定版本号（`pydantic>=2.0,<3.0` 类似） |
| 2 | Node 依赖 | `package.json` 使用 `^` / `~` 合理范围控制 |
| 3 | CVE 扫描 | CI 中集成 `pip-audit` / `npm audit` |

### 验收检查清单
```
[ ] requirements.txt 依赖有版本下限
[ ] package.json 无已知高危漏洞依赖
[ ] CI 包含 npm audit / pip-audit 步骤（Sprint 2+）
```

---

## 汇总

| 审查项 | 状态 | 风险 |
|--------|------|------|
| SEC-01 CORS 配置 | ⚠️ 设计合规，待代码验证 | Medium |
| SEC-02 API 授权 | ⚠️ MVP 可接受，需速率限制 | High |
| SEC-03 环境变量 | ✅ 模板已创建，待代码验证 | Critical |
| SEC-04 输入安全 | ⚠️ 待代码落地后审查 | Critical |
| SEC-05 依赖安全 | ⚠️ 待依赖文件生成后审查 | Medium |

> **总体结论:** 设计阶段无明显阻塞问题。代码落地后需重点复查 SEC-03（硬编码密钥）和 SEC-04（SQL注入防护）。
