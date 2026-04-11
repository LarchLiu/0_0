---
name: bowling
description: >-
  This skill should be used when the user asks to "play bowling", "play a round
  of bowling", "launch bowling", "launch the bowling game", "open bowling",
  "open the bowling game", "run bowling", "run the bowling plugin",
  "start bowling", "start the bowling game", "打开保龄球", "打开 bowling",
  "运行保龄球插件", "启动保龄球游戏", "玩保龄球", "来一局保龄球", or when Claude
  should open the bowling game window from this plugin.
version: 0.1.0
---

# Bowling — Gesture-Controlled Bowling via Native WKWebView + Three.js + MediaPipe

Open a native macOS window that runs a bowling game with a 3D lane, 10-pin scoring,
and optional live hand tracking.

## Controls

### Keyboard
- `A` / `D` or `Left` / `Right` to move aim
- Hold `Space` to build throw power
- Release `Space` to roll the ball
- `Enter` or `OK` gesture to continue after a roll
- `R` to restart the match
- `Escape` to exit

### Gestures (optional)
- Fully open palm to aim left/right
- Claw hand to charge the throw
- Fist to throw the ball
- `OK` gesture to continue to the next roll or frame

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
node "${CLAUDE_PLUGIN_ROOT}/scripts/bowling.mjs"
```

Optional window size overrides:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/bowling.mjs" --width 1400 --height 900 --title "Bowling"
```

## Notes

- The command stays attached until the bowling window is closed.
- If camera access is denied or unavailable, the game still works with keyboard controls.
- Three.js and MediaPipe are loaded from CDN, matching the existing game plugins in this repo.
