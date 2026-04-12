'use client';

import { useCallback, useRef, useState } from 'react';

export interface SpotlightState {
  /** X position as a percentage (0–100) */
  x: number;
  /** Y position as a percentage (0–100) */
  y: number;
}

/**
 * Tracks the mouse cursor position relative to a container element,
 * returning percentage values suitable for CSS custom properties.
 *
 * @example
 * const { ref, state, containerProps } = useSpotlight();
 *
 * <div ref={ref} {...containerProps} className="spotlight-container">
 *   Hover me
 * </div>
 */
export function useSpotlight() {
  const [state, setState] = useState<SpotlightState>({ x: 50, y: 50 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    setState({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setState({ x: 50, y: 50 });
  }, []);

  const containerProps = {
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    style: {
      '--mouse-x': `${state.x}%`,
      '--mouse-y': `${state.y}%`,
    } as React.CSSProperties,
  };

  return {
    ref,
    state,
    containerProps,
  };
}
