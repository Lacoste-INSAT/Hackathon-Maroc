// ─────────────────────────────────────────────────────────────
// Snap & Sync — Session Repository (SQLite CRUD)
// ─────────────────────────────────────────────────────────────

import { getDatabase } from './database';
import type { Session } from '@/lib/types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a new session for a patient and returns its UUID.
 */
export async function createSession(
  patientCode: string,
  patientName: string | null,
  doctorId: string
): Promise<string> {
  const db = getDatabase();
  const id = uuidv4();
  const startedAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO sessions (id, patient_code, patient_name, doctor_id, started_at, status, synced)
     VALUES (?, ?, ?, ?, ?, 'active', 0)`,
    [id, patientCode, patientName, doctorId, startedAt]
  );

  return id;
}

/**
 * Returns the currently active session, or null if none.
 */
export async function getActiveSession(): Promise<Session | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<Session>(
    `SELECT * FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`,
    []
  );
  return row ?? null;
}

/**
 * Ends a session by setting ended_at and status to 'completed'.
 */
export async function endSession(sessionId: string): Promise<void> {
  const db = getDatabase();
  const endedAt = new Date().toISOString();

  await db.runAsync(
    `UPDATE sessions SET ended_at = ?, status = 'completed' WHERE id = ?`,
    [endedAt, sessionId]
  );
}

/**
 * Returns all sessions for a given date string (YYYY-MM-DD).
 * Matches sessions whose started_at begins with the date prefix.
 */
export async function getSessionsByDate(dateStr: string): Promise<Session[]> {
  const db = getDatabase();
  return db.getAllAsync<Session>(
    `SELECT * FROM sessions WHERE started_at LIKE ? ORDER BY started_at DESC`,
    [`${dateStr}%`]
  );
}

/**
 * Marks a session as synced to cloud.
 */
export async function markSessionSynced(sessionId: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE sessions SET synced = 1 WHERE id = ?`,
    [sessionId]
  );
}

/**
 * Returns all sessions that have not been synced yet.
 */
export async function getUnsyncedSessions(): Promise<Session[]> {
  const db = getDatabase();
  return db.getAllAsync<Session>(
    `SELECT * FROM sessions WHERE synced = 0 ORDER BY started_at ASC`,
    []
  );
}

/**
 * Gets a session by ID.
 */
export async function getSessionById(sessionId: string): Promise<Session | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<Session>(
    `SELECT * FROM sessions WHERE id = ?`,
    [sessionId]
  );
  return row ?? null;
}
