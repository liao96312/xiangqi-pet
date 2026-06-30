const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xiangqiPet', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  hide: () => ipcRenderer.invoke('window:hide'),
  close: () => ipcRenderer.invoke('window:close'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggle-always-on-top'),
  getAlwaysOnTop: () => ipcRenderer.invoke('window:get-always-on-top'),
  engineStatus: () => ipcRenderer.invoke('engine:status'),
  analyze: (input) => ipcRenderer.invoke('engine:analyze', input),
  playAnalyze: (input) => ipcRenderer.invoke('engine:play-analyze', input)
});
