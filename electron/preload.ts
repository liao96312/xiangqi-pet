import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('xiangqiPet', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  hide: () => ipcRenderer.invoke('window:hide'),
  close: () => ipcRenderer.invoke('window:close'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggle-always-on-top') as Promise<boolean>,
  getAlwaysOnTop: () => ipcRenderer.invoke('window:get-always-on-top') as Promise<boolean>,
  engineStatus: () => ipcRenderer.invoke('engine:status') as Promise<{ available: boolean }>,
  analyze: (input: { fen: string; movetime?: number }) =>
    ipcRenderer.invoke('engine:analyze', input) as Promise<{
      ok: boolean;
      engine: 'pikafish' | 'none';
      bestMove?: string;
      scoreCp?: number;
      mate?: number;
      pv?: string[];
      depth?: number;
      error?: string;
    }>,
  playAnalyze: (input: { fen: string; movetime?: number }) =>
    ipcRenderer.invoke('engine:play-analyze', input) as Promise<{
      ok: boolean;
      engine: 'pikafish' | 'none';
      bestMove?: string;
      scoreCp?: number;
      mate?: number;
      pv?: string[];
      depth?: number;
      error?: string;
    }>
});
