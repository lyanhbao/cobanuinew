'use client';

import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export default function GlassCard({ children, className, glow = false }: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border glass-card',
        glow && 'glass-glow',
        className
      )}
    >
      {children}
    </div>
  );
}
