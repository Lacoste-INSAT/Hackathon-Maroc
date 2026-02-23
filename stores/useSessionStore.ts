"use client"

import { create } from "zustand"
import type {
  SessionRecord,
  ExtractionResult,
  CapturePhase,
  HistoryEntry,
} from "@/lib/types"
import { CONFIDENCE_THRESHOLD } from "@/lib/types"
const initialHistory: HistoryEntry[] = [];

// ─── Types ───────────────────────────────────────────────────

interface PendingNotification {
  record: SessionRecord
  result: ExtractionResult
}

interface SessionState {
  // ── Connection ──
  isOnline: boolean

  // ── Session ──
  hasActiveSession: boolean
  currentPatientId: string | null
  sessionTime: number
  capturedCount: number

  // ── Capture UI ──
  capturePhase: CapturePhase
  capturedImageUrl: string | null

  // ── Records (in-memory for this session) ──
  records: SessionRecord[]

  // ── Notification (low-confidence AI result) ──
  pendingNotification: PendingNotification | null

  // ── Offline queue count ──
  offlineQueueCount: number

  // ── History ──
  history: HistoryEntry[]
}

interface SessionActions {
  // ── Connection ──
  toggleOnline: () => void
  setOnline: (online: boolean) => void

  // ── Session lifecycle ──
  startSession: (patientId: string) => void
  endSession: () => void
  tickTimer: () => void

  // ── Capture flow ──
  setCapturePhase: (phase: CapturePhase) => void
  setCapturedImage: (url: string | null) => void

  // ── The Optimistic Flow ──
  confirmCapture: () => void

  // ── AI result handlers (called from background) ──
  handleAIResult: (recordId: string, result: ExtractionResult) => void
  handleAIError: (recordId: string) => void

  // ── Notification ──
  dismissNotification: () => void

  // ── Record review ──
  approveRecord: (recordId: string, editedFields?: Record<string, string>) => void
}

export type SessionStore = SessionState & SessionActions

// ─── Store ───────────────────────────────────────────────────

export const useSessionStore = create<SessionStore>((set, get) => ({
  // ── Initial state ──
  isOnline: true,
  hasActiveSession: false,
  currentPatientId: null,
  sessionTime: 0,
  capturedCount: 0,
  capturePhase: "idle",
  capturedImageUrl: null,
  records: [],
  pendingNotification: null,
  offlineQueueCount: 0,
  history: [...initialHistory],

  // ── Connection ──
  toggleOnline: () => set((s) => ({ isOnline: !s.isOnline })),
  setOnline: (online) => set({ isOnline: online }),

  // ── Session lifecycle ──
  startSession: (patientId) =>
    set({
      hasActiveSession: true,
      currentPatientId: patientId,
      sessionTime: 0,
      capturedCount: 0,
      capturePhase: "idle",
      capturedImageUrl: null,
      records: [],
      pendingNotification: null,
    }),

  endSession: () =>
    set({
      hasActiveSession: false,
      currentPatientId: null,
      sessionTime: 0,
      capturedCount: 0,
      capturePhase: "idle",
      capturedImageUrl: null,
      pendingNotification: null,
    }),

  tickTimer: () => set((s) => ({ sessionTime: s.sessionTime + 1 })),

  // ── Capture flow ──
  setCapturePhase: (phase) => set({ capturePhase: phase }),
  setCapturedImage: (url) => set({ capturedImageUrl: url }),

  // ── The Optimistic Flow ──
  // Doctor hits "Confirm" → instant success state, fire AI in background
  confirmCapture: () => {
    const state = get()
    const { isOnline, currentPatientId, capturedImageUrl } = state

    if (!capturedImageUrl || !currentPatientId) return

    const recordId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const sessionId = `ses_${currentPatientId}`

    const newRecord: SessionRecord = {
      id: recordId,
      sessionId,
      patientId: currentPatientId,
      patientName: `Patient [${currentPatientId}]`,
      imageDataUrl: capturedImageUrl,
      status: isOnline ? "pending_extraction" : "pending_extraction",
      createdAt: new Date().toISOString(),
    }

    if (isOnline) {
      // ✅ OPTIMISTIC: Instantly show "Saved!" and go back to session
      set((s) => ({
        records: [...s.records, newRecord],
        capturedCount: s.capturedCount + 1,
        capturePhase: "saved",
        capturedImageUrl: null,
      }))

      // Reset to idle after the "Saved!" flash
      setTimeout(() => {
        set({ capturePhase: "idle" })
      }, 1800)

      // 🔥 Fire AI in background
      fireBackgroundExtraction(recordId, capturedImageUrl, set, get)
    } else {
      // Offline: save to queue
      set((s) => ({
        records: [...s.records, newRecord],
        capturedCount: s.capturedCount + 1,
        offlineQueueCount: s.offlineQueueCount + 1,
        capturePhase: "idle",
        capturedImageUrl: null,
      }))
    }
  },

  // ── AI Result Handlers ──
  handleAIResult: (recordId, result) => {
    const state = get()
    const isAutoApproved = result.overallConfidence >= CONFIDENCE_THRESHOLD

    // Update the record
    set((s) => ({
      records: s.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              extractedData: result,
              status: isAutoApproved ? "approved" : "needs_review",
            }
          : r
      ),
    }))

    if (isAutoApproved) {
      // Auto-approve: add to history silently
      const record = state.records.find((r) => r.id === recordId)
      if (record) {
        const entry: HistoryEntry = {
          id: Date.now().toString(),
          patient: record.patientName,
          patientId: record.patientId,
          time: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
          notesCount: 1,
          status: "ai-realtime",
          confidence: result.overallConfidence,
        }
        set((s) => ({ history: [entry, ...s.history] }))
      }
    } else {
      // Needs review: show notification
      const record = get().records.find((r) => r.id === recordId)
      if (record) {
        set({
          pendingNotification: {
            record: { ...record, extractedData: result, status: "needs_review" },
            result,
          },
        })
      }
    }
  },

  handleAIError: (recordId) => {
    set((s) => ({
      records: s.records.map((r) =>
        r.id === recordId ? { ...r, status: "error" } : r
      ),
      offlineQueueCount: s.offlineQueueCount + 1,
    }))
  },

  // ── Notification ──
  dismissNotification: () => set({ pendingNotification: null }),

  // ── Record review ──
  approveRecord: (recordId, editedFields) => {
    const state = get()
    const record = state.records.find((r) => r.id === recordId)

    set((s) => ({
      records: s.records.map((r) =>
        r.id === recordId ? { ...r, status: "approved" } : r
      ),
      pendingNotification:
        s.pendingNotification?.record.id === recordId
          ? null
          : s.pendingNotification,
    }))

    // Add to history
    if (record) {
      const entry: HistoryEntry = {
        id: Date.now().toString(),
        patient: record.patientName,
        patientId: record.patientId,
        time: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        notesCount: 1,
        status: "doctor-reviewed",
        confidence: record.extractedData?.overallConfidence ?? 0,
      }
      set((s) => ({ history: [entry, ...s.history] }))
    }
  },
}))

// ─── Background AI Worker ────────────────────────────────────
// This runs in the background after the doctor has already moved on.

async function fireBackgroundExtraction(
  recordId: string,
  imageDataUrl: string,
  set: (fn: (s: SessionState) => Partial<SessionState>) => void,
  get: () => SessionStore
) {
  try {
    // Mark as processing
    set((s) => ({
      records: s.records.map((r) =>
        r.id === recordId ? { ...r, status: "processing" } : r
      ),
    }))

    // Compress first
    // This was an optimistic hook for web prototypes.
    // In React Native, background sync handles the real AI extraction workflow.
    const result: ExtractionResult = {
      overallConfidence: 95,
      predictionScore: 90,
      fields: []
    }

    // Handle the result
    get().handleAIResult(recordId, result)
  } catch {
    get().handleAIError(recordId)
  }
}
