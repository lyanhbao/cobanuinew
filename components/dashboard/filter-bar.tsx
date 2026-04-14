'use client';

import { useState, useMemo } from 'react';
import { SlidersHorizontal, X, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useApp } from '@/context/AppContext';
import type { Platform, BrandType, TimeRange } from '@/context/AppContext';
import { cn } from '@/lib/utils';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'ALL' },
];

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: 'all', label: 'All Platforms' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
];

const BRAND_TYPE_OPTIONS: { value: BrandType; label: string }[] = [
  { value: 'all', label: 'All Brands' },
  { value: 'primary', label: 'Primary' },
  { value: 'competitor', label: 'Competitor' },
];

// ─── Week Navigation ────────────────────────────────────────────────────────────

function WeekNav() {
  const { filters, setFilters, availableWeeks, selectedWeek, setSelectedWeek } = useApp();

  // Weeks visible within the current time range filter
  const weeksInRange = useMemo(() => {
    if (filters.timeRange === 'all' || availableWeeks.length === 0) return availableWeeks;

    const latest = availableWeeks[availableWeeks.length - 1]!;
    const d = new Date(latest + 'T00:00:00Z');
    switch (filters.timeRange) {
      case '7d': d.setDate(d.getDate() - 7); break;
      case '30d': d.setDate(d.getDate() - 30); break;
      case '90d': d.setDate(d.getDate() - 90); break;
      case '6m': d.setMonth(d.getMonth() - 6); break;
      case '1y': d.setFullYear(d.getFullYear() - 1); break;
    }
    const cutoff = d.toISOString().slice(0, 10);
    return availableWeeks.filter((w) => w >= cutoff);
  }, [availableWeeks, filters.timeRange]);

  // When time range changes, auto-select the latest week within the new range
  const handleTimeRangeChange = (value: TimeRange) => {
    setFilters({ timeRange: value });

    if (value === 'all' || weeksInRange.length === 0) return;

    const latestInRange = weeksInRange[weeksInRange.length - 1]!;
    if (selectedWeek < latestInRange) {
      setSelectedWeek(latestInRange);
    } else if (!weeksInRange.includes(selectedWeek)) {
      setSelectedWeek(latestInRange);
    }
  };

  const currentIdx = weeksInRange.indexOf(selectedWeek);
  const canGoPrev = currentIdx > 0;
  const canGoNext = currentIdx < weeksInRange.length - 1;

  const goPrev = () => {
    if (canGoPrev) setSelectedWeek(weeksInRange[currentIdx - 1]!);
  };

  const goNext = () => {
    if (canGoNext) setSelectedWeek(weeksInRange[currentIdx + 1]!);
  };

  const weekLabel = selectedWeek
    ? (() => {
        const d = new Date(selectedWeek + 'T00:00:00Z');
        const weekNum = Math.ceil(
          (d.getDate() - d.getDay() + 1) / 7
        );
        return `W${weekNum} · ${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
      })()
    : '';

  return (
    <div className="flex items-center gap-1.5">
      {/* Time range pills */}
      <div className="flex items-center gap-1">
        {TIME_RANGES.map((range) => {
          const isActive = filters.timeRange === range.value;
          return (
            <button
              key={range.value}
              onClick={() => handleTimeRangeChange(range.value)}
              className={cn(
                'text-xs font-medium px-2.5 py-1 rounded-md transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary/50 text-muted-foreground border border-border hover:bg-accent hover:text-foreground'
              )}
            >
              {range.label}
            </button>
          );
        })}
      </div>

      {/* Week navigation arrows */}
      <div className="flex items-center gap-1 ml-2 border-l border-border pl-2">
        <button
          onClick={goPrev}
          disabled={!canGoPrev}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous week"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span className="text-xs text-foreground font-medium tabular-nums min-w-[80px] text-center">
          {weekLabel}
        </span>
        <button
          onClick={goNext}
          disabled={!canGoNext}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next week"
        >
          <svg xmlns="http://www.w3.org/2003/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  );
}

// ─── Main Filter Bar ────────────────────────────────────────────────────────────

export default function DashboardFilterBar() {
  const { filters, setFilters } = useApp();
  const [open, setOpen] = useState(false);

  const activeFilterCount = [
    filters.platform !== 'all',
    filters.brandType !== 'all',
  ].filter(Boolean).length;

  const handlePlatformChange = (value: string) => {
    setFilters({ platform: value as Platform });
  };

  const handleBrandTypeChange = (value: string) => {
    setFilters({ brandType: value as BrandType });
  };

  const handleClearAll = () => {
    setFilters({ platform: 'all', brandType: 'all' });
  };

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Left: Time range pills + week nav */}
      <WeekNav />

      {/* Right: Filters + date display */}
      <div className="flex items-center gap-3">
        {/* Date range display */}
        <DateRangeDisplay />

        {/* Active filters badge */}
        {activeFilterCount > 0 && (
          <Badge
            variant="outline"
            className="gap-1.5 text-xs px-2.5 py-1 h-6 border-primary/30 bg-primary/10 text-primary"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
            {activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}
            <button
              onClick={handleClearAll}
              className="ml-1 hover:opacity-70 transition-opacity"
              aria-label="Clear all filters"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        )}

        {/* Filters popover */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'gap-2 text-xs h-8 border-border bg-secondary/50 hover:bg-accent transition-colors',
                activeFilterCount > 0 && 'border-primary/30 bg-primary/10 text-primary',
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-4 bg-popover border-border"
            align="end"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-foreground">Filters</h4>
              {activeFilterCount > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Platform filter */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Platform
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PLATFORM_OPTIONS.map((opt) => {
                    const isActive = filters.platform === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handlePlatformChange(opt.value)}
                        className={cn(
                          'text-xs px-3 py-1.5 rounded-full transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground border border-border',
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Brand Type filter */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Brand Type
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {BRAND_TYPE_OPTIONS.map((opt) => {
                    const isActive = filters.brandType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleBrandTypeChange(opt.value)}
                        className={cn(
                          'text-xs px-3 py-1.5 rounded-full transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground border border-border',
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border">
              <Button
                size="sm"
                className="w-full text-xs"
                onClick={() => setOpen(false)}
              >
                Apply Filters
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// ─── Date Range Display ─────────────────────────────────────────────────────────

function DateRangeDisplay() {
  const { availableWeeks } = useApp();

  if (availableWeeks.length === 0) return null;

  const latest = availableWeeks[availableWeeks.length - 1]!;
  const earliest = availableWeeks[0]!;

  const fmt = (d: string) => {
    const date = new Date(d + 'T00:00:00Z');
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
      <Calendar className="w-3.5 h-3.5" />
      <span>{fmt(earliest)} – {fmt(latest)}</span>
    </div>
  );
}
