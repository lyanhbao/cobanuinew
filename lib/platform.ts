/**
 * Platform constants for Facebook, YouTube, and TikTok.
 */

import type { Platform } from './types';

export const PLATFORMS: Platform[] = ['facebook', 'youtube', 'tiktok'] as const;

export const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
} as const;

export const PLATFORM_COLORS: Record<Platform, string> = {
  facebook: '#1877F2',
  youtube: '#FF0000',
  tiktok: '#000000',
} as const;

/** Lucide icon names for each platform. */
export const PLATFORM_ICONS: Record<Platform, string> = {
  facebook: 'Facebook',
  youtube: 'Youtube',
  tiktok: 'MusicalNotes',
} as const;
