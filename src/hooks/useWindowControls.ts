import { useCallback, useEffect, useState } from 'react';

export function useWindowControls() {
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [windowError, setWindowError] = useState('');

  useEffect(() => {
    window.xiangqiPet?.getAlwaysOnTop().then(setAlwaysOnTop).catch(() => {});
  }, []);

  const togglePin = useCallback(async () => {
    try {
      const next = await window.xiangqiPet?.toggleAlwaysOnTop();
      if (typeof next === 'boolean') setAlwaysOnTop(next);
      setWindowError('');
    } catch {
      setWindowError('窗口控制失败');
    }
  }, []);

  const runWindowAction = useCallback(async (action: 'minimize' | 'hide' | 'close') => {
    try {
      const api = window.xiangqiPet;
      if (!api) throw new Error('missing preload');
      await api[action]();
      setWindowError('');
    } catch {
      setWindowError('窗口控制失败');
    }
  }, []);

  return { alwaysOnTop, windowError, togglePin, runWindowAction };
}
