import { useEffect, useState, useCallback } from 'react';

/**
 * Hook to request Screen Wake Lock API on mobile browsers,
 * preventing screen turn-off during active gameplay.
 */
export function useWakeLock() {
  const [isLocked, setIsLocked] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('wakeLock' in navigator);
  }, []);

  const requestLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return false;

    try {
      const wakeLock = await (navigator as any).wakeLock.request('screen');
      setIsLocked(true);

      wakeLock.addEventListener('release', () => {
        setIsLocked(false);
      });

      return true;
    } catch (err) {
      console.warn('Wake Lock request error:', err);
      return false;
    }
  }, []);

  return { isLocked, isSupported, requestLock };
}
