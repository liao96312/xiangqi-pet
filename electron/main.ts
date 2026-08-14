import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PikafishBridge } from './engine/pikafish.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, '..');
const runtimeRoot = app.isPackaged ? process.resourcesPath : appRoot;
const preloadPath = path.join(appRoot, 'electron', 'preload.cjs');
const iconPath = app.isPackaged ? path.join(process.resourcesPath, 'icon.ico') : path.join(appRoot, 'build', 'icon.ico');
const qaCapturePath = readArgument('--qa-capture');
const qaTheme = readArgument('--qa-theme') === 'dusk' ? 'dusk' : 'overcast';
const qaSide = readArgument('--qa-side') === 'black' ? 'black' : 'red';
const qaViewArgument = readArgument('--qa-view');
const qaView = qaViewArgument === 'tactical' || qaViewArgument === 'overhead' || qaViewArgument === 'cinematic' || qaViewArgument === 'seat' ? qaViewArgument : 'seat';
const qaScenarioArgument = readArgument('--qa-scenario');
const qaScenario = qaScenarioArgument === 'dynamic' || qaScenarioArgument === 'fullgame' ? qaScenarioArgument : 'static';
const qaWidth = readPositiveIntegerArgument('--qa-width') ?? 1920;
const qaHeight = readPositiveIntegerArgument('--qa-height') ?? 1080;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let alwaysOnTop = false;
let isQuitting = false;
const analysisEngine = new PikafishBridge(runtimeRoot, { threads: 2, multiPv: 5, hashMb: 128 });
const playEngine = new PikafishBridge(runtimeRoot, { threads: 6, multiPv: 2, hashMb: 512 });

process.on('uncaughtException', (error) => {
  logCrash('uncaughtException', error);
  app.exit(1);
});
process.on('unhandledRejection', (reason) => logCrash('unhandledRejection', reason));

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });
}

function createWindow() {
  const savedBounds = readWindowState();
  mainWindow = new BrowserWindow({
    width: qaCapturePath ? qaWidth : savedBounds.width ?? 560,
    height: qaCapturePath ? qaHeight : savedBounds.height ?? 620,
    ...(!qaCapturePath && savedBounds.x != null && savedBounds.y != null ? { x: savedBounds.x, y: savedBounds.y } : {}),
    minWidth: 430,
    minHeight: 620,
    frame: qaCapturePath ? true : false,
    transparent: qaCapturePath ? false : true,
    resizable: true,
    hasShadow: true,
    alwaysOnTop,
    skipTaskbar: false,
    icon: iconPath,
    backgroundColor: qaCapturePath ? '#202020' : '#00000000',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  const query = qaCapturePath ? { qa3d: qaTheme, quality: 'high', side: qaSide, view: qaView, scenario: qaScenario } : undefined;
  if (devUrl) {
    const url = new URL(devUrl);
    if (query) Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
    mainWindow.loadURL(url.toString());
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'), { query });
  }

  if (qaCapturePath) {
    mainWindow.webContents.once('did-finish-load', () => {
      if (qaScenario === 'dynamic') void captureQaDynamicScenario(mainWindow!);
      else if (qaScenario === 'fullgame') void captureQaFullGameScenario(mainWindow!);
      else void captureQaFrame(mainWindow!);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.on('close', (event) => {
    saveWindowState();
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logCrash('render-process-gone', details);
  });
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logCrash('did-fail-load', { errorCode, errorDescription, validatedURL });
  });
}

function readWindowState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(windowStatePath(), 'utf8')) as Partial<Electron.Rectangle>;
    const width = typeof parsed.width === 'number' ? Math.max(430, parsed.width) : undefined;
    const height = typeof parsed.height === 'number' ? Math.max(620, parsed.height) : undefined;
    const x = typeof parsed.x === 'number' ? parsed.x : undefined;
    const y = typeof parsed.y === 'number' ? parsed.y : undefined;
    return x != null && y != null && isOnScreen({ x, y, width: width ?? 560, height: height ?? 860 }) ? { x, y, width, height } : { width, height };
  } catch {
    return {};
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    fs.writeFileSync(windowStatePath(), JSON.stringify(mainWindow.getBounds()));
  } catch {
    // Ignore storage errors; window restore is a convenience.
  }
}

function windowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function isOnScreen(bounds: Electron.Rectangle) {
  return screen.getAllDisplays().some(({ workArea }) => {
    return bounds.x < workArea.x + workArea.width && bounds.x + bounds.width > workArea.x && bounds.y < workArea.y + workArea.height && bounds.y + bounds.height > workArea.y;
  });
}

function createTray() {
  tray = new Tray(appIcon());
  tray.setToolTip('象棋桌宠');
  refreshTrayMenu();
  tray.on('click', () => toggleVisibility());
}

function appIcon() {
  const icon = nativeImage.createFromPath(iconPath);
  if (!icon.isEmpty()) return icon;
  return nativeImage.createFromDataURL(
    'data:image/svg+xml;utf8,' +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#202020"/><text x="16" y="22" font-size="18" text-anchor="middle" fill="#f7d18b">棋</text></svg>')
  );
}

function refreshTrayMenu() {
  tray?.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示/隐藏', click: () => toggleVisibility() },
      { label: '置顶', type: 'checkbox', checked: alwaysOnTop, click: () => setAlwaysOnTop(!alwaysOnTop) },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
}

function toggleVisibility() {
  if (!mainWindow) {
    createWindow();
    showWindow();
    return;
  }
  if (mainWindow.isVisible()) {
    saveWindowState();
    mainWindow.hide();
  } else {
    showWindow();
  }
}

function showWindow() {
  if (!mainWindow) createWindow();
  mainWindow?.show();
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.focus();
}

function setAlwaysOnTop(nextValue: boolean) {
  alwaysOnTop = nextValue;
  mainWindow?.setAlwaysOnTop(alwaysOnTop, 'floating');
  refreshTrayMenu();
}

if (gotSingleInstanceLock) app.whenReady().then(() => {
  void playEngine.warmup();
  createWindow();
  if (!qaCapturePath) createTray();

  app.on('child-process-gone', (_event, details) => {
    logCrash('child-process-gone', details);
  });

  ipcMain.handle('window:minimize', () => {
    saveWindowState();
    mainWindow?.hide();
  });
  ipcMain.handle('window:hide', () => {
    saveWindowState();
    mainWindow?.hide();
  });
  ipcMain.handle('window:close', () => {
    saveWindowState();
    isQuitting = true;
    app.quit();
  });
  ipcMain.handle('window:toggle-always-on-top', () => {
    setAlwaysOnTop(!alwaysOnTop);
    return alwaysOnTop;
  });
  ipcMain.handle('window:get-always-on-top', () => alwaysOnTop);
  ipcMain.handle('engine:status', () => ({ available: analysisEngine.isAvailable() || playEngine.isAvailable() }));
  ipcMain.handle('engine:analyze', (_event, input: { fen: string; movetime?: number }) => analysisEngine.analyze(input));
  ipcMain.handle('engine:play-analyze', (_event, input: { fen: string; movetime?: number }) => playEngine.analyze(input));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (isQuitting) app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  saveWindowState();
  analysisEngine.stop();
  playEngine.stop();
});

function logCrash(type: string, detail: unknown) {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'main.log'), `[${new Date().toISOString()}] ${type} ${formatLogDetail(detail)}\n`);
  } catch {
    // Logging must never crash the app.
  }
}

function formatLogDetail(detail: unknown) {
  if (detail instanceof Error) return `${detail.stack ?? detail.message}`;
  if (typeof detail === 'string') return detail;
  return JSON.stringify(detail);
}

function readArgument(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function readPositiveIntegerArgument(name: string) {
  const parsed = Number.parseInt(readArgument(name) ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function captureQaFrame(window: BrowserWindow) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 12000));
    const diagnostics = await window.webContents.executeJavaScript(`(() => {
      const canvas = document.querySelector('.board-3d-canvas canvas');
      const gl = canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'));
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return {
        mode3d: Boolean(document.querySelector('.board-wrap-3d')),
        canvas: canvas ? [canvas.width, canvas.height] : null,
        viewport: [window.innerWidth, window.innerHeight],
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl ? gl.getParameter(gl.RENDERER) : null,
        theme: new URLSearchParams(location.search).get('qa3d'),
        side: new URLSearchParams(location.search).get('side'),
        view: new URLSearchParams(location.search).get('view')
      };
    })()`);
    const image = await window.webContents.capturePage();
    fs.mkdirSync(path.dirname(qaCapturePath!), { recursive: true });
    fs.writeFileSync(qaCapturePath!, image.toPNG());
    fs.writeFileSync(`${qaCapturePath}.json`, JSON.stringify(diagnostics, null, 2));
    isQuitting = true;
    app.quit();
  } catch (error) {
    logCrash('qa-capture-failed', error);
    app.exit(2);
  }
}

type QaStep = {
  name: string;
  screenshot: string;
  diagnostics: Record<string, unknown>;
};

async function captureQaDynamicScenario(window: BrowserWindow) {
  const steps: QaStep[] = [];
  const basePath = qaCapturePath!.replace(/\.png$/i, '');

  try {
    await delay(12000);

    async function evaluate(script: string) {
      return window.webContents.executeJavaScript(`(() => { ${script} })()`);
    }

    async function clickButton(text: string, title?: string) {
      const result = await evaluate(`
        const buttons = [...document.querySelectorAll('button')];
        const button = buttons.find((candidate) => {
          const textMatches = candidate.textContent?.replace(/\\s+/g, '') === ${JSON.stringify(text.replace(/\s+/g, ''))};
          const titleMatches = ${JSON.stringify(title ?? '')} && candidate.getAttribute('title') === ${JSON.stringify(title ?? '')};
          return titleMatches || textMatches;
        });
        if (!button) return { ok: false, reason: 'button-not-found', text: ${JSON.stringify(text)} };
        button.click();
        return { ok: true, disabled: button.disabled };
      `);
      if (!result.ok || result.disabled) throw new Error(`QA button failed: ${text}: ${JSON.stringify(result)}`);
    }

    async function clickSquare(side: '红' | '黑' | '空', piece: string, file: number, rank: number) {
      const prefix = side === '空' ? '空位' : `${side}${piece}`;
      const label = `${prefix}，第 ${file} 路第 ${rank} 线`;
      const result = await evaluate(`
        const button = [...document.querySelectorAll('.board3d-a11y-grid button')]
          .find((candidate) => candidate.getAttribute('aria-label') === ${JSON.stringify(label)});
        if (!button) return { ok: false, labels: [...document.querySelectorAll('.board3d-a11y-grid button')].map((item) => item.getAttribute('aria-label')).filter((item) => item?.includes('第 ${file} 路')) };
        button.click();
        return { ok: true };
      `);
      if (!result.ok) throw new Error(`QA square failed: ${label}: ${JSON.stringify(result)}`);
      await delay(80);
    }

    async function waitForSquare(side: '红' | '黑' | '空', piece: string, file: number, rank: number) {
      const prefix = side === '空' ? '空位' : `${side}${piece}`;
      const label = `${prefix}，第 ${file} 路第 ${rank} 线`;
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        const found = await evaluate(`
          return [...document.querySelectorAll('.board3d-a11y-grid button')]
            .some((candidate) => candidate.getAttribute('aria-label') === ${JSON.stringify(label)});
        `);
        if (found) return;
        await delay(100);
      }
      throw new Error(`QA state timeout: ${label}`);
    }

    async function clickCanvasSquare(file: number, rank: number) {
      const key = `${rank - 1}-${file - 1}`;
      const deadline = Date.now() + 5000;
      let point = null;
      while (Date.now() < deadline && !point) {
        point = await evaluate(`
          const canvas = document.querySelector('.board-3d-canvas canvas');
          const projection = canvas?.dataset.qaBoardProjection ? JSON.parse(canvas.dataset.qaBoardProjection) : null;
          return canvas && canvas.clientWidth > 400 ? projection?.[${JSON.stringify(key)}] ?? null : null;
        `);
        if (!point) await delay(100);
      }
      if (!point) throw new Error(`QA projection unavailable: ${file},${rank}`);
      const [x, y] = point.map((value: number) => Math.round(value));
      window.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
      window.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
      await delay(100);
    }

    async function waitForHistoryLength(expected: number) {
      const deadline = Date.now() + 12000;
      while (Date.now() < deadline) {
        const length = await evaluate(`return Number(document.querySelector('main')?.getAttribute('data-history-length') || 0);`);
        if (length >= expected) return;
        await delay(120);
      }
      throw new Error(`QA history timeout: expected ${expected}`);
    }

    async function capture(name: string) {
      const screenshot = `${basePath}.${String(steps.length + 1).padStart(2, '0')}-${name}.png`;
      const diagnostics = await collectQaDiagnostics(window);
      const image = await window.webContents.capturePage();
      fs.mkdirSync(path.dirname(screenshot), { recursive: true });
      fs.writeFileSync(screenshot, image.toPNG());
      steps.push({ name, screenshot, diagnostics });
    }

    await capture('initial');

    const autoAiEnabled = await evaluate(`
      const button = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes('自动陪练'));
      return button?.textContent?.includes('开启') ?? false;
    `);
    if (autoAiEnabled) await clickButton('自动陪练开启');

    await clickCanvasSquare(1, 7);
    await clickCanvasSquare(1, 6);
    await waitForSquare('红', '兵', 1, 6);
    await delay(350);
    await capture('red-move');

    await clickSquare('黑', '卒', 1, 4);
    await clickSquare('空', '', 1, 5);
    await waitForSquare('黑', '卒', 1, 5);
    await delay(350);
    await capture('black-move');

    await clickSquare('红', '兵', 1, 6);
    await clickSquare('黑', '卒', 1, 5);
    await waitForSquare('红', '兵', 1, 5);
    await delay(750);
    await capture('capture');

    await clickButton('翻转180°');
    await delay(700);
    await capture('flipped');

    await clickButton('俯视');
    await delay(700);
    await capture('overhead');

    await clickButton('电影');
    await delay(700);
    await capture('cinematic');

    await clickButton('黑方席位');
    await delay(700);
    const bounds = await evaluate(`
      const canvas = document.querySelector('.board-3d-canvas canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    `);
    if (!bounds) throw new Error('QA canvas bounds unavailable');
    const centerX = Math.round(bounds.x + bounds.width * 0.52);
    const centerY = Math.round(bounds.y + bounds.height * 0.48);
    window.webContents.sendInputEvent({ type: 'mouseDown', x: centerX, y: centerY, button: 'left', clickCount: 1 });
    window.webContents.sendInputEvent({ type: 'mouseMove', x: centerX + 90, y: centerY - 45, movementX: 90, movementY: -45 });
    window.webContents.sendInputEvent({ type: 'mouseUp', x: centerX + 90, y: centerY - 45, button: 'left', clickCount: 1 });
    window.webContents.sendInputEvent({ type: 'mouseWheel', x: centerX, y: centerY, deltaY: -160, deltaX: 0, canScroll: true });
    await delay(700);
    await capture('orbit-zoom');

    window.setSize(1366, 768);
    await delay(900);
    await capture('resized-1366x768');

    await clickButton('悔棋', '悔棋');
    await delay(700);
    await capture('undo');

    await clickButton('新局', '重新开局');
    await delay(700);
    await capture('reset');

    await clickButton('自动陪练关闭');
    await delay(180);
    await clickSquare('红', '炮', 8, 8);
    await clickSquare('空', '', 5, 8);
    await waitForHistoryLength(2);
    await delay(450);
    await capture('ai-response');

    const report = {
      scenario: 'dynamic',
      generatedAt: new Date().toISOString(),
      passed: steps.length === 12,
      steps
    };
    fs.writeFileSync(`${basePath}.json`, JSON.stringify(report, null, 2));
    isQuitting = true;
    app.quit();
  } catch (error) {
    fs.mkdirSync(path.dirname(basePath), { recursive: true });
    fs.writeFileSync(`${basePath}.json`, JSON.stringify({
      scenario: 'dynamic',
      generatedAt: new Date().toISOString(),
      passed: false,
      error: formatLogDetail(error),
      steps
    }, null, 2));
    logCrash('qa-dynamic-capture-failed', error);
    app.exit(2);
  }
}

async function collectQaDiagnostics(window: BrowserWindow) {
  return window.webContents.executeJavaScript(`(() => {
    const root = document.querySelector('.board-wrap-3d');
    const canvas = document.querySelector('.board-3d-canvas canvas');
    const gl = canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'));
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const occupied = [...document.querySelectorAll('.board3d-a11y-grid button')]
      .map((button) => button.getAttribute('aria-label'))
      .filter((label) => label && !label.startsWith('空位'));
    return {
      mode3d: Boolean(root),
      canvas: canvas ? [canvas.width, canvas.height] : null,
      viewport: [innerWidth, innerHeight],
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl ? gl.getParameter(gl.RENDERER) : null,
      view: root?.getAttribute('data-view') ?? null,
      flipped: root?.getAttribute('data-flipped') ?? null,
      quality: root?.getAttribute('data-quality') ?? null,
      theme: root?.getAttribute('data-theme') ?? null,
      occupiedCount: occupied.length,
      occupied
    };
  })()`);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const QA_FULL_GAME_MOVES = [
  [7, 1, 0, 1], [2, 7, 9, 7], [9, 8, 9, 7], [0, 0, 0, 1], [9, 0, 8, 0],
  [2, 1, 5, 1], [6, 2, 5, 2], [0, 6, 2, 4], [6, 6, 5, 6], [0, 1, 3, 1],
  [7, 7, 7, 2], [5, 1, 5, 6], [9, 7, 0, 7], [0, 8, 0, 7], [9, 6, 7, 4],
  [3, 1, 9, 1], [7, 4, 5, 6], [9, 1, 9, 2], [8, 0, 8, 4], [9, 2, 9, 3],
  [9, 4, 9, 3], [0, 7, 8, 7], [7, 2, 3, 2], [8, 7, 8, 4], [9, 5, 8, 4],
  [3, 4, 4, 4], [3, 2, 3, 5], [2, 4, 4, 2], [5, 2, 4, 2], [3, 0, 4, 0],
  [3, 5, 6, 5], [3, 8, 4, 8], [8, 4, 9, 5], [4, 8, 5, 8], [6, 5, 4, 5],
  [5, 8, 6, 8], [4, 5, 4, 7], [0, 3, 1, 4], [4, 7, 0, 7]
] as const;

async function captureQaFullGameScenario(window: BrowserWindow) {
  const basePath = qaCapturePath!.replace(/\.png$/i, '');
  const checkpoints: Array<{ ply: number; screenshot: string; diagnostics: Record<string, unknown> }> = [];
  try {
    await delay(12000);
    for (let index = 0; index < QA_FULL_GAME_MOVES.length; index += 1) {
      const [fromRow, fromCol, toRow, toCol] = QA_FULL_GAME_MOVES[index];
      const before = await window.webContents.executeJavaScript(`document.querySelector('.board3d-a11y-grid button:nth-child(${fromRow * 9 + fromCol + 1})')?.getAttribute('aria-label')`);
      if (!before || before.startsWith('空位')) throw new Error(`Full-game source missing at ply ${index + 1}: ${before}`);
      for (const cellIndex of [fromRow * 9 + fromCol + 1, toRow * 9 + toCol + 1]) {
        await window.webContents.executeJavaScript(`document.querySelector('.board3d-a11y-grid button:nth-child(${cellIndex})')?.click()`);
        await delay(80);
      }
      const deadline = Date.now() + 4000;
      let moved = false;
      while (Date.now() < deadline) {
        const source = await window.webContents.executeJavaScript(`document.querySelector('.board3d-a11y-grid button:nth-child(${fromRow * 9 + fromCol + 1})')?.getAttribute('aria-label')`);
        if (source?.startsWith('空位')) { moved = true; break; }
        await delay(100);
      }
      if (!moved) throw new Error(`Full-game move did not commit at ply ${index + 1}`);
      await delay(120);
      if ([10, 20, 30, 39].includes(index + 1)) {
        const screenshot = `${basePath}.ply-${String(index + 1).padStart(2, '0')}.png`;
        const image = await window.webContents.capturePage();
        fs.writeFileSync(screenshot, image.toPNG());
        checkpoints.push({ ply: index + 1, screenshot, diagnostics: await collectQaDiagnostics(window) });
      }
    }
    await delay(1200);
    const outcome = await window.webContents.executeJavaScript(`(() => ({
      winner: document.querySelector('main')?.getAttribute('data-winner') || null,
      historyLength: Number(document.querySelector('main')?.getAttribute('data-history-length') || 0),
      result: document.querySelector('.result-banner')?.textContent?.replace(/\\s+/g, ' ').trim() || null
    }))()`);
    const report = { scenario: 'fullgame', generatedAt: new Date().toISOString(), passed: outcome.winner === 'red' && outcome.historyLength === 39, outcome, checkpoints };
    fs.writeFileSync(`${basePath}.json`, JSON.stringify(report, null, 2));
    if (!report.passed) throw new Error(`Full-game outcome mismatch: ${JSON.stringify(outcome)}`);
    isQuitting = true;
    app.quit();
  } catch (error) {
    fs.writeFileSync(`${basePath}.json`, JSON.stringify({ scenario: 'fullgame', generatedAt: new Date().toISOString(), passed: false, error: formatLogDetail(error), checkpoints }, null, 2));
    logCrash('qa-fullgame-capture-failed', error);
    app.exit(2);
  }
}
