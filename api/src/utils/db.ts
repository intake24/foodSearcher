import { Client } from 'pg';
import 'dotenv/config';

export type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

export function getDbConfigFromEnv(): DbConfig {
  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
  };
}

export function createClient(cfg?: Partial<DbConfig>): Client {
  const base = getDbConfigFromEnv();
  const merged: DbConfig = { ...base, ...(cfg || {}) } as DbConfig;
  return new Client({
    host: merged.host,
    port: merged.port,
    user: merged.user,
    password: merged.password,
    database: merged.database,
  });
}

let sharedClient: Client | null = null;

export async function getClient(): Promise<Client> {
  if (sharedClient) return sharedClient;
  sharedClient = createClient();
  await sharedClient.connect();
  return sharedClient;
}

export async function connectNewClient(
  cfg?: Partial<DbConfig>
): Promise<Client> {
  const client = createClient(cfg);
  await client.connect();
  return client;
}

export async function closeSharedClient(): Promise<void> {
  if (sharedClient) {
    await sharedClient.end().catch(() => {});
    sharedClient = null;
  }
}

export async function ensureEmbeddingColumn(
  client: Client,
  table: string,
  column: string,
  dim: number
) {
  const checkRes = await client.query(
    `SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type
     FROM pg_attribute a
     JOIN pg_class c ON a.attrelid = c.oid
     JOIN pg_namespace n ON c.relnamespace = n.oid
     WHERE c.relname = $1 AND a.attname = $2 AND a.attnum > 0 AND NOT a.attisdropped`,
    [table, column]
  );
  if (checkRes.rowCount === 0) {
    await client.query(
      `ALTER TABLE ${table} ADD COLUMN ${column} vector(${dim});`
    );
    console.log(`Added column ${column} vector(${dim}) on table ${table}`);
    return;
  }
  const type = checkRes.rows[0].type;
  const m = /^vector\((\d+)\)$/i.exec(type ?? '');
  if (!m) {
    throw new Error(
      `Column ${column} exists with incompatible type "${type}".`
    );
  }
  const existing = Number(m[1]);
  if (existing !== dim) {
    throw new Error(
      `Column ${column} has dimension ${existing} but model produces ${dim}. Drop/recreate the column or adjust EMBEDDING_MODEL.`
    );
  }
  console.log(`Column ${column} already exists with vector(${existing}).`);
}
