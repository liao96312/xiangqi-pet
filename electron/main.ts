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
const gotSingleInstanceLock = app.requestSingleInstanceLock();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let alwaysOnTop = false;
let isQuitting = false;
const analysisEngine = new PikafishBridge(runtimeRoot);
const playEngine = new PikafishBridge(runtimeRoot);

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
    width: savedBounds.width ?? 560,
    height: savedBounds.height ?? 860,
    ...(savedBounds.x != null && savedBounds.y != null ? { x: savedBounds.x, y: savedBounds.y } : {}),
    minWidth: 430,
    minHeight: 620,
    frame: false,
    transparent: true,
    resizable: true,
    hasShadow: true,
    alwaysOnTop,
    skipTaskbar: false,
    icon: iconPath,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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
  createWindow();
  createTray();

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
