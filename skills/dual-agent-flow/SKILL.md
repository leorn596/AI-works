---
name: dual-agent-flow
description: "三 Agent 异步协作：WorkAgent 生产 + MiddleAgent 仲裁 + AcceptAgent 验收，分支修复、队列背压、进度限流。"
metadata: { "openclaw": { "emoji": "🔀" } }
---

# Dual Agent Flow

三 Agent 异步协作工作流。由 Plan Mode 生成章节计划后，启动 WorkAgent + MiddleAgent + AcceptAgent 三路并行。

## 前置提醒

启用 Dual Agent Flow 前必须告知用户：

> **Token 用量会显著增加**（多 Agent 并行 + 反复验证），确认继续后再启动。

不建议用于单一文件/简单命令级别的任务。小任务直接用单 agent 完成。

## 依赖

- Plan Mode skill：生成章节计划
- `sessions_spawn` / `sessions_send`：Agent 间异步通信
- 工作产物存储在 workspace 内

## 持久化

### 计划本地化

- Plan Mode 输出的计划必须保存为 workspace 内 `.md` 文件
- 路径：`plan-{YYYYMMDD-HHMMSS}/{chapters}/`
- 所有 Agent 通过读取该文件获取计划

### 快照

- 每 **5 个小节** 生成一次进度快照
- 内容：当前章节、已完成小节、分支状态、队列状态
- 保存至：`snapshots/snapshot-{timestamp}.json`
- 用于主 session 崩溃后恢复现场

### 版本淘汰

- 同一章节的最新产出自动覆盖队列中旧版本
- AcceptAgent 只处理每个章节的最新版

## 三 Agent 架构

```
WorkAgent  ──→  MiddleAgent  ──→  AcceptAgent
    ↑                │                    │
    │                ├── 预判连锁影响       │
    │                │    提前通知双方      │
    │                ├── 预审总结问题点      │
    │                │    附在产出上推送     │
    │                └── 复核验收结论 ═══════╝
    │                      误判可申诉
    └────────────────────────────────────────
                 队列满/进度控制
```

## 角色定义

### WorkAgent（主产线）

按章节顺序执行工作，产出结果文件/配置/代码。

**行为规则：**

1. **主干工作**：
   - 完成一小节后，将产出路径告知 MiddleAgent
   - 不等结果，继续下一节

2. **进度限制**：
   - WorkAgent 的工作进度 **最多领先 AcceptAgent 已验收完成进度的 4 个小节**
   - 超出范围 → 停止工作，等待验收消费
   - 例：AcceptAgent 已验证到 Chapter 2.3，WorkAgent 最大能工作到 Chapter 2.7

3. **收到报错时**：
   - 暂停当前主干工作
   - **保留主干所有产出不变**
   - 拉出修复分支（记录分支来源）

4. **分支操作**：
   - 在 workspace 内创建分支目录：`branches/fix-chapterX-{timestamp}/`
   - 从主干对应目录复制文件到分支目录
   - 在分支目录中修复
   - 完成当前小节后通知 MiddleAgent（附上分支路径）
   - **不等待验证结果**，进入下一小节
   - 收到验证不通过 → 暂停 → 修 → 再推 → 继续
   - 重试上限：**3 次**
   - 超限 → 等待用户决定

5. **分支合并**：
   - 分支内所有小节 ✅ 通过后
   - 分支目录文件 **覆盖** 主干对应目录文件
   - 合并后通知 MiddleAgent 更新状态

6. **依赖等待**：
   - 推进下一小节前检查依赖
   - **无依赖** → 不等
   - **有依赖且前置已验证** → 直接推进
   - **有依赖且前置在验证** → 停止等待

7. **背压**：
   - 队列满时先写"错误总结"（存 workspace）
   - 仍满 → 暂停

### MiddleAgent（预审 & 仲裁）

职责：连接 Work 和 Accept，做预审、影响分析和结论复核。

**行为规则：**

1. **预审总结**：
   - 从 WorkAgent 接收产出通知后，**先审阅产出**
   - 总结可能出现问题的位置，**附加在产出上**一起推给 AcceptAgent
   - 形式：一段文本说明，如"该配置涉及网络和存储层，重点检查连接字符串和权限"

2. **连锁影响预判**：
   - 每次产出投递前，判断该章节的成功/失败 **可能对后续章节产生什么影响**
   - 提前通知 WorkAgent 和 AcceptAgent：
     - `[MiddleAgent 预判] Chapter X 如果失败，可能影响 Y、Z 章节，建议提前准备`
   - WorkAgent 收到后可调整工作策略
   - AcceptAgent 收到后可针对性加强相关章节的验收重点

3. **复核验收结论**：
   - AcceptAgent 返回 ❌ 后，MiddleAgent **复核结论合理性**
   - 如果判定为 **误判** → 通知 AcceptAgent 重新验证，附加说明
   - 如果判定为 **正确报错** → 原样转给 WorkAgent
   - 误判申诉通道：WorkAgent 也可直接向 MiddleAgent 提出异议

4. **版本管理**：
   - 维护每个章节的最新版本号
   - 确保 AcceptAgent 只接收最新版本

5. **状态同步**：
   - 维护快照
   - 记录进度：WorkAgent 当前章节、AcceptAgent 验证进度、队列长度

### AcceptAgent（验收线）

职责：接收产出，自行推理验证。

**行为规则：**

1. **队列接收**：
   - FIFO 队列，容量上限 **5 个产出**
   - 接收时附带 MiddleAgent 的预审总结
   - 只处理每个章节的最新版本

2. **验收方式**：
   - **无预设 checklist**，自行推理
   - 利用 MiddleAgent 预审总结辅助定位问题
   - 输出：✅ 通过 / ❌ 不通过 + 原因

3. **不阻塞**：
   - 验完 push 结果回 MiddleAgent（不是直接给 WorkAgent）
   - 继续验下一份，不等修复

4. **队列满**：
   - 通知 MiddleAgent → MiddleAgent 通知 WorkAgent 处理背压

5. **接到复核通知**：
   - 如果 MiddleAgent 判定误判 → 重新验证，修正结论

## 通信架构

### 消息流向

```
WorkAgent → MiddleAgent → AcceptAgent
              ↕
         预判/复核/状态同步
```

### 消息格式

```json
{
  "type": "work_output | middle_prescreen | middle_impact | accept_verdict | middle_review | queue_status",
  "from": "work_agent | middle_agent | accept_agent",
  "chapter": "chapter_X",
  "branch_id": "branch_YYYYMMDD_HHMMSS_xxx",
  "version": 1,
  "payload": {},
  "depends_on": ["chapter_X-1"],
  "timestamp": "2026-06-16T18:00:00+08:00"
}
```

### 消息类型明细

| 消息 | 方向 | 触发 |
|------|------|------|
| `work_output` | Work → Middle | 小节完成 |
| `middle_prescreen` | Middle → Accept | 预审总结后，附带产出 |
| `middle_impact` | Middle → Work & Accept | 连锁影响预判 |
| `accept_verdict` | Accept → Middle | 验证完成 |
| `middle_review` | Middle → Accept | 复核后要求重验 |
| `middle_review` | Middle → Work | 确认报错，转交 |
| `queue_status` | Middle → Work | 队列满 |

## 分支管理

### 目录结构

```
workspace/
├── plan-20260616/
│   ├── chapter_1.md
│   ├── chapter_2.md
│   └── plan_complete.md
├── main/
│   ├── chapter_1/
│   ├── chapter_2/
│   └── .../
├── branches/
│   └── fix-chapter_2-20260616-180500/
│       ├── chapter_2/
│       └── .../
├── snapshots/
│   └── snapshot-20260616-180000.json
└── errors/
    └── error_summary.md
```

### 合并方式

- 分支文件 → **覆盖** → 主干文件
- 合并后删除分支目录

## 进度控制

### 超前限制

- WorkAgent 进度 ≤ AcceptAgent 已验收进度 + **4 小节**
- 超出 → WorkAgent 停工，等验收消费

### 结束条件（严格）

- 所有章节完成 ✅
- AcceptAgent 队列清空 ✅
- 所有验证结果 ✅ ✅
- 缺一不可

## 模型配置

| 角色 | 模型 | API | 端点 |
|------|------|-----|------|
| **PlanMode**（执行模型） | `deepseek-v4-pro` | 默认 API | 默认 |
| **WorkAgent** | `gemini-3.1-flash-lite` | `$IMAGE_GEN_API_KEY` | `https://grsai.dakka.com.cn/v1/chat/completions` |
| **MiddleAgent** | `gpt-5.4` | `$IMAGE_GEN_API_KEY` | `https://grsai.dakka.com.cn/v1/chat/completions` |
| **AcceptAgent** | `deepseek-v4-pro` | 默认 API | 默认 |

### 配置说明

- WorkAgent 和 MiddleAgent 共用 IMAGE_GEN_API_KEY（环境变量），走第三方 API 端点
- PlanMode 和 AcceptAgent 走默认 Gateway 模型配置
- `IMAGE_GEN_API_KEY` 已在系统中配置，无需手动设置

## 与 Plan Mode 衔接

1. Plan Mode 输出落地为 `plan-{timestamp}/` 下 `.md` 文件
2. 启动 Dual Agent Flow 前，警告用户 Token 用量
3. 简易任务 → 跳过此流程，走普通 agent 执行
4. 计划变更多 Agent 处理范围 → 更新计划文件
