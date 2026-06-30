# 象棋桌宠

一个独立的 Electron + React 象棋陪练小窗。

## 功能

- 桌面悬浮窗口，默认置顶
- 托盘隐藏、最小化、退出
- 点击棋子走子，内置基本完整象棋规则
- 可换边，支持你执红或执黑
- 灯泡按钮给当前局面推荐走法，使用象棋术语显示
- 谱招练习，内置多条常见开局谱线
- 局内评分、复盘、一步绝杀提示
- 无保护且会被吃的棋子会高亮提醒
- 如果 `engines/` 目录里放入 Pikafish 可执行文件，会自动使用强引擎分析、评分和提示
- 可收起成迷你桌宠形态

## 强引擎

从 Pikafish 官方 release 或官网“纯引擎文件”下载 Windows 引擎包，解压后把任意 `pikafish*.exe` 放到：

```text
engines/
```

应用启动后会递归查找 `engines/` 下的 `pikafish*.exe`。找到后：

- 局内评分条使用 Pikafish 分析
- AI 提示优先使用 Pikafish 的最佳走法
- 自动陪练优先使用 Pikafish 走子

Pikafish 是 GPL-3.0 项目，NNUE 权重也有使用限制；如果后续要发布或商用，需要单独确认授权。

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

## 构建检查

```bash
npm run build
```
