---
name: moto-race
description: >-
  This skill should be used when the user asks to "play moto race", "launch moto race",
  "open motorcycle racing", "run the moto-race plugin", "start the racing game",
  "打开摩托车游戏", "运行赛车游戏", "启动摩托竞赛", or when Claude should open the
  cyberpunk motorcycle racing game window from this plugin.
version: 0.1.0
---

# Moto-Race — Cyberpunk Motorcycle Racing via Native WKWebView + Three.js + MediaPipe

Open a native macOS window that runs a Three.js motorcycle racing game with optional
live camera hand tracking. Race against 4 AI opponents on a neon-lit circuit track.

## Controls

### Keyboard
- Arrow keys or WASD to steer and accelerate/brake
- Space for speed boost
- R to restart race
- Escape to exit

### Gestures (optional)
- Tilt hand left/right to steer
- Open palm for throttle
- Closed fist to brake
- Pinch (thumb+index) for boost

## Prerequisites

The plugin ships a local Swift `WKWebView` host via `@cloudgeek/glimpse`.
Running `npm install` in the scripts directory installs the dependency.

## Execution Steps

### Step 1 — Ensure the local host is up to date

```bash
SCRIPTS_DIR="${CLAUDE_PLUGIN_ROOT}/scripts"
BINARY="$SCRIPTS_DIR/node_modules/@cloudgeek/glimpse/glimpse"
NEEDS_BUILD=0
if [ ! -x "$BINARY" ]; then
  NEEDS_BUILD=1
else
  GLIMPSE_DIR="$SCRIPTS_DIR/node_modules/@cloudgeek/glimpse"
  for src in "$GLIMPSE_DIR"/glimpse.swift "$GLIMPSE_DIR"/Info.plist; do
    [ "$src" -nt "$BINARY" ] && NEEDS_BUILD=1 && break
  done
fi
if [ "$NEEDS_BUILD" -eq 1 ]; then
  cd "$SCRIPTS_DIR" && npm install
fi
```

### Step 2 — Launch the game window

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/moto-race.mjs"
```

Optional window size overrides:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/moto-race.mjs" --width 1280 --height 860 --title "Moto Race"
```

## Notes

- The command stays attached until the game window is closed.
- If camera access is denied or unavailable, the game still works with keyboard controls.
- Three.js and MediaPipe are loaded from CDN.
