// ─────────────────────────────────────────────────────────────
// TabibNet — Slot Generation Service
// ─────────────────────────────────────────────────────────────

import { query } from '../db/pool';

/**
 * Generate time slots for a doctor based on their availability rules.
 * Uses ON CONFLICT DO NOTHING for idempotency.
 *
 * @returns Number of slots inserted
 */
export async function generateSlotsForRange(
  doctorId: string,
  fromDate: string,
  toDate: string
): Promise<number> {
  // Fetch availability rules for this doctor
  const rulesResult = await query(
    'SELECT * FROM availability_rules WHERE doctor_id = $1',
    [doctorId]
  );

  const rules = rulesResult.rows;
  if (rules.length === 0) {
    console.log(`[Slots] No availability rules found for doctor ${doctorId}`);
    return 0;
  }

  let count = 0;
  const from = new Date(fromDate);
  const to = new Date(toDate);

  // Iterate day by day
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay(); // 0=Sunday
    const dayRules = rules.filter((r: any) => r.day_of_week === dayOfWeek);

    for (const rule of dayRules) {
      // Parse HH:MM or HH:MM:SS from PostgreSQL TIME type
      const startParts = rule.start_time.split(':').map(Number);
      const endParts = rule.end_time.split(':').map(Number);
      const duration = rule.slot_duration_minutes;

      const slotStart = new Date(d);
      slotStart.setHours(startParts[0], startParts[1], 0, 0);

      const ruleEnd = new Date(d);
      ruleEnd.setHours(endParts[0], endParts[1], 0, 0);

      while (slotStart.getTime() + duration * 60000 <= ruleEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);

        const result = await query(
          `INSERT INTO slots (doctor_id, start_datetime, end_datetime, status)
           VALUES ($1, $2, $3, 'FREE')
           ON CONFLICT (doctor_id, start_datetime) DO NOTHING`,
          [doctorId, slotStart.toISOString(), slotEnd.toISOString()]
        );

        if (result.rowCount && result.rowCount > 0) {
          count++;
        }

        slotStart.setTime(slotStart.getTime() + duration * 60000);
      }
    }
  }

  console.log(`[Slots] Generated ${count} new slots for doctor ${doctorId}`);
  return count;
}
