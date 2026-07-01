# AI 漏洞分析平台 — 后端

基于 FastAPI + SQLAlchemy(async) 的漏洞智能分析服务。

## 项目结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 入口
│   ├── core/
│   │   ├── config.py        # 配置（Settings）
│   │   └── database.py      # 异步数据库引擎 & Session
│   ├── models/
│   │   └── models.py        # SQLAlchemy ORM 模型
│   ├── api/
│   │   ├── routes.py        # API 路由
│   │   └── schemas.py       # Pydantic 请求/响应 Schema
│   └── services/
│       └── ai_service.py    # AI 分析服务
├── requirements.txt         # Python 依赖
├── .env.example             # 环境变量模板
└── README.md
```

## 快速启动

```bash
# 1. 创建虚拟环境
python3 -m venv .venv && source .venv/bin/activate

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入实际的 API Key 和数据库连接

# 4. 初始化数据库
mysql -u root -p < ../database/init.sql

# 5. 启动服务
cd backend/
python -m app.main
# 或
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后访问 http://localhost:8000/docs 查看 Swagger 文档。

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/health` | 健康检查 |
| POST | `/api/analyze/manual` | 手动提交漏洞描述进行 AI 分析 |
