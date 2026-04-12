# COBAN — Database Seed Data Summary

**Generated:** 2026-04-11
**Database:** PostgreSQL `coban` at `127.0.0.1:5433`
**Connection:** `postgresql://coban:coban_dev_password@127.0.0.1:5433/coban`

---

## 1. What Data Exists in the Database

### 1.1 Tables Overview (15 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `account` | Agency/Direct client accounts | id, name, type, plan, billing_email |
| `client` | Clients under an account | id, name, account_id |
| `group` | Tracking groups under a client | id, name, client_id |
| `user` | Users under an account | id, email, password_hash, full_name, role |
| `user_client_role` | Per-client RBAC (admin/analyst/viewer) | user_id, client_id, role |
| `curated_brand` | Platform-wide brand registry (~200 brands) | id, name, slug, categories, advertiser, status |
| `brand` | Brand tracking in a group (primary + competitors) | id, curated_brand_id, group_id, is_primary |
| `brand_alias` | Alternative names for brands | brand_id, alias |
| `post` | Raw post data (partitioned by year) | id, curated_brand_id, platform, format, impressions, views, reactions, week_start |
| `weekly_stats` | Pre-aggregated weekly metrics | brand_id, group_id, week_start, week_number, total_impressions, total_views, total_reactions, total_posts, avg_engagement_rate, gap_pct |
| `weekly_report` | Group-level rollup | group_id, week_start, total_impressions, total_views |
| `brand_activity` | Anomaly/viral detection | brand_id, week_start, activity_type, title, description, gap_pct |
| `crawl_job` | Crawl execution history | id, group_id, status, started_at, finished_at, posts_crawled |
| `client_brand` | Client-level brand assignments | client_id, curated_brand_id |
| `category` | Brand categories | id, name, slug |

### 1.2 Data Volume

| Metric | Count |
|--------|-------|
| Total weekly_stats rows | **1,107** |
| Total raw posts | **10,796** |
| Groups with data | **2** (Dairy + Full Market) |
| Curated brands total | **19** |
| Brands tracked in Dairy group | **10** (9 with data) |
| Test user accounts | **91** |

### 1.3 Group with Full Data

**Group:** `Vietnamese Dairy Competitors`
- **ID:** `da000000-0000-0000-0000-000000000004`
- **Client:** Vietnamese Dairy Market
- **Coverage:** 157 tuần (03/01/2022 → 30/12/2024)
- **Total impressions:** ~32,3 tỷ
- **Total posts:** ~10,796 bài viết

---

## 2. Which Test Accounts Have Data

### 2.1 Priority: Demo Account (Recommended)

| Field | Value |
|-------|-------|
| **Email** | `demo@dairyinsights.vn` |
| **Password** | `demo1234` |
| **Full Name** | Dairy Demo User |
| **Role** | admin |
| **Account** | Demo Agency |
| **Client** | Vietnamese Dairy Market |
| **Group with data** | Vietnamese Dairy Competitors |

This account has access to the **Vietnamese Dairy Competitors** group which has the full dataset (10 brands, 1,107 weekly rows, 10,796 posts).

### 2.2 Other Test Accounts (91 total)

| Pattern | Description | Count |
|---------|------------|-------|
| `coban_j6_full_*@test.com` | Full flow journey testers | 15 |
| `coban_j6_godash_*@test.com` | Go-to-dashboard testers | 15 |
| `coban_j6_s2to3_*@test.com` | Stage 2-to-3 testers | 15 |
| `coban_j6_s3_search_*@test.com` | Search feature testers | 15 |
| `coban_j6_s3to4_*@test.com` | Stage 3-to-4 testers | 15 |
| `coban_j6_s4_*@test.com` | Stage 4 testers | 15 |
| `demo@dairyinsights.vn` | Main demo account | 1 |

**Note:** Most test accounts are associated with **Test Client Corp** and **Dairy Market Tracking** group — these may have limited or no data. Use `demo@dairyinsights.vn` for full data access.

---

## 3. How to Log In as Test User

### 3.1 Via UI (Recommended)

1. Navigate to `http://localhost:3000/auth/login`
2. Enter email: `demo@dairyinsights.vn`
3. Enter password: `demo1234`
4. Click **Sign In**
5. You will be redirected to `/select-client` → select **Vietnamese Dairy Market**
6. Then select **Vietnamese Dairy Competitors** group
7. Navigate to the dashboard to see real data

### 3.2 Via Database (for verification)

```bash
# Connect to database
PGPASSWORD=coban_dev_password psql "postgresql://coban:coban_dev_password@127.0.0.1:5433/coban"

# Verify demo user exists
SELECT id, email, full_name FROM "user" WHERE email = 'demo@dairyinsights.vn';

# Verify demo user has access to Vietnamese Dairy group
SELECT u.email, c.name as client, g.name as "group"
FROM "user" u
JOIN account a ON a.id = u.account_id
JOIN client c ON c.account_id = a.id
JOIN "group" g ON g.client_id = c.id
WHERE u.email = 'demo@dairyinsights.vn';
```

### 3.3 Test Credentials Quick Reference

| Role | Email | Password | Data Access |
|------|-------|----------|-------------|
| **Primary Demo** | `demo@dairyinsights.vn` | `demo1234` | Full: Vietnamese Dairy Competitors |
| J6 Test (any) | `coban_j6_full_*@test.com` | (varies) | Full Client Corp / Dairy Market Tracking |

---

## 4. Curated Brands in Database

| Brand | Advertiser | Categories |
|-------|-----------|------------|
| Vinamilk | Vinamilk JSC | milk, dairy, beverage |
| TH True Milk | TH True Milk | milk, organic, dairy |
| KUN Brand | KUN | beverage, dairy |
| Kido-Group-VN | Kido | milk, yogurt, snack |
| Milo Vietnam | Nestlé Vietnam | beverage, milk, energy |
| Nestlé Vietnam | Nestlé | food, beverage, confectionery |
| Nutifood-VN | NTF | milk, yogurt, nutrition |
| Nutriboot | Nutriboot | beverage, nutrition |
| Nutricare | Nutricare | milk, nutrition, health |
| Nutricare-VN | Nutri | milk, nutrition |
| VitaDairy-VN | VitD | milk, colostrum |
| VPMilk-VN | VPM | milk, dairy |
| MocChau-Milk | MCM | milk, organic |
| FCV-CP-FrieslandCampina-VN | FCV | milk, yogurt, dairy |
| IDP-Vietnam-Friesland | IDP | milk, yogurt, dairy |
| Others-NA | NA | dairy |
| Unilever Vietnam | Unilever | food, beverage, personal care |
| P&G Vietnam | P&G | personal care, beverage |

---

## 5. Curated Brands Tracked in Vietnamese Dairy Competitors Group

| Brand | Type | Status |
|-------|------|--------|
| IDP-Vietnam-Friesland | Competitor | Active with data |
| Nutifood-VN | Competitor | Active with data |
| TH-Milk-Vietnam | Competitor | Active with data |
| FCV-CP-FrieslandCampina-VN | **Primary** | Active with data |
| Nutricare-VN | Competitor | Active with data |
| VitaDairy-VN | Competitor | Active with data |
| Others-NA | Competitor | Active with data |
| MocChau-Milk | Competitor | Active with data |
| VPMilk-VN | Competitor | Active with data |
| Kido-Group-VN | Competitor | **No data** |

---

## 6. Running Seed Data

### 6.1 Re-seed the database

```bash
cd /Users/lab/Downloads/b_NOYGPFI192h

# Seed all tables
PGPASSWORD=coban_dev_password psql "postgresql://coban:coban_dev_password@127.0.0.1:5433/coban" -f db/seed.sql

# Seed dairy-specific data (brands, weekly_stats, posts)
PGPASSWORD=coban_dev_password psql "postgresql://coban:coban_dev_password@127.0.0.1:5433/coban" -f db/seed-dairy.sql
```

### 6.2 Verify seed data

```bash
# Check weekly_stats count
PGPASSWORD=coban_dev_password psql "postgresql://coban:coban_dev_password@127.0.0.1:5433/coban" -c "SELECT COUNT(*) FROM weekly_stats WHERE group_id = 'da000000-0000-0000-0000-000000000004';"

# Expected output: 1107

# Check post count
PGPASSWORD=coban_dev_password psql "postgresql://coban:coban_dev_password@127.0.0.1:5433/coban" -c "SELECT COUNT(*) FROM post p JOIN brand b ON b.curated_brand_id = p.curated_brand_id WHERE b.group_id = 'da000000-0000-0000-0000-000000000004';"

# Expected output: ~10796
```

### 6.3 Reset demo password

```bash
# If you need to reset the demo password
PGPASSWORD=coban_dev_password psql "postgresql://coban:coban_dev_password@127.0.0.1:5433/coban" -c "UPDATE \"user\" SET password_hash = '\$2b\$12\$PP3NCks/kNyxwQ/6nXErLe.ljHKNRA00cgZreg7fUy0W/W75eJ9iy' WHERE email = 'demo@dairyinsights.vn';"
# Sets password to: demo1234
```

---

## 7. Quick SQL Reference

### Check data coverage

```sql
-- Total metrics for a group
SELECT
  COUNT(*) as weekly_rows,
  COUNT(DISTINCT brand_id) as brands,
  MIN(week_start) as first_week,
  MAX(week_start) as last_week,
  ROUND(SUM(total_impressions)::numeric, 0) as total_impressions
FROM weekly_stats
WHERE group_id = 'da000000-0000-0000-0000-000000000004';
```

### Get SOV for 2024

```sql
SELECT
  cb.name,
  ROUND(SUM(ws.total_impressions)::numeric, 0) as impressions,
  ROUND(SUM(ws.total_impressions) / SUM(SUM(ws.total_impressions)) OVER () * 100, 1) as sov_pct
FROM weekly_stats ws
JOIN brand b ON b.id = ws.brand_id
JOIN curated_brand cb ON cb.id = b.curated_brand_id
WHERE ws.group_id = 'da000000-0000-0000-0000-000000000004'
  AND ws.week_start >= '2024-01-01'
GROUP BY cb.name
ORDER BY impressions DESC;
```

### Platform breakdown

```sql
SELECT
  p.platform,
  COUNT(*) as posts,
  ROUND(SUM(p.impressions)::numeric, 0) as impressions,
  ROUND(AVG(CASE WHEN p.impressions > 0 THEN p.reactions::numeric/p.impressions*100 END), 2) as avg_er
FROM post p
JOIN brand b ON b.curated_brand_id = p.curated_brand_id
WHERE b.group_id = 'da000000-0000-0000-0000-000000000004'
GROUP BY p.platform
ORDER BY impressions DESC;
```

---

## 8. Troubleshooting

| Issue | Solution |
|-------|---------|
| Login fails | Verify demo password is `demo1234`. Re-hash if needed using `bcrypt.hashSync('demo1234', 12)` |
| No data in dashboard | Ensure selecting **Vietnamese Dairy Market** client and **Vietnamese Dairy Competitors** group |
| Group not visible | Check `user_client_role` table — user may not have access to this client |
| Missing weekly data | Run `db/seed-dairy.sql` to re-populate weekly_stats |
| brand_activity table empty | This is expected — anomaly detection records are not yet seeded |
| Kido-Group-VN has no data | Intentional — brand exists in group but no weekly_stats were generated |

---

*Document generated by COBAN Data Analyst Agent · 2026-04-11*
