# COBAN — Task Breakdown Checklist

> Dựa trên `TECHNICAL_DESIGN_DOCUMENT.md` và `DB_SCHEMA_DESIGN.md`. Priority: Phase order.

---

## Phase 0: Foundation & Setup (Foundation)

### Database

- [ ] Task 1: Create PostgreSQL database with all 14 tables per `DB_SCHEMA_DESIGN.md`
    - [ ] `account`, `client`, `"user"`, `user_client_role`
    - [ ] `curated_brand`, `client_brand`, `category`
    - [ ] `"group"`, `brand`, `crawl_job`
    - [ ] `post` (partitioned by year), `weekly_stats`, `weekly_report`, `brand_activity`
    - [ ] `brand_alias` table for normalization
    - [ ] All indexes, constraints, check constraints per spec
    - [ ] Partition DDL for post_2022, post_2023, post_2024, post_2025
- [ ] Task 2: Create `brand_alias` table with GIN trigram index
- [ ] Task 3: Create `pg_cron` job for weekly crawl scheduling (Sundays 12:00 PM)

### Project Structure

- [ ] Task 4: Initialize Node.js project with TypeScript strict mode
- [ ] Task 5: Set up directory structure per `COBAN_PROJECT_SUMMARY.md`
- [ ] Task 6: Install dependencies: `pg`, `bcryptjs`, `jose`, `fluentvalidation`, `pg-pool`, `date-fns`
- [ ] Task 7: Configure `tsconfig.json` (strict mode, ESNext target)
- [ ] Task 8: Configure ESLint + Prettier

### Infrastructure

- [ ] Task 9: Create `db.ts` — PostgreSQL connection pool (pg)
- [ ] Task 10: Create `auth.ts` — JWT token generation/verification (jose + bcrypt)
- [ ] Task 11: Create `Result.ts` — Success/Failure wrapper type
- [ ] Task 12: Create `UnitOfWork.ts` — Transaction management

### Value Objects

- [ ] Task 13: Create `WeekFormat.ts` — `W## (DD Mon – DD Mon, YYYY)` formatting (e.g. `W13 (12 Apr – 18 Apr, 2025)`)
- [ ] Task 14: Create `VietnamNumberFormat.ts` — `Intl.NumberFormat('vi-VN')` utilities
- [ ] Task 15: Create `WeekId.ts` — ISO year + week number type
- [ ] Task 16: Create `Platform.ts` — 'facebook' | 'youtube' | 'tiktok' union type
- [ ] Task 17: Create `CrawlStatus.ts` — 'pending' | 'crawling' | 'ready' | 'error' union type

---

## Phase 1: Auth & Onboarding (Authentication)

### Authentication

- [ ] Task 18: Implement `RegisterCommand` + `RegisterCommandHandler`
    - [ ] Email + password validation
    - [ ] Password hashing with bcrypt
    - [ ] Create account + first user
    - [ ] Return JWT token
- [ ] Task 19: Implement `LoginCommand` + `LoginCommandHandler`
    - [ ] Verify credentials
    - [ ] Generate JWT with account_id + user_id claims
    - [ ] Return user profile + token
- [ ] Task 20: Create `AuthMiddleware` — JWT verification on protected routes
- [ ] Task 21: Create `RoleMiddleware` — RBAC check per endpoint

### Onboarding Wizard (J3)

- [ ] Task 22: Implement `CreateClientCommand` + `CreateClientCommandHandler`
    - [ ] Create client under account
    - [ ] Check account limit (max_clients)
- [ ] Task 23: Implement `CreateGroupCommand` + `CreateGroupCommandHandler`
    - [ ] Create group with name + benchmark_category_id
    - [ ] Set `crawl_status = 'pending'`
    - [ ] Trigger initial crawl (job_type = 'initial')
- [ ] Task 24: Implement `AddCuratedBrandToGroupCommand` + `AddCuratedBrandToGroupCommandHandler`
    - [ ] Create `brand` row (curated_brand_id + group_id)
    - [ ] Set `is_primary = true` (if first brand in group)
    - [ ] Trigger initial crawl for this brand

### API Routes (Auth)

- [ ] Task 25: `POST /api/auth/register` — Register + create account + user
- [ ] Task 26: `POST /api/auth/login` — Login, return JWT
- [ ] Task 27: `GET /api/auth/me` — Get current user profile

---

## Phase 2: Client & Group Management (Client Management)

### Client CRUD

- [ ] Task 28: `GET /api/clients` — List all clients for account
- [ ] Task 29: `GET /api/clients/:id` — Get client details
- [ ] Task 30: `PUT /api/clients/:id` — Update client (name, industry)
- [ ] Task 31: `POST /api/clients` — Create new client (onboarding step 1)

### Group CRUD

- [ ] Task 32: `GET /api/groups` — List all groups for client
- [ ] Task 33: `GET /api/groups/:id` — Get group details + brands
- [ ] Task 34: `PUT /api/groups/:id` — Update group (name, benchmark_category)
- [ ] Task 35: `POST /api/groups` — Create new group (onboarding step 2)
- [ ] Task 36: `DELETE /api/groups/:id` — Delete group (cascade brand, weekly_stats)

### Brand-in-Group Management

- [ ] Task 37: `GET /api/groups/:id/brands` — List all brands in group with crawl status
- [ ] Task 38: `POST /api/groups/:id/brands` — Add brand to group (onboarding step 3)
- [ ] Task 39: `DELETE /api/groups/:id/brands/:brandId` — Remove brand from group
- [ ] Task 40: `PUT /api/groups/:id/brands/:brandId` — Update brand in group (set primary, change source)

### Team & Settings

- [ ] Task 41: `GET /api/clients/:id/members` — List client team members
- [ ] Task 42: `POST /api/clients/:id/members` — Invite user to client
- [ ] Task 43: `PUT /api/clients/:id/members/:userId` — Update member role
- [ ] Task 44: `DELETE /api/clients/:id/members/:userId` — Remove member
- [ ] Task 45: Implement RBAC middleware (viewer, analyst, admin per client)

---

## Phase 3: Brand Management (Brand Management)

### Curated Brand (Platform Admin)

- [ ] Task 46: `GET /api/brands` — Search curated brands (fuzzy search on name)
- [ ] Task 47: `GET /api/brands/:id` — Get curated brand details
- [ ] Task 48: `POST /api/brands` — Create curated brand (admin only)
- [ ] Task 49: `PUT /api/brands/:id` — Update curated brand
- [ ] Task 50: `GET /api/brands/:id/aliases` — List brand aliases
- [ ] Task 51: `POST /api/brands/:id/aliases` — Add brand alias for normalization
- [ ] Task 52: `DELETE /api/brands/:id/aliases/:aliasId` — Remove alias
- [ ] Task 53: Implement brand normalizer: resolve CSV brand name → curated_brand_id via `brand_alias`

### Category Management

- [ ] Task 54: `GET /api/categories` — List all categories (tree structure)
- [ ] Task 55: `GET /api/categories/:id` — Get category with children
- [ ] Task 56: `POST /api/categories` — Create category (admin only)
- [ ] Task 57: `PUT /api/categories/:id` — Update category

---

## Phase 4: Data Ingestion (Data Pipeline)

### CSV Parser (Initial Data Load)

- [ ] Task 58: Create `CsvParser.ts` — Parse CSV with 17 columns per CSV spec
    - [ ] Handle multiline `Message` field (quotes, newlines)
    - [ ] Parse `Reactions, Comments & Shares` → numeric
    - [ ] Parse `Cost` (VND: `49,536,800,316 ₫` → number)
    - [ ] Parse `Post Date` → ISO timestamp
    - [ ] Parse `Brand` (JSON array: `["Kun"]`)
    - [ ] Parse `Categories` (JSON array)
    - [ ] Normalize `Brands` → `curated_brand_id` via brand alias lookup
    - [ ] Compute `week_start` from `Post Date` (Monday of week)
- [ ] Task 59: Create `PostUpsertService.ts` — Upsert post by `(platform, post_id)`
    - [ ] Use `ON CONFLICT (platform, post_id) DO UPDATE`
    - [ ] Update all metrics on conflict (engagement grows over time)
- [ ] Task 60: Create `PostBulkIngestCommand` + `PostBulkIngestCommandHandler`
    - [ ] Parse CSV → validate → batch upsert (1000 rows/batch)
    - [ ] Return stats: total rows, upserted, updated, errors
- [ ] Task 61: `POST /api/ingest/csv` — Upload CSV, trigger bulk ingest

### Crawl Job Execution (J12 Pipeline)

- [ ] Task 62: Create `CrawlScheduler.ts` — Orchestrate 6-job weekly crawl
- [ ] Task 63: Implement `Job1_CrawlDelta` — For each (group, brand): crawl from Jan 1, upsert posts
    - [ ] Use `brand_alias` for brand normalization
    - [ ] Update `brand.last_crawl_at`
    - [ ] Create `crawl_job` record (job_type='weekly')
- [ ] Task 64: Implement `Job2_GapCalculation` — Post-level W vs W-1 delta
    - [ ] Merge by (platform, post_id)
    - [ ] Compute gap per post: `perf_W - perf_W-1` (old posts), `perf_W` (new posts)
    - [ ] Mark viral posts (> 2x growth) → `brand_activity`
    - [ ] Mark re-engaged posts → `brand_activity`
- [ ] Task 65: Implement `Job3_Aggregation` — Compute `weekly_stats` from posts
    - [ ] `INSERT...ON CONFLICT (group_id, brand_id, week_start) DO UPDATE`
    - [ ] Compute `network_breakdown`, `format_breakdown` via `jsonb_object_agg`
    - [ ] Compute `avg_engagement_rate`
- [ ] Task 66: Implement `Job4_RankingsAndSoV` — Per group: rank brands, compute SOV
    - [ ] Update `weekly_report` row
    - [ ] Detect `is_new` brands (first 2 weeks)
    - [ ] Generate alerts for new brands
- [ ] Task 67: Implement `Job5_ActivityReport` — Create `brand_activity` entries
    - [ ] viral_posts: gap > 200% prev perf
    - [ ] reengaged: existed W-1, new eng W
    - [ ] new_post: only in W
- [ ] Task 68: Implement `Job6_FinalizeAndNotify` — Status finalize + email notification
    - [ ] Update `weekly_report.status = 'finalized'`
    - [ ] Send email to all client users
    - [ ] Refresh materialized views
- [ ] Task 69: `pg_cron` integration — Schedule weekly crawl (Sundays 12:00 PM)

### Crawl Job Monitoring

- [ ] Task 70: `GET /api/crawl-jobs` — List crawl jobs with filters (status, group, brand, date range)
- [ ] Task 71: `GET /api/crawl-jobs/:id` — Get crawl job details
- [ ] Task 72: `POST /api/crawl-jobs/:id/retry` — Retry failed crawl job
- [ ] Task 73: `GET /api/crawl-progress/:groupId` — Real-time crawl progress (per brand status)

---

## Phase 5: Dashboard & API (Dashboard)

### Overview Dashboard (Section A)

- [ ] Task 74: `GET /api/dashboard/:groupId/overview` — KPIs + SOV + network breakdown
- [ ] Task 75: Create `GetDashboardOverviewQuery` + `GetDashboardOverviewQueryHandler`
    - [ ] KPI cards: total_impressions, total_reactions, total_posts, sov_primary, avg_engagement_rate
    - [ ] SOV donut chart data
    - [ ] Network breakdown (YT 51.6%, FB 33.4%, TT 15.0% from example data)
    - [ ] Top insights (brands with largest gap)

### Rankings Dashboard (Section B)

- [ ] Task 76: `GET /api/dashboard/:groupId/rankings` — SOV matrix + SOS matrix + ranking table
- [ ] Task 77: Create `GetRankingsQuery` + `GetRankingsQueryHandler`
    - [ ] Rank brands by impressions (window function)
    - [ ] SOV matrix: Brand × Network heatmap
    - [ ] SOS matrix: Share of Spend
    - [ ] `is_new` badge for brand added recently
- [ ] Task 78: `GET /api/dashboard/:groupId/brand/:brandId/rank-history` — 26-week rank history

### Channel Dashboard (Section C)

- [ ] Task 79: `GET /api/dashboard/:groupId/channel` — Channel KPIs + format mix + posting cadence
- [ ] Task 80: Create `GetChannelDashboardQuery` + `GetChannelDashboardQueryHandler`
    - [ ] Per-network KPI: views, impressions, reactions, ER, posts
    - [ ] Format mix (Image, Video, True view, Short, Bumper)
    - [ ] Posting cadence (posts per week line chart)
    - [ ] YouTube Short vs Normal split

### Content Dashboard (Section D)

- [ ] Task 81: `GET /api/dashboard/:groupId/content` — Format performance + top posts
- [ ] Task 82: Create `GetContentDashboardQuery` + `GetContentDashboardQueryHandler`
    - [ ] Format performance by network
    - [ ] Top 20 posts by engagement (with link, content preview)
    - [ ] Keyword extraction (top keywords from post content)
- [ ] Task 83: `GET /api/dashboard/:groupId/posts` — Paginated post list (search, filter)
    - [ ] Filter: platform, week, format, yt_format
    - [ ] Sort: views, reactions, posted_at
    - [ ] Pagination: cursor-based or offset

### Benchmark Dashboard (Section E)

- [ ] Task 84: `GET /api/dashboard/:groupId/benchmark` — Radar chart + head-to-head + gap
- [ ] Task 85: Create `GetBenchmarkQuery` + `GetBenchmarkQueryHandler`
    - [ ] Primary brand vs benchmark category average
    - [ ] Radar chart: 6 dimensions (posts, views, impressions, reactions, ER, cost)
    - [ ] Head-to-head: primary brand vs each competitor
    - [ ] Gap analysis: W vs W-1 per brand (use `gap_pct` from `weekly_stats`)
    - [ ] Time series: 26-week gap trend

### Trends Dashboard (Section F)

- [ ] Task 86: `GET /api/dashboard/:groupId/trends` — Time series + seasonality
- [ ] Task 87: Create `GetTrendsQuery` + `GetTrendsQueryHandler`
    - [ ] 52-week time series per brand per metric
    - [ ] Seasonality patterns (YoY comparison)
    - [   ] Anomaly detection: posts with > 2x WoW engagement change
    - [ ] `brand_activity` feed (viral + re-engaged posts)

### Weekly Report

- [ ] Task 88: `GET /api/reports/:groupId/weekly` — Get weekly report
- [ ] Task 89: `GET /api/reports/:groupId/weekly/:weekStart` — Get specific week report
- [ ] Task 90: `GET /api/reports/:groupId/weekly/:weekStart/export` — Export PDF/CSV

---

## Phase 6: Frontend (React UI)

### App Context & Routing

- [ ] Task 91: Create `AppContext.tsx` — Global state (account, client, group, week selection)
- [ ] Task 92: Create `AuthContext.tsx` — Authentication state + JWT management
- [ ] Task 93: Create `React Router` routes per `COBAN_PROJECT_SUMMARY.md` pages

### Pages

- [ ] Task 94: Create `LoginPage.tsx` + `RegisterPage.tsx`
- [ ] Task 95: Create `SelectClientPage.tsx` — Client selector after login
- [ ] Task 96: Create `OnboardingWizard.tsx` — 4-step onboarding flow (J3)
    - [ ] Step 1: Select/create client
    - [ ] Step 2: Create group + select benchmark category
    - [ ] Step 3: Select primary brand + competitors
    - [ ] Step 4: Crawl status indicator (per-brand progress)

### Dashboard Layout

- [ ] Task 97: Create `DashboardLayout.tsx` — Sidebar + header + content area
- [ ] Task 98: Create `DashboardHeader.tsx` — Group selector, week picker, user menu
    - [ ] Group dropdown (switch between groups)
    - [ ] Week selector (W## format, current + past weeks)
    - [ ] User profile dropdown

### Dashboard Tabs

- [ ] Task 99: Create `OverviewTab.tsx` — Section A: KPI cards + SOV + network donut + insights
- [ ] Task 100: Create `RankingsTab.tsx` — Section B: SOV matrix + SOS + ranking table
- [ ] Task 101: Create `ChannelTab.tsx` — Section C: Channel KPIs + format mix + cadence
- [ ] Task 102: Create `ContentTab.tsx` — Section D: Format performance + top 20 posts
- [ ] Task 103: Create `BenchmarkTab.tsx` — Section E: Radar + head-to-head + gap
- [ ] Task 104: Create `TrendsTab.tsx` — Section F: Time series + anomalies

### Group Management

- [ ] Task 105: Create `GroupListPage.tsx` — List groups + create group
- [ ] Task 106: Create `GroupDetailPage.tsx` — Group details + brand list
- [ ] Task 107: Create `AddBrandModal.tsx` — Search + add brand to group
- [ ] Task 108: Create `CrawlStatusIndicator.tsx` — Real-time crawl progress

### Team Settings

- [ ] Task 109: Create `TeamSettingsPage.tsx` — Member list + role management
- [ ] Task 110: Create `InviteMemberModal.tsx` — Invite by email

---

## Phase 7: Testing

### Unit Tests

- [ ] Task 111: Write unit tests for `CsvParser.ts` (multiline message, VND parsing, JSON arrays, week_start calculation)
- [ ] Task 112: Write unit tests for `WeekFormat.ts` (format, parse, week boundary)
- [ ] Task 113: Write unit tests for `VietnamNumberFormat.ts` (format, parse, locale)
- [ ] Task 114: Write unit tests for all CommandHandlers
- [ ] Task 115: Write unit tests for `BrandNormalizer` (alias → canonical resolution)

### Integration Tests

- [ ] Task 116: Write integration tests for CSV ingestion pipeline
- [ ] Task 117: Write integration tests for weekly crawl (all 6 jobs)
- [ ] Task 118: Write integration tests for dashboard API endpoints
- [ ] Task 119: Write integration tests for auth (register, login, JWT refresh)

### E2E Tests (Playwright)

- [ ] Task 120: E2E: Register → Login → Select Client → Dashboard
- [ ] Task 121: E2E: Onboarding wizard (4 steps)
- [ ] Task 122: E2E: Switch between dashboard tabs
- [ ] Task 123: E2E: Add competitor to group
- [ ] Task 124: E2E: Week picker navigation

---

## Phase 8: Polish & Optimization

- [ ] Task 125: Create materialized view `mv_latest_rankings` + refresh automation
- [ ] Task 126: Performance test: dashboard queries < 200ms
- [ ] Task 127: Performance test: CSV ingest (10K rows) < 60 seconds
- [ ] Task 128: Add `pg_stat_statements` analysis for slow queries
- [ ] Task 129: Add database seeds: sample curated_brands, categories
- [ ] Task 130: Responsive design test (mobile, tablet, desktop)
- [ ] Task 131: Error handling: global error boundary + toast notifications
- [ ] Task 132: Loading states: skeleton screens for all dashboard sections
- [ ] Task 133: SEO meta tags + Open Graph for shareable reports
- [ ] Task 134: Create `README.md` with setup instructions

