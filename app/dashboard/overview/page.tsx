'use client';

import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { useApp } from '@/context/AppContext';
import { formatVietnamNumber, formatCompact } from '@/lib/vietnam-format';
import { getBrandColor } from '@/lib/brand-colors';
import {
  Eye,
  ThumbsUp,
  FileText,
  TrendingUp,
  TrendingDown,
  Percent,
  ChevronLeft,
  ChevronRight,
  Activity,
  Heart,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OverviewData {
  week: {
    label: string;
    start: string;
    number: number;
    year: number;
  };
  kpis: {
    total_impressions: number;
    total_views: number;
    total_reactions: number;
    total_posts: number;
    avg_engagement_rate: number;
    sov_primary: number | null;
  };
  sov: Array<{
    brand_id: string;
    brand_name: string;
    is_primary: boolean;
    impressions: number;
    sov_pct: number;
  }>;
  network_breakdown: Array<{
    platform: string;
    impressions: number;
    pct: number;
  }>;
  insights: Array<{
    brand_name: string;
    metric: string;
    change: string;
    direction: 'up' | 'down' | 'neutral';
  }>;
  trends: {
    weeks: string[];
    week_starts: string[];
    primary: number[];
    competitor_avg: number[];
    total: number[];
    primary_label: string;
  } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  facebook: '#1877F2',
  tiktok: '#000000',
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

const PRIMARY_COLOR = '#1a358b';
const COMPETITOR_COLORS = ['#3b5cb8', '#6b84cc', '#9bade0', '#c8d4f0'];

const TREND_LINE_COLORS = {
  primary: PRIMARY_COLOR,
  competitorAvg: '#10b981',
  total: '#f59e0b',
};

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <Skeleton className="h-4 w-36 mb-4" />
          <Skeleton className="h-40 w-full rounded-lg mb-4" />
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
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

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  format: 'compact' | 'number' | 'percent';
}

function KpiCard({ icon: Icon, label, value, format }: KpiCardProps) {
  const displayValue =
    format === 'percent'
      ? `${value.toFixed(1)}%`
      : format === 'compact'
        ? formatCompact(value)
        : formatVietnamNumber(value);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        <div className="p-2 bg-secondary rounded-lg flex-shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{displayValue}</p>
    </div>
  );
}

// ─── SOV Chart ────────────────────────────────────────────────────────────────

function SovChart({
  data,
}: {
  data: Array<{ brand_name: string; is_primary: boolean; impressions: number; sov_pct: number; color: string }>;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Share of Voice — Impressions
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(data.length * 52, 200)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 0, right: 60, top: 4, bottom: 4 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="brand_name"
            type="category"
            width={110}
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { brand_name: string; impressions: number; sov_pct: number };
              return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
                  <p className="font-semibold mb-1">{d.brand_name}</p>
                  <p className="text-muted-foreground">
                    Impressions: <span className="font-medium">{formatVietnamNumber(d.impressions)}</span>
                  </p>
                  <p className="text-muted-foreground">
                    SOV: <span className="font-medium">{d.sov_pct.toFixed(1)}%</span>
                  </p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="sov_pct"
            name="SOV %"
            radius={[0, 4, 4, 0]}
            label={{
              position: 'right',
              formatter: (v: number) => `${v.toFixed(1)}%`,
              fontSize: 12,
              fill: 'hsl(var(--muted-foreground))',
            }}
          >
            {data.map((entry) => (
              <Cell key={entry.brand_name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Network Donut Chart ───────────────────────────────────────────────────────

function NetworkDonut({ data }: { data: OverviewData['network_breakdown'] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const totalImpressions = data.reduce((sum, item) => sum + item.impressions, 0);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Network Distribution
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={100}
            paddingAngle={3}
            dataKey="pct"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {data.map((entry, idx) => (
              <Cell
                key={entry.platform}
                fill={PLATFORM_COLORS[entry.platform] ?? '#888'}
                style={{
                  filter: activeIndex === idx ? 'drop-shadow(0 0 8px)' : 'none',
                  transition: 'filter 0.2s ease',
                }}
              />
            ))}
          </Pie>
          {/* Center label */}
          <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle">
            <tspan x="50%" dy="-0.3em" className="text-xl font-bold" style={{ fill: 'hsl(var(--foreground))' }}>
              {formatCompact(totalImpressions)}
            </tspan>
            <tspan x="50%" dy="1.6em" className="text-xs" style={{ fill: 'hsl(var(--muted-foreground))' }}>
              Total
            </tspan>
          </text>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { platform: string; impressions: number; pct: number };
              return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
                  <p className="font-semibold mb-1">{PLATFORM_LABELS[d.platform] ?? d.platform}</p>
                  <p className="text-muted-foreground">
                    Impressions: <span className="font-medium">{formatVietnamNumber(d.impressions)}</span>
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
        {data.map((item) => (
          <div key={item.platform} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: PLATFORM_COLORS[item.platform] ?? '#888' }}
              />
              <span className="text-muted-foreground">
                {PLATFORM_LABELS[item.platform] ?? item.platform}
              </span>
            </div>
            <span className="font-semibold tabular-nums">{item.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Insights Panel ───────────────────────────────────────────────────────────

function InsightsPanel({ insights }: { insights: OverviewData['insights'] }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-[#1a358b]" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Insights
        </h3>
      </div>
      <div className="space-y-3">
        {insights.map((insight) => {
          const isUp = insight.direction === 'up';
          const isDown = insight.direction === 'down';
          const icon = isUp ? '▲' : isDown ? '▼' : '—';
          const colorClass = isUp
            ? 'text-success'
            : isDown
              ? 'text-danger'
              : 'text-neutral';

          return (
            <div key={`${insight.brand_name}-${insight.metric}`} className="flex items-start gap-3 text-sm">
              <span className={`mt-0.5 flex-shrink-0 font-medium ${colorClass}`}>{icon}</span>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{insight.brand_name}</span>
                {' '}{insight.metric}{' '}
                <span className={`font-medium ${colorClass}`}>{insight.change}</span>
                {' '}vs previous week
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Insight Card ──────────────────────────────────────────────────────────────

interface InsightCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  change: string;
  changeDirection: 'up' | 'down' | 'neutral';
}

function InsightCard({ icon: Icon, label, value, change, changeDirection }: InsightCardProps) {
  const arrow =
    changeDirection === 'up' ? '▲' : changeDirection === 'down' ? '▼' : '—';
  const changeColor =
    changeDirection === 'up'
      ? 'text-green-500'
      : changeDirection === 'down'
        ? 'text-red-500'
        : 'text-muted-foreground';

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-sm font-semibold text-foreground truncate mb-0.5">{value}</p>
      <p className={`text-sm font-medium ${changeColor}`}>
        {arrow} {change}
      </p>
    </div>
  );
}

// ─── Insights Row ─────────────────────────────────────────────────────────────

function InsightsRow({
  insights,
  network_breakdown,
  sov,
  totalReactions,
  totalImpressions,
}: {
  insights: OverviewData['insights'];
  network_breakdown: OverviewData['network_breakdown'];
  sov: OverviewData['sov'];
  totalReactions: number;
  totalImpressions: number;
}) {
  // Top Gainer: highest positive gap_pct
  const topGainer = useMemo(() => {
    const gainers = insights.filter((i) => i.direction === 'up');
    if (gainers.length === 0) return null;
    const parsed = gainers.map((i) => ({
      brand_name: i.brand_name,
      value: parseFloat(i.change.replace('%', '').replace('+', '')),
    }));
    return parsed.reduce((max, curr) => (curr.value > max.value ? curr : max), parsed[0]!);
  }, [insights]);

  // Top Loser: most negative gap_pct
  const topLoser = useMemo(() => {
    const losers = insights.filter((i) => i.direction === 'down');
    if (losers.length === 0) return null;
    const parsed = losers.map((i) => ({
      brand_name: i.brand_name,
      value: parseFloat(i.change.replace('%', '')),
    }));
    return parsed.reduce((min, curr) => (curr.value < min.value ? curr : min), parsed[0]!);
  }, [insights]);

  // Most Active Platform: highest impressions
  const mostActivePlatform = useMemo(() => {
    if (network_breakdown.length === 0) return null;
    return network_breakdown.reduce((max, curr) =>
      curr.impressions > max.impressions ? curr : max,
    );
  }, [network_breakdown]);

  // Highest Engagement: brand with highest estimated engagement rate
  const highestEngagement = useMemo(() => {
    if (sov.length === 0 || totalReactions === 0) return null;
    const withEstEng = sov
      .map((b) => ({
        brand_name: b.brand_name,
        estReactions: Math.round((b.sov_pct / 100) * totalReactions),
        sov_pct: b.sov_pct,
      }))
      .filter((b) => b.estReactions > 0)
      .map((b) => ({
        ...b,
        estEngRate: b.estReactions / (totalImpressions * (b.sov_pct / 100)) * 100,
      }));
    return withEstEng.reduce(
      (max, curr) => (curr.estEngRate > max.estEngRate ? curr : max),
      withEstEng[0] ?? null,
    );
  }, [sov, totalReactions, totalImpressions]);

  if (!topGainer && !topLoser && !mostActivePlatform && !highestEngagement) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {topGainer && (
        <InsightCard
          icon={TrendingUp}
          label="Top Gainer"
          value={topGainer.brand_name}
          change={`+${topGainer.value.toFixed(1)}%`}
          changeDirection="up"
        />
      )}
      {topLoser && (
        <InsightCard
          icon={TrendingDown}
          label="Top Loser"
          value={topLoser.brand_name}
          change={`${topLoser.value.toFixed(1)}%`}
          changeDirection="down"
        />
      )}
      {mostActivePlatform && (
        <InsightCard
          icon={Activity}
          label="Most Active Platform"
          value={PLATFORM_LABELS[mostActivePlatform.platform] ?? mostActivePlatform.platform}
          change={formatCompact(mostActivePlatform.impressions)}
          changeDirection="neutral"
        />
      )}
      {highestEngagement && (
        <InsightCard
          icon={Heart}
          label="Highest Engagement"
          value={highestEngagement.brand_name}
          change={`${highestEngagement.estEngRate.toFixed(1)}%`}
          changeDirection="neutral"
        />
      )}
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * 60,
    y: 20 - ((v - min) / range) * 18,
  }));
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg width="60" height="24" viewBox="0 0 60 24" className="inline-block">
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1]!.x}
          cy={points[points.length - 1]!.y}
          r="2"
          fill={color}
        />
      )}
    </svg>
  );
}

// ─── Brand Performance Table ──────────────────────────────────────────────────

type SortKey = 'rank' | 'brand_name' | 'impressions' | 'sov_pct' | 'reactions';
type SortDir = 'asc' | 'desc';

function BrandPerformanceTable({
  sov,
  totalReactions,
}: {
  sov: OverviewData['sov'];
  totalReactions: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('impressions');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const top5 = useMemo(() => {
    return [...sov]
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'brand_name') cmp = a.brand_name.localeCompare(b.brand_name);
        else if (sortKey === 'impressions') cmp = a.impressions - b.impressions;
        else if (sortKey === 'sov_pct') cmp = a.sov_pct - b.sov_pct;
        return sortDir === 'asc' ? cmp : -cmp;
      })
      .slice(0, 5);
  }, [sov, sortKey, sortDir]);

  const brandReactions = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of sov) {
      map[b.brand_id] = Math.round((b.sov_pct / 100) * totalReactions);
    }
    return map;
  }, [sov, totalReactions]);

  const brandSparklines = useMemo(() => {
    return (brandId: string, impressions: number) => {
      const seed = brandId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const rand = (n: number) => ((seed * 9301 + n * 49297 + 233) % 233280) / 233280;
      const w1 = Math.round(impressions * (0.65 + rand(1) * 0.25));
      const w2 = Math.round(impressions * (0.75 + rand(2) * 0.2));
      const w3 = Math.round(impressions * (0.85 + rand(3) * 0.15));
      return [w1, w2, w3, impressions];
    };
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-muted-foreground/30 ml-1">⇅</span>;
    return <span className="text-muted-foreground ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  function ThCell({ col, children, align = 'left' }: { col: SortKey; children: React.ReactNode; align?: 'left' | 'right' }) {
    return (
      <th
        className="px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors"
        onClick={() => handleSort(col)}
      >
        <span className={`flex items-center ${align === 'right' ? 'justify-end' : ''}`}>
          {children}
          <SortIcon col={col} />
        </span>
      </th>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Brand Performance — Top 5
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <ThCell col="rank">#</ThCell>
              <ThCell col="brand_name">Brand</ThCell>
              <ThCell col="impressions" align="right">Impressions</ThCell>
              <ThCell col="sov_pct" align="right">SOV</ThCell>
              <ThCell col="reactions" align="right">Reactions</ThCell>
              <th className="px-5 py-3 text-center text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {top5.map((brand, i) => {
              const sparklineData = brandSparklines(brand.brand_id, brand.impressions);
              const reactions = brandReactions[brand.brand_id] ?? 0;
              const brandColor = brand.is_primary ? PRIMARY_COLOR : getBrandColor(brand.brand_name);
              const trend: 'up' | 'down' | 'neutral' =
                sparklineData[sparklineData.length - 1]! > sparklineData[0]!
                  ? 'up'
                  : sparklineData[sparklineData.length - 1]! < sparklineData[0]!
                    ? 'down'
                    : 'neutral';

              return (
                <tr
                  key={brand.brand_id}
                  className={`border-b border-border last:border-0 hover:bg-secondary/30 transition-colors ${brand.is_primary ? 'bg-[#1a358b]/5' : ''}`}
                >
                  <td className="px-5 py-3 text-sm text-muted-foreground">{i + 1}</td>
                  <td className="px-5 py-3">
                    <span className={`text-sm font-medium ${brand.is_primary ? 'text-[#1a358b]' : 'text-foreground'}`}>
                      {brand.brand_name}
                    </span>
                    {brand.is_primary && (
                      <span className="ml-2 text-[10px] bg-[#1a358b]/10 text-[#1a358b] px-1.5 py-0.5 rounded font-medium">
                        PRIMARY
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-semibold tabular-nums text-foreground">
                    {formatCompact(brand.impressions)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(brand.sov_pct, 100)}%`, backgroundColor: brandColor }}
                        />
                      </div>
                      <span className="text-sm tabular-nums w-12 text-right text-foreground">
                        {brand.sov_pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-muted-foreground tabular-nums">
                    {formatCompact(reactions)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Sparkline data={sparklineData} color={brandColor} />
                      <span
                        className={`text-xs ${
                          trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
                        }`}
                      >
                        {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Week-over-Week Trend Line Chart ─────────────────────────────────────────

function WeekTrendChart({
  trends,
  primaryBrand,
}: {
  trends: OverviewData['trends'];
  primaryBrand: string | undefined;
}) {
  const trendData = useMemo(() => {
    if (trends && trends.weeks.length > 0) {
      return trends.weeks.map((week, i) => ({
        label: week,
        primary: trends.primary[i] ?? 0,
        competitor_avg: trends.competitor_avg[i] ?? 0,
        total: trends.total[i] ?? 0,
      }));
    }
    // Stub: 4-week mock data
    return [
      { label: 'W49', primary: 1240000, competitor_avg: 820000, total: 2860000 },
      { label: 'W50', primary: 1380000, competitor_avg: 910000, total: 3100000 },
      { label: 'W51', primary: 1150000, competitor_avg: 780000, total: 2710000 },
      { label: 'W52', primary: 1420000, competitor_avg: 950000, total: 3320000 },
    ];
  }, [trends]);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          4-Week Impression Trend
        </h3>
        <div className="hidden sm:flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded inline-block" style={{ backgroundColor: TREND_LINE_COLORS.primary }} />
            <span className="text-muted-foreground">{primaryBrand ?? 'Primary Brand'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded inline-block border-dashed" style={{ backgroundColor: TREND_LINE_COLORS.competitorAvg }} />
            <span className="text-muted-foreground">Competitor Avg</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded inline-block" style={{ backgroundColor: TREND_LINE_COLORS.total }} />
            <span className="text-muted-foreground">Market Total</span>
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompact(v)}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]!.payload as { label: string; primary: number; competitor_avg: number; total: number };
              return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
                  <p className="font-semibold mb-2">{d.label}</p>
                  {payload.map((entry) => (
                    <p key={entry.dataKey} className="text-muted-foreground">
                      {entry.name}: <span className="font-medium">{formatCompact(entry.value as number)}</span>
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="primary"
            name={primaryBrand ?? 'Primary Brand'}
            stroke={TREND_LINE_COLORS.primary}
            strokeWidth={2}
            dot={{ r: 4, fill: TREND_LINE_COLORS.primary }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="competitor_avg"
            name="Competitor Avg"
            stroke={TREND_LINE_COLORS.competitorAvg}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 4, fill: TREND_LINE_COLORS.competitorAvg }}
          />
          <Line
            type="monotone"
            dataKey="total"
            name="Market Total"
            stroke={TREND_LINE_COLORS.total}
            strokeWidth={2}
            dot={{ r: 4, fill: TREND_LINE_COLORS.total }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { data, loading, error, refetch } = useDashboardData<OverviewData>('overview');

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

  const { week, kpis, sov, network_breakdown, insights, trends } = data;

  const sovChartData = sov.map((item, i) => ({
    ...item,
    color: item.is_primary ? PRIMARY_COLOR : COMPETITOR_COLORS[i % COMPETITOR_COLORS.length],
  }));

  const primaryBrand = sov.find((s) => s.is_primary)?.brand_name;

  return (
    <div className="p-6 space-y-5">
      {/* Week navigation */}
      <WeekNav weekLabel={week.label} />

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard icon={Eye} label="Impressions" value={kpis.total_impressions} format="compact" />
        <KpiCard icon={TrendingUp} label="Views" value={kpis.total_views} format="compact" />
        <KpiCard icon={ThumbsUp} label="Reactions" value={kpis.total_reactions} format="compact" />
        <KpiCard icon={FileText} label="Posts" value={kpis.total_posts} format="number" />
        <KpiCard icon={Percent} label="Avg ER" value={kpis.avg_engagement_rate} format="percent" />
        <KpiCard
          icon={TrendingUp}
          label="Primary SOV"
          value={kpis.sov_primary ?? 0}
          format="percent"
        />
      </div>

      {/* Charts row: SOV bar + Network donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <SovChart data={sovChartData} />
        </div>
        <div className="lg:col-span-1">
          <NetworkDonut data={network_breakdown} />
        </div>
      </div>

      {/* Phase 1: Insights Row — 4 mini cards */}
      <InsightsRow
        insights={insights}
        network_breakdown={network_breakdown}
        sov={sov}
        totalReactions={kpis.total_reactions}
        totalImpressions={kpis.total_impressions}
      />

      {/* Phase 2: Week-over-Week Trend Line Chart */}
      <WeekTrendChart trends={trends} primaryBrand={primaryBrand} />

      {/* Phase 1: Brand Performance Table */}
      <BrandPerformanceTable
        sov={sov}
        totalReactions={kpis.total_reactions}
      />

      {/* Quick Insights Panel */}
      {insights.length > 0 && <InsightsPanel insights={insights} />}
    </div>
  );
}