// ─────────────────────────────────────────────────────────────
// Snap & Sync — Database Wiping Utility
// Use this once to wipe out the whole DB and recreate correctly.
// ─────────────────────────────────────────────────────────────

import * as SQLite from 'expo-sqlite';
import { getDatabase, initDatabase } from './database';

export async function nukeAndRebuildDatabase() {
  console.warn('💣 [database] NUKING ENTIRE DATABASE 💣');
  try {
    const db = getDatabase();
    
    // Drop all tables
    await db.execAsync(`
      DROP TABLE IF EXISTS sync_queue;
      DROP TABLE IF EXISTS records;
      DROP TABLE IF EXISTS sessions;
      DROP TABLE IF EXISTS patients;
    `);
    
    console.log('✅ [database] Tables dropped successfully');
    
    // Re-initialize tables
    await initDatabase();
    console.log('✅ [database] Tables rebuilt from scratch.');
    
  } catch (err) {
    console.error('❌ [database] Failed while nuking DB:', err);
  }
}
