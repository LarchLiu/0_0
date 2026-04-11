# gesture-confirm

Claude Code marketplace repository for `gesture-confirm` plus a small set of native macOS plugins built around MediaPipe tracking and a `WKWebView` host. The current marketplace includes gesture confirmation, Pong, moto racing, bowling, and a fitness coach.

macOS only. The plugin embeds a native `WKWebView` host and is not intended for Linux or Windows.

## Quick Install

```bash
claude plugin marketplace add github:cloudgeek/gesture-confirm
claude plugin install gesture-confirm@gesture-confirm-marketplace
# or install the bowling game
claude plugin install bowling@gesture-confirm-marketplace
```

## Available Plugins

- `gesture-confirm`: Gesture-based confirmation and option selection for Claude Code tools
- `pong`: Hand-tracked Pong with keyboard fallback
- `moto-race`: Cyberpunk motorcycle racing game with gesture input
- `bowling`: 10-frame bowling game with strike/spare scoring and optional hand tracking
- `fitness-coach`: Pose-based exercise scoring and coaching

## Features

- **Confirm mode**: Thumbs up = allow, Fist = deny
- **Select mode**: Show 1-5 fingers to choose between options
- Real-time camera feed with hand landmark visualization
- 1.5s hold to confirm (prevents accidental triggers)
- Keyboard & button fallbacks when camera is unavailable

## Requirements

- macOS
- Node.js 18+
- Xcode Command Line Tools (for the native host build)

## Install

This repository is a marketplace, not a single-plugin root. Add the marketplace first, then install the plugin you want from it.

From a local checkout:

```bash
claude plugin marketplace add /path/to/gesture-confirm
claude plugin install gesture-confirm@gesture-confirm-marketplace
claude plugin install bowling@gesture-confirm-marketplace
```

From GitHub:

```bash
claude plugin marketplace add github:cloudgeek/gesture-confirm
claude plugin install gesture-confirm@gesture-confirm-marketplace
claude plugin install bowling@gesture-confirm-marketplace
```

Plugin implementations live under `plugins/`.
`gesture-confirm` auto-installs dependencies on first hook execution; game plugins install dependencies from their own `scripts/` directories.

## Repository Layout

- `plugins/gesture-confirm`: confirmation and selection plugin
- `plugins/pong`: Pong game plugin
- `plugins/moto-race`: moto racing plugin
- `plugins/bowling`: bowling game plugin
- `plugins/fitness-coach`: fitness coach plugin

## Usage

### gesture-confirm as a Hook (automatic)

The plugin registers a `PreToolUse` hook for `Bash|Write|Edit` tools. A gesture confirmation window appears automatically before these tools execute.

### gesture-confirm as a Skill (manual)

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

## Bowling Quick Start

Install and run the bowling plugin locally:

```bash
cd plugins/bowling/scripts
npm install
node bowling.mjs
```

You can also launch it through Claude after installing from the marketplace:

> "Use bowling"
> "Launch the bowling game"

## License

MIT
