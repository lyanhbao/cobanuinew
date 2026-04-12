/**
 * COBAN Auth — Self-contained JWT + bcrypt auth.
 * No external services (no Supabase).
 * Uses PostgreSQL via lib/db.ts for user/account data.
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// ─── Config ──────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'coban-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS = 12;

// ─── JWT ─────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;     // user_id
  accountId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// ─── Passwords ────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Client-side session management ──────────────────────────────────────────
// Stored in localStorage. Token is sent as Bearer in Authorization header.

const TOKEN_KEY = 'coban_token';
const USER_KEY = 'coban_user';

export interface SessionUser {
  id: string;
  accountId: string;
  email: string;
  fullName: string;
  role: string;
  avatarUrl: string | null;
}

export interface Session {
  user: SessionUser;
  token: string;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  } catch {
    // ignore
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

export function buildAuthHeader(token: string): string {
  return `Bearer ${token}`;
}