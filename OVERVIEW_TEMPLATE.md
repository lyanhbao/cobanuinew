# COBAN Overview Tab — Design Specification

> **Status:** Template for implementation by frontend/backend agents
> **Version:** 1.0
> **Date:** 2026-04-14

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
