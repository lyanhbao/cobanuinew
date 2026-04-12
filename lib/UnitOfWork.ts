/**
 * Database transaction coordinator.
 * Provides a consistent interface over pg PoolClient.
 */
import { PoolClient, QueryResultRow } from 'pg';

export interface IUnitOfWork {
  client: PoolClient;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export class UnitOfWork implements IUnitOfWork {
  constructor(public readonly client: PoolClient) {}

  async commit(): Promise<void> {
    await this.client.query('COMMIT');
  }

  async rollback(): Promise<void> {
    await this.client.query('ROLLBACK');
  }

  /** Execute a query within this transaction. */
  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    const result = await this.client.query<T>(sql, params);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  }
}
