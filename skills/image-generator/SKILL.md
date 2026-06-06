---
name: image-generator
description: "Generate images via gpt-image-2 (priority) / nano-banana-pro (text-heavy scenarios). Auto-infers size/style/count from document context; respects explicit user overrides."
---

# Image Generator

Trigger: user asks to generate/create/draw an image, or document creation with emphasis on illustrations/figures.

## Setup

Set environment variable `IMAGE_GEN_API_KEY` with your API key:

```bash
# Option A: systemd service (recommended for OpenClaw gateway)
systemctl --user edit openclaw-gateway.service
# Add under [Service]:
# Environment=IMAGE_GEN_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
systemctl --user daemon-reload
systemctl --user restart openclaw-gateway.service

# Option B: bashrc
echo 'export IMAGE_GEN_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"' >> ~/.bashrc
source ~/.bashrc
```

## API

| Field | Value |
|-------|-------|
| Endpoint | `https://grsai.dakka.com.cn/v1/chat/completions` |
| Model (优先) | `gpt-image-2` |
| Model (备用) | `nano-banana-pro` |
| Method | OpenAI-compatible chat completions |
| Auth | Bearer token (`$IMAGE_GEN_API_KEY`) |
| Response | Markdown image URL `![image](url)` |

## Model Selection

Judge whether the image **may contain text** (signs, labels, UI screenshots, documents, posters with words, etc.):

| 含有文字的场景 | 使用模型 |
|---|---|
| 招牌 / 广告牌 / 海报 / PDF截图 / UI界面 / 含文字的Logo | `nano-banana-pro` |
| 需要清晰中文/英文文字渲染 | `nano-banana-pro` |
| 纯风景 / 产品图 / 抽象艺术 / 无文字要求的配图 | `gpt-image-2` (质量更高) |

## Size/Style/Number Inference Rules

When user **does not** specify these, infer from document context:

### Size

| Document context | Infer |
|---|---|
| Cover / hero image | 1024×768, wide landscape |
| Body illustration / flowchart / screenshot | 768×512, clear but compact |
| Avatar / icon / thumbnail | 512×512, square |
| Banner / poster / README hero | 1024×1024, large square |
| Decorative separator / spacer | 256×64, slim strip |
| Diagram / architecture chart | 1024×768, needs horizontal space |

### Style

| Document type | Infer |
|---|---|
| Technical doc / tutorial | realistic / diagram — clarity first |
| Product intro / PR | clean commercial / white-background |
| Blog / creative writing | digital art / watercolor / anime |
| Research report / paper | infographic / data visualization |
| Social media post | casual illustration / meme-friendly |

### Count (n)

| Scenario | Infer |
|---|---|
| Title / header illustration | 1 |
| Multi-section / per-paragraph images | 1 per section, batch in parallel |
| User says "add some decoration" | 2-3, pick best |
| User says "generate variants" | 2-4, show all |

When user **does specify** any of these — use exactly what they said.

## Workflow

1. **Parse request** — extract explicit user specs (size, style, n) if any; otherwise infer from context above.

2. **Build prompt** — concise description that embeds size, style, and content in natural language.

   ```
   (size hint) (style hint). Content description. (usage hint).
   ```

3. **Select model & Call API** — 根据 Model Selection 规则判断：

   - **图片含文字** → `MODEL="nano-banana-pro"`
   - **纯图片** → `MODEL="gpt-image-2"`

   ```bash
   # 直接 curl 调用
   MODEL="gpt-image-2"  # 或 nano-banana-pro（含文字时）
   curl -s "https://grsai.dakka.com.cn/v1/chat/completions" \
     -H "Authorization: Bearer $IMAGE_GEN_API_KEY" \
     -H "Content-Type: application/json" \
     -d "$(jq -n --arg prompt 'your prompt here' --arg model "$MODEL" '{
       model: $model,
       messages: [
         {role: "system", content: "You are an AI that generates images. Respond with ONLY a markdown image link: ![image](url). No other text."},
         {role: "user", content: $prompt}
       ],
       stream: false
     }')"
   ```

   或用集成脚本（可指定模型）:
   ```bash
   # 含文字时
   LOCAL_URL=$(~/.openclaw/skills/image-generator/scripts/generate-and-save.sh "prompt" "nano-banana-pro")
   
   # 纯图片时
   LOCAL_URL=$(~/.openclaw/skills/image-generator/scripts/generate-and-save.sh "prompt" "gpt-image-2")
   ```

4. **Extract URL** — parse markdown image link from response. `gpt-image-2` 会返回进度条（1% → 100%），提取末尾的 `![image](url)` 即可。

5. **Save & Present** — 用 `MEDIA:<LOCAL_URL>` 输出到聊天。图片在 `http://<host>:8080/gallery/` 也能看到。

   For n > 1, loop the script and output each MEDIA line separately.

## Generate Multiple (n > 1)

For n > 1, call API multiple times with the same prompt (model handles diversity), or adjust prompt with "第一张: ..., 第二张: ..." for variety.

## Script Reference

```
scripts/api.sh                # 公共层：curl + 解析 + 中文错误提示
scripts/generate.sh           # prompt → URL
scripts/generate-and-save.sh  # 生成 + 下载 + 注册画廊，支持多张
```

### generate-and-save.sh

```bash
# 1 张纯图
~/.openclaw/skills/image-generator/scripts/generate-and-save.sh "山间湖泊" "gpt-image-2"

# 1 张含文字图
~/.openclaw/skills/image-generator/scripts/generate-and-save.sh "香港招牌" "nano-banana-pro"

# 3 张批量生成
~/.openclaw/skills/image-generator/scripts/generate-and-save.sh "橘猫" "gpt-image-2" 3
```

## Error Handling

- `IMAGE_GEN_API_KEY not set` → 启动报错，指引用户设环境变量
- API 错误 → 中文提示（余额不足 / 认证失败 / 限流 / 超时），不需要 agent 二次翻译
- 图片为空 → 更详细的 prompt 重试
