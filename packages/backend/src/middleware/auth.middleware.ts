import { NextFunction, Request, Response } from 'express';

import { AuthError, AuthService } from '../modules/auth/auth.service';

const defaultAuthService = new AuthService();

function createAuthMiddleware(authService: AuthService): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const authorization = req.get('authorization');
    const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);

    if (!match) {
      res.status(401).json({
        error: 'INVALID_ACCESS_TOKEN',
        message: 'Invalid or expired access token',
      });
      return;
    }

    try {
      const payload = authService.validateToken(match[1]);
      req.user = { id: payload.sub, role: payload.role };
      next();
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: error.code, message: error.message });
        return;
      }

      next(error);
    }
  };
}

const defaultMiddleware = createAuthMiddleware(defaultAuthService);

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  defaultMiddleware(req, res, next);
}

export { createAuthMiddleware };
export default authMiddleware;
