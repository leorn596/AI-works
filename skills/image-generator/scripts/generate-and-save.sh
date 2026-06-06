#!/usr/bin/env bash
# generate-and-save.sh — 生成 n 张图片 → 下载到本地 → 注册到画廊
# Usage: generate-and-save.sh <prompt> [model] [n]
#   prompt (必填): 图片描述
#   model  (可选): "gpt-image-2" (默认) 或 "nano-banana-pro"
#   n      (可选): 生成数量 (默认 1)
# Outputs: 每行一个本地 URL

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/api.sh"

PROMPT="$1"
MODEL="${2:-gpt-image-2}"
COUNT="${3:-1}"

GALLERY_DIR="/usr/share/nginx/html/gallery"
IMAGES_DIR="$GALLERY_DIR/images"
LIST_JSON="$GALLERY_DIR/list.json"

# 确保目录存在
mkdir -p "$IMAGES_DIR"

download_and_register() {
  local img_url="$1"

  local timestamp
  timestamp=$(date +%Y%m%d_%H%M%S)
  local suffix
  suffix=$(tr -dc 'a-f0-9' < /dev/urandom | head -c 8)
  local filename="${timestamp}_${suffix}.png"
  local local_path="$IMAGES_DIR/$filename"

  # 下载
  curl -s --max-time 60 -o "$local_path" "$img_url"
  local size
  size=$(stat -c%s "$local_path" 2>/dev/null || echo "0")

  if [ "$size" -lt 100 ]; then
    rm -f "$local_path"
    echo "▸ 下载文件太小 ($size bytes)，已丢弃" >&2
    return 1
  fi

  # 注册到索引
  local current_time
  current_time=$(date '+%Y-%m-%d %H:%M:%S')
  if [ -f "$LIST_JSON" ]; then
    local list
    list=$(cat "$LIST_JSON")
  else
    list="[]"
  fi
  echo "$list" | jq --arg name "$filename" --arg time "$current_time" \
    --arg model "$MODEL" --arg prompt "${PROMPT:0:60}" \
    '. + [{"name": $name, "time": $time, "model": $model, "prompt": $prompt}]' > "$LIST_JSON"

  local local_url="http://localhost:8080/gallery/images/$filename"
  echo "$local_url"
}

echo "▸ 模型: $MODEL" >&2
echo "▸ 数量: $COUNT" >&2

SUCCESS_COUNT=0
for i in $(seq 1 "$COUNT"); do
  [ "$COUNT" -gt 1 ] && echo "▸ [$i/$COUNT] 生成中..." >&2

  URL=$(call_api "$PROMPT" "$MODEL")
  if [ -z "$URL" ]; then
    echo "▸ [$i/$COUNT] 生成失败，跳过" >&2
    continue
  fi

  LOCAL_URL=$(download_and_register "$URL")
  if [ -n "$LOCAL_URL" ]; then
    echo "$LOCAL_URL"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  fi
done

echo "▸ 完成: $SUCCESS_COUNT/$COUNT 张" >&2

if [ "$SUCCESS_COUNT" -eq 0 ]; then
  exit 1
fi
