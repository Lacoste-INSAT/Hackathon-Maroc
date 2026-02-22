// ─────────────────────────────────────────────────────────────
// Snap & Sync — Patient Service
// ─────────────────────────────────────────────────────────────
//
// Patient lookup and registration with online/offline awareness.
//   Online → query Supabase, cache locally
//   Offline → query local SQLite
// ─────────────────────────────────────────────────────────────

import { supabase } from '@/lib/supabase';
import { getDatabase } from './database';
import type { Patient } from '@/lib/types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

/**
 * Looks up a patient by their patient code (e.g. "AHM-924").
 *
 * - Online: queries Supabase first, caches result locally
 * - Offline: falls back to local SQLite cache
 *
 * @returns Patient or null if not found anywhere
 */
export async function lookupPatient(
  code: string,
  isOnline: boolean
): Promise<Patient | null> {
  if (isOnline) {
    return lookupPatientOnline(code);
  }
  return lookupPatientLocal(code);
}

/**
 * Queries Supabase for a patient by code.
 * If found, caches it locally for offline access.
 */
async function lookupPatientOnline(code: string): Promise<Patient | null> {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('id, patient_code, full_name, date_of_birth, gender')
      .eq('patient_code', code)
      .single();

    if (error || !data) {
      // Not found in cloud — check local cache as fallback
      console.log(`[patientService] Not found in cloud: ${code}, checking local`);
      return lookupPatientLocal(code);
    }

    // Map cloud row to local Patient type
    const patient: Patient = {
      id: data.id,
      patient_code: data.patient_code,
      full_name: data.full_name,
      date_of_birth: data.date_of_birth ?? null,
      gender: data.gender ?? null,
      synced: 1,
    };

    // Cache locally for offline access
    await cachePatientLocally(patient);

    return patient;

  } catch (error) {
    console.error('[patientService] Online lookup failed:', error);
    // Graceful degradation — try local cache
    return lookupPatientLocal(code);
  }
}

/**
 * Queries local SQLite for a cached patient by code.
 */
async function lookupPatientLocal(code: string): Promise<Patient | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<Patient>(
    'SELECT * FROM patients WHERE patient_code = ?',
    [code]
  );
  return row ?? null;
}

/**
 * Inserts or updates a patient in the local SQLite cache.
 * Uses INSERT OR REPLACE to handle upserts cleanly.
 */
export async function cachePatientLocally(patient: Patient): Promise<void> {
  const db = getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO patients
       (id, patient_code, full_name, date_of_birth, gender, synced)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      patient.id,
      patient.patient_code,
      patient.full_name,
      patient.date_of_birth,
      patient.gender,
      patient.synced,
    ]
  );
}

/**
 * Registers a new patient in both Supabase (cloud) and local SQLite.
 *
 * If the cloud insert fails (e.g. offline), the patient is saved
 * locally with synced=0 and will be synced later.
 *
 * @returns The newly created Patient
 */
export async function registerPatient(
  code: string,
  name: string,
  dob: string | null,
  gender: 'M' | 'F' | 'Other' | null,
  clinicId: string | null
): Promise<Patient> {
  const id = uuidv4();

  const patient: Patient = {
    id,
    patient_code: code,
    full_name: name,
    date_of_birth: dob,
    gender,
    synced: 0,
  };

  // Try cloud first
  try {
    const { error } = await supabase
      .from('patients')
      .insert({
        id,
        patient_code: code,
        full_name: name,
        date_of_birth: dob,
        gender,
        clinic_id: clinicId,
      });

    if (error) {
      console.error('[patientService] Cloud insert failed:', error.message);
      // Patient will be synced later — keep synced=0
    } else {
      patient.synced = 1;
    }

  } catch (error) {
    console.error('[patientService] Cloud insert error:', error);
    // Offline — save locally only
  }

  // Always cache locally
  await cachePatientLocally(patient);

  return patient;
}

/**
 * Returns all locally cached patients that haven't been synced.
 * Used by the sync worker to push local-only patients to cloud.
 */
export async function getUnsyncedPatients(): Promise<Patient[]> {
  const db = getDatabase();
  return db.getAllAsync<Patient>(
    'SELECT * FROM patients WHERE synced = 0 ORDER BY full_name ASC'
  );
}
