// ─────────────────────────────────────────────────────────────
// TabibNet — Appointment Routes (patient-facing)
// ─────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  bookAppointment,
  cancelAppointment,
  checkinAppointment,
  getPatientAppointments,
} from '../services/appointmentService';
import { logAudit } from '../middleware/audit';

const router = Router();

// ── POST /appointments ──────────────────────────────────────
// Book an appointment (patient only).

router.post('/', authenticate, requireRole('PATIENT'), async (req: Request, res: Response) => {
  try {
    const { doctor_id, slot_id } = req.body;

    if (!doctor_id || !slot_id) {
      return res.status(400).json({ message: 'doctor_id et slot_id requis' });
    }

    const appointment = await bookAppointment(req.user!.patientId!, doctor_id, slot_id);

    await logAudit(req.user!.userId, null, 'BOOK_APPOINTMENT', {
      appointment_id: appointment.id,
      slot_id,
    });

    res.status(201).json(appointment);
  } catch (err: any) {
    if (err.message === 'SLOT_NOT_FREE') {
      return res.status(409).json({ message: "Ce créneau n'est plus disponible" });
    }
    console.error('[Appointments] Book error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ── DELETE /appointments/:id ────────────────────────────────
// Cancel an appointment (patient only).

router.delete('/:id', authenticate, requireRole('PATIENT'), async (req: Request, res: Response) => {
  try {
    const result = await cancelAppointment(req.params.id, req.user!.patientId!);

    await logAudit(req.user!.userId, null, 'CANCEL_APPOINTMENT', {
      appointment_id: req.params.id,
    });

    res.json(result);
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Rendez-vous non trouvé' });
    }
    if (err.message === 'CANCEL_DEADLINE_PASSED') {
      return res.status(400).json({ message: "Délai d'annulation dépassé (2h avant)" });
    }
    if (err.message === 'ALREADY_CANCELLED') {
      return res.status(400).json({ message: 'Rendez-vous déjà annulé' });
    }
    console.error('[Appointments] Cancel error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ── GET /appointments/me ────────────────────────────────────
// List current patient's appointments.

router.get('/me', authenticate, requireRole('PATIENT'), async (req: Request, res: Response) => {
  try {
    const appointments = await getPatientAppointments(req.user!.patientId!);
    res.json(appointments);
  } catch (err) {
    console.error('[Appointments] List error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ── POST /appointments/:id/checkin ──────────────────────────
// Check-in with QR token (no auth required — scanned by doctor).

router.post('/:id/checkin', async (req: Request, res: Response) => {
  try {
    const { qr_token } = req.body;

    if (!qr_token) {
      return res.status(400).json({ message: 'qr_token requis' });
    }

    const appointment = await checkinAppointment(req.params.id, qr_token);
    res.json(appointment);
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Rendez-vous non trouvé' });
    }
    if (err.message === 'INVALID_TOKEN') {
      return res.status(401).json({ message: 'Token QR invalide' });
    }
    if (err.message === 'ALREADY_CHECKED_IN') {
      return res.status(400).json({ message: 'Déjà enregistré' });
    }
    console.error('[Appointments] Checkin error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;
