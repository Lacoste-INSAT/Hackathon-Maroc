// ─────────────────────────────────────────────────────────────
// TabibNet — JWT Authentication Middleware
// ─────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';
import { JwtPayload, UserRole } from '../types';

// Extend Express Request to carry user info
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Verify JWT token from Authorization header.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: "Token d'authentification requis" });
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token invalide ou expiré' });
  }
}

/**
 * Require one of the specified roles.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Non authentifié' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Accès interdit pour ce rôle' });
      return;
    }

    next();
  };
}
