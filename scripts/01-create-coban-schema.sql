-- COBAN Platform Database Schema
-- This script creates the complete schema for the COBAN competitive intelligence platform

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create ENUM types
CREATE TYPE user_role AS ENUM (
  'platform_admin',
  'agency_owner',
  'client_admin',
  'client_user',
  'analyst'
);

CREATE TYPE account_type AS ENUM (
  'agency',
  'direct_client',
  'startup'
);

CREATE TYPE group_status AS ENUM (
  'active',
  'paused',
  'archived'
);

CREATE TYPE alert_type AS ENUM (
  'engagement_spike',
  'competitor_post',
  'trend_detected',
  'milestone_reached'
);

-- 3. Core Tables

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  account_type account_type NOT NULL,
  country VARCHAR(2) DEFAULT 'VN',
  timezone VARCHAR(50) DEFAULT 'Asia/Ho_Chi_Minh',
  billing_email VARCHAR(255),
  plan_type VARCHAR(50) DEFAULT 'startup',
  monthly_budget BIGINT DEFAULT 3000000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (integrated with Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role user_role NOT NULL,
  avatar_url VARCHAR(500),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(id, email)
);

-- Brands table
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  facebook_page_id VARCHAR(255),
  youtube_channel_id VARCHAR(255),
  tiktok_account_id VARCHAR(255),
  instagram_handle VARCHAR(255),
  logo_url VARCHAR(500),
  industry VARCHAR(100),
  description TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Competitive Groups (group brands together for comparison)
CREATE TABLE IF NOT EXISTS competitive_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  primary_brand_id UUID REFERENCES brands(id),
  status group_status DEFAULT 'active',
  competitors_count INT DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Competitive Group Members
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES competitive_groups(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  position_in_group INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, brand_id)
);

-- Weekly Metrics (aggregated weekly data)
CREATE TABLE IF NOT EXISTS weekly_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_number INT,
  year INT,
  total_posts INT DEFAULT 0,
  total_impressions BIGINT DEFAULT 0,
  total_interactions BIGINT DEFAULT 0,
  total_shares INT DEFAULT 0,
  total_comments INT DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  ranking_in_group INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(brand_id, week_start)
);

-- Daily Activity Feed
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  activity_type VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  post_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  metric_change INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  group_id UUID REFERENCES competitive_groups(id),
  brand_id UUID REFERENCES brands(id),
  alert_type alert_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Weekly Reports
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES competitive_groups(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  report_data JSONB,
  pdf_url VARCHAR(500),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, week_start)
);

-- User Activity Log
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Indexes for performance
CREATE INDEX idx_users_account_id ON users(account_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_brands_account_id ON brands(account_id);
CREATE INDEX idx_competitive_groups_account_id ON competitive_groups(account_id);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_weekly_metrics_brand_id ON weekly_metrics(brand_id);
CREATE INDEX idx_weekly_metrics_week ON weekly_metrics(week_start, year);
CREATE INDEX idx_activities_brand_id ON activities(brand_id);
CREATE INDEX idx_activities_account_id ON activities(account_id);
CREATE INDEX idx_alerts_account_id ON alerts(account_id);
CREATE INDEX idx_alerts_is_read ON alerts(is_read, account_id);
CREATE INDEX idx_weekly_reports_account_id ON weekly_reports(account_id);
CREATE INDEX idx_weekly_reports_group_id ON weekly_reports(group_id);
CREATE INDEX idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_created_at ON user_activity_logs(created_at);

-- 5. Row Level Security (RLS) Policies
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitive_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Accounts: Users can only see their own account
CREATE POLICY "Users can view their account"
  ON accounts FOR SELECT
  USING (id IN (SELECT account_id FROM users WHERE id = auth.uid()));

-- Users: Users can view members of their account
CREATE POLICY "Users can view account members"
  ON users FOR SELECT
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

-- Brands: Users can view brands in their account
CREATE POLICY "Users can view account brands"
  ON brands FOR SELECT
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

-- Competitive Groups: Users can view their account's groups
CREATE POLICY "Users can view account groups"
  ON competitive_groups FOR SELECT
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

-- Weekly Metrics: Users can view metrics for brands in their account
CREATE POLICY "Users can view account brand metrics"
  ON weekly_metrics FOR SELECT
  USING (brand_id IN (
    SELECT b.id FROM brands b 
    WHERE b.account_id IN (SELECT account_id FROM users WHERE id = auth.uid())
  ));

-- Activities: Users can view activities from their account
CREATE POLICY "Users can view account activities"
  ON activities FOR SELECT
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

-- Alerts: Users can view alerts from their account
CREATE POLICY "Users can view account alerts"
  ON alerts FOR SELECT
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

-- Weekly Reports: Users can view reports from their account
CREATE POLICY "Users can view account reports"
  ON weekly_reports FOR SELECT
  USING (account_id IN (SELECT account_id FROM users WHERE id = auth.uid()));

-- User Activity Logs: Users can view their own activity
CREATE POLICY "Users can view own activity"
  ON user_activity_logs FOR SELECT
  USING (user_id = auth.uid());
