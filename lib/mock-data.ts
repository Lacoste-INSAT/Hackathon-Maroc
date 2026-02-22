// Mock data for the Snap & Sync app

export interface ExtractedField {
  label: string
  value: string
  confidence: number
}

export interface PatientRecord {
  id: number
  patient: string
  patientId: string
  date: string
  overallConfidence: number
  predictionScore: number
  scanImage: string
  extractedFields: ExtractedField[]
  reason: string
  status: "needs-review" | "approved" | "queued"
  syncedAt?: string
}

export type HistoryStatus = "ai-realtime" | "auto-synced" | "doctor-reviewed"

export interface HistoryEntry {
  id: number
  patient: string
  patientId: string
  time: string
  notesCount: number
  status: HistoryStatus
  confidence: number
}

// Records flagged because Gemini confidence < 80% after offline sync
export const queuedRecords: PatientRecord[] = [
  {
    id: 1,
    patient: "Fatima Zerhouni",
    patientId: "FZR-381",
    date: "Today, 08:14",
    overallConfidence: 72,
    predictionScore: 68,
    scanImage: "/images/mock-scan-1.jpg",
    extractedFields: [
      { label: "Medication", value: "Metformin 500mg", confidence: 85 },
      { label: "Dosage", value: "1x / day", confidence: 91 },
      { label: "Symptoms", value: "Dizziness, fatigue", confidence: 62 },
      { label: "Diagnosis", value: "Type 2 Diabetes", confidence: 78 },
      { label: "Notes", value: "Blood sugar monitoring weekly", confidence: 55 },
    ],
    reason: "Handwriting unclear in symptoms section",
    status: "needs-review",
  },
  {
    id: 2,
    patient: "Youcef Hamdi",
    patientId: "YHM-410",
    date: "Today, 07:55",
    overallConfidence: 65,
    predictionScore: 59,
    scanImage: "/images/mock-scan-2.jpg",
    extractedFields: [
      { label: "Medication", value: "Ibuprofen 400mg (?)", confidence: 48 },
      { label: "Dosage", value: "3x / day (?)", confidence: 52 },
      { label: "Symptoms", value: "Joint pain, swelling", confidence: 73 },
      { label: "Diagnosis", value: "Rheumatoid Arthritis (?)", confidence: 61 },
      { label: "Notes", value: "Refer to specialist if no improvement", confidence: 80 },
    ],
    reason: "Medication and dosage illegible",
    status: "needs-review",
  },
  {
    id: 3,
    patient: "Meriem Taleb",
    patientId: "MTL-224",
    date: "Today, 07:30",
    overallConfidence: 78,
    predictionScore: 74,
    scanImage: "/images/mock-scan-3.jpg",
    extractedFields: [
      { label: "Medication", value: "Paracetamol 1g", confidence: 92 },
      { label: "Dosage", value: "As needed, max 3/day", confidence: 88 },
      { label: "Symptoms", value: "Headache, mild fever", confidence: 85 },
      { label: "Diagnosis", value: "Common Cold", confidence: 71 },
      { label: "Notes", value: "Rest, fluids, follow-up in 3 days", confidence: 60 },
    ],
    reason: "Partial page captured, diagnosis unclear",
    status: "needs-review",
  },
]

// Records that were auto-approved (confidence >= 80%)
export const approvedRecords: PatientRecord[] = [
  {
    id: 4,
    patient: "Karim Ouali",
    patientId: "KOU-198",
    date: "Today, 06:50",
    overallConfidence: 91,
    predictionScore: 89,
    scanImage: "/images/mock-scan-1.jpg",
    extractedFields: [
      { label: "Medication", value: "Amoxicillin 500mg", confidence: 95 },
      { label: "Dosage", value: "2x / day for 7 days", confidence: 93 },
      { label: "Symptoms", value: "Sore throat, cough", confidence: 88 },
      { label: "Diagnosis", value: "Bacterial Pharyngitis", confidence: 90 },
    ],
    reason: "Auto-approved",
    status: "approved",
    syncedAt: "06:52",
  },
]

// Online real-time extraction result (Case B) -- NO patient name field, it's known from QR
export const onlineExtractionResult = {
  fields: [
    { label: "Symptoms", value: "Fever, Cough, Fatigue", confidence: 94 },
    { label: "Diagnosis", value: "Upper Respiratory Infection", confidence: 91 },
    { label: "Medication", value: "Amoxicillin 500mg", confidence: 96 },
    { label: "Dosage", value: "2x / day for 7 days", confidence: 95 },
    { label: "Notes", value: "Follow-up in 5 days if no improvement", confidence: 88 },
  ],
  overallConfidence: 94,
  predictionScore: 92,
}

// Today's history
export const initialHistory: HistoryEntry[] = [
  {
    id: 101,
    patient: "Karim Ouali",
    patientId: "KOU-198",
    time: "14:32",
    notesCount: 2,
    status: "auto-synced",
    confidence: 91,
  },
  {
    id: 102,
    patient: "Nadia Benmansour",
    patientId: "NBM-550",
    time: "11:45",
    notesCount: 1,
    status: "ai-realtime",
    confidence: 95,
  },
  {
    id: 103,
    patient: "Fatima Zerhouni",
    patientId: "FZR-381",
    time: "09:15",
    notesCount: 3,
    status: "doctor-reviewed",
    confidence: 72,
  },
  {
    id: 104,
    patient: "Youcef Hamdi",
    patientId: "YHM-410",
    time: "08:30",
    notesCount: 1,
    status: "doctor-reviewed",
    confidence: 65,
  },
  {
    id: 105,
    patient: "Meriem Taleb",
    patientId: "MTL-224",
    time: "07:50",
    notesCount: 2,
    status: "auto-synced",
    confidence: 88,
  },
]
