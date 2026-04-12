# COBAN — User Journey v3

Document mô tả toàn bộ hành trình người dùng, bao gồm: Platform Admin setup, Agency quản lý Clients & phân quyền, User chọn Client và tạo Group, Direct Client tự mua.

---

## 1. Data Model Tổng Quan

```
AGENCY ACCOUNT
├── CLIENTS (khai báo đầu tiên)
│   ├── Vinamilk
│   ├── TH True Milk
│   └── Dutch Lady
│
├── CLIENT: Vinamilk
│   ├── BRANDS (khai báo thuộc client)
│   │   ├── Vinamilk Gold     → Categories: [Dairy > Milk]
│   │   ├── Vinamilk Probi    → Categories: [Dairy > Yogurt]
│   │   └── Vinamilk Kids     → Categories: [Dairy > Yogurt]
│   │
│   └── GROUPS (group = brand + category + competitors)
│       ├── "Vinamilk — Sữa nước"
│       │   ├── Primary Brand: Vinamilk Gold
│       │   ├── Category: Dairy > Milk (benchmark market)
│       │   └── Competitors: TH True Milk, Dutch Lady, Mộc Châu
│       │
│       └── "Vinamilk — Sữa chua"
│           ├── Primary Brand: Vinamilk Probi
│           ├── Category: Dairy > Yogurt
│           └── Competitors: TH True Yogurt, Ba Vi (custom)
│
├── USERS (được phân vào 1 hoặc nhiều CLIENTS)
│   └── Mỗi user có vai trò per-client: admin / analyst / viewer
│
└── DIRECT CLIENT ACCOUNT
    ├── CLIENT (auto tạo = tên brand)
    ├── BRANDS
    └── GROUPS
```


## 2. Actors

| Actor | Mô tả |
|-------|-------|
| **Platform Admin** | Vận hành nền tảng. Seed data, tạo accounts, monitor crawler. |
| **Agency Owner** | Công ty quản lý nhiều clients. Trả tiền, quản lý users & clients. |
| **Agency Admin** | Tương tự Owner, không có quyền billing. |
| **Client Admin** | Admin của 1 client cụ thể bên trong agency. Quản lý brands & groups của client đó. |
| **Client Analyst** | Xem data, export reports của client được phân. |
| **Client Viewer** | Chỉ xem data, không export. |
| **Direct Client Owner** | Brand tự mua. Vừa là account owner vừa là client. |
| **Direct Client User** | User bên trong direct client account. |

---

## 3. Platform Admin Journey

### J1: Seed Platform Data

> **Trigger:** Lần đầu setup nền tảng. **Một lần duy nhất.**

```
Platform Admin → Admin Panel
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Bước 1: Tạo Categories Tree                               │
│                                                              │
│  📁 Dairy                                                   │
│    ├── 📁 Milk                                              │
│    │   ├── UHT Milk                                        │
│    │   └── Fresh Milk                                      │
│    ├── 📁 Yogurt                                           │
│    │   ├── Drinking Yogurt                                  │
│    │   └── Set Yogurt                                      │
│    └── 📁 Cheese                                           │
│  📁 Beverages                                               │
│  📁 Snacks                                                  │
│  📁 Personal Care                                           │
│  📁 Automotive                                              │
│  ...                                                        │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Bước 2: Tạo Curated Brands (100+ brands)                   │
│                                                              │
│  Mỗi brand:                                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Brand: Vinamilk                                         │ │
│  │ Categories: [Dairy > Milk > UHT Milk]                 │ │
│  │ Social Handles:                                         │ │
│  │   Facebook: @vinamilkvietnam                           │ │
│  │   YouTube: @vinamilk                                   │ │
│  │   TikTok: @vinamilk_official                          │ │
│  │ Status: Active                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Lặp lại: TH True Milk, Dutch Lady, Mộc Châu, Milo,       │
│  Nestlé, Acecook, Coca-Cola, PepsiCo...                     │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
✅ Platform sẵn sàng bán.
```

### J2: Onboard Agency Account

> **Trigger:** Sales ký hợp đồng với agency mới.

```
Platform Admin → Admin Panel → Accounts → [Tạo Account]
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Tạo Account                                                 │
│                                                              │
│  Tên: AdMedia                                                │
│  Type: Agency                                                │
│  Plan: Enterprise                                            │
│  Max Users: 10                                               │
│  Max Clients: Unlimited                                      │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
Platform Admin → Accounts → AdMedia → [Tạo Owner User]
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Tạo User                                                    │
│                                                              │
│  Email: [owner@admedia.vn ___________________________]      │
│  Tên:   [Nguyễn Văn A ______________________________]       │
│  Vai trò: [Owner ▼]                                          │
│                                                              │
│                             [Gửi Invite Email →]            │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
Email đến owner@admedia.vn:
┌──────────────────────────────────────────────────────────────┐
│  Chủ đề: Bạn được mời tham gia COBAN                        │
│                                                              │
│  AdMedia đã được tạo tài khoản trên COBAN.                  │
│  Nhấn vào đường link để bắt đầu:                            │
│                                                              │
│  [Tạo mật khẩu & Bắt đầu →]                                │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
Agency Owner đặt mật khẩu → Redirect sang J3
```

---

## 4. Agency Onboarding Journey

### J3: Agency Owner — Setup Clients, Brands & Phân quyền

> **Trigger:** Agency Owner click link invite lần đầu. Thời gian: ~10-15 phút.

```
┌──────────────────────────────────────────────────────────────┐
│  ONBOARDING WIZARD                                           │
│  Step 1 of 3 — Khai báo Clients                              │
│                                                              │
│  Client là các công ty/brand mà bạn quản lý.               │
│  (Mỗi client sẽ có dashboard riêng)                          │
│                                                              │
│  [+ Thêm Client]                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ [Vinamilk ________________________________________]  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ [TH True Milk _____________________________________]  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ [Dutch Lady _______________________________________]  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Đã khai báo: 3 clients                                      │
│                                            [Tiếp theo →]    │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 2 of 3 — Khai báo Brands cho từng Client             │
│                                                              │
│  Client: [Vinamilk ▼]                                       │
│  ─────────────────────────────────────────────────────────  │
│  [+ Thêm Brand]                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Brand:    [Vinamilk Gold    ____________________]    │ │
│  │ Categories: [Dairy > Milk    ▼] [+ Thêm category]      │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Brand:    [Vinamilk Probi   ____________________]    │ │
│  │ Categories: [Dairy > Yogurt  ▼]                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  → Chuyển sang client khác: [TH True Milk ▼]               │
│  [+ Brand: TH True Milk — Category: Dairy > Milk]          │
│                                                              │
│  → Chuyển sang client khác: [Dutch Lady ▼]                 │
│  [+ Brand: Dutch Lady — Category: Dairy > Milk]            │
│                                                              │
│  Đã khai báo: 4 brands / 3 clients                         │
│                                            [Tiếp theo →]    │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 3 of 3 — Tạo Group đầu tiên cho Client đầu tiên      │
│                                                              │
│  Client: [Vinamilk ▼]                                       │
│  ─────────────────────────────────────────────────────────  │
│  Group này theo dõi brand nào, ở category nào?            │
│                                                              │
│  Tên nhóm:                                                   │
│  [ Vinamilk — Sữa nước ______________________________ ]    │
│                                                              │
│  Chọn Brand của bạn (thuộc Vinamilk):                      │
│  ☑ Vinamilk Gold     [★ Set as Primary]                  │
│  ☐ Vinamilk Probi    (thuộc Dairy > Yogurt)              │
│                                                              │
│  Benchmark Category:                                         │
│  [Dairy > Milk ▼]                                           │
│    → So sánh vs TẤT CẢ brands trong Dairy > Milk          │
│    → [+ Thêm category nếu chưa có]                          │
│                                                              │
│  Chọn Competitors (từ platform — không phải brands bạn quản lý): │
│  ☐ TH True Milk      ✓ Dairy > Milk — Active             │
│  ☐ Dutch Lady        ✓ Dairy > Milk — Active             │
│  ☐ Mộc Châu         ✓ Dairy > Milk — Active             │
│  ☐ Milo Vietnam      ✓ Beverages     — Active             │
│                                                              │
│  [+ Thêm competitor mới]                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ URL:  [https://facebook.com/vinamilkids ____________]  │ │
│  │ Tên: [Vinamilk Kids ______________________________]   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Preview:                                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ⭐ Primary: Vinamilk Gold (Vinamilk)                  │ │
│  │ ✓ Competitors: TH True Milk, Dutch Lady,             │ │
│  │              Mộc Châu, Vinamilk Kids (custom)        │ │
│  │ 📈 Market: Dairy > Milk                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                             [Hoàn thành →]  │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  🎉 Setup Hoàn Tất!                                         │
│                                                              │
│  Dữ liệu đang được thu thập...                             │
│  Thông thường mất 30-90 phút.                              │
│  Bạn sẽ nhận email khi có kết quả.                         │
│                                                              │
│  [Đi đến Dashboard →]                                       │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
**Hệ thống xử lý ngầm:**
→ Tạo group + gán primary brand + competitors
→ INSERT group_brands: first_crawl_at = NOW()
→ INSERT group_competitors: added_at = NOW(), crawl_status = 'pending'
→ **CRAWL LẦN ĐẦU:** crawl tất cả brands (primary + competitors)
   từ **2 năm trước** đến hiện tại
→ Gửi email thông báo bắt đầu crawl

**Tại sao crawl 2 năm?**
→ Đảm bảo mỗi tuần đều có đủ data từ Jan 1 (của năm crawl lần đầu)
→ Tuần crawl đầu tiên: xuất data **Jan 1 → tuần n-1** (tuần trước tuần hiện tại)
→ Từ tuần thứ 2 trở đi: tính gap bằng cách **merge post ID, trừ performance**
   → biết chính xác tuần nào post đó chạy, post nào là cũ
         │
         ▼
Dashboard — Trạng thái chờ:
┌──────────────────────────────────────────────────────────────┐
│  ⏳ Đang thu thập dữ liệu...                               │
│                                                              │
│  Trạng thái crawl:                                          │
│  🔄 Vinamilk Gold — Facebook, YouTube, TikTok              │
│  🔄 TH True Milk                                            │
│  🔄 Dutch Lady                                              │
│  🔄 Mộc Châu                                                │
│  🔄 Vinamilk Kids (custom)                                  │
│                                                              │
│  Thời gian ước tính: ~45 phút                               │
└──────────────────────────────────────────────────────────────┘
```

### J4: Agency Owner — Assign Users to Clients

> **Trigger:** Sau khi J3 hoàn thành, Owner muốn mời team.

```
Sidebar → Settings → Users → [+ Mời thành viên]
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Mời Thành Viên                                             │
│                                                              │
│  Email: [analyst@admedia.vn ___________________________]   │
│  Tên:   [Trần Thị B _________________________________]     │
│                                                              │
│  Gán vào Clients:                                           │
│  ☑ Vinamilk                                                │
│  ☑ TH True Milk                                            │
│  ☐ Dutch Lady                                              │
│                                                              │
│  Vai trò (per-client):                                      │
│  ☑ Admin                                                   │
│  ☑ Analyst                                                 │
│  ☐ Viewer                                                  │
│                                                              │
│  ℹ️ User sẽ chọn client mỗi lần login.                    │
│  Mỗi client có thể có vai trò khác nhau.                  │
│                                             [Gửi lời mời →] │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
Email đến analyst@admedia.vn:
┌──────────────────────────────────────────────────────────────┐
│  Bạn được mời tham gia COBAN — AdMedia                     │
│                                                              │
│  Bạn được gán vào: Vinamilk, TH True Milk (Analyst)        │
│                                                              │
│  [Chấp nhận lời mời →]                                     │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
Analyst đặt mật khẩu → Redirect sang J5 (Select Client)
```

---

## 5. User Daily Journey

### J5: User — Login & Select Client

> **Trigger:** User login (đã được assign vào ≥1 client).

```
User login: coban.vn/login
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Bạn có quyền truy cập vào nhiều clients.                  │
│  Chọn client bạn muốn làm việc hôm nay:                    │
│                                                              │
│  ┌───────────────────────┐  ┌───────────────────────┐       │
│  │  🏢 Vinamilk         │  │  🏢 TH True Milk     │       │
│  │  2 brands            │  │  1 brand             │       │
│  │  1 group             │  │  0 groups            │       │
│  └───────────────────────┘  └───────────────────────┘       │
│                                                              │
│  [Chọn Vinamilk →]                                         │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Vinamilk — Dashboard                                       │
│  TOPNAV: [🏢 Vinamilk ▼]  [W13 ▼]  [👤 Analyst]           │
│                                                              │
│  Client: Vinamilk                                            │
│  Role: Analyst (xem + export)                               │
│  Groups: 1 (Vinamilk — Sữa nước)                           │
│                                                              │
│  KPI CARDS:                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Posts   │  │ Views   │  │ Engage  │  │ Avg ER  │        │
│  │   45    │  │  1.2M  │  │  18K   │  │  1.5%  │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                              │
│  RANKINGS — Dairy > Milk (W13):                            │
│  #1 TH True Milk    — 2.4M impressions  ▲ +12%  [full week] │
│  #2 ⭐ Vinamilk Gold — 1.2M impressions  ▲ +8%   [full week]  ← YOU
│  #3 Dutch Lady      — 1.8M impressions  ▲ +5%   [full week]
│  #4 Mộc Châu       — 0.8M impressions  ▼ -2%   [full week]
└──────────────────────────────────────────────────────────────┘
```

### J6: User — Create First Group (Client First-Time)

> **Trigger:** User chọn 1 client chưa có group nào.

```
TOPNAV: [🏢 Vinamilk ▼] → Client chưa có group
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Vinamilk — Chưa có Group nào                              │
│                                                              │
│  Group là cách bạn theo dõi thị trường:                   │
│  → Mỗi group = 1 brand breakdown + category + competitors  │
│                                                              │
│  [+ Tạo Group đầu tiên]                                   │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Tạo Group — Vinamilk                                       │
│                                                              │
│  Tên nhóm:                                                   │
│  [ Vinamilk — Sữa nước ______________________________ ]    │
│                                                              │
│  Chọn Brand của bạn (thuộc Vinamilk):                      │
│  ☑ Vinamilk Gold     [★ Set as Primary]                  │
│  ☐ Vinamilk Probi    (thuộc Dairy > Yogurt)              │
│                                                              │
│  Benchmark Category:                                         │
│  [Dairy > Milk ▼]                                           │
│    → So sánh vs TẤT CẢ brands trong Dairy > Milk          │
│    → [+ Thêm category nếu chưa có]                          │
│                                                              │
│  Competitors:                                                │
│  ☐ TH True Milk      ✓ Dairy > Milk — Active             │
│  ☐ Dutch Lady        ✓ Dairy > Milk — Active             │
│  ☐ Mộc Châu         ✓ Dairy > Milk — Active             │
│                                                              │
│  [+ Thêm Competitor mới]                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ URL:  [https://facebook.com/vinamilkids ____________]  │ │
│  │ Tên: [Vinamilk Kids ______________________________]   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Preview:                                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ⭐ Primary: Vinamilk Gold                              │ │
│  │ ✓ Competitors: TH True Milk, Dutch Lady,               │ │
│  │              Mộc Châu, Vinamilk Kids (custom)          │ │
│  │ 📈 Market: Dairy > Milk                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                             [Tạo Group →]  │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
**Hệ thống xử lý ngầm:**
→ Tạo group + gán primary brand + competitors
→ INSERT group_brands: first_crawl_at = NOW()
→ INSERT group_competitors: added_at = NOW(), crawl_status = 'pending'
→ **CRAWL LẦN ĐẦU:** crawl tất cả brands (primary + competitors)
   từ **2 năm trước** đến hiện tại
→ Gửi email: "Đang thu thập dữ liệu cho 'Vinamilk — Sữa nước'..."

**Tại sao crawl 2 năm?**
→ Đảm bảo mỗi tuần đều có đủ data từ Jan 1 (của năm crawl lần đầu)
→ Tuần crawl đầu tiên: xuất data **Jan 1 → tuần n-1**
→ Từ tuần thứ 2: tính gap bằng cách **merge post ID, trừ performance**
```

### J7: User — Dashboard View (Data Ready)

> **Trigger:** Crawl hoàn tất.

```
Email đến user:
┌──────────────────────────────────────────────────────────────┐
│  📊 Dữ liệu "Vinamilk — Sữa nước" đã sẵn sàng!            │
│                                                              │
│  Vinamilk Gold: Rank #2 in Dairy > Milk · 1.2M impressions  │
│  ▲ +8% vs tuần trước                                         │
│  W13 · 12 thg 4 – 19 thg 4, 2026                            │
│                                                              │
│  [Xem Dashboard →]        [Tải Báo Cáo ↓]                  │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  TOPNAV: [🏢 Vinamilk ▼] [📁 Vinamilk — Sữa nước ▼]      │
│                [W13 ✓ Finalized ▼]  [👤 Analyst]          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  "Vinamilk — Sữa nước" — Dairy > Milk Market              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ⭐ Vinamilk Gold                      Rank #2        │  │
│  │  ▲ +1 vs last week  ·  1.2M impressions  ·  Beat 78%│  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  KPI CARDS:                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Posts   │  │ Views   │  │ Engage  │  │ Avg ER  │        │
│  │   45    │  │  1.2M  │  │  18K   │  │  1.5%  │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                              │
│  SHARE OF VOICE — Dairy > Milk (W13):                      │
│  TH True     ███████████████░░░░░░░░░░ 18%                 │
│  Vinamilk    ████████████████░░░░░░░░░ 15%                 │
│  Dutch L     ████████████░░░░░░░░░░░░░ 12%                 │
│  Others      ██████████████████████████ 55%                 │
│                                                              │
│  RANKINGS:                                                   │
│  #1 TH True Milk    — 2.4M impressions  ▲ +12%            │
│  #2 ⭐ Vinamilk Gold — 1.2M impressions  ▲ +8%  ← YOU    │
│  #3 Dutch Lady      — 1.8M impressions  ▲ +5%              │
│  #4 Mộc Châu       — 0.8M impressions  ▼ -2%              │
│                                                              │
│  WEEKLY TREND (8 weeks):                                     │
│  ╭────────────────────────────────────────────────────╮     │
│  │  Vinamilk Gold ───── TH True ── Dutch Lady       │     │
│  │  (3 lines, Vinamilk Gold line highlighted)       │     │
│  ╰────────────────────────────────────────────────────╯     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### J8: User — Create Second Group (Same Client)

> **Trigger:** User muốn theo dõi thêm brand/category khác của cùng client.

```
Sidebar → Groups → [+ Tạo nhóm mới]
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Tạo Group — Vinamilk                                       │
│                                                              │
│  Tên nhóm:                                                   │
│  [ Vinamilk — Sữa chua ______________________________ ]    │
│                                                              │
│  Chọn Brand (thuộc Vinamilk):                               │
│  ☐ Vinamilk Gold     (đã dùng ở "Sữa nước")               │
│  ☑ Vinamilk Probi   [★ Set as Primary]                  │
│                                                              │
│  Benchmark Category:                                         │
│  [Dairy > Yogurt ▼]                                         │
│    → [+ Thêm category nếu chưa có]                          │
│                                                              │
│  Competitors:                                                │
│  ☐ TH True Yogurt   ✓ Dairy > Yogurt — Active            │
│  ☐ Ba Vi           ✓ Dairy > Yogurt — Active (custom)  │
│                                                              │
│  Preview:                                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ⭐ Primary: Vinamilk Probi                             │ │
│  │ ✓ Competitors: TH True Yogurt, Ba Vi (custom)          │ │
│  │ 📈 Market: Dairy > Yogurt                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                             [Tạo Group →]  │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
**Hệ thống xử lý ngầm:**
→ Tạo group + gán primary brand + competitors
→ INSERT group_brands: first_crawl_at = NOW()
→ INSERT group_competitors: added_at = NOW(), crawl_status = 'pending'
→ **CRAWL LẦN ĐẦU:** crawl tất cả brands (primary + competitors)
   từ **2 năm trước** đến hiện tại
→ Gửi email thông báo bắt đầu crawl
→ Gửi email: "Đang thu thập dữ liệu..."
         │
         ▼
TOPNAV — Group selector:
┌──────────────────────────────────────────────────────────────┐
│  🔽 GROUP: [Vinamilk — Sữa nước ▼]                         │
│  ──────────────────────────────────────────────────────────  │
│  ⭐ Vinamilk — Sữa nước   ← đang active (data ready)     │
│  ⏳ Vinamilk — Sữa chua   ← mới tạo (đang crawl)         │
│  ──────────────────────────────────────────────────────────  │
│  [+ Tạo nhóm mới]                                           │
│  [⚙️ Quản lý Groups]                                        │
└──────────────────────────────────────────────────────────────┘
```

### J9: User — Add Competitor

> **Trigger:** User phát hiện competitor mới trên thị trường.

```
Sidebar → Groups → [Vinamilk — Sữa nước] → Competitors
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Competitors — "Vinamilk — Sữa nước"                       │
│                                                              │
│  Hiện tại:                                                  │
│  ✅ TH True Milk       (curated)       — Active            │
│  ✅ Dutch Lady         (curated)       — Active            │
│  ✅ Mộc Châu          (curated)       — Active            │
│  ⏳ Vinamilk Kids      (custom)        — Pending           │
│                                                              │
│  [+ Thêm đối thủ]                                           │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Thêm Đối Thủ                                               │
│                                                              │
│  🔍 Tìm kiếm: [nest _________________________________]    │
│                                                              │
│  Kết quả:                                                   │
│  ☐ Nestlé Vietnam      (curated ✓)                         │
│  ☐ Nestlé Pure Life   (chưa có trong platform)            │
│                                                              │
│  ── Hoặc nhập URL mới ──                                  │
│  Platform: [Facebook ▼]                                      │
│  URL:    [https://www.facebook.com/nestlevn _________]    │
│  Tên:   [Nestlé Vietnam ______________________________]  │
│                                                              │
│  ℹ️ Brand mới sẽ được crawl từ 2 năm trước.               │
│  ⚠️ Vì chưa có baseline, data có thể không chính xác:     │
│     — Gap/tuần sẽ hiện "— mới" (chưa tính được)           │
│     — Rankings có thể bị nhiễu (data chưa qua gap calc)   │
│     — Tuần đầu: chỉ hiện số tuyệt đối, chưa có trend %    │
│     — Tuần thứ 2: hệ thống bắt đầu tính gap bình thường   │
│                                             [Thêm →]        │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  ⚠️ Xác nhận                                                │
│                                                              │
│  Thêm Nestlé Vietnam làm đối thủ của nhóm này?              │
│  Hệ thống sẽ crawl dữ liệu Nestlé Vietnam từ 2 năm trước. │
│                                                              │
│  ⚠️ Nestlé Vietnam sẽ hiện badge "🆕 Mới" trong rankings.  │
│     Data tuần đầu: chưa có gap — chỉ hiện số tuyệt đối.    │
│     Tuần thứ 2: bắt đầu tính gap & trend bình thường.      │
│                                                              │
│                              [Hủy]    [Xác nhận & Crawl]    │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
**Hệ thống xử lý ngầm:**
→ Tạo Nestlé Vietnam (nếu chưa có trong platform)
→ INSERT group_competitors: added_at = NOW(), crawl_status = 'pending'
→ **CRAWL LẦN ĐẦU:** crawl từ **2 năm trước** → hiện tại
→ first_crawl_at = NOW()
→ Gửi email: "Nestlé Vietnam đã được thêm, đang crawl data..."

**Tại sao crawl 2 năm?**
→ Đảm bảo Nestlé có baseline từ Jan 1 (2 năm trước) → tuần crawl đầu tiên xuất data **Jan 1 → tuần n-1**
→ Tuần tiếp theo: tính gap bình thường bằng merge post ID
→ ⚠️ Tuần đầu: Nestlé chưa có W-1 trong nhóm → hiển thị "🆕 Mới" — gap chưa tính được
         │
         ▼
Dashboard tự động cập nhật sau crawl (30-90 phút):

RANKINGS — Dairy > Milk (W13):
─────────────────────────────────────────────────────────────
#1 TH True Milk      — 2.4M impressions  ▲ +12%  [full week]
#2 ⭐ Vinamilk Gold  — 1.2M impressions  ▲ +8%   [full week]  ← YOU
#3 Dutch Lady        — 1.8M impressions  ▲ +5%   [full week]
#4 🆕 Nestlé Vietnam — 0.9M impressions  — mới  [first week]
─────────────────────────────────────────────────────────────
 ⚠️ Nestlé Vietnam: brand mới — data chưa qua gap calculation.
    Tuần đầu chỉ hiện số tuyệt đối, chưa có trend %.

SHARE OF VOICE — W13:
─────────────────────────────────────────────────────────────
TH True     ████████████████████████  28%
Vinamilk    ██████████████░░░░░░░░░░  22%
Dutch Lady  ████████████░░░░░░░░░░░░  15%
Nestlé     ████████░░░░░░░░░░░░░░░░  12%  ⚠️ mới — data tuần đầu

TREND CHART:
─────────────────────────────────────────────────────────────
Vinamilk Gold ────────────────────── (solid, 8 weeks)
TH True       ────────────────────── (solid, 8 weeks)
Nestlé        ═══════════             (solid, bắt đầu W6 trở đi)
📝 Nestlé: solid line — có baseline 2 năm, nhưng tuần đầu chưa tính gap

**Giải thích data Nestlé:**
→ Hệ thống crawl 2 năm → có posts từ W6 (2 năm trước) → hiện tại
→ Vì tuần này (W13) là tuần đầu có data Nestlé, nên:
   — Chưa có tuần W12 → không tính được gap %
   — Rankings: Nestlé xếp #4 nhưng với badge "🆕 Mới" — cảnh báo
   — SoV: Nestlé hiện 12% — con số thực nhưng có thể nhiễu vì:
       + Post cũ từ 2 năm trước có engagement thấp
       + Post mới trong tuần W13 có engagement cao
       + Hệ thống chưa tách được: đâu là post mới thật sự, đâu là post cũ được re-engage
→ **Tuần W14:** Có cả W12 & W13 → bắt đầu tính gap bình thường → data chính xác dần

**So sánh: Brand mới thêm vs Brand đã có từ đầu:**

| | Brand đã có từ đầu (Vinamilk) | Brand mới thêm (Nestlé) |
|--|-------------------------------|-------------------------|
| Tuần đầu | Có Jan 1 → W12 (baseline) | Có W6 → W13 (crawl 2 năm) |
| Gap tính được | ✅ (W12 → W13) | ❌ (chưa có tuần trước) |
| Hiển thị | Số + trend % | Số tuyệt đối + "— mới" |
| Rankings | #2 (normal) | #4 + badge ⚠️ |
| Alert | Không | ⚠️ "Data chưa chính xác — brand mới" |
| Từ tuần 2 | Tiếp tục bình thường | Bắt đầu tính gap → dần chính xác |
```

---

## 6. Direct Client Journey

### J10: Direct Client — Signup & Setup

> **Trigger:** Brand tự mua trực tiếp, không qua agency.

```
Truy cập coban.vn
         │
         ├── "Mua ngay" → Chọn plan → Thanh toán
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Tạo Account                                                 │
│                                                              │
│  Tên: Vinamilk                                               │
│  Type: Direct Client                                         │
│  Plan: Professional                                          │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
Platform Admin tạo Owner User → Gửi invite
         │
         ▼
Vinamilk Owner đăng nhập → Onboarding Wizard (3 steps)
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 1 of 3 — Khai báo Brands                              │
│                                                              │
│  Direct Client: Client được tạo tự động = tên account.      │
│                                                              │
│  Client: Vinamilk (auto)                                     │
│                                                              │
│  [+ Thêm Brand]                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Brand:    [Vinamilk Gold    ____________________]    │ │
│  │ Category: [Dairy > Milk    ▼] [+ Thêm category]        │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Brand:    [Vinamilk Probi   ____________________]    │ │
│  │ Category: [Dairy > Yogurt  ▼]                       │ │
│  └────────────────────────────────────────────────────────┘ │
│  ☐ Vinamilk Kids (đây là competitor, khai báo sau ở group) │
│                                            [Tiếp theo →]    │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 2 of 3 — Tạo Group đầu tiên                          │
│                                                              │
│  Tên nhóm:                                                   │
│  [ Sữa nước ________________________________________ ]     │
│                                                              │
│  Chọn Brand:                                                │
│  ☑ Vinamilk Gold     [★ Set as Primary]                  │
│                                                              │
│  Benchmark Category:                                         │
│  [Dairy > Milk ▼]                                           │
│                                                              │
│  Competitors:                                                │
│  ☐ TH True Milk      ✓ Dairy > Milk — Active             │
│  ☐ Dutch Lady        ✓ Dairy > Milk — Active             │
│  ☐ Mộc Châu         ✓ Dairy > Milk — Active             │
│                                                              │
│  Preview:                                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ⭐ Primary: Vinamilk Gold                              │ │
│  │ ✓ Competitors: TH True Milk, Dutch Lady, Mộc Châu     │ │
│  │ 📈 Market: Dairy > Milk                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                            [Tiếp theo →]    │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 3 of 3 — Phân quyền (tùy chọn)                        │
│                                                              │
│  [+ Mời thành viên]                                         │
│  Email: [marcom@vinamilk.com __________________________]   │
│  Vai trò: [Analyst ▼]                                       │
│  ☑ Admin  ☑ Analyst  ☐ Viewer                             │
│                                                              │
│                                            [Hoàn thành →]   │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
→ **CRAWL LẦN ĐẦU:** tất cả brands (primary + competitors) crawl từ **2 năm trước** → hiện tại
→ Email: "Đang thu thập dữ liệu..." → Dashboard
```

### J11: Direct Client — Create Second Group

> **Trigger:** Direct Client muốn theo dõi thêm category khác.

```
→ Tương tự J8 — Tạo group "Sữa chua"
  Brand: Vinamilk Probi [★ Primary]
  Category: Dairy > Yogurt
  Competitors: TH True Yogurt, Ba Vi (custom)
```

---

## 7. Weekly Automation Journey

### J12: System Weekly Crawl (Every Sunday 12:00 PM)

```
┌──────────────────────────────────────────────────────────────┐
│  SUNDAY 12:00 NOON — SYSTEM AUTOMATION                      │
└──────────────────────────────────────────────────────────────┘

SCHEDULER (BullMQ Cron)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Job 1: Crawl Delta                                        │
│                                                             │
│  For EACH group in platform:                               │
│    For EACH brand in group (primary + competitors):        │
│      crawl_from = Jan 1 of current year                    │
│      → Fetch posts from crawl_from → now                   │
│      → Deduplicate by (platform, post_id)                  │
│      → Upsert vào posts table                               │
│      → Update last_crawl_time                              │
│                                                             │
│  ⚠️ Lưu ý: Delta luôn lấy từ đầu năm nay, không phải    │
│     từ last_crawl_time. Lý do: đảm bảo không miss post   │
│     nào trong năm hiện tại (vd: post cũ engagement tăng   │
│     đột biến → cần thu thập lại để tính gap chính xác).  │
│     last_crawl_time chỉ dùng để track trạng thái crawl.  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Job 2: Gap Calculation — Post-Level                       │
│                                                             │
│  Vấn đề: Post có thể tồn tại từ năm ngoái (engagement    │
│  cũ) nhưng vẫn xuất hiện trong crawl tuần này (vì page   │
│  re-share, viral lại, hoặc engagement tăng đột biến).   │
│                                                             │
│  Cách tính gap tuần này:                                   │
│  1. Lấy tất cả posts của brand trong tuần hiện tại (W)   │
│  2. Lấy tất cả posts của brand trong tuần trước (W-1)    │
│  3. Merge theo post_id:                                    │
│     ├── Post nằm TRONG cả W và W-1 (post cũ viral lại)  │
│     │   → gap = performance_W - performance_W-1           │
│     │   → Activity: "post cũ có thay đổi engagement"     │
│     ├── Post CHỈ nằm trong W (post mới tuần này)          │
│     │   → gap = performance_W                               │
│     │   → Activity: "post mới"                             │
│     └── Post CHỈ nằm trong W-1 (post tuần trước)          │
│         → gap = 0 (không hiển thị trong tuần hiện tại)  │
│                                                             │
│  Ví dụ:                                                    │
│  Tuần W13: Nestlé có 5 posts                               │
│    ├── 3 post cũ từ W12 (vẫn đang viral):              │
│    │   engagement W12: 10K, engagement W13: 50K          │
│    │   → gap = +40K engagement (viral effect)           │
│    ├── 2 post mới W13:                                    │
│    │   engagement W13: 30K                                 │
│    │   → gap = +30K (performance tuần này)              │
│    └── Total gap W13: +70K engagement                     │
│                                                             │
│  Đặc biệt: Post cũ có engagement tăng/giảm nhiều        │
│  → Activity report ghi nhận: "Vinamilk post [date]        │
│     có engagement tăng 300% (từ 1K → 4K)"               │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Job 3: Aggregation — Weekly Brand Stats                   │
│                                                             │
│  For EACH brand in group:                                 │
│    week_data = SUM(gap_results) → posts, views,            │
│      likes, comments, shares, engagement                  │
│    prev_week_data = GET(W-1 stats)                        │
│    trend = (week_data - prev_week_data) / prev_week_data  │
│                                                             │
│    UPDATE weekly_brand_stats (W):                         │
│      total_posts = count_post_mới + count_post_cũ_có_gap  │
│      total_views = SUM(gap)                               │
│      total_engagement = SUM(gap)                         │
│      trend_vs_last_week = trend %                         │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Job 4: Rankings & SoV                                    │
│                                                             │
│  For EACH group:                                          │
│    all_brands = all brands in group                       │
│    total_impressions = SUM(all_brands.week_impressions)    │
│                                                             │
│    for brand in all_brands:                               │
│      rank = RANK(all_brands, BY impressions DESC)        │
│      sov = brand.week_impressions / total_impressions      │
│      beat_rate = % brands mà brand này vượt qua          │
│                                                             │
│    ALERT cho brand mới thêm tuần này:                    │
│    (brand mới = crawl lần đầu trong group xảy ra W này) │
│      note = "⚠️ Brand mới — data có thể chưa chính xác.  │
│        Tuần đầu chưa tính gap, tuần tới bắt đầu bình     │
│        thường."                                            │
│      alert = true                                         │
│                                                             │
│    UPDATE weekly_reports                                  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Job 5: Activity Report — Viral / Re-engaged Posts         │
│                                                             │
│  For EACH brand:                                          │
│    viral_posts = posts where (W_perf - W-1_perf > 2x)     │
│    reengaged = posts exist W-1 but got new eng in W      │
│                                                             │
│    IF viral_posts.any() OR reengaged.any():                 │
│      → Activity log: "Brand X có post viral / re-engaged"  │
│      → Include in weekly report notification              │
│      → Dashboard: Activity feed                            │
│                                                             │
│  Ví dụ:                                                    │
│  📢 "TH True Milk post ngày 1/1 có engagement tăng 300%  │
│     (từ 2K → 8K) — có thể do viral content"            │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Job 6: Finalize & Notify                                  │
│                                                             │
│  IF current_time >= week_end:                             │
│    weekly_report.status = 'finalized'                      │
│    Email to ALL users (với ⚠️ alerts nếu có)             │
│  ELSE:                                                    │
│    weekly_report.status = 'ongoing'                        │
│    Email: "Data W13 đang được cập nhật..."              │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
Email đến ALL users:
┌─────────────────────────────────────────────────────────────┐
│  📊 Báo cáo tuần W13 — "Vinamilk — Sữa nước"            │
│                                                             │
│  ⭐ Vinamilk Gold: Rank #2 in Dairy > Milk                 │
│     1.2M impressions · 45 posts · 1.5% ER                │
│     ▲ +8% vs tuần trước (full comparison)               │
│                                                             │
│  ── Activity this week ──                                 │
│  📢 Nestlé Vietnam post "Summer Vibes" có engagement       │
│     tăng 250% (từ 500 → 1.8K) — đang viral             │
│                                                             │
│  ⚠️ Nestlé Vietnam: là brand mới thêm tuần này.          │
│     Gap chưa tính được — data chỉ mang tính tham khảo.    │
│     Tuần W14: bắt đầu tính gap bình thường.             │
│                                                             │
│  [Xem Dashboard →]   [Tải PDF ↓]   [Tải CSV ↓]          │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Journey Map — Tổng Quan

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COBAN USER JOURNEY MAP v2                         │
└─────────────────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════════════════╗
║  PHASE 0: PLATFORM SETUP (One-time)                                        ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  Platform Admin                                                            ║
║  Seed Categories → Seed Curated Brands → Tạo Agency Account + Owner User  ║
╚═══════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔═══════════════════════════════════════════════════════════════════════════╗
║  PHASE 1: AGENCY ONBOARDING (Day 0)                                        ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  Agency Owner (J3)                                                         ║
║  Receive Invite → Khai báo Clients → Brands → Tạo Group đầu tiên         ║
║  │                                                                          ║
║  ▼                                                                          ║
║  ┌─────────────────────────────────────────────────────────────────────┐ ║
║  │  PENDING STATE — "Đang thu thập dữ liệu..." (30-90 phút)          │ ║
║  └─────────────────────────────────────────────────────────────────────┘ ║
║  → J4: Phân user vào clients                                              ║
╚═══════════════════════════════════════════════════════════════════════════╝
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
╔═══════════════════════╗  ╔═══════════════════╗  ╔═══════════════════╗
║  PHASE 2A:           ║  ║  PHASE 2B:         ║  ║  PHASE 2C:         ║
║  DIRECT CLIENT        ║  ║  ONGOING USAGE     ║  ║  WEEKLY LOOP       ║
║  (J10–J11)           ║  ║  (J5–J9)           ║  ║  (Every Sun 12PM) ║
╠═══════════════════════╣  ╠═══════════════════╣  ╠═══════════════════╣
║  Signup → Setup       ║  ║  J5: Select Client ║  ║  J12: Crawl Delta ║
║  Brands → Group(s)   ║  ║  J6: Create Group ║  ║  → Aggregate      ║
║  → Dashboard          ║  ║  J7: View Data    ║  ║  → Finalize      ║
║                       ║  ║  J8: New Group    ║  ║  → Email Users    ║
║                       ║  ║  J9: Add Comp.    ║  ║  → User clicks    ║
║                       ║  ║                   ║  ║  → Dashboard      ║
╚═══════════════════════╝  ╚═══════════════════╝  ╚═══════════════════╝
```

---

## 9. Key Screens Summary

| Screen | Mục đích | Ai vào |
|--------|-----------|--------|
| **Client Selector** | Chọn client mỗi lần login | User được gán ≥2 clients |
| **Onboarding Wizard** | Setup đầu tiên (3 steps) | Agency Owner, Direct Client Owner |
| **Dashboard** | KPIs, SOV, Rankings, Trends, Groups | Tất cả users |
| **Groups** | CRUD groups, manage brands & competitors | Client Admin, Owner |
| **Competitors** | Thêm/sửa competitors, custom URL | Client Admin, Owner |
| **Clients** | CRUD clients, manage brands | Agency Owner, Agency Admin |
| **Users** | Invite users, assign to clients & roles | Agency Owner, Agency Admin |
| **Reports** | List weekly reports, download PDF/CSV | Client Analyst, Admin, Owner |
| **Posts** | Bảng posts với filter, search, export | Tất cả users |
| **Settings** | Account info, billing, notifications | Owner |
| **Admin Panel** | Manage platform brands, categories, accounts | Platform Admin |

---

## 10. Edge Cases

| Tình huống | Xử lý |
|------------|--------|
| Invite email expired | User yêu cầu gửi lại invite |
| Crawl fail lần đầu | Retry 3x tự động → alert Platform Admin |
| Brand mới thuộc category chưa có | Auto-create category → Platform Admin duyệt sau |
| Custom competitor URL không hợp lệ | Validate trước khi save + test scrape |
| User thêm competitor trùng | Deduplicate, không tạo entry mới |
| 1 brand thuộc nhiều groups | Stats tính 1 lần trong DB, hiển thị khác ở mỗi group context |
| User bị gán vào client chưa có group | Hiện màn hình tạo group đầu tiên (J6 empty state) |
| Exceed plan limits | Upgrade prompt khi user cố tạo thêm client/group |
| Account expired | Read-only mode, thông báo renew |
| User được gán nhiều clients | TOPNAV hiện client selector → chọn trước khi vào dashboard |

## 12. Technical Architecture Summary

### 12.1. Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15 (App Router) — React 19, TypeScript, TailwindCSS, Recharts |
| **Backend** | Next.js API Routes + Worker processes |
| **Database** | PostgreSQL 16 (Supabase) — RLS, partitioning by week_start |
| **Cache** | Redis (Upstash) — API cache, sessions, job queue |
| **Object Storage** | S3 / Cloudflare R2 — thumbnails, CSV/PDF exports |
| **Job Queue** | BullMQ (Redis) — crawler scheduling, aggregation workers |
| **Crawler** | Python 3.12+ — Playwright (browser), Platform APIs, scrapetube |
| **Auth** | NextAuth.js v5 — JWT + refresh tokens |

### 12.2. System Flow

```
                    ┌─────────────────────────────────────────────┐
                    │          SCHEDULER (BullMQ Cron)            │
                    │       Every Sunday 12:00 noon               │
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
           ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
           │  Facebook   │   │   YouTube    │   │   TikTok    │
           │   Crawler   │   │   Crawler    │   │   Crawler   │
           └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
                  │                 │                  │
                  └─────────────────┼──────────────────┘
                                    ▼
                         ┌──────────────────────┐
                         │  Transformer         │
                         │  • Deduplicate       │
                         │  • Normalize metrics │
                         │  • Assign week       │
                         │  • Map to brand      │
                         └──────────┬───────────┘
                                    ▼
                         ┌──────────────────────┐
                         │  DB Insert (Upsert)  │
                         │  posts table         │
                         └──────────┬───────────┘
                                    ▼
                         ┌──────────────────────┐
                         │  Aggregation Worker  │
                         │  • SUM/AVG metrics   │
                         │  • Rank brands       │
                         │  • Calc SoM/SoV     │
                         │  • Partial flags    │
                         │  • Finalize reports  │
                         └──────────┬───────────┘
                                    ▼
                         ┌──────────────────────┐
                         │  Cache Invalidation   │
                         │  (Redis DELETE)       │
                         └──────────┬───────────┘
                                    ▼
                         ┌──────────────────────┐
                         │  Email Notifications  │
                         │  (All users in group) │
                         └──────────────────────┘
```

### 12.3. Key Database Tables

```
PLATFORM LEVEL (shared, public scraped data)
────────────────────────────────────────────
brands          — 100+ curated brands + custom brands
posts           — Mỗi row = 1 post (partitioned by week_start)
categories      — Industry tree (Dairy, Beverages, etc.)
weekly_reports  — Market-wide weekly snapshot
weekly_brand_stats — Per-brand per-week aggregated metrics

ACCOUNT LEVEL (per-account, private)
────────────────────────────────────────────
accounts        — Agency hoặc Direct Client
clients         — Client declarations (Agency only)
client_brands   — Brand declarations per client
client_users    — User ↔ Client assignment + per-client role
groups          — Group = brand breakdown + category + competitors
group_brands    — Brands in group + first_crawl_at
group_competitors — Competitors in group + added_at + first_data_at
```

---

## 13. Glossary

| Term | Định nghĩa |
|------|------------|
| **Week Start / Week End** | 12:00 noon Sunday (start) → 12:00 noon Sunday tuần sau (end). Tất cả timestamps UTC. |
| **Cutoff Time** | 12:00 noon — thời điểm freeze data tuần, tất cả crawls phải hoàn tất trước cutoff. |
| **Delta Crawl** | Crawl posts từ đầu năm nay (Jan 1) → hiện tại mỗi Chủ Nhật 12:00 noon. Không phải từ lần cuối — đảm bảo không miss post cũ engagement tăng đột biến. |
| **Full Crawl** | Crawl toàn bộ history có sẵn. Chỉ chạy 1 lần khi tạo group mới. |
| **Partial Week** | Tuần mà brand không có đủ 7 ngày data (do được thêm giữa tuần). |
| **Data Coverage** | % ngày trong tuần mà brand có data. < 50% → excluded khỏi rankings/SoV. |
| **SoM / SoV** | Share of Market / Share of Voice — % của brand trong tổng thị trường. |
| **Curated Brand** | Brand được Platform Admin seed từ đầu (100+ brands). |
| **Custom Brand** | Brand do user tự nhập URL → system tạo record mới → crawl. |
| **Group** | Workspace = 1 primary brand breakdown + benchmark category + competitor list. |
| **Client** | Công ty/brand mà agency quản lý. Direct Client chỉ có 1 client = tên account. |

---

## 14. Data Integrity — Chiến Lược Crawl & Xử Lý Brand Mới

Phần này mô tả chi tiết cách hệ thống thu thập dữ liệu, tính toán performance theo tuần, và xử lý các trường hợp đặc biệt khi thêm brand mới vào thị trường đang theo dõi.

---

### 14.1. Cách Tính Gap — Merge Post ID

Vấn đề thực tế: Một post có thể tồn tại từ năm ngoái (engagement tích lũy) nhưng vẫn xuất hiện trong data tuần này (vì page re-share, viral lại, hoặc engagement tăng đột biến). Nếu chỉ cộng tổng engagement, ta sẽ bị tính engagement cũ 2 lần.

**Cách giải quyết — Merge post ID:**

Bước 1: Lấy tất cả posts của brand trong tuần hiện tại (W). Mỗi post có một post_id duy nhất.

Bước 2: Lấy tất cả posts của brand trong tuần trước đó (W-1). Mỗi post cũng có post_id.

Bước 3: So sánh 2 danh sách theo post_id:

- **Post nằm trong cả W và W-1 (post cũ):** Đây là post từ tuần trước vẫn đang viral hoặc có engagement thay đổi. Gap của post này = `performance_W - performance_W-1`. Ví dụ: post có engagement W12 = 10K, W13 = 50K → gap = +40K (engagement tăng vì viral).

- **Post chỉ nằm trong W (post mới tuần này):** Đây là post được đăng trong tuần hiện tại. Gap = `performance_W` (toàn bộ engagement là của tuần này).

- **Post chỉ nằm trong W-1 (post tuần trước):** Post không còn xuất hiện trong tuần hiện tại → gap = 0 (không hiển thị trong dashboard tuần này).

**Kết quả:** Tổng gap = SUM(gap của tất cả posts trong W). Con số này phản ánh chính xác performance thay đổi của brand trong tuần — không trùng lặp, không thiếu.

**Activity Report:** Khi một post cũ có engagement tăng hoặc giảm đột biến (ví dụ: W_performance - W-1_performance > 2 lần), hệ thống ghi nhận vào Activity Report: "TH True Milk post ngày 1/1 có engagement tăng 300% (từ 2K → 8K) — có thể do viral content." Điều này giúp user hiểu được sự thay đổi không đến từ post mới mà đến từ post cũ được re-engage.

---

### 14.2. Brand Mới — Khác Biệt Khi Tính Gap

Khi user thêm một brand mới vào nhóm đang theo dõi (J9), hệ thống crawl 2 năm như bình thường. Tuy nhiên, brand mới có một điểm khác biệt quan trọng:

**Brand đã có từ đầu trong group:** Tính gap bình thường — merge post ID giữa W và W-1 → biết chính xác post nào là mới, post nào là cũ thay đổi.

**Brand mới thêm vào group:** Tuần đầu tiên (W này) sẽ hiển thị badge "🆕 Mới" vì chưa có tuần W-1 trước đó trong nhóm này để so sánh. Data tuần đầu chỉ hiển thị số tuyệt đối (tổng engagement/posts/views), không hiển thị trend %.

Từ tuần thứ 2 trở đi, brand mới bắt đầu có W-1 trong nhóm → hệ thống tính gap bình thường. Tuy nhiên, cần lưu ý rằng data của brand mới vẫn có thể khác với brand cũ trong cùng nhóm vì:

- Brand cũ: gap = old posts + new posts (tất cả post cũ vẫn được merge)
- Brand mới: gap = chỉ posts thuộc khoảng thời gian crawl (từ 2 năm trước đến W)

Vì lý do này, hệ thống hiển thị **alert note** trên dashboard và trong email báo cáo: "⚠️ Brand mới thêm — data có thể chưa chính xác. Tuần đầu chưa tính gap, tuần kế bắt đầu bình thường."

---

### 14.3. Data Model Mới

Để hỗ trợ chiến lược crawl này, hệ thống bổ sung các trường sau:

**group_brands** (bảng liên kết brand vào group):
- `first_crawl_at` — thời điểm hệ thống bắt đầu crawl lần đầu cho brand này trong group. Dùng để xác định brand có data từ bao giờ trong nhóm này.

**group_competitors** (bảng competitors trong group):
- `added_at` — ngày user thêm competitor này vào group.
- `crawl_status` — trạng thái crawl: 'pending' (chưa crawl), 'active' (đã crawl đầy đủ), 'partial' (mới thêm, data còn ít).

**weekly_brand_stats** (bảng thống kê theo tuần):
- `is_partial` — true nếu brand không có đủ 7 ngày data trong tuần.
- `coverage_days` — số ngày thực tế có data trong tuần (1-7). Dùng để hiển thị "[3/7 ngày]" hoặc "[full week]".

---

### 14.4. UI Flags — Cách Hiển Thị Trên Giao Diện

**Rankings Table:**
- Brand có đủ tuần: hiển thị bình thường với rank số, số tuyệt đối, và trend % (▲/▼).
- Brand mới thêm: hiển thị badge "🆕 Mới" kèm trend "— mới" (chưa tính được %). Nếu brand có data đủ ≥2 tuần, badge được gỡ.

**Share of Voice / Share of Market Chart:**
- Tất cả brands đều được hiển thị trên chart (không loại trừ brand mới).
- Brand mới có note nhỏ bên dưới chart: "⚠️ Brand mới — data tuần đầu chưa qua gap calculation."

**Trend Chart:**
- Brand cũ: đường liền (solid line), 8 tuần.
- Brand mới: đường liền bắt đầu từ tuần crawl đầu tiên (vì đã crawl 2 năm → có baseline). Nhưng tuần đầu hiển thị nét đứt để cảnh báo data chưa qua gap calculation. Từ tuần 2 trở đi → đường liền bình thường.

**Weekly Report Email:**
- Footer ghi chú: danh sách các brand mới thêm trong tuần + cảnh báo data quality.
- Alert box nếu có brand mới: "⚠️ [Tên brand] được thêm vào ngày [date]. Data tuần đầu chưa tính gap, Rankings & SoV có thể nhiễu. So sánh chính xác từ tuần kế."

---

### 14.5. Edge Cases

**1. Brand được thêm giữa tuần:** User thêm Nestlé vào group vào thứ Tư (W13, ngày 11/2). Hệ thống crawl 2 năm → có data W6 (2 năm trước) → W13. Tuy nhiên vì đây là lần crawl đầu tiên của Nestlé trong group này, tuần W13 sẽ hiển thị "🆕 Mới" → "— mới". Từ W14: có đủ W13 → W14 → bắt đầu tính gap.

**2. Crawl thất bại:** Nếu crawler không lấy được data (API lỗi, page không khả dụng), hệ thống ghi `crawl_status = 'failed'`. Rankings vẫn tính nhưng với brands còn lại. Brand thất bại hiển thị badge "⚠️ Crawl lỗi — data W13 bị thiếu". Hệ thống retry vào lần crawl tiếp theo.

**3. Week boundary (12:00 noon Sunday):** Tuần kết thúc vào 12:00 noon Chủ Nhật (UTC). Tất cả data posts có timestamp trước cutoff được gán vào tuần đó. Posts đăng sau cutoff → tuần tiếp theo. Điều này đảm bảo tất cả brands có cùng boundary, không bị lệch timezone.

**4. Post bị xóa trên platform:** Post đã crawl trước đó nhưng bị xóa trên Facebook/Instagram. Ở lần crawl tiếp theo, post không còn xuất hiện → không nằm trong danh sách W. Khi merge với W-1, post này chỉ nằm trong W-1 → gap = 0 → không hiển thị. Nghĩa là post "biến mất" khỏi dashboard tuần hiện tại — đúng behavior.

**5. Brand mới nhưng post có engagement từ năm ngoái:** Nestlé được crawl 2 năm → có posts từ W6 (2024) đến W13 (2026). Một số posts đó có engagement cũ (lũy kế 2 năm). Khi tính gap W13 → W14, nếu post đó vẫn viral, gap sẽ phản ánh engagement thay đổi (không phải tổng engagement). User có thể thấy: "Nestlé post từ W6 (2 năm trước) vẫn có +5K engagement tuần này" — đây là post cũ, không phải post mới.

**6. Ba Vi — Brand không có trong curated platform:** Ba Vi là brand tự nhập (custom) → không có trong curated brands. Platform không có baseline data sẵn. Khi Agency thêm Ba Vi vào group, hệ thống crawl 2 năm từ URL do user cung cấp. Nếu Ba Vi không có đủ data 2 năm (brand mới, hoặc không đăng bài thường xuyên), thì data sẽ ít hơn các brand khác. Hệ thống xử lý bình thường — không có special flag vì đây là behavior expected của custom brand.

**7. Brand trùng lặp trong nhiều groups:** Vinamilk Gold có thể nằm trong group "Sữa nước" (client A) và group "Sữa chua" (client B). Mỗi group có `first_crawl_at` riêng. Crawl 2 năm được thực hiện độc lập cho mỗi group. Posts được deduplicate theo (platform, post_id) → nếu cùng một post ảnh hưởng đến 2 groups, nó sẽ được tính trong cả 2.

**8. Data cộng dồn từ nhiều lần crawl:** Một post có thể được crawl nhiều lần (vì engagement thay đổi theo thời gian). Hệ thống luôn lấy record mới nhất (upsert theo post_id). Engagement được update, không cộng dồn. Khi tính gap, hệ thống so sánh engagement giữa 2 tuần tại thời điểm freeze data — không phải tại thời điểm crawl.

**9. Gap tuần đầu tiên của group mới:** Khi tạo group mới, data tuần đầu tiên xuất ra là Jan 1 → W(n-1) của năm crawl. Tuần này là "full baseline" — tất cả brands trong group đều có data đầy đủ. Từ tuần thứ 2 (W n-1 → W n), bắt đầu tính gap bình thường.

**10. Nhiều brand mới thêm cùng lúc:** User thêm 3 competitors mới vào group cùng lúc. Hệ thống crawl 2 năm cho tất cả 3 brands song song. Tuần đầu: tất cả 3 brands hiển thị "🆕 Mới". Rankings: cả 3 brands nằm cuối bảng (vì data chưa qua gap). Alert: "3 brands mới được thêm — data tuần đầu chưa chính xác."

---

### 14.6. So Sánh: Cách Cũ vs Cách Mới

| | Cách cũ | Cách mới (v3) |
|--|---------|---------------|
| **Crawl lần đầu** | Chỉ crawl từ hôm nay (incremental) | Crawl từ 2 năm trước (full history) |
| **Data tuần đầu** | Chỉ có data từ ngày thêm trở đi | Có data Jan 1 → W(n-1) — đầy đủ baseline |
| **Gap tuần đầu** | Không tính được (không có tuần trước) | Không tính được (brand mới — "— mới") |
| **Từ tuần 2** | Tính được gap từ tuần 2 | Tính được gap từ tuần 2 |
| **Post cũ viral lại** | Engagement cũ bị cộng dồn lại | Merge post ID → chỉ tính phần thay đổi |
| **Custom brand (URL)** | Không có baseline | Crawl 2 năm từ URL user nhập → có baseline |
| **Rankings brand mới** | Data nhiễu (chỉ có vài ngày) | Cảnh báo + badge "🆕 Mới" |
| **SoV brand mới** | Bị scale down vì data thiếu | Hiển thị bình thường + note alert |
| **Activity Report** | Không có | Ghi nhận post viral / re-engaged |

---

### 14.7. Tóm Tắt Luồng Dữ Liệu

1. **User tạo group hoặc thêm competitor** → hệ thống crawl 2 năm cho tất cả brands trong group.
2. **Xuất data tuần đầu:** Jan 1 → W(n-1). Tất cả brands có đủ baseline.
3. **Mỗi tuần (Chủ Nhật 12:00 noon):** Crawl delta từ đầu năm nay (Jan 1) → hiện tại.
4. **Tính gap:** Merge post ID giữa W và W-1 → phân tách post mới và post cũ thay đổi.
5. **Cập nhật weekly_brand_stats:** total_views = SUM(gap), total_posts = posts mới + posts cũ có thay đổi.
6. **Tính Rankings & SoV:** Tất cả brands, nhưng brand mới hiển thị badge "🆕 Mới" và alert note.
7. **Gửi báo cáo:** Email đến tất cả users với ⚠️ alerts nếu có brand mới.

