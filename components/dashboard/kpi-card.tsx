'use client';

import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface KPICardProps {
  label: string;
  value: string | number;
  formatted?: string;
  change?: number;
  changeType?: 'up' | 'down' | 'neutral';
  icon?: LucideIcon;
  color?: string;
  gradient?: boolean;
  className?: string;
}

export function KPICard({
  label,
  value,
  formatted,
  change,
  changeType = 'neutral',
  icon: Icon,
  color,
  gradient = false,
  className,
}: KPICardProps) {
  const TrendIcon =
    changeType === 'up'
      ? TrendingUp
      : changeType === 'down'
        ? TrendingDown
        : Minus;

  const trendColorClass =
    changeType === 'up'
      ? 'text-green-600 dark:text-green-400'
      : changeType === 'down'
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground';

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-6',
        'card-hover',
        className,
      )}
    >
      {/* Top row: icon + label */}
      <div className="flex items-center justify-between">
        {Icon && (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: color ? `${color}18` : undefined }}
          >
            <Icon
              className="h-4 w-4"
              style={{ color: color ?? 'var(--foreground)' }}
            />
          </div>
        )}
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>

      {/* Value */}
      <div className="flex items-end justify-between">
        <div>
          <p
            className={cn(
              'font-display leading-none tracking-tight',
              // 48px scale using Tailwind text size
              gradient
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent'
                : 'text-4xl font-bold text-foreground',
            )}
          >
            {formatted ?? value}
          </p>
          {typeof value === 'number' && formatted && (
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {value.toLocaleString()}
            </p>
          )}
        </div>

        {/* Trend badge */}
        {change !== undefined && (
          <Badge
            variant="outline"
            className={cn(
              'flex items-center gap-1 border-0 px-2 py-0.5 text-xs font-semibold tabular-nums',
              changeType === 'up' && 'bg-green-500/10 text-green-600 dark:text-green-400',
              changeType === 'down' && 'bg-red-500/10 text-red-600 dark:text-red-400',
              changeType === 'neutral' && 'bg-muted/60 text-muted-foreground',
            )}
          >
            <TrendIcon className={cn('h-3 w-3', trendColorClass)} />
            {changeType === 'up' && '▲'}
            {changeType === 'down' && '▼'}
            {changeType === 'neutral' && '—'}
            &nbsp;{Math.abs(change).toFixed(1)}%
          </Badge>
        )}
      </div>
    </div>
  );
}
