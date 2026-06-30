import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PikafishBridge } from './engine/pikafish.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, '..');
const preloadPath = path.join(appRoot, 'electron', 'preload.cjs');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let alwaysOnTop = false;
let isQuitting = false;
const analysisEngine = new PikafishBridge(appRoot);
const playEngine = new PikafishBridge(appRoot);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 430,
    height: 620,
    minWidth: 260,
    minHeight: 300,
    frame: false,
    transparent: true,
    resizable: true,
    hasShadow: true,
    alwaysOnTop,
    skipTaskbar: false,
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
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#202020"/><text x="16" y="22" font-size="18" text-anchor="middle" fill="#f7d18b">棋</text></svg>'
      )
  );
  tray = new Tray(icon);
  tray.setToolTip('象棋桌宠');
  tray.setContextMenu(
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
  tray.on('click', () => toggleVisibility());
}

function toggleVisibility() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function setAlwaysOnTop(nextValue: boolean) {
  alwaysOnTop = nextValue;
  mainWindow?.setAlwaysOnTop(alwaysOnTop, 'floating');
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:hide', () => mainWindow?.hide());
  ipcMain.handle('window:close', () => {
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

app.on('before-quit', () => {
  isQuitting = true;
  analysisEngine.stop();
  playEngine.stop();
});
