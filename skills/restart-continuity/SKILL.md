---
name: restart-continuity
description: "网关重启（或任何会中断当前会话的操作）前保存恢复所需的最简上下文，重启后自动读取恢复。核心原则：极简、自动、不污染 MEMORY.md。"
allowed-tools: ["exec", "read", "write", "edit", "cron", "memory_get", "memory_search"]
user-invocable: false
---

# Restart Continuity

网关重启前，将最简上下文写入专用恢复文件；重启后新 session 自动检测并读取。

## 核心改动

| 问题 | 解决 |
|------|------|
| 写 MEMORY.md 再删，污染长期记忆 | 改用专用文件 `~/.openclaw/restart-recovery.md` |
| 6 个字段太啰嗦，懒得填 | 精简为 **3 个必填字段** + 1 个可选 |
| 重启后 agent 不知道要找恢复信息 | 新增「自动检测机制」 |
| 容易忘记调用 | 简化流程 + 强制检查清单 |

---

## 恢复文件格式

保存到 `~/.openclaw/restart-recovery.md`，内容极简：

```
**任务:** （一句话说明正在干什么）
**下一步:** （重启后要做什么）
**关键数据:** （环境变量、文件路径、token 等）
```

**可选（有就加，没有不写）：**
- **进程:** 正在跑的进程描述
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

**每次新 session 启动时，自动检查：**

```
[ -f ~/.openclaw/restart-recovery.md ] && cat ~/.openclaw/restart-recovery.md
```

如果存在：
1. 读取内容，获取恢复上下文
2. 向用户汇报：「检测到重启恢复文件，继续 XX 工作」
3. **删除恢复文件**（`rm ~/.openclaw/restart-recovery.md`）
4. 按恢复内容继续工作

如果不存在 → 正常启动，无事发生。

---

## 注意事项

- **只保存 3 个字段。** 进程 PID 重启后失效，不要记。环境变量路径比值更可靠。
- **恢复文件是临时状态，用完即删。** 不会残留、不会堆积、不会污染 MEMORY.md。
- **如果忘记写然后重启了 → 没救。** 这也是为什么流程强制要求「先写、再确认、再重启」。
- **如果一次连续多次重启，维护好文件状态即可。**
