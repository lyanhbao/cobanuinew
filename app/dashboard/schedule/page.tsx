'use client';

import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { useApp } from '@/context/AppContext';
import { formatCompact } from '@/lib/vietnam-format';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScheduleData {
  weeks: string[];
  weekStarts: string[];
  today: string | null;
  weekCount: number;
  brands: BrandTimeline[];
}

interface BrandTimeline {
  brand_id: string;
  brand_name: string;
  is_primary: boolean;
  channels: ChannelRow[];
}

interface ChannelRow {
  platform: string;
  platform_label: string;
  segments: ActivitySegment[];
}

interface ActivitySegment {
  week_start: string;
  week_count: number;
  impressions: number;
  reactions: number;
  post_count: number;
  has_high_activity: boolean;
}

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  facebook: '#1877F2',
  tiktok: '#000000',
};

const PLATFORM_BG: Record<string, string> = {
  youtube: 'rgba(255,0,0,0.15)',
  facebook: 'rgba(24,119,242,0.15)',
  tiktok: 'rgba(0,0,0,0.3)',
};

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-80" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { data, loading, error, refetch } = useDashboardData<ScheduleData>('schedule');

  if (loading) return <LoadingSkeleton />;
  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <button onClick={refetch} className="text-xs text-muted-foreground underline hover:text-foreground">
          Retry
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">No schedule data available.</p>
      </div>
    );
  }

  const { weeks, weekStarts, today, brands } = data;

  if (brands.length === 0 || weeks.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">No brand activity found in this period.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="dashboard-reveal flex items-center gap-3">
        <div className="p-2 rounded-lg bg-secondary">
          <Calendar className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Activity Schedule</h1>
          <p className="text-xs text-muted-foreground">
            {brands.length} brands · {weeks.length} weeks · {weekStarts[0]} → {weekStarts[weekStarts.length - 1]}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="dashboard-reveal flex items-center gap-4 text-xs">
        <span className="text-muted-foreground">Platform:</span>
        {Object.entries(PLATFORM_COLORS).map(([platform, color]) => (
          <div key={platform} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color, opacity: 0.8 }} />
            <span className="text-muted-foreground capitalize">{platform}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-4">
          <div className="w-3 h-3 rounded-sm border border-border bg-primary/30" />
          <span className="text-muted-foreground">High activity</span>
        </div>
      </div>

      {/* Gantt Grid */}
      <div className="dashboard-reveal">
        <GanttGrid
          weeks={weeks}
          weekStarts={weekStarts}
          today={today}
          brands={brands}
        />
      </div>
    </div>
  );
}

// ─── Gantt Grid ────────────────────────────────────────────────────────────────

interface GanttGridProps {
  weeks: string[];
  weekStarts: string[];
  today: string | null;
  brands: BrandTimeline[];
}

function GanttGrid({ weeks, weekStarts, today, brands }: GanttGridProps) {
  const weekIndex = useMemo(() => {
    const m = new Map<string, number>();
    weekStarts.forEach((ws, i) => m.set(ws, i));
    return m;
  }, [weekStarts]);

  const todayIndex = today ? weekIndex.get(today) ?? null : null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Week header */}
      <div className="flex border-b border-border bg-secondary/30 sticky top-0 z-10">
        {/* Brand label column */}
        <div className="w-48 flex-shrink-0 px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Brand / Platform</span>
        </div>
        {/* Week columns */}
        <div className="flex flex-1">
          {weeks.map((week, i) => {
            const isToday = i === todayIndex;
            return (
              <div
                key={i}
                className={cn(
                  'flex-1 min-w-0 py-2 text-center border-l border-border/50',
                  isToday && 'bg-primary/5'
                )}
              >
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    isToday ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {week}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Brand rows */}
      {brands.map((brand) => (
        <div key={brand.brand_id} className="border-b border-border last:border-0">
          {/* Brand header */}
          <div className="flex items-center bg-secondary/20">
            <div className="w-48 flex-shrink-0 px-4 py-2">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm font-semibold truncate',
                  brand.is_primary ? 'text-primary' : 'text-foreground'
                )}>
                  {brand.brand_name}
                </span>
                {brand.is_primary && (
                  <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded font-semibold flex-shrink-0">
                    PRIMARY
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-1 py-1.5" />
          </div>

          {/* Channel rows */}
          {brand.channels.map((channel) => (
            <ChannelRow
              key={channel.platform}
              channel={channel}
              weeks={weeks}
              weekStarts={weekStarts}
              weekIndex={weekIndex}
              todayIndex={todayIndex}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Channel Row ───────────────────────────────────────────────────────────────

interface ChannelRowProps {
  channel: ChannelRow;
  weeks: string[];
  weekStarts: string[];
  weekIndex: Map<string, number>;
  todayIndex: number | null;
}

function ChannelRow({ channel, weeks, weekStarts, weekIndex, todayIndex }: ChannelRowProps) {
  const color = PLATFORM_COLORS[channel.platform] ?? '#888';
  const bg = PLATFORM_BG[channel.platform] ?? 'rgba(136,136,136,0.15)';
  const highBg = channel.platform === 'youtube'
    ? 'rgba(255,0,0,0.3)'
    : channel.platform === 'facebook'
      ? 'rgba(24,119,242,0.3)'
      : 'rgba(0,0,0,0.5)';

  // Build a grid of cells
  const cells = weeks.map((_, colIndex) => {
    const segment = channel.segments.find((seg) => {
      const segIdx = weekIndex.get(seg.week_start);
      return segIdx === colIndex;
    });
    return segment;
  });

  // Group consecutive cells into spans for cleaner rendering
  const spans: { colIndex: number; colSpan: number; segment: ActivitySegment }[] = [];
  let i = 0;
  while (i < cells.length) {
    if (cells[i]) {
      const seg = cells[i]!;
      let colSpan = 1;
      while (i + colSpan < cells.length && cells[i + colSpan]) {
        colSpan++;
      }
      spans.push({ colIndex: i, colSpan, segment: seg });
      i += colSpan;
    } else {
      i++;
    }
  }

  return (
    <div className="flex">
      {/* Platform label */}
      <div className="w-48 flex-shrink-0 px-4 py-1.5 flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-sm flex-shrink-0"
          style={{ backgroundColor: color, opacity: 0.7 }}
        />
        <span className="text-xs text-muted-foreground truncate">{channel.platform_label}</span>
      </div>

      {/* Activity grid */}
      <div className="flex flex-1 relative">
        {/* Today marker */}
        {todayIndex !== null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-primary/40 z-10 pointer-events-none"
            style={{ left: `calc(${todayIndex} * (100% / ${weeks.length}) + 0.5px)` }}
          />
        )}

        {/* Empty state background */}
        <div className="absolute inset-0 flex">
          {weeks.map((_, i) => (
            <div key={i} className="flex-1 border-l border-border/30" />
          ))}
        </div>

        {/* Activity blocks */}
        {spans.map((span, si) => {
          const seg = span.segment;
          const widthPct = (span.colSpan / weeks.length) * 100;
          const leftPct = (span.colIndex / weeks.length) * 100;
          const segBg = seg.has_high_activity ? highBg : bg;

          return (
            <div
              key={si}
              className="absolute top-1 bottom-1 rounded-sm overflow-hidden cursor-default group"
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                backgroundColor: segBg,
                border: `1px solid ${color}`,
                opacity: 0.85,
              }}
              title={`${seg.impressions.toLocaleString()} impressions · ${seg.post_count} posts · ${seg.week_count}w block`}
            >
              <div className="h-full flex items-center px-2 overflow-hidden">
                <span className="text-[10px] font-medium text-white truncate drop-shadow-sm">
                  {formatCompact(seg.impressions)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
