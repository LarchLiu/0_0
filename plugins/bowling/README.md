# Bowling

Gesture-controlled bowling game for Claude Code. Line up the ball, build power, and clear all ten pins across a full 10-frame match.

Built with Three.js, MediaPipe Hands, and `@cloudgeek/glimpse` (native macOS `WKWebView` host).

macOS only. The plugin embeds a native `WKWebView` host and is not intended for Linux or Windows.

## Quick Install

```bash
claude plugin marketplace add github:cloudgeek/gesture-confirm
claude plugin install bowling@gesture-confirm-marketplace
```

## Features

- 10-frame bowling with strike, spare, and final-frame bonus-ball scoring
- 3D lane, ball, and pin presentation rendered with Three.js
- Hand-tracked aim and throw controls when camera access is available
- Keyboard fallback for the full game loop
- Native macOS window host via `@cloudgeek/glimpse`

## Requirements

- macOS
- Node.js 18+
- Xcode Command Line Tools

## Install

This plugin is published from the repository marketplace root. Add the marketplace, then install the plugin:

```bash
claude plugin marketplace add /path/to/gesture-confirm
claude plugin install bowling@gesture-confirm-marketplace
```

Or from GitHub:

```bash
claude plugin marketplace add github:cloudgeek/gesture-confirm
claude plugin install bowling@gesture-confirm-marketplace
```

## Quick Start

```bash
cd plugins/bowling/scripts
npm install
node bowling.mjs
```

Optional window sizing:

```bash
node bowling.mjs --width 1400 --height 900 --title "Bowling"
```

## Usage

### As a Skill

Ask Claude to open the game:

> "Use bowling"
> "Launch the bowling game"
> "Open the bowling plugin"

### CLI

```bash
cd plugins/bowling
node scripts/bowling.mjs
```

## Controls

| Input | Action |
|-------|--------|
| `A` / `D` or `←` / `→` | Move aim left/right |
| Hold `Space` | Charge the throw |
| Release `Space` | Roll the ball |
| `Enter` / `OK` gesture | Continue to next roll / next frame |
| `R` | Restart the match |
| `Escape` | Quit |

## Gesture Controls

When camera access is available:

- Fully open palm: move left/right to aim
- Claw hand: charge the throw
- Closed fist: throw the ball
- `OK` gesture: continue to next roll / next frame

Keyboard controls remain available as fallback.

## License

MIT
