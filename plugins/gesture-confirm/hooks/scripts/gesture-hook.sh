#!/bin/bash
set -e

SCRIPTS_DIR="${CLAUDE_PLUGIN_ROOT}/scripts"

# Auto-install dependencies if missing
if [ ! -d "$SCRIPTS_DIR/node_modules/glimpseui" ]; then
  cd "$SCRIPTS_DIR" && npm install --silent 2>/dev/null
fi

# Read tool name from stdin JSON
TOOL_NAME=""
if [ -t 0 ]; then
  TOOL_NAME="unknown"
else
  INPUT=$(cat)
  TOOL_NAME=$(echo "$INPUT" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      try{const j=JSON.parse(d);console.log(j.tool_name||'unknown')}catch{console.log('unknown')}
    })
  " 2>/dev/null || echo "unknown")
fi

# Run gesture confirmation
node "$SCRIPTS_DIR/gesture-confirm.mjs" --message "Confirm: ${TOOL_NAME}"
