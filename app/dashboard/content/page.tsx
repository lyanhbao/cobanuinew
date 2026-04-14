'use client';

import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { useApp } from '@/context/AppContext';
import { formatCompact } from '@/lib/vietnam-format';
import { getBrandColor } from '@/lib/brand-colors';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  ThumbsUp,
  FileText,
  Image,
  Video,
  FileSliders,
  Search,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { Platform } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContentData {
  week: {
    label: string;
    start: string;
    number: number;
    year: number;
  };
  format_performance: Array<{
    format: string;
    engagement: number;
    er: number;
    posts: number;
  }>;
  top_keywords: Array<{ keyword: string; count: number }>;
  top_posts: Array<{
    id: string;
    platform: Platform;
    format: string | null;
    content: string | null;
    posted_at: string;
    engagement: number;
    impressions: number;
    er: number;
    link: string | null;
    brand_name: string;
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

const FORMAT_COLORS: Record<string, string> = {
  Video: '#6366f1',
  Image: '#10b981',
  'True view': '#f59e0b',
  Bumper: '#ef4444',
  Short: '#8b5cf6',
  Story: '#06b6d4',
  Carousel: '#ec4899',
  Unknown: '#6b7280',
};

const FORMAT_ICONS: Record<string, React.ComponentType<{ className?: string; color?: string }>> = {
  Video: Video,
  Image: Image,
  'True view': FileSliders,
  Bumper: FileText,
  Short: FileText,
  Story: Image,
  Carousel: Image,
  Unknown: FileText,
};

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-4">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
        <div className="px-5 py-3 flex items-center justify-between border-t border-border">
          <Skeleton className="h-4 w-24" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
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
      <h1 className="text-xl font-semibold text-foreground">Content Intelligence</h1>
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

// ─── Format Performance Chart ─────────────────────────────────────────────────

function FormatPerformanceChart({ data }: { data: ContentData['format_performance'] }) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Format Performance
        </h3>
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          No format data for this week.
        </div>
      </div>
    );
  }

  // Sort by total engagement desc, cap to top 8 formats
  const sorted = [...data]
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 8);

  const chartData = sorted.map((item) => ({
    format: item.format,
    Impressions: item.engagement,
    Reactions: Math.round(item.engagement * (item.er / 100)),
    'ER (%)': item.er,
    posts: item.posts,
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Format Performance
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="format"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompact(v)}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]!.payload as typeof chartData[number];
              const orig = sorted.find((s) => s.format === d.format);
              return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm space-y-1">
                  <p className="font-semibold mb-1">{d.format}</p>
                  <p className="text-muted-foreground">
                    Posts: <span className="font-medium">{d.posts}</span>
                  </p>
                  {orig && (
                    <>
                      <p className="text-muted-foreground">
                        ER: <span className="font-medium">{orig.er.toFixed(1)}%</span>
                      </p>
                    </>
                  )}
                </div>
              );
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: '8px' }}
          />
          <Bar
            dataKey="Impressions"
            fill={FORMAT_COLORS.Video ?? '#6366f1'}
            name="Reactions"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Format legend table */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {sorted.map((item) => {
          const Icon = FORMAT_ICONS[item.format] ?? FileText;
          const color = FORMAT_COLORS[item.format] ?? '#6b7280';
          return (
            <div
              key={item.format}
              className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg text-xs"
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <Icon className="w-3.5 h-3.5 flex-shrink-0" color={color} />
              <span className="font-medium text-foreground truncate">{item.format}</span>
              <span className="text-muted-foreground ml-auto tabular-nums">{item.er.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Top Keywords Panel ────────────────────────────────────────────────────────

function TopKeywordsPanel({ keywords }: { keywords: ContentData['top_keywords'] }) {
  if (keywords.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Top Keywords
          </h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-6">No keywords for this week.</p>
      </div>
    );
  }

  const maxCount = keywords[0]?.count ?? 1;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Top Keywords
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {keywords.map((kw, i) => (
          <div
            key={kw.keyword}
            className="flex items-center gap-3 px-3 py-2 bg-secondary rounded-lg group hover:bg-accent transition-colors cursor-default"
          >
            <span className="text-xs text-muted-foreground tabular-nums w-5 text-right flex-shrink-0">
              {i + 1}
            </span>
            <span className="text-sm font-medium text-foreground capitalize truncate flex-1">
              {kw.keyword}
            </span>
            <div className="flex-shrink-0">
              <div
                className="h-1.5 rounded-full bg-primary/30 transition-all"
                style={{ width: `${Math.max((kw.count / maxCount) * 60, 6)}px` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground w-6 text-right">
              {kw.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Platform Badge ───────────────────────────────────────────────────────────

function PlatformBadge({ platform }: { platform: string }) {
  const color = PLATFORM_COLORS[platform] ?? '#6b7280';
  const label = PLATFORM_LABELS[platform] ?? platform;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-white flex-shrink-0"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

// ─── Format Badge ────────────────────────────────────────────────────────────

function FormatBadge({ format }: { format: string | null }) {
  const color = FORMAT_COLORS[format ?? 'Unknown'] ?? '#6b7280';

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{
        backgroundColor: `${color}20`,
        color,
      }}
    >
      {format ?? 'Unknown'}
    </span>
  );
}

// ─── Truncated Caption ───────────────────────────────────────────────────────

function TruncatedCaption({ content }: { content: string | null }) {
  if (!content) return <span className="text-muted-foreground italic text-xs">No caption</span>;

  // Strip HTML tags
  const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const truncated = text.length > 80 ? text.slice(0, 80) + '…' : text;

  return (
    <span
      className="text-sm text-muted-foreground cursor-default"
      title={text}
    >
      {truncated}
    </span>
  );
}

// ─── Top Posts Table ──────────────────────────────────────────────────────────

type PlatformFilter = 'all' | Platform;

const PLATFORM_FILTER_OPTIONS: { value: PlatformFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
];

function TopPostsTable({ posts }: { posts: ContentData['top_posts'] }) {
  const [page, setPage] = useState(0);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');

  const filtered = useMemo(() => {
    if (platformFilter === 'all') return posts;
    return posts.filter((p) => p.platform === platformFilter);
  }, [posts, platformFilter]);

  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleFilterChange(val: PlatformFilter) {
    setPlatformFilter(val);
    setPage(0);
  }

  if (posts.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Top Posts
          </h3>
        </div>
        <div className="px-5 py-12 text-center text-sm text-muted-foreground">
          No posts for this week.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Top Posts
        </h3>
        {/* Platform filter */}
        <div className="flex items-center gap-1.5">
          {PLATFORM_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleFilterChange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                platformFilter === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium uppercase tracking-wider w-8">
                #
              </th>
              <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium uppercase tracking-wider w-24">
                Platform
              </th>
              <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Brand
              </th>
              <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Caption
              </th>
              <th className="px-5 py-3 text-right text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Impressions
              </th>
              <th className="px-5 py-3 text-right text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Reactions
              </th>
              <th className="px-5 py-3 text-center text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Format
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.map((post, i) => {
              const rank = page * PAGE_SIZE + i + 1;
              const brandColor = getBrandColor(post.brand_name);

              return (
                <tr
                  key={post.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-5 py-3 text-xs text-muted-foreground tabular-nums">
                    {rank}
                  </td>
                  <td className="px-5 py-3">
                    <PlatformBadge platform={post.platform} />
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: brandColor }}
                    >
                      {post.brand_name}
                    </span>
                  </td>
                  <td className="px-5 py-3 min-w-0 max-w-[300px]">
                    <TruncatedCaption content={post.content} />
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-semibold tabular-nums text-foreground">
                    {formatCompact(post.impressions)}
                  </td>
                  <td className="px-5 py-3 text-right text-sm tabular-nums text-muted-foreground">
                    {formatCompact(post.engagement)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <FormatBadge format={post.format} />
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
          <span className="text-xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{' '}
            {filtered.length} posts
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                  page === i
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContentPage() {
  const { data, loading, error, refetch } = useDashboardData<ContentData>('content');

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
        <p className="text-sm text-muted-foreground">No content data available for this week.</p>
      </div>
    );
  }

  const { week, format_performance, top_keywords, top_posts } = data;

  return (
    <div className="p-6 space-y-5">
      <WeekNav weekLabel={week.label} />

      {/* Format Performance Chart */}
      <FormatPerformanceChart data={format_performance} />

      {/* Top Keywords + stats row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <TopKeywordsPanel keywords={top_keywords} />
        </div>
        {/* Quick stats sidebar */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Summary
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Posts</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatCompact(top_posts.length)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Posts in Top 20</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {top_posts.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Formats Tracked</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {format_performance.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Top Keywords</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {top_keywords.length}
                </span>
              </div>
            </div>
          </div>

          {/* Platform breakdown */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Platform Mix
              </h3>
            </div>
            <div className="space-y-3">
              {(
                [
                  { platform: 'facebook', label: 'Facebook' },
                  { platform: 'youtube', label: 'YouTube' },
                  { platform: 'tiktok', label: 'TikTok' },
                ] as const
              ).map(({ platform, label }) => {
                const count = top_posts.filter((p) => p.platform === platform).length;
                const pct = top_posts.length > 0 ? (count / top_posts.length) * 100 : 0;
                const color = PLATFORM_COLORS[platform];
                return (
                  <div key={platform}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-foreground tabular-nums">
                        {count} posts
                      </span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Top Posts Table */}
      <TopPostsTable posts={top_posts} />
    </div>
  );
}