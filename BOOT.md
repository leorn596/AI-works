# BOOT.md — Gateway 启动任务

检测是否存在 `~/.openclaw/restart-recovery.md`，存在则读取并执行恢复。

1. 检查文件 `~/.openclaw/restart-recovery.md` 是否存在
2. 如果存在，读取其内容并按照指示执行（继续之前中断的任务）
3. 执行完毕后删除 `~/.openclaw/restart-recovery.md`
4. 如果不存在，正常启动，无事发生

**注意：** 如果恢复任务需要发送消息，发送完毕后请回复 `NO_REPLY` 避免重复输出。
