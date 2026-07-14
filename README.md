# 象棋桌宠

桌面悬浮的象棋陪练小窗。点击走子、AI 对弈、提示、绝杀判定，一窗搞定。

---

## 核心功能

- 点击棋子走子，内置完整象棋规则
- AI 陪练（入门 / 普通 / 进阶 / 强），可换边执红或执黑
- 灯泡按钮提示当前局面最佳走法
- 局内评分条 + 分析面板
- 悬浮窗口、置顶、托盘隐藏

## 增强功能

- 谱招练习（内置橘中秘开局）
- 一步绝杀判定与杀法名称提示
- 复盘（需强引擎）
- 无保护 / 悬空棋子高亮提醒
- 翻转视角、迷你桌宠形态

## 强引擎（可选）

把 Pikafish 的 `pikafish*.exe` 放到 `engines/` 目录，应用会自动启用：

- 强引擎评分与分析
- AI 提示优先使用 Pikafish 最佳走法
- 进阶 / 强难度使用引擎走子

> Pikafish 是 GPL-3.0 项目，NNUE 权重有使用限制；发布或商用前需单独确认授权。

---

## 开发者指南

### 快速开始

```bash
npm install
npm run dev
```

Electron 下载失败时用镜像：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

### 构建命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 + Electron |
| `npm run build` | 类型检查 + Vite 构建 |
| `npm run selftest` | 运行自测（象棋规则） |
| `npm run build:installer` | 生成 NSIS 安装包（含引擎校验 + 自测） |

### 项目状态

当前版本 v1.0.3，核心对弈流程已稳定，第一、二、三阶段（细节打磨与体验优化）已完成。

**已完成**：架构体检 + 公共逻辑去重 + 历史包袱清理；自动陪练与自由对弈独立悔棋路径；主界面重设计为“棋盘主舞台 + 右侧对局台 + 底部分析抽屉”；新增双棋手状态、吃子记录与窄窗单列布局；视觉切换为深墨外壳 + 暖木棋盘 + 统一木质棋子（朱砂字/墨字）；复盘降级提示明确化；杀法判定验证 + 动画残影修复 + 翻转一致性验证；将军/绝杀弹字与 `prefers-reduced-motion` 完整保留。

**下一步建议**：增强功能与新能力（需需求明确后再推进）。杀法判定有已知限制（天地炮覆盖重炮、卧槽马/钓鱼马等已定义未接入），属 xiangqi.ts 红线区域，需谨慎评估后再动。

### 不要动的地方

- `src/game/xiangqi.ts` — 象棋规则核心，已通过自测
- `src/game/fen.ts` / `src/game/notation.ts` — FEN 与记谱转换，逻辑稳定
- `src/game/bookGuide.ts` — 开局谱库，数据驱动，少改
- `engines/` — 引擎文件目录，构建时校验

### 目录职责

```
src/
  App.tsx                  主应用，信息层级编排
  main.tsx                 React 入口
  styles.css               全局样式（变量→shell→棋手条→棋盘→对局台→动画→响应式）
  books/                   开局 PGN 数据
  components/              纯展示组件（无业务状态）
    PlayerStrip.tsx        棋手身份、行棋状态与已吃棋子
  game/                    非 UI 的游戏逻辑
    xiangqi.ts             ★ 规则核心（稳定，已自测）
    fen.ts / notation.ts   ★ FEN 与记谱（稳定）
    moveUtils.ts           走法比较工具（稳定）
    bookGuide.ts           谱招引导（数据驱动，少改）
    ai.ts                  AI 难度配置 + 走子算法（高频变动）
    useXiangqiGame.ts      核心 hook，业务编排（高频变动）
  hooks/                   React 业务 hook
    useBoardAnimation.ts   走子/吃子/将军/绝杀动画
    useReview.ts           复盘
    useWindowControls.ts   窗口控制
electron/                  主进程 + 引擎桥接
```

**稳定基础**：`xiangqi.ts` / `fen.ts` / `notation.ts` / `moveUtils.ts` / `bookGuide.ts`
**高频变动**：`useXiangqiGame.ts` / `ai.ts` / `components/` / `hooks/` / `styles.css`

改一个功能时，先确认它落在哪一层，再动手。

### 技术栈

Electron 31 · React 19 · Vite 6 · TypeScript 6 · electron-builder
