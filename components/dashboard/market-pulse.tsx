'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { formatCompact } from '@/lib/vietnam-format';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MarketPulseData {
  score: number | null;
  trend: 'up' | 'down' | 'stable' | null;
  breakdown: {
    spend: { value: number; delta: number; label: string; performance: 'positive' | 'negative' };
    engagement: { value: number; delta: number; label: string; performance: 'positive' | 'negative' };
    frequency: { value: number; delta: number; label: string; performance: 'positive' | 'negative' };
    sovShift: { value: number; delta: number; label: string; performance: 'positive' | 'negative' };
  } | null;
  week: { label: string; start: string; number: number; year: number } | null;
}

// ─── Radial Gauge ─────────────────────────────────────────────────────────────

function RadialGauge({ score }: { score: number }) {
  const [animated, setAnimated] = useState(false);
  const [needleAngle, setNeedleAngle] = useState(-135);
  const svgRef = useRef<SVGSVGElement>(null);

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = 90;
  const innerRadius = 60;
  const trackWidth = 14;

  // Arc from -135deg to +135deg (270deg sweep)
  const startAngle = -135;
  const endAngle = 135;
  const sweepAngle = endAngle - startAngle; // 270

  function polarToXY(angleDeg: number, r: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function arcPath(r: number, startDeg: number, endDeg: number) {
    const start = polarToXY(startDeg, r);
    const end = polarToXY(endDeg, r);
    const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  // Color based on score
  function scoreColor(s: number) {
    if (s >= 70) return '#22c55e'; // green
    if (s >= 40) return '#3b82f6'; // blue
    if (s >= 20) return '#f59e0b'; // amber
    return '#ef4444'; // red
  }

  const gaugeColor = scoreColor(score);
  const fillEndAngle = startAngle + (score / 100) * sweepAngle;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimated(true);
      // Animate needle from -135 to target
      const targetAngle = startAngle + (score / 100) * sweepAngle;
      const duration = 1200;
      const start = performance.now();
      const fromAngle = startAngle;

      function animate(now: number) {
        const t = Math.min((now - start) / duration, 1);
        // Ease out cubic
        const ease = 1 - Math.pow(1 - t, 3);
        setNeedleAngle(fromAngle + (targetAngle - fromAngle) * ease);
        if (t < 1) requestAnimationFrame(animate);
      }
      requestAnimationFrame(animate);
    }, 200);
    return () => clearTimeout(timer);
  }, [score]);

  // Tick marks
  const ticks = [0, 25, 50, 75, 100];
  const tickLabels = ['0', '25', '50', '75', '100'];

  return (
    <div className="relative flex items-center justify-center">
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        {/* Glow filter */}
        <defs>
          <filter id="gauge-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="pulse-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer glow ring */}
        <circle
          cx={cx}
          cy={cy}
          r={outerRadius + 4}
          fill="none"
          stroke={gaugeColor}
          strokeWidth="2"
          opacity={animated ? 0.15 : 0}
          style={{ filter: 'blur(4px)' }}
        />

        {/* Track (background arc) */}
        <path
          d={arcPath(cx, startAngle, endAngle)}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={trackWidth}
          strokeLinecap="round"
          opacity={0.3}
        />

        {/* Filled arc */}
        <path
          d={arcPath(cx, startAngle, animated ? fillEndAngle : startAngle)}
          fill="none"
          stroke={gaugeColor}
          strokeWidth={trackWidth}
          strokeLinecap="round"
          filter="url(#gauge-glow)"
          style={{
            transition: 'none',
          }}
        />

        {/* Tick marks */}
        {ticks.map((tick, i) => {
          const angle = startAngle + (tick / 100) * sweepAngle;
          const inner = polarToXY(angle, innerRadius - trackWidth / 2 - 4);
          const outer = polarToXY(angle, innerRadius - trackWidth / 2 - 8);
          return (
            <line
              key={tick}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="1.5"
              opacity={0.4}
            />
          );
        })}

        {/* Tick labels */}
        {ticks.map((tick, i) => {
          const angle = startAngle + (tick / 100) * sweepAngle;
          const pos = polarToXY(angle, innerRadius - trackWidth / 2 - 16);
          return (
            <text
              key={tick}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="9"
              fill="hsl(var(--muted-foreground))"
              opacity="0.6"
            >
              {tickLabels[i]}
            </text>
          );
        })}

        {/* Needle */}
        {(() => {
          const tip = polarToXY(needleAngle, innerRadius - 10);
          const base1 = polarToXY(needleAngle - 90, 8);
          const base2 = polarToXY(needleAngle + 90, 8);
          const baseCx = cx;
          const baseCy = cy;
          return (
            <>
              <line
                x1={cx}
                y1={cy}
                x2={tip.x}
                y2={tip.y}
                stroke={gaugeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                filter="url(#gauge-glow)"
              />
              <circle
                cx={cx}
                cy={cy}
                r={8}
                fill={gaugeColor}
                opacity={0.9}
                filter="url(#pulse-glow)"
              />
              <circle
                cx={cx}
                cy={cy}
                r={5}
                fill="hsl(var(--background))"
              />
            </>
          );
        })()}

        {/* Score text */}
        <text
          x={cx}
          y={cy + 28}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="28"
          fontWeight="700"
          fontFamily="var(--font-display, inherit)"
          fill="hsl(var(--foreground))"
          className="tabular-nums"
        >
          {animated ? score : '—'}
        </text>
        <text
          x={cx}
          y={cy + 46}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="9"
          fill="hsl(var(--muted-foreground))"
        >
          PULSE SCORE
        </text>
      </svg>
    </div>
  );
}

// ─── Sub-metric Bar ─────────────────────────────────────────────────────────────

function SubMetricBar({
  label,
  value,
  delta,
  performance,
}: {
  label: string;
  value: number;
  delta: number;
  performance: 'positive' | 'negative';
}) {
  const barColor = performance === 'positive' ? '#22c55e' : '#ef4444';
  const deltaStr = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <span className={`text-xs font-semibold tabular-nums ${performance === 'positive' ? 'text-green-500' : 'text-red-500'}`}>
          {deltaStr}
        </span>
      </div>
      <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.min(100, Math.max(0, 50 + delta * 2))}%`,
            backgroundColor: barColor,
            boxShadow: `0 0 6px ${barColor}80`,
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {formatCompact(value)} {label === 'Industry Spend' ? '₫' : ''}
      </p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row items-center gap-8">
          <Skeleton className="w-56 h-56 rounded-full skeleton-shimmer" />
          <div className="flex-1 space-y-4 w-full">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-24 skeleton-shimmer" />
                <Skeleton className="h-1.5 w-full skeleton-shimmer" />
                <Skeleton className="h-3 w-16 skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Error / Empty ────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="p-6 flex flex-col items-center justify-center py-12 gap-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{message}</span>
        </div>
        <button
          onClick={onRetry}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="p-6 flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No market pulse data available</p>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function MarketPulse() {
  const { data, loading, error, refetch } = useDashboardData<MarketPulseData>('market-pulse');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data || data.score === null || !data.breakdown) return <EmptyState />;

  const { score, trend, breakdown, week } = data;

  const trendColor =
    trend === 'up' ? 'text-green-500' :
    trend === 'down' ? 'text-red-500' :
    'text-muted-foreground';
  const trendLabel =
    trend === 'up' ? 'Trending Up' :
    trend === 'down' ? 'Trending Down' :
    'Stable';

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row items-center gap-8">
          {/* Radial Gauge */}
          <div className="flex-shrink-0">
            <RadialGauge score={score} />
          </div>

          {/* Breakdown */}
          <div className="flex-1 space-y-5 w-full">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Market Pulse
                </h3>
                {week && (
                  <p className="text-xs text-muted-foreground mt-0.5">{week.label}</p>
                )}
              </div>
              <div className={`flex items-center gap-1.5 text-sm font-medium ${trendColor}`}>
                <span className={`w-2 h-2 rounded-full ${
                  trend === 'up' ? 'bg-green-500 animate-pulse' :
                  trend === 'down' ? 'bg-red-500' :
                  'bg-muted-foreground'
                }`} />
                {trendLabel}
              </div>
            </div>

            <div className="space-y-4">
              <SubMetricBar
                label={breakdown.spend.label}
                value={breakdown.spend.value}
                delta={breakdown.spend.delta}
                performance={breakdown.spend.performance}
              />
              <SubMetricBar
                label={breakdown.engagement.label}
                value={breakdown.engagement.value}
                delta={breakdown.engagement.delta}
                performance={breakdown.engagement.performance}
              />
              <SubMetricBar
                label={breakdown.frequency.label}
                value={breakdown.frequency.value}
                delta={breakdown.frequency.delta}
                performance={breakdown.frequency.performance}
              />
              <SubMetricBar
                label={breakdown.sovShift.label}
                value={breakdown.sovShift.value}
                delta={breakdown.sovShift.delta}
                performance={breakdown.sovShift.performance}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
