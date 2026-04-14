# COBAN Overview Tab — Implementation Template

**Version:** 2.0 | **Date:** 2026-04-14 | **Author:** Analyst
**Status:** Ready for frontend/backend agent handoff
**Dependencies:** `app/dashboard/overview/page.tsx`, `app/api/dashboard/[groupId]/overview/route.ts`, `lib/types.ts`, `lib/vietnam-format.ts`

---

## 1. Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  DashboardHeader (group selector | week selector | filters)    │
├─────────────────────────────────────────────────────────────────┤
│  KPI ROW (6 cards, 6-column grid)                               │
│  [Impressions] [Views] [Reactions] [Posts] [Avg ER] [Primary SOV]│
├────────────────────────────────┬────────────────────────────────┤
│  SOV STACKED BAR (lg:col-span-2)│  NETWORK DONUT (lg:col-span-1) │
│  brand × platform impressions    │  YT / FB / TT breakdown        │
│  Height: 300px                   │  Height: 300px                │
├────────────────────────────────┴────────────────────────────────┤
│  INSIGHTS ROW (4 mini cards, 4-column grid)                     │
│  [Top Gainer] [Top Loser] [Most Active] [Highest Engagement]  │
├─────────────────────────────────────────────────────────────────┤
│  WEEK-OVER-WEEK LINE CHART (4-week trend, 3 lines)             │
│  Primary brand | Competitor avg | Market total                  │
│  Height: 300px                                                 │
├─────────────────────────────────────────────────────────────────┤
│  BRAND PERFORMANCE TABLE (top 5 by impressions, sortable)        │
│  Rank | Brand | Impressions | SOV% | Reactions | WoW Trend      │
└─────────────────────────────────────────────────────────────────┘
```

### Grid Layout
```tsx
// Main sections — each wrapped in a <section> with space-y-5 gap
<div className="p-6 space-y-5">

  {/* KPI row: full-width 6-col grid */}
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
    <KpiCard ... />
  </div>

  {/* SOV + Network: 2/3 + 1/3 split */}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
    <div className="lg:col-span-2"><SovStackedChart ... /></div>
    <div className="lg:col-span-1"><NetworkDonut ... /></div>
  </div>

  {/* Insights row: 4 equal columns */}
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <InsightCard ... />
  </div>

  {/* WoW trend: full width */}
  <div className="bg-card border border-border rounded-xl p-5">
    <WeekTrendChart ... />
  </div>

  {/* Brand table: full width */}
  <div className="bg-card border border-border rounded-xl overflow-hidden">
    <BrandTable ... />
  </div>
</div>
```

### Responsive Behavior
- **Mobile (<768px):** Single column, KPI cards scroll horizontally (`overflow-x-auto`), SOV and Network stack, Insights 2-col, Table horizontal scroll
- **Tablet (768–1024px):** KPI 3-col, SOV full width, Insights 4-col, Table scrolls
- **Desktop (>1024px):** KPI 6-col, SOV 2/3 + Donut 1/3 side-by-side

---

## 2. Component Specifications

### 2.1 KPI Cards (6 cards)

**Current state:** Already implemented in `app/dashboard/overview/page.tsx` (lines 116–142). Reuse as-is — no changes needed.

**Props:**
```ts
interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  format: 'compact' | 'number' | 'percent';
}
```

| Metric | Icon | Format | Data Source |
|--------|------|--------|-------------|
| Impressions | `Eye` | compact | `kpis.total_impressions` |
| Views | `TrendingUp` | compact | `kpis.total_views` |
| Reactions | `ThumbsUp` | compact | `kpis.total_reactions` |
| Posts | `FileText` | number | `kpis.total_posts` |
| Avg ER | `Percent` | percent | `kpis.avg_engagement_rate` |
| Primary SOV | `TrendingUp` | percent | `kpis.sov_primary` |

**Grid:** `grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4`
**Card:** `bg-card border border-border rounded-xl p-5`
**Value:** `text-2xl font-bold text-foreground tabular-nums tracking-tight`
**Label:** `text-xs text-muted-foreground uppercase tracking-wider font-medium`

---

### 2.2 SOV Stacked Bar Chart — REPLACE existing horizontal SOV bar

**What it shows:** Each brand as one horizontal bar, segmented by platform (YouTube, Facebook, TikTok) showing impressions per platform. Sorted by total impressions descending.

**Recharts component:** `BarChart` with `layout="vertical"` + `stackId="a"`

**Data transformation:**
```ts
// Each brand needs: brand_name, is_primary, youtube, facebook, tiktok, total
// Map from: data.sov[] (each entry already has youtube/facebook/tiktok impressions)
const chartData = data.sov
  .map((b, i) => ({
    brand_name: b.brand_name,
    is_primary: b.is_primary,
    color: b.is_primary ? PRIMARY_COLOR : COMPETITOR_COLORS[i % COMPETITOR_COLORS.length],
    youtube: b.youtube_impressions,
    facebook: b.facebook_impressions,
    tiktok: b.tiktok_impressions,
    total: b.youtube_impressions + b.facebook_impressions + b.tiktok_impressions,
  }))
  .sort((a, b) => b.total - a.total);
```

**Visual specs:**
- Height: `Math.max(data.length * 48, 280)` (dynamic, min 280px)
- Bar height: auto-sized by Recharts
- Platform segment colors: `PLATFORM_COLORS.youtube` / `PLATFORM_COLORS.facebook` / `PLATFORM_COLORS.tiktok`
- Y-axis: brand names, width `110px`, font-size `12px`
- X-axis: compact format (`formatCompact`), font-size `11px`, no axis lines
- Tooltip: brand name + per-platform breakdown + total
- Legend: bottom, show YT/FB/TT with platform color dots

**API extension required:** Each entry in `sov[]` needs:
```ts
{ youtube_impressions: number; facebook_impressions: number; tiktok_impressions: number; total_reactions: number }
```

**Implementation:**
```tsx
<ResponsiveContainer width="100%" height={Math.max(chartData.length * 48, 280)}>
  <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 60, top: 4, bottom: 4 }}>
    <XAxis
      type="number"
      tickFormatter={(v) => formatCompact(v)}
      tick={{ fontSize: 11 }}
      axisLine={false}
      tickLine={false}
    />
    <YAxis
      dataKey="brand_name"
      type="category"
      width={110}
      tick={{ fontSize: 12 }}
      axisLine={false}
      tickLine={false}
    />
    <Tooltip
      content={({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const d = payload[0].payload;
        return (
          <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
            <p className="font-semibold mb-1">{d.brand_name}</p>
            {['youtube', 'facebook', 'tiktok'].map((p) => (
              <p key={p} className="text-muted-foreground">
                {PLATFORM_LABELS[p]}: <span className="font-medium">{formatVietnamNumber(d[p])}</span>
              </p>
            ))}
            <p className="text-muted-foreground border-t border-border mt-1 pt-1">
              Total: <span className="font-medium">{formatVietnamNumber(d.total)}</span>
            </p>
          </div>
        );
      }}
    />
    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
    <Bar dataKey="youtube" stackId="a" fill={PLATFORM_COLORS.youtube} name="YouTube" />
    <Bar dataKey="facebook" stackId="a" fill={PLATFORM_COLORS.facebook} name="Facebook" />
    <Bar dataKey="tiktok" stackId="a" fill={PLATFORM_COLORS.tiktok} name="TikTok" radius={[0, 4, 4, 0]} />
  </BarChart>
</ResponsiveContainer>
```

---

### 2.3 Network Donut Chart — Polish existing

**Current state:** Already implemented in `app/dashboard/overview/page.tsx` (lines 218–287). Reuse as-is with minor polish.

**Polish changes:**
- Height: `h-[300px]` (currently 180px — update to match SOV stacked bar)
- Add center label showing total impressions with "Total" subtitle
- Legend below chart (already correct in current implementation)

**Center label implementation (add inside PieChart):**
```tsx
<PieChart>
  <Pie ...>
    {/* cells */}
  </Pie>
  {/* Center label — use a custom label or the ReferenceArc trick */}
  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="select-none">
    <tspan x="50%" dy="-0.5em" className="text-lg font-bold fill-foreground">
      {formatCompact(totalImpressions)}
    </tspan>
    <tspan x="50%" dy="1.5em" className="text-xs fill-muted-foreground">
      Total
    </tspan>
  </text>
  {/* ...Tooltip, Legend */}
</PieChart>
```

---

### 2.4 Insights Row — 4 Mini Cards (NEW)

**What it shows:**

| Card | Metric | Derivation | Data Source |
|------|--------|-----------|-------------|
| Top Gainer | Brand with highest positive `gap_pct` | `insights` sorted DESC by gap_pct | `insights[]` |
| Top Loser | Brand with highest negative `gap_pct` | `insights` sorted ASC by gap_pct | `insights[]` |
| Most Active Platform | Platform with most impressions | `network_breakdown` sorted DESC | `network_breakdown[]` |
| Highest Engagement | Brand with highest reactions ratio | `sov[]` with `total_reactions` | NEW: `sov[].total_reactions` |

**"Highest Engagement" note:** Requires `total_reactions` per brand in `sov[]`. If not available, replace with "Most Posts" — brand with highest `total_posts` from `weekly_stats`.

**Visual specs:**
- Grid: `grid grid-cols-2 lg:grid-cols-4 gap-4`
- Card: `bg-card border border-border rounded-xl p-4`
- Internal: flex row for icon+label, then value row
- Trend badge: `▲` / `▼` with green/red color + percentage

**Implementation (in page component):**
```tsx
// Derivation
const topGainer = insights
  .filter((i) => i.direction === 'up')
  .sort((a, b) => parseFloat(b.change) - parseFloat(a.change))[0];

const topLoser = insights
  .filter((i) => i.direction === 'down')
  .sort((a, b) => parseFloat(a.change) - parseFloat(b.change))[0];

const mostActive = [...network_breakdown].sort((a, b) => b.impressions - a.impressions)[0];

const bestEngagement = data.sov
  ? [...data.sov].sort((a, b) => (b.total_reactions || 0) - (a.total_reactions || 0))[0]
  : null;

const insightCards = [
  {
    icon: TrendingUp,
    label: 'Top Gainer',
    value: topGainer?.brand_name ?? '—',
    change: topGainer?.change ?? '—',
    direction: topGainer?.direction ?? 'neutral',
    accentColor: '#10b981',
  },
  {
    icon: TrendingDown,
    label: 'Top Loser',
    value: topLoser?.brand_name ?? '—',
    change: topLoser?.change ?? '—',
    direction: topLoser?.direction ?? 'neutral',
    accentColor: '#ef4444',
  },
  {
    icon: Radio,
    label: 'Most Active',
    value: PLATFORM_LABELS[mostActive?.platform] ?? '—',
    change: mostActive ? formatCompact(mostActive.impressions) : '—',
    direction: 'neutral' as const,
    accentColor: PLATFORM_COLORS[mostActive?.platform] ?? '#1a358b',
  },
  {
    icon: Zap,
    label: 'Best ER',
    value: bestEngagement?.brand_name ?? '—',
    change: bestEngagement ? formatCompact(bestEngagement.total_reactions) : '—',
    direction: 'neutral' as const,
    accentColor: '#f59e0b',
  },
];
```

**InsightCard component:**
```tsx
interface InsightCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  change: string;
  direction: 'up' | 'down' | 'neutral';
  accentColor: string;
}

function InsightCard({ icon: Icon, label, value, change, direction, accentColor }: InsightCardProps) {
  const trendColor = direction === 'up' ? 'text-green-500' : direction === 'down' ? 'text-red-500' : 'text-muted-foreground';
  const trendIcon = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '—';

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${accentColor}20` }}>
          <Icon className="w-4 h-4" style={{ color: accentColor }} />
        </div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
      </div>
      <p className="text-sm font-semibold text-foreground truncate mb-1">{value}</p>
      <div className="flex items-center gap-2">
        {direction !== 'neutral' && (
          <span className={`text-xs font-medium ${trendColor}`}>{trendIcon} {change}</span>
        )}
        {direction === 'neutral' && (
          <span className="text-xs text-muted-foreground">{change}</span>
        )}
      </div>
    </div>
  );
}
```

---

### 2.5 Week-over-Week Line Chart (NEW)

**What it shows:** 4-week trend: 3 lines — primary brand impressions, competitor average, market total.

**Recharts component:** `LineChart` with `type="monotone"`

**API extension required:** Add `trends` field to overview API response:
```ts
trends: {
  weeks: string[];         // ["W51", "W52", "W1", "W2"]
  week_starts: string[];   // ISO dates for 4 weeks
  primary: number[];        // primary brand impressions
  competitor_avg: number[]; // avg competitor impressions
  total: number[];          // market total impressions
}
```

**SQL query to add in `route.ts` (after main queries, before return):**
```sql
-- ─── Trends: 4-week data for WoW line chart ──────────────────────────
-- Last 4 weeks: primary brand impressions, competitor avg, market total
-- Returns oldest → newest for correct chart ordering
WITH ranked_weeks AS (
  SELECT DISTINCT week_start, week_number, year
  FROM weekly_stats
  WHERE group_id = $1
  ORDER BY week_start DESC
  LIMIT 4
),
primary_brand AS (
  SELECT id FROM brand WHERE group_id = $1 AND is_primary = true LIMIT 1
),
weekly_totals AS (
  SELECT
    rw.week_start,
    rw.week_number,
    rw.year,
    COALESCE(SUM(ws.total_impressions), 0)::bigint AS total_impressions,
    COALESCE(
      SUM(CASE WHEN ws.brand_id = (SELECT id FROM primary_brand) THEN ws.total_impressions ELSE 0 END), 0
    )::bigint AS primary_impressions
  FROM ranked_weeks rw
  LEFT JOIN weekly_stats ws ON ws.group_id = $1 AND ws.week_start = rw.week_start
  GROUP BY rw.week_start, rw.week_number, rw.year
),
competitor_avg AS (
  SELECT
    rw.week_start,
    COALESCE(AVG(ws.total_impressions), 0)::numeric AS avg_impressions
  FROM ranked_weeks rw
  LEFT JOIN weekly_stats ws ON ws.group_id = $1
    AND ws.week_start = rw.week_start
    AND ws.brand_id != (SELECT id FROM primary_brand)
  GROUP BY rw.week_start
)
SELECT
  wt.week_start::text AS week_start,
  wt.week_number,
  wt.year,
  wt.total_impressions,
  wt.primary_impressions,
  ca.avg_impressions
FROM ranked_weeks rw
JOIN weekly_totals wt ON wt.week_start = rw.week_start
JOIN competitor_avg ca ON ca.week_start = rw.week_start
ORDER BY rw.week_start ASC;
```

**Data transformation in route:**
```ts
// Reverse to oldest→newest for the chart
const rows = trendsRows.rows.reverse();
return {
  trends: {
    weeks: rows.map((r) => `W${r.week_number}`),
    week_starts: rows.map((r) => r.week_start),
    primary: rows.map((r) => Number(r.primary_impressions)),
    competitor_avg: rows.map((r) => Math.round(Number(r.avg_impressions))),
    total: rows.map((r) => Number(r.total_impressions)),
  }
};
```

**TypeScript type (add to `app/dashboard/overview/page.tsx`):**
```ts
interface TrendsData {
  weeks: string[];
  week_starts: string[];
  primary: number[];
  competitor_avg: number[];
  total: number[];
}
```

**Visual specs:**
- Height: `h-[300px]`
- X-axis: week labels (`W51`, `W52`, `W1`, `W2`), font-size `12px`
- Y-axis: compact format, font-size `11px`, width `50`
- 3 lines:
  - **Primary brand:** solid, strokeWidth `2`, color `PRIMARY_COLOR`
  - **Competitor avg:** dashed (`strokeDasharray="5 5"`), strokeWidth `2`, color `#10b981`
  - **Market total:** solid, strokeWidth `1.5`, opacity `0.7`, color `#94a3b8`
- Dots: radius `4` on all lines
- Legend: horizontal, top-right

**Implementation:**
```tsx
function WeekTrendChart({ data }: { data: TrendsData }) {
  const chartData = data.weeks.map((week, i) => ({
    week,
    primary: data.primary[i],
    competitor_avg: data.competitor_avg[i],
    total: data.total[i],
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        4-Week Trend — Impressions
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 4, right: 20, bottom: 4, left: 20 }}>
          <XAxis dataKey="week" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => formatCompact(v)}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
                  <p className="font-semibold mb-1">{label}</p>
                  {(payload as {name: string; value: number}[]).map((entry) => (
                    <p key={entry.name} className="text-muted-foreground">
                      {entry.name}: <span className="font-medium">{formatVietnamNumber(entry.value)}</span>
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Legend iconType="line" wrapperStyle={{ fontSize: 12, top: 0, right: 0 }} />
          <Line type="monotone" dataKey="primary" name="Primary Brand"
            stroke={PRIMARY_COLOR} strokeWidth={2}
            dot={{ r: 4, fill: PRIMARY_COLOR }} activeDot={{ r: 6 }} />
          <Line type="monotone" dataKey="competitor_avg" name="Competitor Avg"
            stroke="#10b981" strokeWidth={2} strokeDasharray="5 5"
            dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
          <Line type="monotone" dataKey="total" name="Market Total"
            stroke="#94a3b8" strokeWidth={1.5}
            dot={{ r: 3, fill: '#94a3b8' }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Conditional render:** Only show if `data.trends !== null` and `data.trends.weeks.length >= 2`.

---

### 2.6 Brand Performance Table (NEW)

**What it shows:** Top 5 brands ranked by impressions: Rank, Brand Name, Impressions, SOV%, Reactions, WoW Trend.

**Data source:** `data.sov` (top 5 entries, already sorted by impressions desc).

**WoW Trend computation:**
```ts
// Compute from data.trends (if available)
// Compare first week vs last week impressions for each brand
// Simple version: use gap_pct sign/direction from insights
const trendRows = data.trends
  ? data.sov.slice(0, 5).map((brand) => {
      const trendIdx = data.trends!.weeks.length - 1;
      const current = brand.impressions; // This week's
      const previous = Math.max(brand.impressions - (brand.impressions * (brand.sov_pct / 100)), 0);
      const pct = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      return { ...brand, trend_pct: Math.round(pct * 10) / 10 };
    })
  : data.sov.slice(0, 5).map((brand) => ({ ...brand, trend_pct: 0 }));
```

**Visual specs:**
- Container: `bg-card border border-border rounded-xl overflow-hidden`
- Header: `px-5 py-4 border-b border-border`
- Table header row: `text-xs uppercase tracking-wider text-muted-foreground font-medium bg-secondary`
- Table rows: `border-b border-border last:border-0 hover:bg-secondary/30 transition-colors`
- Rank: centered, `font-bold`, muted color
- Brand: with colored dot (primary=navy, competitor=gray) + optional "PRIMARY" badge
- Impressions: right-aligned, `tabular-nums`, `formatCompact`
- SOV%: right-aligned, with mini progress bar (`w-16 h-1.5`)
- Reactions: right-aligned, `formatCompact`
- Trend: centered, `▲`/`▼`/`—` with green/red/gray + percentage

**Implementation:**
```tsx
function BrandTable({ brands }: { brands: BrandTableRow[] }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Brand Performance — This Week
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary">
              <th className="text-left py-3 px-5 text-xs uppercase tracking-wider text-muted-foreground font-medium">#</th>
              <th className="text-left py-3 px-5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Brand</th>
              <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Impressions</th>
              <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-muted-foreground font-medium">SOV%</th>
              <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Reactions</th>
              <th className="text-center py-3 px-5 text-xs uppercase tracking-wider text-muted-foreground font-medium">WoW Trend</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((brand, idx) => {
              const trendColor = brand.trend_direction === 'up' ? 'text-green-500' : brand.trend_direction === 'down' ? 'text-red-500' : 'text-muted-foreground';
              const trendIcon = brand.trend_direction === 'up' ? '▲' : brand.trend_direction === 'down' ? '▼' : '—';
              return (
                <tr
                  key={brand.brand_id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors"
                >
                  <td className="py-3 px-5 text-center text-muted-foreground font-medium">{brand.rank}</td>
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: brand.is_primary ? PRIMARY_COLOR : '#94a3b8' }}
                      />
                      <span className="font-medium text-foreground">{brand.brand_name}</span>
                      {brand.is_primary && (
                        <span className="ml-1.5 text-[10px] bg-[#1a358b]/10 text-[#1a358b] px-1.5 py-0.5 rounded font-medium">
                          PRIMARY
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-5 text-right tabular-nums font-semibold text-foreground">
                    {formatCompact(brand.impressions)}
                  </td>
                  <td className="py-3 px-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(brand.sov_pct, 100)}%`,
                            backgroundColor: brand.is_primary ? PRIMARY_COLOR : '#10b981',
                          }}
                        />
                      </div>
                      <span className="text-sm tabular-nums w-12 text-right">{brand.sov_pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-5 text-right tabular-nums text-muted-foreground">
                    {formatCompact(brand.total_reactions)}
                  </td>
                  <td className="py-3 px-5 text-center">
                    <span className={`font-medium ${trendColor}`}>
                      {trendIcon} {Math.abs(brand.trend_pct).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**TypeScript interface:**
```ts
interface BrandTableRow {
  rank: number;
  brand_id: string;
  brand_name: string;
  is_primary: boolean;
  impressions: number;
  sov_pct: number;
  total_reactions: number;
  trend_direction: 'up' | 'down' | 'neutral';
  trend_pct: number;  // WoW % change (can be negative)
}
```

---

## 3. API Extension — Overview Route

### 3.1 Extended `sov[]` entry shape

The existing `sov` array in the API response must add these fields (same query, just aggregate from `post` table grouped by brand AND platform):

```ts
// Each sov[] entry (add to existing fields):
{
  brand_id: string;
  brand_name: string;
  is_primary: boolean;
  impressions: number;        // total (keep existing)
  sov_pct: number;           // keep existing
  youtube_impressions: number; // NEW
  facebook_impressions: number; // NEW
  tiktok_impressions: number;  // NEW
  total_reactions: number;      // NEW
}
```

**SQL for extended SOV query (replace lines 140–153 in route.ts):**
```sql
-- Extended SOV: impressions + reactions, segmented by platform
SELECT
  b.id AS brand_id,
  cb.name AS brand_name,
  b.is_primary,
  COALESCE(SUM(p.impressions), 0)::bigint AS total_impressions,
  COALESCE(SUM(p.reactions), 0)::bigint AS total_reactions,
  COALESCE(SUM(CASE WHEN p.platform = 'youtube' THEN p.impressions ELSE 0 END), 0)::bigint AS youtube_impressions,
  COALESCE(SUM(CASE WHEN p.platform = 'facebook' THEN p.impressions ELSE 0 END), 0)::bigint AS facebook_impressions,
  COALESCE(SUM(CASE WHEN p.platform = 'tiktok' THEN p.impressions ELSE 0 END), 0)::bigint AS tiktok_impressions
FROM brand b
JOIN curated_brand cb ON cb.id = b.curated_brand_id
LEFT JOIN post p ON p.curated_brand_id = b.curated_brand_id AND p.week_start = $2::date
WHERE b.group_id = $1
GROUP BY b.id, cb.name, b.is_primary
ORDER BY total_impressions DESC NULLS LAST;
```

### 3.2 Trends SQL query

Add after the main queries in `route.ts` (before the `return NextResponse.json(...)`):

```sql
-- Trends: 4-week data for WoW line chart
-- Returns oldest → newest for correct chart ordering
WITH ranked_weeks AS (
  SELECT DISTINCT week_start, week_number, year
  FROM weekly_stats
  WHERE group_id = $1
  ORDER BY week_start DESC
  LIMIT 4
),
primary_brand AS (
  SELECT id FROM brand WHERE group_id = $1 AND is_primary = true LIMIT 1
),
weekly_totals AS (
  SELECT
    rw.week_start,
    COALESCE(SUM(ws.total_impressions), 0)::bigint AS total_impressions,
    COALESCE(
      SUM(CASE WHEN ws.brand_id = (SELECT id FROM primary_brand) THEN ws.total_impressions ELSE 0 END), 0
    )::bigint AS primary_impressions
  FROM ranked_weeks rw
  LEFT JOIN weekly_stats ws ON ws.group_id = $1 AND ws.week_start = rw.week_start
  GROUP BY rw.week_start
),
competitor_avg AS (
  SELECT
    rw.week_start,
    COALESCE(AVG(ws.total_impressions), 0)::numeric AS avg_impressions
  FROM ranked_weeks rw
  LEFT JOIN weekly_stats ws ON ws.group_id = $1
    AND ws.week_start = rw.week_start
    AND ws.brand_id != (SELECT id FROM primary_brand)
  GROUP BY rw.week_start
)
SELECT
  wt.week_start::text AS week_start,
  rw.week_number,
  wt.total_impressions,
  wt.primary_impressions,
  ca.avg_impressions
FROM ranked_weeks rw
JOIN weekly_totals wt ON wt.week_start = rw.week_start
JOIN competitor_avg ca ON ca.week_start = rw.week_start
ORDER BY rw.week_start ASC;
```

**Build and return the trends object:**
```ts
const trendsRows = await query<trendsRow>(trendsSQL, [groupId]);
if (trendsRows.rows.length >= 2) {
  const rows = trendsRows.rows.reverse(); // oldest → newest
  trends = {
    weeks: rows.map((r) => `W${r.week_number}`),
    week_starts: rows.map((r) => r.week_start),
    primary: rows.map((r) => Number(r.primary_impressions)),
    competitor_avg: rows.map((r) => Math.round(Number(r.avg_impressions))),
    total: rows.map((r) => Number(r.total_impressions)),
  };
}
// Return trends: trends ?? null (null if insufficient data)
```

### 3.3 Error handling
- If trends query returns fewer than 2 rows: return `trends: null` (not an empty array)
- If platform breakdown query returns 0 rows: return `0` for each platform (already handled by `COALESCE`)

---

## 4. Color System

### 4.1 Platform Colors (fixed)
```ts
const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',   // YouTube red
  facebook: '#1877F2',  // Facebook blue
  tiktok: '#000000',    // TikTok black
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};
```

### 4.2 Brand Colors
```ts
const PRIMARY_COLOR = '#1a358b';  // Navy blue

const COMPETITOR_COLORS = [
  '#10b981',  // Emerald
  '#f59e0b',  // Amber
  '#ef4444',  // Red
  '#8b5cf6',  // Violet
  '#06b6d4',  // Cyan
  '#f97316',  // Orange
  '#ec4899',  // Pink
  '#84cc16',  // Lime
];

// Use: PRIMARY_COLOR for primary brand, COMPETITOR_COLORS[i % 8] for competitors
```

### 4.3 Trend Line Colors
```ts
const TREND_LINE_COLORS = {
  primary: PRIMARY_COLOR,       // Navy (#1a358b)
  competitorAvg: '#10b981',     // Emerald, dashed
  total: '#94a3b8',             // Slate, solid
};
```

### 4.4 `lib/brand-colors.ts` (create this file if it doesn't exist or needs updating)
```ts
// lib/brand-colors.ts

export const PRIMARY_COLOR = '#1a358b';

export const COMPETITOR_COLORS = [
  '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16',
];

export const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  facebook: '#1877F2',
  tiktok: '#000000',
};

export const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

export const TREND_LINE_COLORS = {
  primary: PRIMARY_COLOR,
  competitorAvg: '#10b981',
  total: '#94a3b8',
};

/**
 * Deterministic brand color: primary always gets PRIMARY_COLOR,
 * competitors cycle through COMPETITOR_COLORS by index.
 */
export function getBrandColor(isPrimary: boolean, index: number): string {
  return isPrimary ? PRIMARY_COLOR : COMPETITOR_COLORS[index % COMPETITOR_COLORS.length];
}
```

---

## 5. Typography & Spacing Scale

### 5.1 Card / Section Spacing
| Element | Class | Value |
|---------|-------|-------|
| Page padding | `p-6` | 24px |
| Section gap (between rows) | `space-y-5` | 20px |
| Card internal padding | `p-5` | 20px |
| KPI card padding | `p-5` | 20px |
| Insight mini-card padding | `p-4` | 16px |
| Table cell padding | `py-3 px-5` | 12px 20px |

### 5.2 Grid Layout
| Grid | Classes | Description |
|------|---------|-------------|
| KPI row | `grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4` | 2→3→6 cols |
| SOV + Network | `grid-cols-1 lg:grid-cols-3 gap-5` | 2/3 + 1/3 |
| Insights row | `grid-cols-2 lg:grid-cols-4 gap-4` | 2→4 cols |

### 5.3 Typography
| Element | Class | Style |
|---------|-------|-------|
| Section headers | `text-sm font-semibold uppercase tracking-wider text-muted-foreground` | 14px, wide tracking, muted |
| KPI label | `text-xs text-muted-foreground uppercase tracking-wider font-medium` | 12px, wide tracking |
| KPI value | `text-2xl font-bold text-foreground tabular-nums tracking-tight` | 24px, bold |
| Chart axis labels | `text-11` (11px) | smallest |
| Table header | `text-xs uppercase tracking-wider text-muted-foreground font-medium` | 12px, wide |
| Table body | `text-sm` | 14px |

---

## 6. TypeScript Types (Complete)

Add to `app/dashboard/overview/page.tsx`:

```ts
// ─── Existing types (lines 29–62) — keep as-is ──────────────────────────────

// ─── Extended SovEntry ──────────────────────────────────────────────────────
interface SovEntry {
  brand_id: string;
  brand_name: string;
  is_primary: boolean;
  impressions: number;           // total impressions
  sov_pct: number;
  youtube_impressions: number;   // NEW
  facebook_impressions: number;  // NEW
  tiktok_impressions: number;     // NEW
  total_reactions: number;         // NEW
}

// ─── Trends (4-week WoW) ────────────────────────────────────────────────────
interface TrendsData {
  weeks: string[];         // e.g. ["W51", "W52", "W1", "W2"]
  week_starts: string[];   // ISO dates
  primary: number[];        // primary brand impressions per week
  competitor_avg: number[];  // avg competitor impressions per week
  total: number[];          // market total impressions per week
}

// ─── Brand Table ─────────────────────────────────────────────────────────────
interface BrandTableRow {
  rank: number;
  brand_id: string;
  brand_name: string;
  is_primary: boolean;
  impressions: number;
  sov_pct: number;
  total_reactions: number;
  trend_direction: 'up' | 'down' | 'neutral';
  trend_pct: number;
}

// ─── Updated OverviewData ─────────────────────────────────────────────────────
interface OverviewData {
  week: { label: string; start: string; number: number; year: number };
  kpis: {
    total_impressions: number; total_views: number; total_reactions: number;
    total_posts: number; avg_engagement_rate: number; sov_primary: number | null;
  };
  sov: SovEntry[];
  network_breakdown: Array<{ platform: string; impressions: number; pct: number }>;
  insights: Array<{ brand_name: string; metric: string; change: string; direction: 'up' | 'down' | 'neutral' }>;
  trends: TrendsData | null;  // null if < 2 weeks of data
}
```

---

## 7. Loading Skeleton & Empty States

### Loading Skeleton
Extend the existing `LoadingSkeleton` (lines 83–112) to include all new sections:

```tsx
function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-5">
      {/* KPI row — already exists */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* SOV + Network — already exists (lines 95–108) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <Skeleton className="h-4 w-36 mb-4" />
          <Skeleton className="h-[280px] w-full rounded-lg mb-4" />
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
          </div>
        </div>
      </div>

      {/* Insights row — NEW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <Skeleton className="h-4 w-28 mb-2" />
            <Skeleton className="h-5 w-20 mb-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>

      {/* WoW trend — NEW */}
      <div className="bg-card border border-border rounded-xl p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </div>

      {/* Brand table — NEW */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="px-5 py-3 space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
        </div>
      </div>
    </div>
  );
}
```

### Empty States
- **SOV chart:** If `data.sov` is empty: render `<div className="text-sm text-muted-foreground">No brand data for this week.</div>` inside the chart container
- **WoW trend:** If `data.trends === null`: render `<div className="text-sm text-muted-foreground text-center py-8">Need at least 2 weeks of data for trends.</div>` inside the trend section
- **Brand table:** If `data.sov` is empty: hide the table section entirely

---

## 8. Implementation Order

### Phase 1: Backend API (backend-agent)
1. **Extend the SOV query** — add `youtube_impressions`, `facebook_impressions`, `tiktok_impressions`, `total_reactions` to the existing SOV query in `route.ts`
2. **Add the trends SQL query** — implement the 4-week trends CTE, append results to API response
3. **Update the API response** — ensure all new fields with correct types are in the returned `data` object
4. **Verify with direct SQL** — run the queries in `psql` first before trusting the route

### Phase 2: Stacked SOV Chart (frontend-agent)
1. **Replace `SovChart`** — use `BarChart` with `stackId="a"`, 3 `<Bar>` segments per platform
2. **Update props** — pass extended `sov` entries with platform breakdown
3. **Verify** — chart shows all brands with 3 colored segments, sorted by total

### Phase 3: Network Donut Polish (frontend-agent)
1. **Height to `300px`** — update from current `180px`
2. **Add center label** — total impressions + "Total" subtitle
3. **Verify** — donut renders correctly at new height

### Phase 4: Insights Row (frontend-agent)
1. **Add `InsightCard` component** with `accentColor` prop for tinted icon backgrounds
2. **Add derivation logic** — compute topGainer, topLoser, mostActive, bestEngagement from existing data
3. **Handle fallback** — if `total_reactions` unavailable, replace 4th card with "Most Posts"
4. **Verify** — all 4 cards render with correct icons, values, and trend badges

### Phase 5: WoW Line Chart (frontend-agent)
1. **Add `TrendsData` type** to `OverviewData` interface
2. **Add `WeekTrendChart` component** using `LineChart`
3. **Conditional render** — `data.trends !== null` check
4. **Verify** — 3 lines (solid/dashed/solid) across 4 weeks

### Phase 6: Brand Performance Table (frontend-agent)
1. **Add `BrandTableRow` type**
2. **Add `BrandTable` component** using native `<table>`
3. **Compute WoW trend** — from `data.trends` (if available) or fall back to zero/neutral
4. **Verify** — 5 rows, SOV mini progress bars, trend badges

### Phase 7: Polish & Verification
1. Update `LoadingSkeleton` with all new placeholder sections
2. Add empty-state messages for each new section
3. Run `pnpm build` — verify no TypeScript errors
4. Take full-page screenshot — verify all 5 sections render correctly
5. Commit: `feat(overview): add stacked SOV, insights row, WoW trend, brand table`

---

## 9. Files to Modify

| File | Change | Agent |
|------|--------|-------|
| `app/api/dashboard/[groupId]/overview/route.ts` | (1) Extend SOV query with platform breakdown + reactions (2) Add trends SQL + CTE (3) Append both to response | backend |
| `app/dashboard/overview/page.tsx` | (1) Replace `SovChart` with stacked bar (2) Polish `NetworkDonut` (3) Add `InsightCard`, `WeekTrendChart`, `BrandTable` (4) Update types, skeleton, empty states | frontend |
| `lib/brand-colors.ts` | Update or create with `PLATFORM_COLORS`, `PLATFORM_LABELS`, `TREND_LINE_COLORS`, `getBrandColor` | shared |

---

## 10. Verification Checklist

After implementation, verify every item:

- [ ] 6 KPI cards render with correct icons, labels, values, and number formatting
- [ ] SOV stacked bar chart: all brands, 3 platform segments each, sorted by total impressions descending
- [ ] Network donut: height 300px, center label showing total impressions, YT/FB/TT legend
- [ ] Insights row: 4 cards render with correct icons, brand names, change values, trend colors
- [ ] WoW line chart: 3 lines (primary solid, competitor dashed, market total), 4 weeks, conditional on trends data
- [ ] Brand table: 5 rows with rank, brand dot, impressions, SOV% with progress bar, reactions, WoW trend badge
- [ ] Loading skeleton: all 5 sections have placeholder skeletons
- [ ] Empty states: chart areas show fallback messages when no data
- [ ] No TypeScript errors: `pnpm tsc --noEmit` passes
- [ ] No console errors in browser DevTools
- [ ] Responsive: mobile 2-col KPIs, tablet 3-col KPIs, desktop 6-col KPIs; table scrolls horizontally on mobile

---

## 1. Layout Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│  (Dashboard Header — already exists: Group | Week | Platform)       │
├──────────────────────────────────────────────────────────────────────┤
│  KPI ROW (6 cards, horizontal scroll on mobile):                      │
│  [Impressions] [Views] [Reactions] [Posts] [Avg ER] [Primary SOV]     │
├─────────────────────────────────┬────────────────────────────────────┤
│  SOV STACKED BAR                │  NETWORK DONUT                       │
│  (impressions by brand ×        │  (YT / FB / TT breakdown)            │
│   platform, horizontal bars)    │  Height: 300px                      │
│  Height: 300px                  │                                     │
├─────────────────────────────────┴────────────────────────────────────┤
│  INSIGHTS ROW (4 mini cards):                                        │
│  [Top Gainer] [Top Loser] [Most Active Platform] [Highest Engagement] │
├──────────────────────────────────────────────────────────────────────┤
│  WEEK-OVER-WEEK TREND (4-week line chart):                           │
│  [Primary Brand] [Competitor Avg] [Market Total]                     │
│  Height: 280px                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  BRAND PERFORMANCE TABLE (Top 5 by Impressions):                     │
│  [Rank] [Brand] [Impressions] [SOV %] [Reactions] [Trend (sparkline)]│
└──────────────────────────────────────────────────────────────────────┘
```

**Responsive behavior:**
- Mobile (<768px): single column, KPI cards scroll horizontally
- Tablet (768–1024px): 2-column KPI grid, charts stack
- Desktop (>1024px): 6-column KPI grid, SOV + donut side-by-side

---

## 2. Component Specifications

### 2.1 KPI Cards (6 cards) — ALREADY EXISTS, no changes needed

**Current implementation:** `OverviewPage` → `KpiCard` component (lines 116–142)

| Metric | Icon | Format | Note |
|--------|------|--------|------|
| Impressions | `Eye` | compact (1.2M) | from `kpis.total_impressions` |
| Views | `TrendingUp` | compact | from `kpis.total_views` |
| Reactions | `ThumbsUp` | compact | from `kpis.total_reactions` |
| Posts | `FileText` | number | from `kpis.total_posts` |
| Avg ER | `Percent` | percent | from `kpis.avg_engagement_rate` |
| Primary SOV | `TrendingUp` | percent | from `kpis.sov_primary` |

**CSS classes (existing, correct):**
```tsx
<div className="bg-card border border-border rounded-xl p-5">
  <div className="flex items-start justify-between mb-3">
    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
    <div className="p-2 bg-secondary rounded-lg flex-shrink-0">
      <Icon className="w-4 h-4 text-muted-foreground" />
    </div>
  </div>
  <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{displayValue}</p>
</div>
```

**Grid:** `grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4`

---

### 2.2 SOV Stacked Bar Chart — REPLACE current horizontal bar chart

**What it shows:** Each brand as one horizontal stacked bar, segmented by platform (YouTube, Facebook, TikTok) showing impression distribution.

**Recharts component:** `<BarChart layout="vertical" stacked={true}>`

**Data transformation (from API):**
```ts
// Input: sov[] (brand-level totals) + network_breakdown (platform totals per brand)
// If network_breakdown doesn't have per-brand breakdown, query separately:
//
// SELECT cb.name, p.platform, SUM(p.impressions)
// FROM post p
// JOIN brand b ON b.curated_brand_id = p.curated_brand_id
// JOIN curated_brand cb ON cb.id = b.curated_brand_id
// WHERE b.group_id = $1 AND p.week_start = $2::date
// GROUP BY cb.name, p.platform
// ORDER BY cb.name, p.platform
//
// Output shape:
interface SovStackData {
  brand_name: string;
  is_primary: boolean;
  youtube: number;
  facebook: number;
  tiktok: number;
  total: number;
  color: string;
}
```

**Visual specs:**
- Height: `h-[300px]`
- Layout: vertical bars (category on Y-axis)
- Stacked: true (one bar per brand, 3 segments per bar)
- Bar height: `barSize={28}` with `radius={[0, 4, 4, 0]}` on each segment
- Sort: descending by total impressions
- X-axis: impressions (compact format), `tickFormatter={(v) => formatCompact(v)}`
- Y-axis: brand names, `width={110}`
- Legend: bottom or right, show YT/FB/TT with platform colors
- Tooltip: shows brand name + per-platform impressions + total

**Color palette (platform segments):**
```ts
const PLATFORM_SEGMENT_COLORS = {
  youtube: '#FF0000',
  facebook: '#1877F2',
  tiktok: '#000000',
};
```

**Alternative (if per-brand platform data is expensive to compute):** Keep the existing horizontal bar chart showing SOV % per brand, but enhance it to be visually richer (add sparkline per brand showing 4-week trend inline). See Section 2.6 for sparkline spec.

---

### 2.3 Network Donut Chart — ALREADY EXISTS, minor polish

**Current implementation:** `NetworkDonut` component (lines 218–287) — works correctly.

**Polish changes:**
- Height: change to `h-[300px]` (currently 180px)
- Move legend below chart instead of inline with items
- Add center label showing total impressions

**Center label implementation:**
```tsx
<PieChart>
  <Pie>
    {/* ...cells... */}
  </Pie>
  {/* Center label */}
  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
    <tspan x="50%" dy="-0.5em" className="text-lg font-bold fill-foreground">
      {formatCompact(totalImpressions)}
    </tspan>
    <tspan x="50%" dy="1.5em" className="text-xs fill-muted-foreground">
      Total
    </tspan>
  </text>
</PieChart>
```

---

### 2.4 Insights Row (4 Mini Cards) — NEW

**What it shows:** One-line summary cards derived from the API data.

**Data derivation:**
1. **Top Gainer:** Brand with highest positive `gap_pct` in weekly_stats
2. **Top Loser:** Brand with lowest (most negative) `gap_pct` in weekly_stats
3. **Most Active Platform:** Platform with highest impressions from `network_breakdown`
4. **Highest Engagement:** Brand with highest `total_reactions / total_impressions` ratio from `sov` data (needs reactions per brand — may need API extension)

**Implementation option A (use existing data):**
- Top Gainer/Loser: from `insights` array (gap_pct)
- Most Active Platform: from `network_breakdown`
- Highest Engagement: compute from `sov` if `sov` includes reactions

**Implementation option B (API extension):**
```ts
// Extend API response:
insights_summary: {
  top_gainer: { brand_name: string; gap_pct: number } | null;
  top_loser: { brand_name: string; gap_pct: number } | null;
  most_active_platform: { platform: string; impressions: number } | null;
  highest_engagement: { brand_name: string; engagement_rate: number } | null;
}
```

**Visual specs:**
```tsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  {[
    { icon: TrendingUp, label: 'Top Gainer', value: topGainer.brand_name, change: `+${topGainer.gap_pct}%`, color: 'text-green-500' },
    { icon: TrendingDown, label: 'Top Loser', value: topLoser.brand_name, change: `${topLoser.gap_pct}%`, color: 'text-red-500' },
    { icon: Radio, label: 'Most Active', value: mostActive.platform, change: formatCompact(mostActive.impressions), color: 'text-[#1a358b]' },
    { icon: Zap, label: 'Best ER', value: bestEng.brand_name, change: `${bestEng.engRate.toFixed(1)}%`, color: 'text-amber-500' },
  ].map((card) => (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <card.icon className="w-4 h-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{card.label}</p>
      </div>
      <p className="text-sm font-semibold text-foreground truncate">{card.value}</p>
      <p className={`text-sm font-medium ${card.color}`}>{card.change}</p>
    </div>
  ))}
</div>
```

**Icons needed:** `TrendingDown` (from lucide-react), `Radio` (or `Globe`), `Zap` (or `Star`)

---

### 2.5 Week-over-Week Trend Line Chart — NEW

**What it shows:** 4-week impression trend lines: primary brand, competitor average, market total.

**Recharts component:** `<LineChart>`

**API extension needed:**
```ts
// Extend GET /api/dashboard/[groupId]/overview response with:
trends: {
  weeks: string[];          // ["W50", "W51", "W52", "W01"]
  week_starts: string[];   // ["2024-12-09", "2024-12-16", ...]
  primary: number[];        // primary brand impressions per week
  primary_label: string;    // "Vinamilk"
  competitor_avg: number[]; // avg of all competitor brands per week
  total: number[];          // market total per week
}
```

**SQL query to add in the API route:**
```sql
-- 4-week trend data for overview line chart
-- Query: get last 4 weeks of weekly_stats for this group
-- Calculate: primary brand impressions, competitor avg, market total

WITH weeks AS (
  SELECT DISTINCT week_start, week_number, year
  FROM weekly_stats
  WHERE group_id = $1
  ORDER BY week_start DESC
  LIMIT 4
), primary_brand AS (
  SELECT b.id FROM brand b WHERE b.group_id = $1 AND b.is_primary = 't' LIMIT 1
), brand_stats AS (
  SELECT
    w.week_start,
    SUM(CASE WHEN b.id = (SELECT id FROM primary_brand) THEN ws.total_impressions ELSE 0 END) AS primary_impressions,
    SUM(ws.total_impressions) AS total_impressions,
    COUNT(DISTINCT CASE WHEN b.id != (SELECT id FROM primary_brand) THEN b.id END) AS competitor_count
  FROM weeks w
  LEFT JOIN weekly_stats ws ON ws.group_id = $1 AND ws.week_start = w.week_start
  LEFT JOIN brand b ON b.id = ws.brand_id
  GROUP BY w.week_start, w.week_number, w.year
  ORDER BY w.week_start ASC
)
SELECT
  week_start::text AS week_start,
  week_number,
  year,
  primary_impressions,
  total_impressions,
  CASE WHEN competitor_count > 0
    THEN (total_impressions - primary_impressions) / NULLIF(competitor_count, 0)
    ELSE 0
  END AS competitor_avg
FROM brand_stats
ORDER BY week_start ASC;
```

**Fallback if the WITH query is complex:** Simple version:
```sql
SELECT
  ws.week_start::text AS week_start,
  ws.week_number,
  ws.year,
  SUM(CASE WHEN b.is_primary = 't' THEN ws.total_impressions ELSE 0 END) AS primary_impressions,
  SUM(ws.total_impressions) AS total_impressions
FROM weekly_stats ws
JOIN brand b ON b.id = ws.brand_id
WHERE ws.group_id = $1
  AND ws.week_start >= (SELECT MAX(week_start) - INTERVAL '21 days' FROM weekly_stats WHERE group_id = $1)
GROUP BY ws.week_start, ws.week_number, ws.year
ORDER BY ws.week_start ASC
LIMIT 4;
```

**Visual specs:**
```tsx
<ResponsiveContainer width="100%" height={280}>
  <LineChart data={trends} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
    <XAxis
      dataKey="label"
      tick={{ fontSize: 11 }}
      axisLine={false}
      tickLine={false}
    />
    <YAxis
      tickFormatter={(v) => formatCompact(v)}
      tick={{ fontSize: 11 }}
      axisLine={false}
      tickLine={false}
      width={50}
    />
    <Tooltip
      content={({ active, payload }) => {
        if (!active || !payload?.length) return null;
        return (
          <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
            <p className="font-semibold mb-2">{payload[0]?.payload.week_start}</p>
            {payload.map((entry) => (
              <p key={entry.dataKey} className="text-muted-foreground">
                {entry.name}: <span className="font-medium">{formatVietnamNumber(entry.value)}</span>
              </p>
            ))}
          </div>
        );
      }}
    />
    <Legend />
    <Line
      type="monotone"
      dataKey="primary"
      name={trends.primary_label}
      stroke={PRIMARY_COLOR}
      strokeWidth={2}
      dot={{ r: 4 }}
      activeDot={{ r: 6 }}
    />
    <Line
      type="monotone"
      dataKey="competitor_avg"
      name="Competitor Avg"
      stroke="#10b981"
      strokeWidth={2}
      strokeDasharray="5 5"
      dot={{ r: 4 }}
    />
    <Line
      type="monotone"
      dataKey="total"
      name="Market Total"
      stroke="#f59e0b"
      strokeWidth={2}
      dot={{ r: 4 }}
    />
  </LineChart>
</ResponsiveContainer>
```

**Wrapper card:**
```tsx
<div className="bg-card border border-border rounded-xl p-5">
  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
    4-Week Trend
  </h3>
  {/* LineChart */}
</div>
```

---

### 2.6 Brand Performance Table — NEW

**What it shows:** Top 5 brands ranked by impressions with SOV%, reactions, and trend sparkline.

**Data source:** `sov` array (already available in API, sorted by impressions desc, take top 5).

**If sparklines needed:** Each brand needs an array of 4 weekly impression values. Requires API extension:

```ts
// Extend sov array items:
{
  brand_id: string;
  brand_name: string;
  is_primary: boolean;
  impressions: number;
  sov_pct: number;
  sparkline: number[]; // [w1, w2, w3, w4] impressions for last 4 weeks
}
```

**SQL for sparkline (if added to API):**
```sql
-- Per-brand 4-week sparkline data
SELECT
  cb.name,
  ARRAY_AGG(
    COALESCE(ws.total_impressions, 0) ORDER BY ws.week_start
  ) AS sparkline
FROM brand b
JOIN curated_brand cb ON cb.id = b.curated_brand_id
JOIN (
  SELECT DISTINCT week_start
  FROM weekly_stats
  WHERE group_id = $1
  ORDER BY week_start DESC
  LIMIT 4
) weeks ON true
LEFT JOIN weekly_stats ws ON ws.brand_id = b.id AND ws.week_start = weeks.week_start
WHERE b.group_id = $1
GROUP BY cb.name
ORDER BY SUM(ws.total_impressions) DESC NULLS LAST;
```

**Visual specs:**
```tsx
<div className="bg-card border border-border rounded-xl overflow-hidden">
  <div className="px-5 py-4 border-b border-border">
    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
      Brand Performance — Top 5
    </h3>
  </div>
  <table className="w-full">
    <thead>
      <tr className="border-b border-border">
        <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium uppercase tracking-wider">#</th>
        <th className="px-5 py-3 text-left text-xs text-muted-foreground font-medium uppercase tracking-wider">Brand</th>
        <th className="px-5 py-3 text-right text-xs text-muted-foreground font-medium uppercase tracking-wider">Impressions</th>
        <th className="px-5 py-3 text-right text-xs text-muted-foreground font-medium uppercase tracking-wider">SOV</th>
        <th className="px-5 py-3 text-right text-xs text-muted-foreground font-medium uppercase tracking-wider">Reactions</th>
        <th className="px-5 py-3 text-center text-xs text-muted-foreground font-medium uppercase tracking-wider">Trend</th>
      </tr>
    </thead>
    <tbody>
      {top5.map((brand, i) => (
        <tr
          key={brand.brand_id}
          className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors"
        >
          <td className="px-5 py-3 text-sm text-muted-foreground">{i + 1}</td>
          <td className="px-5 py-3">
            <span className={`text-sm font-medium ${brand.is_primary ? 'text-[#1a358b]' : 'text-foreground'}`}>
              {brand.brand_name}
            </span>
            {brand.is_primary && (
              <span className="ml-2 text-[10px] bg-[#1a358b]/10 text-[#1a358b] px-1.5 py-0.5 rounded font-medium">
                PRIMARY
              </span>
            )}
          </td>
          <td className="px-5 py-3 text-right text-sm font-semibold tabular-nums">
            {formatCompact(brand.impressions)}
          </td>
          <td className="px-5 py-3 text-right text-sm tabular-nums">
            <div className="flex items-center justify-end gap-2">
              <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${brand.sov_pct}%`, backgroundColor: brand.is_primary ? PRIMARY_COLOR : COMPETITOR_COLORS[0] }}
                />
              </div>
              <span className="text-sm tabular-nums w-12 text-right">{brand.sov_pct.toFixed(1)}%</span>
            </div>
          </td>
          <td className="px-5 py-3 text-right text-sm text-muted-foreground tabular-nums">
            {formatCompact(brand.reactions ?? 0)}
          </td>
          <td className="px-5 py-3">
            {/* Inline sparkline or trend arrow */}
            {brand.trend === 'up' && <span className="text-green-500 text-sm">▲</span>}
            {brand.trend === 'down' && <span className="text-red-500 text-sm">▼</span>}
            {brand.trend === 'neutral' && <span className="text-muted-foreground text-sm">—</span>}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

**Reactions per brand:** Current API doesn't return reactions per brand. Options:
1. Extend SOV query to include reactions
2. Use a simple trend arrow (compare current week impressions vs previous week from `gap_pct`)

---

## 3. Color System

```ts
// Primary brand (always #1a358b — navy blue)
const PRIMARY_COLOR = '#1a358b';

// Competitor brand palette (cycling, 8 colors)
const COMPETITOR_COLORS = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#84cc16', // lime
];

// Platform segment colors (for stacked bar)
const PLATFORM_SEGMENT_COLORS = {
  youtube: '#FF0000',
  facebook: '#1877F2',
  tiktok: '#000000',
};

// Chart line colors (for trend chart)
const TREND_LINE_COLORS = {
  primary: '#1a358b',       // navy
  competitorAvg: '#10b981', // emerald (dashed)
  total: '#f59e0b',         // amber
};
```

**Implementation:** Create `lib/brand-colors.ts`:
```ts
// lib/brand-colors.ts

export const PRIMARY_COLOR = '#1a358b';

export const COMPETITOR_COLORS = [
  '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16',
];

export const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  facebook: '#1877F2',
  tiktok: '#000000',
};

export const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

export const TREND_LINE_COLORS = {
  primary: PRIMARY_COLOR,
  competitorAvg: '#10b981',
  total: '#f59e0b',
};

/**
 * Get a deterministic color for a brand based on its name.
 * Primary brand always gets PRIMARY_COLOR.
 * Competitors cycle through COMPETITOR_COLORS based on name hash.
 */
export function getBrandColor(brandName: string, isPrimary: boolean): string {
  if (isPrimary) return PRIMARY_COLOR;
  const hash = brandName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COMPETITOR_COLORS[hash % COMPETITOR_COLORS.length];
}
```

---

## 4. Typography & Spacing

| Element | Spec |
|---------|------|
| Card padding | `p-5` (20px) |
| Section gap | `gap-5` (20px) |
| Chart heights | 280–300px |
| KPI grid | `grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4` |
| Section headers | `text-sm font-semibold uppercase tracking-wider text-muted-foreground` |
| KPI label | `text-xs text-muted-foreground uppercase tracking-wider font-medium` |
| KPI value | `text-2xl font-bold text-foreground tabular-nums tracking-tight` |
| Table header | `text-xs text-muted-foreground font-medium uppercase tracking-wider` |
| Table cell | `text-sm` |
| Table row hover | `hover:bg-secondary/30 transition-colors` |

---

## 5. API Extension Summary

### Option A: Minimal (no API changes, use existing data)

| Component | Data Source | Status |
|-----------|-------------|--------|
| KPI Cards | `kpis` object | ✅ Already works |
| SOV Stacked Bar | `sov` + `network_breakdown` | ⚠️ Need per-brand platform breakdown (new query) |
| Network Donut | `network_breakdown` | ✅ Already works (polish only) |
| Insights Row | `insights` + `network_breakdown` | ⚠️ Need reactions per brand for Highest Engagement |
| WoW Trend | — | ❌ Needs API extension |
| Brand Table | `sov` | ⚠️ Need reactions per brand, trend arrow from gap_pct |

### Option B: Full (add `trends` field to overview API)

Add to `GET /api/dashboard/[groupId]/overview` response:

```ts
trends?: {
  weeks: string[];
  week_starts: string[];
  primary: number[];
  primary_label: string;
  competitor_avg: number[];
  total: number[];
};
```

**SQL (see Section 2.5 above)**

---

## 6. Implementation Order

### Phase 1: Visual Enhancements (no API changes)

1. **Polish KPI Cards** — Already working, verify styling
2. **Polish Network Donut** — Height to 300px, add center label, improve legend
3. **Insights Row** — Derive from existing `insights` + `network_breakdown` arrays (no new API)

### Phase 2: New Components (may need API extension)

4. **Week-over-Week Line Chart** — Requires `trends` field in API (backend agent)
5. **Brand Performance Table** — Use existing `sov` data + derive trend from `gap_pct`
6. **SOV Stacked Bar (optional)** — If per-brand platform breakdown is complex, keep existing horizontal bar but add sparklines

### Phase 3: Polish & Integration

7. Add `lib/brand-colors.ts` for consistent color management
8. Wire up all sections with proper loading states and error handling
9. Responsive layout testing

---

## 7. Current File Reference

- **Page:** `/Users/lab/Downloads/b_NOYGPFI192h/app/dashboard/overview/page.tsx`
- **API Route:** `/Users/lab/Downloads/b_NOYGPFI192h/app/api/dashboard/[groupId]/overview/route.ts`
- **Types:** `/Users/lab/Downloads/b_NOYGPFI192h/lib/types.ts`
- **Formatters:** `/Users/lab/Downloads/b_NOYGPFI192h/lib/vietnam-format.ts`

**Current component count:** 4 (LoadingSkeleton, KpiCard, SovChart, NetworkDonut, InsightsPanel)
**Target component count:** 7 (+ TrendLineChart, BrandTable, InsightsRow as 4 mini-cards)
