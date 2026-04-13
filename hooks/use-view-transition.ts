'use client';

import { useCallback, useRef } from 'react';

/**
 * Hook wrapping document.startViewTransition for smooth tab navigation.
 * Falls back gracefully when the API is unavailable (older browsers,
 * or when the user has reduced-motion preference).
 */
export function useViewTransition() {
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  const transitionTo = useCallback(
    (callback: () => void | Promise<void>) => {
      if (!('startViewTransition' in document) || prefersReducedMotion.current) {
        // Fallback: just run the callback (no animation)
        callback();
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).startViewTransition(() => {
        callback();
      });
    },
    []
  );

  return { transitionTo };
}