#!/usr/bin/env bash
# read-image.sh — 分析图片内容，输出文字描述
# Usage: read-image.sh <image_path> [model] [prompt]
#   image_path: 图片文件路径（必填）
#   model:      视觉模型（可选，默认 gemini-2.5-flash）
#   prompt:     分析要求（可选，默认 "请详细描述这张图片的内容"）
#
# 输出: 图片的文字描述（stdout），错误信息走 stderr
# 退出码: 0=成功, 1=失败

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/api.sh"

IMAGE_PATH="${1:?用法: read-image.sh <image_path> [model] [prompt]}"
MODEL="${2:-gemini-2.5-flash}"
PROMPT="${3:-请详细描述这张图片的内容}"

DESCRIPTION=$(call_vision_api "$IMAGE_PATH" "$MODEL" "$PROMPT")
if [ -z "$DESCRIPTION" ]; then
  exit 1
fi

echo "$DESCRIPTION"
