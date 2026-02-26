// ─────────────────────────────────────────────────────────────
// TabibNet — Standalone migration runner
// ─────────────────────────────────────────────────────────────

import { initDb, pool } from './pool';

async function migrate() {
  try {
    await initDb();
    console.log('[Migrate] ✅ Done!');
  } catch (err) {
    console.error('[Migrate] ❌ Error:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

migrate();
