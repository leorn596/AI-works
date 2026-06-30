# 部署文档

> AI Web 安全漏洞分析平台 — 一站式部署指南

---

## 1. 环境要求

| 组件 | 最低版本 | 说明 |
|------|---------|------|
| Docker | 20.10+ | 需要支持 BuildKit 和 HEALTHCHECK |
| Docker Compose | v2 | `docker compose` 命令（非旧版 `docker-compose`） |
| 内存 | 4 GB+ | MySQL + Redis + Backend + Frontend 合计 |
| 磁盘 | 10 GB+ | 含 Docker 镜像和 MySQL 数据卷 |
| CPU | 2 核+ | 推荐 4 核以获得更好的 AI 分析体验 |
| 操作系统 | Linux / macOS / Windows (WSL2) | 推荐 Ubuntu 22.04+ 或 CentOS 9+ |

---

## 2. 配置项说明

所有配置通过 `docker/.env` 文件管理。从模板复制后修改：

```bash
cp docker/.env.template docker/.env
```

### 2.1 MySQL 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MYSQL_ROOT_PASSWORD` | `root123` | MySQL root 密码（**生产环境务必修改**） |
| `MYSQL_DATABASE` | `vuln_platform` | 数据库名 |
| `MYSQL_USER` | `vuln_user` | 应用连接用户名 |
| `MYSQL_PASSWORD` | `vuln_pass` | 应用连接密码（**生产环境务必修改**） |
| `MYSQL_PORT` | `3306` | 宿主机映射端口 |

### 2.2 Redis 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `REDIS_PASSWORD` | `redis123` | Redis 访问密码（**生产环境务必修改**） |
| `REDIS_PORT` | `6379` | 宿主机映射端口 |

### 2.3 AI API 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENAI_API_KEY` | **必填** | AI API Key（OpenAI 兼容接口） |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | API 端点，支持任意 OpenAI 兼容服务 |
| `OPENAI_MODEL` | `gpt-4o-mini` | 模型名称 |

> **提示：** 支持任何 OpenAI 兼容接口，如小米 MiMo、智谱 GLM、DeepSeek 等。只需修改 `OPENAI_BASE_URL` 和 `OPENAI_MODEL`。

### 2.4 应用配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CORS_ORIGINS` | `http://localhost:5173,...` | CORS 允许的源（逗号分隔） |
| `BACKEND_PORT` | `8000` | 后端 API 端口 |
| `FRONTEND_PORT` | `80` | 前端访问端口 |
| `ENVIRONMENT` | `production` | 运行环境标识 |
| `LOG_LEVEL` | `INFO` | 日志级别（DEBUG/INFO/WARNING/ERROR） |

---

## 3. 快速启动

### 3.1 克隆项目

```bash
git clone <repository-url> ai-vuln-platform
cd ai-vuln-platform
```

### 3.2 配置环境变量

```bash
cp docker/.env.template docker/.env
# 编辑 docker/.env，至少填写 OPENAI_API_KEY
vim docker/.env
```

### 3.3 启动所有服务

```bash
cd docker
docker compose up -d
```

首次启动会拉取镜像并构建，约需 3-5 分钟（取决于网络速度）。

### 3.4 查看服务状态

```bash
docker compose ps
```

预期输出（4 个服务均为 `Up` 或 `healthy`）：

```
NAME            STATUS          PORTS
vuln-mysql      Up (healthy)    0.0.0.0:3306->3306/tcp
vuln-redis      Up (healthy)    0.0.0.0:6379->6379/tcp
vuln-backend    Up (healthy)    0.0.0.0:8000->8000/tcp
vuln-frontend   Up (healthy)    0.0.0.0:80->80/tcp
```

### 3.5 验证服务

```bash
# 后端健康检查
curl http://localhost:8000/api/health
# 期望: {"code":200,"message":"ok","data":{"status":"healthy"}}

# 前端访问
curl -I http://localhost:80
# 期望: HTTP/1.1 200 OK

# API 代理验证（通过前端 Nginx 代理访问后端）
curl http://localhost/api/health
# 期望: 与直接访问后端一致
```

### 3.6 访问应用

- **前端界面：** http://localhost
- **Swagger API 文档：** http://localhost:8000/docs
- **ReDoc API 文档：** http://localhost:8000/redoc

---

## 4. 生产环境部署建议

### 4.1 安全加固

```bash
# 修改所有默认密码
MYSQL_ROOT_PASSWORD=<strong-random-password>
MYSQL_PASSWORD=<strong-random-password>
REDIS_PASSWORD=<strong-random-password>

# 限制 CORS 为实际域名
CORS_ORIGINS=https://your-domain.com

# 不暴露数据库端口到宿主机
# 在 docker-compose.yml 中删除 db 和 redis 的 ports 映射
```

### 4.2 使用外部数据库

对于生产环境，建议使用云数据库（如阿里云 RDS、腾讯云 CDB）：

```env
# 修改 docker-compose.yml 中 backend 的 DB_URL 指向外部数据库
DB_URL=mysql+asyncmy://user:password@your-rds-host:3306/vuln_platform
```

### 4.3 Nginx SSL 配置

在前端 Nginx 配置中添加 SSL：

```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    # ... 其余配置不变
}
```

---

## 5. 常见问题 (FAQ)

### Q1: 端口被占用

**现象：** `Error: Bind for 0.0.0.0:3306 failed: port is already allocated`

**解决：**

```bash
# 查看占用端口的进程
lsof -i :3306
# 或
ss -tlnp | grep 3306

# 方案 1: 停止占用进程
sudo systemctl stop mysql

# 方案 2: 修改 docker/.env 中的端口映射
MYSQL_PORT=3307
FRONTEND_PORT=8080
```

### Q2: 防火墙拦截

**现象：** 外部无法访问，但 localhost 正常

**解决：**

```bash
# CentOS / RHEL
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload

# Ubuntu
sudo ufw allow 80/tcp
sudo ufw allow 8000/tcp
```

### Q3: AI API Key 报错

**现象：** 分析返回 `503 AI 服务暂时不可用`

**排查步骤：**

```bash
# 1. 检查 API Key 是否配置
grep OPENAI_API_KEY docker/.env

# 2. 检查后端日志
docker compose logs backend | grep -i "api\|key\|error"

# 3. 测试 API 连通性
curl -H "Authorization: Bearer sk-your-key" \
     https://api.openai.com/v1/models

# 4. 检查后端容器内的环境变量
docker compose exec backend env | grep OPENAI
```

### Q4: MySQL 启动失败

**现象：** `vuln-mysql` 一直重启

**解决：**

```bash
# 查看日志
docker compose logs db

# 常见原因：数据卷损坏
docker compose down -v   # ⚠️ 会清除数据
docker compose up -d
```

### Q5: 构建镜像缓慢

**解决：**

```bash
# 使用国内镜像源（在 Dockerfile 或 daemon.json 中配置）
# /etc/docker/daemon.json
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"]
}
```

### Q6: 前端无法连接后端

**现象：** 页面显示但分析功能不可用

**排查：**

```bash
# 检查 Nginx 代理配置
docker compose exec frontend cat /etc/nginx/conf.d/default.conf

# 检查后端是否正常
curl http://localhost:8000/api/health

# 检查容器网络
docker network inspect vuln-network
```

---

## 6. 维护命令

```bash
# 查看日志
docker compose logs -f backend   # 实时查看后端日志
docker compose logs -f --tail=100  # 最近 100 行

# 重启单个服务
docker compose restart backend

# 更新并重建
docker compose pull
docker compose build --no-cache
docker compose up -d

# 停止所有服务
docker compose down

# 停止并清除数据卷（⚠️ 数据丢失）
docker compose down -v

# 备份数据库
docker compose exec db mysqldump -u root -p vuln_platform > backup.sql
```

---

## 7. 服务架构

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   浏览器     │────▶│   Frontend   │────▶│   Backend    │
│             │     │  (Nginx:80)  │     │ (FastAPI:8000)│
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                    ┌────────────┼────────────┐
                                    ▼            ▼            ▼
                              ┌──────────┐ ┌──────────┐ ┌──────────┐
                              │  MySQL   │ │  Redis   │ │  AI API  │
                              │  (3306)  │ │  (6379)  │ │ (外部)   │
                              └──────────┘ └──────────┘ └──────────┘
```
