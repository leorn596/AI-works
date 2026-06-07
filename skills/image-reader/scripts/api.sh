#!/usr/bin/env bash
# api.sh — 公共 API 调用层（图片识别专用）
# 其他脚本 source 此文件使用
# 失败时返回空字符串，错误信息写入 stderr

set -euo pipefail

: "${IMAGE_GEN_API_KEY:?IMAGE_GEN_API_KEY 未设置，请先 export IMAGE_GEN_API_KEY=sk-...}"

API_URL="https://grsai.dakka.com.cn/v1/chat/completions"

# 构建包含图片的 JSON 请求体并写入文件
# 用 --rawfile 从文件读取 base64 数据，避免命令行参数溢出
build_request_body() {
  local image_path="$1"
  local model="$2"
  local user_prompt="$3"
  local output_file="$4"

  local mime
  mime=$(file --mime-type -b "$image_path" 2>/dev/null || echo "image/jpeg")

  # base64 写入临时文件，避免作为命令行参数
  local b64_file
  b64_file=$(mktemp)
  base64 -w0 < "$image_path" > "$b64_file"

  jq -n \
    --arg model "$model" \
    --arg prompt "$user_prompt" \
    --arg mime "$mime" \
    --rawfile b64 "$b64_file" \
    '{
      model: $model,
      messages: [
        {
          role: "user",
          content: [
            {type: "text", text: $prompt},
            {type: "image_url", image_url: {url: ("data:" + $mime + ";base64," + $b64)}}
          ]
        }
      ],
      stream: false
    }' > "$output_file"

  rm -f "$b64_file"
}

# 调用视觉 API，返回文本描述
# Usage: call_vision_api <image_path> [model] [prompt]
#   image_path: 图片文件路径
#   model: 视觉模型 (默认 gemini-2.5-flash)
#   prompt: 用户指定的分析要求 (默认 "请详细描述这张图片的内容")
call_vision_api() {
  local image_path="$1"
  local model="${2:-gemini-2.5-flash}"
  local user_prompt="${3:-请详细描述这张图片的内容}"

  # 校验文件
  if [ ! -f "$image_path" ]; then
    echo "▸ 图片文件不存在: $image_path" >&2
    echo ""
    return 1
  fi

  # 构建请求体到临时文件
  local tmpfile
  tmpfile=$(mktemp)
  build_request_body "$image_path" "$model" "$user_prompt" "$tmpfile"

  local response
  response=$(curl -s --max-time 120 "$API_URL" \
    -H "Authorization: Bearer $IMAGE_GEN_API_KEY" \
    -H "Content-Type: application/json" \
    -d "@$tmpfile")

  rm -f "$tmpfile"

  # 检查 API 层错误
  if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
    local err_msg
    err_msg=$(echo "$response" | jq -r '.error.message // "unknown error"')
    case "$err_msg" in
      *"insufficient credits"*|*"余额不足"*)
        echo "▸ 模型 '$model' 余额不足，请充值" >&2 ;;
      *"apikey"*|*"API key"*|*"auth"*|*"Auth"*|*"认证"*)
        echo "▸ API 认证失败，请检查 IMAGE_GEN_API_KEY" >&2 ;;
      *"rate"*|*"limit"*|*"quota"*|*"限流"*)
        echo "▸ 请求过于频繁，请稍后再试" >&2 ;;
      *"timeout"*|*"超时"*)
        echo "▸ 模型 '$model' 请求超时" >&2 ;;
      *"model"*|*"not found"*|*"不存在"*|*"不支持"*)
        echo "▸ 模型 '$model' 不支持或不存在，尝试其他模型" >&2 ;;
      *"content"*|*"safety"*|*"blocked"*|*"拒绝"*)
        echo "▸ 图片内容被安全过滤拒绝" >&2 ;;
      *"too large"*|*"size"*|*"过大"*)
        echo "▸ 图片文件过大，请压缩后重试" >&2 ;;
      *)
        echo "▸ $model: $err_msg" >&2 ;;
    esac
    echo ""
    return 1
  fi

  # 提取文本内容
  local content
  content=$(echo "$response" | jq -r '.choices[0].message.content // ""')

  if [ -z "$content" ]; then
    echo "▸ 模型返回内容为空" >&2
    echo ""
    return 1
  fi

  echo "$content"
  return 0
}
