'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from 'recharts';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { useScrollReveal } from '@/lib/use-scroll-reveal';
import { formatCompact } from '@/lib/vietnam-format';
import { RefreshCw, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BenchmarkData {
  week: { label: string; start: string; number: number; year: number };
  radar: Array<{ metric: string; primary: number; competitor: number }>;
  head_to_head: Array<{
    metric: string;
    primary: number;
    competitor: number;
    primary_label?: string;
    competitor_label?: string;
  }>;
  gap_analysis: Array<{
    metric: string;
    gap: number;
    category: 'positive' | 'negative' | 'neutral';
  }>;
  primary_brand?: string;
  competitor_brand?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY_COLOR = '#1a358b';
const COMPETITOR_COLOR = '#6b84cc';

// ─── Spotlight Card ───────────────────────────────────────────────────────────

function LocalSpotlightCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <div
      className={`relative overflow-hidden spotlight-container hover-lift ${className}`}
      onMouseMove={handleMouseMove}
      style={
        {
          '--mouse-x': `${mousePos.x}%`,
          '--mouse-y': `${mousePos.y}%`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

// ─── Radar Tooltip ───────────────────────────────────────────────────────────

function RadarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; stroke: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm space-y-1">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-3 h-0.5" style={{ backgroundColor: p.stroke }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium tabular-nums">{p.value}/100</span>
        </div>
      ))}
    </div>
  );
}

// ─── Gap Bar Tooltip ─────────────────────────────────────────────────────────

function GapTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0]!.value;
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm glow-sm">
      <p className="font-semibold mb-1">{label}</p>
      <p className={v >= 0 ? 'text-green-600' : 'text-red-600'}>
        {v >= 0 ? '▲' : '▼'} {Math.abs(v).toFixed(1)}pp vs Competitor
      </p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64 skeleton-shimmer" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-80 w-full skeleton-shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-5">
          <Skeleton className="h-64 w-full skeleton-shimmer" />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Error / Empty ────────────────────────────────────────────────────────────

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <p className="text-sm text-muted-foreground">No benchmark data available</p>
    </div>
  );
}

// ─── Head-to-Head Item ───────────────────────────────────────────────────────

function HeadToHeadItem({
  item,
  primary_brand,
  competitor_brand,
  index,
}: {
  item: BenchmarkData['head_to_head'][0];
  primary_brand?: string;
  competitor_brand?: string;
  index: number;
}) {
  const total = item.primary + item.competitor;
  const primaryPct = total > 0 ? (item.primary / total) * 100 : 50;
  const diff = item.primary - item.competitor;
  const diffPct =
    item.competitor > 0
      ? ((item.primary - item.competitor) / item.competitor) * 100
      : 0;
  const isPositive = diff >= 0;

  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({
    threshold: 0.05,
    delay: index * 60,
  });

  return (
    <div
      ref={ref}
      className={isVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'}
      style={{ transitionDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{item.metric}</span>
        <span
          className={`text-xs flex items-center gap-1 font-medium ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {isPositive ? '+' : ''}
          {diffPct.toFixed(1)}%
        </span>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
        <div
          className="transition-all duration-700 ease-out bar-grow-up"
          style={{
            width: `${primaryPct}%`,
            backgroundColor: PRIMARY_COLOR,
          }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {primary_brand ?? 'Primary'}:{' '}
          {item.primary >= 1000
            ? formatCompact(item.primary)
            : item.primary.toFixed(item.primary < 10 ? 1 : 0)}
        </span>
        <span className="tabular-nums">
          {competitor_brand ?? 'Competitor'}:{' '}
          {item.competitor >= 1000
            ? formatCompact(item.competitor)
            : item.competitor.toFixed(item.competitor < 10 ? 1 : 0)}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BenchmarkPage() {
  const { data, loading, error, refetch } =
    useDashboardData<BenchmarkData>('benchmark');
  const { ref: chartsRef, isVisible: chartsVisible } =
    useScrollReveal<HTMLDivElement>({ threshold: 0.05, delay: 80 });
  const { ref: gapRef, isVisible: gapVisible } = useScrollReveal<HTMLDivElement>(
    { threshold: 0.05, delay: 150 }
  );
  const { ref: sectionRef, isVisible: sectionVisible } =
    useScrollReveal<HTMLDivElement>({ threshold: 0.1 });

  if (loading) return <div className="p-6"><LoadingSkeleton /></div>;
  if (error)
    return (
      <div className="p-6">
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  if (!data) return <div className="p-6"><EmptyState /></div>;

  const {
    radar,
    head_to_head,
    gap_analysis,
    primary_brand,
    competitor_brand,
  } = data;

  return (
    <div className="p-6 space-y-6 noise-overlay">
      {/* Subtle grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none dashboard-grid-overlay -z-10"
        aria-hidden="true"
      />

      {/* Header */}
      <div
        ref={sectionRef}
        className={`section-header-reveal ${sectionVisible ? 'is-visible' : ''}`}
      >
        <div>
          <h2 className="text-xl font-bold">Benchmark</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Comparative analysis — {primary_brand ?? 'Primary Brand'} vs{' '}
            {competitor_brand ?? 'Competitor'}
          </p>
        </div>
      </div>

      {/* Charts row */}
      <div
        ref={chartsRef}
        className={`grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-children ${
          chartsVisible ? 'is-visible' : ''
        }`}
      >
        {/* Radar Chart */}
        <div
          className={
            chartsVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'
          }
        >
          <LocalSpotlightCard>
            <Card>
              <CardContent className="p-5">
                <div className="relative">
                  <div
                    className="absolute inset-0 rounded-b-lg pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(ellipse at 50% 40%, oklch(0.9 0.08 266 / 0.15) 0%, transparent 70%)',
                      zIndex: 0,
                    }}
                  />
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Performance Radar
                    </h3>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5 bg-foreground" />
                        <span>{primary_brand ?? 'Primary'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5 bg-muted-foreground" />
                        <span>{competitor_brand ?? 'Competitor'}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Normalized scores (0-100) per metric dimension
                  </p>
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart
                      data={radar}
                      margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
                    >
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis
                        dataKey="metric"
                        tick={{ fontSize: 11 }}
                        className="fill-muted-foreground"
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tick={{ fontSize: 10 }}
                        className="fill-muted-foreground"
                        axisLine={false}
                      />
                      <Radar
                        name={primary_brand ?? 'Primary'}
                        dataKey="primary"
                        stroke={PRIMARY_COLOR}
                        fill={PRIMARY_COLOR}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                      <Radar
                        name={competitor_brand ?? 'Competitor'}
                        dataKey="competitor"
                        stroke={COMPETITOR_COLOR}
                        fill={COMPETITOR_COLOR}
                        fillOpacity={0.1}
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                      />
                      <Tooltip content={<RadarTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </LocalSpotlightCard>
        </div>

        {/* Head-to-Head Comparison */}
        <div
          className={
            chartsVisible
              ? 'dashboard-reveal is-visible'
              : 'dashboard-reveal'
          }
          style={{ transitionDelay: '100ms' }}
        >
          <LocalSpotlightCard>
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Head-to-Head — Direct comparison
                </h3>
                <div className="space-y-5">
                  {head_to_head.map((item, i) => (
                    <HeadToHeadItem
                      key={item.metric}
                      item={item}
                      primary_brand={primary_brand}
                      competitor_brand={competitor_brand}
                      index={i}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </LocalSpotlightCard>
        </div>
      </div>

      {/* Gap Analysis */}
      <div
        ref={gapRef}
        className={gapVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'}
      >
        <LocalSpotlightCard className="card-hover">
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Gap Analysis — Performance gap
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Positive = ahead of competitor. Negative = behind competitor.
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={gap_analysis}
                  margin={{ left: 20, right: 20, top: 10, bottom: 10 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="metric"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}pp`}
                  />
                  <Tooltip content={<GapTooltip />} />
                  <Bar dataKey="gap" name="Gap (pp)" radius={[4, 4, 0, 0]}>
                    {gap_analysis.map((entry) => (
                      <Cell
                        key={entry.metric}
                        fill={
                          entry.category === 'positive'
                            ? '#16a34a'
                            : entry.category === 'negative'
                            ? '#dc2626'
                            : '#888888'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </LocalSpotlightCard>
      </div>
    </div>
  );
}
