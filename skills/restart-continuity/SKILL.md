---
name: restart-continuity
description: "网关重启前保存恢复上下文，重启后通过 boot-md hook 自动检测并恢复。核心原则：极简、自动、不污染 MEMORY.md。"
allowed-tools: ["exec", "read", "write", "edit", "cron", "memory_get", "memory_search"]
user-invocable: false
---

# Restart Continuity

网关重启会导致当前会话中断。本 skill 通过两个机制实现重启恢复：

1. **`boot-md` hook** — 网关启动时自动读取 `BOOT.md`，检测恢复文件
2. **`restart-recovery.md`** — 重启前写下的恢复上下文，重启后被自动读取执行

## 前置条件（一次性设置）

确保以下两项已完成：

### 1. 启用 `boot-md` hook

```bash
openclaw hooks enable boot-md
```

### 2. 创建 `BOOT.md`

在工作区根目录（`<workspace>/BOOT.md`）创建以下内容：

```markdown
# BOOT.md — Gateway 启动任务

检测是否存在 `~/.openclaw/restart-recovery.md`，存在则读取并执行恢复。

1. 检查文件 `~/.openclaw/restart-recovery.md` 是否存在
2. 如果存在，读取其内容并按照指示执行（继续之前中断的任务）
3. 执行完毕后删除 `~/.openclaw/restart-recovery.md`
4. 如果不存在，正常启动，无事发生

**注意：** 如果恢复任务需要发送消息，发送完毕后请回复 `NO_REPLY` 避免重复输出。
```

---

## 恢复文件格式

保存到 `~/.openclaw/restart-recovery.md`，内容极简：

```
**任务:** （一句话说明正在干什么）
**下一步:** （重启后要做什么）
**关键数据:** （环境变量、文件路径、token 等）
```

**可选（有就加，没有不写）：**
- **进程:** 正在跑的进程描述（PID 不用记，重启后失效）
- **备忘:** 任何需要记住的上下文

### 示例

```
**任务:** QQBOT 渠道配置已完成，重启网关使其生效
**下一步:** openclaw gateway status 确认运行，然后问用户要不要测试
**关键数据:** AppID=1904133740, Secret 在 /home/oc_user01/.env
```

---

## Pre-Restart — 保存流程

**在 `openclaw gateway restart` 之前，必须执行：**

1. 写恢复文件

   ```
   write ~/.openclaw/restart-recovery.md  (任务/下一步/关键数据)
   ```

   不要用 edit、不要追加，直接用 write 覆盖。

2. 确认已写入

   ```
   read ~/.openclaw/restart-recovery.md
   ```

3. 然后才能执行 `openclaw gateway restart`

---

## Post-Restart — 自动恢复

重启后，`boot-md` hook 自动触发：
1. `gateway:startup` 事件 → `boot-md` hook 读取 `BOOT.md`
2. `BOOT.md` 内容注入为启动指令
3. Agent 检测 `~/.openclaw/restart-recovery.md`
4. 如果存在 → 读取执行 → 删除文件 → 继续任务
5. 如果不存在 → 无事发生

---

## 注意事项

- **只保存 3 个字段。** 进程 PID 重启后失效，不要记。环境变量路径比值更可靠。
- **恢复文件是临时状态，用完即删。** 不会残留、不会堆积、不会污染 MEMORY.md。
- **如果忘记写然后重启了 → 没救。** 这也是为什么流程强制要求「先写、再确认、再重启」。
- **连接不中断的本地重启不会丢失上下文。** 仅 WebChat/TUI/远程连接在重启后会新建会话，需要此恢复机制。
