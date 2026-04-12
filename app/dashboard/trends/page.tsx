'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  useDashboardData,
} from '@/lib/use-dashboard-data';
import { useScrollReveal, useMultiScrollReveal } from '@/lib/use-scroll-reveal';
import { formatCompact } from '@/lib/vietnam-format';
import {
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Flame,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type MetricKey = 'impressions' | 'views' | 'engagement' | 'posts';

interface TrendsData {
  brands: Array<{ id: string; name: string }>;
  trend_data: Array<{
    week: string;
    [brand: string]: string | number;
  }>;
  anomalies: Array<{
    id: string;
    brand_name: string;
    type: string;
    description: string;
    severity: 'info' | 'warning' | 'critical';
    week: string;
  }>;
  average?: Record<string, number>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const METRIC_OPTIONS: { value: MetricKey; label: string }[] = [
  { value: 'impressions', label: 'Impressions' },
  { value: 'views', label: 'Views' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'posts', label: 'Posts' },
];

const SEVERITY_STYLES: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  critical: { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', icon: TrendingDown },
  warning: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', icon: AlertTriangle },
  info: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400', icon: TrendingUp },
};

const BRAND_PALETTE = [
  '#1a358b',
  '#dc2626',
  '#2563eb',
  '#16a34a',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#db2777',
];

// ─── Hero Entrance ─────────────────────────────────────────────────────────────

function useHeroEntrance() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return isVisible;
}

// ─── Metric Selector ─────────────────────────────────────────────────────────

function MetricSelector({
  value,
  onChange,
}: {
  value: MetricKey;
  onChange: (v: MetricKey) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
      {METRIC_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            value === opt.value
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

function TrendsTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm space-y-1 glow-sm">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
          </div>
          <span className="font-medium tabular-nums">{formatCompact(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Anomaly Item ─────────────────────────────────────────────────────────────

function AnomalyItem({ item, index }: { item: TrendsData['anomalies'][0]; index: number }) {
  const style = SEVERITY_STYLES[item.severity] ?? SEVERITY_STYLES.info;
  const Icon = style.icon;
  const gradientClass = item.severity === 'critical'
    ? 'anomaly-critical'
    : item.severity === 'warning'
      ? 'anomaly-warning'
      : '';

  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({
    threshold: 0.1,
    delay: index * 60,
  });

  return (
    <div
      ref={ref}
      className={`
        flex items-start gap-3 p-3 rounded-lg ${style.bg} ${gradientClass}
        ${isVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'}
        hover-lift
      `}
    >
      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${style.text}`}>
        <Icon className="w-3 h-3" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-semibold text-sm">{item.brand_name}</span>
          <Badge
            variant="outline"
            className={`text-xs ${style.text} ${style.bg} border-0`}
          >
            {item.severity}
          </Badge>
          <span className="text-xs text-muted-foreground">{item.week}</span>
          <Badge variant="outline" className="text-xs">
            {item.type}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {item.description}
        </p>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-64 skeleton-shimmer" />
        <Skeleton className="h-10 w-48 skeleton-shimmer" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-28 skeleton-shimmer" />)}
      </div>
      <Card><CardContent className="p-5"><Skeleton className="h-80 w-full skeleton-shimmer" /></CardContent></Card>
      <Card><CardContent className="p-5"><Skeleton className="h-64 w-full skeleton-shimmer" /></CardContent></Card>
    </div>
  );
}

// ─── Error / Empty ────────────────────────────────────────────────────────────

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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <p className="text-sm text-muted-foreground">No trend data available</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrendsPage() {
  const [metric, setMetric] = useState<MetricKey>('impressions');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const { data, loading, error, refetch } = useDashboardData<TrendsData>('trends');
  const { ref: chartRef, isVisible: chartVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.05, delay: 80 });
  const { ref: brandRef, isVisible: brandVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.05, delay: 50 });
  const { ref: sectionRef, isVisible: sectionVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });

  // Initialize selected brands once data arrives
  useEffect(() => {
    if (data && !initialized) {
      const init = data.brands.slice(0, Math.min(3, data.brands.length)).map((b) => b.id);
      setSelectedBrands(init);
      setInitialized(true);
    }
  }, [data, initialized]);

  const toggleBrand = (id: string) => {
    setSelectedBrands((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  if (loading) return <div className="p-6"><LoadingSkeleton /></div>;
  if (error) return <div className="p-6"><ErrorState message={error} onRetry={refetch} /></div>;
  if (!data) return <div className="p-6"><EmptyState /></div>;

  const { brands, trend_data, anomalies } = data;

  // Build chart lines — activeBrands are IDs, look up name for Recharts dataKey
  const activeBrands = selectedBrands.length > 0
    ? selectedBrands
    : brands.slice(0, Math.min(1, brands.length)).map((b) => b.id);
  const chartLines = activeBrands.map((id, i) => {
    const brandObj = brands.find((b) => b.id === id);
    return {
      id,
      name: brandObj?.name ?? id,
      color: BRAND_PALETTE[i % BRAND_PALETTE.length],
      dataKey: brandObj?.name ?? id,
    };
  });

  return (
    <div className="p-6 space-y-6 noise-overlay">
      {/* Subtle grid overlay */}
      <div className="fixed inset-0 pointer-events-none dashboard-grid-overlay -z-10" aria-hidden="true" />

      {/* Header — hero entrance */}
      <div ref={sectionRef} className={`section-header-reveal ${sectionVisible ? 'is-visible' : ''}`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold">Trends</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Performance trend — Last {trend_data.length} weeks
            </p>
          </div>
          <MetricSelector value={metric} onChange={setMetric} />
        </div>
      </div>

      {/* Brand toggle */}
      <div
        ref={brandRef}
        className={`${brandVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'}`}
      >
        <Card className="hover-lift card-hover">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
              Compare brands
            </p>
            <div className="flex flex-wrap gap-3">
              {brands.map((brand, i) => {
                const isActive = selectedBrands.includes(brand.id);
                const brandColor = BRAND_PALETTE[i % BRAND_PALETTE.length];
                return (
                  <label
                    key={brand.id}
                    className={`
                      flex items-center gap-2.5 text-sm cursor-pointer select-none
                      px-3 py-1.5 rounded-lg border transition-all duration-200
                      ${isActive
                        ? 'bg-muted border-foreground/20 font-medium shadow-sm'
                        : 'border-border hover:border-foreground/30 hover:bg-muted/50'
                      }
                      ${!isActive && selectedBrands.length >= 4 ? 'opacity-40' : ''}
                    `}
                  >
                    <Checkbox
                      checked={isActive}
                      onCheckedChange={() => toggleBrand(brand.id)}
                      className="data-[state=checked]:bg-foreground data-[state=checked]:border-foreground"
                    />
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: brandColor }} />
                    <span className={isActive ? 'text-foreground' : 'text-muted-foreground'}>{brand.name}</span>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Chart */}
      <div
        ref={chartRef}
        className={`${chartVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'}`}
      >
        <Card className="hover-lift card-hover">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Performance Over Time
              </h3>
              <div className="flex items-center gap-4 text-xs">
                {chartLines.map((l) => (
                  <div key={l.id} className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: l.color }} />
                    <span className="text-muted-foreground">{l.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={trend_data} margin={{ left: 10, right: 10, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.max(0, Math.floor(trend_data.length / 8) - 1)}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatCompact(v)}
                  width={60}
                />
                <Tooltip content={<TrendsTooltip />} />
                {chartLines.map((l) => (
                  <Line
                    key={l.id}
                    type="monotone"
                    dataKey={l.dataKey}
                    name={l.name}
                    stroke={l.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <Card className="hover-lift card-hover">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-orange-500" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Anomalies & Alerts — {anomalies.length} events
              </h3>
            </div>
            <div className="space-y-3">
              {anomalies.map((item, i) => (
                <AnomalyItem key={item.id} item={item} index={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
