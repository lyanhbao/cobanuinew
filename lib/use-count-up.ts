'use client';

import { useCallback, useRef, useState } from 'react';

export interface UseCountUpOptions {
  /** Animation duration in ms. Default 1000 */
  duration?: number;
  /** Number of decimal places. Default 0 */
  decimals?: number;
  /** Easing type: 'cubic' uses cubic ease-out, 'quad' uses quadratic. Default 'cubic' */
  easing?: 'cubic' | 'quad';
}

/**
 * Animates a number from 0 to `target` over `duration` ms using
 * requestAnimationFrame with configurable easing.
 *
 * Returns `{ value, start }` — call `start()` to begin the animation.
 * Safe to call multiple times (guards against re-running).
 *
 * @example
 * const { value, start } = useCountUp(5000, { duration: 1200, decimals: 1 });
 * // When start() is called, value will animate from 0 → 5000 over 1200ms
 */
export function useCountUp(
  target: number,
  options: UseCountUpOptions = {},
) {
  const { duration = 1000, decimals = 0, easing = 'cubic' } = options;

  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hasRunRef = useRef(false);

  const start = useCallback(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;
    startTimeRef.current = null;

    const step = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic: 1 - (1 - t)^3
      const eased = easing === 'cubic'
        ? 1 - Math.pow(1 - progress, 3)
        : 1 - Math.pow(1 - progress, 2);

      const current = eased * target;
      setValue(decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.floor(current));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setValue(target);
      }
    };

    rafRef.current = requestAnimationFrame(step);
  }, [target, duration, decimals, easing]);

  return { value, start };
}
