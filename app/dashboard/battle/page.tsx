'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useScrollReveal } from '@/lib/use-scroll-reveal';
import { formatCompact } from '@/lib/vietnam-format';
import { RefreshCw, AlertCircle, Swords, Trophy, X } from 'lucide-react';
import GlassCard from '@/components/dashboard/glass-card';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BattleMetric {
  label: string;
  brand1: number;
  brand2: number;
  winner: 'brand1' | 'brand2' | 'tie';
}

interface BrandListItem {
  brand_id: string;
  brand_name: string;
  is_primary: boolean;
}

interface BattleData {
  brand1: string;
  brand2: string;
  brand1Id: string;
  brand2Id: string;
  week: { label: string; start: string; number: number; year: number } | null;
  metrics: BattleMetric[];
  history: {
    weeks: Array<{ week: string; weekLabel: string }>;
    brand1Data: Record<string, number[]>;
    brand2Data: Record<string, number[]>;
  };
  scores: { brand1: number; brand2: number };
}

interface RankingsResponse {
  brands: BrandListItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND1_COLOR = '#1a358b';
const BRAND2_COLOR = '#7c3aed';
const BRAND1_GLOW = 'rgba(26, 53, 139, 0.4)';
const BRAND2_GLOW = 'rgba(124, 58, 237, 0.4)';

// ─── Spotlight Card ───────────────────────────────────────────────────────────

function SpotlightCard({
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

// ─── Brand Avatar ─────────────────────────────────────────────────────────────

function BrandAvatar({ name, color, size = 'md' }: { name: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-20 h-20 text-2xl',
  };
  return (
    <div
      className={`${sizes[size]} rounded-xl flex items-center justify-center font-bold text-white select-none`}
      style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
    >
      {initials}
    </div>
  );
}

// ─── VS Badge ────────────────────────────────────────────────────────────────

function VsBadge({ animate }: { animate: boolean }) {
  return (
    <div className="relative flex items-center justify-center">
      <div
        className={`
          w-16 h-16 rounded-full flex items-center justify-center
          bg-gradient-to-br from-[#1a358b] to-[#7c3aed]
          text-white font-black text-lg tracking-wider
          border-4 border-background
          shadow-[0_0_30px_rgba(124,58,237,0.5)]
          transition-transform duration-500
          ${animate ? 'scale-125 animate-pulse-glow' : 'scale-100'}
        `}
        style={animate ? { animation: 'pulse-glow 0.8s ease-in-out infinite' } : undefined}
      >
        VS
      </div>
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
    <div className="bg-background/90 border border-border rounded-lg shadow-lg p-3 text-sm backdrop-blur-sm">
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

// ─── History Tooltip ─────────────────────────────────────────────────────────

function HistoryTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/90 border border-border rounded-lg shadow-lg p-3 text-sm backdrop-blur-sm">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-3 h-0.5" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium tabular-nums">{formatCompact(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Metric Row ──────────────────────────────────────────────────────────────

function MetricRow({
  metric,
  brand1Name,
  brand2Name,
  index,
}: {
  metric: BattleMetric;
  brand1Name: string;
  brand2Name: string;
  index: number;
}) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({
    threshold: 0.05,
    delay: index * 50,
  });

  const total = metric.brand1 + metric.brand2;
  const b1Pct = total > 0 ? (metric.brand1 / total) * 100 : 50;

  const formatVal = (v: number, label: string) => {
    if (label === 'Engagement Rate') return `${(v * 100).toFixed(2)}%`;
    if (label === 'Spend') return formatCompact(v);
    if (v >= 1000) return formatCompact(v);
    return v.toFixed(1);
  };

  return (
    <div
      ref={ref}
      className={`py-3 ${isVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'} ${index > 0 ? 'border-t border-border/50' : ''}`}
      style={{ transitionDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center gap-3">
        {/* Brand 1 */}
        <div
          className={`flex-1 text-right pr-3 ${metric.winner === 'brand1' ? 'opacity-100' : 'opacity-60'}`}
        >
          <span
            className={`font-semibold tabular-nums text-sm ${metric.winner === 'brand1' ? 'text-primary' : ''}`}
          >
            {formatVal(metric.brand1, metric.label)}
          </span>
        </div>

        {/* Metric label + bar */}
        <div className="w-40 flex-shrink-0">
          <div className="text-xs text-center font-medium text-muted-foreground mb-1.5">
            {metric.label}
          </div>
          <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
              style={{
                width: `${b1Pct}%`,
                backgroundColor: metric.winner === 'brand1' ? BRAND1_COLOR : `${BRAND1_COLOR}88`,
              }}
            />
          </div>
        </div>

        {/* Brand 2 */}
        <div
          className={`flex-1 text-left pl-3 ${metric.winner === 'brand2' ? 'opacity-100' : 'opacity-60'}`}
        >
          <span
            className={`font-semibold tabular-nums text-sm ${metric.winner === 'brand2' ? 'text-[#7c3aed]' : ''}`}
          >
            {formatVal(metric.brand2, metric.label)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Score Board ─────────────────────────────────────────────────────────────

function ScoreBoard({ scores, brand1Name, brand2Name }: { scores: { brand1: number; brand2: number }; brand1Name: string; brand2Name: string }) {
  const b1Wins = scores.brand1;
  const b2Wins = scores.brand2;
  const total = b1Wins + b2Wins || 1;
  const b1Pct = (b1Wins / total) * 100;

  return (
    <GlassCard>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Battle Score
          </h3>
          <Trophy className="w-4 h-4 text-amber-500" />
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center flex-1">
            <div className="text-3xl font-black tabular-nums" style={{ color: BRAND1_COLOR }}>
              {b1Wins}
            </div>
            <div className="text-xs text-muted-foreground mt-1 truncate">{brand1Name}</div>
          </div>
          <div className="flex-1">
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${b1Pct}%`, background: `linear-gradient(90deg, ${BRAND1_COLOR}, ${BRAND2_COLOR})` }}
              />
            </div>
            <div className="text-xs text-center text-muted-foreground mt-1">
              {b1Wins === b2Wins ? 'Tied' : b1Wins > b2Wins ? brand1Name : brand2Name} leads
            </div>
          </div>
          <div className="text-center flex-1">
            <div className="text-3xl font-black tabular-nums text-[#7c3aed]">
              {b2Wins}
            </div>
            <div className="text-xs text-muted-foreground mt-1 truncate">{brand2Name}</div>
          </div>
        </div>
      </CardContent>
    </GlassCard>
  );
}

// ─── Brand Selector Card ─────────────────────────────────────────────────────

function BrandSelectorCard({
  label,
  value,
  brands,
  onChange,
  color,
  glowColor,
  isWinner,
}: {
  label: string;
  value: string;
  brands: BrandListItem[];
  onChange: (id: string) => void;
  color: string;
  glowColor: string;
  isWinner?: boolean;
}) {
  return (
    <div
      className={`
        rounded-2xl border p-5 glass-card transition-all duration-300
        ${isWinner ? 'glass-glow' : ''}
      `}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {label}
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-background/50 border-border/50 focus:ring-1 focus:ring-primary/30">
          <SelectValue placeholder="Select brand..." />
        </SelectTrigger>
        <SelectContent>
          {brands.map((b) => (
            <SelectItem key={b.brand_id} value={b.brand_id}>
              <span className="flex items-center gap-2">
                {b.is_primary && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                    PRIMARY
                  </span>
                )}
                {b.brand_name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && (
        <div className="mt-3 flex items-center gap-3">
          <BrandAvatar name={brands.find((b) => b.brand_id === value)?.brand_name ?? ''} color={color} size="md" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">
              {brands.find((b) => b.brand_id === value)?.brand_name}
            </div>
            {isWinner !== undefined && (
              <div className={`text-xs ${isWinner ? 'text-green-500' : 'text-muted-foreground'}`}>
                {isWinner ? 'Winning' : 'Trailing'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History Chart ────────────────────────────────────────────────────────────

function HistoryChart({
  battleData,
  brand1Name,
  brand2Name,
  metricKey,
}: {
  battleData: BattleData;
  brand1Name: string;
  brand2Name: string;
  metricKey: string;
}) {
  const { weeks, brand1Data, brand2Data } = battleData.history;
  if (weeks.length === 0) return null;

  const data = weeks.map((wk, i) => ({
    label: wk.weekLabel.split('(')[0]?.trim() ?? wk.week,
    brand1: brand1Data[metricKey]?.[i] ?? 0,
    brand2: brand2Data[metricKey]?.[i] ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="2 4" className="stroke-muted/50" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 9 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip content={<HistoryTooltip />} />
        <Line
          type="monotone"
          dataKey="brand1"
          name={brand1Name}
          stroke={BRAND1_COLOR}
          strokeWidth={2}
          dot={{ r: 3, fill: BRAND1_COLOR }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="brand2"
          name={brand2Name}
          stroke={BRAND2_COLOR}
          strokeWidth={2}
          dot={{ r: 3, fill: BRAND2_COLOR }}
          activeDot={{ r: 5 }}
          strokeDasharray="4 2"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Loading State ────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-32 skeleton-shimmer rounded-2xl" />
        <Skeleton className="h-32 skeleton-shimmer rounded-2xl" />
        <Skeleton className="h-32 skeleton-shimmer rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80 skeleton-shimmer rounded-2xl" />
        <Skeleton className="h-80 skeleton-shimmer rounded-2xl" />
      </div>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
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

// ─── Empty / Intro State ─────────────────────────────────────────────────────

function IntroState({ onSwap }: { onSwap: () => void }) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });
  return (
    <div
      ref={ref}
      className={`flex flex-col items-center justify-center py-24 ${isVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'}`}
    >
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#1a358b]/20 to-[#7c3aed]/20 flex items-center justify-center mb-6 border border-border/50">
        <Swords className="w-10 h-10 text-[#7c3aed]" />
      </div>
      <h3 className="text-xl font-bold mb-2">Battle Mode</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Select two brands above to launch a head-to-head competitive battle.
        Compare metrics, view radar charts, and track 4-week history.
      </p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BattlePage() {
  const { groupId, selectedWeek, isReady } = useApp();
  const { fetchWithAuth } = useAuth();

  const [brands, setBrands] = useState<BrandListItem[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);

  const [brand1Id, setBrand1Id] = useState('');
  const [brand2Id, setBrand2Id] = useState('');
  const [battleData, setBattleData] = useState<BattleData | null>(null);
  const [battleLoading, setBattleLoading] = useState(false);
  const [battleError, setBattleError] = useState<string | null>(null);
  const [vsAnimate, setVsAnimate] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('impressions');

  // Fetch brands list
  const fetchBrands = useCallback(async () => {
    if (!groupId || !isReady) return;
    setBrandsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedWeek) params.set('week', selectedWeek);
      const url = `/api/dashboard/${groupId}/rankings${params.toString() ? `?${params}` : ''}`;
      const res = await fetchWithAuth(url);
      const d = await res.json();
      if (d.success && d.data?.brands) {
        setBrands(d.data.brands);
        // Auto-select first two if available
        if (d.data.brands.length >= 2) {
          const [b1, b2] = d.data.brands;
          setBrand1Id(b1.brand_id);
          setBrand2Id(b2.brand_id);
        }
      }
    } catch {
      // ignore
    } finally {
      setBrandsLoading(false);
    }
  }, [groupId, selectedWeek, isReady, fetchWithAuth]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  // Fetch battle data when both brands are selected
  const fetchBattle = useCallback(async () => {
    if (!groupId || !brand1Id || !brand2Id || brand1Id === brand2Id) {
      setBattleData(null);
      return;
    }
    setBattleLoading(true);
    setBattleError(null);
    try {
      const params = new URLSearchParams();
      params.set('brand1', brand1Id);
      params.set('brand2', brand2Id);
      if (selectedWeek) params.set('week', selectedWeek);
      const url = `/api/dashboard/${groupId}/battle?${params}`;
      const res = await fetchWithAuth(url);
      const d = await res.json();
      if (d.success && d.data) {
        setBattleData(d.data);
      } else {
        setBattleError(d.error ?? 'Failed to load battle data');
      }
    } catch (e) {
      setBattleError(e instanceof Error ? e.message : 'Failed to load battle data');
    } finally {
      setBattleLoading(false);
    }
  }, [groupId, brand1Id, brand2Id, selectedWeek, fetchWithAuth]);

  useEffect(() => {
    fetchBattle();
  }, [fetchBattle]);

  // Trigger VS animation on brand change
  useEffect(() => {
    if (brand1Id && brand2Id) {
      setVsAnimate(true);
      const t = setTimeout(() => setVsAnimate(false), 800);
      return () => clearTimeout(t);
    }
  }, [brand1Id, brand2Id]);

  const handleSwap = () => {
    const tmp = brand1Id;
    setBrand1Id(brand2Id);
    setBrand2Id(tmp);
  };

  if (!isReady || brandsLoading) return <div className="p-6"><LoadingState /></div>;

  const b1Name = brands.find((b) => b.brand_id === brand1Id)?.brand_name ?? '';
  const b2Name = brands.find((b) => b.brand_id === brand2Id)?.brand_name ?? '';
  const b1IsWinner = battleData?.scores ? battleData.scores.brand1 > battleData.scores.brand2 : undefined;
  const b2IsWinner = battleData?.scores ? battleData.scores.brand2 > battleData.scores.brand1 : undefined;

  // Build radar data from battle metrics
  const radarData = battleData?.metrics.map((m) => {
    const max = Math.max(m.brand1, m.brand2, 1);
    return {
      metric: m.label,
      [b1Name || 'Brand 1']: Math.round((m.brand1 / max) * 100),
      [b2Name || 'Brand 2']: Math.round((m.brand2 / max) * 100),
    };
  }) ?? [];

  const historyMetricOptions = battleData?.metrics.map((m) => ({ key: m.label, label: m.label })) ?? [];

  const hasBothBrands = brand1Id && brand2Id && brand1Id !== brand2Id;

  return (
    <div className="p-6 space-y-6 noise-overlay min-h-screen">
      {/* Grid overlay */}
      <div className="fixed inset-0 pointer-events-none dashboard-grid-overlay -z-10" aria-hidden="true" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1a358b] to-[#7c3aed] flex items-center justify-center">
          <Swords className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Battle Mode</h2>
          <p className="text-sm text-muted-foreground">
            Head-to-head brand warfare — pick your contenders
          </p>
        </div>
        {battleData?.week && (
          <div className="ml-auto">
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
              {battleData.week.label}
            </span>
          </div>
        )}
      </div>

      {/* Brand Selectors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        <BrandSelectorCard
          label="Contender 1"
          value={brand1Id}
          brands={brands}
          onChange={setBrand1Id}
          color={BRAND1_COLOR}
          glowColor={BRAND1_GLOW}
          isWinner={hasBothBrands ? b1IsWinner : undefined}
        />

        <div className="flex flex-col items-center gap-3">
          <VsBadge animate={vsAnimate} />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSwap}
            disabled={!brand1Id || !brand2Id}
            className="text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Swap
          </Button>
        </div>

        <BrandSelectorCard
          label="Contender 2"
          value={brand2Id}
          brands={brands}
          onChange={setBrand2Id}
          color={BRAND2_COLOR}
          glowColor={BRAND2_GLOW}
          isWinner={hasBothBrands ? b2IsWinner : undefined}
        />
      </div>

      {/* Error state */}
      {battleError && (
        <ErrorState message={battleError} onRetry={fetchBattle} />
      )}

      {/* Intro state */}
      {!hasBothBrands && !battleLoading && !battleError && (
        <IntroState onSwap={handleSwap} />
      )}

      {/* Battle Content */}
      {hasBothBrands && battleData && !battleError && (
        <div className="space-y-6">
          {/* Score + Header Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ScoreBoard
              scores={battleData.scores}
              brand1Name={b1Name}
              brand2Name={b2Name}
            />

            {/* Brand Cards */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-4">
                <BrandAvatar name={b1Name} color={BRAND1_COLOR} size="lg" />
                <div className="flex-1">
                  <div className="font-bold text-lg">{b1Name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {brands.find((b) => b.brand_id === brand1Id)?.is_primary ? 'Primary Brand' : 'Competitor'}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${BRAND1_COLOR}22`, color: BRAND1_COLOR }}>
                      {battleData.scores.brand1} wins
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center gap-4">
                <BrandAvatar name={b2Name} color={BRAND2_COLOR} size="lg" />
                <div className="flex-1">
                  <div className="font-bold text-lg">{b2Name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {brands.find((b) => b.brand_id === brand2Id)?.is_primary ? 'Primary Brand' : 'Competitor'}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${BRAND2_COLOR}22`, color: BRAND2_COLOR }}>
                      {battleData.scores.brand2} wins
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar Chart */}
            <SpotlightCard>
              <GlassCard>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Performance Radar
                    </h3>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5" style={{ backgroundColor: BRAND1_COLOR }} />
                        <span className="truncate max-w-[100px]">{b1Name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5 border-t-2 border-dashed" style={{ borderColor: BRAND2_COLOR }} />
                        <span className="truncate max-w-[100px]">{b2Name}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Normalized scores (0-100) per metric
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} className="fill-muted-foreground" axisLine={false} />
                      <Radar
                        name={b1Name}
                        dataKey={b1Name}
                        stroke={BRAND1_COLOR}
                        fill={BRAND1_COLOR}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                      <Radar
                        name={b2Name}
                        dataKey={b2Name}
                        stroke={BRAND2_COLOR}
                        fill={BRAND2_COLOR}
                        fillOpacity={0.1}
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                      />
                      <Tooltip content={<RadarTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </GlassCard>
            </SpotlightCard>

            {/* Metric Comparison Table */}
            <SpotlightCard>
              <GlassCard>
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Metric Breakdown
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Click a row to view 4-week history
                  </p>
                  <div className="space-y-0 max-h-[260px] overflow-y-auto pr-1">
                    {battleData.metrics.map((metric, i) => (
                      <div
                        key={metric.label}
                        className={`
                          cursor-pointer rounded-lg px-2 py-1.5 -mx-2 transition-colors duration-150
                          ${selectedMetric === metric.label ? 'bg-muted/50' : 'hover:bg-muted/30'}
                        `}
                        onClick={() => setSelectedMetric(metric.label)}
                      >
                        <MetricRow
                          metric={metric}
                          brand1Name={b1Name}
                          brand2Name={b2Name}
                          index={i}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </GlassCard>
            </SpotlightCard>
          </div>

          {/* 4-Week History */}
          <SpotlightCard>
            <GlassCard>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    4-Week Trend
                  </h3>
                  <div className="flex items-center gap-1">
                    {historyMetricOptions.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setSelectedMetric(opt.key)}
                        className={`
                          text-xs px-2 py-1 rounded-full transition-colors
                          ${selectedMetric === opt.key
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                          }
                        `}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <HistoryChart
                  battleData={battleData}
                  brand1Name={b1Name}
                  brand2Name={b2Name}
                  metricKey={selectedMetric}
                />
              </CardContent>
            </GlassCard>
          </SpotlightCard>
        </div>
      )}

      {/* Loading overlay */}
      {battleLoading && hasBothBrands && (
        <div className="space-y-6 opacity-60 pointer-events-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-32 skeleton-shimmer rounded-2xl" />
            <Skeleton className="h-32 skeleton-shimmer rounded-2xl" />
            <Skeleton className="h-32 skeleton-shimmer rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 skeleton-shimmer rounded-2xl" />
            <Skeleton className="h-80 skeleton-shimmer rounded-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
