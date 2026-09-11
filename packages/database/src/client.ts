// ============================================================
// SOVEREIGN — Database Client
// ============================================================
import pg from 'pg';
import type { PoolConfig, QueryResult, QueryResultRow } from 'pg';

const { Pool } = pg;

export interface DatabaseClient {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  transaction<T>(fn: (client: DatabaseClient) => Promise<T>): Promise<T>;
  end(): Promise<void>;
}

class PgDatabaseClient implements DatabaseClient {
  private pool: pg.Pool;

  constructor(config: PoolConfig) {
    this.pool = new Pool(config);
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async transaction<T>(fn: (client: DatabaseClient) => Promise<T>): Promise<T> {
    const pgClient = await this.pool.connect();
    try {
      await pgClient.query('BEGIN');
      const wrappedClient: DatabaseClient = {
        query: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) =>
          pgClient.query<R>(text, params),
        transaction: () => {
          throw new Error('Nested transactions not supported');
        },
        end: async () => {
          /* no-op for transaction client */
        },
      };
      const result = await fn(wrappedClient);
      await pgClient.query('COMMIT');
      return result;
    } catch (error) {
      await pgClient.query('ROLLBACK');
      throw error;
    } finally {
      pgClient.release();
    }
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}

export function createDatabaseClient(databaseUrl: string): DatabaseClient {
  return new PgDatabaseClient({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}
