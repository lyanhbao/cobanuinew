'use client';

import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { useApp } from '@/context/AppContext';
import { formatVietnamNumber, formatCompact } from '@/lib/vietnam-format';
import {
  Eye,
  ThumbsUp,
  FileText,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Target,
  Trophy,
  BarChart3,
  Minus,
  LayoutDashboard,
} from 'lucide-react';
import {
  RadarChart as RechartsRadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WeekInfo {
  label: string;
  start: string;
  number: number;
  year: number;
}

interface RadarPoint {
  metric: string;
  primary: number;
  competitor: number;
}

interface HeadToHeadPoint {
  metric: string;
  primary: number;
  competitor: number;
  primary_label?: string;
  competitor_label?: string;
}

interface GapPoint {
  metric: string;
  gap: number;
  category: 'positive' | 'negative' | 'neutral';
}

interface BenchmarkData {
  week: WeekInfo | null;
  radar: RadarPoint[];
  head_to_head: HeadToHeadPoint[];
  gap_analysis: GapPoint[];
  primary_brand: string | null;
  competitor_brand: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY_COLOR = '#1a358b';
const COMPETITOR_COLOR = '#10b981';

const METRIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Impressions: Eye,
  Views: Eye,
  Reactions: ThumbsUp,
  Posts: FileText,
  'Engagement Rate': TrendingUp,
  'Avg. Engagement Rate': TrendingUp,
};

const GAP_COLORS: Record<string, string> = {
  positive: '#10b981',
  negative: '#ef4444',
  neutral: '#6b7280',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatVal(value: number, metric: string): string {
  if (metric.includes('Rate') || metric.includes('ER')) {
    return `${value.toFixed(2)}%`;
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return formatVietnamNumber(value);
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-56" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-6">
            <Skeleton className="h-4 w-32 mb-5" />
            <div className="space-y-3">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-xl p-5">
          <Skeleton className="h-4 w-36 mb-4" />
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <Skeleton className="h-4 w-36 mb-4" />
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <Skeleton className="h-4 w-48 mb-4" />
        <Skeleton className="h-[200px] w-full rounded-lg" />
      </div>
    </div>
  );
}

// ─── Week Navigation ─────────────────────────────────────────────────────────

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

// ─── Brand Comparison Card ────────────────────────────────────────────────────

interface BrandComparisonCardProps {
  brandName: string;
  isPrimary: boolean;
  metrics: HeadToHeadPoint[];
}

function BrandComparisonCard({ brandName, isPrimary, metrics }: BrandComparisonCardProps) {
  const borderColor = isPrimary ? 'border-[#1a358b]/30' : 'border-[#10b981]/30';
  const bgColor = isPrimary ? 'bg-[#1a358b]/5' : 'bg-[#10b981]/5';
  const accentColor = isPrimary ? PRIMARY_COLOR : COMPETITOR_COLOR;

  const wins = useMemo(() => {
    return metrics.filter((m) => m.primary > m.competitor).length;
  }, [metrics]);

  return (
    <div className={`bg-card border ${borderColor} rounded-xl p-6 ${bgColor}`}>
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${accentColor}20` }}
        >
          <Trophy className="w-5 h-5" style={{ color: accentColor }} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{brandName}</h3>
            {isPrimary && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                style={{ backgroundColor: `${PRIMARY_COLOR}15`, color: PRIMARY_COLOR }}
              >
                PRIMARY
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {wins} / {metrics.length} metrics won
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {metrics.map((m) => {
          const primaryIsWinner = m.primary > m.competitor;
          const isTie = m.primary === m.competitor;
          const Icon = METRIC_ICONS[m.metric] ?? BarChart3;

          return (
            <div key={m.metric} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{m.metric}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    primaryIsWinner ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {formatVal(m.primary, m.metric)}
                </span>
                {primaryIsWinner && !isTie && (
                  <Trophy className="w-3 h-3 text-amber-500 flex-shrink-0" />
                )}
                {isTie && <Minus className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Radar Chart ─────────────────────────────────────────────────────────────

interface RadarChartSectionProps {
  data: RadarPoint[];
  primaryName: string;
  competitorName: string;
}

function RadarChartSection({ data, primaryName, competitorName }: RadarChartSectionProps) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Performance Radar
        </h3>
        <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
          No radar data available.
        </div>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    metric: d.metric,
    [primaryName]: d.primary,
    [competitorName]: d.competitor,
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
        <Target className="w-4 h-4" />
        Performance Radar
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <RechartsRadarChart cx="50%" cy="50%" margin={{ top: 0, right: 24, bottom: 0, left: 24 }}>
          <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.6} />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            stroke="hsl(var(--border))"
            strokeOpacity={0.4}
          />
          <Radar
            name={primaryName}
            dataKey={primaryName}
            stroke={PRIMARY_COLOR}
            fill={PRIMARY_COLOR}
            fillOpacity={0.25}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
            connectNulls
          />
          <Radar
            name={competitorName}
            dataKey={competitorName}
            stroke={COMPETITOR_COLOR}
            fill={COMPETITOR_COLOR}
            fillOpacity={0.25}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
            connectNulls
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              fontSize: 12,
            }}
            formatter={(value: number) => [`${value}`, '']}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Head-to-Head Bar Chart ───────────────────────────────────────────────────

interface HeadToHeadChartProps {
  data: HeadToHeadPoint[];
  primaryName: string;
  competitorName: string;
}

function HeadToHeadChart({ data, primaryName, competitorName }: HeadToHeadChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Head-to-Head Comparison
        </h3>
        <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
          No comparison data available.
        </div>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    metric: d.metric,
    [primaryName]: d.primary,
    [competitorName]: d.competitor,
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
        <BarChart3 className="w-4 h-4" />
        Head-to-Head Comparison
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          barCategoryGap="30%"
        >
          <XAxis
            dataKey="metric"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) =>
              v >= 1_000_000
                ? `${(v / 1_000_000).toFixed(1)}M`
                : v >= 1_000
                  ? `${(v / 1_000).toFixed(0)}K`
                  : String(v)
            }
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(value: number) => [formatCompact(value), '']}
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar dataKey={primaryName} fill={PRIMARY_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Bar
            dataKey={competitorName}
            fill={COMPETITOR_COLOR}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
      {/* Metric winner indicators */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {data.map((d) => {
          const primaryWins = d.primary > d.competitor;
          const tie = d.primary === d.competitor;
          return (
            <div key={d.metric} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{d.metric}</span>
              <span
                className={`font-semibold ${
                  primaryWins ? 'text-[#1a358b]' : tie ? 'text-muted-foreground' : 'text-[#10b981]'
                }`}
              >
                {primaryWins ? '▲' : tie ? '—' : '▼'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Gap Analysis Chart ──────────────────────────────────────────────────────

interface GapAnalysisChartProps {
  data: GapPoint[];
}

function GapAnalysisChart({ data }: GapAnalysisChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Gap Analysis — Primary vs Competitors
        </h3>
        <div className="py-8 text-center text-sm text-muted-foreground">
          No gap analysis data available.
        </div>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    metric: d.metric,
    gap: d.gap,
    fill: GAP_COLORS[d.category],
  }));

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.gap)), 20);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Gap Analysis — Primary vs Competitors
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#10b981]" />
            <span className="text-muted-foreground">Primary ahead</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#ef4444]" />
            <span className="text-muted-foreground">Primary behind</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#6b7280]" />
            <span className="text-muted-foreground">Neutral</span>
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(chartData.length * 48, 160)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ left: 0, right: 60, top: 4, bottom: 4 }}
        >
          <XAxis
            type="number"
            domain={[-maxAbs, maxAbs]}
            tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}`}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="metric"
            type="category"
            width={100}
            tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]!.payload as { metric: string; gap: number; fill: string };
              const sign = d.gap > 0 ? '+' : '';
              return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
                  <p className="font-semibold mb-1">{d.metric}</p>
                  <p className="text-muted-foreground">
                    Gap:{' '}
                    <span className="font-medium" style={{ color: d.fill }}>
                      {sign}
                      {d.gap.toFixed(1)}
                    </span>
                  </p>
                </div>
              );
            }}
          />
          <ReferenceLine x={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
          <Bar
            dataKey="gap"
            radius={[0, 4, 4, 0]}
            label={{
              position: 'right',
              formatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`,
              fontSize: 11,
              fill: 'hsl(var(--muted-foreground))',
            }}
          >
            {chartData.map((entry) => (
              <Cell key={entry.metric} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BenchmarkPage() {
  const { data, loading, error, refetch } = useDashboardData<BenchmarkData>('benchmark');

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

  if (!data || !data.week) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 gap-4">
        <LayoutDashboard className="w-8 h-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No benchmark data available for this week.</p>
        <p className="text-xs text-muted-foreground">Select a different week or client group.</p>
      </div>
    );
  }

  const { week, radar, head_to_head, gap_analysis, primary_brand, competitor_brand } = data;

  const primaryName = primary_brand ?? 'Primary Brand';
  const competitorName = competitor_brand ?? 'Competitor';

  // Each brand card shows the primary/competitor values side by side,
  // so we pass the full head_to_head array to both cards and let the card
  // component show the appropriate side based on isPrimary prop.
  return (
    <div className="p-6 space-y-5">
      {/* Page header + WeekNav */}
      <div className="dashboard-reveal flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Benchmark Analysis</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {primaryName} vs {competitorName}
          </p>
        </div>
        <WeekNav weekLabel={week.label} />
      </div>

      {/* Brand Comparison Cards — side by side */}
      <div className="dashboard-reveal grid grid-cols-1 md:grid-cols-2 gap-4">
        <BrandComparisonCard
          brandName={primaryName}
          isPrimary
          metrics={head_to_head}
        />
        <BrandComparisonCard
          brandName={competitorName}
          isPrimary={false}
          metrics={head_to_head}
        />
      </div>

      {/* Radar + Head-to-Head charts */}
      <div className="dashboard-reveal grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RadarChartSection
          data={radar}
          primaryName={primaryName}
          competitorName={competitorName}
        />
        <HeadToHeadChart
          data={head_to_head}
          primaryName={primaryName}
          competitorName={competitorName}
        />
      </div>

      {/* Gap Analysis */}
      <div className="dashboard-reveal">
        <GapAnalysisChart data={gap_analysis} />
      </div>
    </div>
  );
}
