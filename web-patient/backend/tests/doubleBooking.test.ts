// ─────────────────────────────────────────────────────────────
// TabibNet — Double Booking Prevention Tests
// ─────────────────────────────────────────────────────────────

import { Pool } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/medapp';

describe('Double Booking Prevention', () => {
  let pool: Pool;
  let doctorId: string;
  let slotId: string;
  let patient1Id: string;
  let patient2Id: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });

    const ts = Date.now();

    // Create a test doctor user
    const doctorUser = await pool.query(
      `INSERT INTO users (role, full_name, email)
       VALUES ('DOCTOR', 'Test Doctor', $1) RETURNING id`,
      [`test-doctor-${ts}@test.com`]
    );
    const doctorProfile = await pool.query(
      `INSERT INTO doctor_profiles (user_id, specialty)
       VALUES ($1, 'Test') RETURNING id`,
      [doctorUser.rows[0].id]
    );
    doctorId = doctorProfile.rows[0].id;

    // Create a test slot (tomorrow)
    const slot = await pool.query(
      `INSERT INTO slots (doctor_id, start_datetime, end_datetime, status)
       VALUES ($1, now() + interval '1 day', now() + interval '1 day 20 minutes', 'FREE')
       RETURNING id`,
      [doctorId]
    );
    slotId = slot.rows[0].id;

    // Create 2 test patients
    const p1User = await pool.query(
      `INSERT INTO users (role, full_name, email)
       VALUES ('PATIENT', 'Patient 1', $1) RETURNING id`,
      [`test-p1-${ts}@test.com`]
    );
    const p1 = await pool.query(
      'INSERT INTO patients (user_id) VALUES ($1) RETURNING id',
      [p1User.rows[0].id]
    );
    patient1Id = p1.rows[0].id;

    const p2User = await pool.query(
      `INSERT INTO users (role, full_name, email)
       VALUES ('PATIENT', 'Patient 2', $1) RETURNING id`,
      [`test-p2-${ts}@test.com`]
    );
    const p2 = await pool.query(
      'INSERT INTO patients (user_id) VALUES ($1) RETURNING id',
      [p2User.rows[0].id]
    );
    patient2Id = p2.rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  test('should allow the first booking on a FREE slot', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock + check slot
      const lockResult = await client.query(
        'SELECT * FROM slots WHERE id = $1 FOR UPDATE',
        [slotId]
      );
      expect(lockResult.rows[0].status).toBe('FREE');

      // Book it
      await client.query('UPDATE slots SET status = $1 WHERE id = $2', ['BOOKED', slotId]);
      await client.query(
        `INSERT INTO appointments (patient_id, doctor_id, slot_id, type, status)
         VALUES ($1, $2, $3, 'SCHEDULED', 'BOOKED')`,
        [patient1Id, doctorId, slotId]
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });

  test('should REJECT a second booking on the same slot (UNIQUE constraint)', async () => {
    let error: any = null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO appointments (patient_id, doctor_id, slot_id, type, status)
         VALUES ($1, $2, $3, 'SCHEDULED', 'BOOKED')`,
        [patient2Id, doctorId, slotId]
      );
      await client.query('COMMIT');
    } catch (e: any) {
      error = e;
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    expect(error).not.toBeNull();
    // PostgreSQL error code 23505 = unique_violation
    expect(error.code).toBe('23505');
  });

  test('slot should remain BOOKED after the first booking', async () => {
    const result = await pool.query('SELECT status FROM slots WHERE id = $1', [slotId]);
    expect(result.rows[0].status).toBe('BOOKED');
  });

  test('concurrent booking attempts — only one should succeed', async () => {
    // Create a fresh slot for this test
    const freshSlot = await pool.query(
      `INSERT INTO slots (doctor_id, start_datetime, end_datetime, status)
       VALUES ($1, now() + interval '2 days', now() + interval '2 days 20 minutes', 'FREE')
       RETURNING id`,
      [doctorId]
    );
    const freshSlotId = freshSlot.rows[0].id;

    // Simulate 2 concurrent booking attempts
    const bookAttempt = async (patientId: string): Promise<boolean> => {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const lock = await c.query(
          'SELECT * FROM slots WHERE id = $1 AND status = $2 FOR UPDATE',
          [freshSlotId, 'FREE']
        );
        if (lock.rows.length === 0) {
          await c.query('ROLLBACK');
          return false;
        }
        await c.query('UPDATE slots SET status = $1 WHERE id = $2', ['BOOKED', freshSlotId]);
        await c.query(
          `INSERT INTO appointments (patient_id, doctor_id, slot_id, type, status)
           VALUES ($1, $2, $3, 'SCHEDULED', 'BOOKED')`,
          [patientId, doctorId, freshSlotId]
        );
        await c.query('COMMIT');
        return true;
      } catch {
        await c.query('ROLLBACK');
        return false;
      } finally {
        c.release();
      }
    };

    const results = await Promise.all([
      bookAttempt(patient1Id),
      bookAttempt(patient2Id),
    ]);

    const successCount = results.filter(Boolean).length;
    expect(successCount).toBe(1); // Exactly one should succeed
  });
});
