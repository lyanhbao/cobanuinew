'use client';

import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { useApp } from '@/context/AppContext';
import { formatVietnamNumber, formatCompact } from '@/lib/vietnam-format';
import {
  Eye,
  ThumbsUp,
  FileText,
  Percent,
  ChevronLeft,
  ChevronRight,
  BarChart2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlatformEntry {
  platform: string;
  kpis: {
    views: number;
    impressions: number;
    reactions: number;
    posts: number;
    avg_engagement_rate: number;
  };
  format_mix: Array<{ format: string; count: number; pct: number }>;
  posting_cadence: Array<{
    week: string;
    posts: number;
    youtube: number;
    facebook: number;
    tiktok: number;
  }>;
  yt_details: {
    shorts: number;
    normal: number;
    shorts_er: number;
    normal_er: number;
  } | null;
}

interface ChannelData {
  week: {
    label: string;
    start: string;
    number: number;
    year: number;
  };
  platforms: PlatformEntry[];
  format_mix: Array<{
    format: string;
    youtube: number;
    facebook: number;
    tiktok: number;
  }>;
  cadence: Array<{
    week: string;
    posts: number;
    youtube: number;
    facebook: number;
    tiktok: number;
  }>;
}

type PlatformKey = 'youtube' | 'facebook' | 'tiktok';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<PlatformKey, string> = {
  youtube: '#FF0000',
  facebook: '#1877F2',
  tiktok: '#000000',
};

const PLATFORM_LABELS: Record<PlatformKey, string> = {
  youtube: 'YouTube',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

const FORMAT_COLORS = [
  '#1a358b',
  '#3b5cb8',
  '#6b84cc',
  '#9bade0',
  '#c8d4f0',
  '#e8eef8',
];

const DAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-[200px]" />
      </div>
      {/* Platform tabs skeleton */}
      <div className="flex gap-2">
        {[80, 100, 80].map((w, i) => (
          <Skeleton key={i} className="h-10" style={{ width: w }} />
        ))}
      </div>
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-8 w-28 mb-2" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-xl p-5">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
      {/* Comparison table skeleton */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="p-5 space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Week Navigation ──────────────────────────────────────────────────────────

function WeekNav({ weekLabel }: { weekLabel: string }) {
  const { selectedWeek, availableWeeks, setSelectedWeek } = useApp();
  const idx = availableWeeks.indexOf(selectedWeek ?? '');
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < availableWeeks.length - 1;

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => hasPrev && setSelectedWeek(availableWeeks[idx - 1])}
        disabled={!hasPrev}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous week"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="px-4 py-2 bg-secondary border border-border rounded-lg">
        <span className="text-sm font-medium tabular-nums">{weekLabel}</span>
      </div>
      <button
        onClick={() => hasNext && setSelectedWeek(availableWeeks[idx + 1])}
        disabled={!hasNext}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Next week"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  format: 'compact' | 'number' | 'percent';
  color?: string;
}

function KpiCard({ icon: Icon, label, value, format, color }: KpiCardProps) {
  const displayValue =
    format === 'percent'
      ? `${value.toFixed(1)}%`
      : format === 'compact'
        ? formatCompact(value)
        : formatVietnamNumber(value);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          {label}
        </p>
        <div className="p-2 bg-secondary rounded-lg flex-shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
      <p
        className="text-2xl font-bold text-foreground tabular-nums tracking-tight"
        style={color ? { color } : undefined}
      >
        {displayValue}
      </p>
    </div>
  );
}

// ─── Format Mix Donut ──────────────────────────────────────────────────────────

function FormatMixChart({
  formats,
  platform,
}: {
  formats: Array<{ format: string; count: number; pct: number }>;
  platform: PlatformKey;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartData = formats.filter((f) => f.count > 0);

  if (chartData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Format Mix — {PLATFORM_LABELS[platform]}
        </h3>
        <div className="text-sm text-muted-foreground text-center py-8">
          No format data available.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Format Mix — {PLATFORM_LABELS[platform]}
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={3}
            dataKey="count"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {chartData.map((entry, idx) => (
              <Cell
                key={entry.format}
                fill={FORMAT_COLORS[idx % FORMAT_COLORS.length]}
                style={{
                  filter: activeIndex === idx ? 'drop-shadow(0 0 8px)' : 'none',
                  transition: 'filter 0.2s ease',
                }}
              />
            ))}
          </Pie>
          <text x="50%" y="44%" textAnchor="middle" dominantBaseline="middle">
            <tspan
              x="50%"
              dy="-0.3em"
              className="text-xl font-bold"
              style={{ fill: 'hsl(var(--foreground))' }}
            >
              {chartData.length}
            </tspan>
            <tspan
              x="50%"
              dy="1.6em"
              className="text-xs"
              style={{ fill: 'hsl(var(--muted-foreground))' }}
            >
              Formats
            </tspan>
          </text>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]!.payload as { format: string; count: number; pct: number };
              return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
                  <p className="font-semibold mb-1">{d.format}</p>
                  <p className="text-muted-foreground">
                    Posts: <span className="font-medium">{formatVietnamNumber(d.count)}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Share: <span className="font-medium">{d.pct.toFixed(1)}%</span>
                  </p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 space-y-2.5">
        {chartData.map((item, idx) => (
          <div key={item.format} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: FORMAT_COLORS[idx % FORMAT_COLORS.length] }}
              />
              <span className="text-muted-foreground">{item.format}</span>
            </div>
            <span className="font-semibold tabular-nums">{item.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Posting Cadence Chart ────────────────────────────────────────────────────

function CadenceChart({
  cadence,
}: {
  cadence: Array<{
    week: string;
    posts: number;
    youtube: number;
    facebook: number;
    tiktok: number;
  }>;
}) {
  if (cadence.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Posting Cadence — Last 8 Weeks
        </h3>
        <div className="text-sm text-muted-foreground text-center py-8">
          No cadence data available.
        </div>
      </div>
    );
  }

  const maxPosts = Math.max(
    ...cadence.map((w) => w.youtube + w.facebook + w.tiktok),
    1,
  );

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Posting Cadence — Last 8 Weeks
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={cadence} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            width={30}
            domain={[0, maxPosts * 1.15]}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]!.payload as {
                week: string;
                posts: number;
                youtube: number;
                facebook: number;
                tiktok: number;
              };
              return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
                  <p className="font-semibold mb-2">{d.week}</p>
                  {([
                    { label: 'YouTube', value: d.youtube, color: PLATFORM_COLORS.youtube },
                    { label: 'Facebook', value: d.facebook, color: PLATFORM_COLORS.facebook },
                    { label: 'TikTok', value: d.tiktok, color: PLATFORM_COLORS.tiktok },
                  ] as const).map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2 h-2 rounded-sm"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-muted-foreground">{item.label}</span>
                      </div>
                      <span className="font-medium tabular-nums">
                        {formatVietnamNumber(item.value)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-border mt-2 pt-2 flex justify-between">
                    <span className="text-muted-foreground font-medium">Total</span>
                    <span className="font-semibold tabular-nums">
                      {formatVietnamNumber(d.posts)}
                    </span>
                  </div>
                </div>
              );
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: '8px' }}
          />
          <Bar
            dataKey="youtube"
            stackId="a"
            fill={PLATFORM_COLORS.youtube}
            name="YouTube"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="facebook"
            stackId="a"
            fill={PLATFORM_COLORS.facebook}
            name="Facebook"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="tiktok"
            stackId="a"
            fill={PLATFORM_COLORS.tiktok}
            name="TikTok"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Platform Comparison Table ─────────────────────────────────────────────────

function PlatformComparisonTable({ platforms }: { platforms: PlatformEntry[] }) {
  const metrics = [
    { key: 'impressions' as const, label: 'Impressions', format: 'compact' as const },
    { key: 'views' as const, label: 'Views', format: 'compact' as const },
    { key: 'reactions' as const, label: 'Reactions', format: 'compact' as const },
    { key: 'posts' as const, label: 'Posts', format: 'number' as const },
    { key: 'avg_er' as const, label: 'Avg ER', format: 'percent' as const },
  ];

  const rows = platforms.map((p) => ({
    platform: p.platform as PlatformKey,
    impressions: p.kpis.impressions,
    views: p.kpis.views,
    reactions: p.kpis.reactions,
    posts: p.kpis.posts,
    avg_er: p.kpis.avg_engagement_rate,
  }));

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Platform Comparison
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider text-left">
                Metric
              </th>
              {(PLATFORMS as readonly PlatformKey[]).map((p) => (
                <th
                  key={p}
                  className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-right"
                  style={{ color: PLATFORM_COLORS[p] }}
                >
                  {PLATFORM_LABELS[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.key} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                <td className="px-5 py-3 text-sm text-muted-foreground font-medium">
                  {m.label}
                </td>
                {(PLATFORMS as readonly PlatformKey[]).map((p) => {
                  const row = rows.find((r) => r.platform === p);
                  const val = row?.[m.key] ?? 0;
                  const formatted =
                    m.format === 'percent'
                      ? `${val.toFixed(1)}%`
                      : m.format === 'compact'
                        ? formatCompact(val)
                        : formatVietnamNumber(val);
                  return (
                    <td
                      key={p}
                      className="px-5 py-3 text-right text-sm font-semibold tabular-nums text-foreground"
                    >
                      {formatted}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PLATFORMS = ['youtube', 'facebook', 'tiktok'] as const;

export default function ChannelPage() {
  const { data, loading, error, refetch } = useDashboardData<ChannelData>('channel');
  const [activePlatform, setActivePlatform] = useState<PlatformKey>('youtube');

  const platforms = data?.platforms ?? [];

  // Keep active tab valid when data changes
  const activeEntry = useMemo(() => {
    return (
      platforms.find((p) => p.platform === activePlatform) ??
      platforms[0] ??
      null
    );
  }, [platforms, activePlatform]);

  const cadence = data?.cadence ?? [];

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={refetch}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">No data available for this week.</p>
      </div>
    );
  }

  const { week } = data;

  return (
    <div className="p-6 space-y-5">
      {/* Page header + week nav */}
      <div className="dashboard-reveal flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Channel Performance</h1>
        <WeekNav weekLabel={week.label} />
      </div>

      {/* Platform tabs */}
      <div className="dashboard-reveal flex gap-2 border-b border-border pb-0">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setActivePlatform(p)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors relative
              ${
                activePlatform === p
                  ? 'border-b-2'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }
            `}
            style={
              activePlatform === p
                ? { color: PLATFORM_COLORS[p], borderBottomColor: PLATFORM_COLORS[p] }
                : undefined
            }
          >
            <BarChart2 className="w-4 h-4" style={{ color: activePlatform === p ? PLATFORM_COLORS[p] : undefined }} />
            {PLATFORM_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Platform KPIs */}
      {activeEntry ? (
        <div className="dashboard-reveal grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            icon={Eye}
            label="Impressions"
            value={activeEntry.kpis.impressions}
            format="compact"
            color={PLATFORM_COLORS[activePlatform]}
          />
          <KpiCard
            icon={BarChart2}
            label="Views"
            value={activeEntry.kpis.views}
            format="compact"
            color={PLATFORM_COLORS[activePlatform]}
          />
          <KpiCard
            icon={ThumbsUp}
            label="Reactions"
            value={activeEntry.kpis.reactions}
            format="compact"
            color={PLATFORM_COLORS[activePlatform]}
          />
          <KpiCard
            icon={FileText}
            label="Posts"
            value={activeEntry.kpis.posts}
            format="number"
            color={PLATFORM_COLORS[activePlatform]}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5">
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-8 w-28" />
            </div>
          ))}
        </div>
      )}

      {/* Charts row: Format Mix + Cadence */}
      <div className="dashboard-reveal grid grid-cols-1 lg:grid-cols-2 gap-5">
        {activeEntry ? (
          <FormatMixChart
            formats={activeEntry.format_mix}
            platform={activePlatform}
          />
        ) : (
          <div className="bg-card border border-border rounded-xl p-5">
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        )}

        <CadenceChart cadence={cadence} />
      </div>

      {/* Platform comparison table */}
      {platforms.length > 0 && (
        <div className="dashboard-reveal">
          <PlatformComparisonTable platforms={platforms} />
        </div>
      )}

      {/* YouTube details (only when YT is selected) */}
      {activePlatform === 'youtube' && activeEntry?.yt_details && (
        <div className="dashboard-reveal bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            YouTube Format Details
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-secondary border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
                Shorts Posts
              </p>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {formatVietnamNumber(activeEntry.yt_details.shorts)}
              </p>
            </div>
            <div className="bg-secondary border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
                Shorts ER
              </p>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {activeEntry.yt_details.shorts_er.toFixed(1)}%
              </p>
            </div>
            <div className="bg-secondary border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
                Standard Posts
              </p>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {formatVietnamNumber(activeEntry.yt_details.normal)}
              </p>
            </div>
            <div className="bg-secondary border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
                Standard ER
              </p>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {activeEntry.yt_details.normal_er.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
