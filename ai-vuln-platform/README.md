# AI Web 安全漏洞分析平台

> 基于 AI 的 Web 安全漏洞智能分析平台 — 支持手动描述、文件上传（ZAP/Nmap）、多源交叉验证

---

## ✨ 核心功能

- 🧠 **AI 智能分析** — 输入漏洞描述，AI 自动分析并返回结构化报告
- 📁 **文件批量分析** — 上传 ZAP JSON 或 Nmap XML 报告，批量 AI 深度分析
- 🔀 **多源交叉验证** — 同时导入 ZAP + Nmap 结果，AI 交叉对比发现盲区
- 📊 **可视化仪表盘** — 饼图/柱状图/雷达图/趋势图，支持点击联动筛选
- 🛡️ **加固清单** — AI 自动生成按优先级排序的安全加固清单
- 📄 **PDF 报告导出** — 一键生成完整/摘要两种格式的 PDF 报告
- 📜 **历史记录** — 分析结果持久化存储，支持筛选、分页、回看

---

## 🏗️ 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                         用户浏览器                                │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTP
┌────────────────────────────▼─────────────────────────────────────┐
│  Frontend (React 19 + Ant Design 6 + ECharts 6 + Tailwind 4)    │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│  │ InputSection │ │  ChartArea   │ │  VulnList    │ │ History  │ │
│  └──────┬──────┘ └──────┬───────┘ └──────┬───────┘ └────┬─────┘ │
│         │    Event Bus   │               │              │       │
│         └────────────────┴───────────────┴──────────────┘       │
│                              Nginx 反向代理                       │
└────────────────────────────┬─────────────────────────────────────┘
                             │ /api/*
┌────────────────────────────▼─────────────────────────────────────┐
│  Backend (FastAPI + SQLAlchemy + asyncmy)                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │  AI Service  │ │  CVSS Calc   │ │  PDF Export  │             │
│  └──────┬───────┘ └──────────────┘ └──────────────┘             │
│         │                                                        │
│  ┌──────▼───────┐ ┌──────────────┐                               │
│  │  MySQL 8.0   │ │  Redis 6.x   │                               │
│  │  (持久化存储) │ │  (缓存加速)   │                               │
│  └──────────────┘ └──────────────┘                               │
│         │                                                        │
│         └──── OpenAI 兼容 API ────▶ 外部 AI 服务                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始

```bash
# 1. 克隆项目并配置
git clone <repository-url> ai-vuln-platform && cd ai-vuln-platform
cp docker/.env.template docker/.env
# 编辑 docker/.env，填写 OPENAI_API_KEY

# 2. 一键启动
cd docker && docker compose up -d

# 3. 访问
# 前端: http://localhost
# API 文档: http://localhost:8000/docs
```

---

## 🛠️ 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **前端框架** | React | 19 |
| **UI 组件库** | Ant Design | 6 |
| **图表库** | ECharts | 6 |
| **CSS 框架** | Tailwind CSS | 4 |
| **构建工具** | Vite | 8 |
| **状态管理** | Redux Toolkit | 2 |
| **后端框架** | FastAPI | 0.110+ |
| **ORM** | SQLAlchemy (async) | 2.0+ |
| **数据库** | MySQL | 8.0 |
| **缓存** | Redis | 6.x |
| **PDF 生成** | xhtml2pdf | 0.2.15 |
| **容器化** | Docker + Docker Compose | 20.10+ / v2 |
| **反向代理** | Nginx | 1.25 |
| **AI 接口** | OpenAI 兼容 API | — |

---

## 📸 功能截图

> 以下为功能截图占位，实际部署后替换为真实截图

### 主仪表盘

![主仪表盘](screenshots/dashboard-main.png)

### 漏洞输入（三种模式）

![手动描述输入](screenshots/input-manual.png)
![文件上传](screenshots/input-file.png)
![多源交叉对比](screenshots/input-multi-source.png)

### 分析结果与图表

![分析结果](screenshots/analysis-results.png)
![图表联动](screenshots/chart-filter.png)

### AI 深度分析

![AI 详细分析](screenshots/ai-detail.png)
![加固清单](screenshots/remediation-checklist.png)

### 历史记录

![历史记录](screenshots/history-list.png)

### PDF 报告导出

![PDF 报告](screenshots/pdf-preview.png)

---

## 📚 文档

| 文档 | 路径 |
|------|------|
| 部署文档 | [docs/deployment.md](docs/deployment.md) |
| 用户手册 | [docs/user-guide.md](docs/user-guide.md) |
| API 文档 (Swagger UI) | http://localhost:8000/docs |
| API 文档 (ReDoc) | http://localhost:8000/redoc |
| Sprint 测试报告 | [docs/sprint*-test-cases.md](docs/) |
| Sprint 验收报告 | [docs/sprint*-acceptance-report.md](docs/) |

---

## 📁 项目结构

```
ai-vuln-platform/
├── backend/                    # FastAPI 后端
│   ├── app/
│   │   ├── api/                # API 路由和 Schema
│   │   │   ├── routes.py       # 所有 API 端点
│   │   │   └── schemas.py      # Pydantic 数据模型
│   │   ├── core/               # 核心配置
│   │   │   ├── config.py       # 应用配置
│   │   │   ├── database.py     # 数据库连接
│   │   │   └── redis.py        # Redis 缓存
│   │   ├── models/             # ORM 模型
│   │   │   └── models.py       # SQLAlchemy 模型
│   │   ├── services/           # 业务逻辑
│   │   │   ├── ai_service.py   # AI 分析服务
│   │   │   ├── cvss_service.py # CVSS 计算
│   │   │   ├── multi_source_service.py  # 多源对比
│   │   │   └── pdf_service.py  # PDF 生成
│   │   └── main.py             # FastAPI 入口
│   └── requirements.txt
├── frontend/                   # React 前端
│   ├── src/
│   │   ├── components/         # UI 组件
│   │   │   ├── charts/         # 图表组件 (Pie/Bar/Radar/Trend)
│   │   │   ├── InputSection.jsx
│   │   │   ├── VulnerabilityList.jsx
│   │   │   ├── HistoryPanel.jsx
│   │   │   └── ExportActions.jsx
│   │   ├── pages/              # 页面
│   │   │   ├── Dashboard.jsx
│   │   │   └── History.jsx
│   │   ├── store/              # Redux 状态管理
│   │   └── utils/              # 工具函数
│   │       ├── apiClient.js    # API 客户端
│   │       ├── eventBus.js     # 事件总线
│   │       └── fileParser.js   # 文件解析
│   └── package.json
├── database/
│   └── init.sql                # 数据库初始化脚本
├── docker/
│   ├── docker-compose.yml      # Docker Compose 编排
│   ├── backend.Dockerfile      # 后端镜像
│   ├── frontend.Dockerfile     # 前端镜像
│   ├── nginx.conf              # Nginx 配置
│   └── .env.template           # 环境变量模板
├── docs/                       # 项目文档
└── README.md                   # 本文件
```

---

## 🔌 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/analyze/manual` | 手动漏洞分析 |
| POST | `/api/analyze/batch` | 批量文件分析 |
| POST | `/api/analyze/multi-source` | 多源交叉验证 |
| GET | `/api/history` | 历史记录列表 |
| GET | `/api/history/{task_id}` | 历史记录详情 |
| GET | `/api/report/{task_id}/pdf` | PDF 报告生成 |

完整的 API 文档请访问：http://localhost:8000/docs

---

## 📝 许可证

MIT License

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。

---

## 🙏 致谢

- [FastAPI](https://fastapi.tiangolo.com/) — 高性能 Python Web 框架
- [React](https://react.dev/) — 用户界面库
- [Ant Design](https://ant.design/) — 企业级 UI 组件库
- [ECharts](https://echarts.apache.org/) — 数据可视化库
- [Tailwind CSS](https://tailwindcss.com/) — 实用优先的 CSS 框架
