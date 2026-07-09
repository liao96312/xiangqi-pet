# Xiangqi Pet

**Language:** English | [简体中文](README.zh-CN.md)

![Electron](https://img.shields.io/badge/Electron-Desktop-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React%20%2B%20Vite-19-61DAFB?logo=react&logoColor=111)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)

Xiangqi Pet is a desktop-pet-style Chinese chess trainer built with Electron, React, and TypeScript. It stays as a small floating window, lets you play and review positions, highlights tactical risks, and can use a local Pikafish engine when available.

## Features

- Floating desktop window with one-click pin-to-top.
- Tray hide, minimize, and quit.
- Click-to-move board with built-in Xiangqi rule validation.
- Red-side or black-side play.
- Hint button that suggests candidate moves in Xiangqi notation.
- Opening practice with built-in common lines.
- Position evaluation, review, and mate-in-one hints.
- Highlights unprotected pieces that can be captured.
- Optional Pikafish engine support from the local `engines/` directory.
- Compact mode for a more desktop-pet-like shape.

## Optional Pikafish Engine

Download a Windows Pikafish engine package from the official release or website, unzip it, and place any `pikafish*.exe` file under:

```text
engines/
```

After startup, the app recursively searches `engines/` for `pikafish*.exe`. When found:

- Position evaluation uses Pikafish.
- AI hints prefer Pikafish best moves.
- Auto training prefers Pikafish moves.

Pikafish is a GPL-3.0 project. NNUE weights may also have usage restrictions. Confirm licensing separately before redistribution or commercial use.

## Development

```bash
npm install
npm run dev
```

If Electron download fails, use a mirror:

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

## Verification

```bash
npm run selftest
npm run build
```

`selftest` validates Xiangqi rules and move logic. `build` compiles the React app, Vite assets, and Electron main process.

## Build Installer

```bash
npm run build:installer
```

`build:installer` first checks whether a real `pikafish*.exe` exists under `engines/`. If the engine is missing, the build fails early to avoid accidentally shipping a weak-engine installer.

## Repository Layout

```text
src/        React UI and Xiangqi game logic
electron/   Electron main process, preload, and Pikafish adapter
engines/    Optional local Pikafish engine directory
tests/      Xiangqi rule self-tests
scripts/    Startup, icon generation, engine check, selftest helpers
build/      App icon assets
```

## Status

This is a local desktop trainer. It avoids network dependencies; stronger analysis is enabled by dropping a local Pikafish executable into `engines/`.
