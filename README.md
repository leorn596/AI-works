# AI-works

robot01 · OpenClaw agent workspace

包含 agent 配置、技能集合和辅助工具。

## 结构

```
AGENTS.md      — agent 行为准则
SOUL.md        — 性格与风格定义
MEMORY.md      — 长期记忆
TOOLS.md       — 环境配置与技能索引
USER.md        — 用户信息
skills/        — 可用技能集合
  browser-automation/
  dual-agent-flow/
  image-generator/
  image-reader/
  plan-mode/
  realtime-search/
  restart-continuity/
```

## 技能

技能按需加载，定义在 `skills/` 目录下。每个技能包含独立的 `SKILL.md` 描述文件及实现脚本。

## 项目

此仓库为 agent 工作区主仓库。完整项目源码（如 ai-vuln-platform）位于 `project/` 分支下。

## 许可

MIT
