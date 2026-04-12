'use client';

import { useState, useEffect } from 'react';
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { useScrollReveal, useMultiScrollReveal } from '@/lib/use-scroll-reveal';
import { formatVietnamNumber, formatCompact } from '@/lib/vietnam-format';
import { RefreshCw, AlertCircle, ExternalLink, Video, ImageIcon, Layout, Zap, Clock } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContentData {
  format_performance: Array<{
    format: string;
    engagement: number;
    er: number;
    posts: number;
  }>;
  top_posts: Array<{
    id: string;
    brand_name: string;
    platform: string;
    content: string;
    impressions: number;
    engagement: number;
    er: number;
    format: string;
    posted_at: string;
    link: string | null;
  }>;
  top_keywords: Array<{
    keyword: string;
    count: number;
  }>;
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

const FORMAT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Video: Video,
  Image: ImageIcon,
  Carousel: Layout,
  Short: Zap,
  Story: Clock,
};

// ─── Hero Entrance ─────────────────────────────────────────────────────────────

function useHeroEntrance() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return isVisible;
}

// ─── Platform Badge ───────────────────────────────────────────────────────────

function PlatformBadge({ platform }: { platform: string }) {
  const color = PLATFORM_COLORS[platform] ?? '#888';
  return (
    <Badge
      variant="secondary"
      className={`text-xs gap-1 transition-all duration-200 ${platform === 'youtube' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' : platform === 'facebook' ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400' : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700'}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {PLATFORM_LABELS[platform] ?? platform}
    </Badge>
  );
}

// ─── Format Performance Chart Tooltip ─────────────────────────────────────────

function FormatTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm space-y-1">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium tabular-nums">
            {p.name === 'Engagement' ? formatVietnamNumber(p.value) : `${p.value}`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64 skeleton-shimmer" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <Card key={i}><CardContent className="p-5"><Skeleton className="h-64 w-full skeleton-shimmer" /></CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="p-5"><Skeleton className="h-96 w-full skeleton-shimmer" /></CardContent></Card>
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
      <p className="text-sm text-muted-foreground">No content data available</p>
    </div>
  );
}

// ─── Post Row with Stagger ─────────────────────────────────────────────────────

function PostRow({
  post,
  index,
}: {
  post: ContentData['top_posts'][0];
  index: number;
}) {
  const { ref, isVisible } = useScrollReveal<HTMLTableRowElement>({
    threshold: 0.05,
    delay: index * 40,
  });
  const FormatIcon = FORMAT_ICONS[post.format] ?? Video;

  return (
    <TableRow
      ref={ref}
      className={`
        transition-all duration-200
        hover:bg-muted/50 group
        ${isVisible ? 'table-row-animate' : 'opacity-0'}
      `}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <TableCell className="text-muted-foreground text-sm font-medium tabular-nums">
        {index + 1}
      </TableCell>
      <TableCell>
        <span className="font-semibold">{post.brand_name}</span>
      </TableCell>
      <TableCell>
        <PlatformBadge platform={post.platform} />
      </TableCell>
      <TableCell className="max-w-[280px]">
        <div className="flex items-center gap-2">
          <FormatIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <p className="truncate text-sm">{post.content || '(no content)'}</p>
        </div>
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatCompact(post.impressions)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatCompact(post.engagement)}
      </TableCell>
      <TableCell className="text-right">
        <span className={`font-semibold tabular-nums ${
          post.er >= 10 ? 'text-green-600' : post.er >= 5 ? 'text-foreground' : 'text-muted-foreground'
        }`}>
          {(post.er ?? 0).toFixed(1)}%
        </span>
      </TableCell>
      <TableCell>
        {post.link && (
          <a
            href={post.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Open post"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContentPage() {
  const { data, loading, error, refetch } = useDashboardData<ContentData>('content');
  const { ref: chartsRef, isVisible: chartsVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.05, delay: 80 });
  const { ref: postsRef, isVisible: postsVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.05, delay: 120 });
  const { ref: sectionRef, isVisible: sectionVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.1 });

  if (loading) return <div className="p-6"><LoadingSkeleton /></div>;
  if (error) return <div className="p-6"><ErrorState message={error} onRetry={refetch} /></div>;
  if (!data) return <div className="p-6"><EmptyState /></div>;

  const { format_performance, top_posts, top_keywords } = data;

  // Keywords chart data
  const keywordData = top_keywords.slice(0, 10).map((k) => ({
    keyword: k.keyword,
    count: k.count,
  }));

  return (
    <div className="p-6 space-y-6 noise-overlay">
      {/* Subtle grid overlay */}
      <div className="fixed inset-0 pointer-events-none dashboard-grid-overlay -z-10" aria-hidden="true" />

      {/* Header — hero entrance */}
      <div ref={sectionRef} className={`section-header-reveal ${sectionVisible ? 'is-visible' : ''}`}>
        <div>
          <h2 className="text-xl font-bold">Content</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Content performance and top performing posts
          </p>
        </div>
      </div>

      {/* Charts row */}
      <div
        ref={chartsRef}
        className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${chartsVisible ? 'stagger-children is-visible' : 'stagger-children'}`}
      >
        {/* Format Performance */}
        <div className={chartsVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'}>
          <Card className="hover-lift card-hover">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Format Performance — Engagement by content type
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={format_performance} layout="vertical" margin={{ left: 60, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="format"
                    type="category"
                    width={60}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<FormatTooltip />} />
                  <Bar
                    dataKey="engagement"
                    name="Engagement"
                    fill="#1a358b"
                    radius={[0, 4, 4, 0]}
                    label={{
                      position: 'right',
                      formatter: (v: number) => formatCompact(v),
                      fontSize: 11,
                      fill: 'hsl(var(--muted-foreground))',
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Keywords */}
        <div className={chartsVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'} style={{ transitionDelay: '80ms' }}>
          <Card className="hover-lift card-hover">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Top Keywords — Top trending keywords
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={keywordData} layout="vertical" margin={{ left: 60, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="keyword"
                    type="category"
                    width={60}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Mentions"
                    fill="#1a358b"
                    radius={[0, 4, 4, 0]}
                    label={{
                      position: 'right',
                      formatter: (v: number) => `${v}`,
                      fontSize: 11,
                      fill: 'hsl(var(--muted-foreground))',
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top Posts Table */}
      <div ref={postsRef} className={postsVisible ? 'dashboard-reveal is-visible' : 'dashboard-reveal'}>
        <Card className="overflow-hidden hover-lift card-hover">
          <CardContent className="p-0">
            <div className="p-5 pb-4 border-b border-border">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Top 20 Posts — Best performing posts
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Engagement</TableHead>
                  <TableHead className="text-right">ER</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top_posts.map((post, i) => (
                  <PostRow key={post.id} post={post} index={i} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}