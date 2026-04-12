'use client';

import { useEffect, useRef, useState } from 'react';

export interface UseScrollRevealOptions {
  /** IntersectionObserver threshold (0–1). Default 0.15 */
  threshold?: number;
  /** Root margin passed to IntersectionObserver. Default '0px 0px -50px 0px' */
  rootMargin?: string;
  /** Once revealed, stay visible. Default true */
  once?: boolean;
  /** Delay in ms before starting animation. Default 0 */
  delay?: number;
}

/**
 * Fires `isVisible = true` when the element scrolls into the viewport.
 * Mirrors the IntersectionObserver pattern used in features-section.tsx.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollRevealOptions = {},
) {
  const { threshold = 0.15, rootMargin = '0px 0px -50px 0px', once = true, delay = 0 } = options;

  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once, delay]);

  return { ref, isVisible };
}

/**
 * Fires `isVisible = true` when any of the tracked elements scrolls into view.
 * Returns a single `isVisible` — use `ref` to attach to the outer container.
 */
export function useMultiScrollReveal<T extends HTMLElement = HTMLDivElement>(
  itemCount: number,
  options: UseScrollRevealOptions = {},
) {
  const { threshold = 0.1, rootMargin = '0px 0px -40px 0px', once = true, delay = 0 } = options;

  const containerRef = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.disconnect();
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once, delay]);

  return { containerRef, isVisible };
}
