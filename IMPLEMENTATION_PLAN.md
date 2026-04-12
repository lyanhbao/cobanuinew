# COBAN — Implementation Plan

## Project Status: Phase 1 (Not Started)

Gap analysis ngày `(2025-08-25)`: Các pages hiện tại chưa đúng với flow `user-journey-v3.md`, dashboard thiếu metrics theo `pagemetric.md`.

---

## GAP ANALYSIS

### Pages vs. User Journey v3

| User Journey | Route | Trạng thái |
|---|---|---|
| J3: Onboarding Wizard | `/onboarding` | ❌ Chưa có — cần tạo 3-step wizard |
| J4: Assign Users | `/dashboard/settings` | ❌ Chưa có |
| J5: Select Client | `/select-client` | ⚠️ Page trống — cần implement UI |
| J6: Create First Group | `/dashboard/groups/new` | ❌ Chưa có |
| J7: Dashboard View | `/dashboard` | ⚠️ Có mock data, chưa đúng spec |
| J8: Create Second Group | `/dashboard/groups/new` | ❌ Chưa có |
| J9: Add Competitor | `/dashboard/groups/[id]/competitors` | ❌ Chưa có |
| J10: Direct Client Signup | `/auth/signup` | ❌ Chưa có |
| Auth: Login | `/auth/login` | ❌ Chưa có |

### Dashboard vs. pagemetric.md

| Metric Section | Trạng thái |
|---|---|
| A. Overview — KPI Cards, SOV chart, Network donut, Quick Insights | ❌ Chưa có |
| B. Rankings — SOV Matrix, SOS Matrix, Ranking table + sparklines | ❌ Chưa có |
| C. Channel Performance — Tabs (YT/FB/TT), per-channel KPIs, format mix | ❌ Chưa có |
| D. Content Strategy — Format bar, keywords, top 20 posts table | ❌ Chưa có |
| E. Benchmark — Radar chart, head-to-head, gap analysis | ❌ Chưa có |
| F. Trends — Line charts, compare mode, seasonality, anomaly | ❌ Chưa có |

---

## IMPLEMENTATION PLAN

**Ước tính: ~12 working days**, chia 4 phase.

### PHASE 1: Core Routing & Layout — Ngày 1–2

#### 1.1 — Select Client page (`/select-client`) — J5
- Grid cards: mỗi card = tên client + brands count + groups count
- Nút "Đi đến Dashboard →" sau khi chọn
- Lưu selected client vào React context (AppContext)
- Nếu user chưa có client → redirect `/onboarding`

#### 1.2 — Onboarding Wizard (`/onboarding`) — J3
- **Step 1: Clients** — Form khai báo tên client (hỗ trợ thêm nhiều)
- **Step 2: Brands** — Mỗi client khai báo brands (tên + social handles)
- **Step 3: Group** — Tạo group đầu tiên (tên + chọn brand + category + competitors)
- Completion screen → redirect `/select-client`

#### 1.3 — Dashboard Header với selectors
- Header: `[Client ▼] [Group ▼] [Week ▼] [User Avatar]`
- Client selector: dropdown list từ context
- Group selector: chỉ hiện khi client đã có ≥1 group, dropdown
- Week picker: W13 (12 Apr – 18 Apr) format
- Khi client/group thay đổi → update context + navigate dashboard

---

### PHASE 2: Dashboard — Theo spec pagemetric.md — Ngày 3–6

#### 2.1 — Tab Navigation
- Sidebar/header tabs: **Overview | Rankings | Channel | Content | Benchmark | Trends**
- URL pattern: `/dashboard?tab=overview` (hoặc `/dashboard/overview`)

#### 2.2 — Overview Tab (Section A)
- **KPI Cards** (6 cards): Total Impressions, Total Views, Total Engagement, Total Posts, Avg ER, Market Size (formatted số lớn)
- **SOV Chart**: Horizontal stacked bar (brand × network)
- **Network Distribution**: Donut chart (YouTube / Facebook / TikTok)
- **Quick Insights**: 2–4 auto-generated text cards (vd: "Vinamilk tăng 12% trên Facebook tuần này")

#### 2.3 — Rankings Tab (Section B)
- **SOV Matrix**: Table — rows = brands, columns = networks (YT/FB/TT), cell = impression share %
- **SOS Matrix**: Share of Shift — same layout, color-coded green (+) / red (-)
- **Ranking Table**: Sortable (Impressions / Views / Engagement / ER), with sparkline per brand
- **Filters**: Network dropdown, Period dropdown

#### 2.4 — Channel Performance Tab (Section C)
- **Tab sub-navigation**: YouTube | Facebook | TikTok
- **Per-channel KPIs**: Impressions, Views, Engagement, ER, Posts, Avg/post
- **Format Mix**: Horizontal bar chart (% Long Video / Short / Reel / Story)
- **YouTube-specific**: Duration vs ER scatter chart
- **Posting Cadence**: Line chart — posts per month by brand

#### 2.5 — Content Strategy Tab (Section D)
- **Format Performance**: Grouped bar chart (Long Video / Short / Reel / Story)
- **Top Keywords**: Word frequency horizontal bar (top 15)
- **Top 20 Posts Table**: Columns — Brand, Profile, Network, Format, Views, Engagement, ER, Date, Link

#### 2.6 — Benchmark Tab (Section E)
- **Brand selector**: Chọn primary brand + 1–4 competitors
- **Radar Chart**: 5 axes — Impressions, Views, ER, Posting Cadence, Format Diversity
- **Head-to-head Bar Chart**: Side-by-side comparison of selected metrics
- **Gap Analysis**: Highlight metric nào thua đối thủ nhiều nhất

#### 2.7 — Trends Tab (Section F)
- **Line Charts**: Toggle Impressions / Views / Engagement over time
- **Compare Mode**: Overlay multiple brands/networks
- **Seasonality**: Highlight Tết, summer, back-to-school peaks
- **Anomaly Detection**: Dots/badge cho weeks có bất thường (spike/drop > 2σ)

---

### PHASE 3: Group Management & Team Settings — Ngày 7–9

#### 3.1 — Create Group flow (J6 + J8) — `/dashboard/groups/new`
- Form: tên group + chọn brand + benchmark category + competitors
- Preview panel: hiện brands + competitors đã chọn
- Competitor search: từ curated list + custom URL input

#### 3.2 — Add/Remove Competitor (J9) — `/dashboard/groups/[id]/competitors`
- Competitor list: table với status (Active / Pending)
- Add competitor modal: search curated + custom URL
- Confirmation dialog: "Thêm competitor sẽ trigger crawl mới"

#### 3.3 — Settings → Users (J4) — `/dashboard/team`
- User list: avatar, name, email, role per client, last active
- Invite modal: email + gán clients + role (admin/analyst/viewer)
- Edit/remove user

#### 3.4 — Groups management page — `/dashboard/groups`
- List all groups của current client
- Thumbnail per group: name + primary brand + competitor count + crawl status
- Actions: Edit, Delete, Add Competitor, View Dashboard

---

### PHASE 4: Direct Client & Polish — Ngày 10–12

#### 4.1 — Direct Client flow (J10)
- Signup → Select plan → Payment
- Compact onboarding (2 steps): Brands → Group + optional Invite
- Skip client selection step (direct client = client)

#### 4.2 — Pending / Crawling state UI
- Dashboard state khi group đang crawl: "⏳ Đang thu thập dữ liệu..."
- Progress indicator per brand/network
- "Dự kiến hoàn thành: ~30 phút" message

#### 4.3 — Auth flow
- `/auth/login`: Email + password + "Forgot password" + "Sign up"
- `/auth/signup`: Email + password + account type (Agency / Direct Client)
- Invite acceptance flow: `/invite?token=xxx`
- Protected routes: redirect `/dashboard` → `/select-client` → `/login`

#### 4.4 — Backend integration
- Connect Supabase: auth, database CRUD
- Seed categories + curated brands
- API routes cho clients, brands, groups, competitors
- Weekly crawl trigger integration

---

## FILE STRUCTURE TARGET

```
app/
├── page.tsx                              # Landing page ✅
├── layout.tsx
├── globals.css
├── select-client/
│   └── page.tsx                          # [NEW] J5
├── onboarding/
│   ├── page.tsx                          # [NEW] J3 wizard
│   ├── step-clients.tsx
│   ├── step-brands.tsx
│   └── step-group.tsx
├── auth/
│   ├── login/page.tsx                    # [NEW]
│   └── signup/page.tsx                  # [NEW]
├── invite/page.tsx                       # [NEW]
├── dashboard/
│   ├── layout.tsx                        # ✅ (cần update header)
│   ├── page.tsx                          # [UPDATE] tab-based dashboard
│   ├── groups/
│   │   ├── page.tsx                      # [NEW] groups list
│   │   ├── new/page.tsx                  # [NEW] create group J6/J8
│   │   └── [id]/
│   │       ├── page.tsx                  # [NEW] group detail
│   │       └── competitors/page.tsx     # [NEW] J9
│   ├── team/page.tsx                     # [NEW] J4
│   ├── settings/page.tsx
│   ├── alerts/page.tsx
│   ├── analytics/page.tsx
│   └── trends/page.tsx
└── user-journeys/page.tsx                # ✅

components/
├── dashboard/
│   ├── header.tsx                        # [UPDATE] client/group selectors
│   ├── sidebar.tsx
│   ├── tabs-nav.tsx                      # [NEW] 6-tab navigation
│   ├── overview/                         # [NEW]
│   │   ├── kpi-cards.tsx
│   │   ├── sov-chart.tsx
│   │   ├── network-donut.tsx
│   │   └── quick-insights.tsx
│   ├── rankings/                         # [NEW]
│   │   ├── sov-matrix.tsx
│   │   ├── sos-matrix.tsx
│   │   └── ranking-table.tsx
│   ├── channel/                          # [NEW]
│   │   ├── channel-tabs.tsx
│   │   ├── youtube-tab.tsx
│   │   ├── facebook-tab.tsx
│   │   └── tiktok-tab.tsx
│   ├── content/                          # [NEW]
│   │   ├── format-chart.tsx
│   │   ├── keywords-chart.tsx
│   │   └── top-posts-table.tsx
│   ├── benchmark/                        # [NEW]
│   │   ├── radar-chart.tsx
│   │   └── head-to-head.tsx
│   └── trends/                           # [NEW]
│       ├── line-charts.tsx
│       └── anomaly-badge.tsx
├── onboarding/
│   ├── step-indicator.tsx                # [NEW]
│   └── progress-bar.tsx                  # [NEW]
└── ui/                                   # shadcn/ui ✅

lib/
├── journey-data.ts                       # ✅
├── app-context.tsx                       # [NEW] client/group/week state
├── mock-data.ts                          # [NEW] mock data for dashboard
└── supabase.ts                           # [NEW] Supabase client
```

---

## PRIORITY ORDER

1. `AppContext` — shared state (client, group, week)
2. `Select Client page` — J5
3. `Onboarding Wizard` — J3
4. `Dashboard Header` update — client/group selectors
5. `Dashboard Overview tab` — first meaningful data
6. `Dashboard Rankings tab`
7. `Dashboard remaining tabs` (Channel → Content → Benchmark → Trends)
8. `Groups list + Create Group`
9. `Add Competitor`
10. `Team / Settings`
11. `Auth pages`
12. `Backend integration`

---

## NOTES

- Dashboard state: nếu group chưa có data → hiện "Đang thu thập dữ liệu..." (pending state)
- Brand mới thêm tuần đầu → hiện "— mới" (chưa tính được gap %)
- Tất cả chart dùng Recharts, data từ mock → sau replace bằng Supabase queries
- Layout responsive: mobile nav drawer, tablet 2-col, desktop full layout
