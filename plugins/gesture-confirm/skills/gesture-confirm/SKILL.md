---
name: gesture-confirm
description: >-
  This skill should be used when the user asks to "confirm with gesture",
  "use gesture confirmation", "hand gesture approve", "select with gesture",
  "gesture select", mentions "gesture confirm", "gesture-confirm",
  "手势确认", "手势选择", "手势识别确认", or when Claude needs user confirmation
  for plans, decisions, option selection, or any approval that benefits from
  a visual gesture-based interaction.
version: 2.0.0
---

# Gesture Confirm — Hand Gesture Confirmation & Selection via Native WKWebView + MediaPipe

Open a native macOS window with a live camera feed and MediaPipe hand tracking.
Two modes: **confirm** (allow/deny) and **select** (choose from 1-5 options by finger count).

## Modes

### Confirm Mode (default)
- **Thumbs up** (hold 1.5s) → Allow
- **Fist** (hold 1.5s) → Deny
- Keyboard: Enter = allow, Escape = deny

### Select Mode
- **1 finger** (index) → Option 1
- **2 fingers** (index + middle) → Option 2
- **3 fingers** (index + middle + ring) → Option 3
- **4 fingers** (four fingers, no thumb) → Option 4
- **5 fingers** (open hand) → Option 5
- **Fist** → Cancel
- Keyboard: 1-5 = select, Escape = cancel

## Prerequisites

The plugin ships a local Swift `WKWebView` host in `scripts/native/`.
Running `npm install` in the scripts directory compiles that host binary.

## Execution Steps

### Step 1 — Ensure dependencies are installed

```bash
SCRIPTS_DIR="${CLAUDE_PLUGIN_ROOT}/scripts"
if [ ! -x "$SCRIPTS_DIR/native/glimpse" ]; then
  cd "$SCRIPTS_DIR" && npm install
fi
```

### Step 2 — Run gesture confirmation

**Confirm mode:**
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gesture-confirm.mjs" --message "Approve this plan?"
```

**Select mode:**
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gesture-confirm.mjs" --mode select --options "Option A,Option B,Option C" --message "Choose an approach:"
```

Optional: `--timeout 30000` (milliseconds, default 30s).

### Step 3 — Parse the result

**Confirm mode** outputs:
```json
{"permissionDecision": "allow"}
```
or
```json
{"permissionDecision": "deny"}
```

**Select mode** outputs:
```json
{"selection": 2, "label": "Option B"}
```
or on cancel:
```json
{"selection": 0, "label": ""}
```

## Troubleshooting

- **Camera not available**: Fallback buttons and keyboard shortcuts are always available.
- **MediaPipe loading slow**: First run downloads model files (~5MB) from CDN. Cached after.
- **Native host not built**: Run `cd "${CLAUDE_PLUGIN_ROOT}/scripts" && npm install`.
