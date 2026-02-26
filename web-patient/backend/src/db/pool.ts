// ─────────────────────────────────────────────────────────────
// TabibNet — PostgreSQL Connection Pool
// ─────────────────────────────────────────────────────────────

import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

/**
 * Run the initial migration to create tables (idempotent).
 */
export async function initDb(): Promise<void> {
  const migrationPath = path.join(__dirname, 'migrations', '001_initial.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  await pool.query(sql);
  console.log('[DB] ✅ Migrations applied');
}

/**
 * Execute a parameterized query.
 */
export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

/**
 * Get a client from the pool (for transactions).
 */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}
