/// <reference types="vite/client" />

interface Window {
  xiangqiPet?: {
    minimize: () => Promise<void>;
    hide: () => Promise<void>;
    close: () => Promise<void>;
    toggleAlwaysOnTop: () => Promise<boolean>;
    getAlwaysOnTop: () => Promise<boolean>;
    engineStatus: () => Promise<{ available: boolean }>;
    analyze: (input: { fen: string; moves?: string[]; movetime?: number }) => Promise<{
      ok: boolean;
      engine: 'pikafish' | 'none';
      bestMove?: string;
      candidates?: string[];
      scoreCp?: number;
      mate?: number;
      pv?: string[];
      depth?: number;
      error?: string;
    }>;
    playAnalyze: (input: { fen: string; moves?: string[]; movetime?: number }) => Promise<{
      ok: boolean;
      engine: 'pikafish' | 'none';
      bestMove?: string;
      candidates?: string[];
      scoreCp?: number;
      mate?: number;
      pv?: string[];
      depth?: number;
      error?: string;
    }>;
  };
}
