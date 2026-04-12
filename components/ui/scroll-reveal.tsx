'use client';

import { forwardRef } from 'react';
import { useScrollReveal } from '@/lib/use-scroll-reveal';

export interface ScrollRevealProps {
  children: React.ReactNode;
  /** Delay in ms before animation starts */
  delay?: number;
  /** Additional CSS classes */
  className?: string;
  /** Direction: 'up' (default), 'down', 'left', 'right' */
  direction?: 'up' | 'down' | 'left' | 'right';
  /** Threshold passed to IntersectionObserver */
  threshold?: number;
}

/**
 * Wrapper that fades + translates its children into view when they scroll
 * into the viewport. Renders a div and passes the ref.
 */
export const ScrollReveal = forwardRef<HTMLDivElement, ScrollRevealProps>(
  ({ children, delay = 0, className = '', direction = 'up', threshold }, fwdRef) => {
    const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ threshold, delay });

    // Merge forwarded ref with internal ref
    const combinedRef = (el: HTMLDivElement | null) => {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
      if (typeof fwdRef === 'function') {
        fwdRef(el);
      } else if (fwdRef) {
        (fwdRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }
    };

    const translateMap = {
      up: 'translate-y-0',
      down: 'translate-y-0',
      left: 'translate-x-0',
      right: 'translate-x-0',
    };

    const fromMap = {
      up: 'translate-y-6',
      down: '-translate-y-6',
      left: '-translate-x-6',
      right: 'translate-x-6',
    };

    return (
      <div
        ref={combinedRef}
        className={`transition-all duration-500 ease-out ${className}`}
        style={{
          transitionDelay: delay ? `${delay}ms` : undefined,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? translateMap[direction] : fromMap[direction],
        }}
      >
        {children}
      </div>
    );
  },
);

ScrollReveal.displayName = 'ScrollReveal';
