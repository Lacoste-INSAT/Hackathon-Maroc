// ─────────────────────────────────────────────────────────────
// Snap & Sync — SQLite Database (expo-sqlite)
// ─────────────────────────────────────────────────────────────
//
// Initializes the local database and provides a singleton accessor.
// Call `initDatabase()` once in the root layout's useEffect.
// ─────────────────────────────────────────────────────────────

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'snap_sync.db';

let _db: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the singleton database instance.
 * Throws if `initDatabase()` has not been called yet.
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!_db) {
    throw new Error(
      '[database] Database not initialized. Call initDatabase() first.'
    );
  }
  return _db;
}

/**
 * Opens (or creates) the database and runs all DDL migrations.
 * Safe to call multiple times — uses IF NOT EXISTS.
 */
export async function initDatabase(): Promise<void> {
  _db = await SQLite.openDatabaseAsync(DB_NAME);

  // Enable WAL mode for better concurrent read/write performance
  await _db.execAsync('PRAGMA journal_mode = WAL;');

  // Enable foreign keys
  await _db.execAsync('PRAGMA foreign_keys = ON;');

  // ── Sessions ────────────────────────────────────────────
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id           TEXT PRIMARY KEY,
      patient_code TEXT NOT NULL,
      patient_name TEXT,
      doctor_id    TEXT NOT NULL,
      started_at   TEXT NOT NULL,
      ended_at     TEXT,
      status       TEXT DEFAULT 'active'
                   CHECK (status IN ('active', 'completed')),
      synced       INTEGER DEFAULT 0
    );
  `);

  // ── Records ─────────────────────────────────────────────
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS records (
      id                    TEXT PRIMARY KEY,
      session_id            TEXT NOT NULL,
      original_image_path   TEXT NOT NULL,
      compressed_image_path TEXT,
      extracted_data        TEXT,
      overall_confidence    REAL,
      status                TEXT DEFAULT 'pending_sync'
                            CHECK (status IN (
                              'pending_sync',
                              'pending_extraction',
                              'needs_review',
                              'approved'
                            )),
      flagged_reason        TEXT,
      doctor_corrections    TEXT,
      created_at            TEXT NOT NULL,
      synced_at             TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
  `);

  // ── Sync Queue ──────────────────────────────────────────
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id   TEXT NOT NULL,
      action      TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      last_attempt TEXT,
      next_retry_at TEXT,
      status      TEXT DEFAULT 'pending'
                  CHECK (status IN (
                    'pending',
                    'in_progress',
                    'completed',
                    'failed'
                  )),
      FOREIGN KEY (record_id) REFERENCES records(id)
    );
  `);

  // Backward-compatible migration for existing installs.
  try {
    await _db.execAsync(`ALTER TABLE sync_queue ADD COLUMN next_retry_at TEXT;`);
  } catch {
    // Column already exists.
  }

  // ── Patients ────────────────────────────────────────────
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS patients (
      id            TEXT PRIMARY KEY,
      patient_code  TEXT UNIQUE NOT NULL,
      full_name     TEXT NOT NULL,
      date_of_birth TEXT,
      gender        TEXT CHECK (gender IN ('M', 'F', 'Other')),
      synced        INTEGER DEFAULT 0
    );
  `);

  // ── Indexes for common queries ──────────────────────────
  await _db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_records_session
      ON records(session_id);
    CREATE INDEX IF NOT EXISTS idx_records_status
      ON records(status);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status
      ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_patients_code
      ON patients(patient_code);
    CREATE INDEX IF NOT EXISTS idx_sessions_doctor
      ON sessions(doctor_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status
      ON sessions(status);
  `);

  console.log('[database] Initialized successfully');
}

/**
 * Closes the database connection. Call on app termination if needed.
 */
export async function closeDatabase(): Promise<void> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
    console.log('[database] Closed');
  }
}
