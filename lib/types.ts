/**
 * Shared domain types for COBAN platform.
 * These are used across application and lib layers.
 */

import { Result } from './Result';

// ─── Enums (mirrors PostgreSQL ENUM types) ───────────────────────────────────

export type AccountType = 'agency' | 'direct_client';
export type AccountPlan = 'startup' | 'professional' | 'enterprise';
export type UserRole =
  | 'platform_admin'
  | 'agency_owner'
  | 'agency_admin'
  | 'agency_user'
  | 'client_admin'
  | 'client_user';
export type ClientRole = 'admin' | 'analyst' | 'viewer';
export type Platform = 'facebook' | 'youtube' | 'tiktok';
export type FormatType =
  | 'Image'
  | 'Video'
  | 'True view'
  | 'Bumper'
  | 'Short'
  | 'Story'
  | 'Carousel';
export type YtFormat = 'Short' | 'Normal';
export type CrawlStatus = 'pending' | 'crawling' | 'ready' | 'error';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type JobType = 'initial' | 'weekly' | 'delta' | 'manual';
export type ActivityType =
  | 'viral'
  | 'reengaged'
  | 'anomaly'
  | 'new_post';
export type AlertLevel = 'info' | 'warning' | 'critical';
export type ReportStatus = 'pending' | 'generating' | 'finalized' | 'failed';

// ─── IDs ──────────────────────────────────────────────────────────────────────

export type AccountId = string; // UUID
export type UserId = string; // UUID
export type ClientId = string; // UUID
export type GroupId = string; // UUID
export type BrandId = string; // UUID
export type CuratedBrandId = string; // UUID
export type CategoryId = string; // UUID

// ─── Week identifier ──────────────────────────────────────────────────────────

/** ISO date string (YYYY-MM-DD) pointing to the Monday of the week. */
export type WeekStart = string; // e.g. "2025-04-07"

/** Human-readable week label, e.g. "W13 (12 Apr – 18 Apr, 2025)". */
export type WeekLabel = string;

export interface WeekId {
  weekStart: WeekStart; // e.g. "2025-04-07"
  weekNumber: number; // 1-53
  year: number;
}

// ─── Re-export formatters (moved to dedicated files) ──────────────────────────

// Week formatting — see lib/week-format.ts
export { isoWeekNumber, toWeekStart, toWeekEnd, getCurrentWeekStart, formatWeek, weekLabel, getWeekId, getWeekRange } from './week-format';

// Vietnam number formatting — see src/lib/vietnam-format.ts
export { formatVietnamNumber, formatCompact, formatPercent, formatCurrency, parseVietnamNumber } from './vietnam-format';

// ─── Entity shapes ─────────────────────────────────────────────────────────────

export interface Account {
  id: AccountId;
  name: string;
  type: AccountType;
  plan: AccountPlan;
  max_users: number;
  max_clients: number;
  country: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: UserId;
  account_id: AccountId;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: UserId;
  account_id: AccountId;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
}

export interface Client {
  id: ClientId;
  account_id: AccountId;
  name: string;
  industry: string | null;
  country: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: GroupId;
  client_id: ClientId;
  name: string;
  benchmark_category_id: CategoryId | null;
  is_active: boolean;
  created_by: UserId | null;
  created_at: string;
  updated_at: string;
}

export interface CuratedBrand {
  id: CuratedBrandId;
  name: string;
  slug: string;
  advertiser: string | null;
  categories: string[];
  social_handles: Record<string, string>;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: BrandId;
  curated_brand_id: CuratedBrandId;
  group_id: GroupId;
  is_primary: boolean;
  crawl_status: CrawlStatus;
  crawl_source: 'csv' | 'api' | 'manual';
  first_crawl_at: string | null;
  last_crawl_at: string | null;
  added_at: string;
  created_at: string;
  updated_at: string;
}

export interface BrandAlias {
  id: string;
  curated_brand_id: CuratedBrandId;
  alias: string;
  alias_type: 'exact' | 'fuzzy' | 'advertiser';
  created_at: string;
}

export interface Category {
  id: CategoryId;
  parent_id: CategoryId | null;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
}

export interface Post {
  id: string;
  curated_brand_id: CuratedBrandId;
  platform: Platform;
  post_id: string;
  profile: string | null;
  content: string | null;
  posted_at: string;
  week_start: WeekStart;
  week_number: number;
  year: number;
  format: FormatType | null;
  yt_format: YtFormat | null;
  cost: number;
  views: bigint;
  impressions: bigint;
  reactions: bigint;
  comments: bigint;
  shares: bigint;
  duration: number | null;
  link: string | null;
  advertiser: string | null;
  categories: string[];
  raw_categories: string[];
  updated_at: string;
  created_at: string;
}

export interface WeeklyStats {
  id: string;
  group_id: GroupId;
  brand_id: BrandId;
  week_start: WeekStart;
  week_number: number;
  year: number;
  total_posts: number;
  total_views: bigint;
  total_impressions: bigint;
  total_reactions: bigint;
  total_comments: bigint;
  total_shares: bigint;
  total_cost: number;
  avg_engagement_rate: number;
  sov_impressions_pct: number | null;
  sov_views_pct: number | null;
  sov_reactions_pct: number | null;
  sov_posts_pct: number | null;
  gap_pct: number | null;
  network_breakdown: Record<string, unknown>;
  format_breakdown: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CrawlJob {
  id: string;
  group_id: GroupId;
  brand_id: BrandId | null;
  job_type: JobType;
  status: JobStatus;
  crawl_from: string | null;
  crawl_to: string | null;
  posts_total: number;
  posts_created: number;
  posts_updated: number;
  posts_failed: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface BrandActivity {
  id: string;
  brand_id: BrandId;
  post_platform: Platform | null;
  post_id: string | null;
  activity_type: ActivityType;
  alert_level: AlertLevel;
  title: string | null;
  description: string | null;
  metric_value: bigint | null;
  metric_prev: bigint | null;
  gap_pct: number | null;
  week_start: WeekStart;
  year: number;
  created_at: string;
}