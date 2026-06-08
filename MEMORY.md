# MEMORY.md — robot01 长期记忆

*始于 2026-06-05*

---

## 🧬 Identity

- **Agent ID:** `robot01`
- **模型偏好:** deepseek/deepseek-v4-flash (params: topP=0.2, temperature=0.2, frequencyPenalty=0.5)
- **性格:** 直接、务实、乐于动手。不喜欢废话,有问题先查再问。
- 环境配置见 `TOOLS.md`，技能索引在 `TOOLS.md` 的 `📋 所有 Skill 速查`

---

## 👤 用户

- **时区:** Asia/Shanghai (UTC+8)
- **语言:** 中文 (简体)
- **操作系统:** CentOS Stream 9 / Linux 5.14.0-611.x
- **机器名:** leorn (4核, ~1.6G 内存)
- **Root 规则:** 普通命令 → `su - oc_user01 -c "..."`；需要提权时直接执行。oc_user01 详细信息见 `TOOLS.md`

---

## 📅 重要事件

### 2026-06-05 — 首日上线
- 全新 OpenClaw workspace bootstrap
- 创建系统用户 `oc_user01` (UID 1001)
- 绑定 Git 仓库 `leorn596/AI-works`
- 首版推送: 9 files, 446 insertions
- **系统状态记录:** 发生过 RCU stall (CPU 饥饿)和 hung task,可能与 dnf 卡死有关；firewalld Docker 策略冲突警告存在,但未修复

### 2026-06-07 — QQBOT 配置
- `QQBOT_ID=1904133740`，Secret 写入 `/home/oc_user01/.bashrc` 和 `.env`
- `@openclaw/qqbot` 插件已安装 (v2026.5.28)
- QQBOT 渠道已添加并启用
- 网关已重启生效
- **教训:** 重启网关前必须写 `~/.openclaw/restart-recovery.md`（流程见 TOOLS.md）

### 2026-06-08 — 重启恢复机制修复
- 启用 `boot-md` hook + 创建 `BOOT.md`，实现重启后自动检测恢复文件
- 更新 `restart-continuity` skill
- 测试验证通过：重启后 recovery 文件被自动删除

---

## 🧠 核心教训

1. **记忆文件要主动写。** AGENTS.md 强调 "Text > Brain" — 重要的决定、教训、上下文要写进文件,不然下次 session 就丢了。
2. **改系统配置前先看现状。** AGENTS.md 的 Red Lines: inspect before changing.
3. **用户偏好中文交流。** 回复用简洁中文化,避免浮夸的开场白。
4. **重启网关前必须先写恢复文件。** 否则当前会话的所有上下文会丢失。
