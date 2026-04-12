-- COBAN Seed Data — Demo / Development
-- Run: PGPASSWORD=coban_dev_password psql "postgresql://coban:coban_dev_password@127.0.0.1:5433/coban" -f db/seed.sql

BEGIN;

-- ── Curated Brands (platform-wide, ~200 rows) ─────────────────────────────────

INSERT INTO curated_brand (id, name, slug, categories, advertiser, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Vinamilk', 'vinamilk',
   ARRAY['milk','dairy'], 'Vinamilk JSC', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'TH True Milk', 'th-true-milk',
   ARRAY['milk','organic'], 'TH True Milk', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'Nutriboot', 'nutriboot',
   ARRAY['yogurt','probiotic'], 'TH True Milk', 'active'),
  ('44444444-4444-4444-4444-444444444444', 'Kun', 'kun',
   ARRAY['yogurt','dairy'], 'Kun Vietnam', 'active'),
  ('55555555-5555-5555-5555-555555555555', 'Milo', 'milo',
   ARRAY['milk','energy'], 'Nestlé Vietnam', 'active'),
  ('66666666-6666-6666-6666-666666666666', 'Nestlé', 'nestle',
   ARRAY['milk','coffee'], 'Nestlé Vietnam', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Unilever', 'unilever',
   ARRAY['fmcg','personal-care'], 'Unilever Vietnam', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'P&G', 'pg',
   ARRAY['fmcg','personal-care'], 'Procter & Gamble Vietnam', 'active')
ON CONFLICT (name) DO NOTHING;

-- ── Categories ─────────────────────────────────────────────────────────────────

INSERT INTO category (id, name, slug)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Milk', 'milk'),
  ('a2222222-2222-2222-2222-222222222222', 'Yogurt', 'yogurt'),
  ('a3333333-3333-3333-3333-333333333333', 'Energy Drink', 'energy-drink')
ON CONFLICT (slug) DO NOTHING;

-- ── Demo Account + User ─────────────────────────────────────────────────────────
-- Password "demo1234" hashed with bcrypt (12 rounds)
-- Hash generated: bcrypt.hashSync('demo1234', 12)
-- Value below is the actual hash; replace if needed.

INSERT INTO account (id, name, type, plan, billing_email)
VALUES
  ('b1111111-1111-1111-1111-111111111111', 'Demo Agency', 'agency', 'professional',
   'hello@coban.vn')
ON CONFLICT DO NOTHING;

INSERT INTO "user" (id, account_id, email, password_hash, full_name, role)
VALUES
  ('c1111111-1111-1111-1111-111111111111',
   'b1111111-1111-1111-1111-111111111111',
   'demo@coban.vn',
   -- $2a$12$OqG.gp5d8v.N3mHqJqJqJO7tKQ9KqK5K5K5K5K5K5K5K5K5K5K5K: "demo1234"
   '$2a$12$OqG.gp5d8v.N3mHqJqJqJO7tKQ9KqK5K5K5K5K5K5K5K5K5K5K5K',
   'Demo User',
   'agency_owner')
ON CONFLICT (email) DO NOTHING;

-- ── Demo Client ────────────────────────────────────────────────────────────────

INSERT INTO client (id, account_id, name, industry)
VALUES
  ('d1111111-1111-1111-1111-111111111111',
   'b1111111-1111-1111-1111-111111111111',
   'Vinamilk Demo Client',
   'food_beverage')
ON CONFLICT DO NOTHING;

-- ── Demo Group ─────────────────────────────────────────────────────────────────

INSERT INTO "group" (id, client_id, name, benchmark_category_id, crawl_status)
VALUES
  ('e1111111-1111-1111-1111-111111111111',
   'd1111111-1111-1111-1111-111111111111',
   'Vietnamese Dairy & Milk',
   'a1111111-1111-1111-1111-111111111111',
   'ready')
ON CONFLICT DO NOTHING;

-- ── Brands in Group (group-scoped) ─────────────────────────────────────────────

INSERT INTO brand (id, curated_brand_id, group_id, is_primary, source, crawl_status, is_new)
VALUES
  ('f1111111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111', -- Vinamilk
   'e1111111-1111-1111-1111-111111111111',
   true, 'curated', 'ready', false),
  ('f2222222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222', -- TH True Milk
   'e1111111-1111-1111-1111-111111111111',
   false, 'curated', 'ready', false),
  ('f3333333-3333-3333-3333-333333333333',
   '44444444-4444-4444-4444-444444444444', -- Kun
   'e1111111-1111-1111-1111-111111111111',
   false, 'curated', 'ready', false)
ON CONFLICT DO NOTHING;

-- ── Weekly Stats (W15–W22, 2025) ───────────────────────────────────────────────
-- Weeks: W15=Apr 7, W16=Apr 14, W17=Apr 21, W18=Apr 28, W19=May 5, W20=May 12, W21=May 19, W22=May 26
-- Realistic impression ranges for VN FMCG dairy: 100K–600K per week per brand

-- Vinamilk (primary, dominant share ~40-50%)
INSERT INTO weekly_stats
  (brand_id, group_id, year, week_number, week_start, week_end,
   total_posts, total_views, total_impressions, total_reactions,
   avg_engagement_rate, gap_pct, network_breakdown, format_breakdown, is_new)
VALUES
  ('f1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111',
   2025, 15, '2025-04-07', '2025-04-13', 18, 980000, 4100000, 182000, 4.2,  NULL,    '{"youtube": 2400000, "facebook": 1400000, "tiktok": 300000}'::jsonb, '{"Video": 2800000, "Image": 900000, "Short": 400000}'::jsonb, false),
  ('f1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111',
   2025, 16, '2025-04-14', '2025-04-20', 22, 1150000, 4800000, 215000, 4.5,  17.1,  '{"youtube": 2900000, "facebook": 1550000, "tiktok": 350000}'::jsonb, '{"Video": 3300000, "Image": 1000000, "Short": 500000}'::jsonb, false),
  ('f1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111',
   2025, 17, '2025-04-21', '2025-04-27', 20, 1080000, 4500000, 198000, 4.1, -6.3,   '{"youtube": 2700000, "facebook": 1450000, "tiktok": 350000}'::jsonb, '{"Video": 3100000, "Image": 950000, "Short": 450000}'::jsonb, false),
  ('f1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111',
   2025, 18, '2025-04-28', '2025-05-04', 25, 1280000, 5300000, 238000, 4.7,  20.2,  '{"youtube": 3200000, "facebook": 1650000, "tiktok": 450000}'::jsonb, '{"Video": 3600000, "Image": 1100000, "Short": 600000}'::jsonb, false),
  ('f1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111',
   2025, 19, '2025-05-05', '2025-05-11', 24, 1220000, 5100000, 226000, 4.4, -4.7,   '{"youtube": 3050000, "facebook": 1600000, "tiktok": 450000}'::jsonb, '{"Video": 3450000, "Image": 1050000, "Short": 600000}'::jsonb, false),
  ('f1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111',
   2025, 20, '2025-05-12', '2025-05-18', 28, 1380000, 5900000, 267000, 5.0,  18.1,  '{"youtube": 3500000, "facebook": 1850000, "tiktok": 550000}'::jsonb, '{"Video": 4000000, "Image": 1200000, "Short": 700000}'::jsonb, false),
  ('f1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111',
   2025, 21, '2025-05-19', '2025-05-25', 26, 1300000, 5600000, 250000, 4.8, -6.4,   '{"youtube": 3350000, "facebook": 1750000, "tiktok": 500000}'::jsonb, '{"Video": 3800000, "Image": 1150000, "Short": 650000}'::jsonb, false),
  ('f1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111',
   2025, 22, '2025-05-26', '2025-06-01', 30, 1450000, 6300000, 285000, 5.2,  14.0,  '{"youtube": 3750000, "facebook": 1950000, "tiktok": 600000}'::jsonb, '{"Video": 4200000, "Image": 1300000, "Short": 800000}'::jsonb, false);

-- TH True Milk (competitor, ~25-30% share)
INSERT INTO weekly_stats
  (brand_id, group_id, year, week_number, week_start, week_end,
   total_posts, total_views, total_impressions, total_reactions,
   avg_engagement_rate, gap_pct, network_breakdown, format_breakdown, is_new)
VALUES
  ('f2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111',
   2025, 15, '2025-04-07', '2025-04-13', 14, 720000, 2900000, 118000, 3.8,  NULL,    '{"youtube": 1800000, "facebook": 850000, "tiktok": 250000}'::jsonb, '{"Video": 2000000, "Image": 600000, "Short": 300000}'::jsonb, false),
  ('f2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111',
   2025, 16, '2025-04-14', '2025-04-20', 16, 840000, 3400000, 142000, 4.1,  17.2,   '{"youtube": 2100000, "facebook": 980000, "tiktok": 320000}'::jsonb, '{"Video": 2350000, "Image": 700000, "Short": 350000}'::jsonb, false),
  ('f2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111',
   2025, 17, '2025-04-21', '2025-04-27', 15, 790000, 3150000, 130000, 3.9, -8.5,    '{"youtube": 1950000, "facebook": 920000, "tiktok": 305000}'::jsonb, '{"Video": 2200000, "Image": 660000, "Short": 340000}'::jsonb, false),
  ('f2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111',
   2025, 18, '2025-04-28', '2025-05-04', 18, 920000, 3750000, 158000, 4.4,  21.5,   '{"youtube": 2350000, "facebook": 1080000, "tiktok": 320000}'::jsonb, '{"Video": 2600000, "Image": 770000, "Short": 410000}'::jsonb, false),
  ('f2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111',
   2025, 19, '2025-05-05', '2025-05-11', 17, 880000, 3550000, 148000, 4.1, -6.3,    '{"youtube": 2220000, "facebook": 1030000, "tiktok": 310000}'::jsonb, '{"Video": 2450000, "Image": 730000, "Short": 400000}'::jsonb, false),
  ('f2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111',
   2025, 20, '2025-05-12', '2025-05-18', 20, 980000, 4050000, 170000, 4.6,  14.9,   '{"youtube": 2550000, "facebook": 1150000, "tiktok": 350000}'::jsonb, '{"Video": 2800000, "Image": 820000, "Short": 450000}'::jsonb, false),
  ('f2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111',
   2025, 21, '2025-05-19', '2025-05-25', 19, 940000, 3850000, 162000, 4.3, -4.7,    '{"youtube": 2420000, "facebook": 1100000, "tiktok": 340000}'::jsonb, '{"Video": 2680000, "Image": 790000, "Short": 430000}'::jsonb, false),
  ('f2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111',
   2025, 22, '2025-05-26', '2025-06-01', 22, 1050000, 4400000, 185000, 4.8,  14.2,   '{"youtube": 2750000, "facebook": 1220000, "tiktok": 380000}'::jsonb, '{"Video": 3000000, "Image": 880000, "Short": 500000}'::jsonb, false);

-- Kun (niche player, ~15-20% share)
INSERT INTO weekly_stats
  (brand_id, group_id, year, week_number, week_start, week_end,
   total_posts, total_views, total_impressions, total_reactions,
   avg_engagement_rate, gap_pct, network_breakdown, format_breakdown, is_new)
VALUES
  ('f3333333-3333-3333-3333-333333333333', 'e1111111-1111-1111-1111-111111111111',
   2025, 15, '2025-04-07', '2025-04-13', 10, 480000, 1850000, 72000, 3.2,  NULL,    '{"youtube": 950000, "facebook": 620000, "tiktok": 280000}'::jsonb, '{"Video": 1200000, "Image": 450000, "Short": 200000}'::jsonb, false),
  ('f3333333-3333-3333-3333-333333333333', 'e1111111-1111-1111-1111-111111111111',
   2025, 16, '2025-04-14', '2025-04-20', 12, 560000, 2150000, 86000, 3.6,  19.4,   '{"youtube": 1100000, "facebook": 720000, "tiktok": 330000}'::jsonb, '{"Video": 1400000, "Image": 520000, "Short": 240000}'::jsonb, false),
  ('f3333333-3333-3333-3333-333333333333', 'e1111111-1111-1111-1111-111111111111',
   2025, 17, '2025-04-21', '2025-04-27', 11, 530000, 2020000, 80000, 3.4, -7.0,    '{"youtube": 1040000, "facebook": 680000, "tiktok": 300000}'::jsonb, '{"Video": 1320000, "Image": 490000, "Short": 220000}'::jsonb, false),
  ('f3333333-3333-3333-3333-333333333333', 'e1111111-1111-1111-1111-111111111111',
   2025, 18, '2025-04-28', '2025-05-04', 13, 610000, 2400000, 97000, 4.0,  21.3,   '{"youtube": 1220000, "facebook": 780000, "tiktok": 400000}'::jsonb, '{"Video": 1580000, "Image": 570000, "Short": 300000}'::jsonb, false),
  ('f3333333-3333-3333-3333-333333333333', 'e1111111-1111-1111-1111-111111111111',
   2025, 19, '2025-05-05', '2025-05-11', 12, 580000, 2250000, 90000, 3.7, -7.2,    '{"youtube": 1150000, "facebook": 740000, "tiktok": 360000}'::jsonb, '{"Video": 1480000, "Image": 540000, "Short": 280000}'::jsonb, false),
  ('f3333333-3333-3333-3333-333333333333', 'e1111111-1111-1111-1111-111111111111',
   2025, 20, '2025-05-12', '2025-05-18', 15, 680000, 2700000, 108000, 4.3,  20.0,   '{"youtube": 1380000, "facebook": 870000, "tiktok": 450000}'::jsonb, '{"Video": 1780000, "Image": 630000, "Short": 370000}'::jsonb, false),
  ('f3333333-3333-3333-3333-333333333333', 'e1111111-1111-1111-1111-111111111111',
   2025, 21, '2025-05-19', '2025-05-25', 14, 640000, 2520000, 100000, 4.0, -7.4,    '{"youtube": 1280000, "facebook": 820000, "tiktok": 400000}'::jsonb, '{"Video": 1650000, "Image": 590000, "Short": 340000}'::jsonb, false),
  ('f3333333-3333-3333-3333-333333333333', 'e1111111-1111-1111-1111-111111111111',
   2025, 22, '2025-05-26', '2025-06-01', 16, 720000, 2900000, 116000, 4.5,  16.0,   '{"youtube": 1480000, "facebook": 940000, "tiktok": 480000}'::jsonb, '{"Video": 1900000, "Image": 670000, "Short": 420000}'::jsonb, false);

-- ── Weekly Report for the group ─────────────────────────────────────────────────

INSERT INTO weekly_report (group_id, year, week_number, week_start, week_end, total_posts, total_views, total_impressions, total_reactions, status)
VALUES
  ('e1111111-1111-1111-1111-111111111111', 2025, 22, '2025-05-26', '2025-06-01', 68, 3220000, 586000, 24600, 'finalized'),
  ('e1111111-1111-1111-1111-111111111111', 2025, 21, '2025-05-19', '2025-05-25', 59, 2992000, 512000, 21700, 'finalized');

COMMIT;