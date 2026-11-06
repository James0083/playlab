import { useCallback } from 'react';

/** navigator.vibrate 래퍼. 미지원 환경(iOS Safari 등)에서는 아무 동작도 하지 않는다. */
export function useHaptics() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  }, []);
  return { vibrate };
}
