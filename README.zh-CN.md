# 象棋桌宠

**语言：** [English](README.md) | 简体中文

![Electron](https://img.shields.io/badge/Electron-Desktop-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React%20%2B%20Vite-19-61DAFB?logo=react&logoColor=111)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)

象棋桌宠是一个基于 Electron、React 和 TypeScript 的桌面悬浮象棋陪练小窗。它可以作为小窗口停在桌面上，支持下棋、复盘、风险提示，并在本地放入 Pikafish 引擎后启用更强分析。

## 功能

- 桌面悬浮窗口，可一键置顶。
- 托盘隐藏、最小化和退出。
- 点击棋子走子，内置象棋规则校验。
- 可换边，支持执红或执黑。
- 提示按钮给当前局面推荐走法，并使用象棋术语显示。
- 谱招练习，内置常见开局路线。
- 局面评分、复盘和一步绝杀提示。
- 高亮无保护且会被吃的棋子。
- `engines/` 目录放入 Pikafish 后自动启用强引擎。
- 可收起成更像桌宠的小形态。

## 可选 Pikafish 引擎

从 Pikafish 官方 release 或官网下载安装 Windows 引擎包，解压后把任意 `pikafish*.exe` 放到：

```text
engines/
```

应用启动后会递归查找 `engines/` 下的 `pikafish*.exe`。找到后：

- 局面评分使用 Pikafish 分析。
- AI 提示优先使用 Pikafish 最佳走法。
- 自动陪练优先使用 Pikafish 走子。

Pikafish 是 GPL-3.0 项目，NNUE 权重也可能有使用限制；如果后续要发布或商用，需要单独确认授权。

## 开发

```bash
npm install
npm run dev
```

如果 Electron 下载失败，可以使用镜像：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

## 验证

```bash
npm run selftest
npm run build
```

`selftest` 会验证象棋规则和走子逻辑。`build` 会编译 React 应用、Vite 资源和 Electron 主进程。

## 发布安装包

```bash
npm run build:installer
```

`build:installer` 会先检查 `engines/` 下是否存在真正的 `pikafish*.exe`。如果缺少强引擎，会直接失败，避免静默打出弱引擎安装包。

## 目录结构

```text
src/        React UI 和象棋规则逻辑
electron/   Electron 主进程、preload 和 Pikafish 适配
engines/    可选本地 Pikafish 引擎目录
tests/      象棋规则自测
scripts/    启动、图标生成、引擎检查、自测辅助脚本
build/      应用图标资源
```

## 当前状态

这是一个本地桌面陪练工具，不依赖联网服务；需要更强分析时，把本地 Pikafish 可执行文件放进 `engines/` 即可。
