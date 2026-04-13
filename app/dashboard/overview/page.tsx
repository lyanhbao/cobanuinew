'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { formatVietnamNumber, formatCompact } from '@/lib/vietnam-format';
import {
  Eye,
  ThumbsUp,
  FileText,
  TrendingUp,
  Percent,
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

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Network Distribution
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={78}
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
      <div className="mt-4 space-y-2.5">
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
            ? 'text-green-500'
            : isDown
              ? 'text-red-500'
              : 'text-muted-foreground';

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

  const { kpis, sov, network_breakdown, insights } = data;

  const sovChartData = sov.map((item, i) => ({
    ...item,
    color: item.is_primary ? PRIMARY_COLOR : COMPETITOR_COLORS[i % COMPETITOR_COLORS.length],
  }));

  return (
    <div className="p-6 space-y-5">
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

      {/* Insights */}
      {insights.length > 0 && <InsightsPanel insights={insights} />}
    </div>
  );
}