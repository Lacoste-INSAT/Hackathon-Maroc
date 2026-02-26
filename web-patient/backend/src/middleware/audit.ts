// ─────────────────────────────────────────────────────────────
// TabibNet — Audit Logging Middleware
// ─────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { query } from '../db/pool';

/**
 * Log an action for audit trail.
 */
export async function logAudit(
  actorUserId: string,
  patientId: string | null,
  action: string,
  details?: any
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (actor_user_id, patient_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [actorUserId, patientId, action, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('[Audit] Log error:', err);
  }
}

/**
 * Express middleware that logs non-GET requests with user info.
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.user && req.method !== 'GET') {
      console.log(
        `[Audit] ${req.method} ${req.path} | User: ${req.user.userId} | ${res.statusCode} | ${duration}ms`
      );
    }
  });

  next();
}
