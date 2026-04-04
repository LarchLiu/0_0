---
name: pong
description: >-
  This skill should be used when the user asks to "play pong", "launch pong",
  "open gesture pong", "run the pong plugin", "start the pong game",
  "打开 pong", "运行 pong 插件", "启动手势 pong", or when Claude should open the
  gesture-controlled Pong demo window from this plugin.
version: 0.1.0
---

# Pong — Gesture-Controlled Pong via Native WKWebView + MediaPipe + three.js

Open a native macOS window that runs a `three.js` Pong scene with live camera
tracking. The player's paddle follows the horizontal movement of a detected hand.

## Gestures

- Move your hand left/right to steer the paddle
- Open hand or OK gesture (hold briefly) to serve or resume
- Fist (hold briefly) to pause or unpause

Keyboard and on-screen controls are always available as fallback.

## Prerequisites

The plugin ships a local Swift `WKWebView` host in `scripts/native/`.
Running `npm install` in the scripts directory compiles that host binary.

## Execution Steps

### Step 1 — Ensure the local host is up to date

```bash
SCRIPTS_DIR="${CLAUDE_PLUGIN_ROOT}/scripts"
BINARY="$SCRIPTS_DIR/native/glimpse"
NEEDS_BUILD=0
if [ ! -x "$BINARY" ]; then
  NEEDS_BUILD=1
else
  for src in "$SCRIPTS_DIR"/native/glimpse.swift "$SCRIPTS_DIR"/native/Info.plist; do
    [ "$src" -nt "$BINARY" ] && NEEDS_BUILD=1 && break
  done
fi
if [ "$NEEDS_BUILD" -eq 1 ]; then
  cd "$SCRIPTS_DIR" && npm run build
fi
```

### Step 2 — Launch the game window

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pong.mjs"
```

默认窗口会按当前屏幕可用区域自适应到约 `80%`。

Optional window size overrides:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pong.mjs" --width 1280 --height 860 --title "Gesture Pong"
```

## Notes

- The command stays attached until the Pong window is closed.
- If camera access is denied or unavailable, the game still works with keyboard and buttons.
- The current implementation loads `three.js` and MediaPipe from CDN, matching the existing plugin style in this repo.
