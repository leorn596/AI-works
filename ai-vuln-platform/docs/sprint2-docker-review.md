# Sprint 2 Docker 配置审查与更新建议

> 审查日期: 2026-06-30 | 审查人: DevOps Agent (robot01)  
> 范围: Sprint 2 新增功能所需的 Docker/环境变量变更

---

## 一、现有配置基线

| 文件 | 状态 | Sprint 2 是否需要更新 |
|------|------|----------------------|
| `docker/docker-compose.yml` | 包含 4 服务 (db/redis/backend/frontend) | ✅ 需要 |
| `docker/.env.template` | Sprint 1 变量 | ✅ 需要 |
| `docker/backend.Dockerfile` | Python 3.11 + requirements.txt | ✅ 需要 |
| `docker/frontend.Dockerfile` | Multi-stage Node 20 → Nginx | ⚠️ 可能不需要 |
| `docker/nginx.conf` | SPA 路由 + API 代理 | ✅ 需要 |

---

## 二、docker-compose.yml 更新建议

### 2.1 Nginx 文件上传大小限制

当前 `nginx.conf` **未设置** `client_max_body_size`，Nginx 默认限制为 1MB。Sprint 2 需要上传最大 10MB 的文件（ZAP JSON / Nmap XML），必须增加此配置。

```nginx
# docker/nginx.conf 新增（在 server 块顶部）
server {
    listen 80;
    server_name _;

    # 🆕 Sprint 2: 允许上传最大 10MB 的扫描报告文件
    client_max_body_size 10m;

    # ... 其余配置不变
}
```

### 2.2 后端服务新增环境变量

在 `docker-compose.yml` 的 `backend` service → `environment` 块新增：

```yaml
backend:
  environment:
    # ... Sprint 1 现有变量保持不变 ...

    # 🆕 Sprint 2: 文件上传
    MAX_UPLOAD_SIZE_MB: ${MAX_UPLOAD_SIZE_MB:-10}

    # 🆕 Sprint 2: 速率限制
    RATE_LIMIT_ANALYZE_PER_MIN: ${RATE_LIMIT_ANALYZE_PER_MIN:-10}
    RATE_LIMIT_UPLOAD_PER_MIN: ${RATE_LIMIT_UPLOAD_PER_MIN:-5}

    # 🆕 Sprint 2: XML 解析安全
    XML_PARSE_TIMEOUT_SEC: ${XML_PARSE_TIMEOUT_SEC:-30}
```

### 2.3 AI 分析超时时间同步

目前 `proxy_read_timeout` 在 nginx.conf 中为 `120s`，这对单个手动分析足够。但 Sprint 2 的 `/api/analyze/batch` 端点可能需要处理文件上传+解析+批量 AI 分析，建议确认 120s 是否足够。如果批量分析包含多条漏洞，可适当增加：

```nginx
# 建议：Sprint 2 batch 端点延长超时
location /api/analyze/batch {
    proxy_pass http://backend:8000;
    proxy_read_timeout 300s;  # 🆕 5 分钟用于批量分析
    # ... 其余 proxy_set_header
}
```

---

## 三、.env.template 更新建议

在 `docker/.env.template` 末尾新增 Sprint 2 变量：

```bash
# ---- 文件上传 (Sprint 2) ----
MAX_UPLOAD_SIZE_MB=10

# ---- 速率限制 (Sprint 2) ----
RATE_LIMIT_ANALYZE_PER_MIN=10
RATE_LIMIT_UPLOAD_PER_MIN=5

# ---- XML 解析 (Sprint 2) ----
XML_PARSE_TIMEOUT_SEC=30
```

---

## 四、backend.Dockerfile 更新建议

### 4.1 新增 Python 依赖

Sprint 2 新增的后端依赖将加到 `requirements.txt`：

```
# requirements.txt 新增
defusedxml>=0.7.0       # XML XXE 安全解析
slowapi>=0.1.9          # API 速率限制
```

Dockerfile 本身不需要变更，因为依赖通过 `requirements.txt` 安装。

### 4.2 AML/C++ 编译依赖确认

如果使用 `lxml` 代替 `defusedxml`，需要确认基础镜像已包含编译所需的 C 库。当前 Dockerfile 已安装 `gcc`，但 `lxml` 还需要 `libxml2-dev` 和 `libxslt-dev`：

```dockerfile
# 如果选择 lxml（而非 defusedxml），需新增：
RUN apt-get install -y --no-install-recommends \
    libxml2-dev \
    libxslt-dev
```

**建议：** 使用 `defusedxml` 而非 `lxml`，避免额外系统依赖。

---

## 五、frontend.Dockerfile 更新建议

### 5.1 现状分析

- `package.json` 已包含 `echarts@^6.1.0` 和 `echarts-for-react@^3.0.6` ✅
- Sprint 2 可能需要新增 `fast-xml-parser` 用于前端 Nmap XML 解析
- `npm ci --only=production` 会安装所有依赖
- 构建阶段的工作流不变

### 5.2 结论

**frontend.Dockerfile 无需变更**。所有新依赖通过 `package.json` 管理，构建流程不变。

---

## 六、nginx.conf 完整更新版

```nginx
# ============================================================
# Nginx 反向代理配置 (Sprint 2 更新)
# SPA 路由兜底 + API 代理 + 文件上传支持
# ============================================================

server {
    listen 80;
    server_name _;

    # 🆕 Sprint 2: 文件上传大小限制
    client_max_body_size 10m;

    # 前端静态资源
    root /usr/share/nginx/html;
    index index.html;

    # gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    # SPA 路由兜底：所有非 API 路径返回 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理到后端
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;

        # 🆕 Sprint 2: 批量分析端点延长超时
        location /api/analyze/batch {
            proxy_pass http://backend:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 300s;
        }
    }

    # 健康检查端点
    location /health {
        access_log off;
        return 200 "OK";
    }
}
```

---

## 七、变更汇总

| 文件 | 变更内容 | 优先级 |
|------|---------|--------|
| `docker/nginx.conf` | 添加 `client_max_body_size 10m` + `proxy_read_timeout 300s` for batch | 🔴 P0 |
| `docker/.env.template` | 新增 5 个 Sprint 2 环境变量 | ⚠️ P1 |
| `docker/docker-compose.yml` | backend environment 新增 Sprint 2 变量 | ⚠️ P1 |
| `backend/requirements.txt` | 新增 `defusedxml`, `slowapi` | ⚠️ P1 |
| `docker/backend.Dockerfile` | 无需变更（除非使用 lxml） | 🟢 P2 |
| `docker/frontend.Dockerfile` | 无需变更 | 🟢 — |

---

## 八、待代码落地后验证

```
[ ] nginx.conf 中 client_max_body_size ≥ 10m
[ ] /api/analyze/batch 路由的 proxy_read_timeout ≥ 300s
[ ] docker-compose.yml 中 backend environment 包含所有 Sprint 2 新增变量
[ ] .env.template 更新并包含所有新变量注释
[ ] requirements.txt 包含 defusedxml, slowapi
[ ] 若使用 lxml，Dockerfile 有对应的系统库安装
[ ] Docker 构建成功，无缺失依赖
[ ] docker-compose up 后所有服务 health check 通过
[ ] 文件上传能通过 Nginx 到达后端（无 413 错误）
[ ] AI 批量分析不因超时中断（proxy_read_timeout 足够）
```

---

*报告结束 — robot01 DevOps Agent*
