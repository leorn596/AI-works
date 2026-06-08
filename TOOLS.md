# TOOLS.md — 本地笔记 & Skill 索引

Skills 定义工具用法。这里记的是你特有的东西：环境配置、常用参数、技能速查。

---

## 🔧 系统 & 环境

### SSH / OpenStack 集群

| 角色 | 主机名 | IP | SSH 方式 |
|------|--------|-----|---------|
| Controller | controller | 192.168.100.10 | `sshpass -p 'root' ssh root@192.168.100.10` |
| Compute | computer1 | 192.168.100.20 | `sshpass -p 'root' ssh root@192.168.100.20` |
| Block Storage | block1 | 192.168.100.30 | `sshpass -p 'root' ssh root@192.168.100.30` |

- **admin-openrc 路径:** `/root/admin-openrc` (controller)
- **RabbitMQ:** controller:5672, 用户 `openstack`, 密码 `rb123`
- **Neutron 命令:** `source /root/admin-openrc && openstack network agent list`

### Git

- **仓库:** `git@github.com:leorn596/AI-works.git`
- **SSH key:** `~/.ssh/id_ed25519`
- **工作区:** `/root/.openclaw/workspace` (main) / `/root/.openclaw/workspace/robot01` (robot01)
- **oc_user01 镜像:** `/home/oc_user01/workspace/`

### QQBOT

- **AppID:** 1904133740
- **Secret 位置:** `/home/oc_user01/.env`
- **环境变量:** `QQBOT_ID` / `QQBOT_SECRET`
- **skill:** qqbot-channel, qqbot-media, qqbot-remind

### Image Generator

- **路径:** `~/.openclaw/skills/image-generator/` | `~/.openclaw/workspace/robot01/skills/image-generator/`
- **API Key:** `IMAGE_GEN_API_KEY` (环境变量)
- **端点:** `https://grsai.dakka.com.cn/v1/chat/completions`

### 系统用户

- **oc_user01** (UID 1001) — 日常操作用户
- **Root 规则:** 普通命令 → `su - oc_user01 -c "..."`；提权直接执行

---

## 📋 所有 Skill 速查

### 文件 & 文档

| Skill | 用途 |
|-------|------|
| **docx** | 创建/编辑 Word (.docx) 文件，包含目录、页眉页脚、排版 |
| **xlsx** | 创建/编辑 Excel (.xlsx) 文件，公式、图表、数据清洗 |
| **nano-pdf** | 用自然语言指令编辑 PDF |
| **summarize** | 摘要/转写 URL、YouTube、播客、文章、PDF、本地文件 |

### 代码 & 开发

| Skill | 用途 |
|-------|------|
| **coding-agent** | 把编码任务委托给 Codex / Claude Code / OpenCode 后台运行 |
| **spike** | 快速原型验证，比较方案，出结论报告 |
| **skill-creator** | 创建/编辑/审计/整理技能 SKILL.md |
| **node-inspect-debugger** | Node.js 调试（inspect/CDP/堆快照/CPU profile） |
| **python-debugpy** | Python 调试（pdb/breakpoint/post-mortem/远程 attach） |
| **oracle** | 第二模型审查/重构/设计，选文件、干跑 token 检查 |

### 数据库 & 存储

| Skill | 用途 |
|-------|------|
| **notion** | Notion 页面操作、Markdown、数据源、搜索 |
| **obsidian** | Obsidian 库操作：读/搜/创建/编辑笔记、任务、链接 |
| **1password** | 1Password CLI 签名、集成、注入密钥 |
| **apple-notes** | macOS Apple Notes 操作（需 memo CLI） |
| **bear-notes** | Bear 笔记操作（需 grizzly CLI） |

### 消息 & 通信

| Skill | 用途 |
|-------|------|
| **discord** | Discord 消息操作（发/读/编/删/反应/投票/置顶/搜索） |
| **slack** | Slack 消息操作（发/读/编/删/反应/置顶） |
| **wacli** | 发 WhatsApp 消息或搜索历史 |
| **qqbot-channel** | QQ 频道管理（列表/成员/发帖/公告/日程） |
| **qqbot-media** | QQ 富媒体发送（图片/语音/视频/文件） |
| **qqbot-remind** | QQ 定时提醒管理 |
| **imsg** | iMessage/SMS CLI（需 macOS + Messages.app） |
| **himalaya** | IMAP/SMTP 邮件客户端（读/搜/写/回/转发） |
| **gog** | Google Workspace CLI（Gmail/Calendar/Drive/Contacts/Sheets/Docs） |

### 图片 & 媒体

| Skill | 用途 |
|-------|------|
| **image-generator** | 用 gpt-image-2 / nano-banana-pro 生成图片 |
| **image-reader** | 用户发图时用 Gemini 视觉模型分析 |
| **meme-maker** | 搜梗图模板、生成 meme |
| **video-frames** | 用 ffmpeg 从视频提取帧或片段 |
| **songsee** | 从音频生成频谱图 |
| **gifgrep** | 搜索 GIF、下载、提取静止帧 |
| **canvas** | 在连接的节点 canvas 上展示/导航 HTML |
| **diagram-maker** | 画 SVG/HTML/Excalidraw 图表（架构/流程/白板） |

### 智能家居 & 设备

| Skill | 用途 |
|-------|------|
| **camsnap** | 从 RTSP/ONVIF 摄像头捕获帧或片段 |
| **openhue** | 控制 Philips Hue 灯和场景 |
| **sonoscli** | 控制 Sonos 音箱（发现/状态/播放/音量/分组） |
| **blucli** | BluOS CLI 控制（发现/播放/分组/音量） |
| **eightctl** | 控制 Eight Sleep 床垫（状态/温度/闹钟/日程） |
| **spotify-player** | 终端 Spotify 播放/搜索 |
| **sag** | ElevenLabs TTS（macOS say 风格 UX） |
| **sherpa-onnx-tts** | 本地离线 TTS |
| **openai-whisper** | 本地语音转文字（不要 API key） |
| **openai-whisper-api** | OpenAI 语音转文字 API |

### 任务 & 工作流

| Skill | 用途 |
|-------|------|
| **taskflow** | 协调多步分离任务为一个持久 TaskFlow 作业 |
| **taskflow-inbox-triage** | 收件箱分类、意图路由、等待回复、汇总 |
| **plan-mode** | 先出计划方案（2-4选项+优劣），章节推进每步需授权 |
| **healthcheck** | 审计/加固 OpenClaw 主机（SSH/防火墙/更新/备份/加密） |
| **weather** | 用 wttr.in 查天气和预报 |
| **blogwatcher** | 监控博客/RSS 更新 |
| **session-logs** | 用 jq 搜索分析自己的会话日志 |

### GitHub & 项目管理

| Skill | 用途 |
|-------|------|
| **github** | GitHub CLI（issue/PR/CI/评论/Release/仓库操作） |
| **gh-issues** | 拉取 issue → 选候选项 → 派发后台修复 agent → 开 PR |
| **trello** | Trello 看板/列表/卡片管理 |
| **things-mac** | macOS Things 3 待办操作（需 things3-cli） |
| **apple-reminders** | macOS 提醒事项操作（需 remindctl） |
| **ordercli** | 查 Foodora 历史订单和当前状态 |

### 网络 & API

| Skill | 用途 |
|-------|------|
| **mcporter** | 列出/配置/调用/检查 MCP 服务器和工具 |
| **goplaces** | 查询 Google Places（文本搜索/地点详情/评论） |
| **node-connect** | 诊断 OpenClaw 节点配对失败 |
| **xurl** | X/Twitter 发帖/回复/搜索/DM/媒体上传 |
| **clawhub** | 搜索/安装/更新/同步/发布 AgentSkills |

---

## 🔄 restart-continuity 机制

### 原理
网关重启杀死当前会话。重启后自动继续之前的工作。

**前置条件（一次性）**
- `boot-md` hook 已启用
- 工作区根目录有 `BOOT.md`

**使用流程（每次重启前）**

```
# 1. 写恢复文件
write ~/.openclaw/restart-recovery.md
# 内容：
# **任务:** （一句话）
# **下一步:** （重启后要做什么）
# **关键数据:** （路径/token）

# 2. 确认
read ~/.openclaw/restart-recovery.md

# 3. 重启
openclaw gateway restart
```

**重启后自动发生**
1. `boot-md` hook 触发 → 读 `BOOT.md`
2. 检测 `~/.openclaw/restart-recovery.md`
3. 存在 → 按指示恢复 → 删文件
4. 不存在 → 无事发生

**注意**
- PID 不记，重启后失效
- 文件用完即删，不残留
- 连续重启：每次写新的覆盖即可

---

## 📌 这台机器的特殊配置

- **模型:** deepseek/deepseek-v4-flash (params: topP=0.2, temperature=0.2, frequencyPenalty=0.5)
- **网关端口:** 18789 (loopback-only, token 认证)
- **时区:** Asia/Shanghai
- **工作用户:** oc_user01
- **agent 身份:** robot01（工作区 /root/.openclaw/workspace/robot01）
- **密码:** 存在 User 文件
