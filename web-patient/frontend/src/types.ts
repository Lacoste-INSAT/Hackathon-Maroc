// ─────────────────────────────────────────────────────────────
// TabibNet — Frontend Types
// ─────────────────────────────────────────────────────────────

export interface Doctor {
  id: string;
  full_name: string;
  specialty: string;
  clinic_name: string;
  bio: string;
}

export interface Slot {
  id: string;
  doctor_id: string;
  start_datetime: string;
  end_datetime: string;
  status: 'FREE' | 'BOOKED' | 'BLOCKED' | 'RESERVED' | 'CANCELLED';
}

export interface Appointment {
  id: string;
  status: 'BOOKED' | 'CANCELLED' | 'ARRIVED' | 'NO_SHOW' | 'COMPLETED';
  type: 'SCHEDULED' | 'WALK_IN';
  qr_token: string;
  checkin_at: string | null;
  created_at: string;
  start_datetime: string;
  end_datetime: string;
  doctor_name: string;
  specialty: string;
  clinic_name: string;
}

export interface AuthUser {
  id: string;
  role: 'DOCTOR' | 'PATIENT';
  full_name: string;
  patient_id?: string;
  doctor_id?: string;
}
