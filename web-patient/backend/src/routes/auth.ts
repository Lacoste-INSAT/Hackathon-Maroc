// ─────────────────────────────────────────────────────────────
// TabibNet — Auth Routes (OTP for patients, password for doctors)
// ─────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { query } from '../db/pool';
import { generateOtp, generateToken, comparePassword } from '../services/authService';
import { sendOtpNotification } from '../services/notificationService';

const router = Router();

// ── POST /auth/otp/request ──────────────────────────────────
// Request an OTP code for patient login/registration.

router.post('/otp/request', async (req: Request, res: Response) => {
  try {
    const { phone, email } = req.body;
    const identifier = phone || email;

    if (!identifier) {
      return res.status(400).json({ message: 'Numéro de téléphone ou email requis' });
    }

    // Find user by phone or email
    let userResult;
    if (phone) {
      userResult = await query('SELECT * FROM users WHERE phone = $1', [phone]);
    } else {
      userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
    }

    let user;
    if (userResult.rows.length === 0) {
      // Auto-register: create a new patient account
      const insertResult = await query(
        `INSERT INTO users (role, full_name, phone, email)
         VALUES ('PATIENT', $1, $2, $3) RETURNING *`,
        [identifier, phone || null, email || null]
      );
      user = insertResult.rows[0];

      // Create patient profile
      await query('INSERT INTO patients (user_id) VALUES ($1)', [user.id]);
    } else {
      user = userResult.rows[0];
    }

    // Generate and store OTP (valid 5 minutes)
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await query(
      'UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3',
      [otpCode, expiresAt.toISOString(), user.id]
    );

    // Send notification (mock in MVP)
    await sendOtpNotification(identifier, otpCode);

    // MVP: return OTP in response for demo/testing
    res.json({
      message: 'Code envoyé',
      otp_code: otpCode, // ⚠️  Remove in production!
    });
  } catch (err: any) {
    console.error('[Auth] OTP request error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ── POST /auth/otp/verify ───────────────────────────────────
// Verify OTP code and return JWT.

router.post('/otp/verify', async (req: Request, res: Response) => {
  try {
    const { phone, email, code } = req.body;

    if (!code || (!phone && !email)) {
      return res.status(400).json({ message: 'Code et identifiant requis' });
    }

    const field = phone ? 'phone' : 'email';
    const value = phone || email;

    const result = await query(
      `SELECT u.*, p.id AS patient_id
       FROM users u
       LEFT JOIN patients p ON p.user_id = u.id
       WHERE u.${field} = $1`,
      [value]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const user = result.rows[0];

    if (user.otp_code !== code) {
      return res.status(401).json({ message: 'Code invalide' });
    }

    if (new Date(user.otp_expires_at) < new Date()) {
      return res.status(401).json({ message: 'Code expiré' });
    }

    // Clear OTP after successful verification
    await query(
      'UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE id = $1',
      [user.id]
    );

    const token = generateToken({
      userId: user.id,
      role: user.role,
      patientId: user.patient_id,
    });

    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        full_name: user.full_name,
        patient_id: user.patient_id,
      },
    });
  } catch (err: any) {
    console.error('[Auth] OTP verify error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ── POST /auth/doctor/login ─────────────────────────────────
// Doctor login with email + password.

router.post('/doctor/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    const result = await query(
      `SELECT u.*, dp.id AS doctor_id
       FROM users u
       LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
       WHERE u.email = $1 AND u.role = 'DOCTOR'`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Identifiants invalides' });
    }

    const user = result.rows[0];

    if (!user.password_hash || !(await comparePassword(password, user.password_hash))) {
      return res.status(401).json({ message: 'Identifiants invalides' });
    }

    const token = generateToken({
      userId: user.id,
      role: 'DOCTOR',
      doctorId: user.doctor_id,
    });

    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        full_name: user.full_name,
        doctor_id: user.doctor_id,
      },
    });
  } catch (err: any) {
    console.error('[Auth] Doctor login error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;
