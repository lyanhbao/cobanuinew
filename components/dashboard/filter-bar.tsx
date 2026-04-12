'use client';

import { useState } from 'react';
import { Calendar, SlidersHorizontal, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

type TimeRange = '7D' | '30D' | '90D' | '6M' | '1Y' | 'ALL';

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface DashboardFilterBarProps {
  /** Called when the time range changes */
  onTimeRangeChange?: (range: TimeRange) => void;
  /** Called when the custom date range changes */
  onDateRangeChange?: (range: DateRange) => void;
  /** Initial time range */
  defaultRange?: TimeRange;
}

const TIME_RANGES: TimeRange[] = ['7D', '30D', '90D', '6M', '1Y', 'ALL'];

// Map time range to approximate week window for dashboard week selector
const TIME_RANGE_TO_WEEKS: Record<TimeRange, number | null> = {
  '7D': 1,
  '30D': 4,
  '90D': 13,
  '6M': 26,
  '1Y': 52,
  'ALL': null,
};

function DateRangeDisplay({ range }: { range: DateRange }) {
  const fmt = (d: Date | undefined) => {
    if (!d) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card text-sm text-muted-foreground">
      <Calendar className="w-3.5 h-3.5 shrink-0" />
      <span>
        {range.from ? fmt(range.from) : 'Start'} — {range.to ? fmt(range.to) : 'End'}
      </span>
    </div>
  );
}

export default function DashboardFilterBar({
  onTimeRangeChange,
  onDateRangeChange,
  defaultRange = '1Y',
}: DashboardFilterBarProps) {
  const [activeRange, setActiveRange] = useState<TimeRange>(defaultRange);
  const [showFilters, setShowFilters] = useState(false);
  const [filterCount] = useState(1);
  const [customDate, setCustomDate] = useState<DateRange>({ from: undefined, to: undefined });
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const handleRangeChange = (value: string) => {
    const range = value as TimeRange;
    setActiveRange(range);
    onTimeRangeChange?.(range);
  };

  // When custom date range is set, switch to "ALL" range mode
  const handleDateSelect = (range: DateRange) => {
    setCustomDate(range);
    setDatePopoverOpen(false);
    onDateRangeChange?.(range);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Time Range Segmented Control */}
      <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 gap-0.5">
        {TIME_RANGES.map((range) => (
          <button
            key={range}
            onClick={() => handleRangeChange(range)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              activeRange === range
                ? 'bg-accent text-accent-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Active filters badge */}
      {filterCount > 0 && (
        <Badge
          variant="secondary"
          className="gap-1.5 text-xs px-2.5 py-1 h-6 bg-accent/20 text-accent-foreground border border-accent/30"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent-foreground" />
          {filterCount} filter
        </Badge>
      )}

      {/* Filters button */}
      <Popover open={showFilters} onOpenChange={setShowFilters}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs h-8 border-border/50"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold">Filters</h4>
            <button
              onClick={() => setShowFilters(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Platform</p>
              <ToggleGroup type="single" className="flex flex-wrap gap-1.5">
                {['YouTube', 'Facebook', 'TikTok'].map((p) => (
                  <ToggleGroupItem
                    key={p}
                    value={p}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    {p}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Brand Type</p>
              <ToggleGroup type="single" className="flex flex-wrap gap-1.5">
                {['Primary', 'Competitor', 'All'].map((b) => (
                  <ToggleGroupItem
                    key={b}
                    value={b}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    {b}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setShowFilters(false)}
            >
              Clear all
            </Button>
            <Button
              size="sm"
              className="text-xs ml-auto"
              onClick={() => setShowFilters(false)}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Custom date range */}
      <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-all">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>
              {customDate.from
                ? `${customDate.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${customDate.to?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) ?? '...'}`
                : 'Select date range'}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="range"
            selected={{ from: customDate.from, to: customDate.to }}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                handleDateSelect({ from: range.from, to: range.to });
              }
            }}
            numberOfMonths={2}
            className="rounded-md border"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}