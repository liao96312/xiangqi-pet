import { useEffect, useState } from 'react';

export type WebGLStatus = 'checking' | 'available' | 'unavailable';

export function useWebGLSupport() {
  const [status, setStatus] = useState<WebGLStatus>('checking');

  useEffect(() => {
    const canvas = document.createElement('canvas');
    let available = false;

    try {
      available = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch {
      available = false;
    }

    setStatus(available ? 'available' : 'unavailable');
  }, []);

  return status;
}
