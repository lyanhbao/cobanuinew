/**
 * PostgreSQL connection pool via node-postgres (pg).
 * Uses DATABASE_URL environment variable.
 */
import { Pool as PgPool, PoolClient, QueryResult, QueryResultRow } from 'pg';

const _pool = new PgPool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Log connection events in development
if (process.env.NODE_ENV !== 'production') {
  _pool.on('connect', () => console.log('[db] client connected'));
  _pool.on('error', (err) => console.error('[db] pool error:', err));
}

/** Execute a raw SQL query with parameters. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return _pool.query<T>(sql, params);
}

/** Get a client for a transaction. Always use with try/finally. */
export async function getClient(): Promise<PoolClient> {
  return _pool.connect();
}

/** Run a transaction block. Auto-commits on success, auto-rollbacks on throw. */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await _pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Close the pool — call once at shutdown. */
export async function closePool(): Promise<void> {
  await _pool.end();
}

// Re-export pg types that are used throughout the codebase.
// Using `export type` to satisfy isolatedModules.
export type { PoolClient };
// Note: Pool is used internally via _pool; it is not re-exported to avoid
// a circular import path through @types/pg. Import Pool directly from 'pg' where needed.
