'use client';

import { useDashboardData } from '@/lib/use-dashboard-data';
import { formatCompact } from '@/lib/vietnam-format';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, AlertCircle } from 'lucide-react';
import GlassCard from './glass-card';

interface HeatmapCell {
  value: number;
  delta: number;
}

interface HeatmapBrand {
  brandId: string;
  brandName: string;
  isPrimary: boolean;
  cells: {
    views: HeatmapCell;
    engagement: HeatmapCell;
    sov: HeatmapCell;
    spend: HeatmapCell;
    formatDiversity: HeatmapCell;
  };
  posts: number;
}

interface HeatmapData {
  brands: HeatmapBrand[];
  week: { weekStart: string; label: string } | null;
}

const METRICS = [
  { key: 'views', label: 'Views', format: 'compact' },
  { key: 'engagement', label: 'Engagement', format: 'compact' },
  { key: 'sov', label: 'SOV %', format: 'percent' },
  { key: 'spend', label: 'Spend', format: 'currency' },
  { key: 'formatDiversity', label: 'Format Div.', format: 'percent' },
] as const;

function cellColor(delta: number): string {
  if (delta > 10) return 'bg-green-500/20 text-green-400';
  if (delta > 0) return 'bg-green-500/10 text-green-400/70';
  if (delta > -10) return 'bg-amber-500/10 text-amber-400/70';
  if (delta > -25) return 'bg-orange-500/15 text-orange-400';
  return 'bg-red-500/15 text-red-400';
}

function formatValue(v: number, fmt: string): string {
  if (fmt === 'percent') return `${v.toFixed(1)}%`;
  if (fmt === 'currency') return formatCompact(v);
  return formatCompact(v);
}

function CellDisplay({ cell, metric }: { cell: HeatmapCell; metric: typeof METRICS[number] }) {
  const color = cellColor(cell.delta);
  const fmt = formatValue(cell.value, metric.format);
  const deltaStr = cell.delta >= 0 ? `+${cell.delta.toFixed(1)}` : cell.delta.toFixed(1);

  return (
    <div className={`flex flex-col items-center justify-center px-2 py-1.5 rounded-lg ${color}`}>
      <span className="text-xs font-semibold tabular-nums">{fmt}</span>
      <span className="text-[10px] opacity-70">{deltaStr}%</span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-2">
          <Skeleton className="h-10 w-40 skeleton-shimmer rounded-lg" />
          <div className="flex gap-2 flex-1">
            {[0, 1, 2, 3, 4].map((j) => (
              <Skeleton key={j} className="h-10 flex-1 skeleton-shimmer rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="w-5 h-5" />
        <span className="text-sm font-medium">{message}</span>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Retry
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-sm text-white/40">No competitive data available</p>
    </div>
  );
}

export function CompetitiveHeatmap() {
  const { data, loading, error, refetch } = useDashboardData<HeatmapData>('competitive-heatmap');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data || !data.brands || data.brands.length === 0) return <EmptyState />;

  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="flex items-center gap-2 pb-2">
        <div className="w-40 flex-shrink-0" />
        <div className="flex gap-2 flex-1">
          {METRICS.map((m) => (
            <div key={m.key} className="flex-1 text-center">
              <span className="text-[10px] uppercase tracking-wider text-white/30 font-medium">
                {m.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Brand rows */}
      {data.brands.map((brand) => (
        <div
          key={brand.brandId}
          className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/3 transition-colors"
        >
          {/* Brand name */}
          <div className="w-40 flex-shrink-0 flex items-center gap-2">
            {brand.isPrimary && (
              <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-500/20 text-blue-400/80">
                PRI
              </span>
            )}
            <span className="text-xs font-medium text-white/80 truncate" title={brand.brandName}>
              {brand.brandName}
            </span>
          </div>

          {/* Metric cells */}
          <div className="flex gap-2 flex-1">
            {METRICS.map((m) => (
              <div key={m.key} className="flex-1">
                <CellDisplay
                  cell={brand.cells[m.key as keyof typeof brand.cells]}
                  metric={m}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/6">
        <span className="text-[10px] text-white/30">vs group avg</span>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500/20" />
          <span className="text-[10px] text-white/40">Above</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-500/10" />
          <span className="text-[10px] text-white/40">Neutral</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500/15" />
          <span className="text-[10px] text-white/40">Below</span>
        </div>
      </div>
    </div>
  );
}
