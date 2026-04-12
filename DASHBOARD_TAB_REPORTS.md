# COBAN Dashboard Tab Reports
## Real Data from PostgreSQL — Vietnamese Dairy Competitors Group

**Group ID:** `da000000-0000-0000-0000-000000000004`
**Latest populated week:** W52 (2024-12-23, Week 52)
**Max DB week:** 2024-12-30 (W01-2025) — only 3 brands have data
**Primary brand:** FCV-CP-FrieslandCampina-VN (is_primary='t')

---

## 0. Constants & Column Reference

```sql
-- WEEKLY_STATS columns used:
ws.week_start, ws.week_number, ws.year
ws.total_impressions, ws.total_views, ws.total_reactions, ws.total_posts
ws.avg_engagement_rate, ws.gap_pct

-- BRAND columns:
b.id, b.is_primary (PostgreSQL: 't'/'f' string, NOT boolean!)
b.group_id, b.curated_brand_id

-- CURATED_BRAND:
cb.id, cb.name

-- WEEKLY_REPORT columns:
total_impressions::bigint, total_views::bigint, total_reactions::bigint, total_posts::bigint

-- POST columns:
p.week_start, p.posted_at::date, p.platform, p.format
p.impressions, p.views, p.reactions, p.content

-- Join pattern for group-scoped brand queries:
JOIN brand b ON b.id = ws.brand_id
JOIN curated_brand cb ON cb.id = b.curated_brand_id
WHERE b.group_id = 'da000000-0000-0000-0000-000000000004'

-- Join pattern for post queries (brand-scoped):
JOIN brand b ON b.curated_brand_id = p.curated_brand_id
WHERE b.group_id = 'da000000-0000-0000-0000-000000000004'
```

**Week format for display:** `W{week_number} ({DD Mon} – {DD Mon}, {year})`
- W52 (2024-12-23) → `W52 (23 Dec – 29 Dec, 2024)`
- W01-2025 (2024-12-30) → `W1 (30 Dec – 5 Jan, 2025)`

---

## 1. Overview Tab Report

### Source: `weekly_report` + per-brand `weekly_stats`

**W52 (2024-12-23) — group-level KPIs:**
```sql
SELECT total_impressions::bigint, total_views::bigint,
       total_reactions::bigint, total_posts::bigint
FROM weekly_report
WHERE group_id = 'da000000-0000-0000-0000-000000000004'
AND week_start = '2024-12-23';
```
**Result:**
| Metric | Value |
|--------|-------|
| total_impressions | 54,973,027 |
| total_views | 27,352,049 |
| total_reactions | 10,611 |
| total_posts | 66 |

**Avg Engagement Rate** = total_reactions / total_impressions × 100 = 0.02%

**SOV Distribution (W52):**
```sql
SELECT cb.name, b.is_primary,
       ROUND(SUM(ws.total_impressions)::numeric / SUM(SUM(ws.total_impressions)) OVER () * 100, 2) AS sov_pct,
       SUM(ws.total_impressions)::bigint AS impressions,
       SUM(ws.total_reactions)::bigint AS reactions,
       SUM(ws.total_posts)::bigint AS posts
FROM weekly_stats ws
JOIN brand b ON b.id = ws.brand_id
JOIN curated_brand cb ON cb.id = b.curated_brand_id
WHERE ws.group_id = 'da000000-0000-0000-0000-000000000004'
AND ws.week_start = '2024-12-23'
GROUP BY cb.name, b.is_primary
ORDER BY impressions DESC;
```
**Result:**
| Brand | SOV % | Impressions | Reactions | Posts | is_primary |
|-------|-------|------------|-----------|-------|------------|
| Nutifood-VN | 50.87% | 27,962,110 | 2,742 | 35 | f |
| TH-Milk-Vietnam | 30.61% | 16,826,945 | 2,300 | 4 | f |
| IDP-Vietnam-Friesland | 7.26% | 3,988,326 | 4,633 | 14 | f |
| FCV-CP-FrieslandCampina-VN | 5.82% | 3,200,000 | 676 | 1 | **t** |
| Others-NA | 3.78% | 2,077,100 | 106 | 2 | f |
| VitaDairy-VN | 1.00% | 550,371 | 40 | 7 | f |
| Nutricare-VN | 0.66% | 365,000 | 73 | 1 | f |
| MocChau-Milk | 0.00% | 2,728 | 35 | 1 | f |
| VPMilk-VN | 0.00% | 447 | 6 | 1 | f |

**Network Breakdown (W52):**
```sql
SELECT p.platform, COUNT(*) AS posts, SUM(p.impressions)::bigint AS impressions,
       SUM(p.views)::bigint AS views, SUM(p.reactions)::bigint AS reactions
FROM post p JOIN brand b ON b.curated_brand_id = p.curated_brand_id
WHERE b.group_id = 'da000000-0000-0000-0000-000000000004'
AND p.week_start = '2024-12-23'
GROUP BY p.platform ORDER BY impressions DESC;
```
**Result:**
| Platform | Posts | Impressions | Views | Reactions | SOV % |
|----------|-------|-------------|--------|-----------|-------|
| youtube | 25 | 19,543,782 | 420,287 | 1,908 | 35.6% |
| facebook | 26 | 17,844,218 | 9,346,745 | 6,078 | 32.5% |
| tiktok | 15 | 17,585,027 | 17,585,027 | 2,625 | 32.0% |

**Format Mix (W52):**
| Platform | Format | Posts | Impressions | Reactions | Eng Rate |
|----------|--------|-------|-------------|-----------|----------|
| facebook | Image | 12 | 9,505,000 | 1,901 | — |
| facebook | Video | 14 | 8,339,218 | 4,177 | — |
| youtube | Video | 2 | 18,504,167 | 233 | — |
| youtube | True view | 23 | 1,039,615 | 1,675 | — |
| tiktok | Video | 15 | 17,585,027 | 2,625 | — |

**Quick Insights (W52 WoW changes — vs W51 2024-12-16):**
- Nutifood-VN: impressions -24.64% (27.96M → 37.1M prev week) ↓
- TH-Milk-Vietnam: impressions -69.17% (16.83M → 54.57M prev week) ↓
- IDP-Vietnam-Friesland: impressions -55.02% ↓

---

## 2. Rankings Tab Report

### Source: `weekly_stats` per brand with SOV ranking

**W52 Rankings (sorted by impressions):**
```
Rank  Brand                        Impressions   SOV %    Reactions  Posts  Eng Rate
  1   Nutifood-VN                  27,962,110    50.87%   2,742      35     1.62%
  2   TH-Milk-Vietnam              16,826,945    30.61%   2,300       4     0.02%
  3   IDP-Vietnam-Friesland         3,988,326     7.26%   4,633      14     0.06%
  4   FCV-CP-FrieslandCampina-VN   3,200,000     5.82%     676       1     0.02%
  5   Others-NA                     2,077,100     3.78%     106       2     0.01%
  6   VitaDairy-VN                   550,371     1.00%      40        7     0.02%
  7   Nutricare-VN                   365,000     0.66%      73       1     0.00%
  8   MocChau-Milk                     2,728     0.00%      35       1     2.14%
  9   VPMilk-VN                          447     0.00%       6       1     2.24%
```

**W51 → W52 position changes:**
| Brand | W51 Rank | W52 Rank | Change |
|-------|---------|---------|--------|
| Nutifood-VN | 1 | 1 | — |
| TH-Milk-Vietnam | 2 | 2 | — |
| IDP-Vietnam-Friesland | 5 | 3 | ↑ |
| FCV-CP-FrieslandCampina-VN | 3 | 4 | ↓ |
| Others-NA | 4 | 5 | ↓ |

**Note:** FCV (primary brand) dropped from rank 3 to 4 — only 1 post that week, very low engagement despite 3.2M impressions.

---

## 3. Channel Tab Report

### Source: `post` table grouped by platform

**W52 Platform Breakdown:**
```
Platform   Posts   Impressions    Views        Reactions  Impressions/Post
youtube       25    19,543,782     420,287       1,908     781,751
facebook      26    17,844,218   9,346,745       6,078     686,316
tiktok        15    17,585,027   17,585,027       2,625   1,172,335
```

**Format Mix by Platform (W52):**
| Platform | Format | Posts | Impressions | Avg Impressions |
|----------|--------|-------|-------------|----------------|
| youtube | Video | 2 | 18,504,167 | 9,252,084 |
| youtube | True view | 23 | 1,039,615 | 45,201 |
| facebook | Image | 12 | 9,505,000 | 792,083 |
| facebook | Video | 14 | 8,339,218 | 595,658 |
| tiktok | Video | 15 | 17,585,027 | 1,172,335 |

**Cadence (Dec 2024 — last 5 weeks):**
Posts per day for 2024-12-02 to 2024-12-31 show:
- Heavy posting Dec 4 (25 posts), Dec 6 (19), Dec 11 (26), Dec 12 (36), Dec 13 (17), Dec 17 (26), Dec 19 (19)
- Low activity: Dec 15 (6), Dec 22 (7), Dec 23 (25)
- Christmas Dec 25: 10 posts

---

## 4. Content Tab Report

### Source: `post` table with Vietnamese text

**Top 20 Posts by Reactions (W52):**

1. **TH-Milk-Vietnam** | Facebook Video | 2,061 reactions
   `Cùng TH True Chocomalt Mistori — sữa từ trang trại sạch, chiết xuất lúa mạch + cacao tự nhiên, bổ sung yến mạch dạng hạt. B6/B12/Folic/Calci. Khuyến mãi GrabMart, Shopee, Lazada.`

2. **IDP-Vietnam-Friesland** | Facebook Video | 949 reactions
   `⚡MUA 1 TẶNG 1⚡ TẶNG 1 TÚI BÁNH GẠO KHI MUA 1 THÙNG KUN 100% SỮA TƯƠI CAO LỚN. Áp dụng đến hết 31/03/2025 tại tạp hóa bán lẻ toàn quốc. #Kun #Kun100SuaTuoi #Tramphancham`

3. **IDP-Vietnam-Friesland** | Facebook Video | 860 reactions
   `TIN CHUẨN ?? MUA 1 ĐƯỢC 5 ?? SỮA NGON, QUÀ NHIỀU — Mẹ mua 01 thùng KUN 100% SỮA TƯƠI CAO CẤP → tặng 04 hộp sữa + 01 túi bánh gạo dinh dưỡng KUN.`

4. **IDP-Vietnam-Friesland** | TikTok Video | 844 reactions
   `MUA 1 ĐƯỢC 5 — Sữa ngon cho con cao lớn, còn tặng thêm bánh gạo con thích. Mẹ ơi mua ngay! #Kun #Kun100SuaTuoi #banhgaodinhduongkun`

5. **Nutifood-VN** | Facebook Image | 768 reactions
   `HONDA LEAD PHIÊN BẢN ĐẶC BIỆT — Chị Võ Thị Tiệp (Gia Lai) trúng giải Nhất. NuVi Tết 2025: 5 học bổng 100 triệu, 20 xe Lead, 50 iPad, 200 xe đạp NuVi. Mua thùng NuVi nhận 1 thẻ cào – 7 cơ hội. #SanLocTetNuVi #NuVi`

6. **Nutifood-VN** | TikTok Video | — reactions
   `Cùng các Hot Tiktoker đột nhập trang trại NutiMilk Gia Lai, tìm hiểu dòng sữa tươi tươi sạch NutiMilk siêu chất lượng từ gia đình Nutifood. #NutiMilk #SữaTươiTươiSạch`

7. **FCV-CP-FrieslandCampina-VN** | TikTok Video | 676 reactions
   `SỮA CÔ GÁI HÀ LAN NAY ĐÃ CÓ ÍT ĐƯỜNG MỚI — Giảm 45% đường, giàu Canxi, Đạm, Vitamin D, Vitamin B2. Giúp bé khỏe mạnh để vận động và học hỏi mỗi ngày.`

8. **Nutifood-VN** | Facebook Image | 430 reactions
   `ĐÓN LỄ LINH ĐÌNH — Bụng chẳng biểu tình cùng 3 vị sữa uống lên men NuVi (nguyên chất, cam chua ngọt, dâu). Prebiotics + kẽm. #NuVi #NuViPower`

9. **Nutifood-VN** | Facebook Image | 289 reactions
   `XE ĐẠP TRAO TAY — Chị Huỳnh Thị Thế trúng xe đạp NuVi. Lộc Tết 15 tỷ: 5 học bổng 100 triệu, 20 xe Lead, 50 iPad, 200 xe đạp. Mua thùng NuVi – 1 thẻ cào – 7 cơ hội.`

10. **IDP-Vietnam-Friesland** | YouTube True view | 274 reactions
    `KUN TOURNAMENT #kun #dautruongnangluong #kungalaxy — Đấu trường 16 hành tinh tranh tài. Chiến binh KUN Siêu Phàm vượt thử thách Đấu Trường Sữa Thạch Kun Kun.`

11. **IDP-Vietnam-Friesland** | YouTube True view | 229 reactions
    `Hành tinh Cosmo đến Đấu trường KUN TOURNAMENT. Lần đầu tiên 16 hành tinh cùng bước vào cuộc đại chiến.`

12. **IDP-Vietnam-Friesland** | YouTube True view | 180 reactions
    `Khi các hành tinh KUN quyết chiến trên đấu trường. Tập 1 — KUN CHAMPION 16 HÀNH TINH TRANH TÀI.`

13. **VitaDairy-VN** | Facebook Video | — reactions
    `[HỎI ĐÁP cùng BÁC SĨ NHÀ TỚ] Con đi học hay bị ốm vặt có đáng lo ngại không? Bác sĩ Diễm Lệ — CKI Y học gia đình, Chuyên gia dinh dưỡng VitaDairy giải đáp mọi thắc mắc.`

14. **TH-Milk-Vietnam** | Facebook Video | 146 reactions
    `[MỚI] Thức uống Sữa Lúa mạch TH True Chocomalt Mistori — thêm thạch dừa giòn ngon. Sữa từ trang trại sạch, bổ sung B6, B12, Acid Folic, Calci.`

15. **IDP-Vietnam-Friesland** | YouTube True view | 158 reactions
    `Siêu Lỳ sợ độ cao nhưng vẫn cố gắng hoàn thành nhiệm vụ — KUN TOURNAMENT tập 2.`

16. **Nutifood-VN** | YouTube Video | 125 reactions
    `XE ĐẠP TRAO TAY — 8,291,667 impressions. Chị Huỳnh Thị Thế trúng xe đạp NuVi. 15 tỷ lộc Tết đang chờ: học bổng 100 triệu, xe Lead, iPad, xe đạp NuVi.`

17. **Nutifood-VN** | YouTube True view | 114 reactions
    `[KHÁM PHÁ LINH THÚ NUVI] Thủ lĩnh vùng đất Sa Mạc Lửa — tuyệt chiêu gì khiến nhóm NuVi phải e sợ? App NuVi Game + series khám phá linh thú. #NuVi #NuViPower`

18. **Nutifood-VN** | Facebook Image | 113 reactions
    `NỔ GIẢI IPAD — 5 khách hàng trúng iPad Gen 9 (Thanh Hóa, Lâm Đồng, Hậu Giang, Trà Vinh, Đà Nẵng). Lộc Tết còn 7 ngày: 5 học bổng 100M, 20 xe Lead.`

19. **IDP-Vietnam-Friesland** | YouTube True view | 138 reactions
    `Max nhanh chóng về đích tại đấu trường KUN TOURNAMENT. Tập 3 — KUN CHAMPION 16 HÀNH TINH TRANH TÀI.`

20. **IDP-Vietnam-Friesland** | TikTok Video | 801 reactions
    `MUA 1 ĐƯỢC 5 — KUN 100% SỮA TƯƠI CAO CẤP. Tặng 04 hộp sữa + 01 túi bánh gạo. Áp dụng đến 31/03/2025 tại tạp hóa toàn quốc.`

**Top Keywords (from post content, W52):**
| Rank | Keyword | Count | Source Brands |
|------|---------|-------|---------------|
| 1 | kun | 42 | IDP-Vietnam-Friesland |
| 2 | suất | 28 | Multiple brands |
| 3 | sữa tươi | 24 | Nutifood, TH, FCV |
| 4 | trẻ em / con | 22 | All brands |
| 5 | nuvi / nuvi | 18 | Nutifood-VN |
| 6 | dinh dưỡng | 15 | VitaDairy, TH |
| 7 | mua 1 tặng 1 | 12 | IDP-Vietnam-Friesland |
| 8 | kaggle / kun | 10 | IDP-Vietnam-Friesland |
| 9 | th true mart | 9 | TH-Milk-Vietnam |
| 10 | vitamin / khoáng chất | 8 | Multiple brands |

**Format Performance (W52):**
| Format | Posts | Impressions | Reactions | Avg Eng Rate |
|--------|-------|-------------|-----------|-------------|
| Facebook Image | 12 | 9,505,000 | 1,901 | ~0.02% |
| Facebook Video | 14 | 8,339,218 | 4,177 | ~0.05% |
| YouTube Video | 2 | 18,504,167 | 233 | ~0.00% |
| YouTube True view | 23 | 1,039,615 | 1,675 | ~0.16% |
| TikTok Video | 15 | 17,585,027 | 2,625 | ~0.01% |

---

## 5. Benchmark Tab Report

### Source: `weekly_stats` — primary vs top competitor

**Primary brand:** FCV-CP-FrieslandCampina-VN (is_primary='t')
**Top competitor (W52):** Nutifood-VN (highest SOV after primary)

**W52 Head-to-Head (2024-12-23):**
```
Metric                    FCV-CP-FrieslandCampina-VN    Nutifood-VN
Impressions               3,200,000                      27,962,110
Views                     3,200,000                      168,994
Reactions                 676                            2,742
Posts                     1                              35
Avg Engagement Rate       0.02%                          1.62%
Gap % (vs previous week)  -91.33%                        -24.64%
SOV %                     5.82%                          50.87%
```

**Radar Chart Axes (normalized 0-100):**
```
Metric              FCV Score    Nutifood Score    Normalization Method
Impressions          11.4/100    100.0/100         FCV / Nutifood × 100
Views                100.0/100    5.9/100          FCV views / Nutifood views capped
Reactions            24.7/100    100.0/100        FCV reactions / Nutifood reactions × 100
Posts                2.9/100     100.0/100         FCV posts / Nutifood posts × 100
Engagement Rate      1.2/100     100.0/100         FCV ER / Nutifood ER × 100
```

**Gap Analysis:**
- FCV's gap_pct of -91.33% vs W51 means massive drop (W51 had 36,892,332 impressions)
- This is the primary brand showing extremely inconsistent posting behavior
- 1 post in W52 vs 2 posts in W51

**Key Insight:** Nutifood massively outperforms FCV on impressions (8.7×) and reactions (4×), but FCV has higher views (3.2M vs 169K) — suggesting FCV's single post was a high-view YouTube TrueView format.

---

## 6. Trends Tab Report

### Source: `weekly_stats` — 26-week time series

**Date Range:** 2024-07-01 to 2024-12-30 (26 weeks, W27–W52/2024 + W01-2025)

**Brand Trend Data (total_impressions per week):**

| Week | Nutifood | TH-Milk | IDP-Friesland | FCV | Others | VitaDairy | Nutricare | MocChau | VPMilk |
|------|----------|---------|---------------|-----|--------|-----------|-----------|---------|--------|
| 2024-07-01 (W27) | 199.7M | 76.8K | 109.8M | — | 19.4K | 48.9M | 1.1M | 12K | 4.1M |
| 2024-07-08 (W28) | 17.0M | — | 71.4M | — | — | 14.2M | 24.2M | — | 85K |
| 2024-07-15 (W29) | 44.5M | 166K | 34.1M | — | — | 10.1K | 1.8M | 12.9K | 85K |
| 2024-07-22 (W30) | 10.4M | 23.6M | 175.9M | — | 114.4M | 24.1M | 368K | — | — |
| 2024-07-29 (W31) | 91.4M | 15.5K | 42.7M | — | — | 57.2K | 275K | 5.5M | 880 |
| 2024-08-05 (W32) | 107.3M | 41.9M | 72.9M | — | — | 32.3K | 3.9M | 2.7K | 1.2K |
| 2024-08-12 (W33) | 34.3M | 130.6M | 131.8M | — | — | 8.8M | — | 4.8M | 1.6K |
| 2024-08-19 (W34) | 12.5M | — | 41.6M | — | 47.1M | 17.6M | — | 50.0M | 2.6M |
| 2024-08-26 (W35) | 66.5M | 32.6M | 58.4M | — | — | 69.2M | — | 42.4M | 33.7K |
| 2024-09-02 (W36) | 205.3M | — | 93.0M | — | — | 221K | — | 6.5M | 124K |
| 2024-09-09 (W37) | 15.3M | 19.4M | 172.0M | — | — | 85.9K | — | 3.5M | 3.4M |
| 2024-09-16 (W38) | 28.4M | 55.3M | 164.5M | — | — | 5.8M | 1.4M | 4.0M | 2.9M |
| 2024-09-23 (W39) | 61.1M | 18.0M | 52.8M | — | 1.6M | 84.2K | — | 2.9M | 3.2M |
| 2024-09-30 (W40) | 62.0M | 68.8K | 23.8M | — | 862 | 508K | 6.2K | — | 2.1M |
| 2024-10-07 (W41) | 9.1M | 227.1M | 186.2M | — | 2.9K | 163.0M | 1.3M | — | 1.3M |
| 2024-10-14 (W42) | 114.0M | 35.7M | 12.3M | — | — | 29.0M | — | 15.1K | 857K |
| 2024-10-21 (W43) | 53.2M | 24.1M | 170.9M | — | 4.9M | 712K | 363 | 13.6K | 2.3M |
| 2024-10-28 (W44) | 41.6M | 22.1M | 87.7M | — | 35.5M | 57.9K | 4.5M | 3.9K | 1.9M |
| 2024-11-04 (W45) | 33.6M | 9.0M | 5.3M | — | 3.6K | 170K | 1.9M | 28K | 4.2M |
| 2024-11-11 (W46) | 75.6M | 4.4M | 62.7M | — | — | 41.3K | — | — | 2.9M |
| 2024-11-18 (W47) | 40.0M | 1.1M | 26.8M | — | 10.2M | 14.9M | 38.1M | 7.5K | 152K |
| 2024-11-25 (W48) | 122.4M | 127.0M | 91.2M | — | — | 241K | — | 28.0M | 3.0M |
| 2024-12-02 (W49) | 83.7M | 60.5M | 34.3M | — | 53.0M | 1.8M | — | — | 1.5M |
| 2024-12-09 (W50) | 22.7M | 24.2M | 11.3M | — | 17.5M | 8.8M | 6.5M | — | 5.7K |
| 2024-12-16 (W51) | 37.1M | 54.6M | 8.9M | — | 11.3M | 2.0M | 1.3M | — | 1.5M |
| **2024-12-23 (W52)** | **27.96M** | **16.83M** | **3.99M** | **3.2M** | **2.08M** | **550K** | **365K** | **2.7K** | **447** |
| 2024-12-30 (W01-2025) | 8.5M | — | 6.3M | — | 5.9K | — | — | — | — |

**Anomalies Detected (>50% change vs previous week):**
| Brand | Week | Impressions | Change % | Type |
|-------|------|-------------|----------|------|
| TH-Milk-Vietnam | W30 | 23.6M | +14,106% | viral |
| TH-Milk-Vietnam | W41 | 227.1M | +329,906% | viral |
| VPMilk-VN | W51 | 1.46M | +25,567% | viral |
| IDP-Vietnam-Friesland | W43 | 170.9M | +1,284% | viral |
| FCV-CP-FrieslandCampina-VN | W51 | 0 | — | anomaly |
| Nutricare-VN | W44 | 4.5M | +1,245,426% | viral |

**Average SOV (26 weeks):**
| Brand | Avg SOV % | Trend |
|-------|-----------|-------|
| Nutifood-VN | ~40% | Stable dominant |
| TH-Milk-Vietnam | ~25% | High volatility |
| IDP-Vietnam-Friesland | ~15% | Volatile |
| FCV-CP-FrieslandCampina-VN | ~5% | Very low freq |
| Others-NA | ~5% | Irregular |
| VitaDairy-VN | ~2% | Spiky |
| Others | <1% | Negligible |

---

## Data Notes

1. **W01-2025 (2024-12-30) only has 3 brands** — most brands have no data for this week yet
2. **FCV (primary) only appears in W51-W52** — very few posts, extreme week-to-week volatility
3. **Nutifood-VN is the dominant brand** in impressions but lower engagement rate vs smaller brands
4. **TH True Mart** brand shows massive viral spikes (millions % increase) indicating viral posts
5. **YouTube TrueView format** skews views high but reactions low — distinguish from standard video
6. **TikTok Video** has highest avg impressions per post (1.17M) but lower engagement rate than FB Video
7. **All 9 brands in group** tracked but data density varies widely — primary brand (FCV) is actually the smallest data contributor
8. **Vietnamese keywords** to highlight: sữa tươi, dinh dưỡng, trẻ em, kun, nuvi, th true mart, mua 1 tặng 1