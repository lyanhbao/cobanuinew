#!/usr/bin/env python3
"""
COBAN Dairy Demo Data — Seed Script
Parses "total data dairy 12_3 - Competitor (1).csv" and seeds the database.

Run:
  python3 db/seed-dairy.py
  PGPASSWORD=coban_dev_password psql "postgresql://coban:coban_dev_password@127.0.0.1:5433/coban" -f db/seed-dairy.sql

CSV columns:
  Post Date, Profile, Network, Format, Cost, Message,
  "Reactions, Comments & Shares", Link, Messag ID, Views, Duration,
  Advertiser, Brand, Categories, Impression, YT Format
"""

import csv
import re
import sys
import json
import uuid
import math
import subprocess
from datetime import datetime, date
from collections import defaultdict

CSV_PATH = "/Users/lab/Downloads/b_NOYGPFI192h/total data dairy 12_3 - Competitor (1).csv"
OUTPUT_SQL = "/Users/lab/Downloads/b_NOYGPFI192h/db/seed-dairy.sql"

# ─── UUID prefixes (last 12 digits vary) ─────────────────────────────────────
PREFIX = {
    "account":    "da000000-0000-0000-0000-000000000001",
    "user":       "da000000-0000-0000-0000-000000000002",
    "client":     "da000000-0000-0000-0000-000000000003",
    "group":      "da000000-0000-0000-0000-000000000004",
    "category":   "ca000000-0000-0000-0000-000000000001",
}

BRAND_PREFIXES = {
    "FCV":   "db000001-0000-0000-0000-000000000001",
    "IDP":   "db000002-0000-0000-0000-000000000002",
    "Kido":  "db000003-0000-0000-0000-000000000003",
    "TH":    "db000004-0000-0000-0000-000000000004",
    "NTF":   "db000005-0000-0000-0000-000000000005",
    "Nutri": "db000006-0000-0000-0000-000000000006",
    "VitD":  "db000007-0000-0000-0000-000000000007",
    "VPM":   "db000008-0000-0000-0000-000000000008",
    "MCM":   "db000009-0000-0000-0000-000000000009",
    "NA":    "db000010-0000-0000-0000-000000000010",
}

BRAND_COUNTER = 0

def next_uuid(adv: str) -> str:
    """Generate next UUID for a given advertiser using its base prefix."""
    global BRAND_COUNTER
    base = BRAND_PREFIXES.get(adv)
    if base is None:
        base = list(BRAND_PREFIXES.values())[0]
    uid = uuid.UUID(base)
    bytes_arr = bytearray(uid.bytes)
    # Increment the last 4 bytes
    val = int.from_bytes(bytes_arr[-4:], "big") + BRAND_COUNTER
    bytes_arr[-4:] = (val % (2**32)).to_bytes(4, "big")
    BRAND_COUNTER += 1
    return str(uuid.UUID(bytes=bytes(bytes_arr)))


def parse_date(s: str) -> date | None:
    """Parse date like '5/6/2023' or '9/19/2024'"""
    s = s.strip()
    if not s or s in ("NA", ""):
        return None
    for fmt in ("%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d", "%m/%d/%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def parse_num(s: str) -> float | None:
    """Parse Vietnamese number: 3,677,178.00 → 3677178.0"""
    if not s or s.strip() in ("NA", "", "NULL"):
        return None
    s = s.strip().replace("₫", "").replace(",", "").replace(" ", "")
    # Handle VND format like "49,536,800,316" → 49536800316
    try:
        return float(s)
    except ValueError:
        return None


def parse_vnd(s: str) -> float | None:
    """Parse VND cost: '49,536,800,316 ₫' → 49536800316.0"""
    if not s or s.strip() in ("NA", "", "NULL"):
        return None
    s = s.strip().replace("₫", "").replace(",", "").replace(" ", "")
    try:
        return float(s)
    except ValueError:
        return None


def week_start(d: date) -> date:
    """Get Monday of the ISO week for a date."""
    return d - __import__('datetime').timedelta(days=d.weekday())


def iso_year_week(d: date):
    """Get ISO year and week number."""
    return d.isocalendar()[:2]


def network_map(s: str) -> str:
    s = s.upper().strip()
    if "YOUTUBE" in s:
        return "youtube"
    if "TIKTOK" in s:
        return "tiktok"
    if "FACEBOOK" in s:
        return "facebook"
    return s.lower()


# ─── Profile → Advertiser mapping ──────────────────────────────────────────────
PROFILE_ADV = {
    "dutchladyvietnam":            "FCV",
    "chuyện nhà lof":             "IDP",
    "lof_kun":                    "IDP",
    "lof_malto":                  "IDP",
    "lof malto official":         "IDP",
    "lif_kun":                    "IDP",
    "th official channel":        "TH",
    "th official":                 "TH",
    "th true milk":               "TH",
    "th true milk hilo":          "TH",
    "nutifood vietnam":           "NTF",
    "nutifood việt nam":          "NTF",
    "nutifood - chuyên gia dinh dưỡng": "NTF",
    "ngoinhadinhduongnutifood":   "NTF",
    "nutimilk_nutifood":          "NTF",
    "nutricare official":         "Nutri",
    "nutricare - thương hiệu quốc gia dinh dưỡng y học": "Nutri",
    "nutricare - thương hiệu quốc gia dinh dưỡng y học": "Nutri",
    "nuvi world":                 "NTF",
    "vitadairy":                  "VitD",
    "vitadairy - vì con mẹ chọn": "VitD",
    "vpmilk":                    "VPM",
    "mộc châu milk":             "MCM",
    "mocchaumilk_official":       "MCM",
    "dalatmilk":                  "MCM",
    "k u n":                      "IDP",
    "kun":                        "IDP",
    "nuvi world":                 "NTF",
    # Lower-case fallbacks
}
PROFILE_ADV_LOWER = {k.lower(): v for k, v in PROFILE_ADV.items()}

def profile_to_adv(profile: str) -> str:
    p = profile.strip().lower()
    return PROFILE_ADV_LOWER.get(p, "NA")


# ─── Advertiser → curated_brand mapping ──────────────────────────────────────
ADV_CB = {
    "FCV":   "FCV-CP-FrieslandCampina-VN",
    "IDP":   "IDP-Vietnam-Friesland",
    "Kido":  "Kido-Group-VN",
    "TH":    "TH-Milk-Vietnam",
    "NTF":   "Nutifood-VN",
    "Nutri": "Nutricare-VN",
    "VitD":  "VitaDairy-VN",
    "VPM":   "VPMilk-VN",
    "MCM":   "MocChau-Milk",
    "NA":    "Others-NA",
}

ADV_CB_ID = {}  # filled after INSERT
ADV_CB_SLUG = {
    "FCV":   "fcv-frieslandcampina-vn",
    "IDP":   "idp-vietnam-friesland",
    "Kido":  "kido-group-vn",
    "TH":    "th-milk-vietnam",
    "NTF":   "nutifood-vn",
    "Nutri": "nutricare-vn",
    "VitD":  "vitadairy-vn",
    "VPM":   "vpmilk-vn",
    "MCM":   "mocchau-milk",
    "NA":    "others-na",
}
ADV_CB_CATS = {
    "FCV":   ["milk", "yogurt", "dairy"],
    "IDP":   ["milk", "yogurt", "dairy"],
    "Kido":  ["milk", "yogurt", "snack"],
    "TH":    ["milk", "yogurt", "organic"],
    "NTF":   ["milk", "yogurt", "nutrition"],
    "Nutri": ["milk", "nutrition"],
    "VitD":  ["milk", "colostrum"],
    "VPM":   ["milk", "dairy"],
    "MCM":   ["milk", "organic"],
    "NA":    ["dairy"],
}

# ─── Parse CSV ────────────────────────────────────────────────────────────────
print("Parsing CSV...")
rows = []
with open(CSV_PATH, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for i, row in enumerate(reader):
        if i > 0 and i % 2000 == 0:
            print(f"  ... {i} rows")
        rows.append(row)

print(f"Total rows: {len(rows)}")

# ─── Seed curated_brand IDs ──────────────────────────────────────────────────
curated_brand_ids = {}
for adv in ADV_CB:
    slug = ADV_CB_SLUG[adv]
    cb_id = next_uuid(adv)
    curated_brand_ids[adv] = cb_id

print(f"\nCurated brands: {len(curated_brand_ids)}")
for adv, bid in curated_brand_ids.items():
    print(f"  {adv}: {bid} ({ADV_CB[adv]})")

# ─── Build brand rows per group ─────────────────────────────────────────────
# Map: (group_id) → {adv: brand_uuid}
group_brand_ids = {}  # group_id → adv → brand_uuid

# Single demo group
DEMO_GROUP = PREFIX["group"]

group_brand_ids[DEMO_GROUP] = {}
for adv in sorted(curated_brand_ids.keys()):
    cb_id = curated_brand_ids[adv]
    b_id = next_uuid(adv)
    group_brand_ids[DEMO_GROUP][adv] = b_id

print(f"\nGroup brand IDs: {len(group_brand_ids[DEMO_GROUP])}")

# ─── Aggregate posts by brand × week ───────────────────────────────────────
# Structure: stats[adv][year][week] = {...metrics...}
stats = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {
    "posts": 0,
    "views": 0.0,
    "impressions": 0.0,
    "reactions": 0.0,
    "cost": 0.0,
    "network": defaultdict(float),
    "format": defaultdict(float),
})))

# Map: post_id → seen (dedup)
seen_posts = set()
post_rows = []  # (curated_brand_id, platform, post_id, content, posted_at, week_start, format, yt_format, cost, views, impressions, reactions, duration, link, advertiser, profile, brands, categories)
skipped = 0

for i, row in enumerate(rows):
    profile = row.get("Profile", "").strip()
    network = row.get("Network", "").strip()
    post_date_str = row.get("Post Date", "").strip()
    post_id = row.get("Messag ID", "").strip()
    link = row.get("Link", "").strip()
    format_val = row.get("Format", "").strip()
    cost_str = row.get("Cost", "").strip()
    reactions_str = row.get("Reactions, Comments & Shares", "").strip()
    views_str = row.get("Views", "").strip()
    duration_str = row.get("Duration", "").strip()
    advertiser = row.get("Advertiser", "").strip()
    brands_json = row.get("Brand", "").strip()
    categories_json = row.get("Categories", "").strip()
    impressions_str = row.get("Impression", "").strip()
    yt_format = row.get("YT Format", "").strip()

    adv = profile_to_adv(profile)
    if adv == "NA":
        adv = advertiser.strip().upper()
        if adv == "FCV":
            adv = "FCV"
        elif adv in ("IDP",):
            adv = "IDP"
        elif adv in ("TH", "TH TRUE"):
            adv = "TH"
        elif adv in ("NTF", "NUTIFOOD"):
            adv = "NTF"
        elif adv in ("VITADAIRY", "VITADAIRY"):
            adv = "VitD"
        elif adv in ("VPMILK",):
            adv = "VPM"
        elif adv in ("MOC CHAU", "MOC CHÂU"):
            adv = "MCM"
        else:
            adv = "NA"

    if adv not in curated_brand_ids:
        adv = "NA"

    post_date = parse_date(post_date_str)
    if post_date is None:
        skipped += 1
        continue

    # Skip future dates
    if post_date.year > 2025:
        post_date = date(2025, post_date.month if post_date.month <= 12 else 12,
                         min(post_date.day, 28))

    if post_date.year < 2022:
        skipped += 1
        continue

    platform = network_map(network)
    if platform not in ("facebook", "youtube", "tiktok"):
        skipped += 1
        continue

    if not post_id or post_id == "NA":
        post_id = f"gen_{hash(link + str(i)) % 10**12}"
        # Use link hash as pseudo-ID

    week = week_start(post_date)
    year, week_num = iso_year_week(week)
    if year < 2022:
        year = 2022

    cost = parse_vnd(cost_str) or 0.0
    reactions = parse_num(reactions_str) or 0.0
    views = parse_num(views_str) or 0.0
    impressions = parse_num(impressions_str) or 0.0
    duration = int(duration_str) if duration_str.isdigit() else None

    # Determine format
    fmt = format_val.strip()
    if fmt.lower() == "true view":
        fmt = "True view"
    elif fmt.lower() in ("video", ""):
        fmt = "Video"
    elif fmt.lower() == "short":
        fmt = "Short"
    elif fmt.lower() == "image":
        fmt = "Image"
    elif fmt.lower() == "normal":
        fmt = "Normal"
    elif fmt.lower() == "bumper":
        fmt = "Bumper"
    else:
        fmt = "Video"

    # Aggregate into stats
    s = stats[adv][year][week_num]
    s["posts"] += 1
    s["views"] += views
    s["impressions"] += impressions
    s["reactions"] += reactions
    s["cost"] += cost
    s["network"][platform] += impressions
    s["format"][fmt] += impressions

    # Track post data for INSERT
    post_rows.append({
        "curated_brand_id": curated_brand_ids[adv],
        "platform": platform,
        "post_id": post_id[:255],
        "content": row.get("Message", "")[:5000] if row.get("Message") else None,
        "posted_at": post_date,
        "week_start": week,
        "format": fmt,
        "yt_format": yt_format if platform == "youtube" and yt_format else None,
        "cost": cost if cost > 0 else None,
        "views": views if views > 0 else None,
        "impressions": impressions if impressions > 0 else None,
        "reactions": reactions if reactions > 0 else None,
        "duration": duration,
        "link": link[:500] if link else None,
        "advertiser": advertiser or None,
        "profile": profile or None,
        "brands": brands_json,
        "categories": categories_json,
    })

print(f"\nParsed {len(post_rows)} valid posts, skipped {skipped}")
print(f"Stats aggregated across {len(stats)} advertisers")

# ─── Generate SQL ────────────────────────────────────────────────────────────
print(f"\nGenerating SQL to {OUTPUT_SQL}...")

lines = []
indent = "  "

def emit(sql: str):
    lines.append(sql)

def emit_block(*sql_lines: str):
    for s in sql_lines:
        lines.append(indent + s)

emit("-- ============================================================")
emit("-- COBAN Dairy Demo Data Seed")
emit(f"-- Generated: {datetime.now().isoformat()}")
emit(f"-- Source: {CSV_PATH}")
emit(f"-- Posts: {len(post_rows)}, Stats weeks: {sum(len(w) for a in stats.values() for w in a.values())}")
emit("-- ============================================================")
emit("")
emit("BEGIN;")
emit("SET CONSTRAINTS ALL DEFERRED;")
emit("")
emit("-- Reset relevant tables for clean seed")
emit("TRUNCATE weekly_report, weekly_stats, brand_activity, post, brand_alias RESTART IDENTITY CASCADE;")
emit("TRUNCATE brand, crawl_job RESTART IDENTITY CASCADE;")
emit("TRUNCATE \"group\", client, category, \"user\", account, user_client_role RESTART IDENTITY CASCADE;")
emit("-- curated_brand is reference data — do NOT truncate (preserves all curated brands for tests)")
emit("")

# ── curated_brands ────────────────────────────────────────────────────────────
emit("-- ── Curated Brands ───────────────────────────────────────────")
for adv in sorted(curated_brand_ids.keys()):
    cb_id = curated_brand_ids[adv]
    name = ADV_CB[adv]
    slug = ADV_CB_SLUG[adv]
    cats = "ARRAY[" + ", ".join(f"'{c}'" for c in ADV_CB_CATS.get(adv, ["dairy"])) + "]"
    adv_name = adv
    emit(f"INSERT INTO curated_brand (id, name, slug, categories, advertiser, status) VALUES")
    emit(f"  ('{cb_id}', '{name}', '{slug}', {cats}, '{adv_name}', 'active')")
    emit(f"ON CONFLICT (slug) DO NOTHING;")
emit("")

# ── Account / User / Client / Group ─────────────────────────────────────────
emit("-- ── Demo Account + User ────────────────────────────────────────")
DEMO_ACCOUNT = PREFIX["account"]
DEMO_USER = PREFIX["user"]
DEMO_CLIENT = PREFIX["client"]
DEMO_CATEGORY = PREFIX["category"]

# Demo account
emit(f"INSERT INTO account (id, name, type, plan, billing_email)")
emit(f"  VALUES ('{DEMO_ACCOUNT}', 'Dairy Insights Agency', 'agency', 'professional', 'demo@dairyinsights.vn')")
emit(";")

# Demo user — password: "DemoPass123!"
# bcrypt hash for "DemoPass123!" (bcrypt rounds=12)
demo_hash = "$2b$12$PP3NCks/kNyxwQ/6nXErLe.ljHKNRA00cgZreg7fUy0W/W75eJ9iy"
emit(f"INSERT INTO \"user\" (id, account_id, email, password_hash, full_name, role)")
emit(f"  VALUES ('{DEMO_USER}', '{DEMO_ACCOUNT}', 'demo@dairyinsights.vn', '{demo_hash}', 'Dairy Demo User', 'agency_owner')")
emit(";")

# Demo client
emit(f"INSERT INTO client (id, account_id, name, industry)")
emit(f"  VALUES ('{DEMO_CLIENT}', '{DEMO_ACCOUNT}', 'Vietnamese Dairy Market', 'food_beverage')")
emit(";")


# Category for dairy
emit(f"INSERT INTO category (id, name, slug)")
emit(f"  VALUES ('{DEMO_CATEGORY}', 'Dairy & Milk', 'dairy-milk')")
emit(";")

# Demo group
emit(f"INSERT INTO \"group\" (id, client_id, name, benchmark_category_id, crawl_status)")
emit(f"  VALUES ('{DEMO_GROUP}', '{DEMO_CLIENT}', 'Vietnamese Dairy Competitors', '{DEMO_CATEGORY}', 'ready')")
emit(";")
emit("")

# ── Brands in group ──────────────────────────────────────────────────────────
emit("-- ── Brands in Demo Group ────────────────────────────────────")
primary_adv = "FCV"  # Dutch Lady as primary brand
for adv in sorted(curated_brand_ids.keys()):
    cb_id = curated_brand_ids[adv]
    b_id = group_brand_ids[DEMO_GROUP][adv]
    is_primary = (adv == primary_adv)
    emit(f"INSERT INTO brand (id, curated_brand_id, group_id, is_primary, source, crawl_status, is_new)")
    emit(f"  VALUES ('{b_id}', '{cb_id}', '{DEMO_GROUP}', {is_primary}, 'curated', 'ready', false)")
    emit(";")
emit("")

# ── Posts (batched) ──────────────────────────────────────────────────────────
emit(f"-- ── Posts ({len(post_rows)} rows, batched 200) ──────────────────────")
# Sort by week_start for partition efficiency
post_rows.sort(key=lambda r: (r["week_start"], r["platform"]))

BATCH = 200
for batch_start in range(0, len(post_rows), BATCH):
    batch = post_rows[batch_start:batch_start + BATCH]
    emit("-- Batch " + str(batch_start // BATCH + 1))
    emit("INSERT INTO post")
    emit("  (curated_brand_id, platform, post_id, content, posted_at, week_start,")
    emit("   format, yt_format, cost, views, impressions, reactions, duration, link,")
    emit("   advertiser, profile, brands, categories)")
    emit("VALUES")
    rows_sql = []
    for p in batch:
        content = (p["content"] or "").replace("'", "''").replace("\n", " ")[:5000]
        profile = (p["profile"] or "").replace("'", "''")
        advertiser = (p["advertiser"] or "").replace("'", "''")
        link = (p["link"] or "").replace("'", "''")
        brands_raw = p["brands"] or ""
        if brands_raw.startswith("["):
            brands = brands_raw  # already JSON array
        else:
            brands = f'["{brands_raw}"]' if brands_raw else "[]"
        cats_raw = p["categories"] or ""
        if cats_raw.startswith("["):
            categories = cats_raw  # already JSON array
        else:
            categories = f'["{cats_raw}"]' if cats_raw else "[]"
        posted_at = p["posted_at"].strftime("%Y-%m-%d")
        week = p["week_start"].strftime("%Y-%m-%d")
        fmt = p["format"]
        yt_fmt = f"'{p['yt_format']}'" if p["yt_format"] else "NULL"
        cost = f"{p['cost']:.2f}" if p["cost"] else "NULL"
        views = f"{p['views']:.2f}" if p["views"] else "NULL"
        impressions = f"{p['impressions']:.2f}" if p["impressions"] else "NULL"
        reactions = f"{p['reactions']:.2f}" if p["reactions"] else "NULL"
        duration = str(p["duration"]) if p["duration"] else "NULL"

        rows_sql.append(
            f"  ('{p['curated_brand_id']}', '{p['platform']}', '{p['post_id']}',"
            f" '{content}', '{posted_at}', '{week}',"
            f" '{fmt}', {yt_fmt}, {cost}, {views}, {impressions}, {reactions},"
            f" {duration}, '{link}', '{advertiser}', '{profile}', '{brands}', '{categories}')"
        )
    emit(",\n".join(rows_sql) + ";")
emit("")

# ── Weekly Stats ─────────────────────────────────────────────────────────────
emit(f"-- ── Weekly Stats (aggregated from posts) ───────────────────")

# Collect all week keys across all advertisers
all_weeks = set()
for adv, years in stats.items():
    for year, weeks in years.items():
        for week_num in weeks.keys():
            all_weeks.add((year, week_num))

all_weeks_sorted = sorted(all_weeks)

# First week per brand gets NULL gap_pct, subsequent get computed
for adv in sorted(curated_brand_ids.keys()):
    b_id = group_brand_ids[DEMO_GROUP][adv]
    prev_impressions = None
    prev_week = None

    for year, week_num in all_weeks_sorted:
        if year not in stats[adv] or week_num not in stats[adv][year]:
            continue
        s = stats[adv][year][week_num]

        # Compute week_start/end from ISO week
        jan4 = date(year, 1, 4)
        week_mon = jan4 - __import__('datetime').timedelta(days=jan4.weekday()) + __import__('datetime').timedelta(weeks=week_num - 1)
        week_sun = week_mon + __import__('datetime').timedelta(days=6)

        posts = s["posts"]
        views = round(s["views"], 2)
        impressions = round(s["impressions"], 2)
        reactions = round(s["reactions"], 2)
        cost = round(s["cost"], 2)
        eng_rate = round(reactions / views * 100, 2) if views > 0 else 0.0

        # Compute gap_pct vs previous week (using prev impressions for the SAME adv)
        gap_pct = "NULL"
        if prev_impressions is not None and prev_impressions > 0:
            gap_pct = round((impressions - prev_impressions) / prev_impressions * 100, 2)

        net_json = "{" + ",".join(f'"{k}":{v}' for k, v in s["network"].items()) + "}"
        fmt_json = "{" + ",".join(f'"{k}":{v}' for k, v in s["format"].items()) + "}"

        is_new = year <= 2022  # Mark early data as "new" until established

        emit(f"INSERT INTO weekly_stats")
        emit(f"  (brand_id, group_id, year, week_number, week_start, week_end,")
        emit(f"   total_posts, total_views, total_impressions, total_reactions, total_cost,")
        emit(f"   avg_engagement_rate, gap_pct, network_breakdown, format_breakdown, is_new)")
        emit(f"  VALUES")
        emit(f"  ('{b_id}', '{DEMO_GROUP}', {year}, {week_num}, '{week_mon}', '{week_sun}',")
        emit(f"   {posts}, {views}, {impressions}, {reactions}, {cost},")
        emit(f"   {eng_rate}, {gap_pct}, '{net_json}'::jsonb, '{fmt_json}'::jsonb, {is_new})")
        emit(";")

        prev_impressions = impressions
        prev_week = (year, week_num)

    emit("")

# ── Weekly Reports ───────────────────────────────────────────────────────────
emit("-- ── Weekly Reports (last 4 weeks) ─────────────────────────────")
report_weeks = all_weeks_sorted[-4:]
for year, week_num in report_weeks:
    jan4 = date(year, 1, 4)
    week_mon = jan4 - __import__('datetime').timedelta(days=jan4.weekday()) + __import__('datetime').timedelta(weeks=week_num - 1)
    week_sun = week_mon + __import__('datetime').timedelta(days=6)

    total_posts = sum(
        stats[adv][year][week_num]["posts"]
        for adv in curated_brand_ids
        if year in stats[adv] and week_num in stats[adv][year]
    )
    total_views = sum(
        round(stats[adv][year][week_num]["views"], 2)
        for adv in curated_brand_ids
        if year in stats[adv] and week_num in stats[adv][year]
    )
    total_impressions = sum(
        round(stats[adv][year][week_num]["impressions"], 2)
        for adv in curated_brand_ids
        if year in stats[adv] and week_num in stats[adv][year]
    )
    total_reactions = sum(
        round(stats[adv][year][week_num]["reactions"], 2)
        for adv in curated_brand_ids
        if year in stats[adv] and week_num in stats[adv][year]
    )

    emit(f"INSERT INTO weekly_report")
    emit(f"  (group_id, year, week_number, week_start, week_end, total_posts, total_views, total_impressions, total_reactions, status)")
    emit(f"  VALUES ('{DEMO_GROUP}', {year}, {week_num}, '{week_mon}', '{week_sun}', {total_posts}, {total_views}, {total_impressions}, {total_reactions}, 'finalized')")
    emit(";")

emit("")
emit("COMMIT;")
emit("")

# ── Summary ─────────────────────────────────────────────────────────────────
emit("-- ============================================================")
emit("-- SUMMARY")
emit(f"-- Account:  {DEMO_ACCOUNT}")
emit(f"-- User:    {DEMO_USER}  (demo@dairyinsights.vn / DemoPass123!)")
emit(f"-- Client:  {DEMO_CLIENT}")
emit(f"-- Group:   {DEMO_GROUP}")
emit(f"-- Posts:   {len(post_rows)}")
emit(f"-- Weeks:   {len(all_weeks_sorted)}")
emit("-- ============================================================")

# Write output
with open(OUTPUT_SQL, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"SQL written to {OUTPUT_SQL}")
print(f"  Lines: {len(lines)}")
print(f"  Posts: {len(post_rows)}")
print(f"  Weeks: {len(all_weeks_sorted)}")

# ── Run the SQL ──────────────────────────────────────────────────────────────
print("\nRunning SQL against database...")
try:
    result = subprocess.run(
        [
            "psql",
            "postgresql://coban:coban_dev_password@127.0.0.1:5433/coban",
            "-f", OUTPUT_SQL,
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    print(result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout)
    if result.returncode != 0:
        print(f"STDERR: {result.stderr[-2000:]}")
        print(f"❌ SQL failed with code {result.returncode}")
        sys.exit(1)
    else:
        print("✅ Database seeded successfully!")
except FileNotFoundError:
    print("psql not found — skipping auto-execution. Run manually:")
    print(f"  PGPASSWORD=coban_dev_password psql 'postgresql://coban:coban_dev_password@127.0.0.1:5433/coban' -f {OUTPUT_SQL}")
