#!/bin/bash

set -euo pipefail

npx netlify serve &
PREVIEW_PID=$!

cleanup() {
  kill "$PATCH_PID" 2>/dev/null || true
  kill "$PREVIEW_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

(
  while kill -0 "$PREVIEW_PID" 2>/dev/null; do
    if [ -d ".netlify/functions-serve/.unzipped" ]; then
      for dir in .netlify/functions-serve/.unzipped/*; do
        if [ -d "$dir" ]; then
          printf '{"type":"commonjs"}\n' > "$dir/package.json"
        fi
      done
    fi

    sleep 0.2
  done
) &
PATCH_PID=$!

wait "$PREVIEW_PID"