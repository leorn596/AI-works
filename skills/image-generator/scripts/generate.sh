#!/usr/bin/env bash
# Image Generator — API call wrapper
# Usage: generate.sh <prompt> [model]
#   model (optional): "gpt-image-2" (default) or "nano-banana-pro"
# Reads IMAGE_GEN_API_KEY from environment
# Outputs: image URL(s) extracted from model response

set -euo pipefail

PROMPT="$1"
MODEL="${2:-gpt-image-2}"  # default: gpt-image-2
API_KEY=***
API_URL="https://grsai.dakka.com.cn/v1/chat/completions"

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

# Extract image URL (handle progress output from gpt-image-2)
CONTENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // ""')
echo "$CONTENT" | grep -oP 'https?://[^) ]+' | tail -1 || {
  echo "ERROR: no image URL found" >&2
  exit 1
}
