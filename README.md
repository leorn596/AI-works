# AI-works — robot01

**robot01** 是一个运行在 CentOS Stream 9 上的 [OpenClaw](https://github.com/openclaw/openclaw) AI Agent 工作空间。

---

## 仓库用途

| 用途 | 说明 |
|------|------|
| **Agent 配置** | OpenClaw agent 的身份、行为、记忆配置（`SOUL.md`、`AGENTS.md`、`IDENTITY.md`、`MEMORY.md`） |
| **Skill 技能** | 可复用的技能模块，增强 agent 的能力边界 |
| **环境记录** | 系统配置、网络拓扑、密钥布局等基础设施备忘 |

## 技能模块

| Skill | 说明 |
|-------|------|
| `image-generator` | 图片生成，支持 `gpt-image-2` / `nano-banana-pro`，集成画廊展示 |

## 基础设施

- **Agent:** robot01 (model: deepseek/deepseek-v4-flash)
- **宿主:** CentOS Stream 9, 4 核 ~1.6G 内存
- **网关:** OpenClaw Gateway (loopback:18789, token auth)
- **频道:** WebChat / QQBOT
- **画廊:** Nginx 图片展示 (`/gallery`)

## 相关仓库

- [OpenClaw](https://github.com/openclaw/openclaw) — AI agent 框架
- [leorn596](https://github.com/leorn596) — 用户主页
