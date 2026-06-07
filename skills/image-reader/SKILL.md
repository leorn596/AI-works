---
name: image-reader
description: "用户发送图片时,使用 Gemini 视觉模型分析图片内容"
---

# Image Reader — 图片内容识别

当用户发送图片时，使用 Gemini 视觉模型分析图片内容并返回描述。

## 触发条件

- 用户消息中包含图片附件（image/jpeg, image/png, image/gif, image/webp 等）
- 图片通过 `MEDIA:<path>` 或附件形式出现在消息中

## 依赖

API Key 复用 image-generator 的环境变量：

```bash
export IMAGE_GEN_API_KEY="sk-..."
```

## 脚本

```
~/.openclaw/skills/image-reader/
├── SKILL.md
└── scripts/
    ├── api.sh            # 公共层：base64 编码 + curl 调用 + 中文错误提示
    └── read-image.sh     # 图片路径 → 文字描述
```

### 用法

```bash
# 基本用法：分析图片
bash ~/.openclaw/skills/image-reader/scripts/read-image.sh /path/to/image.jpg

# 指定模型
bash ~/.openclaw/skills/image-reader/scripts/read-image.sh /path/to/image.jpg "gemini-2.5-flash"

# 自定义分析要求
bash ~/.openclaw/skills/image-reader/scripts/read-image.sh /path/to/image.jpg "gemini-2.5-flash" "这张图里有什么文字？翻译成中文"
```

## 工作流

用户发送图片时：

1. **定位图片** — 从用户消息的附件中提取图片路径或 URL
2. **下载到本地** — 如果图片是 URL 而非本地路径，先下载到临时目录
3. **调用脚本分析**:
   ```bash
   DESCRIPTION=$(bash ~/.openclaw/skills/image-reader/scripts/read-image.sh "$IMAGE_PATH")
   ```
4. **回复用户** — 将返回的描述直接回复给用户

### 多图场景

如果用户同时发送多张图片，依次分析每张，在回复中按顺序展示分析结果。

## API

| 字段 | 值 |
|------|-----|
| Endpoint | `https://grsai.dakka.com.cn/v1/chat/completions` |
| 模型（优先） | `gemini-2.5-flash` |
| Auth | Bearer token (`$IMAGE_GEN_API_KEY`) |
| 格式 | OpenAI-compatible chat completions with vision |
| 请求示例 | `{ model, messages: [{ role: "user", content: [{ type: "text" }, { type: "image_url" }] }] }` |

## Model 兜底

如果 `gemini-2.5-flash` 不可用（API 返回 model not found），依次尝试：
- `gemini-2.0-flash-vision`
- `gemini-1.5-flash`
- `gemini-1.5-pro`
- `gpt-4o-mini`（通用 vision fallback）
- `claude-3-haiku`（通用 vision fallback）

## 错误处理

- `IMAGE_GEN_API_KEY not set` → 提示用户设置环境变量
- 图片文件不存在 → 返回错误信息
- API 认证失败 → 检查 IMAGE_GEN_API_KEY
- 余额不足 → 提示充值
- 模型不存在 → 自动降级到其他 vision 模型
- 安全过滤拒绝 → 提示图片内容被拒
- base64 编码过大 → 使用 `--rawfile` 避免命令行参数溢出
