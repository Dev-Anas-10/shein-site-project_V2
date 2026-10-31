import { Pool } from 'pg';

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.PGHOST || process.env.PGDATABASE);
}

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || undefined,
      host: process.env.PGHOST || '127.0.0.1',
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      max: Number(process.env.PGPOOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: 'shein-concierge-nextjs',
    });
  }
  return pool;
}

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(`
        CREATE TABLE IF NOT EXISTS public.app_state (
          id SMALLINT PRIMARY KEY CHECK (id = 1),
          state JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  await schemaReady;
}

export async function readPostgresState(): Promise<unknown | null> {
  await ensureSchema();
  const result = await getPool().query<{ state: unknown }>(
    'SELECT state FROM public.app_state WHERE id = 1'
  );
  return result.rows[0]?.state ?? null;
}

export async function writePostgresState(state: unknown): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO public.app_state (id, state, updated_at)
     VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
    [JSON.stringify(state)]
  );
}

