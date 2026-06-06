#!/usr/bin/env bash
# generate.sh — 纯 API 调用，输出图片 URL
# Usage: generate.sh <prompt> [model]
#   model (optional): "gpt-image-2" (default) or "nano-banana-pro"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/api.sh"

PROMPT="$1"
MODEL="${2:-gpt-image-2}"

URL=$(call_api "$PROMPT" "$MODEL")
if [ -z "$URL" ]; then
  exit 1
fi

echo "$URL"
