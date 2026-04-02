#!/bin/bash
set -e

SCRIPTS_DIR="${CLAUDE_PLUGIN_ROOT}/scripts"
BINARY="$SCRIPTS_DIR/native/glimpse"

# Build the local WKWebView host if missing
if [ ! -x "$BINARY" ]; then
  cd "$SCRIPTS_DIR" && npm install --silent 2>/dev/null
fi

exec node "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/gesture-hook.mjs"
