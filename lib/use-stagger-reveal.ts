'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseStaggerRevealOptions {
  /** IntersectionObserver threshold (0–1). Default 0.1 */
  threshold?: number;
  /** Root margin. Default '0px 0px -50px 0px' */
  rootMargin?: string;
  /** Stagger delay per child in ms. Default 60 */
  staggerDelay?: number;
  /** Max stagger children to animate. Default 12 */
  maxChildren?: number;
}

/**
 * Manages staggered IntersectionObserver reveal for an array of child elements.
 *
 * Returns `{ ref, isVisible }` — attach `ref` to the parent container.
 * Children receive `isVisible` to trigger their stagger animation.
 *
 * @example
 * const { ref, isVisible } = useStaggerReveal({ staggerDelay: 80 });
 *
 * <div ref={ref} className={isVisible ? 'stagger-children is-visible' : 'stagger-children'}>
 *   {items.map(item => <div key={item.id}>{item.name}</div>)}
 * </div>
 */
export function useStaggerReveal<T extends HTMLElement = HTMLDivElement>(
  options: UseStaggerRevealOptions = {},
) {
  const {
    threshold = 0.1,
    rootMargin = '0px 0px -50px 0px',
    staggerDelay = 60,
    maxChildren = 12,
  } = options;

  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  /**
   * Returns transition style for a child at a given index.
   * Applies stagger delay and respects maxChildren.
   */
  const childStyle = useCallback(
    (index: number): React.CSSProperties => {
      if (!isVisible) {
        return { opacity: 0, transform: 'translateY(10px)' };
      }
      const delay = Math.min(index, maxChildren - 1) * staggerDelay;
      return {
        opacity: 1,
        transform: 'translateY(0)',
        transition: `opacity 0.4s ease-out ${delay}ms, transform 0.4s ease-out ${delay}ms`,
      };
    },
    [isVisible, staggerDelay, maxChildren],
  );

  /**
   * Returns class names for a container that uses the stagger-children pattern.
   */
  const containerClassName = isVisible
    ? 'stagger-children is-visible'
    : 'stagger-children';

  return {
    ref,
    isVisible,
    childStyle,
    containerClassName,
    staggerDelay,
  };
}
