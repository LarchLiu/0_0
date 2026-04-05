#!/bin/bash
set -e

SCRIPTS_DIR="${CLAUDE_PLUGIN_ROOT}/scripts"
GLIMPSE_DIR="$SCRIPTS_DIR/node_modules/@cloudgeek/glimpse"
BINARY="$GLIMPSE_DIR/glimpse"

# Install deps (builds Glimpse host) if binary missing
if [ ! -x "$BINARY" ]; then
  cd "$SCRIPTS_DIR" && npm install --silent 2>/dev/null
fi

exec node "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/gesture-hook.mjs"
