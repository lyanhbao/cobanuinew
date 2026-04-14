'use client';

import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { useApp } from '@/context/AppContext';
import { formatVietnamNumber, formatCompact } from '@/lib/vietnam-format';
import { getBrandColor } from '@/lib/brand-colors';
import {
  Eye,
  Hash,
  Percent,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RankingsData {
  week: {
    label: string;
    start: string;
    number: number;
    year: number;
  };
  brands: BrandRow[];
}

interface BrandRow {
  brand_id: string;
  rank: number;
  brand_name: string;
  is_primary: boolean;
  impressions: number;
  sov_pct: number;
  sos_pct: number;
  reactions: number;
  posts: number;
  avg_er: number;
  gap_pct: number;
  trend: number[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY_COLOR = '#1a358b';
const COMPETITOR_COLORS = ['#3b5cb8', '#6b84cc', '#9bade0', '#c8d4f0'];
const PAGE_SIZE = 10;

// ─── Sort Types ────────────────────────────────────────────────────────────────

type SortKey = 'rank' | 'brand_name' | 'impressions' | 'sov_pct' | 'sos_pct' | 'reactions' | 'posts' | 'avg_er' | 'gap_pct';
type SortDir = 'asc' | 'desc';

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5">
          <Skeleton className="h-4 w-full mb-4" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 w-32" />
              <div className="flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-5 w-14" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-xl p-5">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
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
    <div className="flex items-center justify-between">
      <h1 className="text-lg font-semibold text-foreground">Rankings</h1>
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
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
}

function KpiCard({ icon: Icon, label, value, sub }: KpiCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        <div className="p-2 bg-secondary rounded-lg flex-shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  const valid = data.filter(v => v > 0);
  if (valid.length === 0) return <span className="text-muted-foreground text-xs">—</span>;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;

  const points = valid.map((v, i) => ({
    x: (i / (valid.length - 1)) * 60,
    y: 20 - ((v - min) / range) * 18,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const trendColor = valid[valid.length - 1]! > valid[0]! ? '#10b981' : '#ef4444';

  return (
    <svg width="60" height="24" viewBox="0 0 60 24" className="inline-block">
      <polyline
        points={polyline}
        fill="none"
        stroke="#6b7280"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1]!.x}
          cy={points[points.length - 1]!.y}
          r="2"
          fill={trendColor}
        />
      )}
    </svg>
  );
}

// ─── Rankings Table ───────────────────────────────────────────────────────────

function RankingsTable({ brands }: { brands: BrandRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    return [...brands].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'rank': cmp = a.rank - b.rank; break;
        case 'brand_name': cmp = a.brand_name.localeCompare(b.brand_name); break;
        case 'impressions': cmp = a.impressions - b.impressions; break;
        case 'sov_pct': cmp = a.sov_pct - b.sov_pct; break;
        case 'sos_pct': cmp = a.sos_pct - b.sos_pct; break;
        case 'reactions': cmp = a.reactions - b.reactions; break;
        case 'posts': cmp = a.posts - b.posts; break;
        case 'avg_er': cmp = a.avg_er - b.avg_er; break;
        case 'gap_pct': cmp = a.gap_pct - b.gap_pct; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [brands, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'rank' ? 'asc' : 'desc');
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) {
      return (
        <span className="ml-1 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity">
          ⇅
        </span>
      );
    }
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-1 inline-block text-muted-foreground" />
      : <ChevronDown className="w-3 h-3 ml-1 inline-block text-muted-foreground" />;
  }

  interface ThProps {
    col: SortKey;
    align?: 'left' | 'right' | 'center';
    children: React.ReactNode;
    className?: string;
  }

  function Th({ col, align = 'left', children, className = '' }: ThProps) {
    const alignClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
    return (
      <th
        className={`group px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors ${alignClass} ${className}`}
        onClick={() => handleSort(col)}
      >
        <div className={`flex items-center ${alignClass}`}>
          {children}
          <SortIcon col={col} />
        </div>
      </th>
    );
  }

  const primaryColor = brands.find(b => b.is_primary)?.brand_name
    ? getBrandColor(brands.find(b => b.is_primary)!.brand_name)
    : PRIMARY_COLOR;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Brand Rankings
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <Th col="rank" align="center" className="w-12">#</Th>
              <Th col="brand_name">Brand</Th>
              <Th col="impressions" align="right">Impressions</Th>
              <Th col="sov_pct" align="right">SOV %</Th>
              <Th col="sos_pct" align="right">SOS %</Th>
              <Th col="reactions" align="right">Reactions</Th>
              <Th col="posts" align="right">Posts</Th>
              <Th col="avg_er" align="right">Avg ER</Th>
              <Th col="gap_pct" align="right">Gap %</Th>
              <th className="px-4 py-3 text-center text-xs text-muted-foreground font-medium uppercase tracking-wider w-20">Trend</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((brand) => {
              const trendUp = brand.trend.length > 1
                ? brand.trend[brand.trend.length - 1]! > brand.trend[0]!
                : false;
              const brandColor = brand.is_primary
                ? PRIMARY_COLOR
                : getBrandColor(brand.brand_name);

              return (
                <tr
                  key={brand.brand_id}
                  className={`border-b border-border last:border-0 hover:bg-secondary/30 transition-colors ${brand.is_primary ? 'bg-[#1a358b]/5' : ''}`}
                >
                  <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                    {brand.rank}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: brandColor }}
                      />
                      <span className={`text-sm font-medium ${brand.is_primary ? 'text-[#1a358b]' : 'text-foreground'}`}>
                        {brand.brand_name}
                      </span>
                      {brand.is_primary && (
                        <span className="text-[10px] bg-[#1a358b]/10 text-[#1a358b] px-1.5 py-0.5 rounded font-semibold tracking-wide">
                          PRIMARY
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-foreground">
                    {formatCompact(brand.impressions)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-14 h-1.5 bg-secondary rounded-full overflow-hidden">
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
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                    {brand.sos_pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                    {formatCompact(brand.reactions)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                    {brand.posts}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                    {brand.avg_er.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        brand.gap_pct > 0
                          ? 'text-success'
                          : brand.gap_pct < 0
                            ? 'text-danger'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {brand.gap_pct > 0 ? '+' : ''}{brand.gap_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Sparkline data={brand.trend} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, sorted.length)} of {sorted.length} brands
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                  currentPage === i + 1
                    ? 'bg-[#1a358b] text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SOV Bar Chart ────────────────────────────────────────────────────────────

function SovBarChart({ brands }: { brands: BrandRow[] }) {
  const sorted = [...brands].sort((a, b) => b.sov_pct - a.sov_pct);
  const chartData = sorted.map((b, i) => ({
    brand_name: b.brand_name,
    is_primary: b.is_primary,
    sov_pct: b.sov_pct,
    impressions: b.impressions,
    color: b.is_primary ? PRIMARY_COLOR : COMPETITOR_COLORS[i % COMPETITOR_COLORS.length],
  }));

  if (chartData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Share of Voice (SOV) %
        </h2>
        <div className="text-sm text-muted-foreground text-center py-12">No data available.</div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Share of Voice (SOV) %
      </h2>
      <ResponsiveContainer width="100%" height={Math.max(chartData.length * 52, 200)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ left: 0, right: 70, top: 4, bottom: 4 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="brand_name"
            type="category"
            width={110}
            tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]!.payload as { brand_name: string; sov_pct: number; impressions: number; is_primary: boolean };
              return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
                  <p className="font-semibold mb-1">{d.brand_name}</p>
                  {d.is_primary && (
                    <span className="text-[10px] bg-[#1a358b]/10 text-[#1a358b] px-1.5 py-0.5 rounded font-semibold tracking-wide mb-1 inline-block">
                      PRIMARY
                    </span>
                  )}
                  <p className="text-muted-foreground">
                    SOV: <span className="font-medium">{d.sov_pct.toFixed(1)}%</span>
                  </p>
                  <p className="text-muted-foreground">
                    Impressions: <span className="font-medium">{formatVietnamNumber(d.impressions)}</span>
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
              fontSize: 11,
              fill: 'hsl(var(--muted-foreground))',
            }}
          >
            {chartData.map((entry) => (
              <Cell key={entry.brand_name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── SOS Bar Chart ────────────────────────────────────────────────────────────

function SosBarChart({ brands }: { brands: BrandRow[] }) {
  const sorted = [...brands].sort((a, b) => b.sos_pct - a.sos_pct);
  const chartData = sorted.map((b, i) => ({
    brand_name: b.brand_name,
    is_primary: b.is_primary,
    sos_pct: b.sos_pct,
    impressions: b.impressions,
    color: b.is_primary ? PRIMARY_COLOR : COMPETITOR_COLORS[i % COMPETITOR_COLORS.length],
  }));

  if (chartData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Share of Space (SOS) %
        </h2>
        <div className="text-sm text-muted-foreground text-center py-12">No data available.</div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Share of Space (SOS) %
      </h2>
      <ResponsiveContainer width="100%" height={Math.max(chartData.length * 52, 200)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ left: 0, right: 70, top: 4, bottom: 4 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="brand_name"
            type="category"
            width={110}
            tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]!.payload as { brand_name: string; sos_pct: number; impressions: number; is_primary: boolean };
              return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
                  <p className="font-semibold mb-1">{d.brand_name}</p>
                  {d.is_primary && (
                    <span className="text-[10px] bg-[#1a358b]/10 text-[#1a358b] px-1.5 py-0.5 rounded font-semibold tracking-wide mb-1 inline-block">
                      PRIMARY
                    </span>
                  )}
                  <p className="text-muted-foreground">
                    SOS: <span className="font-medium">{d.sos_pct.toFixed(1)}%</span>
                  </p>
                  <p className="text-muted-foreground">
                    Impressions: <span className="font-medium">{formatVietnamNumber(d.impressions)}</span>
                  </p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="sos_pct"
            name="SOS %"
            radius={[0, 4, 4, 0]}
            label={{
              position: 'right',
              formatter: (v: number) => `${v.toFixed(1)}%`,
              fontSize: 11,
              fill: 'hsl(var(--muted-foreground))',
            }}
          >
            {chartData.map((entry) => (
              <Cell key={entry.brand_name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RankingsPage() {
  const { data, loading, error, refetch } = useDashboardData<RankingsData>('rankings');

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

  const { week, brands } = data;

  // KPI calculations
  const totalImpressions = brands.reduce((sum, b) => sum + b.impressions, 0);
  const brandCount = brands.length;
  const avgEngagement = brands.length > 0
    ? brands.reduce((sum, b) => sum + b.avg_er, 0) / brands.length
    : 0;

  return (
    <div className="p-6 space-y-5">
      {/* Week navigation + page title */}
      <div className="dashboard-reveal">
        <WeekNav weekLabel={week.label} />
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
        <KpiCard
          icon={Eye}
          label="Total Market Impressions"
          value={formatCompact(totalImpressions)}
          sub={formatVietnamNumber(totalImpressions)}
        />
        <KpiCard
          icon={Hash}
          label="Number of Brands"
          value={brandCount}
        />
        <KpiCard
          icon={Percent}
          label="Market Avg Engagement Rate"
          value={`${avgEngagement.toFixed(2)}%`}
        />
      </div>

      {/* Rankings Table */}
      <div className="dashboard-reveal">
        <RankingsTable brands={brands} />
      </div>

      {/* SOV and SOS Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="dashboard-reveal">
          <SovBarChart brands={brands} />
        </div>
        <div className="dashboard-reveal">
          <SosBarChart brands={brands} />
        </div>
      </div>
    </div>
  );
}
