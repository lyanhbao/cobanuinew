/**
 * Re-export all lib utilities for convenient access.
 */

// Domain types
export type {
  AccountType,
  AccountPlan,
  UserRole,
  ClientRole,
  Platform,
  FormatType,
  YtFormat,
  CrawlStatus,
  JobStatus,
  JobType,
  ActivityType,
  AlertLevel,
  ReportStatus,
  AccountId,
  UserId,
  ClientId,
  GroupId,
  BrandId,
  CuratedBrandId,
  CategoryId,
  WeekStart,
  WeekLabel,
  WeekId,
  Account,
  User,
  UserProfile,
  Client,
  Group,
  CuratedBrand,
  Brand,
  BrandAlias,
  Category,
  Post,
  WeeklyStats,
  CrawlJob,
  BrandActivity,
} from './types';

// Result type
export { ok, err, isOk, isErr, map, mapErr, flatMap } from './Result';

// DB utilities
export { query, getClient, transaction, closePool } from './db';
export { UnitOfWork } from './UnitOfWork';

// Formatting
export { formatVietnamNumber, formatCompact, formatPercent, formatCurrency, parseVietnamNumber } from './vietnam-format';
export {
  formatWeek,
  toWeekStart,
  toWeekEnd,
  getCurrentWeekStart,
  getWeekId,
  getWeekRange,
} from './week-format';

// Platform constants
export { PLATFORMS, PLATFORM_LABELS, PLATFORM_COLORS } from './platform';

// Crawl status
export { CRAWL_STATUS_LABELS, CRAWL_STATUS_COLORS, isCrawlActive } from './crawl-status';
