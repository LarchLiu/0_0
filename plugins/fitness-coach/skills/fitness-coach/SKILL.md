---
name: fitness-coach
description: >-
  This skill should be used when the user asks to "start fitness coaching", "open fitness coach",
  "launch exercise scoring", "run the fitness plugin", "练习健身", "打开健身教练",
  "开始运动评分", "运动打分", "健身打卡", or when Claude should open the
  pose-scoring fitness coach window from this plugin.
version: 0.1.0
---

# Fitness-Coach — Real-time Pose Scoring via PoseLandmarker + WKWebView

Open a native macOS window that runs a real-time exercise coach using MediaPipe
PoseLandmarker. Import a standard exercise video to generate a pose template,
then score your movements in real-time against the template.

## How It Works

1. **Record Standard**: Import a video of the correct exercise form. The system
   extracts body landmarks frame-by-frame to create a reference template.
2. **Real-time Scoring**: Select a saved template, start the camera, and perform
   the exercise. The system uses spatial normalization, cosine similarity, and
   online DTW to score your form in real-time.

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

### Step 2 — Launch the fitness coach window

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/fitness-coach.mjs"
```

Optional overrides:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/fitness-coach.mjs" --width 1024 --height 768 --title "Fitness Coach"
```

## Notes

- The command stays attached until the window is closed.
- If camera access is denied, a message prompts the user to enable it.
- MediaPipe PoseLandmarker model is loaded from Google CDN (~5MB, cached by WKWebView).
- Standard templates are stored in `~/.fitness-coach/standards/`.
