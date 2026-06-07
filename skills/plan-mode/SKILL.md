---
name: plan-mode
description: "Guided plan-first task breakdown: present 2–4 options with pros/cons, D:Other fallback, chapter-per-section execution with permission gates."
metadata: { "openclaw": { "emoji": "📋" } }
---

# Plan Mode

Activated **only** when user explicitly says "enable plan mode", "plan mode", or equivalent. Provides a structured approach to break down ambiguous or multi-step tasks before executing.

## Activation

Plan Mode is activated only when the user explicitly says something like: "Enable plan mode", "Plan mode", "Let's go into plan mode", or similar clear declaration.

## Mode Behavior

Once activated, follow these rules:

### Option generation

1. Generate a list of **2–4 possible approaches** to achieve the user's goal.
   - For each option, state:
     - ✅ Advantages (pros)
     - ❌ Disadvantages (cons)
   - **Every list MUST include option D: "Other"** (a custom option where the user can request a fresh set of alternatives).

2. **Ask the user to choose** (A, B, C, D).
   - If A, B, or C → that becomes the chosen plan.
   - If **D: Other** → generate a **new list** (2–4 options, pros/cons, including D: Other again). New list must **not repeat** any previously shown option.

3. If selection is NOT in {A, B, C, D}, reply:
   > "请从以上选项中选择，或选择'D:其他'来获取更多类型。"
   (English: "Please select from the options above, or choose 'D: Other' for more alternatives.")

### D: Other repetition limit

- Maintain counter `other_choice_count`, start at 0.
- Each time user selects D: Other:
  - If `other_choice_count < 3`: increment, generate fresh list (no repeats).
  - If `other_choice_count >= 3`: do **not** generate new list. Ask exactly:
    > "请用一句话描述您要完成的目标，我将直接给出对应方案。"
    After user replies with one sentence, provide a **direct, concrete plan** (no A/B/C/D). Then proceed after user permission.
- Reset `other_choice_count` to 0 when Plan Mode ends or user says "reset plan mode".

### Plan structuring

- Break chosen plan into **chapters and subsections** (e.g., "Chapter 1: Gather data", "1.1 List files", "1.2 Check permissions").
- After completing **each chapter**:
  - State: "接下来需要完成的章节："
  - State: "下一章节："
  - List subsections: "下一章节包含的小节："
  - Then ask for permission to continue (or auto-continue if no objection).

### Final execution permission

- **Only after the entire plan is fully mapped out** (all chapters/subsections defined) **and the user gives explicit permission** (e.g., "Execute", "Go ahead", "Start") may execution begin.
- If permission not given, wait and do not take action.

### Plan termination

Plan Mode ends **only when**:
- The task goal is achieved, **or**
- The user explicitly says "Exit plan mode" or "Stop planning".

After the goal is reached, summarize the outcome and optionally ask if any follow-up is needed.
