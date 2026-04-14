'use client';

import { useEffect, useRef } from 'react';

/**
 * Attaches IntersectionObserver to a container ref.
 * All elements with className containing "dashboard-reveal" inside the container
 * will get "is-visible" appended when they scroll into view.
 * Works with "stagger-children" and "dashboard-reveal" / "dashboard-reveal-left".
 */
export function useScrollReveal(containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const elements = container.querySelectorAll<HTMLElement>(
      '.dashboard-reveal, .dashboard-reveal-left, .stagger-children'
    );

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [containerRef]);
}
