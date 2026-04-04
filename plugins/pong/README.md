# pong

Gesture-controlled Pong plugin for Claude Code. Uses MediaPipe hand tracking plus `three.js` inside a native macOS `WKWebView` host.

macOS only. The plugin embeds a native `WKWebView` host and is not intended for Linux or Windows.

## Quick Install

```bash
claude plugin marketplace add github:cloudgeek/gesture-confirm
claude plugin install pong@gesture-confirm-marketplace
```

## Features

- Hand tracking with live camera preview and landmark overlay
- `three.js` Pong scene with arcade-style lighting and motion
- Horizontal hand movement controls the player paddle
- Open hand or OK gesture serves/resumes, fist pauses
- Keyboard and on-screen button fallbacks when camera tracking is unavailable

## Requirements

- macOS
- Node.js 18+
- Xcode Command Line Tools

## Install

This plugin is published from the repository marketplace root. Add the marketplace, then install the plugin:

```bash
claude plugin marketplace add /path/to/gesture-confirm
claude plugin install pong@gesture-confirm-marketplace
```

Or from GitHub:

```bash
claude plugin marketplace add github:cloudgeek/gesture-confirm
claude plugin install pong@gesture-confirm-marketplace
```

Build the local host once before first use:

```bash
cd plugins/pong/scripts
npm install
cd ..
```

## Usage

### As a Skill

Ask Claude to open the game:

> "Use pong"
> "Launch gesture pong"
> "Open the pong plugin"

### CLI

```bash
cd plugins/pong
node scripts/pong.mjs
```

默认会按当前屏幕可用区域自适应到约 `80%` 大小。

Optional flags:

```bash
node scripts/pong.mjs --title "Gesture Pong" --width 1280 --height 860
```

## Controls

- Move one hand left/right to steer the bottom paddle
- Open hand or OK gesture: serve or resume
- Fist: pause or unpause
- Keyboard fallback:
  - `Left` / `Right` or `A` / `D`: move paddle
  - `Space`: serve or resume
  - `P`: pause
  - `R`: reset match
  - `Esc`: close the window

## License

MIT
