// ─────────────────────────────────────────────────────────────
// TabibNet — Shared TypeScript Types
// ─────────────────────────────────────────────────────────────

export type UserRole = 'DOCTOR' | 'PATIENT';
export type SlotStatus = 'FREE' | 'BOOKED' | 'BLOCKED' | 'RESERVED' | 'CANCELLED';
export type AppointmentStatus = 'BOOKED' | 'CANCELLED' | 'ARRIVED' | 'NO_SHOW' | 'COMPLETED';
export type AppointmentType = 'SCHEDULED' | 'WALK_IN';

export interface User {
  id: string;
  role: UserRole;
  full_name: string;
  email: string | null;
  phone: string | null;
  password_hash: string | null;
  otp_code: string | null;
  otp_expires_at: string | null;
  created_at: string;
}

export interface Patient {
  id: string;
  user_id: string;
  public_id: string;
  qr_secret: string;
  patient_code: string | null;
  date_of_birth: string | null;
  gender: 'M' | 'F' | 'Other' | null;
  created_at: string;
}

export interface DoctorProfile {
  id: string;
  user_id: string;
  specialty: string | null;
  clinic_name: string | null;
  bio: string | null;
  created_at: string;
}

export interface AvailabilityRule {
  id: string;
  doctor_id: string;
  day_of_week: number; // 0=Sunday ... 6=Saturday
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
}

export interface Slot {
  id: string;
  doctor_id: string;
  start_datetime: string;
  end_datetime: string;
  status: SlotStatus;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  slot_id: string;
  type: AppointmentType;
  status: AppointmentStatus;
  checkin_at: string | null;
  qr_token: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string;
  patient_id: string | null;
  action: string;
  details: any;
  created_at: string;
}

// ── JWT Payload ─────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  role: UserRole;
  patientId?: string;
  doctorId?: string;
}
