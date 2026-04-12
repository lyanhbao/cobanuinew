# COBAN — Checklist Công Việc

**Trạng thái:** Chưa bắt đầu
**Ước tính:** ~12 working days

---

## PHASE 1: Core Routing & Layout (Ngày 1–2)

### 1.1 — Select Client page (`/select-client`) — J5
- [ ] Tạo page `/select-client`
- [ ] Grid cards: tên client + brands count + groups count
- [ ] Nút "Đi đến Dashboard →"
- [ ] Lưu selected client vào AppContext
- [ ] Redirect `/onboarding` nếu user chưa có client

### 1.2 — AppContext (shared state)
- [ ] Tạo `lib/app-context.tsx`
- [ ] State: selectedClient, selectedGroup, selectedWeek
- [ ] Provider wrap app layout

### 1.3 — Onboarding Wizard (`/onboarding`) — J3
- [ ] Tạo page `/onboarding`
- [ ] Step 1: Khai báo Clients (form thêm nhiều)
- [ ] Step 2: Khai báo Brands (per client, tên + social handles)
- [ ] Step 3: Tạo Group đầu tiên (tên + brand + category + competitors)
- [ ] Completion screen → redirect `/select-client`

### 1.4 — Dashboard Header với selectors
- [ ] Update `components/dashboard/header.tsx`
- [ ] Thêm Client dropdown selector
- [ ] Thêm Group dropdown selector (chỉ hiện khi ≥1 group)
- [ ] Thêm Week picker (format: W13)
- [ ] Sync state với AppContext

---

## PHASE 2: Dashboard — Theo spec pagemetric.md (Ngày 3–6)

### 2.1 — Tab Navigation
- [ ] Tạo `components/dashboard/tabs-nav.tsx`
- [ ] 6 tabs: Overview | Rankings | Channel | Content | Benchmark | Trends
- [ ] URL sync: `/dashboard?tab=overview`
- [ ] Active state styling

### 2.2 — Overview Tab (Section A)
- [ ] KPI Cards (6): Total Impressions, Views, Engagement, Posts, Avg ER, Market Size
- [ ] SOV Chart: horizontal stacked bar (brand × network)
- [ ] Network Distribution: donut chart (YT/FB/TT)
- [ ] Quick Insights: 2–4 auto-generated text cards

### 2.3 — Rankings Tab (Section B)
- [ ] SOV Matrix: table (brands × networks, cell = impression share %)
- [ ] SOS Matrix: Share of Shift, color-coded (+ green / - red)
- [ ] Ranking Table: sortable (Impressions/Views/Engagement/ER), sparklines
- [ ] Filters: Network dropdown, Period dropdown

### 2.4 — Channel Performance Tab (Section C)
- [ ] Sub-tabs: YouTube | Facebook | TikTok
- [ ] Per-channel KPIs: Impressions, Views, Engagement, ER, Posts, Avg/post
- [ ] Format Mix: horizontal bar (% Long Video/Short/Reel/Story)
- [ ] YouTube: Duration vs ER scatter chart
- [ ] Posting Cadence: line chart (posts/month by brand)

### 2.5 — Content Strategy Tab (Section D)
- [ ] Format Performance: grouped bar chart
- [ ] Top Keywords: horizontal bar (top 15)
- [ ] Top 20 Posts Table: Brand, Profile, Network, Format, Views, Eng, ER, Date, Link

### 2.6 — Benchmark Tab (Section E)
- [ ] Brand selector: primary + 1–4 competitors
- [ ] Radar Chart: 5 axes (Impressions, Views, ER, Posting Cadence, Format Diversity)
- [ ] Head-to-head Bar Chart
- [ ] Gap Analysis: highlight metric thua nhiều nhất

### 2.7 — Trends Tab (Section F)
- [ ] Line Charts: toggle Impressions/Views/Engagement
- [ ] Compare Mode: overlay multiple brands/networks
- [ ] Seasonality: highlight Tết, summer, back-to-school peaks
- [ ] Anomaly Detection: badge cho weeks bất thường (> 2σ)

---

## PHASE 3: Group Management & Team Settings (Ngày 7–9)

### 3.1 — Groups list page (`/dashboard/groups`) — J6/J8
- [ ] Tạo page `/dashboard/groups`
- [ ] List all groups của current client
- [ ] Thumbnail per group: name + brand + competitor count + crawl status
- [ ] Actions: Edit, Delete, Add Competitor, View Dashboard

### 3.2 — Create/Edit Group (`/dashboard/groups/new`, `/dashboard/groups/[id]`)
- [ ] Form: tên group + chọn brand + benchmark category
- [ ] Competitor search: curated list + custom URL input
- [ ] Preview panel: hiện brands + competitors đã chọn
- [ ] Validation + submit

### 3.3 — Add/Remove Competitor — J9
- [ ] Page `/dashboard/groups/[id]/competitors`
- [ ] Competitor list: table (status: Active/Pending)
- [ ] Add competitor modal
- [ ] Confirmation dialog với crawl warning
- [ ] Remove competitor action

### 3.4 — Team Management (`/dashboard/team`) — J4
- [ ] Page `/dashboard/team`
- [ ] User list: avatar, name, email, role, last active
- [ ] Invite modal: email + gán clients + role
- [ ] Edit/remove user actions

---

## PHASE 4: Direct Client & Polish (Ngày 10–12)

### 4.1 — Auth pages
- [ ] `/auth/login`: email + password + forgot password link
- [ ] `/auth/signup`: email + password + account type (Agency/Direct Client)
- [ ] `/invite`: invite acceptance flow (`/invite?token=xxx`)
- [ ] Protected routes: redirect chain

### 4.2 — Direct Client flow — J10
- [ ] Signup → Select plan → Payment (mock)
- [ ] Compact onboarding (2 steps): Brands → Group + Invite
- [ ] Skip client selection (direct client = client)

### 4.3 — Pending / Crawling state UI
- [ ] Dashboard pending state: "⏳ Đang thu thập dữ liệu..."
- [ ] Progress indicator per brand/network
- [ ] Estimated completion time message
- [ ] Brand mới: hiện "— mới" (chưa tính được gap %)

### 4.4 — Backend integration
- [ ] Supabase client setup (`lib/supabase.ts`)
- [ ] Seed categories + curated brands (DB seed script)
- [ ] API routes: clients CRUD
- [ ] API routes: brands CRUD
- [ ] API routes: groups CRUD
- [ ] API routes: competitors CRUD
- [ ] API routes: dashboard data (overview, rankings, channel, content, benchmark, trends)
- [ ] Connect mock data → Supabase queries

---

## PHASE 5: Polish & Review

### 5.1 — Dashboard states
- [ ] Empty state (chưa có group): CTA tạo group đầu tiên
- [ ] Loading state: skeleton screens
- [ ] Error state: retry button + error message

### 5.2 — Layout & Responsive
- [ ] Mobile nav drawer
- [ ] Tablet 2-col layout
- [ ] Desktop full layout

### 5.3 — Final review
- [ ] So sánh tất cả pages vs `user-journey-v3.md`
- [ ] So sánh dashboard vs `pagemetric.md`
- [ ] Kiểm tra navigation flow (J1→J12)
- [ ] Fix any gaps

---

## ✅ ĐÃ HOÀN THÀNH TRƯỚC ĐÓ

- [x] Project setup (Next.js, TailwindCSS, TypeScript)
- [x] shadcn/ui setup
- [x] Supabase client setup (stub)
- [x] Landing page (`/`)
- [x] Dashboard layout (`/dashboard/layout.tsx`)
- [x] Dashboard sidebar + header (basic)
- [x] User Journeys page (`/user-journeys`)
- [x] `lib/journey-data.ts`
- [x] `COBAN_PROJECT_SUMMARY.md`
- [x] `IMPLEMENTATION_PLAN.md`

---

**Tổng: 87 tasks | ✅ 11 done | ⏳ 76 pending**
