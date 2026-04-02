# gesture-confirm

Hand gesture confirmation plugin for Claude Code. Uses MediaPipe hand tracking + Glimpse native macOS windows.

## Features

- **Confirm mode**: Thumbs up = allow, Fist = deny
- **Select mode**: Show 1-5 fingers to choose between options
- Real-time camera feed with hand landmark visualization
- 1.5s hold to confirm (prevents accidental triggers)
- Keyboard & button fallbacks when camera is unavailable

## Requirements

- macOS (Glimpse uses WKWebView)
- Node.js 18+
- Xcode Command Line Tools (for Glimpse native build)

## Install

```bash
claude plugin add /path/to/gesture-confirm
```

Or from GitHub:

```bash
claude plugin add github:cloudgeek/gesture-confirm
```

Dependencies are auto-installed on first use via the hook script.

## Usage

### As a Hook (automatic)

The plugin registers a `PreToolUse` hook for `Bash|Write|Edit` tools. A gesture confirmation window appears automatically before these tools execute.

### As a Skill (manual)

Ask Claude to use gesture confirmation:

> "Use gesture confirm for this plan"
> "Let me select with gesture"

### CLI (standalone)

```bash
# Confirm mode
node scripts/gesture-confirm.mjs --message "Deploy to production?"

# Select mode
node scripts/gesture-confirm.mjs --mode select --options "Approach A,Approach B,Approach C"
```

## Gestures

| Gesture | Confirm Mode | Select Mode |
|---------|-------------|-------------|
| Thumbs up | Allow | - |
| Fist | Deny | Cancel |
| 1 finger | - | Option 1 |
| 2 fingers | - | Option 2 |
| 3 fingers | - | Option 3 |
| 4 fingers | - | Option 4 |
| 5 fingers (open hand) | - | Option 5 |

Keyboard: `Enter`/`Esc` (confirm), `1`-`5`/`Esc` (select)

## License

MIT
