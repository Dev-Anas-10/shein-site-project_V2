import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const pool = new Pool({ max: 2, application_name: 'shein-db-bootstrap' });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.app_state (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const existing = await pool.query('SELECT 1 FROM public.app_state WHERE id = 1');
  if (existing.rowCount) {
    console.log('PostgreSQL application state already exists; keeping it unchanged.');
    process.exitCode = 0;
  } else {
    let siteSettings = {};
    try {
      const fileData = JSON.parse(await readFile(path.join(projectDir, 'data', 'db.json'), 'utf8'));
      siteSettings = fileData.settings || {};
    } catch {
      // Settings are optional on a fresh install. The app fills missing values.
    }

    const initialState = {
      users: [],
      orders: [],
      shipments: [],
      settings: siteSettings,
    };
    await pool.query(
      'INSERT INTO public.app_state (id, state) VALUES (1, $1::jsonb)',
      [JSON.stringify(initialState)]
    );
    console.log('Created an empty PostgreSQL application state.');
  }
} catch (error) {
  console.error('Could not initialize PostgreSQL:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
