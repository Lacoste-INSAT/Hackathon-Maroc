// ─────────────────────────────────────────────────────────────
// Snap & Sync — Shared TypeScript Types
// ─────────────────────────────────────────────────────────────

// ── SQLite Row Types ────────────────────────────────────────

export interface Session {
  id: string;                 // UUID
  patient_code: string;       // e.g. "AHM-924"
  patient_name: string | null;
  doctor_id: string;          // UUID — matches auth.users.id
  started_at: string;         // ISO 8601
  ended_at: string | null;
  status: 'active' | 'completed';
  synced: number;             // 0 = not synced, 1 = synced
}

export interface Record {
  id: string;                        // UUID
  session_id: string;
  original_image_path: string;       // full-res original (always kept)
  compressed_image_path: string | null; // 150-200KB version for upload
  extracted_data: string | null;     // JSON string of ExtractionResult
  overall_confidence: number | null;
  status: RecordStatus;
  flagged_reason: string | null;
  doctor_corrections: string | null; // JSON string
  created_at: string;                // ISO 8601
  synced_at: string | null;
}

export type RecordStatus =
  | 'pending_sync'
  | 'pending_extraction'
  | 'needs_review'
  | 'approved';

// ── Sync Queue ──────────────────────────────────────────────

export interface SyncQueueItem {
  id: number;                 // AUTOINCREMENT
  record_id: string;
  action: SyncAction;
  retry_count: number;
  last_attempt: string | null;
  status: SyncQueueStatus;
}

export type SyncAction = 'upload_image' | 'upsert_session' | 'upsert_record';
export type SyncQueueStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

// ── Patient ─────────────────────────────────────────────────

export interface Patient {
  id: string;                      // UUID
  patient_code: string;            // e.g. "AHM-924"
  full_name: string;
  date_of_birth: string | null;
  gender: 'M' | 'F' | 'Other' | null;
  synced: number;                  // 0 = local-only, 1 = in Supabase
}

// ── Sync Engine ─────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface SyncResult {
  synced: number;
  failed: number;
}

export interface QueueStats {
  pendingCount: number;
  totalSizeKB: number;
}

// ── Network ─────────────────────────────────────────────────

export interface NetworkState {
  isOnline: boolean;
  connectionType: string | null;
}

// ── Constants ────────────────────────────────────────────────

export const COMPRESSION_TARGET_KB = 180;
export const CONFIDENCE_THRESHOLD = 80;

// ── AI Extraction ────────────────────────────────────────────

export interface ExtractionField {
  label: string;
  value: string;
  confidence: number;
}

export interface ExtractionResult {
  fields: ExtractionField[];
  overallConfidence: number;
  predictionScore: number;
  error?: boolean;
}

// ── Clinical Summary ─────────────────────────────────────────

export interface PatientDataPoint {
  id: string; // Unique identifier (e.g. recordId + label)
  value: string;
  confidence: number;
  isVerified: boolean; // True if record status is 'approved'
  dateRecorded: string; // ISO string 
  sessionId: string;
  recordId: string;
}

export interface ProblemNode {
  diagnosis: string;
  medications: PatientDataPoint[];
  symptoms: PatientDataPoint[];
  diagnoses?: PatientDataPoint[];
}

export interface PendingVerificationItem {
  id: string; // Unique identifier
  recordId: string;
  sessionId: string;
  dateRecorded: string;
  originalImagePath: string; 
  fieldLabel: string; // e.g., 'Symptoms', 'Diagnosis', 'Medication'
  fieldValue: string;
  confidence: number;
  overallConfidence: number; 
}

// ── UI Session Record (in-memory, for Zustand store) ─────────

export type UIRecordStatus =
  | 'pending_extraction'
  | 'processing'
  | 'approved'
  | 'needs_review'
  | 'error';

export interface SessionRecord {
  id: string;
  sessionId: string;
  patientId: string;
  patientName: string;
  imageDataUrl: string;
  compressedDataUrl?: string;
  extractedData?: ExtractionResult;
  status: UIRecordStatus;
  createdAt: string;
}

// ── Capture Phase (UI state machine) ─────────────────────────

export type CapturePhase =
  | 'idle'
  | 'qr_scanner'
  | 'viewfinder'
  | 'preview'
  | 'saved';

// ── History ──────────────────────────────────────────────────

export type HistoryStatus = 'autocaptured' | 'assisted-capture' | 'ai-verified' | 'queue-reviewed' | 'pending-sync';

export interface HistoryEntry {
  id: string;
  patient: string;
  patientId: string;
  time: string;
  notesCount: number;
  status: HistoryStatus;
  confidence: number;
}

// ── AI Chat ──────────────────────────────────────────────────

export interface AIConversation {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: 'doctor' | 'assistant';
  content: string;
  source_record_ids: string[];
  model: string | null;
  latency_ms: number | null;
  created_at: string;
}

export interface AIChatResponse {
  conversation_id: string;
  assistant_message: {
    id: string;
    content: string;
    source_record_ids: string[];
    created_at: string;
  };
}
