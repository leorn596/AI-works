---
name: "realtime-search"
description: "Delegate real-time/web-search tasks to MiMo V2.5 via spawned sub-agent for up-to-date results."
---

# Realtime Search via MiMo V2.5

Trigger when the user's request requires **current, real-time, or web-sourced information** (e.g., weather, news, prices, live data, recent events).

The default model (deepseek-v4-flash) may not have the best tool-calling reliability for web search. Delegate to MiMo V2.5 which has stronger agentic capabilities.

## Workflow

### 1. Detect

Check if the task needs:
- Current time-sensitive info (weather, news, stock prices)
- Web-only content (recent releases, docs updates)
- Live data (sports scores, flight status)

If yes → proceed to delegate.

### 2. Spawn sub-agent with MiMo V2.5

```python
# Pseudocode pattern — use sessions_spawn with model override
sessions_spawn(
  model="xiaomi/mimo-v2.5",
  task="<clear search objective>",
  taskName="realtime-search-<brief-topic>",
  mode="run"
)
```

Key rules:
- Set `context="isolated"` (omit context param or use default)
- Give a clear, specific search task — include the exact query
- Do NOT include conversation history unless needed for context
- Task name should be descriptive (e.g., `realtime-search-weather-shanghai`)

### 3. Wait and collect

Use `sessions_yield()` to wait for the sub-agent to complete. The result will arrive as a completion event.

### 4. Process and respond

- Summarize the search results concisely
- Cite the source/tool used
- Present in the user's preferred format

### 5. When NOT to use

- User asks about concepts, code, or knowledge the base model already knows
- User explicitly says "don't search" or "no need to look up"
- Simple deterministic answers

## Example

```
User: "今天上海天气怎么样？"

→ Detect: needs real-time weather data
→ Spawn sub-agent with mimo-v2.5: "搜索今天上海的天气，包括温度、降水概率、风力等信息"
→ Yield & wait
→ Reply with formatted weather report
```
