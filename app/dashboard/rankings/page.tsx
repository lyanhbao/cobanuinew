'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { useScrollReveal } from '@/lib/use-scroll-reveal';
import { formatVietnamNumber } from '@/lib/vietnam-format';
import { RefreshCw, AlertCircle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RankingsData {
  brands: Array<{
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
  }>;
}

// ─── Sort state ───────────────────────────────────────────────────────────────

type SortKey = 'rank' | 'impressions' | 'sov_pct' | 'sos_pct' | 'reactions' | 'posts' | 'avg_er';
type SortDir = 'asc' | 'desc';

const SORT_LABELS: Record<SortKey, string> = {
  rank: 'Rank',
  impressions: 'Impressions',
  sov_pct: 'SOV',
  sos_pct: 'SOS',
  reactions: 'Reactions',
  posts: 'Posts',
  avg_er: 'Avg ER',
};

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color = '#000', isPrimary = false }: { data: number[]; color?: string; isPrimary?: boolean }) {
  if (!data || data.length < 2) return <div className="w-20 h-8" />;
  const w = 80, h = 32;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <div className="relative w-20 h-8 overflow-hidden" style={{ minWidth: 80, minHeight: 32 }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isPrimary ? 'sparkline-pulse' : ''}
        />
      </svg>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-40 skeleton-shimmer" />
        <Skeleton className="h-9 w-32 skeleton-shimmer" />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="space-y-3 p-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-6 skeleton-shimmer" />
                <Skeleton className="h-4 w-32 skeleton-shimmer" />
                <Skeleton className="h-4 w-16 skeleton-shimmer" />
                <Skeleton className="h-4 w-12 skeleton-shimmer" />
                <Skeleton className="h-4 w-12 skeleton-shimmer" />
                <Skeleton className="h-4 w-12 skeleton-shimmer" />
                <Skeleton className="h-8 w-20 skeleton-shimmer" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
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
      <p className="text-sm text-muted-foreground">No ranking data available</p>
    </div>
  );
}

// ─── Table Row with Stagger ────────────────────────────────────────────────────

function AnimatedTableRow({
  brand,
  index,
  gapUp,
}: {
  brand: RankingsData['brands'][0];
  index: number;
  gapUp: boolean;
}) {
  const { ref, isVisible } = useScrollReveal<HTMLTableRowElement>({
    threshold: 0.05,
    delay: index * 30,
  });

  return (
    <TableRow
      ref={ref}
      className={`
        ${index % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'}
        ${brand.is_primary ? 'primary-brand-row' : ''}
        hover:bg-muted/40
        transition-all duration-200
        ${isVisible ? 'table-row-animate' : 'opacity-0'}
      `}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <TableCell className="text-muted-foreground text-sm font-medium">
        {index + 1}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{brand.brand_name}</span>
          {brand.is_primary && (
            <Badge variant="default" className="text-xs glow-sm">Primary</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatVietnamNumber(brand.impressions)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className="font-semibold">{brand.sov_pct.toFixed(1)}%</span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {brand.sos_pct.toFixed(1)}%
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatVietnamNumber(brand.reactions)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {brand.posts}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {brand.avg_er.toFixed(1)}%
      </TableCell>
      <TableCell className="text-center">
        {brand.gap_pct !== null && brand.gap_pct !== undefined ? (
          <span className={`text-xs font-medium ${gapUp ? 'text-green-600' : 'text-red-600'}`}>
            {gapUp ? '▲' : '▼'} {Math.abs(brand.gap_pct).toFixed(1)}pp
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-center">
          <Sparkline
            data={brand.trend}
            color={brand.is_primary ? '#1a358b' : '#6b84cc'}
            isPrimary={brand.is_primary}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RankingsPage() {
  const { data, loading, error, refetch } = useDashboardData<RankingsData>('rankings');
  const [sortKey, setSortKey] = useState<SortKey>('impressions');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const { ref: tableRef, isVisible: tableVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.05 });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = data?.brands
    ? [...data.brands].sort((a, b) => {
        const aVal = a[sortKey] as number;
        const bVal = b[sortKey] as number;
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
      })
    : [];

  // SortIcon must be defined BEFORE early returns (Rules of Hooks)
  const SortIcon = useMemo(() => ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 ml-1 inline opacity-40" />;
    return sortDir === 'desc'
      ? <ArrowDown className="w-3 h-3 ml-1 inline" />
      : <ArrowUp className="w-3 h-3 ml-1 inline" />;
  }, [sortKey, sortDir]);

  if (loading) return <div className="p-6"><LoadingSkeleton /></div>;
  if (error) return <div className="p-6"><ErrorState message={error} onRetry={refetch} /></div>;
  if (!data || data.brands.length === 0) return <div className="p-6"><EmptyState /></div>;

  return (
    <div className="p-6 space-y-5 noise-overlay">
      {/* Subtle grid overlay */}
      <div className="fixed inset-0 pointer-events-none dashboard-grid-overlay -z-10" aria-hidden="true" />

      {/* Header controls — hero entrance + section reveal */}
      <div className={`section-header-reveal ${tableVisible ? 'is-visible' : ''}`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold">Rankings</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Brand rankings by share of voice (SOV) and share of search (SOS)
            </p>
          </div>
          <Select
            value={sortKey}
            onValueChange={(v) => { setSortKey(v as SortKey); setSortDir('desc'); }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div
        ref={tableRef}
        className={`${tableVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'}`}
      >
        <Card className="overflow-hidden hover-lift card-hover">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/50">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead
                className="text-right cursor-pointer select-none"
                onClick={() => handleSort('impressions')}
              >
                <div className="flex items-center justify-end gap-1">
                  Impressions <SortIcon col="impressions" />
                </div>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer select-none"
                onClick={() => handleSort('sov_pct')}
              >
                <div className="flex items-center justify-end gap-1">
                  SOV <SortIcon col="sov_pct" />
                </div>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer select-none"
                onClick={() => handleSort('sos_pct')}
              >
                <div className="flex items-center justify-end gap-1">
                  SOS <SortIcon col="sos_pct" />
                </div>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer select-none"
                onClick={() => handleSort('reactions')}
              >
                <div className="flex items-center justify-end gap-1">
                  Reactions <SortIcon col="reactions" />
                </div>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer select-none"
                onClick={() => handleSort('posts')}
              >
                <div className="flex items-center justify-end gap-1">
                  Posts <SortIcon col="posts" />
                </div>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer select-none"
                onClick={() => handleSort('avg_er')}
              >
                <div className="flex items-center justify-end gap-1">
                  Avg ER <SortIcon col="avg_er" />
                </div>
              </TableHead>
              <TableHead className="text-center">Gap</TableHead>
              <TableHead className="text-center w-24">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((brand, i) => {
              const gapUp = (brand.gap_pct ?? 0) >= 0;
              return (
                <AnimatedTableRow
                  key={brand.brand_id ?? brand.brand_name}
                  brand={brand}
                  index={i}
                  gapUp={gapUp}
                />
              );
            })}
          </TableBody>
        </Table>
        </Card>
      </div>
    </div>
  );
}
