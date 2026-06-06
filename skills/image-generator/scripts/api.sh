#!/usr/bin/env bash
# api.sh — 公共 API 调用层
# 其他脚本 source 此文件使用
# Usage: source api.sh; image_url=$(call_api "prompt" "model")
# 失败时返回空字符串，错误信息写入 stderr

set -euo pipefail

: "${IMAGE_GEN_API_KEY:?IMAGE_GEN_API_KEY 未设置，请先 export IMAGE_GEN_API_KEY=sk-...}"

API_URL="https://grsai.dakka.com.cn/v1/chat/completions"

call_api() {
  local prompt="$1"
  local model="$2"

  local response
  response=$(curl -s --max-time 120 "$API_URL" \
    -H "Authorization: Bearer $IMAGE_GEN_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg prompt "$prompt" --arg model "$model" '{
      model: $model,
      messages: [
        {role: "system", content: "You are an AI that generates images. User describes in English. When Chinese characters are requested, render them accurately. Respond with ONLY a markdown image link: ![image](url). No other text."},
        {role: "user", content: $prompt}
      ],
      stream: false
    }')")

  # 检查 API 层错误
  if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
    local err_msg
    err_msg=$(echo "$response" | jq -r '.error.message // "unknown error"')
    case "$err_msg" in
      *"insufficient credits"*)
        echo "▸ 模型 '$model' 余额不足，请充值" >&2 ;;
      *"apikey"*|*"API key"*|*"auth"*|*"Auth"*)
        echo "▸ API 认证失败，请检查 IMAGE_GEN_API_KEY" >&2 ;;
      *"rate"*|*"limit"*|*"quota"*)
        echo "▸ 请求过于频繁，请稍后再试" >&2 ;;
      *"timeout"*)
        echo "▸ 模型 '$model' 生成超时" >&2 ;;
      *)
        echo "▸ $model: $err_msg" >&2 ;;
    esac
    echo ""
    return 1
  fi

  # 提取最后一个图片 URL（处理 gpt-image-2 的进度条输出）
  local content
  content=$(echo "$response" | jq -r '.choices[0].message.content // ""')
  local url
  url=$(echo "$content" | grep -oP 'https?://[^) ]+' | tail -1)

  if [ -z "$url" ]; then
    echo "▸ 模型返回内容中没有图片链接" >&2
    echo ""
    return 1
  fi

  echo "$url"
  return 0
}
