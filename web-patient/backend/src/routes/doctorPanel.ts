// ─────────────────────────────────────────────────────────────
// TabibNet — Doctor Panel Routes (for the mobile app)
// ─────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { query } from '../db/pool';
import { generateSlotsForRange } from '../services/slotService';
import { logAudit } from '../middleware/audit';

const router = Router();

// ── GET /doctor/availability ────────────────────────────────
// Get current availability rules.

router.get('/availability', authenticate, requireRole('DOCTOR'), async (req: Request, res: Response) => {
  try {
    const doctorId = req.user!.doctorId!;
    const result = await query(
      'SELECT day_of_week, start_time, end_time, slot_duration_minutes FROM availability_rules WHERE doctor_id = $1 ORDER BY day_of_week, start_time',
      [doctorId]
    );
    // Format TIME as HH:MM string
    const rules = result.rows.map((r: any) => ({
      day_of_week: r.day_of_week,
      start_time: String(r.start_time).slice(0, 5),
      end_time: String(r.end_time).slice(0, 5),
      slot_duration_minutes: r.slot_duration_minutes,
    }));
    res.json(rules);
  } catch (err) {
    console.error('[Doctor] Get availability error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ── POST /doctor/availability ───────────────────────────────
// Set availability rules (replaces all existing rules).

router.post('/availability', authenticate, requireRole('DOCTOR'), async (req: Request, res: Response) => {
  try {
    const { rules } = req.body;
    const doctorId = req.user!.doctorId!;

    if (!rules || !Array.isArray(rules)) {
      return res.status(400).json({ message: 'rules (array) requis' });
    }

    // Clear existing rules
    await query('DELETE FROM availability_rules WHERE doctor_id = $1', [doctorId]);

    // Insert new rules
    for (const rule of rules) {
      await query(
        `INSERT INTO availability_rules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes)
         VALUES ($1, $2, $3, $4, $5)`,
        [doctorId, rule.day_of_week, rule.start_time, rule.end_time, rule.slot_duration_minutes || 20]
      );
    }

    await logAudit(req.user!.userId, null, 'SET_AVAILABILITY', { rules_count: rules.length });

    res.json({ message: 'Disponibilités mises à jour', count: rules.length });
  } catch (err) {
    console.error('[Doctor] Availability error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ── POST /doctor/slots/generate?from=…&to=… ────────────────
// Generate slots from availability rules.

router.post('/slots/generate', authenticate, requireRole('DOCTOR'), async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const doctorId = req.user!.doctorId!;

    if (!from || !to) {
      return res.status(400).json({ message: 'Paramètres from et to requis (YYYY-MM-DD)' });
    }

    const count = await generateSlotsForRange(doctorId, from as string, to as string);

    await logAudit(req.user!.userId, null, 'GENERATE_SLOTS', { from, to, count });

    res.json({ message: `${count} créneaux générés`, count });
  } catch (err) {
    console.error('[Doctor] Slots generate error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ── GET /doctor/appointments?date=… ─────────────────────────
// List appointments for a date (or all if no date filter).

router.get('/appointments', authenticate, requireRole('DOCTOR'), async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const doctorId = req.user!.doctorId!;

    let whereDate = '';
    const params: any[] = [doctorId];

    if (date) {
      whereDate = 'AND s.start_datetime::date = $2';
      params.push(date);
    }

    const result = await query(
      `SELECT a.id, a.status, a.type, a.checkin_at, a.qr_token, a.created_at,
              s.start_datetime, s.end_datetime,
              u.full_name AS patient_name, p.patient_code
       FROM appointments a
       JOIN slots s ON s.id = a.slot_id
       JOIN patients p ON p.id = a.patient_id
       JOIN users u ON u.id = p.user_id
       WHERE a.doctor_id = $1 ${whereDate}
       ORDER BY s.start_datetime`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    console.error('[Doctor] Appointments error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ── PATCH /doctor/appointments/:id/status ───────────────────
// Update appointment status (NO_SHOW, COMPLETED, CANCELLED).

router.patch('/appointments/:id/status', authenticate, requireRole('DOCTOR'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['NO_SHOW', 'COMPLETED', 'CANCELLED'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Status invalide. Valeurs acceptées: ${validStatuses.join(', ')}`,
      });
    }

    const result = await query(
      'UPDATE appointments SET status = $1 WHERE id = $2 AND doctor_id = $3 RETURNING *',
      [status, req.params.id, req.user!.doctorId!]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rendez-vous non trouvé' });
    }

    // If cancelled by doctor, free the slot
    if (status === 'CANCELLED') {
      await query('UPDATE slots SET status = $1 WHERE id = $2', ['FREE', result.rows[0].slot_id]);
    }

    await logAudit(req.user!.userId, null, 'UPDATE_APPOINTMENT_STATUS', {
      appointment_id: req.params.id,
      new_status: status,
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Doctor] Status update error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ── GET /doctor/patients/:publicId/records ──────────────────
// Get medical records by patient public_id (compatible with QR scan).

router.get('/patients/:publicId/records', authenticate, requireRole('DOCTOR'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT mr.* FROM medical_records_web mr
       JOIN patients p ON p.id = mr.patient_id
       WHERE p.public_id = $1
       ORDER BY mr.created_at DESC`,
      [req.params.publicId]
    );

    await logAudit(req.user!.userId, null, 'VIEW_PATIENT_RECORDS', {
      public_id: req.params.publicId,
    });

    res.json(result.rows);
  } catch (err) {
    console.error('[Doctor] Records error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;
