'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { useScrollReveal } from '@/lib/use-scroll-reveal';
import { formatCompact } from '@/lib/vietnam-format';
import { RefreshCw, AlertCircle, Globe } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Platform = 'all' | 'youtube' | 'facebook' | 'tiktok';

interface PlatformEntry {
  platform: string;
  kpis: {
    views: number; impressions: number; reactions: number;
    posts: number; avg_engagement_rate: number;
  };
  format_mix: { format: string; count: number; pct: number }[];
  posting_cadence: CadenceEntry[];
  yt_details: { shorts: number; normal: number; shorts_er: number; normal_er: number } | null;
}

interface CadenceEntry {
  week: string;
  posts: number;
  youtube: number;
  facebook: number;
  tiktok: number;
}

interface ChannelData {
  week?: { label: string; start: string; number: number; year: number };
  platforms: PlatformEntry[];
  format_mix: Array<{ format: string; youtube: number; facebook: number; tiktok: number }>;
  cadence: CadenceEntry[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  facebook: '#1877F2',
  tiktok: '#000000',
  brand: '#1a358b',
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  youtube: Globe,
  facebook: Globe,
  tiktok: Globe,
};

const PLATFORM_ORDER: Platform[] = ['all', 'youtube', 'facebook', 'tiktok'];

const PLATFORM_ACCENT: Record<Platform, string> = {
  all: '',
  youtube: 'platform-accent-youtube',
  facebook: 'platform-accent-facebook',
  tiktok: 'platform-accent-tiktok',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function changeStr(current: number, prev: number): string {
  if (!prev) return '—';
  const pct = ((current - prev) / prev) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function FormatTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm space-y-1 glow-sm">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.fill }} />
          <span className="text-muted-foreground">{PLATFORM_LABELS[p.name] ?? p.name}:</span>
          <span className="font-medium tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-96 skeleton-shimmer" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}><CardContent className="p-5"><Skeleton className="h-20 w-full skeleton-shimmer" /></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardContent className="p-5"><Skeleton className="h-64 w-full skeleton-shimmer" /></CardContent></Card>
        <Card><CardContent className="p-5"><Skeleton className="h-64 w-full skeleton-shimmer" /></CardContent></Card>
      </div>
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
      <p className="text-sm text-muted-foreground">No channel data available</p>
    </div>
  );
}

// ─── KPI Card with Stagger ───────────────────────────────────────────────────

interface KpiCardProps {
  platform: Platform;
  pd: PlatformEntry['kpis'];
  color: string;
  delay: number;
}

function KpiCard({ platform, pd, color, delay }: KpiCardProps) {
  const Icon = PLATFORM_ICONS[platform];
  const change = changeStr(pd.impressions, 0);
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.05, delay });

  return (
    <div
      ref={ref}
      className={`${isVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <Card
        className={`
          hover-lift transition-all duration-200
          ${platform !== 'all' && platform ? PLATFORM_ACCENT[platform] : ''}
          ${platform !== 'all' && platform ? 'ring-2' : ''}
        `}
        style={platform !== 'all' && platform ? { '--tw-ring-color': color } as React.CSSProperties : undefined}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {Icon && <Icon className="w-4 h-4" style={{ color }} />}
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                {platform === 'all' ? 'All Platforms' : PLATFORM_LABELS[platform]}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-2xl font-bold tabular-nums">{formatCompact(pd.impressions)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{change} vs prev week</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Views</p>
                <p className="text-sm font-semibold tabular-nums">{formatCompact(pd.views)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Posts</p>
                <p className="text-sm font-semibold tabular-nums">{pd.posts}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Engagement</p>
                <p className="text-sm font-semibold tabular-nums">{formatCompact(pd.reactions)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg ER</p>
                <p className="text-sm font-semibold tabular-nums">{pd.avg_engagement_rate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChannelPage() {
  const [platform, setPlatform] = useState<Platform>('all');
  const { data, loading, error, refetch } = useDashboardData<ChannelData>('channel', { deps: [platform] });
  const { ref: sectionRef, isVisible: sectionVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });
  const { ref: kpiRef, isVisible: kpiVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.05, delay: 50 });
  const { ref: chartsRef, isVisible: chartsVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.05, delay: 100 });

  if (loading) return <div className="p-6"><LoadingSkeleton /></div>;
  if (error) return <div className="p-6"><ErrorState message={error} onRetry={refetch} /></div>;
  if (!data) return <div className="p-6"><EmptyState /></div>;

  const { platforms, format_mix, cadence } = data;

  // Build KPI row based on selected platform
  const showAll = platform === 'all';

  // kpiPlatforms: which platform tabs to show in the KPI row
  const kpiPlatforms: Platform[] = [];
  if (showAll || platform === 'youtube') kpiPlatforms.push('youtube');
  if (showAll || platform === 'facebook') kpiPlatforms.push('facebook');
  if (showAll || platform === 'tiktok') kpiPlatforms.push('tiktok');

  // Build platform lookup map keyed by platform name
  const platformMap = new Map<string, PlatformEntry>();
  for (const p of platforms) {
    platformMap.set(p.platform, p);
  }

  // Format mix data
  const formatChartData = showAll
    ? format_mix.map((f) => ({
        format: f.format,
        YouTube: f.youtube,
        Facebook: f.facebook,
        TikTok: f.tiktok,
      }))
    : (() => {
        const entry = platformMap.get(platform);
        const formats = entry?.format_mix ?? [];
        return formats.map((f) => ({ format: f.format, [PLATFORM_LABELS[platform] ?? platform]: f.count }));
      })();

  return (
    <div className="p-6 space-y-6 noise-overlay">
      {/* Subtle grid overlay */}
      <div className="fixed inset-0 pointer-events-none dashboard-grid-overlay -z-10" aria-hidden="true" />

      {/* Header — section reveal */}
      <div ref={sectionRef} className={`section-header-reveal ${sectionVisible ? 'is-visible' : ''}`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold">Channel</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Platform Performance — Impressions, Views, Engagement
            </p>
          </div>
          <Tabs value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
            <TabsList>
              {PLATFORM_ORDER.map((p) => {
                const Icon = PLATFORM_ICONS[p];
                return (
                  <TabsTrigger key={p} value={p} className="gap-1.5">
                    {Icon && <Icon className="w-4 h-4" />}
                    {p === 'all' ? 'All' : PLATFORM_LABELS[p]}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        ref={kpiRef}
        className={`grid gap-4 ${kpiPlatforms.length === 1 ? 'grid-cols-5' : kpiPlatforms.length === 2 ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-5 xl:grid-cols-5'} ${kpiVisible ? 'stagger-children is-visible' : 'stagger-children'}`}
      >
        {kpiPlatforms.map((p, idx) => {
          const pd = platformMap.get(p)?.kpis ?? { views: 0, impressions: 0, reactions: 0, posts: 0, avg_engagement_rate: 0 };
          const color = PLATFORM_COLORS[p];

          return (
            <KpiCard
              key={p}
              platform={p}
              pd={pd}
              color={color}
              delay={idx * 80}
            />
          );
        })}
      </div>

      {/* Charts */}
      <div
        ref={chartsRef}
        className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${chartsVisible ? 'stagger-children is-visible' : 'stagger-children'}`}
      >
        {/* Format Mix */}
        <div className={chartsVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'}>
          <Card className="hover-lift card-hover">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Format Mix — Post counts by content type
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={formatChartData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="format" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<FormatTooltip />} />
                  {showAll && (
                    <>
                      <Bar dataKey="YouTube" stackId="a" fill={PLATFORM_COLORS.youtube} radius={[4, 0, 0, 4]} isAnimationActive />
                      <Bar dataKey="Facebook" stackId="a" fill={PLATFORM_COLORS.facebook} isAnimationActive />
                      <Bar dataKey="TikTok" stackId="a" fill={PLATFORM_COLORS.tiktok} radius={[0, 4, 4, 0]} isAnimationActive />
                    </>
                  )}
                  {!showAll && (
                    <Bar
                      dataKey={PLATFORM_LABELS[platform]}
                      fill={PLATFORM_COLORS[platform]}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Posting Cadence */}
        <div className={chartsVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'} style={{ transitionDelay: '100ms' }}>
          <Card className="hover-lift card-hover">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Posting Cadence — Weekly posting frequency
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={cadence} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="youtube"
                    name="YouTube"
                    stroke={PLATFORM_COLORS.youtube}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="facebook"
                    name="Facebook"
                    stroke={PLATFORM_COLORS.facebook}
                    strokeWidth={1.5}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tiktok"
                    name="TikTok"
                    stroke={PLATFORM_COLORS.tiktok}
                    strokeWidth={1.5}
                    dot={{ r: 2 }}
                    strokeDasharray="5 3"
                  />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
