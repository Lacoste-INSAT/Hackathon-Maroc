// ─────────────────────────────────────────────────────────────
// TabibNet — Database Seed Script
// ─────────────────────────────────────────────────────────────
// Creates: 1 doctor, 3 patients, availability rules, slots
// Run: npx tsx src/db/seed.ts
// ─────────────────────────────────────────────────────────────

import { pool, initDb, query } from './pool';
import { generateSlotsForRange } from '../services/slotService';
import bcrypt from 'bcryptjs';

async function seed() {
  await initDb();
  console.log('\n[Seed] 🌱 Creating demo data...\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 1. Doctor ─────────────────────────────────────────────
    const doctorPassword = await bcrypt.hash('doctor123', 10);
    const doctorUserResult = await client.query(
      `INSERT INTO users (role, full_name, email, phone, password_hash)
       VALUES ('DOCTOR', 'Dr. Ahmed Benali', 'doctor@tabib.dz', '+213555000001', $1)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [doctorPassword]
    );
    const doctorUserId = doctorUserResult.rows[0].id;

    const doctorProfileResult = await client.query(
      `INSERT INTO doctor_profiles (user_id, specialty, clinic_name, bio)
       VALUES ($1, 'Médecine Générale', 'Cabinet Central - Alger',
               'Médecin généraliste avec 10 ans d''expérience. Consultations sur rendez-vous.')
       ON CONFLICT (user_id) DO UPDATE SET specialty = EXCLUDED.specialty
       RETURNING id`,
      [doctorUserId]
    );
    const doctorProfileId = doctorProfileResult.rows[0].id;
    console.log(`  ✅ Doctor: Dr. Ahmed Benali (doctor@tabib.dz / doctor123)`);

    // ── 2. Patients ───────────────────────────────────────────
    const patients = [
      { name: 'Fatima Zahra',    email: 'fatima@test.com', phone: '+213555100001', code: 'FAT-001', dob: '1990-03-15', gender: 'F' },
      { name: 'Karim Mansouri',  email: 'karim@test.com',  phone: '+213555100002', code: 'KAR-002', dob: '1985-07-22', gender: 'M' },
      { name: 'Nadia Belkacem',  email: 'nadia@test.com',  phone: '+213555100003', code: 'NAD-003', dob: '1998-11-08', gender: 'F' },
    ];

    for (const p of patients) {
      const patientPassword = await bcrypt.hash('patient123', 10);
      const userResult = await client.query(
        `INSERT INTO users (role, full_name, email, phone, password_hash)
         VALUES ('PATIENT', $1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`,
        [p.name, p.email, p.phone, patientPassword]
      );

      await client.query(
        `INSERT INTO patients (user_id, patient_code, date_of_birth, gender)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET patient_code = EXCLUDED.patient_code`,
        [userResult.rows[0].id, p.code, p.dob, p.gender]
      );
      console.log(`  ✅ Patient: ${p.name} (${p.phone})`);
    }

    // ── 3. Availability Rules (Mon–Fri, 9h–12h + 14h–17h) ──
    await client.query('DELETE FROM availability_rules WHERE doctor_id = $1', [doctorProfileId]);

    for (let day = 1; day <= 5; day++) {
      // Morning block
      await client.query(
        `INSERT INTO availability_rules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes)
         VALUES ($1, $2, '09:00', '12:00', 20)`,
        [doctorProfileId, day]
      );
      // Afternoon block
      await client.query(
        `INSERT INTO availability_rules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes)
         VALUES ($1, $2, '14:00', '17:00', 20)`,
        [doctorProfileId, day]
      );
    }
    console.log(`  ✅ Availability: Mon-Fri 09:00-12:00 + 14:00-17:00 (20 min slots)`);

    await client.query('COMMIT');

    // ── 4. Generate Slots (next 7 days) ─────────────────────
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const fromStr = today.toISOString().split('T')[0];
    const toStr = nextWeek.toISOString().split('T')[0];

    const slotsCount = await generateSlotsForRange(doctorProfileId, fromStr, toStr);
    console.log(`  ✅ Generated ${slotsCount} time slots (${fromStr} → ${toStr})`);

    // ── Summary ─────────────────────────────────────────────
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║         TabibNet — Demo Data Ready           ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║  Doctor:   doctor@tabib.dz / doctor123      ║');
    console.log('║  Patient:  +213555100001 (Fatima) → OTP     ║');
    console.log('║  Patient:  +213555100002 (Karim)  → OTP     ║');
    console.log('║  Patient:  +213555100003 (Nadia)  → OTP     ║');
    console.log('╚══════════════════════════════════════════════╝\n');

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await pool.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] ❌ Error:', err);
  process.exit(1);
});
