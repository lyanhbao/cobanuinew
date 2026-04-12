'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Animates a number from 0 to `target` over `duration` ms using
 * requestAnimationFrame, easing out quadratically.
 *
 * @param target   Final numeric value
 * @param duration Animation duration in ms (default 1000)
 * @param decimals Number of decimal places to show (default 0)
 */
export function useCounter(
  target: number,
  duration: number = 1000,
  decimals: number = 0,
): { value: number; start: () => void; isAnimating: boolean } {
  const [value, setValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hasRunRef = useRef(false);

  const start = useCallback(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;
    setIsAnimating(true);
    startTimeRef.current = null;

    const step = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out quad: 1 - (1 - t)^2
      const eased = 1 - Math.pow(1 - progress, 2);
      const current = eased * target;

      setValue(decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.floor(current));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setValue(target);
        setIsAnimating(false);
      }
    };

    rafRef.current = requestAnimationFrame(step);
  }, [target, duration, decimals]);

  return { value, start, isAnimating };
}
