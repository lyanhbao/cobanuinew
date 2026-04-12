'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';

interface UseDashboardDataOptions {
  /** Refresh when these extra deps change */
  deps?: unknown[];
}

export function useDashboardData<T>(
  endpoint: string,
  options: UseDashboardDataOptions = {},
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const { groupId, selectedWeek, isReady } = useApp();
  const { fetchWithAuth } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const deps = options.deps ?? [];

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!groupId || !isReady) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const url = `/api/dashboard/${groupId}/${endpoint}`;
    fetchWithAuth(url)
      .then((r) => r.json())
      .then((d) => {
        // Handle both wrapped { success, data } and unwrapped { week, ... } responses
        if (d.success !== undefined) {
          if (d.success) {
            setData(d.data);
          } else {
            setError(d.error ?? 'Failed to load data');
          }
        } else {
          // Unwrapped response — use the whole object as data
          setData(d);
        }
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, selectedWeek, isReady, endpoint, tick, ...deps]);

  return { data, loading, error, refetch };
}
