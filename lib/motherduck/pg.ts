import postgres, { type Sql } from "postgres";

const MD_PG_HOST = process.env.MOTHERDUCK_PG_HOST || "pg.us-east-1-aws.motherduck.com";
const MOTHERDUCK_PG_USERNAME = "ducky";

export type MotherDuckTokenCredentials = {
  token: string;
  cacheKey: string;
  tokenGeneration: string | number;
};

interface CachedEntry {
  sql: Sql;
  tokenGeneration: string | number;
}

const cache = new Map<string, CachedEntry>();

/**
 * Create an uncached MotherDuck Postgres connection from a bearer token.
 */
export function createMotherduckPg(token: string): Sql {
  return postgres({
    host: MD_PG_HOST,
    port: 5432,
    database: "md:",
    username: MOTHERDUCK_PG_USERNAME,
    password: token,
    ssl: true,
  });
}

/**
 * Get or create a cached Postgres connection from explicit token credentials.
 * Recreates the connection when tokenGeneration changes.
 */
export async function getMotherduckPg(
  credentials: MotherDuckTokenCredentials
): Promise<Sql> {
  const existing = cache.get(credentials.cacheKey);
  if (existing && existing.tokenGeneration === credentials.tokenGeneration) {
    return existing.sql;
  }

  // Evict stale entry (token rotated or first call)
  if (existing) {
    existing.sql.end().catch(() => {});
    cache.delete(credentials.cacheKey);
  }

  const sql = createMotherduckPg(credentials.token);

  cache.set(credentials.cacheKey, {
    sql,
    tokenGeneration: credentials.tokenGeneration,
  });

  return sql;
}
