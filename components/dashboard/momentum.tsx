'use client';

import { useDashboardData } from '@/lib/use-dashboard-data';
import { formatCompact } from '@/lib/vietnam-format';
import { TrendingUp, TrendingDown, Minus, Activity, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MomentumSeries {
  week: string;
  value: number;
}

interface MomentumBrand {
  brandId: string;
  brandName: string;
  isPrimary: boolean;
  signal: 'surge' | 'rising' | 'stable' | 'declining' | 'crash';
  slope: number;
  avg: number;
  totalDelta: number;
  series: MomentumSeries[];
}

interface MomentumData {
  brands: MomentumBrand[];
  week: { weekStart: string; label: string } | null;
  metric: string;
}

const SIGNAL_CONFIG = {
  surge: {
    icon: Zap,
    color: 'text-green-400',
    bg: 'bg-green-400/10 border-green-400/20',
    label: 'Surge',
  },
  rising: {
    icon: TrendingUp,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10 border-blue-400/20',
    label: 'Rising',
  },
  stable: {
    icon: Minus,
    color: 'text-white/40',
    bg: 'bg-white/5 border-white/10',
    label: 'Stable',
  },
  declining: {
    icon: TrendingDown,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10 border-amber-400/20',
    label: 'Declining',
  },
  crash: {
    icon: TrendingDown,
    color: 'text-red-400',
    bg: 'bg-red-400/10 border-red-400/20',
    label: 'Crash',
  },
};

function speedChevrons(signal: 'surge' | 'rising' | 'stable' | 'declining' | 'crash'): number {
  switch (signal) {
    case 'surge': return 3;
    case 'rising': return 2;
    case 'stable': return 1;
    case 'declining': return 2;
    case 'crash': return 3;
    default: return 1;
  }
}

function Sparkline({ series }: { series: MomentumSeries[] }) {
  if (series.length < 2) return <div className="w-12 h-4" />;

  const values = series.map((s) => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 48;
  const height = 16;
  const points = series.map((s, i) => {
    const x = (i / (series.length - 1)) * width;
    const y = height - ((s.value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-white/30"
      />
    </svg>
  );
}

interface MomentumBadgeProps {
  signal?: MomentumBrand['signal'];
  brandId?: string;
  compact?: boolean;
}

/**
 * MomentumBadge — renders a brand's momentum signal.
 * If `brandId` is provided, looks up signal from momentum API data.
 * If `signal` is provided directly, renders that signal.
 */
export function MomentumBadge({ signal: signalProp, brandId, compact = false }: MomentumBadgeProps) {
  const { data } = useDashboardData<MomentumData>('momentum');

  const resolvedSignal = brandId && data?.brands
    ? (data.brands.find((b) => b.brandId === brandId)?.signal ?? 'stable')
    : (signalProp ?? 'stable');

  const config = SIGNAL_CONFIG[resolvedSignal];
  const Icon = config.icon;
  const chevrons = speedChevrons(resolvedSignal);

  if (compact) {
    return (
      <div className={cn('inline-flex items-center gap-0.5', config.color)}>
        <Icon className="w-3.5 h-3.5" />
        {[...Array(chevrons)].map((_, i) => (
          <svg key={i} width="6" height="10" viewBox="0 0 6 10" className="opacity-70">
            <path d="M0 0L6 5L0 10Z" fill="currentColor" />
          </svg>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border',
        config.bg,
        config.color,
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
      <div className="flex items-center gap-0.5 ml-0.5">
        {[...Array(chevrons)].map((_, i) => (
          <svg key={i} width="6" height="10" viewBox="0 0 6 10" className="opacity-70">
            <path d="M0 0L6 5L0 10Z" fill="currentColor" />
          </svg>
        ))}
      </div>
    </div>
  );
}

export function MomentumCell({ brand }: { brand: MomentumBrand }) {
  const { data, loading } = useDashboardData<MomentumData>('momentum');

  if (loading || !data?.brands) {
    return <MomentumBadge signal="stable" compact />;
  }

  const brandData = data.brands.find((b) => b.brandId === brand.brandId);
  if (!brandData) return <MomentumBadge signal="stable" compact />;

  return <MomentumBadge signal={brandData.signal} compact />;
}

/** Alias for MomentumList — benchmark page imports this name */
export function MomentumTable(props: MomentumListProps) {
  return <MomentumList {...props} />;
}

interface MomentumListProps {
  className?: string;
  maxItems?: number;
}

export function MomentumList({ className, maxItems = 10 }: MomentumListProps) {
  const { data, loading, error } = useDashboardData<MomentumData>('momentum');

  if (loading) {
    return (
      <div className={cn('space-y-2', className)}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
            <div className="h-4 w-16 bg-white/5 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !data?.brands?.length) {
    return null;
  }

  const brands = data.brands.slice(0, maxItems);

  return (
    <div className={cn('space-y-2', className)}>
      {brands.map((brand) => (
        <div
          key={brand.brandId}
          className="flex items-center justify-between gap-3 py-1.5"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {brand.isPrimary && (
              <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-500/20 text-blue-400/80 flex-shrink-0">
                PRI
              </span>
            )}
            <span className="text-xs text-white/70 truncate">{brand.brandName}</span>
          </div>
          <Sparkline series={brand.series} />
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] tabular-nums text-white/30">
              {brand.totalDelta >= 0 ? '+' : ''}{brand.totalDelta.toFixed(1)}%
            </span>
            <MomentumBadge signal={brand.signal} compact />
          </div>
        </div>
      ))}
    </div>
  );
}
