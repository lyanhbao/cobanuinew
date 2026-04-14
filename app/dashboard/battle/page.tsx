'use client';

import { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { formatCompact } from '@/lib/vietnam-format';
import { ChevronDown, Crown, Target, TrendingUp, Zap } from 'lucide-react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
} from 'recharts';

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  brand_name: string;
  is_primary: boolean;
}

interface MetricValue {
  label: string;
  brand1: number;
  brand2: number;
  winner: 'brand1' | 'brand2' | 'tie';
}

interface BattleData {
  brand1: string;
  brand2: string;
  brand1Id: string;
  brand2Id: string;
  week: {
    label: string;
    start: string;
    number: number;
    year: number;
  } | null;
  metrics: MetricValue[];
  history: {
    weeks: { week: string; weekLabel: string }[];
    brand1Data: Record<string, number[]>;
    brand2Data: Record<string, number[]>;
  };
  scores: { brand1: number; brand2: number };
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const BRAND1_COLOR = '#1a358b';
const BRAND2_COLOR = '#10b981';

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Selector skeleton */}
      <div className="flex items-center justify-center gap-4">
        <Skeleton className="h-12 w-48 rounded-xl" />
        <Skeleton className="h-10 w-20 rounded-full" />
        <Skeleton className="h-12 w-48 rounded-xl" />
      </div>
      {/* Score summary skeleton */}
      <div className="bg-card border border-border rounded-xl p-6">
        <Skeleton className="h-6 w-64 mx-auto mb-4" />
        <Skeleton className="h-3 w-full mb-2" />
      </div>
      {/* Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Zap className="w-12 h-12 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── VS Splash Animation ───────────────────────────────────────────────────────

function VsSplash() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative flex flex-col items-center">
        <div className="relative">
          <div className="absolute inset-0 bg-white/20 rounded-full blur-xl scale-150" />
          <span
            className="relative text-[10rem] font-black text-white/90"
            style={{
              textShadow: '0 0 60px rgba(26,53,139,0.8), 0 0 120px rgba(16,185,129,0.4)',
              animation: 'vsPulse 0.8s ease-out forwards',
            }}
          >
            VS
          </span>
        </div>
      </div>
      <style>{`
        @keyframes vsPulse {
          0% { opacity: 0; transform: scale(0.5); }
          30% { opacity: 1; transform: scale(1.15); }
          60% { transform: scale(1); }
          100% { opacity: 0; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

// ─── Brand Selector ─────────────────────────────────────────────────────────────

interface BrandSelectorProps {
  label: string;
  value: string;
  brands: BrandRow[];
  color: string;
  onChange: (id: string) => void;
}

function BrandSelector({ label, value, brands, color, onChange }: BrandSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-12 pl-4 pr-10 bg-card border-2 border-border rounded-xl text-sm font-medium text-foreground appearance-none cursor-pointer hover:border-[var(--border)]/80 focus:outline-none focus:ring-2 focus:ring-[#1a358b]/30 transition-colors"
          style={{
            borderColor: value ? color : undefined,
            backgroundColor: value ? `${color}08` : undefined,
          }}
        >
          <option value="">Select brand...</option>
          {brands.map((b) => (
            <option key={b.brand_id} value={b.brand_id}>
              {b.brand_name}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Metric Card ────────────────────────────────────────────────────────────────

interface MetricCardProps {
  metric: MetricValue;
  brand1Name: string;
  brand2Name: string;
  brand1Color: string;
  brand2Color: string;
  format: 'number' | 'percent' | 'currency';
}

function MetricCard({
  metric,
  brand1Name,
  brand2Name,
  brand1Color,
  brand2Color,
  format,
}: MetricCardProps) {
  const { label, brand1, brand2, winner } = metric;

  function formatValue(v: number): string {
    if (format === 'percent') return `${v.toFixed(1)}%`;
    if (format === 'currency') return formatCompact(v);
    return formatCompact(v);
  }

  const isB1Winner = winner === 'brand1';
  const isB2Winner = winner === 'brand2';
  const isTie = winner === 'tie';

  return (
    <div
      className="bg-card border border-border rounded-xl p-4 transition-all duration-300"
      style={{
        borderColor: isB1Winner ? brand1Color : isB2Winner ? brand2Color : undefined,
        boxShadow: isB1Winner
          ? `0 0 0 1px ${brand1Color}20, 0 4px 16px ${brand1Color}15`
          : isB2Winner
            ? `0 0 0 1px ${brand2Color}20, 0 4px 16px ${brand2Color}15`
            : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        {winner !== 'tie' && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{
              backgroundColor: isB1Winner ? `${brand1Color}20` : `${brand2Color}20`,
              color: isB1Winner ? brand1Color : brand2Color,
            }}
          >
            {isB1Winner ? brand1Name : brand2Name} Wins
          </span>
        )}
        {isTie && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-secondary text-muted-foreground">
            Tie
          </span>
        )}
      </div>

      {/* Values */}
      <div className="flex items-center justify-between gap-3">
        {/* Brand 1 */}
        <div className="flex-1 text-center">
          <p
            className="text-lg font-bold tabular-nums truncate"
            style={{ color: isB1Winner ? brand1Color : 'hsl(var(--foreground))' }}
          >
            {formatValue(brand1)}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">{brand1Name}</p>
        </div>

        {/* Divider with VS */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <div className="w-px h-6 bg-border" />
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ backgroundColor: '#1a358b15', color: '#1a358b' }}
          >
            VS
          </div>
          <div className="w-px h-6 bg-border" />
        </div>

        {/* Brand 2 */}
        <div className="flex-1 text-center">
          <p
            className="text-lg font-bold tabular-nums truncate"
            style={{ color: isB2Winner ? brand2Color : 'hsl(var(--foreground))' }}
          >
            {formatValue(brand2)}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">{brand2Name}</p>
        </div>
      </div>

      {/* Mini bar comparison */}
      <div className="mt-3 flex gap-1">
        <div className="flex-1 h-1.5 rounded-l-full overflow-hidden" style={{ backgroundColor: '#1a358b15' }}>
          <div
            className="h-full rounded-l-full transition-all duration-500"
            style={{
              width: brand1 + brand2 > 0 ? `${(brand1 / (brand1 + brand2)) * 100}%` : '50%',
              backgroundColor: brand1Color,
              opacity: isB1Winner ? 1 : 0.5,
            }}
          />
        </div>
        <div className="flex-1 h-1.5 rounded-r-full overflow-hidden" style={{ backgroundColor: '#10b98115' }}>
          <div
            className="h-full rounded-r-full transition-all duration-500"
            style={{
              width: brand1 + brand2 > 0 ? `${(brand2 / (brand1 + brand2)) * 100}%` : '50%',
              backgroundColor: brand2Color,
              opacity: isB2Winner ? 1 : 0.5,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Radar Chart ────────────────────────────────────────────────────────────────

interface RadarChartProps {
  data: BattleData;
}

function BattleRadarChart({ data }: RadarChartProps) {
  const { metrics, brand1, brand2 } = data;

  // Select key metrics for radar (top 5 that are relevant)
  const radarMetrics = metrics.filter((m) =>
    ['Impressions', 'Views', 'Reactions', 'Engagement Rate', 'SOV (Impressions)'].includes(m.label),
  );

  const chartData = radarMetrics.map((m) => ({
    metric: m.label,
    [brand1]: m.brand1,
    [brand2]: m.brand2,
  }));

  // Normalize for radar radius
  const maxValues: Record<string, number> = {};
  for (const m of radarMetrics) {
    maxValues[m.label] = Math.max(m.brand1, m.brand2, 1);
  }

  const normalizedData = chartData.map((d) => {
    const entry: Record<string, string | number> = { metric: d.metric };
    for (const key of [brand1, brand2]) {
      const raw = d[key] as number;
      const max = maxValues[d.metric] ?? 1;
      entry[key] = max > 0 ? Math.round((raw / max) * 100) : 0;
    }
    return entry;
  });

  if (normalizedData.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-[#1a358b]" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Performance Radar
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={normalizedData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]!.payload as Record<string, string | number>;
              return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
                  <p className="font-semibold mb-1">{d.metric}</p>
                  <p style={{ color: BRAND1_COLOR }}>
                    {brand1}: <span className="font-medium">{formatCompact(d[brand1] as number)}</span>
                  </p>
                  <p style={{ color: BRAND2_COLOR }}>
                    {brand2}: <span className="font-medium">{formatCompact(d[brand2] as number)}</span>
                  </p>
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
          />
          <Radar
            name={brand1}
            dataKey={brand1}
            stroke={BRAND1_COLOR}
            fill={BRAND1_COLOR}
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Radar
            name={brand2}
            dataKey={brand2}
            stroke={BRAND2_COLOR}
            fill={BRAND2_COLOR}
            fillOpacity={0.25}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── History Chart ─────────────────────────────────────────────────────────────

interface HistoryChartProps {
  data: BattleData;
}

function BattleHistoryChart({ data }: HistoryChartProps) {
  const { history, brand1, brand2 } = data;
  const { weeks, brand1Data, brand2Data } = history;

  if (weeks.length === 0) return null;

  // Pick impressions as the primary metric for history
  const impressionsKey = 'impressions';

  const chartData = weeks.map((wk, i) => ({
    label: wk.weekLabel,
    [brand1]: brand1Data[impressionsKey]?.[i] ?? 0,
    [brand2]: brand2Data[impressionsKey]?.[i] ?? 0,
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-[#10b981]" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Impression History
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
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
            width={55}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]!.payload as Record<string, string | number>;
              return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
                  <p className="font-semibold mb-1">{d.label}</p>
                  <p style={{ color: BRAND1_COLOR }}>
                    {brand1}: <span className="font-medium">{formatCompact(d[brand1] as number)}</span>
                  </p>
                  <p style={{ color: BRAND2_COLOR }}>
                    {brand2}: <span className="font-medium">{formatCompact(d[brand2] as number)}</span>
                  </p>
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey={brand1}
            stroke={BRAND1_COLOR}
            strokeWidth={2.5}
            dot={{ r: 4, fill: BRAND1_COLOR }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey={brand2}
            stroke={BRAND2_COLOR}
            strokeWidth={2.5}
            dot={{ r: 4, fill: BRAND2_COLOR }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Score Summary ─────────────────────────────────────────────────────────────

interface ScoreSummaryProps {
  data: BattleData;
}

function ScoreSummary({ data }: ScoreSummaryProps) {
  const { brand1, brand2, scores, metrics, week } = data;
  const { brand1: b1Score, brand2: b2Score } = scores;
  const total = b1Score + b2Score;
  const b1Pct = total > 0 ? (b1Score / total) * 100 : 50;
  const b2Pct = total > 0 ? (b2Score / total) * 100 : 50;

  const overallWinner = b1Score > b2Score ? brand1 : b2Score > b1Score ? brand2 : null;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      {/* Week label */}
      {week && (
        <p className="text-center text-xs text-muted-foreground mb-4 uppercase tracking-wider">
          {week.label}
        </p>
      )}

      {/* Winner announcement */}
      {overallWinner && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <Crown
            className="w-5 h-5"
            style={{
              color: overallWinner === brand1 ? BRAND1_COLOR : BRAND2_COLOR,
            }}
          />
          <p className="text-xl font-black tracking-tight">
            <span
              style={{
                color: overallWinner === brand1 ? BRAND1_COLOR : BRAND2_COLOR,
              }}
            >
              {overallWinner}
            </span>
            <span className="text-foreground font-bold"> wins </span>
            <span className="font-black text-2xl tabular-nums">
              <span style={{ color: BRAND1_COLOR }}>{b1Score}</span>
              <span className="text-muted-foreground mx-1">-</span>
              <span style={{ color: BRAND2_COLOR }}>{b2Score}</span>
            </span>
          </p>
          <Crown
            className="w-5 h-5"
            style={{
              color: overallWinner === brand1 ? BRAND1_COLOR : BRAND2_COLOR,
            }}
          />
        </div>
      )}

      {/* Score bar */}
      <div className="flex gap-1 h-3 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{
            width: `${b1Pct}%`,
            backgroundColor: BRAND1_COLOR,
          }}
        />
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{
            width: `${b2Pct}%`,
            backgroundColor: BRAND2_COLOR,
          }}
        />
      </div>

      {/* Brand labels */}
      <div className="flex justify-between mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND1_COLOR }} />
          <span className="text-xs font-medium" style={{ color: BRAND1_COLOR }}>
            {brand1} ({b1Score} wins)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium" style={{ color: BRAND2_COLOR }}>
            ({b2Score} wins) {brand2}
          </span>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND2_COLOR }} />
        </div>
      </div>

      {/* Metrics vs context */}
      <p className="text-center text-xs text-muted-foreground mt-3">
        {metrics.filter((m) => m.winner !== 'tie').length} of {metrics.length} metrics decided
      </p>
    </div>
  );
}

// ─── Brand Selector Row ─────────────────────────────────────────────────────────

interface SelectorRowProps {
  brand1: string;
  brand2: string;
  brands: BrandRow[];
  onBrand1Change: (id: string) => void;
  onBrand2Change: (id: string) => void;
}

function SelectorRow({ brand1, brand2, brands, onBrand1Change, onBrand2Change }: SelectorRowProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="flex-1 w-full sm:max-w-64">
        <BrandSelector
          label="Brand A"
          value={brand1}
          brands={brands}
          color={BRAND1_COLOR}
          onChange={onBrand1Change}
        />
      </div>

      {/* VS Badge */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1 py-1">
        <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-lg text-white"
          style={{
            background: `linear-gradient(135deg, ${BRAND1_COLOR}, ${BRAND2_COLOR})`,
            boxShadow: '0 4px 20px rgba(26,53,139,0.3)',
          }}
        >
          VS
        </div>
        <div className="w-px h-4 bg-border hidden sm:block" />
      </div>

      <div className="flex-1 w-full sm:max-w-64">
        <BrandSelector
          label="Brand B"
          value={brand2}
          brands={brands}
          color={BRAND2_COLOR}
          onChange={onBrand2Change}
        />
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BattlePage() {
  const { groupId, selectedWeek, isReady } = useApp();
  const { fetchWithAuth } = useAuth();

  // Brand selectors state
  const [brand1, setBrand1] = useState('');
  const [brand2, setBrand2] = useState('');

  // Battle data state
  const [battleData, setBattleData] = useState<BattleData | null>(null);
  const [battleLoading, setBattleLoading] = useState(false);
  const [battleError, setBattleError] = useState<string | null>(null);

  // VS splash state
  const [showVs, setShowVs] = useState(false);

  // Fetch brand list from rankings endpoint
  const { data: rankingsData, loading: rankingsLoading } = useDashboardData<RankingsData>('rankings');
  const brands = rankingsData?.brands ?? [];

  // Persist brand selections in localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (brand1) localStorage.setItem('coban_battle_brand1', brand1);
    if (brand2) localStorage.setItem('coban_battle_brand2', brand2);
  }, [brand1, brand2]);

  // Restore from localStorage on mount
  useEffect(() => {
    if (!isReady) return;
    const saved1 = localStorage.getItem('coban_battle_brand1') ?? '';
    const saved2 = localStorage.getItem('coban_battle_brand2') ?? '';
    if (saved1) setBrand1(saved1);
    if (saved2) setBrand2(saved2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  // Fetch battle data when both brands are selected
  useEffect(() => {
    if (!groupId || !brand1 || !brand2 || !isReady) {
      setBattleData(null);
      return;
    }

    setBattleLoading(true);
    setBattleError(null);

    const params = new URLSearchParams();
    if (selectedWeek) params.set('week', selectedWeek);
    const qs = params.toString();
    const url = `/api/dashboard/${groupId}/battle?brand1=${brand1}&brand2=${brand2}${qs ? `&${qs}` : ''}`;

    fetchWithAuth(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setBattleData(d.data);
        } else {
          setBattleError(d.error ?? 'Failed to load battle data');
        }
      })
      .catch((e: unknown) => {
        setBattleError(e instanceof Error ? e.message : 'Failed to load battle data');
      })
      .finally(() => setBattleLoading(false));
  }, [groupId, brand1, brand2, selectedWeek, isReady, fetchWithAuth]);

  // VS splash when brands change
  useEffect(() => {
    if (brand1 && brand2) {
      setShowVs(true);
      const t = setTimeout(() => setShowVs(false), 900);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [brand1, brand2]);

  // Loading states
  if (!isReady || rankingsLoading) return <LoadingSkeleton />;

  // No brands available
  if (brands.length < 2) {
    return (
      <div className="p-6">
        <EmptyState message="At least two brands are needed for battle comparison." />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* VS Splash overlay */}
      {showVs && <VsSplash />}

      {/* Brand Selector Row */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-[#1a358b]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Battle Mode
          </h2>
        </div>
        <SelectorRow
          brand1={brand1}
          brand2={brand2}
          brands={brands}
          onBrand1Change={setBrand1}
          onBrand2Change={setBrand2}
        />
      </div>

      {/* Not yet selected */}
      {!brand1 || !brand2 ? (
        <div className="bg-card border border-border rounded-xl p-12">
          <EmptyState message="Select two brands above to start the battle comparison." />
        </div>
      ) : battleLoading ? (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-6">
            <Skeleton className="h-16 w-full mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      ) : battleError ? (
        <div className="bg-card border border-border rounded-xl p-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <p className="text-sm text-destructive">{battleError}</p>
            <button
              onClick={() => {
                setBattleError(null);
                // Re-trigger fetch by toggling brand2
                const tmp = brand2;
                setBrand2('');
                setTimeout(() => setBrand2(tmp), 50);
              }}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Retry
            </button>
          </div>
        </div>
      ) : battleData ? (
        <div className="space-y-5">
          {/* Score Summary */}
          <ScoreSummary data={battleData} />

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {battleData.metrics.map((metric) => {
              // Determine format
              let format: 'number' | 'percent' | 'currency' = 'number';
              if (metric.label === 'Engagement Rate' || metric.label.includes('SOV')) {
                format = 'percent';
              } else if (metric.label === 'Spend') {
                format = 'currency';
              }
              return (
                <MetricCard
                  key={metric.label}
                  metric={metric}
                  brand1Name={battleData.brand1}
                  brand2Name={battleData.brand2}
                  brand1Color={BRAND1_COLOR}
                  brand2Color={BRAND2_COLOR}
                  format={format}
                />
              );
            })}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <BattleRadarChart data={battleData} />
            <BattleHistoryChart data={battleData} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
