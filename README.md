# gesture-confirm

Claude Code marketplace repository for the `gesture-confirm` plugin. The plugin uses MediaPipe hand tracking + Glimpse native macOS windows for gesture-based confirmation and selection.

macOS only. `glimpseui` depends on WKWebView and this plugin is not intended for Linux or Windows.

## Quick Install

```bash
claude plugin marketplace add github:cloudgeek/gesture-confirm
claude plugin install gesture-confirm@gesture-confirm-marketplace
```

## Features

- **Confirm mode**: Thumbs up = allow, Fist = deny
- **Select mode**: Show 1-5 fingers to choose between options
- Real-time camera feed with hand landmark visualization
- 1.5s hold to confirm (prevents accidental triggers)
- Keyboard & button fallbacks when camera is unavailable

## Requirements

- macOS
- Node.js 18+
- Xcode Command Line Tools (for Glimpse native build)

## Install

This repository is a marketplace, not a single-plugin root. Add the marketplace first, then install the plugin from it.

From a local checkout:

```bash
claude plugin marketplace add /path/to/gesture-confirm
claude plugin install gesture-confirm@gesture-confirm-marketplace
```

From GitHub:

```bash
claude plugin marketplace add github:cloudgeek/gesture-confirm
claude plugin install gesture-confirm@gesture-confirm-marketplace
```

The plugin implementation lives in `plugins/gesture-confirm`.
Dependencies are auto-installed on first hook execution via the hook script.

## Usage

### As a Hook (automatic)

The plugin registers a `PreToolUse` hook for `Bash|Write|Edit` tools. A gesture confirmation window appears automatically before these tools execute.

### As a Skill (manual)

Ask Claude to use gesture confirmation:

> "Use gesture confirm for this plan"
> "Let me select with gesture"

### CLI (standalone)

If you have not triggered the hook before, install the script dependencies once:

```bash
cd plugins/gesture-confirm/scripts
npm install
cd ../../..
```

```bash
# Confirm mode
node plugins/gesture-confirm/scripts/gesture-confirm.mjs --message "Deploy to production?"

# Select mode
node plugins/gesture-confirm/scripts/gesture-confirm.mjs --mode select --options "Approach A,Approach B,Approach C"
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
