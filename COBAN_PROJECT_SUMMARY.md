# COBAN — Project Summary

## Overview

**COBAN** là nền tảng Social Media Competitive Intelligence dành cho thị trường Việt Nam. Giúp các agency và brand theo dõi, phân tích đối thủ cạnh tranh trên Facebook, YouTube, và TikTok thông qua hệ thống crawl data tự động hàng tuần, hiển thị trên dashboard analytics chuyên sâu.

**Tech Stack:** Next.js (App Router) · TypeScript · TailwindCSS · Supabase (Auth + Database) · Recharts · shadcn/ui

---

## User Journey Status

| Journey | Mô tả | Status |
|---------|-------|--------|
| J1 | Platform Admin seed categories & brands | ⏳ Pending |
| J2 | Platform Admin onboard agency account | ⏳ Pending |
| J3 | Agency Owner setup wizard (Clients → Brands → Group) | ⏳ Pending |
| J4 | Agency Owner assign users to clients | ⏳ Pending |
| J5 | User login & select client | ⏳ Pending |
| J6 | User create first group (empty client) | ⏳ Pending |
| J7 | User dashboard view (data ready) | ⚠️ Partial |
| J8 | User create second group | ⏳ Pending |
| J9 | User add competitor | ⏳ Pending |
| J10 | Direct client signup & setup | ⏳ Pending |
| J11 | Direct client create second group | ⏳ Pending |
| J12 | System weekly crawl (every Sunday 12PM) | ⏳ Pending |

### Chi tiết Pages

- **Landing Page** (`/`) — ✅ Đã có (landing page đầy đủ)
- **Select Client** (`/select-client`) — ⚠️ Page trống, cần implement
- **Onboarding Wizard** (`/onboarding`) — ❌ Chưa có
- **Dashboard** (`/dashboard`) — ⚠️ Có mock data, chưa đúng spec
- **Dashboard / Groups** (`/dashboard/groups`) — ❌ Chưa có
- **Dashboard / Team** (`/dashboard/team`) — ❌ Chưa có
- **Auth / Login** (`/auth/login`) — ❌ Chưa có
- **Auth / Signup** (`/auth/signup`) — ❌ Chưa có

---

## Dashboard Metrics — Theo pagemetric.md

### A. Overview
- KPI Cards: Total Impressions, Views, Engagement, Posts, Avg ER, Market Size
- SOV Chart: Horizontal stacked bar (brand share per network)
- Network Distribution: Donut chart (YT/FB/TT share)
- Quick Insights: Auto-generated text cards

### B. Rankings
- SOV Matrix: Brand × Network table
- SOS Matrix: Share of Shift (period-over-period)
- Ranking Table: by Impressions / Views / Engagement / ER (sparklines)
- Filters: by network, by period

### C. Channel Performance
- Tabbed: YouTube | Facebook | TikTok
- Per-channel KPIs + Format Mix + Posting Cadence
- YouTube: Duration vs ER chart

### D. Content Strategy
- Format Performance bar chart
- Top Keywords word frequency
- Top 20 Posts table

### E. Benchmark
- Radar Chart + Head-to-head + Gap Analysis

### F. Trends
- Line Charts + Compare Mode + Seasonality + Anomaly Detection

---

## Data Model

```
AGENCY ACCOUNT
├── CLIENTS
│   ├── BRANDS
│   └── GROUPS (brand + category + competitors)
├── USERS (vai trò per-client: admin/analyst/viewer)
DIRECT CLIENT ACCOUNT
├── CLIENT (auto tạo = tên brand)
├── BRANDS + GROUPS
PLATFORM (seed)
├── CATEGORIES (tree structure)
└── CURATED BRANDS (100+ brands với social handles)
```

---

## Actors

| Actor | Mô tả |
|-------|-------|
| Platform Admin | Seed data, tạo accounts, monitor crawler |
| Agency Owner/Admin | Quản lý nhiều clients, phân quyền users |
| Client Admin/Analyst/Viewer | Quản lý/xem data của 1 client |
| Direct Client | Brand tự mua, tự quản lý |

---

## Weekly Crawl System

1. **Sunday 12:00 PM** — Cron trigger
2. **Crawl**: Jan 1 current year → now (deduplicate by post_id)
3. **Gap Calculation**: Merge W vs W-1 by post_id
4. **Aggregation**: Weekly stats per brand
5. **Rankings & SoV**: Calculate rankings & share of voice
6. **Activity Report**: Detect viral/re-engaged posts
7. **Finalize & Notify**: Finalize report, send email

---

## Next Steps

Xem `IMPLEMENTATION_PLAN.md` — 12 working days chia 4 phase.

## Related Docs

- `user-journey-v3.md` — Full user journey specification
- `pagemetric.md` — Dashboard metrics specification
- `IMPLEMENTATION_PLAN.md` — Chi tiết lộ trình phát triển
