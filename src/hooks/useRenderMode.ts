import { useEffect, useState } from 'react';
import type { WebGLStatus } from './useWebGLSupport';

export type RenderMode = '2d' | '3d';

const RENDER_MODE_KEY = 'xiangqi-pet-render-mode';

function readSavedRenderMode(): RenderMode {
  if (new URLSearchParams(window.location.search).has('qa3d')) return '3d';
  try {
    return window.localStorage.getItem(RENDER_MODE_KEY) === '3d' ? '3d' : '2d';
  } catch {
    return '2d';
  }
}

export function useRenderMode(webglStatus: WebGLStatus) {
  const [renderMode, setRenderMode] = useState<RenderMode>(readSavedRenderMode);

  useEffect(() => {
    if (webglStatus === 'unavailable' && renderMode === '3d') {
      setRenderMode('2d');
    }
  }, [renderMode, webglStatus]);

  useEffect(() => {
    try {
      window.localStorage.setItem(RENDER_MODE_KEY, renderMode);
    } catch {
      // Ignore disabled storage.
    }
  }, [renderMode]);

  return { renderMode, setRenderMode };
}
