'use client';

import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { formatCompact } from '@/lib/vietnam-format';
import { getBrandColor } from '@/lib/brand-colors';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, AlertTriangle, BarChart2, ChevronLeft, ChevronRight, Activity } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrendsData {
  brands: Array<{ id: string; name: string }>;
  trend_data: Array<{
    week: string;
    [brandName: string]: string | number;
  }>;
  anomalies: Array<{
    id: string;
    brand_name: string;
    type: string;
    description: string;
    severity: 'critical' | 'warning' | 'info';
    week: string;
  }>;
  average?: Record<string, number>;
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-64" />
      </div>
      {/* Brand selector skeleton */}
      <div className="bg-card border border-border rounded-xl p-5">
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="flex flex-wrap gap-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
      {/* Chart skeleton */}
      <div className="bg-card border border-border rounded-xl p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-[340px] w-full rounded-lg" />
      </div>
      {/* Two-column row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-xl p-5">
          <Skeleton className="h-4 w-36 mb-4" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Week Navigation ──────────────────────────────────────────────────────────

function WeekNav({ weekLabel }: { weekLabel: string }) {
  const [idx] = useState(() => 0); // trends has no week nav — placeholder for layout consistency
  return (
    <div className="flex items-center justify-between">
      <div />
      <div className="flex items-center gap-1.5">
        <button
          disabled
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous week"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="px-4 py-2 bg-secondary border border-border rounded-lg">
          <span className="text-sm font-medium tabular-nums">{weekLabel}</span>
        </div>
        <button
          disabled
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next week"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="w-[120px]" /> {/* right spacer for center alignment */}
    </div>
  );
}

// ─── Brand Selector ───────────────────────────────────────────────────────────

function BrandSelector({
  brands,
  selected,
  onToggle,
  showAverage,
  onToggleAverage,
}: {
  brands: Array<{ id: string; name: string }>;
  selected: string[];
  onToggle: (name: string) => void;
  showAverage: boolean;
  onToggleAverage: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          Brands ({selected.length}/5)
        </p>
        <button
          onClick={onToggleAverage}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            showAverage
              ? 'bg-secondary border-border text-foreground'
              : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Market Avg
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {brands.map((b) => {
          const isSelected = selected.includes(b.name);
          const color = getBrandColor(b.name);
          const atLimit = selected.length >= 5 && !isSelected;
          return (
            <button
              key={b.id}
              onClick={() => !atLimit && onToggle(b.name)}
              disabled={atLimit}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                ${atLimit ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                ${isSelected
                  ? 'border-transparent text-white'
                  : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
                }
              `}
              style={isSelected ? { backgroundColor: color } : undefined}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.7)' : color }}
              />
              {b.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Trend Line Chart ─────────────────────────────────────────────────────────

function TrendLineChart({
  trendData,
  selectedBrands,
  showAverage,
  average,
}: {
  trendData: Array<{ week: string; [key: string]: string | number }>;
  selectedBrands: string[];
  showAverage: boolean;
  average?: Record<string, number>;
}) {
  // Compute a market average value per week from the data
  const avgLine = useMemo(() => {
    if (!showAverage || trendData.length === 0) return null;
    return trendData.map((row) => {
      const vals = selectedBrands
        .map((b) => row[b])
        .filter((v) => v !== undefined && v !== null) as number[];
      const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
      return { week: row.week, avg };
    });
  }, [trendData, selectedBrands, showAverage]);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Impression Trends — Last 26 Weeks
      </h3>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="week"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            interval={Math.floor((trendData.length - 1) / 8)}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompact(v)}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const week = (payload[0]!.payload as { week: string }).week;
              return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm space-y-1 min-w-[160px]">
                  <p className="font-semibold text-foreground mb-2">{week}</p>
                  {payload
                    .filter((p) => p.dataKey !== 'week')
                    .map((entry) => (
                      <div key={entry.dataKey as string} className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: entry.color as string }}
                          />
                          <span className="text-muted-foreground">{String(entry.dataKey)}</span>
                        </div>
                        <span className="font-medium tabular-nums text-foreground">
                          {formatCompact(entry.value as number)}
                        </span>
                      </div>
                    ))}
                </div>
              );
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: '8px' }}
          />
          {selectedBrands.map((brand) => (
            <Line
              key={brand}
              type="monotone"
              dataKey={brand}
              name={brand}
              stroke={getBrandColor(brand)}
              strokeWidth={2}
              dot={{ r: 3, fill: getBrandColor(brand) }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
          {avgLine && (
            <Line
              type="monotone"
              dataKey="avg"
              name="Market Avg"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 5 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Anomaly Card ─────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  critical: {
    label: 'Critical',
    bg: 'bg-danger/10',
    text: 'text-danger',
    border: 'border-danger/20',
  },
  warning: {
    label: 'Warning',
    bg: 'bg-[#f59e0b]/10',
    text: 'text-[#f59e0b]',
    border: 'border-[#f59e0b]/20',
  },
  info: {
    label: 'Info',
    bg: 'bg-secondary',
    text: 'text-muted-foreground',
    border: 'border-border',
  },
};

function AnomalyCard({ anomaly }: { anomaly: TrendsData['anomalies'][number] }) {
  const style = SEVERITY_STYLES[anomaly.severity] ?? SEVERITY_STYLES.info;
  const typeLabel =
    anomaly.type === 'viral' ? '📈 Viral' :
    anomaly.type === 'anomaly' ? '⚠️ Anomaly' :
    anomaly.type === 'reengaged' ? '🔄 Re-engaged' :
    anomaly.type;

  return (
    <div className={`${style.bg} border ${style.border} rounded-xl p-5`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold uppercase tracking-wider ${style.text}`}>
            {style.label}
          </span>
          <span className="text-xs text-muted-foreground">{anomaly.week}</span>
        </div>
        <span className="text-xs text-muted-foreground">{typeLabel}</span>
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{anomaly.brand_name}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{anomaly.description}</p>
    </div>
  );
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

function SummaryStats({
  trendData,
  brands,
}: {
  trendData: Array<{ week: string; [key: string]: string | number }>;
  brands: Array<{ id: string; name: string }>;
}) {
  const totalWeeks = trendData.length;
  const totalBrands = brands.length;
  const avgWeekly = useMemo(() => {
    if (trendData.length === 0 || brands.length === 0) return 0;
    let total = 0;
    let count = 0;
    for (const row of trendData) {
      for (const b of brands) {
        const val = row[b.name];
        if (val !== undefined && val !== null) {
          total += Number(val);
          count++;
        }
      }
    }
    return count > 0 ? Math.round(total / count) : 0;
  }, [trendData, brands]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Total Weeks
          </p>
          <div className="p-2 bg-secondary rounded-lg">
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{totalWeeks}</p>
        <p className="text-xs text-muted-foreground mt-1">in time series</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Tracked Brands
          </p>
          <div className="p-2 bg-secondary rounded-lg">
            <Activity className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{totalBrands}</p>
        <p className="text-xs text-muted-foreground mt-1">active brands</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Avg Weekly Impressions
          </p>
          <div className="p-2 bg-secondary rounded-lg">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">
          {formatCompact(avgWeekly)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">per brand per week</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrendsPage() {
  const { data, loading, error, refetch } = useDashboardData<TrendsData>('trends');

  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [showAverage, setShowAverage] = useState(false);

  // Initialize selected brands once data loads
  const initialSelected = useMemo(() => {
    if (!data || data.brands.length === 0) return [];
    return data.brands.slice(0, 5).map((b) => b.name);
  }, [data]);

  // Sync state when data first arrives
  useMemo(() => {
    if (initialSelected.length > 0 && selectedBrands.length === 0) {
      setSelectedBrands(initialSelected);
    }
  }, [initialSelected]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleBrand(name: string) {
    setSelectedBrands((prev) =>
      prev.includes(name) ? prev.filter((b) => b !== name) : prev.length < 5 ? [...prev, name] : prev,
    );
  }

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
        <p className="text-sm text-muted-foreground">No trend data available.</p>
      </div>
    );
  }

  const { brands, trend_data: trendData, anomalies } = data;

  // Time range label
  const weekLabel =
    trendData.length > 0
      ? `${trendData[0]!.week.split('(')[0]?.trim() ?? ''} – ${trendData[trendData.length - 1]!.week}`
      : 'No data';

  return (
    <div className="p-6 space-y-5">
      {/* Week nav header */}
      <div className="dashboard-reveal">
        <WeekNav weekLabel={weekLabel} />
      </div>

      {/* Brand selector */}
      {brands.length > 0 && (
        <div className="dashboard-reveal">
          <BrandSelector
            brands={brands}
            selected={selectedBrands}
            onToggle={toggleBrand}
            showAverage={showAverage}
            onToggleAverage={() => setShowAverage((v) => !v)}
          />
        </div>
      )}

      {/* Main trend line chart */}
      {trendData.length > 0 ? (
        <div className="dashboard-reveal">
          <TrendLineChart
            trendData={trendData}
            selectedBrands={selectedBrands}
            showAverage={showAverage}
            average={data.average}
          />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          No trend data for the selected period.
        </div>
      )}

      {/* Two-column row: anomalies + summary */}
      <div className="dashboard-reveal grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Anomaly Alerts */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Anomaly Alerts ({anomalies.length})
            </h3>
          </div>
          {anomalies.length > 0 ? (
            <div className="space-y-3">
              {anomalies.map((a) => (
                <AnomalyCard key={a.id} anomaly={a} />
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-5 text-center text-muted-foreground text-sm">
              No anomalies detected in this period.
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Summary Statistics
            </h3>
          </div>
          <SummaryStats trendData={trendData} brands={brands} />
        </div>
      </div>
    </div>
  );
}
