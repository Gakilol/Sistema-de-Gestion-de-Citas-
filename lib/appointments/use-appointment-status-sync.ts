'use client';

import { useEffect, useRef } from 'react';
import { authFetch } from '@/lib/api-client';

interface StatusSyncResult {
  updated?: number;
}

export function useAppointmentStatusSync(
  enabled: boolean,
  onUpdated?: (updated: number) => void | Promise<void>
) {
  const callbackRef = useRef(onUpdated);
  const runningRef = useRef(false);

  useEffect(() => {
    callbackRef.current = onUpdated;
  }, [onUpdated]);

  useEffect(() => {
    if (!enabled) return;

    const sync = async () => {
      if (runningRef.current || document.visibilityState === 'hidden') return;
      runningRef.current = true;
      try {
        const response = await authFetch('/api/gestion/citas/sincronizar-estados', {
          method: 'POST',
          cache: 'no-store',
        });
        if (!response.ok) return;
        const result = await response.json() as StatusSyncResult;
        if ((result.updated ?? 0) > 0) {
          await callbackRef.current?.(result.updated ?? 0);
        }
      } catch (error) {
        console.error('[APPOINTMENT_STATUS_HEARTBEAT_ERROR]', error);
      } finally {
        runningRef.current = false;
      }
    };

    void sync();
    const intervalId = window.setInterval(sync, 60_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled]);
}
