'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useDashboardData } from '@/lib/use-dashboard-data';
import { formatCompact } from '@/lib/vietnam-format';
import { ChevronLeft, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Youtube, Facebook } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ViralPost {
  id: string;
  brand_name: string;
  platform: string;
  content: string;
  content_full: string;
  impressions: number;
  reactions: number;
  comments: number;
  shares: number;
  total_engagement: number;
  posted_at: string;
  link: string | null;
}

interface ViralSpotlightData {
  posts: ViralPost[];
  week: { label: string; start: string; number: number; year: number } | null;
}

// ─── Platform Icon ────────────────────────────────────────────────────────────

function PlatformIcon({ platform, className = '' }: { platform: string; className?: string }) {
  if (platform === 'youtube') return <Youtube className={className} />;
  if (platform === 'facebook') return <Facebook className={className} />;
  if (platform === 'tiktok') {
    return <span className={`text-sm ${className}`}>TT</span>;
  }
  return <span className={className}>{platform}</span>;
}

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  facebook: '#1877F2',
  tiktok: '#000000',
  instagram: '#E1306C',
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

// ─── Metric Pill ───────────────────────────────────────────────────────────────

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 border border-border/50">
      <span className="text-xs font-semibold tabular-nums">{formatCompact(value)}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ─── Viral Card ───────────────────────────────────────────────────────────────

function ViralCard({ post, isExpanded, onToggle }: { post: ViralPost; isExpanded: boolean; onToggle: () => void }) {
  const platformColor = PLATFORM_COLORS[post.platform] ?? '#888';
  const displayContent = isExpanded ? post.content_full : post.content;

  return (
    <div
      className={`
        relative flex flex-col gap-4 p-5 rounded-xl
        bg-gradient-to-br from-muted/20 to-muted/5
        border border-border/50
        hover:border-border transition-all duration-300 cursor-pointer
        ${isExpanded ? 'ring-1 ring-primary/20' : ''}
      `}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onToggle()}
    >
      {/* Platform + Brand header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${platformColor}20` }}
          >
            <PlatformIcon platform={post.platform} className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">{post.brand_name}</p>
            <p className="text-xs text-muted-foreground">{PLATFORM_LABELS[post.platform] ?? post.platform}</p>
          </div>
        </div>
        {/* Viral badge */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Viral</span>
        </div>
      </div>

      {/* Post content */}
      <p className={`text-sm leading-relaxed ${!isExpanded && post.content_full.length > 200 ? 'line-clamp-3' : ''}`}>
        {displayContent || <span className="text-muted-foreground italic">(No content)</span>}
      </p>

      {/* Engagement metrics */}
      <div className="flex items-center gap-2 flex-wrap">
        <MetricPill label="reactions" value={post.reactions} />
        <MetricPill label="comments" value={post.comments} />
        <MetricPill label="shares" value={post.shares} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border/30">
        <span className="text-xs text-muted-foreground">
          {post.posted_at ? new Date(post.posted_at).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }) : ''}
        </span>
        <div className="flex items-center gap-3">
          {post.link && (
            <a
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View Post →
            </a>
          )}
          {post.content_full.length > 200 && (
            <span className="text-xs text-muted-foreground">
              {isExpanded ? 'Show less' : 'Read more'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Carousel ─────────────────────────────────────────────────────────────────

function Carousel({ posts }: { posts: ViralPost[] }) {
  const [current, setCurrent] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goTo = useCallback((index: number) => {
    if (isTransitioning || index === current) return;
    setIsTransitioning(true);
    setExpanded(null);
    setTimeout(() => {
      setCurrent(index);
      setIsTransitioning(false);
    }, 200);
  }, [current, isTransitioning]);

  const goPrev = useCallback(() => {
    goTo((current - 1 + posts.length) % posts.length);
  }, [current, goTo, posts.length]);

  const goNext = useCallback(() => {
    goTo((current + 1) % posts.length);
  }, [current, goTo, posts.length]);

  // Auto-rotate every 8s
  useEffect(() => {
    if (posts.length <= 1) return;
    const timer = setInterval(() => {
      goNext();
    }, 8000);
    return () => clearInterval(timer);
  }, [posts.length, goNext]);

  if (posts.length === 0) return null;

  return (
    <div className="relative">
      {/* Cards */}
      <div className={`transition-all duration-200 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        <ViralCard
          post={posts[current]}
          isExpanded={expanded === current}
          onToggle={() => setExpanded(expanded === current ? null : current)}
        />
      </div>

      {/* Navigation arrows */}
      {posts.length > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={goPrev}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Previous post"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Dots */}
          <div className="flex items-center gap-2">
            {posts.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current
                    ? 'w-6 bg-primary'
                    : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                aria-label={`Go to post ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={goNext}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Next post"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg skeleton-shimmer" />
              <Skeleton className="h-4 w-32 skeleton-shimmer" />
            </div>
            <Skeleton className="h-4 w-full skeleton-shimmer" />
            <Skeleton className="h-4 w-3/4 skeleton-shimmer" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full skeleton-shimmer" />
              <Skeleton className="h-6 w-20 rounded-full skeleton-shimmer" />
              <Skeleton className="h-6 w-20 rounded-full skeleton-shimmer" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Error / Empty ────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="w-5 h-5" />
        <span className="text-sm font-medium">{message}</span>
      </div>
      <button onClick={onRetry} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <RefreshCw className="w-4 h-4" />
        Retry
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <p className="text-sm text-muted-foreground">No viral posts this week</p>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ViralSpotlight() {
  const { data, loading, error, refetch } = useDashboardData<ViralSpotlightData>('viral-spotlight');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data || data.posts.length === 0) return <EmptyState />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Viral Post Spotlight
          </h3>
          {data.week && (
            <p className="text-xs text-muted-foreground mt-0.5">{data.week.label}</p>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Top 3 by engagement
        </div>
      </div>
      <Carousel posts={data.posts} />
    </div>
  );
}
