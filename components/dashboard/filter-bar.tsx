'use client';

import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useApp } from '@/context/AppContext';
import type { Platform, BrandType } from '@/context/AppContext';
import { cn } from '@/lib/utils';

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

export default function DashboardFilterBar() {
  const { filters, setFilters } = useApp();
  const [open, setOpen] = useState(false);

  const activeFilterCount = [
    filters.platform !== 'all',
    filters.brandType !== 'all',
  ].filter(Boolean).length;

  const handleChange = (key: 'platform' | 'brandType', value: string) => {
    setFilters({ [key]: value });
  };

  const handleClearAll = () => {
    setFilters({ platform: 'all', brandType: 'all' });
  };

  return (
    <div className="flex items-center gap-2">
      {/* Active filters badge */}
      {activeFilterCount > 0 && (
        <Badge
          variant="outline"
          className="gap-1.5 text-xs px-2 py-0.5 h-6 border-primary/40 bg-primary/5 text-primary"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
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
              'gap-2 text-xs h-8 border-border/50 transition-all',
              activeFilterCount > 0 && 'border-primary/40 bg-primary/5 text-primary',
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold">Filters</h4>
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
              <ToggleGroup
                type="single"
                value={filters.platform}
                onValueChange={(v) => v && handleChange('platform', v)}
                className="flex flex-wrap gap-1.5"
              >
                {PLATFORM_OPTIONS.map((opt) => (
                  <ToggleGroupItem
                    key={opt.value}
                    value={opt.value}
                    variant="outline"
                    size="sm"
                    className={cn(
                      'text-xs',
                      filters.platform === opt.value && opt.value !== 'all'
                        ? 'border-primary/40 bg-primary/5 text-primary'
                        : '',
                    )}
                  >
                    {opt.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {/* Brand Type filter */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Brand Type
              </p>
              <ToggleGroup
                type="single"
                value={filters.brandType}
                onValueChange={(v) => v && handleChange('brandType', v)}
                className="flex flex-wrap gap-1.5"
              >
                {BRAND_TYPE_OPTIONS.map((opt) => (
                  <ToggleGroupItem
                    key={opt.value}
                    value={opt.value}
                    variant="outline"
                    size="sm"
                    className={cn(
                      'text-xs',
                      filters.brandType === opt.value && opt.value !== 'all'
                        ? 'border-primary/40 bg-primary/5 text-primary'
                        : '',
                    )}
                  >
                    {opt.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
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
  );
}
