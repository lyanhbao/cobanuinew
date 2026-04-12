'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { useScrollReveal, useMultiScrollReveal } from '@/lib/use-scroll-reveal';
import { useCountUp } from '@/lib/use-count-up';
import { useSpotlight } from '@/lib/use-spotlight';
import { formatVietnamNumber, formatCompact } from '@/lib/vietnam-format';
import { useApp } from '@/context/AppContext';
import { AnimatedSphere } from '@/components/landing/animated-sphere';
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
import {
  Eye,
  ThumbsUp,
  FileText,
  TrendingUp,
  Percent,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

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
    sov_primary: number;
  };
  sov: Array<{
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

const PRIMARY_BAR = '#1a358b';
const COMPETITOR_COLORS = ['#3b5cb8', '#6b84cc', '#9bade0', '#c8d4f0'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function TrendArrow({ value }: { value: number }) {
  if (value > 0) return <span className="text-green-600 font-medium">▲</span>;
  if (value < 0) return <span className="text-red-600 font-medium">▼</span>;
  return <span className="text-muted-foreground font-medium">—</span>;
}

// ─── Hero Entrance ─────────────────────────────────────────────────────────────

function useHeroEntrance() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return isVisible;
}

// ─── Animated Counter ─────────────────────────────────────────────────────────

interface AnimatedKpiValueProps {
  value: number;
  format: 'compact' | 'number' | 'percent';
}

function AnimatedKpiValue({ value, format }: AnimatedKpiValueProps) {
  const decimals = format === 'percent' ? 1 : 0;
  const { value: displayValue, start } = useCountUp(value, { duration: 800, decimals });
  const ref = useRef<HTMLParagraphElement>(null);
  const hasStarted = useRef(false);

  const handleIntersect = useCallback(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    start();
  }, [start]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          handleIntersect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  const displayStr =
    format === 'percent'
      ? `${displayValue}%`
      : format === 'compact'
        ? formatCompact(displayValue)
        : formatVietnamNumber(displayValue);

  return (
    <p ref={ref} className="text-2xl font-bold tabular-nums tracking-tight kpi-counter-reveal">
      {displayStr}
    </p>
  );
}

// ─── Spotlight Card ───────────────────────────────────────────────────────────

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
}

function SpotlightCard({ children, className = '' }: SpotlightCardProps) {
  const { containerProps } = useSpotlight();

  return (
    <div
      className={`relative overflow-hidden spotlight-container card-lift ${className}`}
      {...containerProps}
    >
      {children}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  change?: number;
  format?: 'compact' | 'number' | 'percent';
  delay?: number;
}

function KpiCard({ icon: Icon, label, value, change, format = 'compact', delay = 0 }: KpiCardProps) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1, delay });

  const changeStr =
    change !== undefined ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%` : null;

  return (
    <div
      ref={ref}
      className={`transition-all duration-400 ${isVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <SpotlightCard>
        <Card className="relative overflow-hidden kpi-card-gradient h-full">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
                  {label}
                </p>
                <AnimatedKpiValue value={value} format={format} />
                {changeStr !== null && change !== undefined && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <TrendArrow value={change!} />
                    <span
                      className={`text-xs font-medium ${change! >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {changeStr}
                    </span>
                    <span className="text-xs text-muted-foreground">vs prev week</span>
                  </div>
                )}
              </div>
              <div className="ml-3 p-2.5 bg-muted rounded-lg flex-shrink-0">
                <Icon className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </SpotlightCard>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-3 w-20 mb-3 skeleton-shimmer" />
              <Skeleton className="h-8 w-16 mb-2 skeleton-shimmer" />
              <Skeleton className="h-3 w-24 skeleton-shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <Skeleton className="h-52 w-full rounded-lg skeleton-shimmer" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardContent className="p-5">
            <Skeleton className="h-52 w-full rounded-lg skeleton-shimmer" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="w-5 h-5" />
        <span className="text-sm font-medium">{message}</span>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="w-4 h-4" />
        Retry
      </Button>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <p className="text-sm text-muted-foreground">No data for this week</p>
    </div>
  );
}

// ─── SOV Tooltip ─────────────────────────────────────────────────────────────

function SovTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { brand_name: string; impressions: number; sov_pct: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
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
}

// ─── Network Tooltip ──────────────────────────────────────────────────────────

function NetworkTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { platform: string; impressions: number; pct: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
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
}

// ─── Staggered KPI Grid ─────────────────────────────────────────────────────

function StaggeredKpiGrid({ kpis }: { kpis: OverviewData['kpis'] }) {
  const { containerRef, isVisible } = useMultiScrollReveal<HTMLDivElement>(6, {
    threshold: 0.05,
    rootMargin: '0px 0px -20px 0px',
  });

  return (
    <div
      ref={containerRef}
      className={`grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 ${isVisible ? 'stagger-children is-visible' : 'stagger-children'}`}
    >
      <KpiCard icon={Eye} label="Impressions" value={kpis.total_impressions} />
      <KpiCard icon={TrendingUp} label="Views" value={kpis.total_views} />
      <KpiCard icon={ThumbsUp} label="Reactions" value={kpis.total_reactions} />
      <KpiCard icon={FileText} label="Posts" value={kpis.total_posts} />
      <KpiCard icon={Percent} label="Avg ER" value={kpis.avg_engagement_rate} format="percent" />
      <KpiCard icon={TrendingUp} label="SOV (Primary)" value={kpis.sov_primary} format="percent" />
    </div>
  );
}

// ─── Charts Row ──────────────────────────────────────────────────────────────

function ChartsRow({
  sovChartData,
  networkBreakdown,
}: {
  sovChartData: Array<{ brand_name: string; is_primary: boolean; impressions: number; sov_pct: number; color: string }>;
  networkBreakdown: OverviewData['network_breakdown'];
}) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.05, delay: 100 });
  const { ref: donutRef, isVisible: donutVisible } = useScrollReveal<HTMLDivElement>({
    threshold: 0.05,
    delay: 200,
  });
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* SOV Horizontal Bar */}
      <div
        ref={ref}
        className={`lg:col-span-2 ${isVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'}`}
      >
        <SpotlightCard className="card-hover">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Share of Voice — Impressions
                </h3>
                {sovChartData.find((d) => d.is_primary) && (
                  <Badge variant="outline" className="text-xs glow-sm">
                    Primary Brand
                  </Badge>
                )}
              </div>
              <ResponsiveContainer width="100%" height={Math.max(sovChartData.length * 52, 200)}>
                <BarChart
                  data={sovChartData}
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
                  <Tooltip content={<SovTooltip />} />
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
                    {sovChartData.map((entry) => (
                      <Cell
                        key={entry.brand_name}
                        fill={entry.color}
                        className={entry.is_primary ? 'glow-sm' : ''}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </SpotlightCard>
      </div>

      {/* Network Distribution Donut */}
      <div
        ref={donutRef}
        className={`${donutVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'}`}
        style={{ transitionDelay: '100ms' }}
      >
        <SpotlightCard className="h-full">
          <Card className="h-full">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Network Distribution
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={networkBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={78}
                    paddingAngle={3}
                    dataKey="pct"
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {networkBreakdown.map((entry, idx) => (
                      <Cell
                        key={entry.platform}
                        fill={PLATFORM_COLORS[entry.platform] ?? '#888'}
                        className={activeIndex === idx ? 'glow-md' : ''}
                        style={{
                          filter: activeIndex === idx ? 'drop-shadow(0 0 8px)' : 'none',
                          transition: 'filter 0.2s ease',
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<NetworkTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2.5">
                {networkBreakdown.map((item) => (
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
            </CardContent>
          </Card>
        </SpotlightCard>
      </div>
    </div>
  );
}

// ─── Insights Feed ───────────────────────────────────────────────────────────

function InsightsFeed({ insights }: { insights: OverviewData['insights'] }) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1, delay: 150 });

  return (
    <div
      ref={ref}
      className={`${isVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'}`}
    >
      <SpotlightCard className="card-hover">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-[#1a358b]" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Quick Insights
              </h3>
            </div>
            <div className="space-y-3">
              {insights.map((insight, i) => {
                const isUp = insight.direction === 'up';
                const isDown = insight.direction === 'down';
                const icon = isUp ? '▲' : isDown ? '▼' : '—';
                const colorClass = isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-muted-foreground';

                return (
                  <div
                    key={`${insight.brand_name}-${insight.metric}`}
                    className="flex items-start gap-3 text-sm"
                    style={{
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible ? 'translateY(0)' : 'translateY(4px)',
                      transition: `opacity 0.4s ease-out ${i * 60}ms, transform 0.4s ease-out ${i * 60}ms`,
                    }}
                  >
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
          </CardContent>
        </Card>
      </SpotlightCard>
    </div>
  );
}

// ─── Marquee Stats ───────────────────────────────────────────────────────────

interface MarqueeStatsProps {
  kpis: OverviewData['kpis'];
}

function MarqueeStats({ kpis }: MarqueeStatsProps) {
  const stats = [
    { value: formatCompact(kpis.total_impressions), label: 'Impressions', brand: 'COBAN' },
    { value: formatCompact(kpis.total_views), label: 'Views', brand: 'COBAN' },
    { value: formatCompact(kpis.total_reactions), label: 'Reactions', brand: 'COBAN' },
    { value: `${kpis.total_posts}`, label: 'Posts this week', brand: 'COBAN' },
    { value: kpis.sov_primary != null ? `${kpis.sov_primary.toFixed(1)}%` : '—', label: 'Primary SOV', brand: 'COBAN' },
  ];

  return (
    <div className="flex gap-12 marquee whitespace-nowrap overflow-hidden">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="flex gap-12 flex-shrink-0">
          {stats.map((stat) => (
            <div key={`${stat.label}-${i}`} className="flex items-baseline gap-3">
              <span className="text-2xl lg:text-3xl font-display tracking-tight">{stat.value}</span>
              <span className="text-xs text-muted-foreground">
                {stat.label}
                <span className="block font-mono text-[10px] mt-0.5 text-muted-foreground/60">{stat.brand}</span>
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Sphere Background ────────────────────────────────────────────────────────

function SphereBackground() {
  return (
    <div
      className="absolute right-0 top-0 w-[300px] h-[300px] lg:w-[400px] lg:h-[400px] opacity-25 pointer-events-none"
      aria-hidden="true"
    >
      <AnimatedSphere />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { selectedWeek, availableWeeks, setSelectedWeek } = useApp();
  const { data, loading, error, refetch } = useDashboardData<OverviewData>('overview');
  const heroVisible = useHeroEntrance();

  const weekIndex = availableWeeks.indexOf(selectedWeek ?? '');
  const hasPrev = weekIndex > 0 && weekIndex < availableWeeks.length;
  const hasNext = weekIndex >= 0 && weekIndex < availableWeeks.length - 1;

  const goPrev = () => {
    const idx = availableWeeks.indexOf(selectedWeek ?? '');
    if (idx > 0) setSelectedWeek(availableWeeks[idx - 1]);
  };
  const goNext = () => {
    const idx = availableWeeks.indexOf(selectedWeek ?? '');
    if (idx >= 0 && idx < availableWeeks.length - 1) setSelectedWeek(availableWeeks[idx + 1]);
  };

  if (loading) return <div className="p-6"><LoadingSkeleton /></div>;
  if (error) return <div className="p-6"><ErrorState message={error} onRetry={refetch} /></div>;
  if (!data) return <div className="p-6"><EmptyState /></div>;

  const kpis = data.kpis;

  const sovChartData = data.sov.map((item, i) => ({
    ...item,
    color: item.is_primary ? PRIMARY_BAR : COMPETITOR_COLORS[i % COMPETITOR_COLORS.length],
  }));

  return (
    <div className="p-6 space-y-6 noise-overlay">
      {/* Subtle grid overlay */}
      <div className="fixed inset-0 pointer-events-none dashboard-grid-overlay -z-10" aria-hidden="true" />

      {/* Animated sphere */}
      <SphereBackground />

      {/* Week navigation — hero entrance */}
      <div
        className={`hero-entrance ${heroVisible ? 'entrance-visible' : 'entrance-hidden'}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={goPrev}
              disabled={!hasPrev}
              className="p-1.5 rounded-full hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-4 py-1.5 week-nav-pill dark:week-nav-pill-dark">
              <span className="text-sm font-medium tabular-nums">{data.week.label}</span>
            </div>
            <button
              onClick={goNext}
              disabled={!hasNext}
              className="p-1.5 rounded-full hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards — staggered entrance */}
      <StaggeredKpiGrid kpis={kpis} />

      {/* Charts row */}
      <ChartsRow sovChartData={sovChartData} networkBreakdown={data.network_breakdown} />

      {/* Insights feed */}
      {data.insights.length > 0 && <InsightsFeed insights={data.insights} />}

      {/* Marquee ticker */}
      <div
        className={`border-t border-border pt-5 mt-2 ${heroVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'}`}
        style={{ transitionDelay: '400ms' }}
      >
        <MarqueeStats kpis={kpis} />
      </div>
    </div>
  );
}
