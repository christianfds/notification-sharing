import { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

export default requireRole;
