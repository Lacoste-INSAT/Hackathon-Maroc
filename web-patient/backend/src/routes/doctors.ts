// ─────────────────────────────────────────────────────────────
// TabibNet — Doctor Routes (public: list doctors + slots)
// ─────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';

const router = Router();

// ── GET /doctors ────────────────────────────────────────────
// List all doctors (requires auth).

router.get('/', authenticate, async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT dp.id, u.full_name, dp.specialty, dp.clinic_name, dp.bio
      FROM doctor_profiles dp
      JOIN users u ON u.id = dp.user_id
      ORDER BY u.full_name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[Doctors] List error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ── GET /doctors/:id ────────────────────────────────────────
// Get single doctor by profile id.

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT dp.id, u.full_name, dp.specialty, dp.clinic_name, dp.bio
       FROM doctor_profiles dp
       JOIN users u ON u.id = dp.user_id
       WHERE dp.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Médecin non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Doctors] Get error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ── GET /doctors/:id/slots?from=…&to=… ─────────────────────
// Get FREE slots for a doctor within a date range.

router.get('/:id/slots', authenticate, async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: 'Paramètres from et to requis (YYYY-MM-DD)' });
    }

    const result = await query(
      `SELECT id, doctor_id, start_datetime, end_datetime, status
       FROM slots
       WHERE doctor_id = $1
         AND start_datetime >= $2::date
         AND start_datetime < ($3::date + interval '1 day')
         AND status = 'FREE'
         AND start_datetime > now()
       ORDER BY start_datetime`,
      [req.params.id, from, to]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('[Doctors] Slots error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;
