# COBAN — Claude Opus Session Guide

## Project Overview

**COBAN** là nền tảng Social Media Competitive Intelligence dành cho thị trường Việt Nam. Giúp agency và brand theo dõi, phân tích đối thủ cạnh tranh trên Facebook, YouTube, và TikTok qua hệ thống crawl data tự động hàng tuần, hiển thị trên dashboard analytics chuyên sâu.

- **Framework:** Next.js 15 (App Router) · TypeScript · TailwindCSS
- **UI:** shadcn/ui · Recharts · Lucide React
- **Auth:** Self-contained JWT + bcrypt (`lib/auth.ts`) — no external services
- **DB:** PostgreSQL on Docker (`coban-db` at `127.0.0.1:5433`) — `lib/db.ts` wraps `pg` Pool
- **Package Manager:** pnpm
- **Working Directory:** `/Users/lab/Downloads/b_NOYGPFI192h`

### Real Data Stats (seeded DB)

| Entity | Count |
|--------|-------|
| ACCOUNT | 1 |
| CLIENT | 106 |
| GROUP | 91 |
| BRAND (group-scoped) | 70 |
| CURATED_BRAND | 19 |
| WEEKLY_STATS | 1,107 |
| POST | 10,796 |

**Rich data group:** `da000000-0000-0000-0000-000000000004` — Vietnamese Dairy Competitors (9 brands, 1,107 weekly_stats rows, 10,796 posts, min_week: 2022-01-03, max_week: 2024-12-30)

**Test user:** `demo@dairyinsights.vn` / `DemoPass123!` — full access to Vietnamese Dairy Competitors group via `user_client_role` mapping

---

## Dashboard Tabs & Routes

| Tab | Page | API Endpoint | Response |
|-----|------|-------------|----------|
| **Overview** | `app/dashboard/overview/page.tsx` | `GET /api/dashboard/[groupId]/overview` | `{ success, data: { week, kpis, sov, network_breakdown, insights } }` |
| **Rankings** | `app/dashboard/rankings/page.tsx` | `GET /api/dashboard/[groupId]/rankings` | `{ success, data: { week, brands[] } }` |
| **Channel** | `app/dashboard/channel/page.tsx` | `GET /api/dashboard/[groupId]/channel` | `{ success, data: { week, platforms[], format_mix, cadence } }` |
| **Content** | `app/dashboard/content/page.tsx` | `GET /api/dashboard/[groupId]/content` | `{ success, data: { week, format_performance, top_keywords, top_posts } }` |
| **Benchmark** | `app/dashboard/benchmark/page.tsx` | `GET /api/dashboard/[groupId]/benchmark` | `{ success, data: { week, radar, head_to_head, gap_analysis, primary_brand, competitor_brand } }` |
| **Trends** | `app/dashboard/trends/page.tsx` | `GET /api/dashboard/[groupId]/trends` | `{ success, data: { brands, trend_data, anomalies, average } }` |
| **Weeks** | (bootstrap only) | `GET /api/dashboard/weeks` | `{ success, data: { minWeek, maxWeek } }` |

All dashboard APIs require `Authorization: Bearer <jwt>` header. The group must belong to the authenticated account.

---

## Project Rules

Các rules tự động được load từ `.cursor/rules/`:

- `breakdown.mdc` — Khi cần break down technical design thành task checklist
- `tdd.mdc` — Khi cần generate technical design document
- `implementation.mdc` — **Áp dụng cho mọi task implementation**

<!-- DOC: @.cursor/rules/breakdown.mdc -->
<!-- DOC: @.cursor/rules/tdd.mdc -->
<!-- DOC: @.cursor/rules/implementation.mdc -->

---

## Key Reference Docs

| File | Purpose |
|------|---------|
| `COBAN_PROJECT_SUMMARY.md` | Tổng quan project, user journeys, dashboard metrics spec |
| `TECHNICAL_DESIGN_DOCUMENT.md` | Full TDD — data model, API, UI, logic flow, testing plan |
| `DB_SCHEMA_DESIGN.md` | 14-table PostgreSQL schema — entities, indexes, partitions, query patterns |
| `IMPLEMENTATION_PLAN.md` | 12 ngày / 4 phase — gap analysis + chi tiết từng bước |
| `pagemetric.md` | Dashboard 6 sections: A.Overview → F.Trends chi tiết metrics |
| `user-journey-v3.md` | 12 user journeys J1–J12 mô tả flow người dùng |
| `TASK_BREAKDOWN_CHECKLIST.md` | **Master checklist — 134 tasks, 8 phase, thực hiện theo thứ tự** |

---

## Data Model (Rút gọn)

```
ACCOUNT (agency | direct_client)
├── CLIENT
│   ├── BRAND (client-scoped)
│   │   └── CURATED_BRAND (platform-wide, ~200 brands)
│   └── GROUP
│       ├── BRAND (group-scoped tracking — primary + competitors)
│       │   └── CURATED_BRAND
│       └── CRAWL_JOB (execution history)
├── USER
│   └── USER_CLIENT_ROLE (per-client RBAC: admin | analyst | viewer)
├── POST (raw posts — belongs to curated_brand, partitioned by year)
├── WEEKLY_STATS (pre-aggregated: brand × group × week)
├── WEEKLY_REPORT (group-level rollup)
└── BRAND_ACTIVITY (viral/re-engaged posts)
```

**14 tables + partitions.** Xem `db/01-create-coban-schema.sql` cho chi tiết schema, indexes, partitioning, ERD.

---

## Dashboard Metrics (6 Tabs)

| Tab | Page | Key Metrics |
|-----|------|-------------|
| **A. Overview** | `app/dashboard/overview/page.tsx` | KPI Cards (6) + SOV stacked bar + Network donut + Quick Insights |
| **B. Rankings** | `app/dashboard/rankings/page.tsx` | SOV Matrix + SOS Matrix + Ranking Table (sortable + sparklines) |
| **C. Channel** | `app/dashboard/channel/page.tsx` | YT/FB/TT tabs + per-channel KPIs + Format Mix + Cadence |
| **D. Content** | `app/dashboard/content/page.tsx` | Format bar + Top Keywords + Top 20 Posts |
| **E. Benchmark** | `app/dashboard/benchmark/page.tsx` | Radar + Head-to-head + Gap Analysis |
| **F. Trends** | `app/dashboard/trends/page.tsx` | Line charts + Compare mode + Anomaly Alerts |

---

## Number & Date Formatting

- **Vietnam format:** `Intl.NumberFormat('vi-VN')` → `1.234.567,89` (NFR-008)
- **Large numbers:** `1.2M`, `18K`, `1.5%`
- **Week format:** `W13 (12 Apr – 18 Apr, 2025)` (NFR-006)
- **Trend arrows:** ▲ / ▼ / — (up/down/neutral)

---

## API Response Convention

All dashboard API routes return a consistent envelope:

```ts
// Success
{ success: true, data: { ...payload } }
// Error
{ success: false, error: "Human-readable message" }
```

**Next.js 15 note:** Route `params` are Promises — always `await params` before parsing with Zod.

---

## Implementation Priorities (from IMPLEMENTATION_PLAN.md)

1. `AppContext` — shared state (client, group, week)
2. `Select Client page` (`/select-client`) — J5
3. `Onboarding Wizard` (`/onboarding`) — J3 (3-step)
4. `Dashboard Header` — client/group/week selectors
5. `Dashboard Overview tab` — Section A (KPI cards + SOV + donut + insights)
6. `Dashboard Rankings tab` — Section B
7. `Dashboard remaining tabs` — Channel → Content → Benchmark → Trends
8. `Groups list + Create Group` (`/dashboard/groups`)
9. `Add/Remove Competitor` — J9
10. `Team / Settings` — J4
11. `Auth pages` (`/auth/login`, `/auth/signup`)
12. `Backend integration`

---

## Coding Conventions

- **React:** Functional components + hooks, async/await, TypeScript strict
- **State:** React Context (AppContext) + URL params (nuqs) cho client/group/week
- **Charts:** Recharts, lazy-loaded per tab (dynamic imports)
- **Validation:** Zod schemas trên tất cả API handlers và forms
- **DB:** `lib/db.ts` wraps `pg` Pool; PostgreSQL patterns từ `DB_SCHEMA_DESIGN.md`
- **Crawl:** pg_cron — Sunday 12PM, crawl từ Jan 1 current year → now, deduplicate by post_id
- **Gap calc:** Post-level W vs W-1 merge by post_id
- **Responsive:** Mobile drawer nav, tablet 2-col, desktop full layout

---

## Team Rules

- **backend-agent:** owns all `app/api/dashboard/*` routes — verify `{ success, data }` envelope on all paths, fix response shape mismatches against the consuming page's TypeScript interfaces.
- **frontend-agent:** owns all `app/dashboard/*` pages and `lib/use-dashboard-data.ts` — verify data hooks parse responses correctly, fix empty states and chart rendering.
- **Sync point:** before any commit, check that API response shapes match the TypeScript interfaces on the consuming page.
- **No breaking changes** to API response envelopes without notifying all agents first.
- **Sau khi fix xong:** luôn chạy `git add . && git commit -m "fix: mô tả" && git push origin HEAD` trước khi báo done.

---

## Git Commit Workflow

**Sau khi hoàn thành mỗi task/feature:** luôn commit và push lên GitHub.

```bash
# 1. Kiểm tra thay đổi
git status

# 2. Thêm files đã thay đổi
git add .

# 3. Commit với message rõ ràng
git commit -m "feat|fix|chore: mô tả ngắn gọn"

# 4. Push lên remote
git push origin HEAD
```

**Remote:** `https://github.com/lyanhbao/cobanuinew.git`

---

## Behavioral Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

### 1. Think Before Coding

Before writing any code, read the relevant files thoroughly. Understand the existing patterns, conventions, and architecture. Don't assume — verify. Ask clarifying questions if requirements are ambiguous. Rushed coding creates bugs that take 10× longer to fix than the time "saved" by skipping analysis.

### 2. Simplicity First

Choose the simplest solution that solves the actual problem. Resist the urge to add flexibility, abstraction, or features that aren't explicitly requested. Speculative generality is technical debt. Start simple; refactor when there's real pressure to add complexity. "It might be useful someday" is not a valid reason to add code today.

### 3. Surgical Changes

Make the smallest change that fixes the problem. Avoid broad refactors, style rewrites, or "improvements" beyond what was asked. Each line changed is a line that needs review, testing, and maintenance. The best fix is the one that touches the fewest files while fully solving the issue. Leave the codebase cleaner than you found it, but not at the cost of scope creep.

### 4. Goal-Driven Execution

Every action should serve the user's stated goal. Before making a change, ask: does this move us closer to the objective? Avoid tangential exploration, premature optimization, or addressing hypothetical future needs. Stay on task. If you discover something else that needs fixing, document it and ask the user whether to address it now or later.

### Goal Verification Criteria

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

### Apply to COBAN:
- **Think Before Coding:** Read DB schema (`db/01-create-coban-schema.sql`) before writing any SQL. Verify column names exist. Read existing route/page files before modifying.
- **Simplicity First:** Dashboard feature > keep it focused. If the user says "Overview only", don't add Rankings, Channel, etc.
- **Surgical Changes:** Don't rewrite entire files unless asked. Fix the specific bug.
- **Goal-Driven:** "Fix API error" → verify API returns correct data first. "Build Overview" → verify it renders without errors.

---

## Session Completion Status (April 11–12, 2026)

All tasks completed. E2E test suite: **87/87 passing**.

### Verified Working
- **6 Dashboard tabs** — Overview, Rankings, Channel, Content, Benchmark, Trends — all rendering real PostgreSQL data with charts
- **Management pages** — Groups, Alerts, Team, Settings all load correctly
- **Content page** — format performance chart, top keywords (kun/nuvi/giải/mới), top 20 posts with Vietnamese text
- **Benchmark page** — Nutifood-VN vs IDP-Vietnam-Friesland comparison (same-brand bug fixed: `is_primary` is PostgreSQL `t/f` string, not boolean)
- **Rankings** — 9 brands ranked by SOV with sparklines, gap indicators
- **Trends** — 26-week line chart with 8 brand selectors
- **Overview** — 6 KPI cards + SOV stacked bar + donut chart + quick insights

### Critical Fixes Applied
| File | Bug | Fix |
|------|-----|-----|
| `benchmark/route.ts` | Benchmark compared same brand (Nutifood vs Nutifood) | `is_primary` is `t/f` string, not boolean — fixed type and comparison logic |
| `benchmark/route.ts` | Week `label` was plain string | Changed to `{label, start, number, year}` object |
| `rankings/route.ts` | Week missing `number`/`year` in empty state | Added to `WeekInfo` interface and both return statements |
| `content/route.ts` | `extractKeywords` returned `{word, count}` not `{keyword, count}` | Fixed return type to match `ContentData` interface |
| `context/AppContext.tsx` | `isReady` missing from localStorage fallback state | Spread `defaultState` to ensure `isReady: false` included |
| `lib/types.ts` | `ActivityType` enum missing variants | Added `'viral'`, `'reengaged'`, `'anomaly'` |
| Sidebar | Analytics link to deleted page | Removed from nav |

### Deliverables Created
- `DASHBOARD_ANALYSIS_REPORT.md` — 322-line competitive intelligence report (Vietnamese dairy market, Q4 2024)
- `DB_SEED_DATA_SUMMARY.md` — 266-line seed data documentation with SQL reference queries

### Next.js 15 Gotchas
- Route `params` are Promises — always `await params` before parsing with Zod
- `is_primary` in PostgreSQL is rendered as `t`/`f` strings in the JS result (not boolean `true`/`false`)
- Dashboard layout uses `useDashboardBootstrap()` to sequence: auth → clientId → groups → week range → `setReady(true)` → data hooks fire
- All 6 dashboard pages use `useDashboardData<T>()` which checks `isReady` before fetching
- **Stale localStorage issue:** If dashboard shows blank pages, clear `coban_app_state`, `coban_user`, `coban_token` from localStorage and re-login. The demo account has multiple clients — always select "Vietnamese Dairy Market" on the select-client page.
