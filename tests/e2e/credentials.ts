/**
 * Shared credentials store — written by auth.spec.ts, read by dashboard.spec.ts.
 * File path is relative to the project root.
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';

const CRED_FILE = '.test-credentials.json';

export interface TestCredentials {
  email: string;
  password: string;
  accountName: string;
}

export function saveCredentials(cred: TestCredentials) {
  writeFileSync(CRED_FILE, JSON.stringify(cred, null, 2));
}

export function loadCredentials(): TestCredentials | null {
  if (!existsSync(CRED_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CRED_FILE, 'utf-8')) as TestCredentials;
  } catch {
    return null;
  }
}
