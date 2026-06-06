#!/usr/bin/env bash
# generate-and-save.sh — 生成图片 → 下载到本地 → 注册到画廊
# Usage: generate-and-save.sh <prompt> [model]
#   model (optional): "gpt-image-2" (default) or "nano-banana-pro"
# Outputs: local URL of saved image

set -euo pipefail

PROMPT="$1"
MODEL="${2:-gpt-image-2}"
API_KEY=***
API_URL="https://grsai.dakka.com.cn/v1/chat/completions"
GALLERY_DIR="/usr/share/nginx/html/gallery"
IMAGES_DIR="$GALLERY_DIR/images"
LIST_JSON="$GALLERY_DIR/list.json"

# 1. Call API
RESPONSE=$(curl -s "$API_URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg prompt "$PROMPT" --arg model "$MODEL" '{
    model: $model,
    messages: [
      {role: "system", content: "You are an AI that generates images. Respond with ONLY a markdown image link: ![image](url). No other text."},
      {role: "user", content: $prompt}
    ],
    stream: false
  }')")

# Check for error
if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo "ERROR: $(echo "$RESPONSE" | jq -r '.error.message')" >&2
  exit 1
fi

# 2. Extract last image URL (handles progress output from gpt-image-2)
IMG_URL=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // ""' | grep -oP 'https?://[^) ]+' | tail -1)

if [ -z "$IMG_URL" ]; then
  echo "ERROR: no image URL found" >&2
  exit 1
fi

# 3. Generate filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SUFFIX=$(tr -dc 'a-f0-9' < /dev/urandom | head -c 8)
FILENAME="${TIMESTAMP}_${SUFFIX}.png"
LOCAL_PATH="$IMAGES_DIR/$FILENAME"

# 4. Download
curl -s -o "$LOCAL_PATH" "$IMG_URL"
LOCAL_SIZE=$(stat -c%s "$LOCAL_PATH" 2>/dev/null || echo "0")

if [ "$LOCAL_SIZE" -lt 100 ]; then
  rm -f "$LOCAL_PATH"
  echo "ERROR: downloaded file too small ($LOCAL_SIZE bytes)" >&2
  exit 1
fi

# 5. Update gallery index
CURRENT_TIME=$(date '+%Y-%m-%d %H:%M:%S')
if [ -f "$LIST_JSON" ]; then
  LIST=$(cat "$LIST_JSON")
else
  LIST="[]"
fi
echo "$LIST" | jq --arg name "$FILENAME" --arg time "$CURRENT_TIME" \
  --arg model "$MODEL" '. + [{"name": $name, "time": $time, "model": $model}] | .[-5:]' > "$LIST_JSON"

# 6. Output local URL
echo "http://localhost:8080/gallery/images/$FILENAME"
